package itemphoto

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
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

// RegisterBulkHandler registers bulk operation handlers on a Chi router
func RegisterBulkHandler(r chi.Router, svc ServiceInterface, storageGetter StorageGetter, hasher Hasher, broadcaster *events.Broadcaster, urlGenerator PhotoURLGenerator) {
	handler := &BulkPhotoHandler{
		svc:           svc,
		storageGetter: storageGetter,
		hasher:        hasher,
		broadcaster:   broadcaster,
		urlGenerator:  urlGenerator,
	}
	r.Post("/items/{item_id}/photos/bulk-delete", handler.HandleBulkDelete)
	r.Post("/items/{item_id}/photos/bulk-caption", handler.HandleBulkCaption)
	r.Get("/items/{item_id}/photos/download", handler.HandleDownload)
	r.Post("/items/{item_id}/photos/check-duplicate", handler.HandleCheckDuplicate)
}

// BulkPhotoHandler handles bulk photo operations
type BulkPhotoHandler struct {
	svc           ServiceInterface
	storageGetter StorageGetter
	hasher        Hasher
	broadcaster   *events.Broadcaster
	urlGenerator  PhotoURLGenerator
}

// HandleBulkDelete handles bulk photo deletion
func (h *BulkPhotoHandler) HandleBulkDelete(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get workspace from context
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	authUser, _ := appMiddleware.GetAuthUser(ctx)

	// Get item_id from URL
	itemIDStr := chi.URLParam(r, "item_id")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		http.Error(w, "invalid item_id", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req BulkDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.PhotoIDs) == 0 {
		http.Error(w, "photo_ids is required", http.StatusBadRequest)
		return
	}

	// Perform bulk delete
	if err := h.svc.BulkDeletePhotos(ctx, itemID, workspaceID, req.PhotoIDs); err != nil {
		http.Error(w, fmt.Sprintf("failed to delete photos: %v", err), http.StatusInternalServerError)
		return
	}

	// Publish event
	if h.broadcaster != nil && authUser != nil {
		userName := appMiddleware.GetUserDisplayName(ctx)
		h.broadcaster.Publish(workspaceID, events.Event{
			Type:       "item_photos.bulk_deleted",
			EntityID:   itemID.String(),
			EntityType: "item",
			UserID:     authUser.ID,
			Data: map[string]any{
				"item_id":   itemID,
				"count":     len(req.PhotoIDs),
				"photo_ids": req.PhotoIDs,
				"user_name": userName,
			},
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleBulkCaption handles bulk caption updates
func (h *BulkPhotoHandler) HandleBulkCaption(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get workspace from context
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	authUser, _ := appMiddleware.GetAuthUser(ctx)

	// Get item_id from URL
	itemIDStr := chi.URLParam(r, "item_id")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		http.Error(w, "invalid item_id", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req BulkCaptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Updates) == 0 {
		http.Error(w, "updates is required", http.StatusBadRequest)
		return
	}

	// Convert to service format
	updates := make([]CaptionUpdate, len(req.Updates))
	for i, u := range req.Updates {
		updates[i] = CaptionUpdate{
			PhotoID: u.PhotoID,
			Caption: u.Caption,
		}
	}

	// Perform bulk update
	if err := h.svc.BulkUpdateCaptions(ctx, workspaceID, updates); err != nil {
		http.Error(w, fmt.Sprintf("failed to update captions: %v", err), http.StatusInternalServerError)
		return
	}

	// Publish event
	if h.broadcaster != nil && authUser != nil {
		userName := appMiddleware.GetUserDisplayName(ctx)
		h.broadcaster.Publish(workspaceID, events.Event{
			Type:       "item_photos.bulk_updated",
			EntityID:   itemID.String(),
			EntityType: "item",
			UserID:     authUser.ID,
			Data: map[string]any{
				"item_id":   itemID,
				"count":     len(req.Updates),
				"user_name": userName,
			},
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// HandleDownload streams all photos as a zip archive
func (h *BulkPhotoHandler) HandleDownload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get workspace from context
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	// Get item_id from URL
	itemIDStr := chi.URLParam(r, "item_id")
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		http.Error(w, "invalid item_id", http.StatusBadRequest)
		return
	}

	// Parse optional ?ids= query parameter for selective download
	var photos []*ItemPhoto
	idsParam := r.URL.Query().Get("ids")
	if idsParam != "" {
		// Parse comma-separated UUIDs
		idStrings := strings.Split(idsParam, ",")
		photoIDs := make([]uuid.UUID, 0, len(idStrings))
		for _, idStr := range idStrings {
			idStr = strings.TrimSpace(idStr)
			if idStr == "" {
				continue
			}
			photoID, err := uuid.Parse(idStr)
			if err != nil {
				http.Error(w, "invalid photo ID in ids parameter", http.StatusBadRequest)
				return
			}
			photoIDs = append(photoIDs, photoID)
		}
		if len(photoIDs) > 0 {
			photos, err = h.svc.GetPhotosByIDs(ctx, photoIDs, workspaceID)
			if err != nil {
				http.Error(w, "failed to get selected photos", http.StatusInternalServerError)
				return
			}
		}
	}

	// If no IDs specified or empty, get all photos for the item
	if photos == nil {
		photos, err = h.svc.GetPhotosForDownload(ctx, itemID, workspaceID)
		if err != nil {
			http.Error(w, "failed to get photos", http.StatusInternalServerError)
			return
		}
	}

	if len(photos) == 0 {
		http.Error(w, "no photos found", http.StatusNotFound)
		return
	}

	// Get storage
	storage := h.storageGetter.GetStorage()

	// Set headers for zip download
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"photos-%s.zip\"", itemID.String()[:8]))

	// Create zip writer
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	// Add each photo to the zip
	for i, photo := range photos {
		// Get file from storage
		reader, err := storage.Get(ctx, photo.StoragePath)
		if err != nil {
			// Skip files that don't exist
			continue
		}

		// Create unique filename (avoid conflicts)
		filename := photo.Filename
		if i > 0 {
			// Check for duplicates and add index if needed
			ext := filepath.Ext(filename)
			base := strings.TrimSuffix(filename, ext)
			filename = fmt.Sprintf("%s_%d%s", base, i, ext)
		}

		// Create file in zip
		fileWriter, err := zipWriter.Create(filename)
		if err != nil {
			reader.Close()
			continue
		}

		// Copy file content
		_, err = io.Copy(fileWriter, reader)
		reader.Close()
		if err != nil {
			continue
		}
	}
}

// HandleCheckDuplicate checks for duplicate photos before upload
func (h *BulkPhotoHandler) HandleCheckDuplicate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get workspace from context
	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, "workspace context required", http.StatusUnauthorized)
		return
	}

	// Get item_id from URL (for context, not currently used in duplicate check)
	itemIDStr := chi.URLParam(r, "item_id")
	_, err := uuid.Parse(itemIDStr)
	if err != nil {
		http.Error(w, "invalid item_id", http.StatusBadRequest)
		return
	}

	// Check if hasher is available
	if h.hasher == nil {
		// Return empty result if no hasher configured
		json.NewEncoder(w).Encode(DuplicateCheckResponse{
			HasDuplicates: false,
			Duplicates:    []DuplicateInfo{},
		})
		return
	}

	// Parse multipart form (10MB max for the preview image)
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

	// Check file type
	contentType := header.Header.Get("Content-Type")
	if !isValidMimeType(contentType) {
		http.Error(w, "invalid file type", http.StatusBadRequest)
		return
	}

	// Save to temp file for processing
	tempFile, err := createTempFile(file)
	if err != nil {
		http.Error(w, "failed to process file", http.StatusInternalServerError)
		return
	}
	defer removeTempFile(tempFile)

	// Generate hash
	hash, err := h.hasher.GenerateHash(ctx, tempFile)
	if err != nil {
		// Can't generate hash - return no duplicates
		json.NewEncoder(w).Encode(DuplicateCheckResponse{
			HasDuplicates: false,
			Duplicates:    []DuplicateInfo{},
		})
		return
	}

	// Check for duplicates
	candidates, err := h.svc.CheckDuplicates(ctx, workspaceID, hash)
	if err != nil {
		http.Error(w, "failed to check duplicates", http.StatusInternalServerError)
		return
	}

	// Convert to response format
	duplicates := make([]DuplicateInfo, len(candidates))
	for i, c := range candidates {
		duplicates[i] = DuplicateInfo{
			PhotoID:       c.PhotoID,
			ItemID:        c.ItemID,
			Filename:      c.Filename,
			SimilarityPct: c.SimilarityPct,
			ThumbnailURL:  h.urlGenerator(workspaceID, c.ItemID, c.PhotoID, true),
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DuplicateCheckResponse{
		HasDuplicates: len(duplicates) > 0,
		Duplicates:    duplicates,
	})
}

// createTempFile saves the multipart file to a temporary file and returns the path
func createTempFile(file io.Reader) (string, error) {
	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	tempFilePath := filepath.Join(os.TempDir(), fmt.Sprintf("photo-check-%d", time.Now().UnixNano()))

	if err := os.WriteFile(tempFilePath, content, 0600); err != nil {
		return "", err
	}

	return tempFilePath, nil
}

// removeTempFile removes a temporary file
func removeTempFile(path string) {
	os.Remove(path)
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
