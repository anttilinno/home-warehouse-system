package session

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// Handler holds dependencies for session HTTP handlers.
type Handler struct {
	svc ServiceInterface
}

// NewHandler creates a new session handler.
func NewHandler(svc ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers session routes (protected).
func (h *Handler) RegisterRoutes(api huma.API) {
	huma.Get(api, "/users/me/sessions", h.listSessions)
	huma.Delete(api, "/users/me/sessions/{id}", h.revokeSession)
	huma.Delete(api, "/users/me/sessions", h.revokeAllOtherSessions)
}

// SessionResponse represents a session in API responses.
type SessionResponse struct {
	ID           uuid.UUID `json:"id"`
	DeviceInfo   string    `json:"device_info"`
	IPAddress    string    `json:"ip_address,omitempty"`
	LastActiveAt time.Time `json:"last_active_at"`
	CreatedAt    time.Time `json:"created_at"`
	IsCurrent    bool      `json:"is_current"`
}

type ListSessionsOutput struct {
	Body []SessionResponse
}

func (h *Handler) listSessions(ctx context.Context, input *struct{}) (*ListSessionsOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	// Get current session ID from context (set by auth middleware)
	currentSessionID, _ := appMiddleware.GetCurrentSessionID(ctx)

	sessions, err := h.svc.FindByUserID(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to get sessions")
	}

	result := make([]SessionResponse, len(sessions))
	for i, s := range sessions {
		result[i] = SessionResponse{
			ID:           s.ID(),
			DeviceInfo:   s.DeviceInfo(),
			IPAddress:    s.IPAddress(),
			LastActiveAt: s.LastActiveAt(),
			CreatedAt:    s.CreatedAt(),
			IsCurrent:    s.ID() == currentSessionID,
		}
	}

	return &ListSessionsOutput{Body: result}, nil
}

type RevokeSessionInput struct {
	ID uuid.UUID `path:"id" format:"uuid"`
}

func (h *Handler) revokeSession(ctx context.Context, input *RevokeSessionInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	// Prevent revoking current session
	currentSessionID, _ := appMiddleware.GetCurrentSessionID(ctx)
	if input.ID == currentSessionID {
		return nil, huma.Error400BadRequest("cannot revoke current session")
	}

	if err := h.svc.Revoke(ctx, authUser.ID, input.ID); err != nil {
		return nil, huma.Error500InternalServerError("failed to revoke session")
	}

	return nil, nil
}

func (h *Handler) revokeAllOtherSessions(ctx context.Context, input *struct{}) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized("not authenticated")
	}

	currentSessionID, ok := appMiddleware.GetCurrentSessionID(ctx)
	if !ok {
		return nil, huma.Error400BadRequest("current session not found")
	}

	if err := h.svc.RevokeAllExcept(ctx, authUser.ID, currentSessionID); err != nil {
		return nil, huma.Error500InternalServerError("failed to revoke sessions")
	}

	return nil, nil
}
