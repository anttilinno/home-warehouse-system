//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/oauth"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestOAuthRepository_CreateAndFindByProviderAndID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewOAuthRepository(pool)
	ctx := context.Background()

	t.Run("creates a link and finds it by provider and provider user id", func(t *testing.T) {
		providerUserID := "google-" + uuid.New().String()[:8]
		profile := oauth.OAuthProfile{
			Provider:       "google",
			ProviderUserID: providerUserID,
			Email:          "linked-" + uuid.New().String()[:8] + "@example.com",
			FullName:       "Linked User",
			AvatarURL:      "https://example.com/avatar.png",
		}

		created, err := repo.Create(ctx, testfixtures.TestUserID, profile)
		require.NoError(t, err)
		require.NotNil(t, created)
		assert.Equal(t, testfixtures.TestUserID, created.UserID())
		assert.Equal(t, "google", created.Provider())
		assert.Equal(t, providerUserID, created.ProviderUserID())
		assert.Equal(t, profile.Email, created.Email())
		assert.Equal(t, profile.FullName, created.DisplayName())
		assert.Equal(t, profile.AvatarURL, created.AvatarURL())

		found, err := repo.FindByProviderAndID(ctx, "google", providerUserID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, created.ID(), found.ID())
		assert.Equal(t, testfixtures.TestUserID, found.UserID())
	})

	t.Run("returns nil, nil for an unknown provider/provider-user-id pair", func(t *testing.T) {
		found, err := repo.FindByProviderAndID(ctx, "google", "no-such-provider-user-"+uuid.New().String())
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestOAuthRepository_CrossUserCollision(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewOAuthRepository(pool)
	ctx := context.Background()

	t.Run("second user cannot link the same provider account", func(t *testing.T) {
		providerUserID := "github-" + uuid.New().String()[:8]

		otherUserID := uuid.New()
		_, err := pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Other OAuth User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, otherUserID, "other-oauth-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		firstProfile := oauth.OAuthProfile{
			Provider:       "github",
			ProviderUserID: providerUserID,
			Email:          "first-" + uuid.New().String()[:8] + "@example.com",
			FullName:       "First Linker",
		}
		first, err := repo.Create(ctx, testfixtures.TestUserID, firstProfile)
		require.NoError(t, err)
		require.NotNil(t, first)

		// A second user attempting to link the SAME provider + provider-user-id
		// must fail (unique constraint on (provider, provider_user_id)) rather
		// than silently stealing or duplicating the link.
		secondProfile := oauth.OAuthProfile{
			Provider:       "github",
			ProviderUserID: providerUserID,
			Email:          "second-" + uuid.New().String()[:8] + "@example.com",
			FullName:       "Second Linker",
		}
		second, err := repo.Create(ctx, otherUserID, secondProfile)
		require.Error(t, err)
		assert.Nil(t, second)

		// The original link must still point at the first user, untouched.
		found, err := repo.FindByProviderAndID(ctx, "github", providerUserID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, testfixtures.TestUserID, found.UserID())
		assert.Equal(t, first.ID(), found.ID())
	})
}

func TestOAuthRepository_ListByUserID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewOAuthRepository(pool)
	ctx := context.Background()

	t.Run("lists all accounts linked to a user, scoped to that user", func(t *testing.T) {
		userA := uuid.New()
		userB := uuid.New()
		for _, id := range []uuid.UUID{userA, userB} {
			_, err := pool.Exec(ctx, `
				INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
				VALUES ($1, $2, 'List OAuth User', '$2a$10$dummy_hash', false, NOW(), NOW())
			`, id, "list-oauth-"+uuid.New().String()[:8]+"@example.com")
			require.NoError(t, err)
		}

		_, err := repo.Create(ctx, userA, oauth.OAuthProfile{
			Provider:       "google",
			ProviderUserID: "list-google-" + uuid.New().String()[:8],
			Email:          "a-google@example.com",
		})
		require.NoError(t, err)
		_, err = repo.Create(ctx, userA, oauth.OAuthProfile{
			Provider:       "github",
			ProviderUserID: "list-github-" + uuid.New().String()[:8],
			Email:          "a-github@example.com",
		})
		require.NoError(t, err)
		_, err = repo.Create(ctx, userB, oauth.OAuthProfile{
			Provider:       "google",
			ProviderUserID: "list-google-b-" + uuid.New().String()[:8],
			Email:          "b-google@example.com",
		})
		require.NoError(t, err)

		accountsA, err := repo.ListByUserID(ctx, userA)
		require.NoError(t, err)
		assert.Len(t, accountsA, 2)

		accountsB, err := repo.ListByUserID(ctx, userB)
		require.NoError(t, err)
		assert.Len(t, accountsB, 1)
	})

	t.Run("returns empty for a user with no linked accounts", func(t *testing.T) {
		accounts, err := repo.ListByUserID(ctx, uuid.New())
		require.NoError(t, err)
		assert.Empty(t, accounts)
	})
}

func TestOAuthRepository_CountByUserID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewOAuthRepository(pool)
	ctx := context.Background()

	t.Run("counts linked accounts for a user", func(t *testing.T) {
		userID := uuid.New()
		_, err := pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Count OAuth User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "count-oauth-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		count, err := repo.CountByUserID(ctx, userID)
		require.NoError(t, err)
		assert.Equal(t, 0, count)

		_, err = repo.Create(ctx, userID, oauth.OAuthProfile{
			Provider:       "google",
			ProviderUserID: "count-google-" + uuid.New().String()[:8],
			Email:          "count-google@example.com",
		})
		require.NoError(t, err)

		count, err = repo.CountByUserID(ctx, userID)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
	})
}

func TestOAuthRepository_DeleteByProvider(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewOAuthRepository(pool)
	ctx := context.Background()

	t.Run("deletes the link for a provider without touching other providers", func(t *testing.T) {
		userID := uuid.New()
		_, err := pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Delete OAuth User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "delete-oauth-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		_, err = repo.Create(ctx, userID, oauth.OAuthProfile{
			Provider:       "google",
			ProviderUserID: "delete-google-" + uuid.New().String()[:8],
			Email:          "delete-google@example.com",
		})
		require.NoError(t, err)
		_, err = repo.Create(ctx, userID, oauth.OAuthProfile{
			Provider:       "github",
			ProviderUserID: "delete-github-" + uuid.New().String()[:8],
			Email:          "delete-github@example.com",
		})
		require.NoError(t, err)

		require.NoError(t, repo.DeleteByProvider(ctx, userID, "google"))

		remaining, err := repo.ListByUserID(ctx, userID)
		require.NoError(t, err)
		require.Len(t, remaining, 1)
		assert.Equal(t, "github", remaining[0].Provider())
	})

	t.Run("delete of non-existent link does not error", func(t *testing.T) {
		require.NoError(t, repo.DeleteByProvider(ctx, uuid.New(), "google"))
	})
}
