package user

import (
	"context"
	"errors"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Admin handlers

func (h *Handler) listUsers(ctx context.Context, input *ListUsersInput) (*ListUsersOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden(msgSuperuserAccessRequired)
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
			ID:                      u.ID(),
			Email:                   u.Email(),
			FullName:                u.FullName(),
			HasPassword:             u.HasPassword(),
			IsActive:                u.IsActive(),
			IsSuperuser:             u.IsSuperuser(),
			DateFormat:              u.DateFormat(),
			TimeFormat:              u.TimeFormat(),
			ThousandSeparator:       u.ThousandSeparator(),
			DecimalSeparator:        u.DecimalSeparator(),
			Language:                u.Language(),
			Theme:                   u.Theme(),
			NotificationPreferences: u.NotificationPreferences(),
			CreatedAt:               u.CreatedAt(),
			UpdatedAt:               u.UpdatedAt(),
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
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden(msgSuperuserAccessRequired)
	}

	user, err := h.svc.GetByID(ctx, input.ID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, huma.Error404NotFound(msgUserNotFound)
		}
		return nil, huma.Error500InternalServerError("failed to get user")
	}

	return &GetUserByIDOutput{
		Body: UserAdminResponse{
			ID:                      user.ID(),
			Email:                   user.Email(),
			FullName:                user.FullName(),
			HasPassword:             user.HasPassword(),
			IsActive:                user.IsActive(),
			IsSuperuser:             user.IsSuperuser(),
			DateFormat:              user.DateFormat(),
			TimeFormat:              user.TimeFormat(),
			ThousandSeparator:       user.ThousandSeparator(),
			DecimalSeparator:        user.DecimalSeparator(),
			Language:                user.Language(),
			Theme:                   user.Theme(),
			NotificationPreferences: user.NotificationPreferences(),
			CreatedAt:               user.CreatedAt(),
			UpdatedAt:               user.UpdatedAt(),
		},
	}, nil
}

func (h *Handler) deactivateUser(ctx context.Context, input *DeactivateUserInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden(msgSuperuserAccessRequired)
	}

	// Prevent deactivating yourself
	if authUser.ID == input.ID {
		return nil, huma.Error400BadRequest("cannot deactivate yourself")
	}

	err := h.svc.Deactivate(ctx, input.ID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, huma.Error404NotFound(msgUserNotFound)
		}
		return nil, huma.Error500InternalServerError("failed to deactivate user")
	}

	return nil, nil
}

func (h *Handler) activateUser(ctx context.Context, input *ActivateUserInput) (*struct{}, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}
	if !authUser.IsSuperuser {
		return nil, huma.Error403Forbidden(msgSuperuserAccessRequired)
	}

	err := h.svc.Activate(ctx, input.ID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, huma.Error404NotFound(msgUserNotFound)
		}
		return nil, huma.Error500InternalServerError("failed to activate user")
	}

	return nil, nil
}
