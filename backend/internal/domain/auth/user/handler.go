package user

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

const (
	// Cookie names
	accessTokenCookie  = "access_token"
	refreshTokenCookie = "refresh_token"

	// Cookie max ages
	accessTokenMaxAge  = 24 * 60 * 60     // 24 hours (matches JWT expiry)
	refreshTokenMaxAge = 7 * 24 * 60 * 60 // 7 days
)

// isSecureCookie returns true if cookies should be secure (HTTPS only)
func isSecureCookie() bool {
	return os.Getenv("APP_ENV") == "production"
}

// createAuthCookie creates an HTTP cookie for authentication
func createAuthCookie(name, value string, maxAge int) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   isSecureCookie(),
		SameSite: http.SameSiteLaxMode,
	}
}

// clearAuthCookie creates a cookie that clears the auth cookie
func clearAuthCookie(name string) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isSecureCookie(),
		SameSite: http.SameSiteLaxMode,
	}
}

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

// Handler holds dependencies for user HTTP handlers.
type Handler struct {
	svc            ServiceInterface
	jwtService     jwt.ServiceInterface
	workspaceSvc   workspace.ServiceInterface
	sessionSvc     session.ServiceInterface
	avatarStorage  AvatarStorage
	imageProcessor AvatarImageProcessor
	uploadDir      string
}

// NewHandler creates a new user handler.
func NewHandler(svc ServiceInterface, jwtService jwt.ServiceInterface, workspaceSvc workspace.ServiceInterface) *Handler {
	return &Handler{
		svc:            svc,
		jwtService:     jwtService,
		workspaceSvc:   workspaceSvc,
	}
}

// SetAvatarStorage sets the avatar storage for avatar operations.
func (h *Handler) SetAvatarStorage(storage AvatarStorage) {
	h.avatarStorage = storage
}

// SetImageProcessor sets the image processor for avatar thumbnail generation.
func (h *Handler) SetImageProcessor(processor AvatarImageProcessor) {
	h.imageProcessor = processor
}

// SetUploadDir sets the temporary upload directory.
func (h *Handler) SetUploadDir(dir string) {
	h.uploadDir = dir
}

// SetSessionService sets the session service for session tracking.
func (h *Handler) SetSessionService(sessionSvc session.ServiceInterface) {
	h.sessionSvc = sessionSvc
}

// RegisterPublicRoutes registers public user routes (no auth required).
func (h *Handler) RegisterPublicRoutes(api huma.API) {
	huma.Post(api, "/auth/register", h.register)
	huma.Post(api, "/auth/login", h.login)
	huma.Post(api, "/auth/refresh", h.refreshToken)
	huma.Post(api, "/auth/logout", h.logout)
}

// RegisterProtectedRoutes registers protected user routes (auth required).
func (h *Handler) RegisterProtectedRoutes(api huma.API) {
	huma.Get(api, "/users/me", h.getMe)
	huma.Get(api, "/users/me/workspaces", h.getMyWorkspaces)
	huma.Patch(api, "/users/me", h.updateMe)
	huma.Patch(api, "/users/me/password", h.updatePassword)
	huma.Patch(api, "/users/me/preferences", h.updatePreferences)
	huma.Delete(api, "/users/me/avatar", h.deleteAvatar)
}

// RegisterAvatarRoutes registers avatar upload and serve routes on a Chi router.
// This must be called separately because multipart upload requires Chi routing.
func (h *Handler) RegisterAvatarRoutes(r chi.Router) {
	r.Post("/users/me/avatar", h.uploadAvatar)
	r.Get("/users/me/avatar", h.serveAvatar)
}

// RegisterAdminRoutes registers admin-only user routes (superuser required).
func (h *Handler) RegisterAdminRoutes(api huma.API) {
	huma.Get(api, "/users", h.listUsers)
	huma.Get(api, "/users/{id}", h.getUserByID)
	huma.Post(api, "/users/{id}/deactivate", h.deactivateUser)
	huma.Post(api, "/users/{id}/activate", h.activateUser)
}

func (h *Handler) register(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
	user, err := h.svc.Create(ctx, CreateUserInput{
		Email:    input.Body.Email,
		FullName: input.Body.FullName,
		Password: input.Body.Password,
	})
	if err != nil {
		if shared.IsAlreadyExists(err) {
			return nil, huma.Error409Conflict("email is already taken")
		}
		if shared.IsInvalidInput(err) {
			return nil, huma.Error400BadRequest(err.Error())
		}
		return nil, huma.Error500InternalServerError("failed to create user")
	}

	// Create a personal workspace for the new user
	workspaceName := fmt.Sprintf("%s's Workspace", user.FullName())
	workspaceSlug := fmt.Sprintf("user-%s", user.ID().String())
	_, err = h.workspaceSvc.Create(ctx, workspace.CreateWorkspaceInput{
		Name:        workspaceName,
		Slug:        workspaceSlug,
		Description: nil,
		IsPersonal:  true,
		CreatedBy:   user.ID(),
	})
	if err != nil {
		// Log error but don't fail registration
		// In production, this should be handled in a transaction or retry mechanism
	}

	// Generate token for the new user
	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate token")
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate refresh token")
	}

	return &RegisterOutput{
		SetCookie: []http.Cookie{
			*createAuthCookie(accessTokenCookie, token, accessTokenMaxAge),
			*createAuthCookie(refreshTokenCookie, refreshToken, refreshTokenMaxAge),
		},
		Body: struct {
			Token        string `json:"token"`
			RefreshToken string `json:"refresh_token"`
		}{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) login(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	user, err := h.svc.Authenticate(ctx, input.Body.Email, input.Body.Password)
	if err != nil {
		return nil, huma.Error401Unauthorized("invalid credentials")
	}

	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate token")
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate refresh token")
	}

	// Create session if session service is configured
	if h.sessionSvc != nil {
		ipAddress := getClientIPFromHeaders(input.XForwardedFor, input.XRealIP)
		_, _ = h.sessionSvc.Create(ctx, user.ID(), refreshToken, input.UserAgent, ipAddress)
	}

	return &LoginOutput{
		SetCookie: []http.Cookie{
			*createAuthCookie(accessTokenCookie, token, accessTokenMaxAge),
			*createAuthCookie(refreshTokenCookie, refreshToken, refreshTokenMaxAge),
		},
		Body: struct {
			Token        string `json:"token"`
			RefreshToken string `json:"refresh_token"`
		}{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) refreshToken(ctx context.Context, input *RefreshTokenInput) (*RefreshTokenOutput, error) {
	userID, err := h.jwtService.ValidateRefreshToken(input.Body.RefreshToken)
	if err != nil {
		if err == jwt.ErrExpiredToken {
			return nil, huma.Error401Unauthorized("refresh token has expired")
		}
		return nil, huma.Error401Unauthorized("invalid refresh token")
	}

	// Validate session exists (if session service is configured)
	var currentSession *session.Session
	if h.sessionSvc != nil {
		tokenHash := session.HashToken(input.Body.RefreshToken)
		currentSession, err = h.sessionSvc.FindByTokenHash(ctx, tokenHash)
		if err != nil {
			return nil, huma.Error401Unauthorized("session has been revoked")
		}
	}

	user, err := h.svc.GetByID(ctx, userID)
	if err != nil {
		return nil, huma.Error401Unauthorized("user not found")
	}

	if !user.IsActive() {
		return nil, huma.Error401Unauthorized("user is deactivated")
	}

	token, err := h.jwtService.GenerateToken(user.ID(), user.Email(), user.FullName(), user.IsSuperuser())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate token")
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID())
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to generate refresh token")
	}

	// Update session with new token
	if h.sessionSvc != nil && currentSession != nil {
		_ = h.sessionSvc.UpdateActivity(ctx, currentSession.ID(), refreshToken)
	}

	return &RefreshTokenOutput{
		SetCookie: []http.Cookie{
			*createAuthCookie(accessTokenCookie, token, accessTokenMaxAge),
			*createAuthCookie(refreshTokenCookie, refreshToken, refreshTokenMaxAge),
		},
		Body: RefreshTokenResponse{
			Token:        token,
			RefreshToken: refreshToken,
		},
	}, nil
}

func (h *Handler) logout(ctx context.Context, input *struct{}) (*LogoutOutput, error) {
	return &LogoutOutput{
		SetCookie: []http.Cookie{
			*clearAuthCookie(accessTokenCookie),
			*clearAuthCookie(refreshTokenCookie),
		},
	}, nil
}

func (h *Handler) getMe(ctx context.Context, input *struct{}) (*GetMeOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	user, err := h.svc.GetByID(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error404NotFound("user not found")
	}

	return &GetMeOutput{
		Body: UserResponse{
			ID:         user.ID(),
			Email:      user.Email(),
			FullName:   user.FullName(),
			DateFormat: user.DateFormat(),
			Language:   user.Language(),
			Theme:      user.Theme(),
			AvatarURL:  generateAvatarURL(user.AvatarPath()),
		},
	}, nil
}

func (h *Handler) getMyWorkspaces(ctx context.Context, input *struct{}) (*GetMyWorkspacesOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	workspaces, err := h.workspaceSvc.GetUserWorkspaces(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to get workspaces")
	}

	result := make([]UserWorkspaceSummary, len(workspaces))
	for i, ws := range workspaces {
		result[i] = UserWorkspaceSummary{
			ID:          ws.ID(),
			Name:        ws.Name(),
			Slug:        ws.Slug(),
			Description: ws.Description(),
			IsPersonal:  ws.IsPersonal(),
			Role:        ws.Role,
		}
	}

	return &GetMyWorkspacesOutput{
		Body: result,
	}, nil
}

func (h *Handler) updateMe(ctx context.Context, input *UpdateMeInput) (*UpdateMeOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	var user *User
	var err error

	// Update email if provided
	if input.Body.Email != "" {
		user, err = h.svc.UpdateEmail(ctx, authUser.ID, input.Body.Email)
		if err != nil {
			if shared.IsAlreadyExists(err) {
				return nil, huma.Error409Conflict("email is already taken")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}
	}

	// Update full name if provided
	if input.Body.FullName != "" {
		user, err = h.svc.UpdateProfile(ctx, authUser.ID, UpdateProfileInput{
			FullName: input.Body.FullName,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}
	}

	// If nothing was updated, fetch current user
	if user == nil {
		user, err = h.svc.GetByID(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}
	}

	return &UpdateMeOutput{
		Body: UserResponse{
			ID:         user.ID(),
			Email:      user.Email(),
			FullName:   user.FullName(),
			DateFormat: user.DateFormat(),
			Language:   user.Language(),
			Theme:      user.Theme(),
			AvatarURL:  generateAvatarURL(user.AvatarPath()),
		},
	}, nil
}

func (h *Handler) updatePassword(ctx context.Context, input *UpdatePasswordInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	err := h.svc.UpdatePassword(ctx, authUser.ID, input.Body.CurrentPassword, input.Body.NewPassword)
	if err != nil {
		if err == ErrInvalidPassword {
			return nil, huma.Error400BadRequest("current password is incorrect")
		}
		return nil, huma.Error400BadRequest(err.Error())
	}

	return nil, nil
}

func (h *Handler) updatePreferences(ctx context.Context, input *UpdatePrefsRequest) (*UpdatePrefsResponse, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	user, err := h.svc.UpdatePreferences(ctx, authUser.ID, UpdatePreferencesInput{
		DateFormat: input.Body.DateFormat,
		Language:   input.Body.Language,
		Theme:      input.Body.Theme,
	})
	if err != nil {
		return nil, huma.Error400BadRequest(err.Error())
	}

	return &UpdatePrefsResponse{
		Body: UserResponse{
			ID:         user.ID(),
			Email:      user.Email(),
			FullName:   user.FullName(),
			DateFormat: user.DateFormat(),
			Language:   user.Language(),
			Theme:      user.Theme(),
			AvatarURL:  generateAvatarURL(user.AvatarPath()),
		},
	}, nil
}

// Admin handlers

func (h *Handler) listUsers(ctx context.Context, input *ListUsersInput) (*ListUsersOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	pagination := shared.Pagination{
		Page:     input.Page,
		PageSize: input.PageSize,
	}
	if pagination.Page == 0 {
		pagination.Page = 1
	}
	if pagination.PageSize == 0 {
		pagination.PageSize = 20
	}

	result, err := h.svc.List(ctx, pagination)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to list users")
	}

	users := make([]UserAdminResponse, len(result.Items))
	for i, u := range result.Items {
		users[i] = UserAdminResponse{
			ID:          u.ID(),
			Email:       u.Email(),
			FullName:    u.FullName(),
			IsActive:    u.IsActive(),
			IsSuperuser: u.IsSuperuser(),
			DateFormat:  u.DateFormat(),
			Language:    u.Language(),
			Theme:       u.Theme(),
			CreatedAt:   u.CreatedAt(),
			UpdatedAt:   u.UpdatedAt(),
		}
	}

	return &ListUsersOutput{
		Body: ListUsersResponse{
			Users:      users,
			Total:      result.Total,
			Page:       result.Page,
			PageSize:   result.PageSize,
			TotalPages: result.TotalPages,
		},
	}, nil
}

func (h *Handler) getUserByID(ctx context.Context, input *GetUserByIDInput) (*GetUserByIDOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	user, err := h.svc.GetByID(ctx, input.ID)
	if err != nil {
		if err == ErrUserNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		return nil, huma.Error500InternalServerError("failed to get user")
	}

	return &GetUserByIDOutput{
		Body: UserAdminResponse{
			ID:          user.ID(),
			Email:       user.Email(),
			FullName:    user.FullName(),
			IsActive:    user.IsActive(),
			IsSuperuser: user.IsSuperuser(),
			DateFormat:  user.DateFormat(),
			Language:    user.Language(),
			Theme:       user.Theme(),
			CreatedAt:   user.CreatedAt(),
			UpdatedAt:   user.UpdatedAt(),
		},
	}, nil
}

func (h *Handler) deactivateUser(ctx context.Context, input *DeactivateUserInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	// Prevent deactivating yourself
	if authUser.ID == input.ID {
		return nil, huma.Error400BadRequest("cannot deactivate yourself")
	}

	err := h.svc.Deactivate(ctx, input.ID)
	if err != nil {
		if err == ErrUserNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		return nil, huma.Error500InternalServerError("failed to deactivate user")
	}

	return nil, nil
}

func (h *Handler) activateUser(ctx context.Context, input *ActivateUserInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden("superuser access required")
	}

	err := h.svc.Activate(ctx, input.ID)
	if err != nil {
		if err == ErrUserNotFound {
			return nil, huma.Error404NotFound("user not found")
		}
		return nil, huma.Error500InternalServerError("failed to activate user")
	}

	return nil, nil
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
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// uploadAvatar handles POST /users/me/avatar
func (h *Handler) uploadAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
		return
	}

	// Check if storage is configured
	if h.avatarStorage == nil || h.imageProcessor == nil {
		http.Error(w, "avatar upload not configured", http.StatusServiceUnavailable)
		return
	}

	// Parse multipart form (2MB max)
	if err := r.ParseMultipartForm(MaxAvatarSize); err != nil {
		http.Error(w, "file too large or invalid form data", http.StatusBadRequest)
		return
	}

	// Get file from form
	file, header, err := r.FormFile("avatar")
	if err != nil {
		http.Error(w, "avatar file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > MaxAvatarSize {
		http.Error(w, "file too large: maximum size is 2MB", http.StatusRequestEntityTooLarge)
		return
	}

	// Validate MIME type
	contentType := header.Header.Get("Content-Type")
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
	defer os.Remove(tempPath)

	// Copy uploaded data to temp file
	if _, err := io.Copy(tempFile, file); err != nil {
		tempFile.Close()
		http.Error(w, "failed to process file", http.StatusInternalServerError)
		return
	}
	tempFile.Close()

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
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/webp":
			ext = ".webp"
		}
	}
	thumbnailPath := tempPath + "_thumb" + ext
	defer os.Remove(thumbnailPath)

	if err := h.imageProcessor.GenerateThumbnail(ctx, tempPath, thumbnailPath, AvatarThumbnailSize, AvatarThumbnailSize); err != nil {
		http.Error(w, "failed to process image", http.StatusInternalServerError)
		return
	}

	// Save thumbnail to storage
	thumbReader, err := os.Open(thumbnailPath)
	if err != nil {
		http.Error(w, "failed to process image", http.StatusInternalServerError)
		return
	}
	defer thumbReader.Close()

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

	// Return updated user
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"id":"%s","email":"%s","full_name":"%s","date_format":"%s","language":"%s","theme":"%s","avatar_url":"/users/me/avatar"}`,
		user.ID(), user.Email(), user.FullName(), user.DateFormat(), user.Language(), user.Theme())
}

// serveAvatar handles GET /users/me/avatar
func (h *Handler) serveAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		http.Error(w, "not authenticated", http.StatusUnauthorized)
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
		http.Error(w, "user not found", http.StatusNotFound)
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
	defer reader.Close()

	// Determine content type from path extension
	ext := strings.ToLower(filepath.Ext(*avatarPath))
	contentType := "application/octet-stream"
	switch ext {
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".png":
		contentType = "image/png"
	case ".webp":
		contentType = "image/webp"
	}

	// Set headers
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

	// Serve file
	io.Copy(w, reader)
}

// deleteAvatar handles DELETE /users/me/avatar
func (h *Handler) deleteAvatar(ctx context.Context, input *struct{}) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	// Check if storage is configured
	if h.avatarStorage == nil {
		return nil, huma.Error503ServiceUnavailable("avatar service not configured")
	}

	// Get user to find current avatar path
	user, err := h.svc.GetByID(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error404NotFound("user not found")
	}

	avatarPath := user.AvatarPath()
	if avatarPath == nil || *avatarPath == "" {
		// No avatar to delete, return success
		return nil, nil
	}

	// Delete from storage
	if err := h.avatarStorage.DeleteAvatar(ctx, *avatarPath); err != nil {
		// Log but don't fail - file might already be gone
	}

	// Update user to remove avatar path
	_, err = h.svc.UpdateAvatar(ctx, authUser.ID, nil)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to update user")
	}

	return nil, nil
}

// Request/Response types

type RegisterInput struct {
	Body struct {
		Email    string `json:"email" required:"true" format:"email"`
		FullName string `json:"full_name" required:"true" minLength:"1"`
		Password string `json:"password" required:"true" minLength:"8"`
	}
}

type RegisterOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

type LoginInput struct {
	UserAgent      string `header:"User-Agent"`
	XForwardedFor  string `header:"X-Forwarded-For"`
	XRealIP        string `header:"X-Real-IP"`
	Body struct {
		Email    string `json:"email" required:"true" format:"email"`
		Password string `json:"password" required:"true"`
	}
}

type LoginOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
}

type RefreshTokenInput struct {
	Body struct {
		RefreshToken string `json:"refresh_token,omitempty"`
	}
}

type RefreshTokenOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
	Body      RefreshTokenResponse
}

type RefreshTokenResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
}

type LogoutOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
}

type UserResponse struct {
	ID         uuid.UUID `json:"id"`
	Email      string    `json:"email"`
	FullName   string    `json:"full_name"`
	DateFormat string    `json:"date_format"`
	Language   string    `json:"language"`
	Theme      string    `json:"theme"`
	AvatarURL  *string   `json:"avatar_url,omitempty"`
}

// generateAvatarURL returns the avatar URL if the user has an avatar.
func generateAvatarURL(avatarPath *string) *string {
	if avatarPath == nil || *avatarPath == "" {
		return nil
	}
	url := "/users/me/avatar"
	return &url
}

// getClientIPFromHeaders extracts the client IP address from headers.
func getClientIPFromHeaders(xForwardedFor, xRealIP string) string {
	// Check X-Forwarded-For first (for proxies)
	if xForwardedFor != "" {
		parts := strings.Split(xForwardedFor, ",")
		return strings.TrimSpace(parts[0])
	}
	// Check X-Real-IP
	if xRealIP != "" {
		return xRealIP
	}
	return ""
}

type GetMeOutput struct {
	Body UserResponse
}

type UserWorkspaceSummary struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description *string   `json:"description"`
	IsPersonal  bool      `json:"is_personal"`
	Role        string    `json:"role"`
}

type GetMyWorkspacesOutput struct {
	Body []UserWorkspaceSummary
}

type UpdateMeInput struct {
	Body struct {
		FullName string `json:"full_name,omitempty" minLength:"1"`
		Email    string `json:"email,omitempty" format:"email"`
	}
}

type UpdateMeOutput struct {
	Body UserResponse
}

type UpdatePasswordInput struct {
	Body struct {
		CurrentPassword string `json:"current_password" required:"true"`
		NewPassword     string `json:"new_password" required:"true" minLength:"8"`
	}
}

type UpdatePrefsRequestBody struct {
	DateFormat string `json:"date_format,omitempty"`
	Language   string `json:"language,omitempty"`
	Theme      string `json:"theme,omitempty"`
}

type UpdatePrefsRequest struct {
	Body UpdatePrefsRequestBody
}

type UpdatePrefsResponse struct {
	Body UserResponse
}

// Admin request/response types

type ListUsersInput struct {
	Page     int `query:"page" minimum:"1" default:"1"`
	PageSize int `query:"page_size" minimum:"1" maximum:"100" default:"20"`
}

type ListUsersOutput struct {
	Body ListUsersResponse
}

type ListUsersResponse struct {
	Users      []UserAdminResponse `json:"users"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"page_size"`
	TotalPages int                 `json:"total_pages"`
}

type UserAdminResponse struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	FullName    string    `json:"full_name"`
	IsActive    bool      `json:"is_active"`
	IsSuperuser bool      `json:"is_superuser"`
	DateFormat  string    `json:"date_format"`
	Language    string    `json:"language"`
	Theme       string    `json:"theme"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type GetUserByIDInput struct {
	ID uuid.UUID `path:"id" format:"uuid"`
}

type GetUserByIDOutput struct {
	Body UserAdminResponse
}

type DeactivateUserInput struct {
	ID uuid.UUID `path:"id" format:"uuid"`
}

type ActivateUserInput struct {
	ID uuid.UUID `path:"id" format:"uuid"`
}

// Legacy functions for backward compatibility - deprecated

// RegisterPublicRoutes registers public user routes (no auth required).
// Deprecated: Use Handler.RegisterPublicRoutes instead.
func RegisterPublicRoutes(api huma.API, svc ServiceInterface) {
	// This is a legacy function that doesn't support JWT
	// Applications should migrate to using Handler with JWT service
	huma.Post(api, "/auth/register", func(ctx context.Context, input *RegisterInput) (*RegisterOutput, error) {
		_, err := svc.Create(ctx, CreateUserInput{
			Email:    input.Body.Email,
			FullName: input.Body.FullName,
			Password: input.Body.Password,
		})
		if err != nil {
			if shared.IsAlreadyExists(err) {
				return nil, huma.Error409Conflict("email is already taken")
			}
			if shared.IsInvalidInput(err) {
				return nil, huma.Error400BadRequest(err.Error())
			}
			return nil, huma.Error500InternalServerError("failed to create user")
		}

		// This legacy endpoint doesn't have JWT service, so it returns empty tokens
		// Applications should migrate to using Handler with JWT service
		return &RegisterOutput{
			Body: struct {
				Token        string `json:"token"`
				RefreshToken string `json:"refresh_token"`
			}{
				Token:        "",
				RefreshToken: "",
			},
		}, nil
	})

	huma.Post(api, "/auth/login", func(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
		_, err := svc.Authenticate(ctx, input.Body.Email, input.Body.Password)
		if err != nil {
			return nil, huma.Error401Unauthorized("invalid credentials")
		}
		return nil, huma.Error500InternalServerError("JWT service not configured - use Handler with JWT service")
	})
}

// RegisterProtectedRoutes registers protected user routes (auth required).
// Deprecated: Use Handler.RegisterProtectedRoutes instead.
func RegisterProtectedRoutes(api huma.API, svc ServiceInterface) {
	huma.Get(api, "/users/me", func(ctx context.Context, input *struct{}) (*GetMeOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		user, err := svc.GetByID(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error404NotFound("user not found")
		}

		return &GetMeOutput{
			Body: UserResponse{
				ID:         user.ID(),
				Email:      user.Email(),
				FullName:   user.FullName(),
				DateFormat: user.DateFormat(),
				Language:   user.Language(),
				Theme:      user.Theme(),
			},
		}, nil
	})

	huma.Patch(api, "/users/me", func(ctx context.Context, input *UpdateMeInput) (*UpdateMeOutput, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		user, err := svc.UpdateProfile(ctx, authUser.ID, UpdateProfileInput{
			FullName: input.Body.FullName,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateMeOutput{
			Body: UserResponse{
				ID:         user.ID(),
				Email:      user.Email(),
				FullName:   user.FullName(),
				DateFormat: user.DateFormat(),
				Language:   user.Language(),
				Theme:      user.Theme(),
			},
		}, nil
	})

	huma.Patch(api, "/users/me/password", func(ctx context.Context, input *UpdatePasswordInput) (*struct{}, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		err := svc.UpdatePassword(ctx, authUser.ID, input.Body.CurrentPassword, input.Body.NewPassword)
		if err != nil {
			if err == ErrInvalidPassword {
				return nil, huma.Error400BadRequest("current password is incorrect")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})

	huma.Patch(api, "/users/me/preferences", func(ctx context.Context, input *UpdatePrefsRequest) (*UpdatePrefsResponse, error) {
		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("not authenticated")
		}

		user, err := svc.UpdatePreferences(ctx, authUser.ID, UpdatePreferencesInput{
			DateFormat: input.Body.DateFormat,
			Language:   input.Body.Language,
			Theme:      input.Body.Theme,
		})
		if err != nil {
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdatePrefsResponse{
			Body: UserResponse{
				ID:         user.ID(),
				Email:      user.Email(),
				FullName:   user.FullName(),
				DateFormat: user.DateFormat(),
				Language:   user.Language(),
				Theme:      user.Theme(),
			},
		}, nil
	})
}
