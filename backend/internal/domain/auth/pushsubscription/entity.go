package pushsubscription

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// PushSubscription represents a web push subscription for a user device.
type PushSubscription struct {
	id        uuid.UUID
	userID    uuid.UUID
	endpoint  string
	p256dh    string
	auth      string
	userAgent *string
	createdAt time.Time
	updatedAt time.Time
}

// NewPushSubscription creates a new push subscription.
func NewPushSubscription(
	userID uuid.UUID,
	endpoint, p256dh, auth string,
	userAgent *string,
) (*PushSubscription, error) {
	if err := shared.ValidateUUID(userID, "user_id"); err != nil {
		return nil, err
	}
	if endpoint == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "endpoint", "push subscription endpoint is required")
	}
	if p256dh == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "p256dh", "push subscription p256dh key is required")
	}
	if auth == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "auth", "push subscription auth secret is required")
	}

	now := time.Now()
	return &PushSubscription{
		id:        shared.NewUUID(),
		userID:    userID,
		endpoint:  endpoint,
		p256dh:    p256dh,
		auth:      auth,
		userAgent: userAgent,
		createdAt: now,
		updatedAt: now,
	}, nil
}

// Reconstruct recreates a push subscription from stored data.
func Reconstruct(
	id, userID uuid.UUID,
	endpoint, p256dh, auth string,
	userAgent *string,
	createdAt, updatedAt time.Time,
) *PushSubscription {
	return &PushSubscription{
		id:        id,
		userID:    userID,
		endpoint:  endpoint,
		p256dh:    p256dh,
		auth:      auth,
		userAgent: userAgent,
		createdAt: createdAt,
		updatedAt: updatedAt,
	}
}

// ID returns the subscription's ID.
func (s *PushSubscription) ID() uuid.UUID { return s.id }

// UserID returns the user ID.
func (s *PushSubscription) UserID() uuid.UUID { return s.userID }

// Endpoint returns the push service endpoint URL.
func (s *PushSubscription) Endpoint() string { return s.endpoint }

// P256dh returns the client public key.
func (s *PushSubscription) P256dh() string { return s.p256dh }

// Auth returns the authentication secret.
func (s *PushSubscription) Auth() string { return s.auth }

// UserAgent returns the device user agent string.
func (s *PushSubscription) UserAgent() *string { return s.userAgent }

// CreatedAt returns when the subscription was created.
func (s *PushSubscription) CreatedAt() time.Time { return s.createdAt }

// UpdatedAt returns when the subscription was last updated.
func (s *PushSubscription) UpdatedAt() time.Time { return s.updatedAt }

// Update updates the subscription keys.
func (s *PushSubscription) Update(p256dh, auth string, userAgent *string) {
	s.p256dh = p256dh
	s.auth = auth
	s.userAgent = userAgent
	s.updatedAt = time.Now()
}
