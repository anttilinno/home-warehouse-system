package member_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements member.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) AddMember(ctx context.Context, input member.AddMemberInput) (*member.Member, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*member.Member), args.Error(1)
}

func (m *MockService) GetMember(ctx context.Context, workspaceID, userID uuid.UUID) (*member.Member, error) {
	args := m.Called(ctx, workspaceID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*member.Member), args.Error(1)
}

func (m *MockService) ListWorkspaceMembers(ctx context.Context, workspaceID uuid.UUID) ([]*member.Member, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*member.Member), args.Error(1)
}

func (m *MockService) UpdateRole(ctx context.Context, input member.UpdateRoleInput) (*member.Member, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*member.Member), args.Error(1)
}

func (m *MockService) RemoveMember(ctx context.Context, input member.RemoveMemberInput) error {
	args := m.Called(ctx, input)
	return args.Error(0)
}

func (m *MockService) GetUserRole(ctx context.Context, workspaceID, userID uuid.UUID) (member.Role, error) {
	args := m.Called(ctx, workspaceID, userID)
	return args.Get(0).(member.Role), args.Error(1)
}

// Tests

func TestMemberHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	member.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists workspace members successfully", func(t *testing.T) {
		member1, _ := member.NewMember(setup.WorkspaceID, uuid.New(), member.RoleOwner, nil)
		member2, _ := member.NewMember(setup.WorkspaceID, uuid.New(), member.RoleMember, nil)
		members := []*member.Member{member1, member2}

		mockSvc.On("ListWorkspaceMembers", mock.Anything, setup.WorkspaceID).
			Return(members, nil).Once()

		rec := setup.Get("/members")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no members", func(t *testing.T) {
		mockSvc.On("ListWorkspaceMembers", mock.Anything, setup.WorkspaceID).
			Return([]*member.Member{}, nil).Once()

		rec := setup.Get("/members")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestMemberHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	member.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets member successfully", func(t *testing.T) {
		userID := uuid.New()
		testMember, _ := member.NewMember(setup.WorkspaceID, userID, member.RoleMember, nil)

		mockSvc.On("GetMember", mock.Anything, setup.WorkspaceID, userID).
			Return(testMember, nil).Once()

		rec := setup.Get(fmt.Sprintf("/members/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when member not found", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("GetMember", mock.Anything, setup.WorkspaceID, userID).
			Return(nil, member.ErrMemberNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/members/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestMemberHandler_AddMember(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	member.RegisterRoutes(setup.API, mockSvc)

	t.Run("adds member successfully", func(t *testing.T) {
		userID := uuid.New()
		testMember, _ := member.NewMember(setup.WorkspaceID, userID, member.RoleMember, &setup.UserID)

		mockSvc.On("AddMember", mock.Anything, mock.MatchedBy(func(input member.AddMemberInput) bool {
			return input.WorkspaceID == setup.WorkspaceID &&
				input.UserID == userID &&
				input.Role == member.RoleMember &&
				input.InvitedBy != nil &&
				*input.InvitedBy == setup.UserID
		})).Return(testMember, nil).Once()

		body := fmt.Sprintf(`{"user_id":"%s","role":"member"}`, userID)
		rec := setup.Post("/members", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when user is already a member", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("AddMember", mock.Anything, mock.Anything).
			Return(nil, member.ErrAlreadyMember).Once()

		body := fmt.Sprintf(`{"user_id":"%s","role":"member"}`, userID)
		rec := setup.Post("/members", body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("adds member with owner role", func(t *testing.T) {
		userID := uuid.New()
		testMember, _ := member.NewMember(setup.WorkspaceID, userID, member.RoleOwner, &setup.UserID)

		mockSvc.On("AddMember", mock.Anything, mock.MatchedBy(func(input member.AddMemberInput) bool {
			return input.Role == member.RoleOwner
		})).Return(testMember, nil).Once()

		body := fmt.Sprintf(`{"user_id":"%s","role":"owner"}`, userID)
		rec := setup.Post("/members", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("adds member with admin role", func(t *testing.T) {
		userID := uuid.New()
		testMember, _ := member.NewMember(setup.WorkspaceID, userID, member.RoleAdmin, &setup.UserID)

		mockSvc.On("AddMember", mock.Anything, mock.MatchedBy(func(input member.AddMemberInput) bool {
			return input.Role == member.RoleAdmin
		})).Return(testMember, nil).Once()

		body := fmt.Sprintf(`{"user_id":"%s","role":"admin"}`, userID)
		rec := setup.Post("/members", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("adds member with viewer role", func(t *testing.T) {
		userID := uuid.New()
		testMember, _ := member.NewMember(setup.WorkspaceID, userID, member.RoleViewer, &setup.UserID)

		mockSvc.On("AddMember", mock.Anything, mock.MatchedBy(func(input member.AddMemberInput) bool {
			return input.Role == member.RoleViewer
		})).Return(testMember, nil).Once()

		body := fmt.Sprintf(`{"user_id":"%s","role":"viewer"}`, userID)
		rec := setup.Post("/members", body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestMemberHandler_UpdateRole(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	member.RegisterRoutes(setup.API, mockSvc)

	t.Run("updates member role successfully", func(t *testing.T) {
		userID := uuid.New()
		testMember, _ := member.NewMember(setup.WorkspaceID, userID, member.RoleAdmin, nil)

		mockSvc.On("UpdateRole", mock.Anything, mock.MatchedBy(func(input member.UpdateRoleInput) bool {
			return input.WorkspaceID == setup.WorkspaceID &&
				input.UserID == userID &&
				input.NewRole == member.RoleAdmin &&
				input.UpdaterID == setup.UserID
		})).Return(testMember, nil).Once()

		body := `{"role":"admin"}`
		rec := setup.Patch(fmt.Sprintf("/members/%s", userID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when trying to change own role", func(t *testing.T) {
		mockSvc.On("UpdateRole", mock.Anything, mock.Anything).
			Return(nil, member.ErrCannotChangeOwnRole).Once()

		body := `{"role":"admin"}`
		rec := setup.Patch(fmt.Sprintf("/members/%s", setup.UserID), body)

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when member not found", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("UpdateRole", mock.Anything, mock.Anything).
			Return(nil, member.ErrMemberNotFound).Once()

		body := `{"role":"admin"}`
		rec := setup.Patch(fmt.Sprintf("/members/%s", userID), body)

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})

	t.Run("updates to viewer role", func(t *testing.T) {
		userID := uuid.New()
		testMember, _ := member.NewMember(setup.WorkspaceID, userID, member.RoleViewer, nil)

		mockSvc.On("UpdateRole", mock.Anything, mock.MatchedBy(func(input member.UpdateRoleInput) bool {
			return input.NewRole == member.RoleViewer
		})).Return(testMember, nil).Once()

		body := `{"role":"viewer"}`
		rec := setup.Patch(fmt.Sprintf("/members/%s", userID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestMemberHandler_RemoveMember(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	member.RegisterRoutes(setup.API, mockSvc)

	t.Run("removes member successfully", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("RemoveMember", mock.Anything, mock.MatchedBy(func(input member.RemoveMemberInput) bool {
			return input.WorkspaceID == setup.WorkspaceID && input.UserID == userID
		})).Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/members/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 when trying to remove last owner", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("RemoveMember", mock.Anything, mock.Anything).
			Return(member.ErrCannotRemoveOwner).Once()

		rec := setup.Delete(fmt.Sprintf("/members/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when member not found", func(t *testing.T) {
		userID := uuid.New()

		mockSvc.On("RemoveMember", mock.Anything, mock.Anything).
			Return(member.ErrMemberNotFound).Once()

		rec := setup.Delete(fmt.Sprintf("/members/%s", userID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}
