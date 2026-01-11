package attachment

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"
)

type contextKey string

const (
	WorkspaceContextKey contextKey = "workspace"
	UserContextKey      contextKey = "user"
)

// AuthUser represents the authenticated user in context.
type AuthUser struct {
	ID uuid.UUID
}

// RegisterRoutes registers attachment routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// List attachments for an item
	huma.Get(api, "/items/{item_id}/attachments", func(ctx context.Context, input *ListAttachmentsInput) (*ListAttachmentsOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Note: In production, verify item belongs to workspace
		_ = workspaceID

		attachments, err := svc.ListByItem(ctx, input.ItemID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list attachments")
		}

		items := make([]AttachmentResponse, len(attachments))
		for i, att := range attachments {
			items[i] = toAttachmentResponse(att)
		}

		return &ListAttachmentsOutput{
			Body: AttachmentListResponse{Items: items},
		}, nil
	})

	// Get attachment by ID
	huma.Get(api, "/attachments/{id}", func(ctx context.Context, input *GetAttachmentInput) (*GetAttachmentOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Note: In production, verify attachment's item belongs to workspace
		_ = workspaceID

		attachment, err := svc.GetAttachment(ctx, input.ID)
		if err != nil || attachment == nil {
			return nil, huma.Error404NotFound("attachment not found")
		}

		return &GetAttachmentOutput{
			Body: toAttachmentResponse(attachment),
		}, nil
	})

	// Upload file and create attachment
	// Note: This is a simplified version. In production, you'd handle multipart file upload
	huma.Post(api, "/items/{item_id}/attachments/upload", func(ctx context.Context, input *UploadAttachmentInput) (*UploadAttachmentOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := ctx.Value(UserContextKey).(*AuthUser)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		// Validate attachment type
		attachmentType := AttachmentType(input.Body.AttachmentType)
		if !attachmentType.IsValid() {
			return nil, huma.Error400BadRequest("invalid attachment type")
		}

		// In production: handle actual file upload, store to S3/disk
		// For now, we'll create a placeholder storage key
		storageKey := fmt.Sprintf("uploads/%s/%s/%s",
			workspaceID.String(),
			input.ItemID.String(),
			uuid.New().String())

		// Create file record
		file, err := svc.UploadFile(ctx, UploadFileInput{
			WorkspaceID:  workspaceID,
			OriginalName: input.Body.FileName,
			Extension:    filepath.Ext(input.Body.FileName),
			MimeType:     input.Body.MimeType,
			SizeBytes:    input.Body.SizeBytes,
			Checksum:     input.Body.Checksum,
			StorageKey:   storageKey,
			UploadedBy:   &authUser.ID,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		// Create attachment record
		fileID := file.ID()
		attachment, err := svc.CreateAttachment(ctx, CreateAttachmentInput{
			ItemID:         input.ItemID,
			FileID:         &fileID,
			AttachmentType: attachmentType,
			Title:          input.Body.Title,
			IsPrimary:      input.Body.IsPrimary,
			DocspellItemID: nil,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UploadAttachmentOutput{
			Body: toAttachmentResponse(attachment),
		}, nil
	})

	// Create attachment without file (e.g., external link)
	huma.Post(api, "/items/{item_id}/attachments", func(ctx context.Context, input *CreateAttachmentRequest) (*CreateAttachmentOutput, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Note: In production, verify item belongs to workspace
		_ = workspaceID

		// Validate attachment type
		attachmentType := AttachmentType(input.Body.AttachmentType)
		if !attachmentType.IsValid() {
			return nil, huma.Error400BadRequest("invalid attachment type")
		}

		attachment, err := svc.CreateAttachment(ctx, CreateAttachmentInput{
			ItemID:         input.ItemID,
			FileID:         input.Body.FileID,
			AttachmentType: attachmentType,
			Title:          input.Body.Title,
			IsPrimary:      input.Body.IsPrimary,
			DocspellItemID: input.Body.DocspellItemID,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &CreateAttachmentOutput{
			Body: toAttachmentResponse(attachment),
		}, nil
	})

	// Set attachment as primary
	huma.Post(api, "/items/{item_id}/attachments/{id}/set-primary", func(ctx context.Context, input *SetPrimaryInput) (*struct{}, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Note: In production, verify item belongs to workspace
		_ = workspaceID

		err := svc.SetPrimary(ctx, input.ItemID, input.ID)
		if err != nil {
			if err == ErrAttachmentNotFound {
				return nil, huma.Error404NotFound("attachment not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	// Delete attachment
	huma.Delete(api, "/attachments/{id}", func(ctx context.Context, input *GetAttachmentInput) (*struct{}, error) {
		workspaceID, ok := ctx.Value(WorkspaceContextKey).(uuid.UUID)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		// Note: In production, verify attachment's item belongs to workspace
		_ = workspaceID

		err := svc.DeleteAttachment(ctx, input.ID)
		if err != nil {
			if err == ErrAttachmentNotFound {
				return nil, huma.Error404NotFound("attachment not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})
}

func toAttachmentResponse(a *Attachment) AttachmentResponse {
	return AttachmentResponse{
		ID:             a.ID(),
		ItemID:         a.ItemID(),
		FileID:         a.FileID(),
		AttachmentType: string(a.AttachmentType()),
		Title:          a.Title(),
		IsPrimary:      a.IsPrimary(),
		DocspellItemID: a.DocspellItemID(),
		CreatedAt:      a.CreatedAt(),
		UpdatedAt:      a.UpdatedAt(),
	}
}

// Helper function to calculate file checksum
func calculateChecksum(file multipart.File) (string, error) {
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

// Request/Response types

type ListAttachmentsInput struct {
	ItemID uuid.UUID `path:"item_id"`
}

type ListAttachmentsOutput struct {
	Body AttachmentListResponse
}

type AttachmentListResponse struct {
	Items []AttachmentResponse `json:"items"`
}

type GetAttachmentInput struct {
	ID uuid.UUID `path:"id"`
}

type GetAttachmentOutput struct {
	Body AttachmentResponse
}

type UploadAttachmentInput struct {
	ItemID uuid.UUID `path:"item_id"`
	Body   struct {
		FileName       string  `json:"file_name" minLength:"1" doc:"Original file name"`
		MimeType       string  `json:"mime_type" doc:"MIME type of the file"`
		SizeBytes      int64   `json:"size_bytes" minimum:"1" doc:"File size in bytes"`
		Checksum       string  `json:"checksum" doc:"SHA256 checksum of file"`
		AttachmentType string  `json:"attachment_type" enum:"PHOTO,MANUAL,RECEIPT,WARRANTY,OTHER" doc:"Type of attachment"`
		Title          *string `json:"title,omitempty" doc:"Attachment title"`
		IsPrimary      bool    `json:"is_primary" doc:"Whether this is the primary attachment"`
	}
}

type UploadAttachmentOutput struct {
	Body AttachmentResponse
}

type CreateAttachmentRequest struct {
	ItemID uuid.UUID `path:"item_id"`
	Body   struct {
		FileID         *uuid.UUID `json:"file_id,omitempty" doc:"ID of uploaded file (if any)"`
		AttachmentType string     `json:"attachment_type" enum:"PHOTO,MANUAL,RECEIPT,WARRANTY,OTHER" doc:"Type of attachment"`
		Title          *string    `json:"title,omitempty" doc:"Attachment title"`
		IsPrimary      bool       `json:"is_primary" doc:"Whether this is the primary attachment"`
		DocspellItemID *string    `json:"docspell_item_id,omitempty" doc:"Docspell item ID for external DMS integration"`
	}
}

type CreateAttachmentOutput struct {
	Body AttachmentResponse
}

type SetPrimaryInput struct {
	ItemID uuid.UUID `path:"item_id"`
	ID     uuid.UUID `path:"id"`
}

type AttachmentResponse struct {
	ID             uuid.UUID  `json:"id"`
	ItemID         uuid.UUID  `json:"item_id"`
	FileID         *uuid.UUID `json:"file_id,omitempty"`
	AttachmentType string     `json:"attachment_type" enum:"PHOTO,MANUAL,RECEIPT,WARRANTY,OTHER"`
	Title          *string    `json:"title,omitempty"`
	IsPrimary      bool       `json:"is_primary"`
	DocspellItemID *string    `json:"docspell_item_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
