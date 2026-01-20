package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/pushsubscription"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// PushSubscriptionRepository implements pushsubscription.Repository using PostgreSQL.
type PushSubscriptionRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewPushSubscriptionRepository creates a new PushSubscriptionRepository.
func NewPushSubscriptionRepository(pool *pgxpool.Pool) *PushSubscriptionRepository {
	return &PushSubscriptionRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// Save persists a push subscription (upsert by user_id + endpoint).
func (r *PushSubscriptionRepository) Save(ctx context.Context, s *pushsubscription.PushSubscription) error {
	_, err := r.queries.CreatePushSubscription(ctx, queries.CreatePushSubscriptionParams{
		ID:        s.ID(),
		UserID:    s.UserID(),
		Endpoint:  s.Endpoint(),
		P256dh:    s.P256dh(),
		Auth:      s.Auth(),
		UserAgent: s.UserAgent(),
	})
	return err
}

// FindByID retrieves a subscription by ID.
func (r *PushSubscriptionRepository) FindByID(ctx context.Context, id uuid.UUID) (*pushsubscription.PushSubscription, error) {
	row, err := r.queries.GetPushSubscription(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pushsubscription.ErrSubscriptionNotFound
		}
		return nil, err
	}

	return r.rowToSubscription(row), nil
}

// FindByEndpoint retrieves a subscription by user ID and endpoint.
func (r *PushSubscriptionRepository) FindByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) (*pushsubscription.PushSubscription, error) {
	row, err := r.queries.GetPushSubscriptionByEndpoint(ctx, queries.GetPushSubscriptionByEndpointParams{
		UserID:   userID,
		Endpoint: endpoint,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pushsubscription.ErrSubscriptionNotFound
		}
		return nil, err
	}

	return r.rowToSubscription(row), nil
}

// FindByUser retrieves all subscriptions for a user.
func (r *PushSubscriptionRepository) FindByUser(ctx context.Context, userID uuid.UUID) ([]*pushsubscription.PushSubscription, error) {
	rows, err := r.queries.ListPushSubscriptionsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	subscriptions := make([]*pushsubscription.PushSubscription, 0, len(rows))
	for _, row := range rows {
		subscriptions = append(subscriptions, r.rowToSubscription(row))
	}

	return subscriptions, nil
}

// FindAll retrieves all push subscriptions.
func (r *PushSubscriptionRepository) FindAll(ctx context.Context) ([]*pushsubscription.PushSubscription, error) {
	rows, err := r.queries.ListAllPushSubscriptions(ctx)
	if err != nil {
		return nil, err
	}

	subscriptions := make([]*pushsubscription.PushSubscription, 0, len(rows))
	for _, row := range rows {
		subscriptions = append(subscriptions, r.rowToSubscription(row))
	}

	return subscriptions, nil
}

// Delete removes a subscription by ID.
func (r *PushSubscriptionRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeletePushSubscription(ctx, id)
}

// DeleteByEndpoint removes a subscription by user ID and endpoint.
func (r *PushSubscriptionRepository) DeleteByEndpoint(ctx context.Context, userID uuid.UUID, endpoint string) error {
	return r.queries.DeletePushSubscriptionByEndpoint(ctx, queries.DeletePushSubscriptionByEndpointParams{
		UserID:   userID,
		Endpoint: endpoint,
	})
}

// DeleteAllByUser removes all subscriptions for a user.
func (r *PushSubscriptionRepository) DeleteAllByUser(ctx context.Context, userID uuid.UUID) error {
	return r.queries.DeleteAllPushSubscriptionsByUser(ctx, userID)
}

// Count returns the number of subscriptions for a user.
func (r *PushSubscriptionRepository) Count(ctx context.Context, userID uuid.UUID) (int64, error) {
	return r.queries.CountPushSubscriptionsByUser(ctx, userID)
}

// rowToSubscription converts a database row to a PushSubscription entity.
func (r *PushSubscriptionRepository) rowToSubscription(row queries.AuthPushSubscription) *pushsubscription.PushSubscription {
	return pushsubscription.Reconstruct(
		row.ID,
		row.UserID,
		row.Endpoint,
		row.P256dh,
		row.Auth,
		row.UserAgent,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
