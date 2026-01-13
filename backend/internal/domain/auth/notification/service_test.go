package notification

import (
	"context"
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

func (m *MockRepository) Save(ctx context.Context, notification *Notification) error {
	args := m.Called(ctx, notification)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id, userID uuid.UUID) (*Notification, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Notification), args.Error(1)
}

func (m *MockRepository) FindByUser(ctx context.Context, userID uuid.UUID, pagination shared.Pagination) ([]*Notification, int, error) {
	args := m.Called(ctx, userID, pagination)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]*Notification), args.Int(1), args.Error(2)
}

func (m *MockRepository) FindUnreadByUser(ctx context.Context, userID uuid.UUID) ([]*Notification, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*Notification), args.Error(1)
}

func (m *MockRepository) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	args := m.Called(ctx, id, userID)
	return args.Error(0)
}

func (m *MockRepository) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockRepository) GetUnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func ptrString(s string) *string {
	return &s
}

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

// =============================================================================
// Entity Tests
// =============================================================================

func TestNotificationType_Constants(t *testing.T) {
	assert.Equal(t, NotificationType("LOAN_DUE_SOON"), TypeLoanDueSoon)
	assert.Equal(t, NotificationType("LOAN_OVERDUE"), TypeLoanOverdue)
	assert.Equal(t, NotificationType("LOAN_RETURNED"), TypeLoanReturned)
	assert.Equal(t, NotificationType("LOW_STOCK"), TypeLowStock)
	assert.Equal(t, NotificationType("WORKSPACE_INVITE"), TypeWorkspaceInvite)
	assert.Equal(t, NotificationType("MEMBER_JOINED"), TypeMemberJoined)
	assert.Equal(t, NotificationType("SYSTEM"), TypeSystem)
}

func TestNewNotification(t *testing.T) {
	userID := uuid.New()
	workspaceID := uuid.New()
	metadata := map[string]interface{}{"key": "value"}

	tests := []struct {
		name             string
		userID           uuid.UUID
		workspaceID      *uuid.UUID
		notificationType NotificationType
		title            string
		message          string
		metadata         map[string]interface{}
		expectError      bool
		errorField       string
	}{
		{
			name:             "valid notification",
			userID:           userID,
			workspaceID:      &workspaceID,
			notificationType: TypeLoanDueSoon,
			title:            "Loan Due Soon",
			message:          "Your loan is due in 3 days",
			metadata:         metadata,
			expectError:      false,
		},
		{
			name:             "system notification without workspace",
			userID:           userID,
			workspaceID:      nil,
			notificationType: TypeSystem,
			title:            "System Update",
			message:          "System has been updated",
			metadata:         nil,
			expectError:      false,
		},
		{
			name:             "invalid user ID",
			userID:           uuid.Nil,
			workspaceID:      &workspaceID,
			notificationType: TypeLoanDueSoon,
			title:            "Loan Due Soon",
			message:          "Your loan is due in 3 days",
			metadata:         metadata,
			expectError:      true,
			errorField:       "user_id",
		},
		{
			name:             "empty title",
			userID:           userID,
			workspaceID:      &workspaceID,
			notificationType: TypeLoanDueSoon,
			title:            "",
			message:          "Your loan is due in 3 days",
			metadata:         metadata,
			expectError:      true,
			errorField:       "title",
		},
		{
			name:             "empty message",
			userID:           userID,
			workspaceID:      &workspaceID,
			notificationType: TypeLoanDueSoon,
			title:            "Loan Due Soon",
			message:          "",
			metadata:         metadata,
			expectError:      true,
			errorField:       "message",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notification, err := NewNotification(
				tt.userID,
				tt.workspaceID,
				tt.notificationType,
				tt.title,
				tt.message,
				tt.metadata,
			)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, notification)
				if domainErr, ok := err.(*shared.DomainError); ok && domainErr.Field != "" {
					assert.Equal(t, tt.errorField, domainErr.Field)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, notification)
				assert.Equal(t, tt.userID, notification.UserID())
				assert.Equal(t, tt.workspaceID, notification.WorkspaceID())
				assert.Equal(t, tt.notificationType, notification.NotificationType())
				assert.Equal(t, tt.title, notification.Title())
				assert.Equal(t, tt.message, notification.Message())
				assert.Equal(t, tt.metadata, notification.Metadata())
				assert.False(t, notification.IsRead())
				assert.Nil(t, notification.ReadAt())
			}
		})
	}
}

func TestReconstruct(t *testing.T) {
	id := uuid.New()
	userID := uuid.New()
	workspaceID := uuid.New()
	readAt := time.Now()
	metadata := map[string]interface{}{"key": "value"}
	createdAt := time.Now()

	notification := Reconstruct(
		id,
		userID,
		&workspaceID,
		TypeLoanDueSoon,
		"Loan Due Soon",
		"Your loan is due in 3 days",
		true,
		&readAt,
		metadata,
		createdAt,
	)

	assert.Equal(t, id, notification.ID())
	assert.Equal(t, userID, notification.UserID())
	assert.Equal(t, &workspaceID, notification.WorkspaceID())
	assert.Equal(t, TypeLoanDueSoon, notification.NotificationType())
	assert.Equal(t, "Loan Due Soon", notification.Title())
	assert.Equal(t, "Your loan is due in 3 days", notification.Message())
	assert.True(t, notification.IsRead())
	assert.Equal(t, &readAt, notification.ReadAt())
	assert.Equal(t, metadata, notification.Metadata())
	assert.Equal(t, createdAt, notification.CreatedAt())
}

func TestNotification_MarkAsRead(t *testing.T) {
	notification, err := NewNotification(
		uuid.New(),
		nil,
		TypeSystem,
		"Test",
		"Test message",
		nil,
	)
	assert.NoError(t, err)

	assert.False(t, notification.IsRead())
	assert.Nil(t, notification.ReadAt())

	notification.MarkAsRead()

	assert.True(t, notification.IsRead())
	assert.NotNil(t, notification.ReadAt())

	// Calling again should not change anything
	originalReadAt := notification.ReadAt()
	notification.MarkAsRead()
	assert.Equal(t, originalReadAt, notification.ReadAt())
}

// =============================================================================
// Service Tests
// =============================================================================

func TestService_Create(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	workspaceID := uuid.New()
	metadata := map[string]interface{}{"loan_id": "123"}

	t.Run("success", func(t *testing.T) {
		input := CreateInput{
			UserID:           userID,
			WorkspaceID:      &workspaceID,
			NotificationType: TypeLoanDueSoon,
			Title:            "Loan Due Soon",
			Message:          "Your loan is due in 3 days",
			Metadata:         metadata,
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("Save", ctx, mock.AnythingOfType("*notification.Notification")).Return(nil)

		notification, err := svc.Create(ctx, input)

		assert.NoError(t, err)
		assert.NotNil(t, notification)
		assert.Equal(t, userID, notification.UserID())
		assert.Equal(t, &workspaceID, notification.WorkspaceID())
		assert.Equal(t, TypeLoanDueSoon, notification.NotificationType())
		assert.Equal(t, "Loan Due Soon", notification.Title())
		assert.Equal(t, "Your loan is due in 3 days", notification.Message())
		assert.Equal(t, metadata, notification.Metadata())

		mockRepo.AssertExpectations(t)
	})

	t.Run("error on invalid input", func(t *testing.T) {
		input := CreateInput{
			UserID:           uuid.Nil, // Invalid user ID
			WorkspaceID:      &workspaceID,
			NotificationType: TypeLoanDueSoon,
			Title:            "Loan Due Soon",
			Message:          "Your loan is due in 3 days",
			Metadata:         metadata,
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		notification, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, notification)
		mockRepo.AssertNotCalled(t, "Save")
	})

	t.Run("error on save", func(t *testing.T) {
		input := CreateInput{
			UserID:           userID,
			WorkspaceID:      &workspaceID,
			NotificationType: TypeLoanDueSoon,
			Title:            "Loan Due Soon",
			Message:          "Your loan is due in 3 days",
			Metadata:         metadata,
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("Save", ctx, mock.AnythingOfType("*notification.Notification")).Return(assert.AnError)

		notification, err := svc.Create(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, notification)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_GetByID(t *testing.T) {
	ctx := context.Background()
	id := uuid.New()
	userID := uuid.New()

	notification := &Notification{
		id:     id,
		userID: userID,
		title:  "Test",
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindByID", ctx, id, userID).Return(notification, nil)

	result, err := svc.GetByID(ctx, id, userID)

	assert.NoError(t, err)
	assert.Equal(t, notification, result)

	mockRepo.AssertExpectations(t)
}

func TestService_ListUserNotifications(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	pagination := shared.Pagination{Page: 1, PageSize: 10}

	t.Run("success", func(t *testing.T) {
		notifications := []*Notification{
			{id: uuid.New(), userID: userID, title: "Notification 1"},
			{id: uuid.New(), userID: userID, title: "Notification 2"},
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByUser", ctx, userID, pagination).Return(notifications, 2, nil)

		result, err := svc.ListUserNotifications(ctx, userID, pagination)

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 2)
		assert.Equal(t, 2, result.Total)
		assert.Equal(t, 1, result.Page)

		mockRepo.AssertExpectations(t)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByUser", ctx, userID, pagination).Return(nil, 0, assert.AnError)

		result, err := svc.ListUserNotifications(ctx, userID, pagination)

		assert.Error(t, err)
		assert.Nil(t, result)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_GetUnreadNotifications(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	notifications := []*Notification{
		{id: uuid.New(), userID: userID, title: "Unread 1", isRead: false},
		{id: uuid.New(), userID: userID, title: "Unread 2", isRead: false},
	}

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("FindUnreadByUser", ctx, userID).Return(notifications, nil)

	result, err := svc.GetUnreadNotifications(ctx, userID)

	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.False(t, result[0].IsRead())
	assert.False(t, result[1].IsRead())

	mockRepo.AssertExpectations(t)
}

func TestService_MarkAsRead(t *testing.T) {
	ctx := context.Background()
	id := uuid.New()
	userID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("MarkAsRead", ctx, id, userID).Return(nil)

	err := svc.MarkAsRead(ctx, id, userID)

	assert.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestService_MarkAllAsRead(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("MarkAllAsRead", ctx, userID).Return(nil)

	err := svc.MarkAllAsRead(ctx, userID)

	assert.NoError(t, err)

	mockRepo.AssertExpectations(t)
}

func TestService_GetUnreadCount(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("GetUnreadCount", ctx, userID).Return(int64(5), nil)

	count, err := svc.GetUnreadCount(ctx, userID)

	assert.NoError(t, err)
	assert.Equal(t, int64(5), count)

	mockRepo.AssertExpectations(t)
}
