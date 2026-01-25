package itemphoto

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Allowed MIME types for item photos
const (
	MimeTypeJPEG = "image/jpeg"
	MimeTypePNG  = "image/png"
	MimeTypeWEBP = "image/webp"
)

// ThumbnailStatus represents the processing state of photo thumbnails
type ThumbnailStatus string

const (
	ThumbnailStatusPending    ThumbnailStatus = "pending"
	ThumbnailStatusProcessing ThumbnailStatus = "processing"
	ThumbnailStatusComplete   ThumbnailStatus = "complete"
	ThumbnailStatusFailed     ThumbnailStatus = "failed"
)

// IsValid checks if the status is a valid enum value
func (s ThumbnailStatus) IsValid() bool {
	switch s {
	case ThumbnailStatusPending, ThumbnailStatusProcessing, ThumbnailStatusComplete, ThumbnailStatusFailed:
		return true
	}
	return false
}

// String returns the string representation of the status
func (s ThumbnailStatus) String() string {
	return string(s)
}

// AllowedMimeTypes contains all supported image MIME types
var AllowedMimeTypes = []string{
	MimeTypeJPEG,
	MimeTypePNG,
	MimeTypeWEBP,
}

// ItemPhoto represents a photo associated with an item
type ItemPhoto struct {
	ID            uuid.UUID
	ItemID        uuid.UUID
	WorkspaceID   uuid.UUID
	Filename      string
	StoragePath   string
	ThumbnailPath string // Legacy thumbnail path (for backward compatibility)
	FileSize      int64
	MimeType      string
	Width         int32
	Height        int32
	DisplayOrder  int32
	IsPrimary     bool
	Caption       *string
	UploadedBy    uuid.UUID
	CreatedAt     time.Time
	UpdatedAt     time.Time

	// Thumbnail processing fields
	ThumbnailStatus     ThumbnailStatus // Current processing status (pending/processing/complete/failed)
	ThumbnailSmallPath  *string         // 150px thumbnail path
	ThumbnailMediumPath *string         // 400px thumbnail path
	ThumbnailLargePath  *string         // 800px thumbnail path
	ThumbnailAttempts   int32           // Number of processing attempts
	ThumbnailError      *string         // Last error message if failed

	// Duplicate detection
	PerceptualHash *int64 // dHash for finding similar images
}

// Validate checks if the item photo data is valid
func (p *ItemPhoto) Validate() error {
	if p.ItemID == uuid.Nil {
		return fmt.Errorf("item_id is required")
	}
	if p.WorkspaceID == uuid.Nil {
		return fmt.Errorf("workspace_id is required")
	}
	if p.Filename == "" {
		return fmt.Errorf("filename is required")
	}
	if p.StoragePath == "" {
		return fmt.Errorf("storage_path is required")
	}
	// ThumbnailPath is optional for async processing - thumbnails generated in background
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
	// Validate ThumbnailStatus if set
	if p.ThumbnailStatus != "" && !p.ThumbnailStatus.IsValid() {
		return fmt.Errorf("thumbnail_status must be one of: pending, processing, complete, failed")
	}
	return nil
}

// IsValidMimeType checks if the MIME type is allowed
func (p *ItemPhoto) IsValidMimeType() bool {
	for _, allowed := range AllowedMimeTypes {
		if p.MimeType == allowed {
			return true
		}
	}
	return false
}

// GetThumbnailURL returns the URL for the thumbnail version of the photo
// This assumes a storage path pattern like: workspaces/{workspace_id}/items/{item_id}/photos/{uuid}.{ext}
// and generates: workspaces/{workspace_id}/items/{item_id}/photos/thumbnails/{uuid}.{ext}
func (p *ItemPhoto) GetThumbnailURL(baseURL string) string {
	return fmt.Sprintf("%s/api/v1/workspaces/%s/items/%s/photos/%s/thumbnail",
		baseURL, p.WorkspaceID, p.ItemID, p.ID)
}

// GetFullSizeURL returns the URL for the full-size version of the photo
func (p *ItemPhoto) GetFullSizeURL(baseURL string) string {
	return fmt.Sprintf("%s/api/v1/workspaces/%s/items/%s/photos/%s",
		baseURL, p.WorkspaceID, p.ItemID, p.ID)
}

// GetFileExtension returns the file extension based on MIME type
func (p *ItemPhoto) GetFileExtension() string {
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
func (p *ItemPhoto) AspectRatio() float64 {
	if p.Height == 0 {
		return 0
	}
	return float64(p.Width) / float64(p.Height)
}

// IsLandscape returns true if the photo is landscape orientation
func (p *ItemPhoto) IsLandscape() bool {
	return p.Width > p.Height
}

// IsPortrait returns true if the photo is portrait orientation
func (p *ItemPhoto) IsPortrait() bool {
	return p.Height > p.Width
}

// IsSquare returns true if the photo is square (or very close to square)
func (p *ItemPhoto) IsSquare() bool {
	ratio := p.AspectRatio()
	return ratio >= 0.95 && ratio <= 1.05
}

// IsThumbnailReady returns true if thumbnails are ready for display
func (p *ItemPhoto) IsThumbnailReady() bool {
	return p.ThumbnailStatus == ThumbnailStatusComplete
}

// IsThumbnailFailed returns true if thumbnail generation has failed
func (p *ItemPhoto) IsThumbnailFailed() bool {
	return p.ThumbnailStatus == ThumbnailStatusFailed
}

// IsThumbnailPending returns true if thumbnail is awaiting or in processing
func (p *ItemPhoto) IsThumbnailPending() bool {
	return p.ThumbnailStatus == ThumbnailStatusPending || p.ThumbnailStatus == ThumbnailStatusProcessing
}

// GetBestThumbnail returns the path to the best available thumbnail
// Returns medium if available, falls back to legacy ThumbnailPath
func (p *ItemPhoto) GetBestThumbnail() string {
	if p.ThumbnailMediumPath != nil && *p.ThumbnailMediumPath != "" {
		return *p.ThumbnailMediumPath
	}
	return p.ThumbnailPath // Legacy fallback
}

// GetSmallThumbnail returns the small thumbnail path if available
func (p *ItemPhoto) GetSmallThumbnail() string {
	if p.ThumbnailSmallPath != nil {
		return *p.ThumbnailSmallPath
	}
	return ""
}

// GetMediumThumbnail returns the medium thumbnail path if available
func (p *ItemPhoto) GetMediumThumbnail() string {
	if p.ThumbnailMediumPath != nil {
		return *p.ThumbnailMediumPath
	}
	return p.ThumbnailPath // Legacy fallback
}

// GetLargeThumbnail returns the large thumbnail path if available
func (p *ItemPhoto) GetLargeThumbnail() string {
	if p.ThumbnailLargePath != nil {
		return *p.ThumbnailLargePath
	}
	return ""
}
