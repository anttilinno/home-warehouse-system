package user

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

const (
	// Route paths
	routeUsersMe       = "/users/me"
	routeUsersMeAvatar = "/users/me/avatar"

	// Error messages
	msgEmailAlreadyTaken          = "email is already taken"
	msgFailedGenerateToken        = "failed to generate token"
	msgFailedGenerateRefreshToken = "failed to generate refresh token"
	msgUserNotFound               = "user not found"
	msgNotAuthenticated           = "not authenticated"
	msgSuperuserAccessRequired    = "superuser access required"
)

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
		svc:          svc,
		jwtService:   jwtService,
		workspaceSvc: workspaceSvc,
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
	huma.Get(api, routeUsersMe, h.getMe)
	huma.Get(api, "/users/me/workspaces", h.getMyWorkspaces)
	huma.Get(api, "/users/me/can-delete", h.canDeleteMe)
	huma.Patch(api, routeUsersMe, h.updateMe)
	huma.Patch(api, "/users/me/password", h.updatePassword)
	huma.Patch(api, "/users/me/preferences", h.updatePreferences)
	huma.Delete(api, routeUsersMeAvatar, h.deleteAvatar)
	huma.Delete(api, routeUsersMe, h.deleteMe)
}

// RegisterAvatarRoutes registers avatar upload and serve routes on a Chi router.
// This must be called separately because multipart upload requires Chi routing.
func (h *Handler) RegisterAvatarRoutes(r chi.Router) {
	r.Post(routeUsersMeAvatar, h.uploadAvatar)
	r.Get(routeUsersMeAvatar, h.serveAvatar)
}

// RegisterAdminRoutes registers admin-only user routes (superuser required).
func (h *Handler) RegisterAdminRoutes(api huma.API) {
	huma.Get(api, "/users", h.listUsers)
	huma.Get(api, "/users/{id}", h.getUserByID)
	huma.Post(api, "/users/{id}/deactivate", h.deactivateUser)
	huma.Post(api, "/users/{id}/activate", h.activateUser)
}
