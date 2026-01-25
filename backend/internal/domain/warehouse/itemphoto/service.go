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

// Hasher defines the interface for perceptual hashing operations
type Hasher interface {
	GenerateHash(ctx context.Context, imagePath string) (int64, error)
	CompareHashes(hash1, hash2 int64) (bool, int)
	IsSimilar(hash1, hash2 int64) bool
	GetDistance(hash1, hash2 int64) int
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

	// Bulk operations
	BulkDeletePhotos(ctx context.Context, itemID, workspaceID uuid.UUID, photoIDs []uuid.UUID) error
	BulkUpdateCaptions(ctx context.Context, workspaceID uuid.UUID, updates []CaptionUpdate) error
	GetPhotosForDownload(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*ItemPhoto, error)
	GetPhotosByIDs(ctx context.Context, photoIDs []uuid.UUID, workspaceID uuid.UUID) ([]*ItemPhoto, error)
	CheckDuplicates(ctx context.Context, workspaceID uuid.UUID, hash int64) ([]DuplicateCandidate, error)
}

// CaptionUpdate represents a caption update for a single photo
type CaptionUpdate struct {
	PhotoID uuid.UUID
	Caption *string
}

// DuplicateCandidate represents a potentially duplicate photo
type DuplicateCandidate struct {
	PhotoID     uuid.UUID
	ItemID      uuid.UUID
	Filename    string
	Distance    int
	SimilarityPct float64
}

// Service implements the item photo business logic
type Service struct {
	repo        Repository
	storage     Storage
	processor   ImageProcessor
	hasher      Hasher
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

// SetHasher sets the perceptual hasher for duplicate detection.
// This is optional - if not set, duplicate detection will not be available.
func (s *Service) SetHasher(hasher Hasher) {
	s.hasher = hasher
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

	// Generate perceptual hash for duplicate detection (sync, before temp file cleanup)
	// This is fast (~10-50ms) and ensures we have the hash for duplicate detection
	if s.hasher != nil {
		hash, err := s.hasher.GenerateHash(ctx, tempPath)
		if err != nil {
			log.Printf("Failed to generate perceptual hash for photo %s: %v", createdPhoto.ID, err)
		} else {
			if err := s.repo.UpdatePerceptualHash(ctx, createdPhoto.ID, hash); err != nil {
				log.Printf("Failed to save perceptual hash for photo %s: %v", createdPhoto.ID, err)
			} else {
				createdPhoto.PerceptualHash = &hash
			}
		}
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

// BulkDeletePhotos deletes multiple photos for an item
func (s *Service) BulkDeletePhotos(ctx context.Context, itemID, workspaceID uuid.UUID, photoIDs []uuid.UUID) error {
	if len(photoIDs) == 0 {
		return nil
	}

	// Get photos to verify ownership and get storage paths
	photos, err := s.repo.GetByIDs(ctx, photoIDs, workspaceID)
	if err != nil {
		return fmt.Errorf("failed to get photos: %w", err)
	}

	// Verify all photos belong to the specified item
	for _, photo := range photos {
		if photo.ItemID != itemID {
			return fmt.Errorf("photo %s does not belong to item %s", photo.ID, itemID)
		}
	}

	// Delete from database first
	if err := s.repo.BulkDelete(ctx, photoIDs, workspaceID); err != nil {
		return fmt.Errorf("failed to delete photos from database: %w", err)
	}

	// Delete files from storage (best effort - don't fail if files are already gone)
	for _, photo := range photos {
		_ = s.storage.Delete(ctx, photo.StoragePath)
		if photo.ThumbnailPath != "" {
			_ = s.storage.Delete(ctx, photo.ThumbnailPath)
		}
		if photo.ThumbnailSmallPath != nil && *photo.ThumbnailSmallPath != "" {
			_ = s.storage.Delete(ctx, *photo.ThumbnailSmallPath)
		}
		if photo.ThumbnailMediumPath != nil && *photo.ThumbnailMediumPath != "" {
			_ = s.storage.Delete(ctx, *photo.ThumbnailMediumPath)
		}
		if photo.ThumbnailLargePath != nil && *photo.ThumbnailLargePath != "" {
			_ = s.storage.Delete(ctx, *photo.ThumbnailLargePath)
		}
	}

	// If a primary photo was deleted, set a new one
	remainingPhotos, err := s.repo.GetByItem(ctx, itemID, workspaceID)
	if err == nil && len(remainingPhotos) > 0 {
		hasPrimary := false
		for _, p := range remainingPhotos {
			if p.IsPrimary {
				hasPrimary = true
				break
			}
		}
		if !hasPrimary {
			_ = s.repo.SetPrimary(ctx, remainingPhotos[0].ID)
		}
	}

	return nil
}

// BulkUpdateCaptions updates captions for multiple photos
func (s *Service) BulkUpdateCaptions(ctx context.Context, workspaceID uuid.UUID, updates []CaptionUpdate) error {
	if len(updates) == 0 {
		return nil
	}

	// Update each caption
	for _, update := range updates {
		if err := s.repo.UpdateCaption(ctx, update.PhotoID, workspaceID, update.Caption); err != nil {
			return fmt.Errorf("failed to update caption for photo %s: %w", update.PhotoID, err)
		}
	}

	return nil
}

// GetPhotosForDownload returns all photos for an item with full metadata for zip download
func (s *Service) GetPhotosForDownload(ctx context.Context, itemID, workspaceID uuid.UUID) ([]*ItemPhoto, error) {
	return s.repo.GetByItem(ctx, itemID, workspaceID)
}

// GetPhotosByIDs returns photos by their IDs with workspace verification
func (s *Service) GetPhotosByIDs(ctx context.Context, photoIDs []uuid.UUID, workspaceID uuid.UUID) ([]*ItemPhoto, error) {
	return s.repo.GetByIDs(ctx, photoIDs, workspaceID)
}

// CheckDuplicates finds photos with similar perceptual hashes
func (s *Service) CheckDuplicates(ctx context.Context, workspaceID uuid.UUID, hash int64) ([]DuplicateCandidate, error) {
	if s.hasher == nil {
		return nil, nil
	}

	// Get all photos with hashes in the workspace
	photos, err := s.repo.GetPhotosWithHashes(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get photos: %w", err)
	}

	var candidates []DuplicateCandidate
	for _, photo := range photos {
		if photo.PerceptualHash == nil {
			continue
		}

		similar, distance := s.hasher.CompareHashes(hash, *photo.PerceptualHash)
		if similar {
			// Calculate similarity percentage (0 distance = 100%, threshold distance = 0%)
			// Using 10 as max threshold for percentage calculation
			similarityPct := 100.0 - (float64(distance) / 10.0 * 100.0)
			if similarityPct < 0 {
				similarityPct = 0
			}

			candidates = append(candidates, DuplicateCandidate{
				PhotoID:       photo.ID,
				ItemID:        photo.ItemID,
				Filename:      photo.Filename,
				Distance:      distance,
				SimilarityPct: similarityPct,
			})
		}
	}

	// Sort by distance (most similar first)
	for i := 0; i < len(candidates); i++ {
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].Distance < candidates[i].Distance {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}

	return candidates, nil
}
