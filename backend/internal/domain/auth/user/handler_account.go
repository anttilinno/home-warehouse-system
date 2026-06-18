package user

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// canDeleteMe handles GET /users/me/can-delete
func (h *Handler) canDeleteMe(ctx context.Context, input *struct{}) (*CanDeleteAccountOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}

	canDelete, blockingWorkspaces, err := h.svc.CanDelete(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to check account status")
	}

	// Convert domain types to DTOs
	workspaceDTOs := make([]BlockingWorkspaceDTO, len(blockingWorkspaces))
	for i, ws := range blockingWorkspaces {
		workspaceDTOs[i] = BlockingWorkspaceDTO{
			ID:   ws.ID,
			Name: ws.Name,
			Slug: ws.Slug,
		}
	}

	return &CanDeleteAccountOutput{
		Body: CanDeleteAccountResponse{
			CanDelete:          canDelete,
			BlockingWorkspaces: workspaceDTOs,
		},
	}, nil
}

// deleteMe handles DELETE /users/me
func (h *Handler) deleteMe(ctx context.Context, input *DeleteAccountInput) (*DeleteAccountOutput, error) {
	authUser, ok := appMiddleware.GetAuthUser(ctx)
	if !ok {
		return nil, huma.Error401Unauthorized(msgNotAuthenticated)
	}

	// Validate confirmation text (case-insensitive)
	if strings.ToUpper(input.Body.Confirmation) != "DELETE" {
		return nil, huma.Error400BadRequest("confirmation text must be 'DELETE'")
	}

	// Check if user can be deleted
	canDelete, blockingWorkspaces, err := h.svc.CanDelete(ctx, authUser.ID)
	if err != nil {
		return nil, huma.Error500InternalServerError("failed to check account status")
	}
	if !canDelete {
		// Return 409 with blocking workspace names
		names := make([]string, len(blockingWorkspaces))
		for i, ws := range blockingWorkspaces {
			names[i] = ws.Name
		}
		return nil, huma.Error409Conflict(fmt.Sprintf("cannot delete account while sole owner of workspaces: %s", strings.Join(names, ", ")))
	}

	// Delete avatar file if exists (before deleting user)
	user, err := h.svc.GetByID(ctx, authUser.ID)
	if err == nil && user.AvatarPath() != nil && *user.AvatarPath() != "" && h.avatarStorage != nil {
		_ = h.avatarStorage.DeleteAvatar(ctx, *user.AvatarPath())
	}

	// Delete user (CASCADE handles related data)
	if err := h.svc.Delete(ctx, authUser.ID); err != nil {
		return nil, huma.Error500InternalServerError("failed to delete account")
	}

	// Return response with cookie clearing
	return &DeleteAccountOutput{
		SetCookie: []http.Cookie{
			*clearAuthCookie(accessTokenCookie),
			*clearAuthCookie(refreshTokenCookie),
		},
	}, nil
}
