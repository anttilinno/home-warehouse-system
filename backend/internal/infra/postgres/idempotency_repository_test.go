//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/idempotency"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

func TestIdempotencyRepository_SaveIdempotencyKey(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewIdempotencyRepository(pool)
	ctx := context.Background()

	t.Run("replayed save with the same key returns the first entity, no double-write", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)
		key := "idem-key-" + uuid.New().String()
		firstEntityID := uuid.New()
		secondEntityID := uuid.New()

		require.NoError(t, repo.SaveIdempotencyKey(ctx, wsID, key, idempotency.TypeItem, firstEntityID))
		require.NoError(t, repo.SaveIdempotencyKey(ctx, wsID, key, idempotency.TypeItem, secondEntityID))

		entityID, found, err := repo.FindByIdempotencyKey(ctx, wsID, key)
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, firstEntityID, entityID, "second save must not overwrite the first entity")

		var n int
		require.NoError(t, pool.QueryRow(ctx,
			`SELECT count(*) FROM warehouse.idempotency_keys WHERE workspace_id = $1 AND idempotency_key = $2`,
			wsID, key).Scan(&n))
		assert.Equal(t, 1, n, "exactly one row must exist for the (workspace, key) pair")
	})

	t.Run("different keys in the same workspace are independent", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)
		entityA := uuid.New()
		entityB := uuid.New()

		require.NoError(t, repo.SaveIdempotencyKey(ctx, wsID, "key-a", idempotency.TypeItem, entityA))
		require.NoError(t, repo.SaveIdempotencyKey(ctx, wsID, "key-b", idempotency.TypeContainer, entityB))

		gotA, found, err := repo.FindByIdempotencyKey(ctx, wsID, "key-a")
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, entityA, gotA)

		gotB, found, err := repo.FindByIdempotencyKey(ctx, wsID, "key-b")
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, entityB, gotB)
	})

	t.Run("same key in different workspaces is independent", func(t *testing.T) {
		wsA := uuid.New()
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		testdb.CreateTestWorkspace(t, pool, wsB)
		key := "shared-key-" + uuid.New().String()
		entityA := uuid.New()
		entityB := uuid.New()

		require.NoError(t, repo.SaveIdempotencyKey(ctx, wsA, key, idempotency.TypeItem, entityA))
		require.NoError(t, repo.SaveIdempotencyKey(ctx, wsB, key, idempotency.TypeItem, entityB))

		gotA, found, err := repo.FindByIdempotencyKey(ctx, wsA, key)
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, entityA, gotA)

		gotB, found, err := repo.FindByIdempotencyKey(ctx, wsB, key)
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, entityB, gotB)
	})
}

func TestIdempotencyRepository_FindByIdempotencyKey_NotFound(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewIdempotencyRepository(pool)
	ctx := context.Background()

	t.Run("returns not-found for an unknown key", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)

		entityID, found, err := repo.FindByIdempotencyKey(ctx, wsID, "never-saved")
		require.NoError(t, err)
		assert.False(t, found)
		assert.Equal(t, uuid.Nil, entityID)
	})
}
