package member

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

const (
	msgWorkspaceContextRequired = "workspace context required"
	msgMemberNotFound           = "member not found"
	routeMemberByUserID         = "/members/{user_id}"
)

// RegisterRoutes registers member routes.
//
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	huma.Get(api, "/members", listMembers(svc))
	huma.Get(api, routeMemberByUserID, getMember(svc))
	huma.Post(api, "/members", addMember(svc))
	huma.Patch(api, routeMemberByUserID, updateMemberRole(svc))
	huma.Delete(api, routeMemberByUserID, removeMember(svc))
}

// listMembers lists the workspace members.
func listMembers(svc ServiceInterface) func(context.Context, *struct{}) (*ListMembersOutput, error) {
	return func(ctx context.Context, input *struct{}) (*ListMembersOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
	}
}

// getMember returns a single member by workspace + user ID.
func getMember(svc ServiceInterface) func(context.Context, *GetMemberInput) (*GetMemberOutput, error) {
	return func(ctx context.Context, input *GetMemberInput) (*GetMemberOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		member, err := svc.GetMember(ctx, workspaceID, input.UserID)
		if err != nil || member == nil {
			return nil, huma.Error404NotFound(msgMemberNotFound)
		}

		return &GetMemberOutput{
			Body: toMemberResponse(member),
		}, nil
	}
}

// addMember adds a member to the workspace.
func addMember(svc ServiceInterface) func(context.Context, *AddMemberRequest) (*AddMemberOutput, error) {
	return func(ctx context.Context, input *AddMemberRequest) (*AddMemberOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		member, err := svc.AddMember(ctx, AddMemberInput{
			WorkspaceID: workspaceID,
			Email:       input.Body.Email,
			UserID:      input.Body.UserID,
			Role:        input.Body.Role,
			InvitedBy:   &authUser.ID,
		})
		if err != nil {
			if errors.Is(err, ErrUserNotRegistered) {
				return nil, huma.Error404NotFound("no registered user with that email")
			}
			if errors.Is(err, ErrAlreadyMember) {
				return nil, huma.Error400BadRequest("user is already a member of this workspace")
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		return &AddMemberOutput{
			Body: toMemberResponse(member),
		}, nil
	}
}

// updateMemberRole updates a member's role.
func updateMemberRole(svc ServiceInterface) func(context.Context, *UpdateMemberRoleRequest) (*UpdateMemberRoleOutput, error) {
	return func(ctx context.Context, input *UpdateMemberRoleRequest) (*UpdateMemberRoleOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
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
			if errors.Is(err, ErrCannotChangeOwnRole) {
				return nil, huma.Error400BadRequest("cannot change your own role")
			}
			if errors.Is(err, ErrMemberNotFound) {
				return nil, huma.Error404NotFound(msgMemberNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		return &UpdateMemberRoleOutput{
			Body: toMemberResponse(member),
		}, nil
	}
}

// removeMember removes a member from the workspace.
func removeMember(svc ServiceInterface) func(context.Context, *GetMemberInput) (*struct{}, error) {
	return func(ctx context.Context, input *GetMemberInput) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		err := svc.RemoveMember(ctx, RemoveMemberInput{
			WorkspaceID: workspaceID,
			UserID:      input.UserID,
		})
		if err != nil {
			if errors.Is(err, ErrCannotRemoveOwner) {
				return nil, huma.Error400BadRequest("cannot remove the last owner from workspace")
			}
			if errors.Is(err, ErrMemberNotFound) {
				return nil, huma.Error404NotFound(msgMemberNotFound)
			}
			return nil, appMiddleware.MapDomainError(err)
		}

		return nil, nil
	}
}

func toMemberResponse(m *Member) MemberResponse {
	return MemberResponse{
		ID:          m.ID(),
		WorkspaceID: m.WorkspaceID(),
		UserID:      m.UserID(),
		Role:        string(m.Role()),
		InvitedBy:   m.InvitedBy(),
		Email:       m.Email(),
		FullName:    m.FullName(),
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
		// Email is the primary parity add path: the email of an existing
		// registered user to add. UserID remains accepted as an optional
		// direct path (legacy/internal callers); when both are present Email
		// wins. Exactly one must be supplied.
		Email  string    `json:"email,omitempty" format:"email" doc:"Email of an existing registered user to add as member"`
		UserID uuid.UUID `json:"user_id,omitempty" doc:"ID of an existing user to add (alternative to email)"`
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
	Email       string     `json:"email,omitempty" doc:"Email of the member (list path only)"`
	FullName    string     `json:"full_name,omitempty" doc:"Full name of the member (list path only)"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
