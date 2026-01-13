package member

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, member *Member) error {
	args := m.Called(ctx, member)
	return args.Error(0)
}

func (m *MockRepository) FindByWorkspaceAndUser(ctx context.Context, workspaceID, userID uuid.UUID) (*Member, error) {
	args := m.Called(ctx, workspaceID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Member), args.Error(1)
}

func (m *MockRepository) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*Member, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Member), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, workspaceID, userID uuid.UUID) error {
	args := m.Called(ctx, workspaceID, userID)
	return args.Error(0)
}

func (m *MockRepository) CountOwners(ctx context.Context, workspaceID uuid.UUID) (int64, error) {
	args := m.Called(ctx, workspaceID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockRepository) Exists(ctx context.Context, workspaceID, userID uuid.UUID) (bool, error) {
	args := m.Called(ctx, workspaceID, userID)
	return args.Bool(0), args.Error(1)
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestRole_Constants(t *testing.T) {
	assert.Equal(t, Role("owner"), RoleOwner)
	assert.Equal(t, Role("admin"), RoleAdmin)
	assert.Equal(t, Role("member"), RoleMember)
	assert.Equal(t, Role("viewer"), RoleViewer)
}

func TestNewMember(t *testing.T) {
	workspaceID := uuid.New()
	userID := uuid.New()
	invitedBy := uuid.New()

	tests := []struct {
		name        string
		workspaceID uuid.UUID
		userID      uuid.UUID
		role        Role
		invitedBy   *uuid.UUID
		expectError bool
		errorField  string
	}{
		{
			name:        "valid member",
			workspaceID: workspaceID,
			userID:      userID,
			role:        RoleMember,
			invitedBy:   &invitedBy,
			expectError: false,
		},
		{
			name:        "owner role",
			workspaceID: workspaceID,
			userID:      userID,
			role:        RoleOwner,
			invitedBy:   nil,
			expectError: false,
		},
		{
			name:        "invalid workspace ID",
			workspaceID: uuid.Nil,
			userID:      userID,
			role:        RoleMember,
			invitedBy:   nil,
			expectError: true,
			errorField:  "workspace_id",
		},
		{
			name:        "invalid user ID",
			workspaceID: workspaceID,
			userID:      uuid.Nil,
			role:        RoleMember,
			invitedBy:   nil,
			expectError: true,
			errorField:  "user_id",
		},
		{
			name:        "invalid role",
			workspaceID: workspaceID,
			userID:      userID,
			role:        Role("invalid"),
			invitedBy:   nil,
			expectError: true,
			errorField:  "role",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			member, err := NewMember(tt.workspaceID, tt.userID, tt.role, tt.invitedBy)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, member)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, member)
				assert.Equal(t, tt.workspaceID, member.WorkspaceID())
				assert.Equal(t, tt.userID, member.UserID())
				assert.Equal(t, tt.role, member.Role())
				assert.Equal(t, tt.invitedBy, member.InvitedBy())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	userID := uuid.New()
	invitedBy := uuid.New()
	now := time.Now()

	member := Reconstruct(
		id,
		workspaceID,
		userID,
		RoleAdmin,
		&invitedBy,
		now,
		now,
	)

	assert.Equal(t, id, member.ID())
	assert.Equal(t, workspaceID, member.WorkspaceID())
	assert.Equal(t, userID, member.UserID())
	assert.Equal(t, RoleAdmin, member.Role())
	assert.Equal(t, &invitedBy, member.InvitedBy())
	assert.Equal(t, now, member.CreatedAt())
	assert.Equal(t, now, member.UpdatedAt())
}

func TestMember_UpdateRole(t *testing.T) {
	member, err := NewMember(uuid.New(), uuid.New(), RoleMember, nil)
	assert.NoError(t, err)

	originalUpdatedAt := member.UpdatedAt()

	// Update to valid role
	err = member.UpdateRole(RoleAdmin)
	assert.NoError(t, err)
	assert.Equal(t, RoleAdmin, member.Role())
	assert.True(t, member.UpdatedAt().After(originalUpdatedAt))

	// Update to invalid role
	err = member.UpdateRole(Role("invalid"))
	assert.Error(t, err)
	assert.Equal(t, RoleAdmin, member.Role()) // Should not change
}

func TestMember_CanManageMembers(t *testing.T) {
	tests := []struct {
		role     Role
		expected bool
	}{
		{RoleOwner, true},
		{RoleAdmin, true},
		{RoleMember, false},
		{RoleViewer, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.role), func(t *testing.T) {
			member, _ := NewMember(uuid.New(), uuid.New(), tt.role, nil)
			assert.Equal(t, tt.expected, member.CanManageMembers())
		})
	}
}

func TestMember_CanEditContent(t *testing.T) {
	tests := []struct {
		role     Role
		expected bool
	}{
		{RoleOwner, true},
		{RoleAdmin, true},
		{RoleMember, true},
		{RoleViewer, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.role), func(t *testing.T) {
			member, _ := NewMember(uuid.New(), uuid.New(), tt.role, nil)
			assert.Equal(t, tt.expected, member.CanEditContent())
		})
	}
}

func TestMember_IsOwner(t *testing.T) {
	tests := []struct {
		role     Role
		expected bool
	}{
		{RoleOwner, true},
		{RoleAdmin, false},
		{RoleMember, false},
		{RoleViewer, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.role), func(t *testing.T) {
			member, _ := NewMember(uuid.New(), uuid.New(), tt.role, nil)
			assert.Equal(t, tt.expected, member.IsOwner())
		})
	}
}

func TestIsValidRole(t *testing.T) {
	validRoles := []Role{RoleOwner, RoleAdmin, RoleMember, RoleViewer}
	invalidRoles := []Role{Role(""), Role("invalid"), Role("superuser")}

	for _, role := range validRoles {
		assert.True(t, isValidRole(role), "Role %s should be valid", role)
	}

	for _, role := range invalidRoles {
		assert.False(t, isValidRole(role), "Role %s should be invalid", role)
	}
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_AddMember(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()
	invitedBy := uuid.New()

	tests := []struct {
		name        string
		input       AddMemberInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name: "successful addition",
			input: AddMemberInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
				Role:        RoleMember,
				InvitedBy:   &invitedBy,
			},
			setupMock: func(m *MockRepository) {
				m.On("Exists", ctx, workspaceID, userID).Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*member.Member")).Return(nil)
			},
			expectError: false,
		},
		{
			name: "user already member",
			input: AddMemberInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
				Role:        RoleMember,
				InvitedBy:   nil,
			},
			setupMock: func(m *MockRepository) {
				m.On("Exists", ctx, workspaceID, userID).Return(true, nil)
			},
			expectError: true,
			errorType:   ErrAlreadyMember,
		},
		{
			name: "invalid input",
			input: AddMemberInput{
				WorkspaceID: uuid.Nil,
				UserID:      userID,
				Role:        RoleMember,
				InvitedBy:   nil,
			},
			setupMock: func(m *MockRepository) {
				m.On("Exists", ctx, uuid.Nil, userID).Return(false, nil)
			},
			expectError: true,
		},
		{
			name: "database error on exists check",
			input: AddMemberInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
				Role:        RoleMember,
				InvitedBy:   nil,
			},
			setupMock: func(m *MockRepository) {
				m.On("Exists", ctx, workspaceID, userID).Return(false, fmt.Errorf("db error"))
			},
			expectError: true,
		},
		{
			name: "database error on save",
			input: AddMemberInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
				Role:        RoleMember,
				InvitedBy:   nil,
			},
			setupMock: func(m *MockRepository) {
				m.On("Exists", ctx, workspaceID, userID).Return(false, nil)
				m.On("Save", ctx, mock.AnythingOfType("*member.Member")).Return(fmt.Errorf("save error"))
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			member, err := svc.AddMember(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, member)
				if tt.errorType != nil {
					assert.Equal(t, tt.errorType, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, member)
				assert.Equal(t, tt.input.WorkspaceID, member.WorkspaceID())
				assert.Equal(t, tt.input.UserID, member.UserID())
				assert.Equal(t, tt.input.Role, member.Role())
				assert.Equal(t, tt.input.InvitedBy, member.InvitedBy())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetMember(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name        string
		workspaceID uuid.UUID
		userID      uuid.UUID
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name:        "member found",
			workspaceID: workspaceID,
			userID:      userID,
			setupMock: func(m *MockRepository) {
				member := &Member{
					id:          uuid.New(),
					workspaceID: workspaceID,
					userID:      userID,
					role:        RoleMember,
				}
				m.On("FindByWorkspaceAndUser", ctx, workspaceID, userID).Return(member, nil)
			},
			expectError: false,
		},
		{
			name:        "member not found",
			workspaceID: workspaceID,
			userID:      userID,
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspaceAndUser", ctx, workspaceID, userID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrMemberNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			member, err := svc.GetMember(ctx, tt.workspaceID, tt.userID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, member)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, member)
				assert.Equal(t, tt.workspaceID, member.WorkspaceID())
				assert.Equal(t, tt.userID, member.UserID())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_ListWorkspaceMembers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	members := []*Member{
		{id: uuid.New(), workspaceID: workspaceID, userID: uuid.New(), role: RoleOwner},
		{id: uuid.New(), workspaceID: workspaceID, userID: uuid.New(), role: RoleMember},
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListByWorkspace", ctx, workspaceID).Return(members, nil)

	result, err := svc.ListWorkspaceMembers(ctx, workspaceID)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, RoleOwner, result[0].Role())
	assert.Equal(t, RoleMember, result[1].Role())

	mockRepo.AssertExpectations(t)
}

func TestService_UpdateRole(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()
	updaterID := uuid.New()

	member, _ := NewMember(workspaceID, userID, RoleMember, nil)

	tests := []struct {
		name        string
		input       UpdateRoleInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name: "successful role update",
			input: UpdateRoleInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
				NewRole:     RoleAdmin,
				UpdaterID:   updaterID,
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspaceAndUser", ctx, workspaceID, userID).Return(member, nil)
				m.On("Save", ctx, mock.Anything).Return(nil)
			},
			expectError: false,
		},
		{
			name: "cannot change own role",
			input: UpdateRoleInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
				NewRole:     RoleAdmin,
				UpdaterID:   userID, // Same as user being updated
			},
			setupMock: func(m *MockRepository) {
				// No calls expected
			},
			expectError: true,
			errorType:   ErrCannotChangeOwnRole,
		},
		{
			name: "member not found",
			input: UpdateRoleInput{
				WorkspaceID: workspaceID,
				UserID:      uuid.New(),
				NewRole:     RoleAdmin,
				UpdaterID:   updaterID,
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspaceAndUser", ctx, workspaceID, mock.Anything).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrMemberNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			updatedMember, err := svc.UpdateRole(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, updatedMember)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, updatedMember)
				assert.Equal(t, tt.input.NewRole, updatedMember.Role())
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_RemoveMember(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name        string
		input       RemoveMemberInput
		setupMock   func(*MockRepository)
		expectError bool
		errorType   error
	}{
		{
			name: "successful removal of member",
			input: RemoveMemberInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
			},
			setupMock: func(m *MockRepository) {
				member, _ := NewMember(workspaceID, userID, RoleMember, nil)
				m.On("FindByWorkspaceAndUser", ctx, workspaceID, userID).Return(member, nil)
				m.On("Delete", ctx, workspaceID, userID).Return(nil)
			},
			expectError: false,
		},
		{
			name: "cannot remove last owner",
			input: RemoveMemberInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
			},
			setupMock: func(m *MockRepository) {
				member, _ := NewMember(workspaceID, userID, RoleOwner, nil)
				m.On("FindByWorkspaceAndUser", ctx, workspaceID, userID).Return(member, nil)
				m.On("CountOwners", ctx, workspaceID).Return(int64(1), nil)
			},
			expectError: true,
			errorType:   ErrCannotRemoveOwner,
		},
		{
			name: "member not found",
			input: RemoveMemberInput{
				WorkspaceID: workspaceID,
				UserID:      userID,
			},
			setupMock: func(m *MockRepository) {
				m.On("FindByWorkspaceAndUser", ctx, workspaceID, userID).Return(nil, nil)
			},
			expectError: true,
			errorType:   ErrMemberNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := new(MockRepository)
			svc := NewService(mockRepo)

			tt.setupMock(mockRepo)

			err := svc.RemoveMember(ctx, tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, tt.errorType, err)
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestService_GetUserRole(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()

	member, _ := NewMember(workspaceID, userID, RoleAdmin, nil)

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByWorkspaceAndUser", ctx, workspaceID, userID).Return(member, nil)

	role, err := svc.GetUserRole(ctx, workspaceID, userID)

	assert.NoError(t, err)
	assert.Equal(t, RoleAdmin, role)

	mockRepo.AssertExpectations(t)
}
