package repairphoto

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

const (
	// MaxFileSize is the maximum allowed photo file size (10MB)
	MaxFileSize = 10 * 1024 * 1024
)

var (
	ErrPhotoNotFound   = errors.New("photo not found")
	ErrInvalidFileType = errors.New("invalid file type: only JPEG, PNG, and WebP are allowed")
	ErrFileTooLarge    = errors.New("file too large: maximum size is 10MB")
	ErrUnauthorized    = errors.New("unauthorized")
)

// Storage defines the interface for file storage operations
type Storage interface {
	Save(ctx context.Context, workspaceID, entityID, filename string, reader io.Reader) (path string, err error)
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

// ServiceInterface defines the public interface for repair photo operations
type ServiceInterface interface {
	UploadPhoto(ctx context.Context, repairLogID, workspaceID, userID uuid.UUID, photoType PhotoType, file multipart.File, header *multipart.FileHeader, caption *string) (*RepairPhoto, error)
	ListPhotos(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*RepairPhoto, error)
	GetPhoto(ctx context.Context, id, workspaceID uuid.UUID) (*RepairPhoto, error)
	UpdateCaption(ctx context.Context, photoID, workspaceID uuid.UUID, caption *string) (*RepairPhoto, error)
	DeletePhoto(ctx context.Context, id, workspaceID uuid.UUID) error
}

// Service implements the repair photo business logic
type Service struct {
	repo      Repository
	storage   Storage
	processor ImageProcessor
	uploadDir string // Base directory for temporary uploads
}

// NewService creates a new repair photo service
func NewService(repo Repository, storage Storage, processor ImageProcessor, uploadDir string) *Service {
	return &Service{
		repo:      repo,
		storage:   storage,
		processor: processor,
		uploadDir: uploadDir,
	}
}

// UploadPhoto uploads a new photo for a repair log
func (s *Service) UploadPhoto(ctx context.Context, repairLogID, workspaceID, userID uuid.UUID, photoType PhotoType, file multipart.File, header *multipart.FileHeader, caption *string) (*RepairPhoto, error) {
	// Validate photo type
	if !photoType.IsValid() {
		return nil, fmt.Errorf("invalid photo type: must be BEFORE, DURING, or AFTER")
	}

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
	tempFile, err := os.CreateTemp(s.uploadDir, "repair-upload-*"+filepath.Ext(header.Filename))
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

	// Save original file to storage with repair-specific path
	// Path: workspaces/{workspaceID}/repairs/{repairLogID}/photos/{filename}
	fileReader, err := os.Open(tempPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open temp file: %w", err)
	}
	defer fileReader.Close()

	storagePath, err := s.storage.Save(ctx, workspaceID.String(), fmt.Sprintf("repairs/%s", repairLogID.String()), header.Filename, fileReader)
	if err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	// Generate JPEG thumbnail
	thumbnailFilename := "thumb_" + header.Filename
	thumbnailTempPath := filepath.Join(s.uploadDir, "repair-thumb-"+uuid.New().String()+filepath.Ext(header.Filename))
	defer os.Remove(thumbnailTempPath)

	if err := s.processor.GenerateThumbnail(ctx, tempPath, thumbnailTempPath, 400, 400); err != nil {
		// Clean up original file on thumbnail generation failure
		s.storage.Delete(ctx, storagePath)
		return nil, fmt.Errorf("failed to generate thumbnail: %w", err)
	}

	// Save thumbnail to storage
	thumbReader, err := os.Open(thumbnailTempPath)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		return nil, fmt.Errorf("failed to open thumbnail: %w", err)
	}
	defer thumbReader.Close()

	thumbnailPath, err := s.storage.Save(ctx, workspaceID.String(), fmt.Sprintf("repairs/%s", repairLogID.String()), thumbnailFilename, thumbReader)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		return nil, fmt.Errorf("failed to save thumbnail: %w", err)
	}

	// Get file size
	fileInfo, err := os.Stat(tempPath)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		s.storage.Delete(ctx, thumbnailPath)
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	// Get the next display order (append to end)
	maxOrder, err := s.repo.GetMaxDisplayOrder(ctx, repairLogID, workspaceID)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		s.storage.Delete(ctx, thumbnailPath)
		return nil, fmt.Errorf("failed to get max display order: %w", err)
	}
	displayOrder := maxOrder + 1

	// Create photo entity
	photo, err := NewRepairPhoto(
		repairLogID,
		workspaceID,
		userID,
		photoType,
		header.Filename,
		storagePath,
		thumbnailPath,
		mimeType,
		fileInfo.Size(),
		int32(width),
		int32(height),
		displayOrder,
		caption,
	)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		s.storage.Delete(ctx, thumbnailPath)
		return nil, err
	}

	// Save to database
	createdPhoto, err := s.repo.Create(ctx, photo)
	if err != nil {
		s.storage.Delete(ctx, storagePath)
		s.storage.Delete(ctx, thumbnailPath)
		return nil, fmt.Errorf("failed to save photo to database: %w", err)
	}

	return createdPhoto, nil
}

// ListPhotos returns all photos for a repair log
func (s *Service) ListPhotos(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*RepairPhoto, error) {
	photos, err := s.repo.ListByRepairLog(ctx, repairLogID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to list photos: %w", err)
	}
	return photos, nil
}

// GetPhoto returns a single photo by ID
func (s *Service) GetPhoto(ctx context.Context, id, workspaceID uuid.UUID) (*RepairPhoto, error) {
	photo, err := s.repo.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if photo == nil {
		return nil, ErrPhotoNotFound
	}
	return photo, nil
}

// UpdateCaption updates the caption of a photo
func (s *Service) UpdateCaption(ctx context.Context, photoID, workspaceID uuid.UUID, caption *string) (*RepairPhoto, error) {
	// Verify photo exists and belongs to workspace
	photo, err := s.repo.GetByID(ctx, photoID, workspaceID)
	if err != nil {
		return nil, err
	}
	if photo == nil {
		return nil, ErrPhotoNotFound
	}

	// Update caption
	updatedPhoto, err := s.repo.UpdateCaption(ctx, photoID, workspaceID, caption)
	if err != nil {
		return nil, fmt.Errorf("failed to update caption: %w", err)
	}

	return updatedPhoto, nil
}

// DeletePhoto deletes a photo and its files from storage
func (s *Service) DeletePhoto(ctx context.Context, id, workspaceID uuid.UUID) error {
	// Get photo to verify it exists and belongs to workspace
	photo, err := s.repo.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}
	if photo == nil {
		return ErrPhotoNotFound
	}

	// Delete from database first
	if err := s.repo.Delete(ctx, id, workspaceID); err != nil {
		return fmt.Errorf("failed to delete photo from database: %w", err)
	}

	// Delete files from storage (best effort - don't fail if files are already gone)
	_ = s.storage.Delete(ctx, photo.StoragePath)
	_ = s.storage.Delete(ctx, photo.ThumbnailPath)

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
