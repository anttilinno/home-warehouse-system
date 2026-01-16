package testdb

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Test fixture IDs - must match testfixtures package
var (
	testWorkspaceID = "00000000-0000-0000-0000-000000000001"
	testUserID      = "00000000-0000-0000-0000-000000000002"
)

// SetupTestDB creates a test database connection and returns a cleanup function.
// It expects TEST_DATABASE_URL environment variable to be set.
func SetupTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	ctx := context.Background()

	// Get test database URL from environment
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://wh:wh@localhost:5432/warehouse_test"
	}

	// Connect to database
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("failed to ping test database: %v", err)
	}

	// Set up test fixtures
	setupTestFixtures(t, pool)

	// Register cleanup function
	t.Cleanup(func() {
		CleanupTestDB(t, pool)
		pool.Close()
	})

	return pool
}

// setupTestFixtures inserts required test fixtures (user, workspace, membership)
func setupTestFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	// Insert test user (if not exists)
	_, err := pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, 'test@example.com', 'Test User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, testUserID)
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}

	// Insert test workspace (if not exists)
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Test Workspace', 'test-workspace', NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, testWorkspaceID)
	if err != nil {
		t.Fatalf("failed to insert test workspace: %v", err)
	}

	// Insert workspace membership (if not exists)
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, 'owner', NOW(), NOW())
		ON CONFLICT DO NOTHING
	`, testWorkspaceID, testUserID)
	if err != nil {
		t.Fatalf("failed to insert test workspace member: %v", err)
	}
}

// CleanupTestDB truncates all tables in the database.
func CleanupTestDB(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := context.Background()

	// Truncate all tables in reverse dependency order
	tables := []string{
		// Warehouse schema - reverse dependency order
		"warehouse.activity_log",
		"warehouse.deleted_records",
		"warehouse.favorites",
		"warehouse.inventory_movements",
		"warehouse.attachments",
		"warehouse.files",
		"warehouse.loans",
		"warehouse.borrowers",
		"warehouse.inventory",
		"warehouse.item_labels",
		"warehouse.labels",
		"warehouse.items",
		"warehouse.container_tags",
		"warehouse.containers",
		"warehouse.locations",
		"warehouse.categories",
		"warehouse.companies",
		"warehouse.pending_changes",
		// Auth schema - reverse dependency order
		"auth.notifications",
		"auth.workspace_members",
		"auth.workspaces",
		"auth.users",
	}

	for _, table := range tables {
		_, err := pool.Exec(ctx, fmt.Sprintf("TRUNCATE %s CASCADE", table))
		if err != nil {
			// Log but don't fail - table might not exist yet
			t.Logf("Warning: failed to truncate %s: %v", table, err)
		}
	}
}

// TruncateTable truncates a specific table.
func TruncateTable(t *testing.T, pool *pgxpool.Pool, table string) {
	t.Helper()

	ctx := context.Background()
	_, err := pool.Exec(ctx, fmt.Sprintf("TRUNCATE %s CASCADE", table))
	if err != nil {
		t.Fatalf("failed to truncate %s: %v", table, err)
	}
}

// CreateTestWorkspace creates a workspace with the given ID for testing.
// Use this when tests need dynamic workspace IDs (e.g., uuid.New()).
func CreateTestWorkspace(t *testing.T, pool *pgxpool.Pool, workspaceID uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	_, err := pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, workspaceID, fmt.Sprintf("Workspace %s", workspaceID.String()[:8]), workspaceID.String()[:8])
	if err != nil {
		t.Fatalf("failed to create test workspace %s: %v", workspaceID, err)
	}
}
