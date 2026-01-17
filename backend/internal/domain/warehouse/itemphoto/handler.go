package itemphoto

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

// PhotoURLGenerator is a function that generates URLs for photos
type PhotoURLGenerator func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string

// StorageGetter is an interface for getting storage instances
type StorageGetter interface {
	GetStorage() Storage
}

// RegisterRoutes registers item photo routes (Huma routes only)
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster, urlGenerator PhotoURLGenerator) {

	// List photos for an item
	huma.Get(api, "/items/{item_id}/photos/list", func(ctx context.Context, input *ListPhotosInput) (*ListPhotosOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		photos, err := svc.ListPhotos(ctx, input.ItemID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list photos")
		}

		items := make([]PhotoResponse, len(photos))
		for i, photo := range photos {
			items[i] = toPhotoResponse(photo, urlGenerator)
		}

		return &ListPhotosOutput{
			Body: PhotoListResponse{Items: items},
		}, nil
	})

	// Get single photo metadata
	huma.Get(api, "/photos/{id}", func(ctx context.Context, input *GetPhotoInput) (*GetPhotoOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		photo, err := svc.GetPhoto(ctx, input.ID)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			return nil, huma.Error500InternalServerError("failed to get photo")
		}

		// Verify photo belongs to workspace
		if photo.WorkspaceID != workspaceID {
			return nil, huma.Error404NotFound("photo not found")
		}

		return &GetPhotoOutput{
			Body: toPhotoResponse(photo, urlGenerator),
		}, nil
	})

	// Set photo as primary
	huma.Put(api, "/photos/{id}/primary", func(ctx context.Context, input *SetPrimaryInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.SetPrimaryPhoto(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			if err == ErrUnauthorized {
				return nil, huma.Error403Forbidden("photo does not belong to workspace")
			}
			return nil, huma.Error500InternalServerError("failed to set primary photo")
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item_photo.updated",
				EntityID:   input.ID.String(),
				EntityType: "item_photo",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":         input.ID,
					"is_primary": true,
					"user_name":  userName,
				},
			})
		}

		return nil, nil
	})

	// Update photo caption
	huma.Put(api, "/photos/{id}/caption", func(ctx context.Context, input *UpdateCaptionInput) (*UpdateCaptionOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.UpdateCaption(ctx, input.ID, workspaceID, input.Body.Caption)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			if err == ErrUnauthorized {
				return nil, huma.Error403Forbidden("photo does not belong to workspace")
			}
			return nil, huma.Error500InternalServerError("failed to update caption")
		}

		// Get updated photo
		photo, err := svc.GetPhoto(ctx, input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to get updated photo")
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item_photo.updated",
				EntityID:   input.ID.String(),
				EntityType: "item_photo",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        input.ID,
					"caption":   input.Body.Caption,
					"user_name": userName,
				},
			})
		}

		return &UpdateCaptionOutput{
			Body: toPhotoResponse(photo, urlGenerator),
		}, nil
	})

	// Reorder photos
	huma.Put(api, "/items/{item_id}/photos/order", func(ctx context.Context, input *ReorderPhotosInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		err := svc.ReorderPhotos(ctx, input.ItemID, workspaceID, input.Body.PhotoIDs)
		if err != nil {
			if err == ErrInvalidDisplayOrder {
				return nil, huma.Error400BadRequest("invalid photo order: all photos must be included")
			}
			return nil, huma.Error500InternalServerError("failed to reorder photos")
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item_photo.reordered",
				EntityID:   input.ItemID.String(),
				EntityType: "item",
				UserID:     authUser.ID,
				Data: map[string]any{
					"item_id":   input.ItemID,
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})

	// Delete photo
	huma.Delete(api, "/photos/{id}", func(ctx context.Context, input *GetPhotoInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		// Get photo before deletion for event data
		photo, _ := svc.GetPhoto(ctx, input.ID)

		err := svc.DeletePhoto(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			if err == ErrUnauthorized {
				return nil, huma.Error403Forbidden("photo does not belong to workspace")
			}
			return nil, huma.Error500InternalServerError("failed to delete photo")
		}

		// Publish event
		if broadcaster != nil && authUser != nil && photo != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "item_photo.deleted",
				EntityID:   input.ID.String(),
				EntityType: "item_photo",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":        input.ID,
					"item_id":   photo.ItemID,
					"user_name": userName,
				},
			})
		}

		return nil, nil
	})
}

// RegisterUploadHandler registers the multipart upload handler on a Chi router
func RegisterUploadHandler(r chi.Router, svc ServiceInterface, broadcaster *events.Broadcaster, urlGenerator PhotoURLGenerator) {
	handler := &UploadHandler{
		svc:          svc,
		broadcaster:  broadcaster,
		urlGenerator: urlGenerator,
	}
	r.Post("/items/{item_id}/photos", handler.HandleUpload)
}

// RegisterServeHandler registers the photo serving handlers on a Chi router
func RegisterServeHandler(r chi.Router, svc ServiceInterface, storageGetter StorageGetter) {
	handler := &ServePhotoHandler{
		svc:           svc,
		storageGetter: storageGetter,
	}
	r.Get("/items/{item_id}/photos/{photo_id}", handler.HandleServe)
	r.Get("/items/{item_id}/photos/{photo_id}/thumbnail", handler.HandleServeThumbnail)
}

// UploadHandler handles multipart file upload for photos
type UploadHandler struct {
	svc          ServiceInterface
	broadcaster  *events.Broadcaster
	urlGenerator PhotoURLGenerator
}

// HandleUpload handles photo upload
func (h *UploadHandler) HandleUpload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get workspace and user from context
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		http.Error(w, "user context required", http.StatusUnauthorized)
		return
	}

	// Get item_id from URL
	itemIDStr := chi.URLParam(r, "item_id")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		http.Error(w, "invalid item_id", http.StatusBadRequest)
		return
	}

	// Parse multipart form (10MB max)
	if err := r.ParseMultipartForm(MaxFileSize); err != nil {
		http.Error(w, "file too large or invalid form data", http.StatusBadRequest)
		return
	}

	// Get file from form
	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "photo file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Get optional caption
	var caption *string
	if c := r.FormValue("caption"); c != "" {
		caption = &c
	}

	// Upload photo
	photo, err := h.svc.UploadPhoto(ctx, itemID, workspaceID, authUser.ID, file, header, caption)
	if err != nil {
		switch err {
		case ErrFileTooLarge:
			http.Error(w, "file too large: maximum size is 10MB", http.StatusRequestEntityTooLarge)
		case ErrInvalidFileType:
			http.Error(w, "invalid file type: only JPEG, PNG, and WebP are allowed", http.StatusBadRequest)
		default:
			http.Error(w, fmt.Sprintf("failed to upload photo: %v", err), http.StatusInternalServerError)
		}
		return
	}

	// Publish event
	if h.broadcaster != nil {
		userName := appMiddleware.GetUserDisplayName(ctx)
		h.broadcaster.Publish(workspaceID, events.Event{
			Type:       "item_photo.created",
			EntityID:   photo.ID.String(),
			EntityType: "item_photo",
			UserID:     authUser.ID,
			Data: map[string]any{
				"id":         photo.ID,
				"item_id":    photo.ItemID,
				"is_primary": photo.IsPrimary,
				"user_name":  userName,
			},
		})
	}

	// Return response
	response := toPhotoResponse(photo, h.urlGenerator)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// ServePhotoHandler serves photo files
type ServePhotoHandler struct {
	svc           ServiceInterface
	storageGetter StorageGetter
}

// HandleServe serves the full-size photo
func (h *ServePhotoHandler) HandleServe(w http.ResponseWriter, r *http.Request) {
	h.servePhoto(w, r, false)
}

// HandleServeThumbnail serves the thumbnail
func (h *ServePhotoHandler) HandleServeThumbnail(w http.ResponseWriter, r *http.Request) {
	h.servePhoto(w, r, true)
}

func (h *ServePhotoHandler) servePhoto(w http.ResponseWriter, r *http.Request, thumbnail bool) {
	ctx := r.Context()

	// Get workspace from context (for authorization)
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	// Get photo_id from URL
	photoIDStr := chi.URLParam(r, "photo_id")
	photoID, err := uuid.Parse(photoIDStr)
	if err != nil {
		http.Error(w, "invalid photo_id", http.StatusBadRequest)
		return
	}

	// Get photo metadata
	photo, err := h.svc.GetPhoto(ctx, photoID)
	if err != nil {
		if err == ErrPhotoNotFound {
			http.Error(w, "photo not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to get photo", http.StatusInternalServerError)
		return
	}

	// Verify photo belongs to workspace
	if photo.WorkspaceID != workspaceID {
		http.Error(w, "photo not found", http.StatusNotFound)
		return
	}

	// Get storage path
	storagePath := photo.StoragePath
	if thumbnail {
		storagePath = photo.ThumbnailPath
	}

	// Get file from storage
	storage := h.storageGetter.GetStorage()
	reader, err := storage.Get(ctx, storagePath)
	if err != nil {
		http.Error(w, "photo file not found", http.StatusNotFound)
		return
	}
	defer reader.Close()

	// Set content type
	mimeType := photo.MimeType
	if mimeType == "" {
		// Fallback: detect from extension
		ext := strings.ToLower(filepath.Ext(photo.Filename))
		mimeType = mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}
	w.Header().Set("Content-Type", mimeType)

	// Set cache headers (1 year)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

	// Serve file
	w.WriteHeader(http.StatusOK)
	io.Copy(w, reader)
}

// Helper function to convert entity to response
func toPhotoResponse(p *ItemPhoto, urlGenerator PhotoURLGenerator) PhotoResponse {
	return PhotoResponse{
		ID:           p.ID,
		ItemID:       p.ItemID,
		WorkspaceID:  p.WorkspaceID,
		Filename:     p.Filename,
		FileSize:     p.FileSize,
		MimeType:     p.MimeType,
		Width:        p.Width,
		Height:       p.Height,
		DisplayOrder: p.DisplayOrder,
		IsPrimary:    p.IsPrimary,
		Caption:      p.Caption,
		URL:          urlGenerator(p.WorkspaceID, p.ItemID, p.ID, false),
		ThumbnailURL: urlGenerator(p.WorkspaceID, p.ItemID, p.ID, true),
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
}

// Request/Response types

type ListPhotosInput struct {
	ItemID uuid.UUID `path:"item_id"`
}

type ListPhotosOutput struct {
	Body PhotoListResponse
}

type PhotoListResponse struct {
	Items []PhotoResponse `json:"items"`
}

type GetPhotoInput struct {
	ID uuid.UUID `path:"id"`
}

type GetPhotoOutput struct {
	Body PhotoResponse
}

type SetPrimaryInput struct {
	ID uuid.UUID `path:"id"`
}

type UpdateCaptionInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Caption *string `json:"caption" doc:"Photo caption (can be null to remove)"`
	}
}

type UpdateCaptionOutput struct {
	Body PhotoResponse
}

type ReorderPhotosInput struct {
	ItemID uuid.UUID `path:"item_id"`
	Body   struct {
		PhotoIDs []uuid.UUID `json:"photo_ids" minItems:"1" doc:"Ordered list of photo IDs"`
	}
}

type PhotoResponse struct {
	ID           uuid.UUID  `json:"id"`
	ItemID       uuid.UUID  `json:"item_id"`
	WorkspaceID  uuid.UUID  `json:"workspace_id"`
	Filename     string     `json:"filename"`
	FileSize     int64      `json:"file_size"`
	MimeType     string     `json:"mime_type"`
	Width        int32      `json:"width"`
	Height       int32      `json:"height"`
	DisplayOrder int32      `json:"display_order"`
	IsPrimary    bool       `json:"is_primary"`
	Caption      *string    `json:"caption,omitempty"`
	URL          string     `json:"url" doc:"Full-size photo URL"`
	ThumbnailURL string     `json:"thumbnail_url" doc:"Thumbnail photo URL"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
