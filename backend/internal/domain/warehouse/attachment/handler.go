package attachment

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
)

// MaxFileSize is the multipart upload ceiling for item attachments (25 MiB).
const MaxFileSize = 25 << 20

const (
	msgWorkspaceContextRequired = "workspace context required"
	msgAttachmentNotFound       = "attachment not found"
	msgInvalidAttachmentType    = "invalid attachment type"
	eventAttachmentCreated      = "attachment.created"
)

// RegisterRoutes registers attachment routes.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	// List attachments for an item
	huma.Get(api, "/items/{item_id}/attachments", func(ctx context.Context, input *ListAttachmentsInput) (*ListAttachmentsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		attachments, err := svc.ListByItem(ctx, input.ItemID, workspaceID)
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
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		attachment, err := svc.GetAttachment(ctx, input.ID, workspaceID)
		if err != nil || attachment == nil {
			return nil, huma.Error404NotFound(msgAttachmentNotFound)
		}

		return &GetAttachmentOutput{
			Body: toAttachmentResponse(attachment),
		}, nil
	})

	// Upload file and create attachment
	// Note: This is a simplified version. In production, you'd handle multipart file upload
	huma.Post(api, "/items/{item_id}/attachments/upload", func(ctx context.Context, input *UploadAttachmentInput) (*UploadAttachmentOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		// Validate attachment type
		attachmentType := AttachmentType(input.Body.AttachmentType)
		if !attachmentType.IsValid() {
			return nil, huma.Error400BadRequest(msgInvalidAttachmentType)
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
			return nil, appMiddleware.MapDomainError(err)
		}

		// Create attachment record
		fileID := file.ID()
		attachment, err := svc.CreateAttachment(ctx, CreateAttachmentInput{
			WorkspaceID:    workspaceID,
			ItemID:         input.ItemID,
			FileID:         &fileID,
			AttachmentType: attachmentType,
			Title:          input.Body.Title,
			IsPrimary:      input.Body.IsPrimary,
			ExternalDocID:  nil,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       eventAttachmentCreated,
				EntityID:   attachment.ID().String(),
				EntityType: "attachment",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":              attachment.ID(),
					"item_id":         attachment.ItemID(),
					"attachment_type": string(attachment.AttachmentType()),
					"user_name":       userName,
				},
			})
		}

		return &UploadAttachmentOutput{
			Body: toAttachmentResponse(attachment),
		}, nil
	})

	// Create attachment without file (e.g., external link)
	huma.Post(api, "/items/{item_id}/attachments", func(ctx context.Context, input *CreateAttachmentRequest) (*CreateAttachmentOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		// Validate attachment type
		attachmentType := AttachmentType(input.Body.AttachmentType)
		if !attachmentType.IsValid() {
			return nil, huma.Error400BadRequest(msgInvalidAttachmentType)
		}

		attachment, err := svc.CreateAttachment(ctx, CreateAttachmentInput{
			WorkspaceID:    workspaceID,
			ItemID:         input.ItemID,
			FileID:         input.Body.FileID,
			AttachmentType: attachmentType,
			Title:          input.Body.Title,
			IsPrimary:      input.Body.IsPrimary,
			ExternalDocID:  input.Body.ExternalDocID,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       eventAttachmentCreated,
				EntityID:   attachment.ID().String(),
				EntityType: "attachment",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":              attachment.ID(),
					"item_id":         attachment.ItemID(),
					"attachment_type": string(attachment.AttachmentType()),
					"user_name":       userName,
				},
			})
		}

		return &CreateAttachmentOutput{
			Body: toAttachmentResponse(attachment),
		}, nil
	})

	// Set attachment as primary
	huma.Post(api, "/items/{item_id}/attachments/{id}/set-primary", func(ctx context.Context, input *SetPrimaryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.SetPrimary(ctx, input.ItemID, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrAttachmentNotFound) {
				return nil, huma.Error404NotFound(msgAttachmentNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event (treat set-primary as update)
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "attachment.updated",
				EntityID:   input.ID.String(),
				EntityType: "attachment",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":         input.ID,
					"item_id":    input.ItemID,
					"is_primary": true,
					"user_name":  userName,
				},
			})
		}

		return nil, nil
	})

	// Delete attachment
	huma.Delete(api, "/attachments/{id}", func(ctx context.Context, input *GetAttachmentInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.DeleteAttachment(ctx, input.ID, workspaceID)
		if err != nil {
			if errors.Is(err, ErrAttachmentNotFound) {
				return nil, huma.Error404NotFound(msgAttachmentNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "attachment.deleted",
				EntityID:   input.ID.String(),
				EntityType: "attachment",
				UserID:     authUser.ID,
				Data: map[string]any{
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})
}

// RegisterUploadHandler registers the Chi multipart upload route that persists
// REAL bytes (distinct from the huma JSON metadata route at
// POST /items/{item_id}/attachments/upload, which Phase-10b repair-attachment
// minting depends on and must stay untouched).
//
//	POST /items/{item_id}/attachments/file  (multipart, field "file")
func RegisterUploadHandler(r chi.Router, svc ServiceInterface, broadcaster *events.Broadcaster) {
	h := &UploadHandler{svc: svc, broadcaster: broadcaster}
	r.Post("/items/{item_id}/attachments/file", h.HandleUpload)
}

// RegisterServeHandler registers the Chi serve/download route that streams the
// stored bytes back. The path is /attachments/{id}/file — deliberately NOT
// /attachments/{id} (that GET belongs to the huma router; a bare Chi mirror
// would collide at boot).
//
//	GET /attachments/{id}/file
func RegisterServeHandler(r chi.Router, svc ServiceInterface, store storage.Storage) {
	h := &ServeAttachmentHandler{svc: svc, storage: store}
	r.Get("/attachments/{id}/file", h.HandleServe)
}

// UploadHandler handles multipart attachment uploads (real bytes).
type UploadHandler struct {
	svc         ServiceInterface
	broadcaster *events.Broadcaster
}

// HandleUpload parses a multipart form, persists the bytes via the storage-
// backed service, creates the attachment row, and returns 201 with the
// AttachmentResponse.
func (h *UploadHandler) HandleUpload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, msgWorkspaceContextRequired, http.StatusUnauthorized)
		return
	}

	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}

	itemID, err := uuid.Parse(chi.URLParam(r, "item_id"))
	if err != nil {
		http.Error(w, "invalid item_id", http.StatusBadRequest)
		return
	}

	if err := r.ParseMultipartForm(MaxFileSize); err != nil {
		http.Error(w, "file too large or invalid form data", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file is required (multipart field \"file\")", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Resolve attachment_type (default OTHER) and validate.
	attachmentType := TypeOther
	if at := r.FormValue("attachment_type"); at != "" {
		attachmentType = AttachmentType(at)
		if !attachmentType.IsValid() {
			http.Error(w, msgInvalidAttachmentType, http.StatusBadRequest)
			return
		}
	}

	var title *string
	if t := r.FormValue("title"); t != "" {
		title = &t
	}

	isPrimary := r.FormValue("is_primary") == "true"

	// Persist the real bytes; File.StorageKey is the real path Save returns.
	storedFile, err := h.svc.UploadFileBytes(ctx, workspaceID, itemID, header, file, &authUser.ID)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to store file: %v", err), http.StatusInternalServerError)
		return
	}

	fileID := storedFile.ID()
	attachment, err := h.svc.CreateAttachment(ctx, CreateAttachmentInput{
		WorkspaceID:    workspaceID,
		ItemID:         itemID,
		FileID:         &fileID,
		AttachmentType: attachmentType,
		Title:          title,
		IsPrimary:      isPrimary,
		ExternalDocID:  nil,
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create attachment: %v", err), http.StatusInternalServerError)
		return
	}

	// Publish the same event shape as the huma upload route.
	if h.broadcaster != nil {
		userName := appMiddleware.GetUserDisplayName(ctx)
		h.broadcaster.Publish(workspaceID, events.Event{
			Type:       eventAttachmentCreated,
			EntityID:   attachment.ID().String(),
			EntityType: "attachment",
			UserID:     authUser.ID,
			Data: map[string]any{
				"id":              attachment.ID(),
				"item_id":         attachment.ItemID(),
				"attachment_type": string(attachment.AttachmentType()),
				"user_name":       userName,
			},
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(toAttachmentResponse(attachment))
}

// ServeAttachmentHandler streams stored attachment bytes back to the client.
type ServeAttachmentHandler struct {
	svc     ServiceInterface
	storage storage.Storage
}

// HandleServe streams the stored bytes for an attachment id. Workspace-scoped:
// svc.GetAttachment (WHERE id=$1 AND workspace_id=$2) 404s on cross-tenant ids
// (T-14b-04). Sets nosniff + Content-Disposition: attachment (F15/T-14b-06).
func (h *ServeAttachmentHandler) HandleServe(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, msgWorkspaceContextRequired, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid attachment id", http.StatusBadRequest)
		return
	}

	// Workspace-scoped lookup — cross-tenant id resolves to 404.
	attachment, err := h.svc.GetAttachment(ctx, id, workspaceID)
	if err != nil || attachment == nil {
		http.Error(w, msgAttachmentNotFound, http.StatusNotFound)
		return
	}

	if attachment.FileID() == nil {
		// Link-only attachment (e.g. Paperless) — no bytes to serve.
		http.Error(w, "attachment has no stored file", http.StatusNotFound)
		return
	}

	file, err := h.svc.GetFile(ctx, *attachment.FileID(), workspaceID)
	if err != nil || file == nil {
		http.Error(w, msgAttachmentNotFound, http.StatusNotFound)
		return
	}

	reader, err := h.storage.Get(ctx, file.StorageKey())
	if err != nil {
		http.Error(w, "attachment file not found", http.StatusNotFound)
		return
	}
	defer reader.Close()

	// Content-Type from the STORED mime, fallback to extension sniff.
	mimeType := file.MimeType()
	if mimeType == "" {
		mimeType = mime.TypeByExtension(strings.ToLower(filepath.Ext(file.OriginalName())))
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}
	w.Header().Set("Content-Type", mimeType)

	// Security headers for serving user-uploaded content (audit F15).
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", storage.SanitizeFilename(file.OriginalName())))

	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, reader)
}

func toAttachmentResponse(a *Attachment) AttachmentResponse {
	return AttachmentResponse{
		ID:             a.ID(),
		ItemID:         a.ItemID(),
		FileID:         a.FileID(),
		AttachmentType: string(a.AttachmentType()),
		Title:          a.Title(),
		IsPrimary:      a.IsPrimary(),
		ExternalDocID:  a.ExternalDocID(),
		DMSType:        a.DMSType(),
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
		ExternalDocID  *string    `json:"external_doc_id,omitempty" doc:"External DMS document ID (Paperless-ngx) to link"`
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
	ExternalDocID  *string    `json:"external_doc_id,omitempty"`
	DMSType        *string    `json:"dms_type,omitempty" enum:"paperless" doc:"External DMS holding external_doc_id"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
