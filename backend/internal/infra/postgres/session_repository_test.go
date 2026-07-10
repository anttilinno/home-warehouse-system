//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/session"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestSessionRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("saves new session successfully", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-1", "Mozilla/5.0", "192.168.1.1", time.Now().Add(time.Hour))

		err := repo.Save(ctx, s)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, s.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, s.ID(), retrieved.ID())
		assert.Equal(t, s.UserID(), retrieved.UserID())
		assert.Equal(t, s.TokenHash(), retrieved.TokenHash())
		assert.Equal(t, s.IPAddress(), retrieved.IPAddress())
	})
}

func TestSessionRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("finds existing session", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-2", "Mozilla/5.0", "10.0.0.1", time.Now().Add(time.Hour))
		require.NoError(t, repo.Save(ctx, s))

		found, err := repo.FindByID(ctx, s.ID())
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, s.ID(), found.ID())
	})

	t.Run("returns nil for non-existent session", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New())
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("excludes expired session", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-expired", "Mozilla/5.0", "10.0.0.2", time.Now().Add(-time.Hour))
		require.NoError(t, repo.Save(ctx, s))

		found, err := repo.FindByID(ctx, s.ID())
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestSessionRepository_FindByTokenHash(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("finds session by token hash", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-3", "Mozilla/5.0", "10.0.0.3", time.Now().Add(time.Hour))
		require.NoError(t, repo.Save(ctx, s))

		found, err := repo.FindByTokenHash(ctx, session.HashToken("refresh-token-3"))
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, s.ID(), found.ID())
	})

	t.Run("excludes expired session by token hash", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-expired-2", "Mozilla/5.0", "10.0.0.4", time.Now().Add(-time.Hour))
		require.NoError(t, repo.Save(ctx, s))

		found, err := repo.FindByTokenHash(ctx, session.HashToken("refresh-token-expired-2"))
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("returns nil for unknown token hash", func(t *testing.T) {
		found, err := repo.FindByTokenHash(ctx, session.HashToken("never-issued"))
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestSessionRepository_FindByUserID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("lists only active sessions for the user", func(t *testing.T) {
		active1 := session.NewSession(testfixtures.TestUserID, "refresh-token-active-1", "Mozilla/5.0", "10.0.0.5", time.Now().Add(time.Hour))
		active2 := session.NewSession(testfixtures.TestUserID, "refresh-token-active-2", "Mozilla/5.0", "10.0.0.6", time.Now().Add(2*time.Hour))
		expired := session.NewSession(testfixtures.TestUserID, "refresh-token-active-expired", "Mozilla/5.0", "10.0.0.7", time.Now().Add(-time.Hour))
		require.NoError(t, repo.Save(ctx, active1))
		require.NoError(t, repo.Save(ctx, active2))
		require.NoError(t, repo.Save(ctx, expired))

		sessions, err := repo.FindByUserID(ctx, testfixtures.TestUserID)
		require.NoError(t, err)

		ids := make([]uuid.UUID, len(sessions))
		for i, s := range sessions {
			ids[i] = s.ID()
		}
		assert.Contains(t, ids, active1.ID())
		assert.Contains(t, ids, active2.ID())
		assert.NotContains(t, ids, expired.ID())
	})

	t.Run("returns empty for user with no sessions", func(t *testing.T) {
		sessions, err := repo.FindByUserID(ctx, uuid.New())
		require.NoError(t, err)
		assert.Empty(t, sessions)
	})
}

func TestSessionRepository_UpdateActivity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("rotates token hash and bumps last active time", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-old", "Mozilla/5.0", "10.0.0.8", time.Now().Add(time.Hour))
		require.NoError(t, repo.Save(ctx, s))

		newHash := session.HashToken("refresh-token-new")
		require.NoError(t, repo.UpdateActivity(ctx, s.ID(), newHash))

		found, err := repo.FindByID(ctx, s.ID())
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, newHash, found.TokenHash())
		assert.True(t, found.LastActiveAt().After(s.LastActiveAt()) || found.LastActiveAt().Equal(s.LastActiveAt()))
	})
}

func TestSessionRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("revokes a session owned by the user", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-delete", "Mozilla/5.0", "10.0.0.9", time.Now().Add(time.Hour))
		require.NoError(t, repo.Save(ctx, s))

		require.NoError(t, repo.Delete(ctx, s.ID(), testfixtures.TestUserID))

		found, err := repo.FindByID(ctx, s.ID())
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("does not delete a session owned by another user", func(t *testing.T) {
		s := session.NewSession(testfixtures.TestUserID, "refresh-token-wrong-owner", "Mozilla/5.0", "10.0.0.10", time.Now().Add(time.Hour))
		require.NoError(t, repo.Save(ctx, s))

		require.NoError(t, repo.Delete(ctx, s.ID(), uuid.New()))

		found, err := repo.FindByID(ctx, s.ID())
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestSessionRepository_DeleteAllExcept(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("revokes every session except the given one", func(t *testing.T) {
		keep := session.NewSession(testfixtures.TestUserID, "refresh-token-keep", "Mozilla/5.0", "10.0.0.11", time.Now().Add(time.Hour))
		other1 := session.NewSession(testfixtures.TestUserID, "refresh-token-other-1", "Mozilla/5.0", "10.0.0.12", time.Now().Add(time.Hour))
		other2 := session.NewSession(testfixtures.TestUserID, "refresh-token-other-2", "Mozilla/5.0", "10.0.0.13", time.Now().Add(time.Hour))
		require.NoError(t, repo.Save(ctx, keep))
		require.NoError(t, repo.Save(ctx, other1))
		require.NoError(t, repo.Save(ctx, other2))

		require.NoError(t, repo.DeleteAllExcept(ctx, testfixtures.TestUserID, keep.ID()))

		found, err := repo.FindByID(ctx, keep.ID())
		require.NoError(t, err)
		assert.NotNil(t, found)

		found, err = repo.FindByID(ctx, other1.ID())
		require.NoError(t, err)
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, other2.ID())
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestSessionRepository_DeleteAllForUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewSessionRepository(pool)
	ctx := context.Background()

	t.Run("revokes every session for the user", func(t *testing.T) {
		s1 := session.NewSession(testfixtures.TestUserID, "refresh-token-logout-1", "Mozilla/5.0", "10.0.0.14", time.Now().Add(time.Hour))
		s2 := session.NewSession(testfixtures.TestUserID, "refresh-token-logout-2", "Mozilla/5.0", "10.0.0.15", time.Now().Add(time.Hour))
		require.NoError(t, repo.Save(ctx, s1))
		require.NoError(t, repo.Save(ctx, s2))

		require.NoError(t, repo.DeleteAllForUser(ctx, testfixtures.TestUserID))

		sessions, err := repo.FindByUserID(ctx, testfixtures.TestUserID)
		require.NoError(t, err)
		assert.Empty(t, sessions)
	})
}
