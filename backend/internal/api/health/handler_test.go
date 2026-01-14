package health

import (
	"context"
	"testing"
	"time"

	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealth_WithHealthyDatabase(t *testing.T) {
	// Setup
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	pool := testdb.SetupTestDB(t)
	defer pool.Close()

	handler := NewHandler(pool)

	// Execute
	ctx := context.Background()
	resp, err := handler.Health(ctx, &HealthInput{})

	// Assert
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.Equal(t, "healthy", resp.Body.Status)
	assert.NotEmpty(t, resp.Body.Version)
	assert.Equal(t, "healthy", resp.Body.Checks["database"])
}

func TestHealth_WithUnhealthyDatabase(t *testing.T) {
	// Setup - create pool but close it to simulate unhealthy database
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	pool := testdb.SetupTestDB(t)
	pool.Close() // Close the pool to make database unhealthy

	handler := NewHandler(pool)

	// Execute
	ctx := context.Background()
	resp, err := handler.Health(ctx, &HealthInput{})

	// Assert - should not return error, but status should be degraded
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.Equal(t, "degraded", resp.Body.Status)
	assert.Equal(t, "unhealthy", resp.Body.Checks["database"])
	assert.NotEmpty(t, resp.Body.Version)
}

func TestHealth_WithTimeout(t *testing.T) {
	// Setup
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	pool := testdb.SetupTestDB(t)
	defer pool.Close()

	handler := NewHandler(pool)

	// Execute with a context that's already cancelled
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Nanosecond)
	defer cancel()

	time.Sleep(10 * time.Millisecond) // Ensure context is expired

	resp, err := handler.Health(ctx, &HealthInput{})

	// Assert - health check should complete but may show degraded status
	// The handler uses its own timeout context, so it should still work
	require.NoError(t, err)
	require.NotNil(t, resp)

	// Status could be healthy or degraded depending on timing
	assert.Contains(t, []string{"healthy", "degraded"}, resp.Body.Status)
}

func TestHealth_VersionField(t *testing.T) {
	// Setup
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	pool := testdb.SetupTestDB(t)
	defer pool.Close()

	handler := NewHandler(pool)

	// Save original version
	originalVersion := Version
	defer func() { Version = originalVersion }()

	// Set a test version
	Version = "1.2.3-test"

	// Execute
	ctx := context.Background()
	resp, err := handler.Health(ctx, &HealthInput{})

	// Assert
	require.NoError(t, err)
	assert.Equal(t, "1.2.3-test", resp.Body.Version)
}

func TestNewHandler(t *testing.T) {
	// Setup
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	pool := testdb.SetupTestDB(t)
	defer pool.Close()

	// Execute
	handler := NewHandler(pool)

	// Assert
	require.NotNil(t, handler)
	assert.NotNil(t, handler.pool)
}
