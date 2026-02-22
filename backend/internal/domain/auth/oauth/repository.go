package oauth

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the interface for OAuth account persistence.
type Repository interface {
	// FindByProviderAndID looks up an existing OAuth link by provider and provider user ID.
	FindByProviderAndID(ctx context.Context, provider, providerUserID string) (*OAuthAccount, error)

	// ListByUserID returns all OAuth accounts linked to a user.
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*OAuthAccount, error)

	// Create creates a new OAuth account link for a user.
	Create(ctx context.Context, userID uuid.UUID, profile OAuthProfile) (*OAuthAccount, error)

	// DeleteByProvider removes an OAuth link by user ID and provider.
	DeleteByProvider(ctx context.Context, userID uuid.UUID, provider string) error

	// CountByUserID returns the number of OAuth accounts linked to a user.
	CountByUserID(ctx context.Context, userID uuid.UUID) (int, error)
}
