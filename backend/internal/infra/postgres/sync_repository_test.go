//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/activity"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/deleted"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// syncRepos bundles the repositories needed to exercise the delta-sync queries.
type syncRepos struct {
	sync    *SyncRepository
	item    *ItemRepository
	deleted *DeletedRepository
}

func newSyncRepos(pool *pgxpool.Pool) syncRepos {
	return syncRepos{
		sync:    NewSyncRepository(pool),
		item:    NewItemRepository(pool),
		deleted: NewDeletedRepository(pool),
	}
}

func TestSyncRepository_ListItemsModifiedSince(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repos := newSyncRepos(pool)
	ctx := context.Background()

	t.Run("returns only items modified after cutoff, scoped by workspace", func(t *testing.T) {
		workspaceA := uuid.New()
		workspaceB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceA)
		testdb.CreateTestWorkspace(t, pool, workspaceB)

		oldItem, err := item.NewItem(workspaceA, "Old Item", "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, err)
		oldItem.SetShortCode(uuid.NewString()[:8])
		require.NoError(t, repos.item.Save(ctx, oldItem))

		// Read the DB-assigned updated_at back so the cutoff is anchored to the
		// database's own clock rather than the test process's, which avoids any
		// client/server clock-skew flakiness.
		saved, err := repos.item.FindByID(ctx, oldItem.ID(), workspaceA)
		require.NoError(t, err)
		cutoff := saved.UpdatedAt()

		time.Sleep(10 * time.Millisecond)

		newItem, err := item.NewItem(workspaceA, "New Item", "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, err)
		newItem.SetShortCode(uuid.NewString()[:8])
		require.NoError(t, repos.item.Save(ctx, newItem))

		otherWorkspaceItem, err := item.NewItem(workspaceB, "Other Workspace Item", "SKU-"+uuid.NewString()[:8], 0)
		require.NoError(t, err)
		otherWorkspaceItem.SetShortCode(uuid.NewString()[:8])
		require.NoError(t, repos.item.Save(ctx, otherWorkspaceItem))

		rows, err := repos.sync.ListItemsModifiedSince(ctx, workspaceA, cutoff, 10)
		require.NoError(t, err)

		ids := make([]uuid.UUID, len(rows))
		for i, row := range rows {
			ids[i] = row.ID
		}
		assert.Contains(t, ids, newItem.ID())
		assert.NotContains(t, ids, oldItem.ID())
		assert.NotContains(t, ids, otherWorkspaceItem.ID())
	})

	t.Run("limit caps the number of rows returned", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		cutoff := time.Now().Add(-time.Hour)

		for i := 0; i < 3; i++ {
			itm, err := item.NewItem(workspaceID, "Limit Item", "SKU-"+uuid.NewString()[:8], 0)
			require.NoError(t, err)
			itm.SetShortCode(uuid.NewString()[:8])
			require.NoError(t, repos.item.Save(ctx, itm))
		}

		rows, err := repos.sync.ListItemsModifiedSince(ctx, workspaceID, cutoff, 2)
		require.NoError(t, err)
		assert.Len(t, rows, 2)
	})
}

func TestSyncRepository_ListDeletedRecordsModifiedSince(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repos := newSyncRepos(pool)
	ctx := context.Background()

	t.Run("returns only tombstones after cutoff, scoped by workspace, with entity fields intact", func(t *testing.T) {
		workspaceA := uuid.New()
		workspaceB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceA)
		testdb.CreateTestWorkspace(t, pool, workspaceB)

		oldRecord, err := deleted.NewDeletedRecord(workspaceA, activity.EntityItem, uuid.New(), nil)
		require.NoError(t, err)
		require.NoError(t, repos.deleted.Save(ctx, oldRecord))

		// Anchor the cutoff to the DB-assigned deleted_at (Save doesn't send the
		// domain object's timestamp; the column defaults on insert), same reasoning
		// as the items case above.
		seeded, err := repos.deleted.FindSince(ctx, workspaceA, time.Now().Add(-time.Hour))
		require.NoError(t, err)
		require.Len(t, seeded, 1)
		cutoff := seeded[0].DeletedAt()

		time.Sleep(10 * time.Millisecond)

		newEntityID := uuid.New()
		newRecord, err := deleted.NewDeletedRecord(workspaceA, activity.EntityLocation, newEntityID, nil)
		require.NoError(t, err)
		require.NoError(t, repos.deleted.Save(ctx, newRecord))

		otherWorkspaceRecord, err := deleted.NewDeletedRecord(workspaceB, activity.EntityItem, uuid.New(), nil)
		require.NoError(t, err)
		require.NoError(t, repos.deleted.Save(ctx, otherWorkspaceRecord))

		rows, err := repos.sync.ListDeletedRecordsModifiedSince(ctx, workspaceA, cutoff, 10)
		require.NoError(t, err)

		require.Len(t, rows, 1)
		assert.Equal(t, newEntityID, rows[0].EntityID)
		assert.Equal(t, string(activity.EntityLocation), string(rows[0].EntityType))
		assert.Equal(t, workspaceA, rows[0].WorkspaceID)
	})

	t.Run("limit caps the number of tombstones returned", func(t *testing.T) {
		workspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspaceID)

		cutoff := time.Now().Add(-time.Hour)

		for i := 0; i < 3; i++ {
			rec, err := deleted.NewDeletedRecord(workspaceID, activity.EntityItem, uuid.New(), nil)
			require.NoError(t, err)
			require.NoError(t, repos.deleted.Save(ctx, rec))
		}

		rows, err := repos.sync.ListDeletedRecordsModifiedSince(ctx, workspaceID, cutoff, 2)
		require.NoError(t, err)
		assert.Len(t, rows, 2)
	})
}
