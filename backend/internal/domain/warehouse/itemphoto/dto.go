package itemphoto

import "github.com/google/uuid"

// BulkDeleteRequest represents a request to delete multiple photos
type BulkDeleteRequest struct {
	PhotoIDs []uuid.UUID `json:"photo_ids" minItems:"1" doc:"List of photo IDs to delete"`
}

// BulkCaptionRequest represents a request to update multiple photo captions
type BulkCaptionRequest struct {
	Updates []BulkCaptionItem `json:"updates" minItems:"1" doc:"List of caption updates"`
}

// BulkCaptionItem represents a single caption update
type BulkCaptionItem struct {
	PhotoID uuid.UUID `json:"photo_id" doc:"Photo ID to update"`
	Caption *string   `json:"caption" doc:"New caption (null to remove)"`
}

// DuplicateInfo represents information about a potentially duplicate photo
type DuplicateInfo struct {
	PhotoID       uuid.UUID `json:"photo_id" doc:"ID of the similar photo"`
	ItemID        uuid.UUID `json:"item_id" doc:"Item the photo belongs to"`
	Filename      string    `json:"filename" doc:"Original filename"`
	SimilarityPct float64   `json:"similarity_pct" doc:"Similarity percentage (100 = exact match)"`
	ThumbnailURL  string    `json:"thumbnail_url,omitempty" doc:"URL to view the similar photo thumbnail"`
}

// DuplicateCheckResponse represents the response from duplicate checking
type DuplicateCheckResponse struct {
	HasDuplicates bool            `json:"has_duplicates" doc:"Whether similar photos were found"`
	Duplicates    []DuplicateInfo `json:"duplicates" doc:"List of similar photos found"`
}
