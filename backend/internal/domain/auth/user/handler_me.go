package user

import (
	"context"
	"errors"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

func (h *Handler) getMe(ctx context.Context, input *struct{}) (*GetMeOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}

	user, err := h.svc.GetByID(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error404NotFound(msgUserNotFound)
	}

	return &GetMeOutput{
		Body: newUserResponse(user),
	}, nil
}

func (h *Handler) getMyWorkspaces(ctx context.Context, input *struct{}) (*GetMyWorkspacesOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
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
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}

	var user *User
	var err error

	// Update email if provided
	if input.Body.Email != "" {
		user, err = h.svc.UpdateEmail(ctx, authUser.ID, input.Body.Email)
		if err != nil {
			if shared.IsAlreadyExists(err) {
				return nil, huma.Error409Conflict(msgEmailAlreadyTaken)
			}
			return nil, appMiddleware.MapDomainError(err)
		}
	}

	// Update full name if provided
	if input.Body.FullName != "" {
		user, err = h.svc.UpdateProfile(ctx, authUser.ID, UpdateProfileInput{
			FullName: input.Body.FullName,
		})
		if err != nil {
			return nil, appMiddleware.MapDomainError(err)
		}
	}

	// If nothing was updated, fetch current user
	if user == nil {
		user, err = h.svc.GetByID(ctx, authUser.ID)
		if err != nil {
			return nil, huma.Error404NotFound(msgUserNotFound)
		}
	}

	return &UpdateMeOutput{
		Body: newUserResponse(user),
	}, nil
}

func (h *Handler) updatePassword(ctx context.Context, input *UpdatePasswordInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}

	err := h.svc.UpdatePassword(ctx, authUser.ID, input.Body.CurrentPassword, input.Body.NewPassword)
	if err != nil {
		if errors.Is(err, ErrInvalidPassword) {
			return nil, huma.Error400BadRequest("current password is incorrect")
		}
		return nil, appMiddleware.MapDomainError(err)
	}

	return nil, nil
}

func (h *Handler) updatePreferences(ctx context.Context, input *UpdatePrefsRequest) (*UpdatePrefsResponse, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}

	user, err := h.svc.UpdatePreferences(ctx, authUser.ID, UpdatePreferencesInput{
		DateFormat:              input.Body.DateFormat,
		Language:                input.Body.Language,
		Theme:                   input.Body.Theme,
		TimeFormat:              input.Body.TimeFormat,
		ThousandSeparator:       input.Body.ThousandSeparator,
		DecimalSeparator:        input.Body.DecimalSeparator,
		NotificationPreferences: input.Body.NotificationPreferences,
	})
	if err != nil {
		return nil, appMiddleware.MapDomainError(err)
	}

	return &UpdatePrefsResponse{
		Body: newUserResponse(user),
	}, nil
}

// generateAvatarURL returns the avatar URL if the user has an avatar.
func generateAvatarURL(avatarPath *string) *string {
	if avatarPath == nil || *avatarPath == "" {
		return nil
	}
	url := "/api/users/me/avatar"
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
