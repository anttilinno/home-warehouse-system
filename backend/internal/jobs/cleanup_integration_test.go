//go:build integration
// +build integration

package jobs

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

func setupTestWorkspace(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	workspaceID := uuid.New()
	userID := uuid.New()

	// Insert test user
	_, err := pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Test User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, "test_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert test workspace
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Test Workspace', $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, workspaceID, "test-"+uuid.New().String()[:8])
	require.NoError(t, err)

	// Insert workspace membership
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW(), NOW())
		ON CONFLICT DO NOTHING
	`, workspaceID, userID)
	require.NoError(t, err)

	return workspaceID
}

func TestCleanupProcessor_ProcessDeletedRecordsCleanup(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()

	workspaceID := setupTestWorkspace(t, pool)

	// Insert some old deleted records
	oldDate := time.Now().AddDate(0, 0, -100) // 100 days ago

	// Insert a category first (to have a deleted record)
	categoryID := uuid.New()
	_, err := pool.Exec(ctx, `
		INSERT INTO warehouse.categories (id, workspace_id, name, is_archived, created_at, updated_at)
		VALUES ($1, $2, 'Old Deleted Category', true, $3, $3)
	`, categoryID, workspaceID, oldDate)
	require.NoError(t, err)

	// Insert a deleted record entry for the category (entity_type uses uppercase enum)
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.deleted_records (id, workspace_id, entity_type, entity_id, deleted_at)
		VALUES (gen_random_uuid(), $1, 'CATEGORY', $2, $3)
	`, workspaceID, categoryID, oldDate)
	require.NoError(t, err)

	// Verify record exists
	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.deleted_records
		WHERE workspace_id = $1 AND entity_id = $2
	`, workspaceID, categoryID).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "should have one deleted record before cleanup")

	// Run cleanup
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 90, // 90 days retention
		ActivityLogsRetentionDays:   365,
	}
	processor := NewCleanupProcessor(pool, config)

	task := asynq.NewTask(TypeCleanupDeletedRecords, nil)
	err = processor.ProcessDeletedRecordsCleanup(ctx, task)
	require.NoError(t, err)

	// Verify old record was cleaned up
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.deleted_records
		WHERE workspace_id = $1 AND entity_id = $2
	`, workspaceID, categoryID).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "should have no deleted records after cleanup")
}

func TestCleanupProcessor_ProcessActivityCleanup(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()

	workspaceID := setupTestWorkspace(t, pool)
	userID := uuid.New()

	// Insert test user for activity log
	_, err := pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Activity Test User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, "activity_test_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert some old activity logs
	oldDate := time.Now().AddDate(0, 0, -400) // 400 days ago

	// Insert old activity log entry (action and entity_type use uppercase enums)
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.activity_log (id, workspace_id, user_id, action, entity_type, entity_id, created_at)
		VALUES (gen_random_uuid(), $1, $2, 'CREATE', 'ITEM', gen_random_uuid(), $3)
	`, workspaceID, userID, oldDate)
	require.NoError(t, err)

	// Verify record exists
	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.activity_log
		WHERE workspace_id = $1 AND created_at < NOW() - INTERVAL '365 days'
	`, workspaceID).Scan(&count)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, count, 1, "should have at least one old activity log")

	// Run cleanup
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 90,
		ActivityLogsRetentionDays:   365, // 365 days retention
	}
	processor := NewCleanupProcessor(pool, config)

	task := asynq.NewTask(TypeCleanupOldActivity, nil)
	err = processor.ProcessActivityCleanup(ctx, task)
	require.NoError(t, err)

	// Verify old activity logs were cleaned up
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.activity_log
		WHERE workspace_id = $1 AND created_at < NOW() - INTERVAL '365 days'
	`, workspaceID).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "should have no old activity logs after cleanup")
}

func TestCleanupProcessor_RetainsRecentRecords(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()

	workspaceID := setupTestWorkspace(t, pool)

	// Insert a recent deleted record (should NOT be cleaned up)
	recentDate := time.Now().AddDate(0, 0, -10) // 10 days ago
	categoryID := uuid.New()

	_, err := pool.Exec(ctx, `
		INSERT INTO warehouse.categories (id, workspace_id, name, is_archived, created_at, updated_at)
		VALUES ($1, $2, 'Recent Deleted Category', true, $3, $3)
	`, categoryID, workspaceID, recentDate)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.deleted_records (id, workspace_id, entity_type, entity_id, deleted_at)
		VALUES (gen_random_uuid(), $1, 'CATEGORY', $2, $3)
	`, workspaceID, categoryID, recentDate)
	require.NoError(t, err)

	// Run cleanup
	config := CleanupConfig{
		DeletedRecordsRetentionDays: 90, // 90 days retention
		ActivityLogsRetentionDays:   365,
	}
	processor := NewCleanupProcessor(pool, config)

	task := asynq.NewTask(TypeCleanupDeletedRecords, nil)
	err = processor.ProcessDeletedRecordsCleanup(ctx, task)
	require.NoError(t, err)

	// Verify recent record was NOT cleaned up
	var count int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM warehouse.deleted_records
		WHERE workspace_id = $1 AND entity_id = $2
	`, workspaceID, categoryID).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "should retain recent deleted records")
}
