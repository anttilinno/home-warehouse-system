package user

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

const (
	// MIME types
	mimeJPEG = "image/jpeg"
	mimePNG  = "image/png"
	mimeWebP = "image/webp"

	// HTTP headers
	headerContentType = "Content-Type"
)

// AvatarStorage defines the interface for storing avatar files
type AvatarStorage interface {
	// SaveAvatar saves an avatar file and returns the storage path
	SaveAvatar(ctx context.Context, userID, filename string, reader io.Reader) (path string, err error)
	// GetAvatar retrieves an avatar file by path
	GetAvatar(ctx context.Context, path string) (io.ReadCloser, error)
	// DeleteAvatar removes an avatar file
	DeleteAvatar(ctx context.Context, path string) error
}

// AvatarImageProcessor defines the interface for avatar image processing
type AvatarImageProcessor interface {
	// GenerateThumbnail generates a square thumbnail
	GenerateThumbnail(ctx context.Context, sourcePath, destPath string, maxWidth, maxHeight int) error
	// GetDimensions returns image dimensions
	GetDimensions(ctx context.Context, path string) (width, height int, err error)
	// Validate validates an image file
	Validate(ctx context.Context, path string) error
}

// Avatar handlers

const (
	// MaxAvatarSize is the maximum allowed avatar file size (2MB)
	MaxAvatarSize = 2 * 1024 * 1024
	// AvatarThumbnailSize is the size of the square avatar thumbnail
	AvatarThumbnailSize = 150
)

// Allowed MIME types for avatars
var allowedAvatarMimeTypes = map[string]bool{
	mimeJPEG: true,
	mimePNG:  true,
	mimeWebP: true,
}

// uploadAvatar handles POST /users/me/avatar
func (h *Handler) uploadAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		http.Error(w, msgNotAuthenticated, http.StatusUnauthorized)
		return
	}

	// Check if storage is configured
	if h.avatarStorage == nil || h.imageProcessor == nil {
		http.Error(w, "avatar upload not configured", http.StatusServiceUnavailable)
		return
	}

	// Parse multipart form (2MB max). The request body is already bounded by the
	// global MaxBodySize middleware (see api/router.go), so this is not an
	// unbounded read despite gosec's G120 heuristic.
	if err := r.ParseMultipartForm(MaxAvatarSize); err != nil { //nolint:gosec // G120: body capped by MaxBodySize middleware
		http.Error(w, "file too large or invalid form data", http.StatusBadRequest)
		return
	}

	// Get file from form
	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "avatar file is required", http.StatusBadRequest)
		return
	}
	defer func() { _ = file.Close() }()

	// Validate file size
	if header.Size > MaxAvatarSize {
		http.Error(w, "file too large: maximum size is 2MB", http.StatusRequestEntityTooLarge)
		return
	}

	// Validate MIME type
	contentType := header.Header.Get(headerContentType)
	if !allowedAvatarMimeTypes[contentType] {
		http.Error(w, "invalid file type: only JPEG, PNG, and WebP are allowed", http.StatusBadRequest)
		return
	}

	// Create temporary file for image processing
	uploadDir := h.uploadDir
	if uploadDir == "" {
		uploadDir = os.TempDir()
	}
	tempFile, err := os.CreateTemp(uploadDir, "avatar-*"+filepath.Ext(header.Filename))
	if err != nil {
		http.Error(w, "failed to process file", http.StatusInternalServerError)
		return
	}
	tempPath := tempFile.Name()
	defer func() { _ = os.Remove(tempPath) }() //nolint:gosec // G703: path from os.CreateTemp, not attacker-controlled

	// Copy uploaded data to temp file
	if _, err := io.Copy(tempFile, file); err != nil {
		_ = tempFile.Close()
		http.Error(w, "failed to process file", http.StatusInternalServerError)
		return
	}
	_ = tempFile.Close()

	// Validate image
	if err := h.imageProcessor.Validate(ctx, tempPath); err != nil {
		http.Error(w, "invalid image file", http.StatusBadRequest)
		return
	}

	// Generate thumbnail (150x150 square)
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		// Determine extension from content type
		switch contentType {
		case mimeJPEG:
			ext = ".jpg"
		case mimePNG:
			ext = ".png"
		case mimeWebP:
			ext = ".webp"
		}
	}
	thumbnailPath := tempPath + "_thumb" + ext
	defer func() { _ = os.Remove(thumbnailPath) }() //nolint:gosec // G703: path derived from os.CreateTemp, not attacker-controlled

	if err := h.imageProcessor.GenerateThumbnail(ctx, tempPath, thumbnailPath, AvatarThumbnailSize, AvatarThumbnailSize); err != nil {
		http.Error(w, "failed to process image", http.StatusInternalServerError)
		return
	}

	// Save thumbnail to storage. thumbnailPath is server-derived from
	// os.CreateTemp plus a validated extension, not user-controlled.
	thumbReader, err := os.Open(thumbnailPath) //nolint:gosec // G304: server-constructed path, not user input
	if err != nil {
		http.Error(w, "failed to process image", http.StatusInternalServerError)
		return
	}
	defer func() { _ = thumbReader.Close() }()

	filename := fmt.Sprintf("avatar%s", ext)
	storagePath, err := h.avatarStorage.SaveAvatar(ctx, authUser.ID.String(), filename, thumbReader)
	if err != nil {
		http.Error(w, "failed to save avatar", http.StatusInternalServerError)
		return
	}

	// Delete old avatar if exists
	currentUser, err := h.svc.GetByID(ctx, authUser.ID)
	if err == nil && currentUser.AvatarPath() != nil && *currentUser.AvatarPath() != "" {
		_ = h.avatarStorage.DeleteAvatar(ctx, *currentUser.AvatarPath())
	}

	// Update user with new avatar path
	user, err := h.svc.UpdateAvatar(ctx, authUser.ID, &storagePath)
	if err != nil {
		// Try to clean up the uploaded file
		_ = h.avatarStorage.DeleteAvatar(ctx, storagePath)
		http.Error(w, "failed to update user", http.StatusInternalServerError)
		return
	}

	// Return the updated user using the shared DTO + encoder. The previous
	// hand-rolled fmt.Fprintf interpolated user-controlled fields (full_name,
	// email) straight into a JSON string literal, which a value containing a
	// quote could break or inject; json.Encode escapes correctly.
	w.Header().Set(headerContentType, "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(newUserResponse(user))
}

// serveAvatar handles GET /users/me/avatar
func (h *Handler) serveAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		http.Error(w, msgNotAuthenticated, http.StatusUnauthorized)
		return
	}

	// Check if storage is configured
	if h.avatarStorage == nil {
		http.Error(w, "avatar service not configured", http.StatusServiceUnavailable)
		return
	}

	// Get user to find avatar path
	user, err := h.svc.GetByID(ctx, authUser.ID)
	if err != nil {
		http.Error(w, msgUserNotFound, http.StatusNotFound)
		return
	}

	avatarPath := user.AvatarPath()
	if avatarPath == nil || *avatarPath == "" {
		http.Error(w, "no avatar", http.StatusNotFound)
		return
	}

	// Get file from storage
	reader, err := h.avatarStorage.GetAvatar(ctx, *avatarPath)
	if err != nil {
		http.Error(w, "avatar not found", http.StatusNotFound)
		return
	}
	defer func() { _ = reader.Close() }()

	// Determine content type from path extension
	ext := strings.ToLower(filepath.Ext(*avatarPath))
	contentType := "application/octet-stream"
	switch ext {
	case ".jpg", ".jpeg":
		contentType = mimeJPEG
	case ".png":
		contentType = mimePNG
	case ".webp":
		contentType = mimeWebP
	}

	// Set headers
	w.Header().Set(headerContentType, contentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=%q", "avatar"+ext))
	w.Header().Set("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'")

	// Serve file
	_, _ = io.Copy(w, reader)
}

// deleteAvatar handles DELETE /users/me/avatar
func (h *Handler) deleteAvatar(ctx context.Context, input *struct{}) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}

	// Check if storage is configured
	if h.avatarStorage == nil {
		return nil, huma.Error503ServiceUnavailable("avatar service not configured")
	}

	// Get user to find current avatar path
	user, err := h.svc.GetByID(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error404NotFound(msgUserNotFound)
	}

	avatarPath := user.AvatarPath()
	if avatarPath == nil || *avatarPath == "" {
		// No avatar to delete, return success
		return nil, nil
	}

	// Delete from storage. Don't fail the request if the file is already gone;
	// the DB update below is the source of truth for whether an avatar exists.
	if err := h.avatarStorage.DeleteAvatar(ctx, *avatarPath); err != nil {
		slog.WarnContext(ctx, "deleteAvatar: failed to remove avatar file",
			"user_id", authUser.ID, "path", *avatarPath, "error", err)
	}

	// Update user to remove avatar path
	_, err = h.svc.UpdateAvatar(ctx, authUser.ID, nil)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to update user")
	}

	return nil, nil
}
