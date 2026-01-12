package member_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
)

func TestNewMember(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()
	inviterID := uuid.New()

	tests := []struct {
		name        string
		workspaceID uuid.UUID
		userID      uuid.UUID
		role        member.Role
		invitedBy   *uuid.UUID
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "valid owner member",
			workspaceID: workspaceID,
			userID:      userID,
			role:        member.RoleOwner,
			invitedBy:   nil,
			wantErr:     false,
		},
		{
			name:        "valid admin member",
			workspaceID: workspaceID,
			userID:      userID,
			role:        member.RoleAdmin,
			invitedBy:   &inviterID,
			wantErr:     false,
		},
		{
			name:        "valid member",
			workspaceID: workspaceID,
			userID:      userID,
			role:        member.RoleMember,
			invitedBy:   &inviterID,
			wantErr:     false,
		},
		{
			name:        "valid viewer",
			workspaceID: workspaceID,
			userID:      userID,
			role:        member.RoleViewer,
			invitedBy:   &inviterID,
			wantErr:     false,
		},
		{
			name:        "nil workspace ID",
			workspaceID: uuid.Nil,
			userID:      userID,
			role:        member.RoleMember,
			invitedBy:   nil,
			wantErr:     true,
			errMsg:      "workspace_id",
		},
		{
			name:        "nil user ID",
			workspaceID: workspaceID,
			userID:      uuid.Nil,
			role:        member.RoleMember,
			invitedBy:   nil,
			wantErr:     true,
			errMsg:      "user_id",
		},
		{
			name:        "invalid role",
			workspaceID: workspaceID,
			userID:      userID,
			role:        member.Role("invalid"),
			invitedBy:   nil,
			wantErr:     true,
			errMsg:      "invalid role",
		},
		{
			name:        "empty role",
			workspaceID: workspaceID,
			userID:      userID,
			role:        member.Role(""),
			invitedBy:   nil,
			wantErr:     true,
			errMsg:      "invalid role",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := member.NewMember(tt.workspaceID, tt.userID, tt.role, tt.invitedBy)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				assert.Nil(t, m)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, m)
				assert.Equal(t, tt.workspaceID, m.WorkspaceID())
				assert.Equal(t, tt.userID, m.UserID())
				assert.Equal(t, tt.role, m.Role())
				assert.Equal(t, tt.invitedBy, m.InvitedBy())
				assert.NotEqual(t, uuid.Nil, m.ID())
				assert.NotZero(t, m.CreatedAt())
				assert.NotZero(t, m.UpdatedAt())
			}
		})
	}
}

func TestMember_UpdateRole(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name        string
		initialRole member.Role
		newRole     member.Role
		wantErr     bool
		errMsg      string
	}{
		{
			name:        "update from member to admin",
			initialRole: member.RoleMember,
			newRole:     member.RoleAdmin,
			wantErr:     false,
		},
		{
			name:        "update from viewer to member",
			initialRole: member.RoleViewer,
			newRole:     member.RoleMember,
			wantErr:     false,
		},
		{
			name:        "update from admin to owner",
			initialRole: member.RoleAdmin,
			newRole:     member.RoleOwner,
			wantErr:     false,
		},
		{
			name:        "update from owner to admin",
			initialRole: member.RoleOwner,
			newRole:     member.RoleAdmin,
			wantErr:     false,
		},
		{
			name:        "update from member to viewer",
			initialRole: member.RoleMember,
			newRole:     member.RoleViewer,
			wantErr:     false,
		},
		{
			name:        "update to invalid role",
			initialRole: member.RoleMember,
			newRole:     member.Role("invalid"),
			wantErr:     true,
			errMsg:      "invalid role",
		},
		{
			name:        "update to empty role",
			initialRole: member.RoleMember,
			newRole:     member.Role(""),
			wantErr:     true,
			errMsg:      "invalid role",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create fresh member for each test
			m, _ := member.NewMember(workspaceID, userID, tt.initialRole, nil)
			originalUpdatedAt := m.UpdatedAt()
			time.Sleep(time.Millisecond) // Ensure time difference

			err := m.UpdateRole(tt.newRole)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				// Role should remain unchanged on error
				assert.Equal(t, tt.initialRole, m.Role())
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.newRole, m.Role())
				assert.True(t, m.UpdatedAt().After(originalUpdatedAt))
			}
		})
	}
}

func TestMember_CanManageMembers(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name string
		role member.Role
		want bool
	}{
		{
			name: "owner can manage members",
			role: member.RoleOwner,
			want: true,
		},
		{
			name: "admin can manage members",
			role: member.RoleAdmin,
			want: true,
		},
		{
			name: "member cannot manage members",
			role: member.RoleMember,
			want: false,
		},
		{
			name: "viewer cannot manage members",
			role: member.RoleViewer,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := member.NewMember(workspaceID, userID, tt.role, nil)
			assert.NoError(t, err)
			assert.Equal(t, tt.want, m.CanManageMembers())
		})
	}
}

func TestMember_CanEditContent(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name string
		role member.Role
		want bool
	}{
		{
			name: "owner can edit content",
			role: member.RoleOwner,
			want: true,
		},
		{
			name: "admin can edit content",
			role: member.RoleAdmin,
			want: true,
		},
		{
			name: "member can edit content",
			role: member.RoleMember,
			want: true,
		},
		{
			name: "viewer cannot edit content",
			role: member.RoleViewer,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := member.NewMember(workspaceID, userID, tt.role, nil)
			assert.NoError(t, err)
			assert.Equal(t, tt.want, m.CanEditContent())
		})
	}
}

func TestMember_IsOwner(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name string
		role member.Role
		want bool
	}{
		{
			name: "owner is owner",
			role: member.RoleOwner,
			want: true,
		},
		{
			name: "admin is not owner",
			role: member.RoleAdmin,
			want: false,
		},
		{
			name: "member is not owner",
			role: member.RoleMember,
			want: false,
		},
		{
			name: "viewer is not owner",
			role: member.RoleViewer,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := member.NewMember(workspaceID, userID, tt.role, nil)
			assert.NoError(t, err)
			assert.Equal(t, tt.want, m.IsOwner())
		})
	}
}

func TestMember_Getters(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()
	inviterID := uuid.New()

	m, err := member.NewMember(workspaceID, userID, member.RoleAdmin, &inviterID)
	assert.NoError(t, err)

	// Test all getters
	assert.NotEqual(t, uuid.Nil, m.ID())
	assert.Equal(t, workspaceID, m.WorkspaceID())
	assert.Equal(t, userID, m.UserID())
	assert.Equal(t, member.RoleAdmin, m.Role())
	assert.Equal(t, &inviterID, m.InvitedBy())
	assert.NotZero(t, m.CreatedAt())
	assert.NotZero(t, m.UpdatedAt())
}

func TestMember_Reconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()
	inviterID := uuid.New()
	role := member.RoleMember
	createdAt := time.Now().Add(-24 * time.Hour)
	updatedAt := time.Now()

	m := member.Reconstruct(
		id,
		workspaceID,
		userID,
		role,
		&inviterID,
		createdAt,
		updatedAt,
	)

	assert.NotNil(t, m)
	assert.Equal(t, id, m.ID())
	assert.Equal(t, workspaceID, m.WorkspaceID())
	assert.Equal(t, userID, m.UserID())
	assert.Equal(t, role, m.Role())
	assert.Equal(t, &inviterID, m.InvitedBy())
	assert.Equal(t, createdAt, m.CreatedAt())
	assert.Equal(t, updatedAt, m.UpdatedAt())
}

func TestMember_ReconstructWithoutInviter(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()
	role := member.RoleOwner
	createdAt := time.Now().Add(-24 * time.Hour)
	updatedAt := time.Now()

	m := member.Reconstruct(
		id,
		workspaceID,
		userID,
		role,
		nil,
		createdAt,
		updatedAt,
	)

	assert.NotNil(t, m)
	assert.Equal(t, id, m.ID())
	assert.Equal(t, workspaceID, m.WorkspaceID())
	assert.Equal(t, userID, m.UserID())
	assert.Equal(t, role, m.Role())
	assert.Nil(t, m.InvitedBy())
	assert.Equal(t, createdAt, m.CreatedAt())
	assert.Equal(t, updatedAt, m.UpdatedAt())
}

func TestMember_RolePermissionsConsistency(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()

	t.Run("role hierarchy", func(t *testing.T) {
		// Owner has all permissions
		owner, _ := member.NewMember(workspaceID, userID, member.RoleOwner, nil)
		assert.True(t, owner.IsOwner())
		assert.True(t, owner.CanManageMembers())
		assert.True(t, owner.CanEditContent())

		// Admin has management and edit, but is not owner
		admin, _ := member.NewMember(workspaceID, userID, member.RoleAdmin, nil)
		assert.False(t, admin.IsOwner())
		assert.True(t, admin.CanManageMembers())
		assert.True(t, admin.CanEditContent())

		// Member can only edit content
		memberRole, _ := member.NewMember(workspaceID, userID, member.RoleMember, nil)
		assert.False(t, memberRole.IsOwner())
		assert.False(t, memberRole.CanManageMembers())
		assert.True(t, memberRole.CanEditContent())

		// Viewer has no special permissions
		viewer, _ := member.NewMember(workspaceID, userID, member.RoleViewer, nil)
		assert.False(t, viewer.IsOwner())
		assert.False(t, viewer.CanManageMembers())
		assert.False(t, viewer.CanEditContent())
	})
}
