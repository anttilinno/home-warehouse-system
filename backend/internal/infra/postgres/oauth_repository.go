package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/oauth"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// OAuthRepository implements oauth.Repository using PostgreSQL via sqlc queries.
type OAuthRepository struct {
	pool *pgxpool.Pool
	q    *queries.Queries
}

// NewOAuthRepository creates a new OAuthRepository.
func NewOAuthRepository(pool *pgxpool.Pool) *OAuthRepository {
	return &OAuthRepository{
		pool: pool,
		q:    queries.New(pool),
	}
}

// FindByProviderAndID looks up an existing OAuth link by provider and provider user ID.
func (r *OAuthRepository) FindByProviderAndID(ctx context.Context, provider, providerUserID string) (*oauth.OAuthAccount, error) {
	row, err := r.q.GetOAuthAccountByProviderAndID(ctx, queries.GetOAuthAccountByProviderAndIDParams{
		Provider:       provider,
		ProviderUserID: providerUserID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return mapRowToOAuthAccount(row.ID, row.UserID, row.Provider, row.ProviderUserID, row.Email, row.DisplayName, row.AvatarUrl, row.CreatedAt.Time, row.UpdatedAt.Time), nil
}

// ListByUserID returns all OAuth accounts linked to a user.
func (r *OAuthRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*oauth.OAuthAccount, error) {
	rows, err := r.q.ListOAuthAccountsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	accounts := make([]*oauth.OAuthAccount, len(rows))
	for i, row := range rows {
		accounts[i] = mapRowToOAuthAccount(row.ID, row.UserID, row.Provider, row.ProviderUserID, row.Email, row.DisplayName, row.AvatarUrl, row.CreatedAt.Time, row.UpdatedAt.Time)
	}
	return accounts, nil
}

// Create creates a new OAuth account link for a user.
// Access token, refresh token, and token_expires_at are left NULL per project decision.
func (r *OAuthRepository) Create(ctx context.Context, userID uuid.UUID, profile oauth.OAuthProfile) (*oauth.OAuthAccount, error) {
	row, err := r.q.CreateOAuthAccount(ctx, queries.CreateOAuthAccountParams{
		UserID:         userID,
		Provider:       profile.Provider,
		ProviderUserID: profile.ProviderUserID,
		Email:          oauthStrPtr(profile.Email),
		DisplayName:    oauthStrPtr(profile.FullName),
		AvatarUrl:      oauthStrPtr(profile.AvatarURL),
	})
	if err != nil {
		return nil, err
	}

	return mapRowToOAuthAccount(row.ID, row.UserID, row.Provider, row.ProviderUserID, row.Email, row.DisplayName, row.AvatarUrl, row.CreatedAt.Time, row.UpdatedAt.Time), nil
}

// DeleteByProvider removes an OAuth link by user ID and provider.
func (r *OAuthRepository) DeleteByProvider(ctx context.Context, userID uuid.UUID, provider string) error {
	return r.q.DeleteOAuthAccountByProvider(ctx, queries.DeleteOAuthAccountByProviderParams{
		UserID:   userID,
		Provider: provider,
	})
}

// CountByUserID returns the number of OAuth accounts linked to a user.
func (r *OAuthRepository) CountByUserID(ctx context.Context, userID uuid.UUID) (int, error) {
	count, err := r.q.CountOAuthAccountsByUser(ctx, userID)
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

// mapRowToOAuthAccount converts sqlc row fields to a domain OAuthAccount entity.
func mapRowToOAuthAccount(
	id, userID uuid.UUID,
	provider, providerUserID string,
	email, displayName, avatarURL *string,
	createdAt, updatedAt time.Time,
) *oauth.OAuthAccount {
	return oauth.Reconstruct(
		id, userID,
		provider, providerUserID,
		oauthDerefStr(email), oauthDerefStr(displayName), oauthDerefStr(avatarURL),
		createdAt, updatedAt,
	)
}

// oauthStrPtr returns a pointer to s, or nil if s is empty.
func oauthStrPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// oauthDerefStr dereferences a string pointer, returning empty string for nil.
func oauthDerefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
