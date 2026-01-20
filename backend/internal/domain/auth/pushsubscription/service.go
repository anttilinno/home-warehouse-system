package pushsubscription

import (
	"context"

	"github.com/google/uuid"
)

// ServiceInterface defines the push subscription service operations.
type ServiceInterface interface {
	Subscribe(ctx context.Context, input SubscribeInput) (*PushSubscription, error)
	Unsubscribe(ctx context.Context, userID uuid.UUID, endpoint string) error
	UnsubscribeAll(ctx context.Context, userID uuid.UUID) error
	GetUserSubscriptions(ctx context.Context, userID uuid.UUID) ([]*PushSubscription, error)
	GetAllSubscriptions(ctx context.Context) ([]*PushSubscription, error)
	HasSubscription(ctx context.Context, userID uuid.UUID) (bool, error)
}

// Service handles push subscription business logic.
type Service struct {
	repo Repository
}

// NewService creates a new push subscription service.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// SubscribeInput holds the input for creating/updating a push subscription.
type SubscribeInput struct {
	UserID    uuid.UUID
	Endpoint  string
	P256dh    string
	Auth      string
	UserAgent *string
}

// Subscribe creates or updates a push subscription.
func (s *Service) Subscribe(ctx context.Context, input SubscribeInput) (*PushSubscription, error) {
	subscription, err := NewPushSubscription(
		input.UserID,
		input.Endpoint,
		input.P256dh,
		input.Auth,
		input.UserAgent,
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, subscription); err != nil {
		return nil, err
	}

	return subscription, nil
}

// Unsubscribe removes a push subscription by endpoint.
func (s *Service) Unsubscribe(ctx context.Context, userID uuid.UUID, endpoint string) error {
	return s.repo.DeleteByEndpoint(ctx, userID, endpoint)
}

// UnsubscribeAll removes all push subscriptions for a user.
func (s *Service) UnsubscribeAll(ctx context.Context, userID uuid.UUID) error {
	return s.repo.DeleteAllByUser(ctx, userID)
}

// GetUserSubscriptions retrieves all subscriptions for a user.
func (s *Service) GetUserSubscriptions(ctx context.Context, userID uuid.UUID) ([]*PushSubscription, error) {
	return s.repo.FindByUser(ctx, userID)
}

// GetAllSubscriptions retrieves all push subscriptions.
func (s *Service) GetAllSubscriptions(ctx context.Context) ([]*PushSubscription, error) {
	return s.repo.FindAll(ctx)
}

// HasSubscription checks if a user has any push subscriptions.
func (s *Service) HasSubscription(ctx context.Context, userID uuid.UUID) (bool, error) {
	count, err := s.repo.Count(ctx, userID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
