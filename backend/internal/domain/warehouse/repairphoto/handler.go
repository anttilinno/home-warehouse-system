package repairphoto

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
type PhotoURLGenerator func(workspaceID, repairLogID, photoID uuid.UUID, isThumbnail bool) string

// StorageGetter is an interface for getting storage instances
type StorageGetter interface {
	GetStorage() Storage
}

// RegisterRoutes registers repair photo routes (Huma routes only)
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster, urlGenerator PhotoURLGenerator) {
	// List photos for a repair log
	huma.Get(api, "/repairs/{repair_log_id}/photos/list", func(ctx context.Context, input *ListPhotosInput) (*ListPhotosOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		photos, err := svc.ListPhotos(ctx, input.RepairLogID, workspaceID)
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
	huma.Get(api, "/repairs/{repair_log_id}/photos/{id}", func(ctx context.Context, input *GetPhotoInput) (*GetPhotoOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		photo, err := svc.GetPhoto(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			return nil, huma.Error500InternalServerError("failed to get photo")
		}

		// Verify photo belongs to the repair log
		if photo.RepairLogID != input.RepairLogID {
			return nil, huma.Error404NotFound("photo not found")
		}

		return &GetPhotoOutput{
			Body: toPhotoResponse(photo, urlGenerator),
		}, nil
	})

	// Update photo caption
	huma.Put(api, "/repairs/{repair_log_id}/photos/{id}/caption", func(ctx context.Context, input *UpdateCaptionInput) (*UpdateCaptionOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		// Verify photo exists and belongs to this repair log
		existingPhoto, err := svc.GetPhoto(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			return nil, huma.Error500InternalServerError("failed to get photo")
		}
		if existingPhoto.RepairLogID != input.RepairLogID {
			return nil, huma.Error404NotFound("photo not found")
		}

		photo, err := svc.UpdateCaption(ctx, input.ID, workspaceID, input.Body.Caption)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			return nil, huma.Error500InternalServerError("failed to update caption")
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "repair_photo.updated",
				EntityID:   input.ID.String(),
				EntityType: "repair_photo",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":            input.ID,
					"repair_log_id": input.RepairLogID,
					"caption":       input.Body.Caption,
					"user_name":     userName,
				},
			})
		}

		return &UpdateCaptionOutput{
			Body: toPhotoResponse(photo, urlGenerator),
		}, nil
	})

	// Delete photo
	huma.Delete(api, "/repairs/{repair_log_id}/photos/{id}", func(ctx context.Context, input *DeletePhotoInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, _ := appMiddleware.GetAuthUser(ctx)

		// Verify photo exists and belongs to this repair log
		existingPhoto, err := svc.GetPhoto(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			return nil, huma.Error500InternalServerError("failed to get photo")
		}
		if existingPhoto.RepairLogID != input.RepairLogID {
			return nil, huma.Error404NotFound("photo not found")
		}

		err = svc.DeletePhoto(ctx, input.ID, workspaceID)
		if err != nil {
			if err == ErrPhotoNotFound {
				return nil, huma.Error404NotFound("photo not found")
			}
			return nil, huma.Error500InternalServerError("failed to delete photo")
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			broadcaster.Publish(workspaceID, events.Event{
				Type:       "repair_photo.deleted",
				EntityID:   input.ID.String(),
				EntityType: "repair_photo",
				UserID:     authUser.ID,
				Data: map[string]any{
					"id":            input.ID,
					"repair_log_id": input.RepairLogID,
					"user_name":     userName,
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
	r.Post("/repairs/{repair_log_id}/photos", handler.HandleUpload)
}

// RegisterServeHandler registers the photo serving handlers on a Chi router
func RegisterServeHandler(r chi.Router, svc ServiceInterface, storageGetter StorageGetter) {
	handler := &ServePhotoHandler{
		svc:           svc,
		storageGetter: storageGetter,
	}
	r.Get("/repairs/{repair_log_id}/photos/{photo_id}/file", handler.HandleServe)
	r.Get("/repairs/{repair_log_id}/photos/{photo_id}/thumbnail", handler.HandleServeThumbnail)
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

	// Get repair_log_id from URL
	repairLogIDStr := chi.URLParam(r, "repair_log_id")
	repairLogID, err := uuid.Parse(repairLogIDStr)
	if err != nil {
		http.Error(w, "invalid repair_log_id", http.StatusBadRequest)
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

	// Get photo_type from form (required)
	photoTypeStr := r.FormValue("photo_type")
	if photoTypeStr == "" {
		http.Error(w, "photo_type is required (BEFORE, DURING, or AFTER)", http.StatusBadRequest)
		return
	}
	photoType := PhotoType(strings.ToUpper(photoTypeStr))
	if !photoType.IsValid() {
		http.Error(w, "photo_type must be BEFORE, DURING, or AFTER", http.StatusBadRequest)
		return
	}

	// Get optional caption
	var caption *string
	if c := r.FormValue("caption"); c != "" {
		caption = &c
	}

	// Upload photo
	photo, err := h.svc.UploadPhoto(ctx, repairLogID, workspaceID, authUser.ID, photoType, file, header, caption)
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
			Type:       "repair_photo.created",
			EntityID:   photo.ID.String(),
			EntityType: "repair_photo",
			UserID:     authUser.ID,
			Data: map[string]any{
				"id":            photo.ID,
				"repair_log_id": photo.RepairLogID,
				"photo_type":    photo.PhotoType,
				"user_name":     userName,
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
	photo, err := h.svc.GetPhoto(ctx, photoID, workspaceID)
	if err != nil {
		if err == ErrPhotoNotFound {
			http.Error(w, "photo not found", http.StatusNotFound)
			return
		}
		http.Error(w, "failed to get photo", http.StatusInternalServerError)
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
func toPhotoResponse(p *RepairPhoto, urlGenerator PhotoURLGenerator) PhotoResponse {
	return PhotoResponse{
		ID:           p.ID,
		RepairLogID:  p.RepairLogID,
		WorkspaceID:  p.WorkspaceID,
		PhotoType:    string(p.PhotoType),
		Filename:     p.Filename,
		FileSize:     p.FileSize,
		MimeType:     p.MimeType,
		Width:        p.Width,
		Height:       p.Height,
		DisplayOrder: p.DisplayOrder,
		Caption:      p.Caption,
		URL:          urlGenerator(p.WorkspaceID, p.RepairLogID, p.ID, false),
		ThumbnailURL: urlGenerator(p.WorkspaceID, p.RepairLogID, p.ID, true),
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
}

// Request/Response types

type ListPhotosInput struct {
	RepairLogID uuid.UUID `path:"repair_log_id"`
}

type ListPhotosOutput struct {
	Body PhotoListResponse
}

type PhotoListResponse struct {
	Items []PhotoResponse `json:"items"`
}

type GetPhotoInput struct {
	RepairLogID uuid.UUID `path:"repair_log_id"`
	ID          uuid.UUID `path:"id"`
}

type GetPhotoOutput struct {
	Body PhotoResponse
}

type UpdateCaptionInput struct {
	RepairLogID uuid.UUID `path:"repair_log_id"`
	ID          uuid.UUID `path:"id"`
	Body        struct {
		Caption *string `json:"caption" doc:"Photo caption (can be null to remove)"`
	}
}

type UpdateCaptionOutput struct {
	Body PhotoResponse
}

type DeletePhotoInput struct {
	RepairLogID uuid.UUID `path:"repair_log_id"`
	ID          uuid.UUID `path:"id"`
}

type PhotoResponse struct {
	ID           uuid.UUID `json:"id"`
	RepairLogID  uuid.UUID `json:"repair_log_id"`
	WorkspaceID  uuid.UUID `json:"workspace_id"`
	PhotoType    string    `json:"photo_type" doc:"Type of photo: BEFORE, DURING, or AFTER"`
	Filename     string    `json:"filename"`
	FileSize     int64     `json:"file_size"`
	MimeType     string    `json:"mime_type"`
	Width        int32     `json:"width"`
	Height       int32     `json:"height"`
	DisplayOrder int32     `json:"display_order"`
	Caption      *string   `json:"caption,omitempty"`
	URL          string    `json:"url" doc:"Full-size photo URL"`
	ThumbnailURL string    `json:"thumbnail_url" doc:"Thumbnail photo URL"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
