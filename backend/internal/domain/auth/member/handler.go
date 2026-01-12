package member

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// RegisterRoutes registers member routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// List workspace members
	huma.Get(api, "/members", func(ctx context.Context, input *struct{}) (*ListMembersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		members, err := svc.ListWorkspaceMembers(ctx, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list members")
		}

		items := make([]MemberResponse, len(members))
		for i, m := range members {
			items[i] = toMemberResponse(m)
		}

		return &ListMembersOutput{
			Body: MemberListResponse{Items: items},
		}, nil
	})

	// Get member (workspace + user ID)
	huma.Get(api, "/members/{user_id}", func(ctx context.Context, input *GetMemberInput) (*GetMemberOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		member, err := svc.GetMember(ctx, workspaceID, input.UserID)
		if err != nil || member == nil {
			return nil, huma.Error404NotFound("member not found")
		}

		return &GetMemberOutput{
			Body: toMemberResponse(member),
		}, nil
	})

	// Add member to workspace
	huma.Post(api, "/members", func(ctx context.Context, input *AddMemberRequest) (*AddMemberOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		member, err := svc.AddMember(ctx, AddMemberInput{
			WorkspaceID: workspaceID,
			UserID:      input.Body.UserID,
			Role:        input.Body.Role,
			InvitedBy:   &authUser.ID,
		})
		if err != nil {
			if err == ErrAlreadyMember {
				return nil, huma.Error400BadRequest("user is already a member of this workspace")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &AddMemberOutput{
			Body: toMemberResponse(member),
		}, nil
	})

	// Update member role
	huma.Patch(api, "/members/{user_id}", func(ctx context.Context, input *UpdateMemberRoleRequest) (*UpdateMemberRoleOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		member, err := svc.UpdateRole(ctx, UpdateRoleInput{
			WorkspaceID: workspaceID,
			UserID:      input.UserID,
			NewRole:     input.Body.Role,
			UpdaterID:   authUser.ID,
		})
		if err != nil {
			if err == ErrCannotChangeOwnRole {
				return nil, huma.Error400BadRequest("cannot change your own role")
			}
			if err == ErrMemberNotFound {
				return nil, huma.Error404NotFound("member not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return &UpdateMemberRoleOutput{
			Body: toMemberResponse(member),
		}, nil
	})

	// Remove member from workspace
	huma.Delete(api, "/members/{user_id}", func(ctx context.Context, input *GetMemberInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		err := svc.RemoveMember(ctx, RemoveMemberInput{
			WorkspaceID: workspaceID,
			UserID:      input.UserID,
		})
		if err != nil {
			if err == ErrCannotRemoveOwner {
				return nil, huma.Error400BadRequest("cannot remove the last owner from workspace")
			}
			if err == ErrMemberNotFound {
				return nil, huma.Error404NotFound("member not found")
			}
			return nil, huma.Error400BadRequest(err.Error())
		}

		return nil, nil
	})
}

func toMemberResponse(m *Member) MemberResponse {
	return MemberResponse{
		ID:          m.ID(),
		WorkspaceID: m.WorkspaceID(),
		UserID:      m.UserID(),
		Role:        string(m.Role()),
		InvitedBy:   m.InvitedBy(),
		CreatedAt:   m.CreatedAt(),
		UpdatedAt:   m.UpdatedAt(),
	}
}

// Request/Response types

type ListMembersOutput struct {
	Body MemberListResponse
}

type MemberListResponse struct {
	Items []MemberResponse `json:"items"`
}

type GetMemberInput struct {
	UserID uuid.UUID `path:"user_id"`
}

type GetMemberOutput struct {
	Body MemberResponse
}

type AddMemberRequest struct {
	Body struct {
		UserID uuid.UUID `json:"user_id" doc:"ID of user to add as member"`
		Role   Role      `json:"role" enum:"owner,admin,member,viewer" doc:"Role to assign to the member"`
	}
}

type AddMemberOutput struct {
	Body MemberResponse
}

type UpdateMemberRoleRequest struct {
	UserID uuid.UUID `path:"user_id"`
	Body   struct {
		Role Role `json:"role" enum:"owner,admin,member,viewer" doc:"New role for the member"`
	}
}

type UpdateMemberRoleOutput struct {
	Body MemberResponse
}

type MemberResponse struct {
	ID          uuid.UUID  `json:"id"`
	WorkspaceID uuid.UUID  `json:"workspace_id"`
	UserID      uuid.UUID  `json:"user_id"`
	Role        string     `json:"role" enum:"owner,admin,member,viewer"`
	InvitedBy   *uuid.UUID `json:"invited_by,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
