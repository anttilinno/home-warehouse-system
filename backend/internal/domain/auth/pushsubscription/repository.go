package pushsubscription

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for push subscription persistence.
type Repository interface {
	// Save persists a push subscription (upsert by user_id + endpoint).
	Save(ctx context.Context, subscription *PushSubscription) error

	// FindByID retrieves a subscription by ID.
	FindByID(ctx context.Context, id uuid.UUID) (*PushSubscription, error)

	// FindByEndpoint retrieves a subscription by user ID and endpoint.
	FindByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) (*PushSubscription, error)

	// FindByUser retrieves all subscriptions for a user.
	FindByUser(ctx context.Context, userID uuid.UUID) ([]*PushSubscription, error)

	// FindAll retrieves all push subscriptions.
	FindAll(ctx context.Context) ([]*PushSubscription, error)

	// Delete removes a subscription by ID.
	Delete(ctx context.Context, id uuid.UUID) error

	// DeleteByEndpoint removes a subscription by user ID and endpoint.
	DeleteByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) error

	// DeleteAllByUser removes all subscriptions for a user.
	DeleteAllByUser(ctx context.Context, userID uuid.UUID) error

	// Count returns the number of subscriptions for a user.
	Count(ctx context.Context, userID uuid.UUID) (int64, error)
}
