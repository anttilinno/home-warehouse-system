package locationphoto

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// Two routers, same split the item-photo and attachment surfaces already use:
// huma owns the JSON (list + delete) so the routes appear in the OpenAPI doc,
// while multipart upload and byte streaming are raw chi handlers (huma models
// a JSON body, not a file part or a response stream).

const msgWorkspaceRequired = "workspace context required"
const msgPhotoNotFound = "photo not found"

type LocationPhotoResponse struct {
	ID           uuid.UUID `json:"id"`
	LocationID   uuid.UUID `json:"location_id"`
	FileID       uuid.UUID `json:"file_id"`
	Caption      *string   `json:"caption,omitempty"`
	OriginalName string    `json:"original_name"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	CreatedAt    string    `json:"created_at"`
	// Relative path the SPA can put straight in an <img src> (the frontend
	// rewrites nothing — this is already /api-relative once proxied).
	URL string `json:"url"`
}

func toResponse(p *LocationPhoto) LocationPhotoResponse {
	return LocationPhotoResponse{
		ID:           p.ID,
		LocationID:   p.LocationID,
		FileID:       p.FileID,
		Caption:      p.Caption,
		OriginalName: p.OriginalName,
		MimeType:     p.MimeType,
		SizeBytes:    p.SizeBytes,
		CreatedAt:    p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		URL:          "/workspaces/" + p.WorkspaceID.String() + "/location-photos/" + p.ID.String() + "/file",
	}
}

type ListLocationPhotosInput struct {
	LocationID uuid.UUID `path:"location_id"`
}

type ListLocationPhotosOutput struct {
	Body LocationPhotoListResponse
}

type LocationPhotoListResponse struct {
	Items []LocationPhotoResponse `json:"items"`
}

type DeleteLocationPhotoInput struct {
	ID uuid.UUID `path:"id"`
}

// RegisterRoutes registers the JSON routes on the workspace-scoped huma API.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	huma.Get(api, "/locations/{location_id}/photos", listPhotos(svc))
	huma.Delete(api, "/location-photos/{id}", deletePhoto(svc))
}

func listPhotos(svc ServiceInterface) func(context.Context, *ListLocationPhotosInput) (*ListLocationPhotosOutput, error) {
	return func(ctx context.Context, input *ListLocationPhotosInput) (*ListLocationPhotosOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceRequired)
		}

		photos, err := svc.ListByLocation(ctx, input.LocationID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list photos")
		}

		items := make([]LocationPhotoResponse, len(photos))
		for i, p := range photos {
			items[i] = toResponse(p)
		}
		return &ListLocationPhotosOutput{Body: LocationPhotoListResponse{Items: items}}, nil
	}
}

func deletePhoto(svc ServiceInterface) func(context.Context, *DeleteLocationPhotoInput) (*struct{}, error) {
	return func(ctx context.Context, input *DeleteLocationPhotoInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceRequired)
		}

		// Resolve first so a foreign/unknown id is a 404 rather than a silent
		// no-op DELETE.
		photo, err := svc.Get(ctx, input.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to load photo")
		}
		if photo == nil {
			return nil, huma.Error404NotFound(msgPhotoNotFound)
		}
		if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
			return nil, huma.Error500InternalServerError("failed to delete photo")
		}
		return nil, nil
	}
}

// UploadHandler serves the multipart POST (field "photo").
type UploadHandler struct{ svc ServiceInterface }

// ServeHandler streams a photo's bytes back.
type ServeHandler struct{ svc ServiceInterface }

// RegisterUploadHandler mounts POST /locations/{location_id}/photos (multipart,
// field "photo"). It is a chi route, not huma, because huma models a JSON body.
func RegisterUploadHandler(r chi.Router, svc ServiceInterface) {
	h := &UploadHandler{svc: svc}
	r.Post("/locations/{location_id}/photos", h.HandleUpload)
}

// RegisterServeHandler mounts GET /location-photos/{id}/file.
func RegisterServeHandler(r chi.Router, svc ServiceInterface) {
	h := &ServeHandler{svc: svc}
	r.Get("/location-photos/{id}/file", h.HandleServe)
}

func (h *UploadHandler) HandleUpload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, msgWorkspaceRequired, http.StatusUnauthorized)
		return
	}
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return
	}

	locationID, err := uuid.Parse(chi.URLParam(r, "location_id"))
	if err != nil {
		http.Error(w, "invalid location_id", http.StatusBadRequest)
		return
	}

	if err := r.ParseMultipartForm(MaxFileSize); err != nil {
		http.Error(w, "file too large or invalid form data", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "photo is required (multipart field \"photo\")", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Reject anything that is not an image BEFORE a byte is written: this
	// endpoint feeds an <img>, and the size cap alone does not make an
	// arbitrary upload safe to store and serve back.
	if !isImageUpload(header.Header.Get("Content-Type")) {
		http.Error(w, "only image uploads are allowed", http.StatusBadRequest)
		return
	}
	if header.Size > MaxFileSize {
		http.Error(w, "file too large: maximum size is 10MB", http.StatusBadRequest)
		return
	}

	var caption *string
	if c := r.FormValue("caption"); c != "" {
		caption = &c
	}

	photo, err := h.svc.Upload(ctx, UploadInput{
		WorkspaceID: workspaceID,
		LocationID:  locationID,
		Header:      header,
		Reader:      file,
		Caption:     caption,
		UploadedBy:  &authUser.ID,
	})
	if err != nil {
		http.Error(w, "failed to store photo", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, toResponse(photo))
}

func (h *ServeHandler) HandleServe(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
	if !ok {
		http.Error(w, msgWorkspaceRequired, http.StatusUnauthorized)
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	photo, err := h.svc.Get(ctx, id, workspaceID)
	if err != nil || photo == nil {
		http.Error(w, msgPhotoNotFound, http.StatusNotFound)
		return
	}

	body, mimeType, err := h.svc.OpenFile(ctx, photo)
	if err != nil {
		http.Error(w, "failed to read photo", http.StatusInternalServerError)
		return
	}
	defer body.Close()

	w.Header().Set("Content-Type", mimeType)
	if photo.SizeBytes > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(photo.SizeBytes, 10))
	}
	// Immutable content (a photo row never changes bytes), but keep it private —
	// it is workspace-scoped behind auth.
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, body)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// isImageUpload accepts only the three formats the rest of the app already
// stores (itemphoto/repairphoto allow exactly these).
func isImageUpload(contentType string) bool {
	switch contentType {
	case "image/jpeg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}
