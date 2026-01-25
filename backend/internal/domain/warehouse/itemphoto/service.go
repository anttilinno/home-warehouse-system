package itemphoto

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	"github.com/antti/home-warehouse/go-backend/internal/jobs"
)

const (
	// MaxFileSize is the maximum allowed photo file size (10MB)
	MaxFileSize = 10 * 1024 * 1024
)

var (
	ErrPhotoNotFound      = errors.New("photo not found")
	ErrInvalidFileType    = errors.New("invalid file type: only JPEG, PNG, and WebP are allowed")
	ErrFileTooLarge       = errors.New("file too large: maximum size is 10MB")
	ErrItemNotFound       = errors.New("item not found")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrInvalidDisplayOrder = errors.New("invalid display order")
)

// Storage defines the interface for file storage operations
type Storage interface {
	Save(ctx context.Context, workspaceID, itemID, filename string, reader io.Reader) (path string, err error)
	Get(ctx context.Context, path string) (io.ReadCloser, error)
	Delete(ctx context.Context, path string) error
	GetURL(ctx context.Context, path string) (string, error)
	Exists(ctx context.Context, path string) (bool, error)
}

// ImageProcessor defines the interface for image processing operations
type ImageProcessor interface {
	GenerateThumbnail(ctx context.Context, sourcePath, destPath string, maxWidth, maxHeight int) error
	GetDimensions(ctx context.Context, path string) (width, height int, err error)
	Validate(ctx context.Context, path string) error
}

// ServiceInterface defines the public interface for item photo operations
type ServiceInterface interface {
	UploadPhoto(ctx context.Context, itemID, workspaceID, userID uuid.UUID, file multipart.File, header *multipart.FileHeader, caption *string) (*ItemPhoto, error)
	ListPhotos(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*ItemPhoto, error)
	GetPhoto(ctx context.Context, id uuid.UUID) (*ItemPhoto, error)
	SetPrimaryPhoto(ctx context.Context, photoID, workspaceID uuid.UUID) error
	UpdateCaption(ctx context.Context, photoID, workspaceID uuid.UUID, caption *string) error
	ReorderPhotos(ctx context.Context, itemID, workspaceID uuid.UUID, photoIDs []uuid.UUID) error
	DeletePhoto(ctx context.Context, id, workspaceID uuid.UUID) error
}

// Service implements the item photo business logic
type Service struct {
	repo        Repository
	storage     Storage
	processor   ImageProcessor
	asynqClient *asynq.Client
	uploadDir   string // Base directory for temporary uploads
}

// NewService creates a new item photo service
func NewService(repo Repository, storage Storage, processor ImageProcessor, uploadDir string) *Service {
	return &Service{
		repo:      repo,
		storage:   storage,
		processor: processor,
		uploadDir: uploadDir,
	}
}

// SetAsynqClient sets the asynq client for background job enqueuing.
// This is optional - if not set, thumbnails will not be generated in background.
func (s *Service) SetAsynqClient(client *asynq.Client) {
	s.asynqClient = client
}

// UploadPhoto uploads a new photo for an item
func (s *Service) UploadPhoto(ctx context.Context, itemID, workspaceID, userID uuid.UUID, file multipart.File, header *multipart.FileHeader, caption *string) (*ItemPhoto, error) {
	// Validate file size
	if header.Size > MaxFileSize {
		return nil, ErrFileTooLarge
	}

	// Validate MIME type
	mimeType := header.Header.Get("Content-Type")
	if !isValidMimeType(mimeType) {
		return nil, ErrInvalidFileType
	}

	// Create temporary file for image processing
	tempFile, err := os.CreateTemp(s.uploadDir, "upload-*"+filepath.Ext(header.Filename))
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	tempPath := tempFile.Name()
	defer os.Remove(tempPath) // Clean up temp file

	// Copy uploaded data to temp file
	if _, err := io.Copy(tempFile, file); err != nil {
		tempFile.Close()
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}
	tempFile.Close()

	// Validate image
	if err := s.processor.Validate(ctx, tempPath); err != nil {
		return nil, fmt.Errorf("invalid image: %w", err)
	}

	// Get image dimensions
	width, height, err := s.processor.GetDimensions(ctx, tempPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get image dimensions: %w", err)
	}

	// Save original file to storage
	fileReader, err := os.Open(tempPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open temp file: %w", err)
	}
	defer fileReader.Close()

	storagePath, err := s.storage.Save(ctx, workspaceID.String(), itemID.String(), header.Filename, fileReader)
	if err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	// Get file size
	fileInfo, err := os.Stat(tempPath)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	// Get the next display order (append to end)
	existingPhotos, err := s.repo.GetByItem(ctx, itemID, workspaceID)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		return nil, fmt.Errorf("failed to get existing photos: %w", err)
	}

	displayOrder := int32(len(existingPhotos))
	isPrimary := len(existingPhotos) == 0 // First photo is primary by default

	// Create photo record with pending thumbnail status
	// ThumbnailPath is empty - thumbnails will be generated asynchronously
	photo := &ItemPhoto{
		ID:              uuid.New(),
		ItemID:         itemID,
		WorkspaceID:   workspaceID,
		Filename:      header.Filename,
		StoragePath:   storagePath,
		ThumbnailPath: "", // Legacy field - empty for async processing
		FileSize:      fileInfo.Size(),
		MimeType:      mimeType,
		Width:         int32(width),
		Height:        int32(height),
		DisplayOrder:  displayOrder,
		IsPrimary:     isPrimary,
		Caption:       caption,
		UploadedBy:    userID,
		ThumbnailStatus: ThumbnailStatusPending,
	}

	// Validate photo entity
	if err := photo.Validate(); err != nil {
		s.storage.Delete(ctx, storagePath)
		return nil, err
	}

	// Save to database
	createdPhoto, err := s.repo.Create(ctx, photo)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		return nil, fmt.Errorf("failed to save photo to database: %w", err)
	}

	// Enqueue thumbnail generation job (async, non-blocking)
	if s.asynqClient != nil {
		task := jobs.NewThumbnailGenerationTask(
			createdPhoto.ID,
			workspaceID,
			itemID,
			storagePath,
		)
		if _, err := s.asynqClient.Enqueue(task); err != nil {
			log.Printf("Failed to enqueue thumbnail job for photo %s: %v", createdPhoto.ID, err)
			// Don't fail upload - photo is usable, thumbnails will be missing
		}
	}

	return createdPhoto, nil
}

// ListPhotos returns all photos for an item
func (s *Service) ListPhotos(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*ItemPhoto, error) {
	photos, err := s.repo.GetByItem(ctx, itemID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to list photos: %w", err)
	}
	return photos, nil
}

// GetPhoto returns a single photo by ID
func (s *Service) GetPhoto(ctx context.Context, id uuid.UUID) (*ItemPhoto, error) {
	photo, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if photo == nil {
		return nil, ErrPhotoNotFound
	}
	return photo, nil
}

// SetPrimaryPhoto sets a photo as the primary photo for its item
func (s *Service) SetPrimaryPhoto(ctx context.Context, photoID, workspaceID uuid.UUID) error {
	// Verify photo exists and belongs to workspace
	photo, err := s.repo.GetByID(ctx, photoID)
	if err != nil {
		return err
	}
	if photo == nil {
		return ErrPhotoNotFound
	}
	if photo.WorkspaceID != workspaceID {
		return ErrUnauthorized
	}

	// Set as primary (this will unset all other primary photos for the item)
	if err := s.repo.SetPrimary(ctx, photoID); err != nil {
		return fmt.Errorf("failed to set primary photo: %w", err)
	}

	return nil
}

// UpdateCaption updates the caption of a photo
func (s *Service) UpdateCaption(ctx context.Context, photoID, workspaceID uuid.UUID, caption *string) error {
	// Get existing photo
	photo, err := s.repo.GetByID(ctx, photoID)
	if err != nil {
		return err
	}
	if photo == nil {
		return ErrPhotoNotFound
	}
	if photo.WorkspaceID != workspaceID {
		return ErrUnauthorized
	}

	// Update caption
	photo.Caption = caption

	if err := s.repo.Update(ctx, photo); err != nil {
		return fmt.Errorf("failed to update caption: %w", err)
	}

	return nil
}

// ReorderPhotos updates the display order of photos for an item
func (s *Service) ReorderPhotos(ctx context.Context, itemID, workspaceID uuid.UUID, photoIDs []uuid.UUID) error {
	// Get all photos for the item
	existingPhotos, err := s.repo.GetByItem(ctx, itemID, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to get existing photos: %w", err)
	}

	// Validate that all photo IDs exist and belong to this item
	photoMap := make(map[uuid.UUID]bool)
	for _, photo := range existingPhotos {
		photoMap[photo.ID] = true
	}

	for _, photoID := range photoIDs {
		if !photoMap[photoID] {
			return ErrInvalidDisplayOrder
		}
	}

	// Ensure all photos are included in the reorder
	if len(photoIDs) != len(existingPhotos) {
		return ErrInvalidDisplayOrder
	}

	// Update display order for each photo
	for i, photoID := range photoIDs {
		if err := s.repo.UpdateDisplayOrder(ctx, photoID, int32(i)); err != nil {
			return fmt.Errorf("failed to update display order: %w", err)
		}
	}

	return nil
}

// DeletePhoto deletes a photo and its files from storage
func (s *Service) DeletePhoto(ctx context.Context, id, workspaceID uuid.UUID) error {
	// Get photo to verify it exists and belongs to workspace
	photo, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if photo == nil {
		return ErrPhotoNotFound
	}
	if photo.WorkspaceID != workspaceID {
		return ErrUnauthorized
	}

	// Delete from database first
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete photo from database: %w", err)
	}

	// Delete files from storage (best effort - don't fail if files are already gone)
	_ = s.storage.Delete(ctx, photo.StoragePath)
	if photo.ThumbnailPath != "" {
		_ = s.storage.Delete(ctx, photo.ThumbnailPath)
	}
	// Delete multi-size thumbnails if they exist
	if photo.ThumbnailSmallPath != nil && *photo.ThumbnailSmallPath != "" {
		_ = s.storage.Delete(ctx, *photo.ThumbnailSmallPath)
	}
	if photo.ThumbnailMediumPath != nil && *photo.ThumbnailMediumPath != "" {
		_ = s.storage.Delete(ctx, *photo.ThumbnailMediumPath)
	}
	if photo.ThumbnailLargePath != nil && *photo.ThumbnailLargePath != "" {
		_ = s.storage.Delete(ctx, *photo.ThumbnailLargePath)
	}

	// If this was the primary photo, set another photo as primary
	if photo.IsPrimary {
		remainingPhotos, err := s.repo.GetByItem(ctx, photo.ItemID, workspaceID)
		if err == nil && len(remainingPhotos) > 0 {
			// Set the first remaining photo as primary
			_ = s.repo.SetPrimary(ctx, remainingPhotos[0].ID)
		}
	}

	return nil
}

// isValidMimeType checks if a MIME type is allowed
func isValidMimeType(mimeType string) bool {
	for _, allowed := range AllowedMimeTypes {
		if mimeType == allowed {
			return true
		}
	}
	return false
}
