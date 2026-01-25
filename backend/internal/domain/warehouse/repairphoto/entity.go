package repairphoto

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// PhotoType represents when a photo was taken during the repair process.
type PhotoType string

const (
	PhotoTypeBefore PhotoType = "BEFORE"
	PhotoTypeDuring PhotoType = "DURING"
	PhotoTypeAfter  PhotoType = "AFTER"
)

// IsValid checks if the photo type is a valid enum value.
func (pt PhotoType) IsValid() bool {
	switch pt {
	case PhotoTypeBefore, PhotoTypeDuring, PhotoTypeAfter:
		return true
	default:
		return false
	}
}

// Allowed MIME types for repair photos
const (
	MimeTypeJPEG = "image/jpeg"
	MimeTypePNG  = "image/png"
	MimeTypeWEBP = "image/webp"
)

// AllowedMimeTypes contains all supported image MIME types
var AllowedMimeTypes = []string{
	MimeTypeJPEG,
	MimeTypePNG,
	MimeTypeWEBP,
}

// RepairPhoto represents a photo associated with a repair log
type RepairPhoto struct {
	ID            uuid.UUID
	RepairLogID   uuid.UUID
	WorkspaceID   uuid.UUID
	PhotoType     PhotoType
	Filename      string
	StoragePath   string
	ThumbnailPath string
	FileSize      int64
	MimeType      string
	Width         int32
	Height        int32
	DisplayOrder  int32
	Caption       *string
	UploadedBy    uuid.UUID
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// NewRepairPhoto creates a new repair photo with validation.
func NewRepairPhoto(
	repairLogID, workspaceID, uploadedBy uuid.UUID,
	photoType PhotoType,
	filename, storagePath, thumbnailPath, mimeType string,
	fileSize int64,
	width, height, displayOrder int32,
	caption *string,
) (*RepairPhoto, error) {
	photo := &RepairPhoto{
		ID:            uuid.New(),
		RepairLogID:   repairLogID,
		WorkspaceID:   workspaceID,
		PhotoType:     photoType,
		Filename:      filename,
		StoragePath:   storagePath,
		ThumbnailPath: thumbnailPath,
		FileSize:      fileSize,
		MimeType:      mimeType,
		Width:         width,
		Height:        height,
		DisplayOrder:  displayOrder,
		Caption:       caption,
		UploadedBy:    uploadedBy,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := photo.Validate(); err != nil {
		return nil, err
	}

	return photo, nil
}

// Reconstruct creates a RepairPhoto from database values without validation.
// Used when loading from the database.
func Reconstruct(
	id, repairLogID, workspaceID uuid.UUID,
	photoType PhotoType,
	filename, storagePath, thumbnailPath, mimeType string,
	fileSize int64,
	width, height, displayOrder int32,
	caption *string,
	uploadedBy uuid.UUID,
	createdAt, updatedAt time.Time,
) *RepairPhoto {
	return &RepairPhoto{
		ID:            id,
		RepairLogID:   repairLogID,
		WorkspaceID:   workspaceID,
		PhotoType:     photoType,
		Filename:      filename,
		StoragePath:   storagePath,
		ThumbnailPath: thumbnailPath,
		FileSize:      fileSize,
		MimeType:      mimeType,
		Width:         width,
		Height:        height,
		DisplayOrder:  displayOrder,
		Caption:       caption,
		UploadedBy:    uploadedBy,
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	}
}

// Validate checks if the repair photo data is valid
func (p *RepairPhoto) Validate() error {
	if p.RepairLogID == uuid.Nil {
		return fmt.Errorf("repair_log_id is required")
	}
	if p.WorkspaceID == uuid.Nil {
		return fmt.Errorf("workspace_id is required")
	}
	if !p.PhotoType.IsValid() {
		return fmt.Errorf("photo_type must be one of: BEFORE, DURING, AFTER")
	}
	if p.Filename == "" {
		return fmt.Errorf("filename is required")
	}
	if p.StoragePath == "" {
		return fmt.Errorf("storage_path is required")
	}
	if p.ThumbnailPath == "" {
		return fmt.Errorf("thumbnail_path is required")
	}
	if p.MimeType == "" {
		return fmt.Errorf("mime_type is required")
	}
	if !p.IsValidMimeType() {
		return fmt.Errorf("mime_type must be one of: %v", AllowedMimeTypes)
	}
	if p.FileSize <= 0 {
		return fmt.Errorf("file_size must be positive")
	}
	if p.Width <= 0 {
		return fmt.Errorf("width must be positive")
	}
	if p.Height <= 0 {
		return fmt.Errorf("height must be positive")
	}
	if p.DisplayOrder < 0 {
		return fmt.Errorf("display_order cannot be negative")
	}
	if p.UploadedBy == uuid.Nil {
		return fmt.Errorf("uploaded_by is required")
	}
	return nil
}

// IsValidMimeType checks if the MIME type is allowed
func (p *RepairPhoto) IsValidMimeType() bool {
	for _, allowed := range AllowedMimeTypes {
		if p.MimeType == allowed {
			return true
		}
	}
	return false
}

// GetThumbnailURL returns the URL for the thumbnail version of the photo
func (p *RepairPhoto) GetThumbnailURL(baseURL string) string {
	return fmt.Sprintf("%s/api/v1/workspaces/%s/repairs/%s/photos/%s/thumbnail",
		baseURL, p.WorkspaceID, p.RepairLogID, p.ID)
}

// GetFullSizeURL returns the URL for the full-size version of the photo
func (p *RepairPhoto) GetFullSizeURL(baseURL string) string {
	return fmt.Sprintf("%s/api/v1/workspaces/%s/repairs/%s/photos/%s",
		baseURL, p.WorkspaceID, p.RepairLogID, p.ID)
}

// GetFileExtension returns the file extension based on MIME type
func (p *RepairPhoto) GetFileExtension() string {
	switch p.MimeType {
	case MimeTypeJPEG:
		return "jpg"
	case MimeTypePNG:
		return "png"
	case MimeTypeWEBP:
		return "webp"
	default:
		return "bin"
	}
}

// AspectRatio returns the aspect ratio (width/height) of the photo
func (p *RepairPhoto) AspectRatio() float64 {
	if p.Height == 0 {
		return 0
	}
	return float64(p.Width) / float64(p.Height)
}

// IsLandscape returns true if the photo is landscape orientation
func (p *RepairPhoto) IsLandscape() bool {
	return p.Width > p.Height
}

// IsPortrait returns true if the photo is portrait orientation
func (p *RepairPhoto) IsPortrait() bool {
	return p.Height > p.Width
}

// IsSquare returns true if the photo is square (or very close to square)
func (p *RepairPhoto) IsSquare() bool {
	ratio := p.AspectRatio()
	return ratio >= 0.95 && ratio <= 1.05
}
