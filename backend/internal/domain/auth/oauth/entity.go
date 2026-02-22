package oauth

import (
	"time"

	"github.com/google/uuid"
)

// OAuthAccount represents a linked external OAuth provider account.
type OAuthAccount struct {
	id             uuid.UUID
	userID         uuid.UUID
	provider       string
	providerUserID string
	email          string
	displayName    string
	avatarURL      string
	createdAt      time.Time
	updatedAt      time.Time
}

// Reconstruct recreates an OAuthAccount from stored data.
func Reconstruct(
	id, userID uuid.UUID,
	provider, providerUserID, email, displayName, avatarURL string,
	createdAt, updatedAt time.Time,
) *OAuthAccount {
	return &OAuthAccount{
		id:             id,
		userID:         userID,
		provider:       provider,
		providerUserID: providerUserID,
		email:          email,
		displayName:    displayName,
		avatarURL:      avatarURL,
		createdAt:      createdAt,
		updatedAt:      updatedAt,
	}
}

// ID returns the account ID.
func (a *OAuthAccount) ID() uuid.UUID { return a.id }

// UserID returns the linked user ID.
func (a *OAuthAccount) UserID() uuid.UUID { return a.userID }

// Provider returns the provider name (e.g. "google", "github").
func (a *OAuthAccount) Provider() string { return a.provider }

// ProviderUserID returns the user's ID at the provider.
func (a *OAuthAccount) ProviderUserID() string { return a.providerUserID }

// Email returns the email associated with this OAuth account.
func (a *OAuthAccount) Email() string { return a.email }

// DisplayName returns the display name from the provider.
func (a *OAuthAccount) DisplayName() string { return a.displayName }

// AvatarURL returns the avatar URL from the provider.
func (a *OAuthAccount) AvatarURL() string { return a.avatarURL }

// CreatedAt returns when the account was linked.
func (a *OAuthAccount) CreatedAt() time.Time { return a.createdAt }

// UpdatedAt returns when the account was last updated.
func (a *OAuthAccount) UpdatedAt() time.Time { return a.updatedAt }

// OAuthProfile is a value object returned by provider profile fetchers.
// It holds the normalized profile data from an OAuth provider.
type OAuthProfile struct {
	Provider       string
	ProviderUserID string
	Email          string
	EmailVerified  bool
	FullName       string
	AvatarURL      string
}
