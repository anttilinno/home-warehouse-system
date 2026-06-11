//go:build integration
// +build integration

package maintenance_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/maintenance"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
)

func getTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://wh:wh@localhost:5432/warehouse_test"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Skipf("skipping integration test: database connection failed: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("skipping integration test: database ping failed: %v", err)
	}

	t.Cleanup(func() { pool.Close() })
	return pool
}

// seedInventory creates workspace -> location -> item -> inventory and
// returns (workspaceID, inventoryID). The workspace is deleted on cleanup
// (cascades through everything).
func seedInventory(t *testing.T, pool *pgxpool.Pool) (uuid.UUID, uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	workspaceID := uuid.New()
	locationID := uuid.New()
	itemID := uuid.New()
	inventoryID := uuid.New()

	_, err := pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Maintenance Test Workspace', $2, NOW(), NOW())
	`, workspaceID, "maint-test-"+uuid.New().String()[:8])
	require.NoError(t, err)

	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM auth.workspaces WHERE id = $1`, workspaceID)
	})

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.locations (id, workspace_id, name, short_code, created_at, updated_at)
		VALUES ($1, $2, 'Maintenance Test Location', $3, NOW(), NOW())
	`, locationID, workspaceID, "L"+uuid.New().String()[:7])
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.items (id, workspace_id, name, sku, short_code, min_stock_level, created_at, updated_at)
		VALUES ($1, $2, 'HVAC Unit', $3, $4, 0, NOW(), NOW())
	`, itemID, workspaceID, "MNT-"+uuid.New().String()[:8], "I"+uuid.New().String()[:7])
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.inventory (id, workspace_id, item_id, location_id, quantity, condition, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 1, 'GOOD', 'AVAILABLE', NOW(), NOW())
	`, inventoryID, workspaceID, itemID, locationID)
	require.NoError(t, err)

	return workspaceID, inventoryID
}

// failingSaveRepo wraps the real repository but fails the schedule Save —
// the SECOND write inside Complete's transaction. The repair-log row has
// already been written inside the same transaction at that point, so the
// rollback assertion below proves real atomicity (the repair log must
// disappear with the rollback).
type failingSaveRepo struct {
	*postgres.MaintenanceRepository
}

var errBoom = errors.New("boom: simulated schedule save failure")

func (f *failingSaveRepo) Save(ctx context.Context, schedule *maintenance.Schedule) error {
	return errBoom
}

func TestService_Complete_HappyPath(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()

	workspaceID, inventoryID := seedInventory(t, pool)

	repo := postgres.NewMaintenanceRepository(pool)
	inventoryRepo := postgres.NewInventoryRepository(pool)
	txManager := postgres.NewTxManager(pool)
	svc := maintenance.NewService(repo, inventoryRepo, txManager)

	// Create a schedule that is 10 days overdue with a 7-day cadence.
	overdueBy := 10
	created, err := svc.Create(ctx, maintenance.CreateInput{
		WorkspaceID:  workspaceID,
		InventoryID:  inventoryID,
		Title:        "Replace filter",
		IntervalDays: 7,
		NextDue:      time.Now().AddDate(0, 0, -overdueBy),
	})
	require.NoError(t, err)

	note := "used the spare filter"
	completed, err := svc.Complete(ctx, created.ID(), workspaceID, &note)
	require.NoError(t, err)

	// next_due = max(today, next_due + interval). due+7 is still 3 days in
	// the past, so it must clamp to today.
	today := time.Now().Truncate(24 * time.Hour)
	assert.False(t, completed.NextDue().Before(today.AddDate(0, 0, -1)), "next_due must not be in the past")
	require.NotNil(t, completed.LastCompletedAt())

	// The completion repair log row must exist: COMPLETED, with the note.
	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.repair_logs
		WHERE workspace_id = $1 AND inventory_id = $2
		  AND status = 'COMPLETED' AND description = 'Maintenance: Replace filter'
		  AND notes = $3 AND completed_at IS NOT NULL
	`, workspaceID, inventoryID, note).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "exactly one completion repair log expected")

	// And the persisted schedule reflects the advance.
	reloaded, err := svc.GetByID(ctx, created.ID(), workspaceID)
	require.NoError(t, err)
	// Compare as calendar dates: the in-memory value is local midnight, the
	// DB round-trip yields UTC midnight.
	assert.Equal(t, completed.NextDue().Format("2006-01-02"), reloaded.NextDue().Format("2006-01-02"))
	assert.NotNil(t, reloaded.LastCompletedAt())
}

// TestService_Complete_RollsBackOnScheduleSaveFailure proves the completion
// is atomic: the repair-log insert succeeds inside the transaction, then the
// schedule save fails — the already-written repair log must roll back and
// the schedule must stay untouched.
func TestService_Complete_RollsBackOnScheduleSaveFailure(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()

	workspaceID, inventoryID := seedInventory(t, pool)

	realRepo := postgres.NewMaintenanceRepository(pool)
	inventoryRepo := postgres.NewInventoryRepository(pool)
	txManager := postgres.NewTxManager(pool)

	// Seed the schedule through the real service.
	setupSvc := maintenance.NewService(realRepo, inventoryRepo, txManager)
	originalDue := time.Now().AddDate(0, 0, 3)
	created, err := setupSvc.Create(ctx, maintenance.CreateInput{
		WorkspaceID:  workspaceID,
		InventoryID:  inventoryID,
		Title:        "Smoke detector batteries",
		IntervalDays: 365,
		NextDue:      originalDue,
	})
	require.NoError(t, err)

	// Service under test: real repo + real TxManager, but the schedule
	// save (which follows the repair-log insert in the same transaction)
	// fails.
	svc := maintenance.NewService(&failingSaveRepo{realRepo}, inventoryRepo, txManager)

	_, err = svc.Complete(ctx, created.ID(), workspaceID, nil)
	require.ErrorIs(t, err, errBoom)

	// Schedule must be untouched in the database.
	reloaded, err := setupSvc.GetByID(ctx, created.ID(), workspaceID)
	require.NoError(t, err)
	assert.Nil(t, reloaded.LastCompletedAt(), "rollback must clear the completion stamp")
	assert.Equal(t, originalDue.Format("2006-01-02"), reloaded.NextDue().Format("2006-01-02"), "next_due must not advance on rollback")

	// And the repair log row written before the failure must have rolled
	// back with the transaction.
	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.repair_logs
		WHERE workspace_id = $1 AND inventory_id = $2
	`, workspaceID, inventoryID).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "no repair log rows expected after rollback")
}

// TestService_Complete_InactiveSchedule guards the inactive-schedule rule.
func TestService_Complete_InactiveSchedule(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()

	workspaceID, inventoryID := seedInventory(t, pool)

	repo := postgres.NewMaintenanceRepository(pool)
	inventoryRepo := postgres.NewInventoryRepository(pool)
	svc := maintenance.NewService(repo, inventoryRepo, postgres.NewTxManager(pool))

	created, err := svc.Create(ctx, maintenance.CreateInput{
		WorkspaceID:  workspaceID,
		InventoryID:  inventoryID,
		Title:        "Paused schedule",
		IntervalDays: 30,
		NextDue:      time.Now(),
	})
	require.NoError(t, err)

	inactive := false
	_, err = svc.Update(ctx, created.ID(), workspaceID, maintenance.UpdateInput{IsActive: &inactive})
	require.NoError(t, err)

	_, err = svc.Complete(ctx, created.ID(), workspaceID, nil)
	assert.ErrorIs(t, err, maintenance.ErrScheduleInactive)
}
