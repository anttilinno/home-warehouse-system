package member

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Role represents a workspace member role.
type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
	RoleViewer Role = "viewer"
)

// Member represents a workspace member.
type Member struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	userID      uuid.UUID
	role        Role
	invitedBy   *uuid.UUID
	createdAt   time.Time
	updatedAt   time.Time
}

// NewMember creates a new member.
func NewMember(workspaceID, userID uuid.UUID, role Role, invitedBy *uuid.UUID) (*Member, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(userID, "user_id"); err != nil {
		return nil, err
	}
	if !isValidRole(role) {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "role", "invalid role")
	}

	now := time.Now()
	return &Member{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		userID:      userID,
		role:        role,
		invitedBy:   invitedBy,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

// Reconstruct recreates a member from stored data.
func Reconstruct(
	id, workspaceID, userID uuid.UUID,
	role Role,
	invitedBy *uuid.UUID,
	createdAt, updatedAt time.Time,
) *Member {
	return &Member{
		id:          id,
		workspaceID: workspaceID,
		userID:      userID,
		role:        role,
		invitedBy:   invitedBy,
		createdAt:   createdAt,
		updatedAt:   updatedAt,
	}
}

// ID returns the member's ID.
func (m *Member) ID() uuid.UUID { return m.id }

// WorkspaceID returns the workspace ID.
func (m *Member) WorkspaceID() uuid.UUID { return m.workspaceID }

// UserID returns the user ID.
func (m *Member) UserID() uuid.UUID { return m.userID }

// Role returns the member's role.
func (m *Member) Role() Role { return m.role }

// InvitedBy returns who invited the member.
func (m *Member) InvitedBy() *uuid.UUID { return m.invitedBy }

// CreatedAt returns when the member was created.
func (m *Member) CreatedAt() time.Time { return m.createdAt }

// UpdatedAt returns when the member was last updated.
func (m *Member) UpdatedAt() time.Time { return m.updatedAt }

// UpdateRole updates the member's role.
func (m *Member) UpdateRole(newRole Role) error {
	if !isValidRole(newRole) {
		return shared.NewFieldError(shared.ErrInvalidInput, "role", "invalid role")
	}
	m.role = newRole
	m.updatedAt = time.Now()
	return nil
}

// CanManageMembers checks if this member can manage other members.
func (m *Member) CanManageMembers() bool {
	return m.role == RoleOwner || m.role == RoleAdmin
}

// CanEditContent checks if this member can edit content.
func (m *Member) CanEditContent() bool {
	return m.role == RoleOwner || m.role == RoleAdmin || m.role == RoleMember
}

// IsOwner checks if this member is an owner.
func (m *Member) IsOwner() bool {
	return m.role == RoleOwner
}

// isValidRole checks if a role is valid.
func isValidRole(role Role) bool {
	switch role {
	case RoleOwner, RoleAdmin, RoleMember, RoleViewer:
		return true
	default:
		return false
	}
}
