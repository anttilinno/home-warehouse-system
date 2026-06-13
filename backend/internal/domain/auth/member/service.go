package member

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// UserFinder resolves an email to an existing registered user's id. It is a
// narrow port over the user domain, injected to avoid coupling the member
// package to the full user service/entity. Implementations MUST return
// ErrUserNotRegistered (or an error that wraps a not-found condition) when no
// user matches the email.
type UserFinder interface {
	FindUserIDByEmail(ctx context.Context, email string) (uuid.UUID, error)
}

// ServiceInterface defines the member service operations.
type ServiceInterface interface {
	AddMember(ctx context.Context, input AddMemberInput) (*Member, error)
	GetMember(ctx context.Context, workspaceID, userID uuid.UUID) (*Member, error)
	ListWorkspaceMembers(ctx context.Context, workspaceID uuid.UUID) ([]*Member, error)
	UpdateRole(ctx context.Context, input UpdateRoleInput) (*Member, error)
	RemoveMember(ctx context.Context, input RemoveMemberInput) error
	GetUserRole(ctx context.Context, workspaceID, userID uuid.UUID) (Role, error)
}

// Service handles member business logic.
type Service struct {
	repo  Repository
	users UserFinder
}

// NewService creates a new member service. The UserFinder is used by the
// add-by-email path to resolve an email to an existing user id.
func NewService(repo Repository, users UserFinder) *Service {
	return &Service{repo: repo, users: users}
}

// AddMemberInput holds the input for adding a member. Exactly one of Email or
// UserID identifies the user to add: when Email is non-empty it is resolved to
// an existing registered user's id (the parity add-by-email path); otherwise
// UserID is used directly (legacy/internal callers).
type AddMemberInput struct {
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
	Email       string
	Role        Role
	InvitedBy   *uuid.UUID
}

// AddMember adds a new member to a workspace. If an email is supplied it is
// resolved to an existing registered user's id (404 ErrUserNotRegistered when
// absent); no pending-invite row is created and no email is sent.
func (s *Service) AddMember(ctx context.Context, input AddMemberInput) (*Member, error) {
	userID := input.UserID

	// Resolve add-by-email to an existing registered user's id.
	if input.Email != "" {
		resolved, err := s.users.FindUserIDByEmail(ctx, input.Email)
		if err != nil {
			// A not-found from the finder means the email is not registered.
			if errors.Is(err, ErrUserNotRegistered) {
				return nil, ErrUserNotRegistered
			}
			return nil, err
		}
		if resolved == uuid.Nil {
			return nil, ErrUserNotRegistered
		}
		userID = resolved
	}

	// Check if user is already a member
	exists, err := s.repo.Exists(ctx, input.WorkspaceID, userID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrAlreadyMember
	}

	// Create member entity
	member, err := NewMember(input.WorkspaceID, userID, input.Role, input.InvitedBy)
	if err != nil {
		return nil, err
	}

	// Persist member
	if err := s.repo.Save(ctx, member); err != nil {
		return nil, err
	}

	return member, nil
}

// GetMember retrieves a member by workspace and user ID.
func (s *Service) GetMember(ctx context.Context, workspaceID, userID uuid.UUID) (*Member, error) {
	member, err := s.repo.FindByWorkspaceAndUser(ctx, workspaceID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrMemberNotFound
	}
	return member, nil
}

// ListWorkspaceMembers retrieves all members in a workspace.
func (s *Service) ListWorkspaceMembers(ctx context.Context, workspaceID uuid.UUID) ([]*Member, error) {
	return s.repo.ListByWorkspace(ctx, workspaceID)
}

// UpdateRoleInput holds the input for updating a member's role.
type UpdateRoleInput struct {
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
	NewRole     Role
	UpdaterID   uuid.UUID
}

// UpdateRole updates a member's role.
func (s *Service) UpdateRole(ctx context.Context, input UpdateRoleInput) (*Member, error) {
	// Cannot change your own role
	if input.UserID == input.UpdaterID {
		return nil, ErrCannotChangeOwnRole
	}

	// Get the member to update
	member, err := s.GetMember(ctx, input.WorkspaceID, input.UserID)
	if err != nil {
		return nil, err
	}

	// Update role
	if err := member.UpdateRole(input.NewRole); err != nil {
		return nil, err
	}

	// Persist changes
	if err := s.repo.Save(ctx, member); err != nil {
		return nil, err
	}

	return member, nil
}

// RemoveMemberInput holds the input for removing a member.
type RemoveMemberInput struct {
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
}

// RemoveMember removes a member from a workspace.
func (s *Service) RemoveMember(ctx context.Context, input RemoveMemberInput) error {
	// Get the member
	member, err := s.GetMember(ctx, input.WorkspaceID, input.UserID)
	if err != nil {
		return err
	}

	// If removing an owner, check that there's at least one other owner
	if member.IsOwner() {
		ownerCount, err := s.repo.CountOwners(ctx, input.WorkspaceID)
		if err != nil {
			return err
		}
		if ownerCount <= 1 {
			return ErrCannotRemoveOwner
		}
	}

	return s.repo.Delete(ctx, input.WorkspaceID, input.UserID)
}

// GetUserRole retrieves a user's role in a workspace.
func (s *Service) GetUserRole(ctx context.Context, workspaceID, userID uuid.UUID) (Role, error) {
	member, err := s.GetMember(ctx, workspaceID, userID)
	if err != nil {
		return "", err
	}
	return member.Role(), nil
}
