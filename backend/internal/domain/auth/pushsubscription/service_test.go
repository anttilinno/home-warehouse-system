package pushsubscription

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockRepository is a mock implementation of the Repository interface.
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) Save(ctx context.Context, subscription *PushSubscription) error {
	args := m.Called(ctx, subscription)
	return args.Error(0)
}

func (m *MockRepository) FindByID(ctx context.Context, id uuid.UUID) (*PushSubscription, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*PushSubscription), args.Error(1)
}

func (m *MockRepository) FindByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) (*PushSubscription, error) {
	args := m.Called(ctx, userID, endpoint)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*PushSubscription), args.Error(1)
}

func (m *MockRepository) FindByUser(ctx context.Context, userID uuid.UUID) ([]*PushSubscription, error) {
	args := m.Called(ctx, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*PushSubscription), args.Error(1)
}

func (m *MockRepository) FindAll(ctx context.Context) ([]*PushSubscription, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*PushSubscription), args.Error(1)
}

func (m *MockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockRepository) DeleteByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) error {
	args := m.Called(ctx, userID, endpoint)
	return args.Error(0)
}

func (m *MockRepository) DeleteAllByUser(ctx context.Context, userID uuid.UUID) error {
	args := m.Called(ctx, userID)
	return args.Error(0)
}

func (m *MockRepository) Count(ctx context.Context, userID uuid.UUID) (int64, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).(int64), args.Error(1)
}

func TestService_Subscribe(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		input := SubscribeInput{
			UserID:   userID,
			Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
			P256dh:   "p256dh-key",
			Auth:     "auth-secret",
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("Save", ctx, mock.AnythingOfType("*pushsubscription.PushSubscription")).Return(nil)

		sub, err := svc.Subscribe(ctx, input)

		assert.NoError(t, err)
		assert.NotNil(t, sub)
		assert.Equal(t, userID, sub.UserID())
		assert.Equal(t, input.Endpoint, sub.Endpoint())

		mockRepo.AssertExpectations(t)
	})

	t.Run("error on invalid input", func(t *testing.T) {
		input := SubscribeInput{
			UserID:   userID,
			Endpoint: "https://localhost/push", // SSRF-rejected endpoint
			P256dh:   "p256dh-key",
			Auth:     "auth-secret",
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		sub, err := svc.Subscribe(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, sub)
		mockRepo.AssertNotCalled(t, "Save")
	})

	t.Run("error on save", func(t *testing.T) {
		input := SubscribeInput{
			UserID:   userID,
			Endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
			P256dh:   "p256dh-key",
			Auth:     "auth-secret",
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("Save", ctx, mock.AnythingOfType("*pushsubscription.PushSubscription")).Return(assert.AnError)

		sub, err := svc.Subscribe(ctx, input)

		assert.Error(t, err)
		assert.Nil(t, sub)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_Unsubscribe(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	endpoint := "https://fcm.googleapis.com/fcm/send/abc123"

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("DeleteByEndpoint", ctx, userID, endpoint).Return(nil)

		err := svc.Unsubscribe(ctx, userID, endpoint)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("DeleteByEndpoint", ctx, userID, endpoint).Return(assert.AnError)

		err := svc.Unsubscribe(ctx, userID, endpoint)

		assert.Error(t, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_UnsubscribeAll(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("DeleteAllByUser", ctx, userID).Return(nil)

		err := svc.UnsubscribeAll(ctx, userID)

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("DeleteAllByUser", ctx, userID).Return(assert.AnError)

		err := svc.UnsubscribeAll(ctx, userID)

		assert.Error(t, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_GetUserSubscriptions(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		subs := []*PushSubscription{
			{id: uuid.New(), userID: userID, endpoint: "https://fcm.googleapis.com/fcm/send/a"},
			{id: uuid.New(), userID: userID, endpoint: "https://fcm.googleapis.com/fcm/send/b"},
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByUser", ctx, userID).Return(subs, nil)

		result, err := svc.GetUserSubscriptions(ctx, userID)

		assert.NoError(t, err)
		assert.Len(t, result, 2)
		mockRepo.AssertExpectations(t)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindByUser", ctx, userID).Return(nil, assert.AnError)

		result, err := svc.GetUserSubscriptions(ctx, userID)

		assert.Error(t, err)
		assert.Nil(t, result)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_GetAllSubscriptions(t *testing.T) {
	ctx := context.Background()

	t.Run("success", func(t *testing.T) {
		subs := []*PushSubscription{
			{id: uuid.New(), endpoint: "https://fcm.googleapis.com/fcm/send/a"},
		}

		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindAll", ctx).Return(subs, nil)

		result, err := svc.GetAllSubscriptions(ctx)

		assert.NoError(t, err)
		assert.Len(t, result, 1)
		mockRepo.AssertExpectations(t)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("FindAll", ctx).Return(nil, assert.AnError)

		result, err := svc.GetAllSubscriptions(ctx)

		assert.Error(t, err)
		assert.Nil(t, result)
		mockRepo.AssertExpectations(t)
	})
}

func TestService_HasSubscription(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("true when count is positive", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("Count", ctx, userID).Return(int64(3), nil)

		has, err := svc.HasSubscription(ctx, userID)

		assert.NoError(t, err)
		assert.True(t, has)
		mockRepo.AssertExpectations(t)
	})

	t.Run("false when count is zero", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("Count", ctx, userID).Return(int64(0), nil)

		has, err := svc.HasSubscription(ctx, userID)

		assert.NoError(t, err)
		assert.False(t, has)
		mockRepo.AssertExpectations(t)
	})

	t.Run("error on repository failure", func(t *testing.T) {
		mockRepo := new(MockRepository)
		svc := NewService(mockRepo)

		mockRepo.On("Count", ctx, userID).Return(int64(0), assert.AnError)

		has, err := svc.HasSubscription(ctx, userID)

		assert.Error(t, err)
		assert.False(t, has)
		mockRepo.AssertExpectations(t)
	})
}
