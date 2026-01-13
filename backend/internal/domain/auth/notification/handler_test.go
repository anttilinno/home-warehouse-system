package notification_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/notification"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements notification.ServiceInterface
type MockService struct {
	mock.Mock
}

func (m *MockService) Create(ctx context.Context, input notification.CreateInput) (*notification.Notification, error) {
	args := m.Called(ctx, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*notification.Notification), args.Error(1)
}

func (m *MockService) GetByID(ctx context.Context, id, userID uuid.UUID) (*notification.Notification, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*notification.Notification), args.Error(1)
}

func (m *MockService) ListUserNotifications(ctx context.Context, userID uuid.UUID, pagination shared.Pagination) (*shared.PagedResult[*notification.Notification], error) {
	args := m.Called(ctx, userID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*shared.PagedResult[*notification.Notification]), args.Error(1)
}

func (m *MockService) GetUnreadNotifications(ctx context.Context, userID uuid.UUID) ([]*notification.Notification, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*notification.Notification), args.Error(1)
}

func (m *MockService) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *MockService) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockService) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

// Tests

func TestNotificationHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists notifications successfully", func(t *testing.T) {
		notif1, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeSystem,
			"Test Notification 1",
			"Message 1",
			nil,
		)
		notif2, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeSystem,
			"Test Notification 2",
			"Message 2",
			nil,
		)
		notifications := []*notification.Notification{notif1, notif2}

		result := shared.NewPagedResult(notifications, 2, shared.Pagination{Page: 1, PageSize: 50})

		mockSvc.On("ListUserNotifications", mock.Anything, setup.UserID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 1 && p.PageSize == 50
		})).Return(&result, nil).Once()

		rec := setup.Get("/notifications")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("handles pagination", func(t *testing.T) {
		result := shared.NewPagedResult([]*notification.Notification{}, 0, shared.Pagination{Page: 2, PageSize: 10})

		mockSvc.On("ListUserNotifications", mock.Anything, setup.UserID, mock.MatchedBy(func(p shared.Pagination) bool {
			return p.Page == 2 && p.PageSize == 10
		})).Return(&result, nil).Once()

		rec := setup.Get("/notifications?page=2&limit=10")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no notifications", func(t *testing.T) {
		result := shared.NewPagedResult([]*notification.Notification{}, 0, shared.Pagination{Page: 1, PageSize: 50})

		mockSvc.On("ListUserNotifications", mock.Anything, setup.UserID, mock.Anything).
			Return(&result, nil).Once()

		rec := setup.Get("/notifications")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestNotificationHandler_GetUnread(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets unread notifications successfully", func(t *testing.T) {
		notif1, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeLoanDueSoon,
			"Loan Due Soon",
			"Your loan is due soon",
			nil,
		)
		notifications := []*notification.Notification{notif1}

		mockSvc.On("GetUnreadNotifications", mock.Anything, setup.UserID).
			Return(notifications, nil).Once()

		rec := setup.Get("/notifications/unread")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns empty list when no unread notifications", func(t *testing.T) {
		mockSvc.On("GetUnreadNotifications", mock.Anything, setup.UserID).
			Return([]*notification.Notification{}, nil).Once()

		rec := setup.Get("/notifications/unread")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestNotificationHandler_GetUnreadCount(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets unread count successfully", func(t *testing.T) {
		mockSvc.On("GetUnreadCount", mock.Anything, setup.UserID).
			Return(int64(5), nil).Once()

		rec := setup.Get("/notifications/unread/count")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns zero count when no unread notifications", func(t *testing.T) {
		mockSvc.On("GetUnreadCount", mock.Anything, setup.UserID).
			Return(int64(0), nil).Once()

		rec := setup.Get("/notifications/unread/count")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestNotificationHandler_GetByID(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets notification by ID successfully", func(t *testing.T) {
		testNotif, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeSystem,
			"Test Notification",
			"Test Message",
			nil,
		)
		notifID := testNotif.ID()

		mockSvc.On("GetByID", mock.Anything, notifID, setup.UserID).
			Return(testNotif, nil).Once()

		rec := setup.Get(fmt.Sprintf("/notifications/%s", notifID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 404 when notification not found", func(t *testing.T) {
		notifID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, notifID, setup.UserID).
			Return(nil, nil).Once()

		rec := setup.Get(fmt.Sprintf("/notifications/%s", notifID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
		mockSvc.AssertExpectations(t)
	})
}

func TestNotificationHandler_MarkAsRead(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("marks notification as read successfully", func(t *testing.T) {
		notifID := uuid.New()

		mockSvc.On("MarkAsRead", mock.Anything, notifID, setup.UserID).
			Return(nil).Once()

		rec := setup.Post(fmt.Sprintf("/notifications/%s/read", notifID), "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for error marking as read", func(t *testing.T) {
		notifID := uuid.New()

		mockSvc.On("MarkAsRead", mock.Anything, notifID, setup.UserID).
			Return(fmt.Errorf("some error")).Once()

		rec := setup.Post(fmt.Sprintf("/notifications/%s/read", notifID), "")

		testutil.AssertStatus(t, rec, http.StatusBadRequest)
		mockSvc.AssertExpectations(t)
	})
}

func TestNotificationHandler_MarkAllAsRead(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("marks all notifications as read successfully", func(t *testing.T) {
		mockSvc.On("MarkAllAsRead", mock.Anything, setup.UserID).
			Return(nil).Once()

		rec := setup.Post("/notifications/read-all", "")

		testutil.AssertStatus(t, rec, http.StatusNoContent)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 500 for error marking all as read", func(t *testing.T) {
		mockSvc.On("MarkAllAsRead", mock.Anything, setup.UserID).
			Return(fmt.Errorf("database error")).Once()

		rec := setup.Post("/notifications/read-all", "")

		testutil.AssertStatus(t, rec, http.StatusInternalServerError)
		mockSvc.AssertExpectations(t)
	})
}

func TestNotificationHandler_DifferentNotificationTypes(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists notifications with different types", func(t *testing.T) {
		notif1, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeLoanDueSoon,
			"Loan Due Soon",
			"Your loan is due",
			nil,
		)
		notif2, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeLoanOverdue,
			"Loan Overdue",
			"Your loan is overdue",
			nil,
		)
		notif3, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeLoanReturned,
			"Loan Returned",
			"A loan was returned",
			nil,
		)
		notif4, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeLowStock,
			"Low Stock",
			"Item is low on stock",
			nil,
		)
		notif5, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeWorkspaceInvite,
			"Workspace Invite",
			"You were invited",
			nil,
		)
		notif6, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeMemberJoined,
			"Member Joined",
			"A member joined",
			nil,
		)
		notifications := []*notification.Notification{notif1, notif2, notif3, notif4, notif5, notif6}

		result := shared.NewPagedResult(notifications, 6, shared.Pagination{Page: 1, PageSize: 50})

		mockSvc.On("ListUserNotifications", mock.Anything, setup.UserID, mock.Anything).
			Return(&result, nil).Once()

		rec := setup.Get("/notifications")

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}

func TestNotificationHandler_WithMetadata(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockService)
	notification.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets notification with metadata", func(t *testing.T) {
		metadata := map[string]interface{}{
			"loan_id": uuid.New().String(),
			"item_id": uuid.New().String(),
		}
		testNotif, _ := notification.NewNotification(
			setup.UserID,
			&setup.WorkspaceID,
			notification.TypeLoanDueSoon,
			"Loan Due Soon",
			"Your loan is due soon",
			metadata,
		)
		notifID := testNotif.ID()

		mockSvc.On("GetByID", mock.Anything, notifID, setup.UserID).
			Return(testNotif, nil).Once()

		rec := setup.Get(fmt.Sprintf("/notifications/%s", notifID))

		testutil.AssertStatus(t, rec, http.StatusOK)
		mockSvc.AssertExpectations(t)
	})
}
