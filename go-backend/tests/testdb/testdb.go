package testdb

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
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

	// Register cleanup function
	t.Cleanup(func() {
		CleanupTestDB(t, pool)
		pool.Close()
	})

	return pool
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
