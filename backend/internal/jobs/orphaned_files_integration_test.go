//go:build integration
// +build integration

package jobs

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
)

// insertFile writes a warehouse.files row with real bytes behind it and returns
// the row id plus its storage key.
func insertFile(
	t *testing.T,
	pool *pgxpool.Pool,
	store storage.Storage,
	wsID uuid.UUID,
	age time.Duration,
) (uuid.UUID, string) {
	t.Helper()
	ctx := context.Background()

	key, err := store.Save(ctx, wsID.String(), uuid.New().String(), "photo.jpg",
		strings.NewReader("bytes"))
	require.NoError(t, err)

	fileID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO warehouse.files
			(id, workspace_id, original_name, mime_type, size_bytes, storage_key, created_at, updated_at)
		VALUES ($1, $2, 'photo.jpg', 'image/jpeg', 5, $3, $4, $4)
	`, fileID, wsID, key, time.Now().Add(-age))
	require.NoError(t, err)

	return fileID, key
}

func insertLocation(t *testing.T, pool *pgxpool.Pool, wsID uuid.UUID) uuid.UUID {
	t.Helper()
	id := uuid.New()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO warehouse.locations (id, workspace_id, name, short_code)
		VALUES ($1, $2, 'Shelf A', $3)
	`, id, wsID, uuid.New().String()[:8])
	require.NoError(t, err)
	return id
}

func fileExists(t *testing.T, pool *pgxpool.Pool, id uuid.UUID) bool {
	t.Helper()
	var n int
	require.NoError(t, pool.QueryRow(context.Background(),
		`SELECT count(*) FROM warehouse.files WHERE id = $1`, id).Scan(&n))
	return n > 0
}

// The sweep decides what to delete from a NOT EXISTS list of link tables and a
// grace period. Both are the kind of thing that fails silently and destructively
// — a missing table in the list deletes live files — so each branch gets an
// assertion against a real database.
func TestOrphanedFilesProcessor_ProcessTask(t *testing.T) {
	pool := getTestPool(t)
	wsID := setupTestWorkspace(t, pool)

	base := t.TempDir()
	store, err := storage.NewLocalStorage(base)
	require.NoError(t, err)

	proc := NewOrphanedFilesProcessor(pool, store)
	// One hour of grace, so "old" and "new" can be minutes apart in the test
	// rather than days.
	proc.grace = time.Hour

	oldOrphan, oldOrphanKey := insertFile(t, pool, store, wsID, 3*time.Hour)
	freshOrphan, freshOrphanKey := insertFile(t, pool, store, wsID, time.Minute)

	// Old, but still pointed at by a location photo.
	linked, linkedKey := insertFile(t, pool, store, wsID, 3*time.Hour)
	locID := insertLocation(t, pool, wsID)
	_, err = pool.Exec(context.Background(), `
		INSERT INTO warehouse.location_photos (id, workspace_id, location_id, file_id)
		VALUES ($1, $2, $3, $4)
	`, uuid.New(), wsID, locID, linked)
	require.NoError(t, err)

	require.NoError(t, proc.ProcessTask(context.Background(), nil))

	t.Run("deletes an orphan past the grace period", func(t *testing.T) {
		assert.False(t, fileExists(t, pool, oldOrphan))
		_, statErr := os.Stat(filepath.Join(base, oldOrphanKey))
		assert.True(t, os.IsNotExist(statErr), "bytes should be gone too")
	})

	t.Run("keeps an orphan still inside the grace period", func(t *testing.T) {
		// An upload INSERTs the file row before its link row. Without this
		// guard the sweep races live uploads and deletes them mid-flight.
		assert.True(t, fileExists(t, pool, freshOrphan))
		_, statErr := os.Stat(filepath.Join(base, freshOrphanKey))
		assert.NoError(t, statErr)
	})

	t.Run("keeps a file a location photo still references", func(t *testing.T) {
		assert.True(t, fileExists(t, pool, linked))
		_, statErr := os.Stat(filepath.Join(base, linkedKey))
		assert.NoError(t, statErr)
	})
}

// The bytes are deleted before the row. If that order is ever flipped, a
// failure between the two strands bytes with nothing referencing them — the
// exact leak this job exists to fix — so the surviving-row behaviour is pinned.
func TestOrphanedFilesProcessor_KeepsRowWhenBytesFail(t *testing.T) {
	pool := getTestPool(t)
	wsID := setupTestWorkspace(t, pool)

	store, err := storage.NewLocalStorage(t.TempDir())
	require.NoError(t, err)
	proc := NewOrphanedFilesProcessor(pool, failingDeleteStorage{Storage: store})
	proc.grace = time.Hour

	orphan, _ := insertFile(t, pool, store, wsID, 3*time.Hour)

	require.NoError(t, proc.ProcessTask(context.Background(), nil))

	// Row survives, so the next run retries instead of losing track of the bytes.
	assert.True(t, fileExists(t, pool, orphan))
}

type failingDeleteStorage struct {
	storage.Storage
}

func (failingDeleteStorage) Delete(context.Context, string) error {
	return assert.AnError
}
