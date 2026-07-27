//go:build integration
// +build integration

package postgres_test

// Postgres integration tests for LocationPhotoRepository (migration 010).
//
// Why these exist: the handler tests use a fake service, so nothing else
// exercises the real SQL. What can only be checked here is (a) the JOIN onto
// warehouse.files that supplies original_name/mime_type/size_bytes to a list
// render, (b) the workspace scoping on every statement (Pitfall #5), and
// (c) the two composite FKs from migration 010 — a photo link must die with
// its location and must not be creatable against another tenant's file.
//
// Run with (needs a live, migrated Postgres test DB — see CLAUDE.md):
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 -p 1 ./internal/infra/postgres/... -run LocationPhoto -v

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/locationphoto"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// Prefixed: shortlink_repository_integration_test.go already defines a
// seedLocation in this same package.
func seedPhotoLocation(t *testing.T, pool *pgxpool.Pool, ws uuid.UUID, name, code string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO warehouse.locations (workspace_id, name, short_code)
		VALUES ($1, $2, $3)
		RETURNING id`, ws, name, code).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedPhotoFile(t *testing.T, pool *pgxpool.Pool, ws uuid.UUID, name, mime string, size int64) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO warehouse.files
		       (workspace_id, original_name, extension, mime_type, size_bytes, checksum, storage_key)
		VALUES ($1, $2, '.jpg', $3, $4, 'deadbeef', $5)
		RETURNING id`, ws, name, mime, size, "ws/"+name).Scan(&id)
	require.NoError(t, err)
	return id
}

// seedWorkspace adds a SECOND tenant so the cross-workspace assertions have
// somewhere foreign to point at.
func seedPhotoWorkspace(t *testing.T, pool *pgxpool.Pool, slug string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO auth.workspaces (name, slug, created_at, updated_at)
		VALUES ($1, $2, NOW(), NOW())
		RETURNING id`, slug, slug).Scan(&id)
	require.NoError(t, err)
	return id
}

func newPhoto(ws, location, file uuid.UUID, caption string) *locationphoto.LocationPhoto {
	c := caption
	return &locationphoto.LocationPhoto{
		ID:          uuid.New(),
		WorkspaceID: ws,
		LocationID:  location,
		FileID:      file,
		Caption:     &c,
		CreatedAt:   time.Now(),
	}
}

func TestLocationPhotoRepository_SaveAndList(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	repo := postgres.NewLocationPhotoRepository(pool)
	ctx := context.Background()
	ws := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	locationID := seedPhotoLocation(t, pool, ws, "Garage shelf B", "GARB")
	fileID := seedPhotoFile(t, pool, ws, "shelf.jpg", "image/jpeg", 2048)

	photo := newPhoto(ws, locationID, fileID, "north wall")
	require.NoError(t, repo.Save(ctx, photo))

	photos, err := repo.ListByLocation(ctx, locationID, ws)
	require.NoError(t, err)
	require.Len(t, photos, 1)

	got := photos[0]
	assert.Equal(t, photo.ID, got.ID)
	assert.Equal(t, fileID, got.FileID)
	require.NotNil(t, got.Caption)
	assert.Equal(t, "north wall", *got.Caption)
	// The JOIN onto warehouse.files is what makes a list render possible
	// without a second round trip — these three come from there, not from the
	// link row.
	assert.Equal(t, "shelf.jpg", got.OriginalName)
	assert.Equal(t, "image/jpeg", got.MimeType)
	assert.Equal(t, int64(2048), got.SizeBytes)
}

func TestLocationPhotoRepository_ListIsNewestFirst(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	repo := postgres.NewLocationPhotoRepository(pool)
	ctx := context.Background()
	ws := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	locationID := seedPhotoLocation(t, pool, ws, "Attic", "ATTC")
	older := newPhoto(ws, locationID, seedPhotoFile(t, pool, ws, "old.jpg", "image/jpeg", 1), "old")
	older.CreatedAt = time.Now().Add(-time.Hour)
	newer := newPhoto(ws, locationID, seedPhotoFile(t, pool, ws, "new.jpg", "image/jpeg", 1), "new")

	require.NoError(t, repo.Save(ctx, older))
	require.NoError(t, repo.Save(ctx, newer))

	photos, err := repo.ListByLocation(ctx, locationID, ws)
	require.NoError(t, err)
	require.Len(t, photos, 2)
	assert.Equal(t, newer.ID, photos[0].ID, "newest photo must come first")
}

func TestLocationPhotoRepository_WorkspaceScoping(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	repo := postgres.NewLocationPhotoRepository(pool)
	ctx := context.Background()
	ws := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	foreign := seedPhotoWorkspace(t, pool, "foreign-ws")

	locationID := seedPhotoLocation(t, pool, ws, "Cellar", "CELL")
	photo := newPhoto(ws, locationID, seedPhotoFile(t, pool, ws, "c.jpg", "image/jpeg", 1), "x")
	require.NoError(t, repo.Save(ctx, photo))

	t.Run("FindByID from another workspace reads as not-found", func(t *testing.T) {
		got, err := repo.FindByID(ctx, photo.ID, foreign)
		require.NoError(t, err, "a foreign read is empty, never an error")
		assert.Nil(t, got)
	})

	t.Run("ListByLocation from another workspace is empty", func(t *testing.T) {
		photos, err := repo.ListByLocation(ctx, locationID, foreign)
		require.NoError(t, err)
		assert.Empty(t, photos)
	})

	t.Run("Delete from another workspace leaves the row alone", func(t *testing.T) {
		require.NoError(t, repo.Delete(ctx, photo.ID, foreign))

		still, err := repo.FindByID(ctx, photo.ID, ws)
		require.NoError(t, err)
		require.NotNil(t, still, "a foreign DELETE must not remove the owner's photo")
	})
}

func TestLocationPhotoRepository_Delete(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	repo := postgres.NewLocationPhotoRepository(pool)
	ctx := context.Background()
	ws := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	locationID := seedPhotoLocation(t, pool, ws, "Shed", "SHED")
	photo := newPhoto(ws, locationID, seedPhotoFile(t, pool, ws, "s.jpg", "image/jpeg", 1), "x")
	require.NoError(t, repo.Save(ctx, photo))

	require.NoError(t, repo.Delete(ctx, photo.ID, ws))

	got, err := repo.FindByID(ctx, photo.ID, ws)
	require.NoError(t, err)
	assert.Nil(t, got)
}

// The two composite FKs from migration 010 — the reason the link table can be
// trusted without app-level checks.
func TestLocationPhotoRepository_ForeignKeys(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	repo := postgres.NewLocationPhotoRepository(pool)
	ctx := context.Background()
	ws := uuid.MustParse("00000000-0000-0000-0000-000000000001")

	t.Run("deleting the location takes its photo links with it", func(t *testing.T) {
		locationID := seedPhotoLocation(t, pool, ws, "Doomed", "DOOM")
		photo := newPhoto(ws, locationID, seedPhotoFile(t, pool, ws, "d.jpg", "image/jpeg", 1), "x")
		require.NoError(t, repo.Save(ctx, photo))

		_, err := pool.Exec(ctx, `DELETE FROM warehouse.locations WHERE id = $1`, locationID)
		require.NoError(t, err)

		got, err := repo.FindByID(ctx, photo.ID, ws)
		require.NoError(t, err)
		assert.Nil(t, got, "the photo link must not outlive its location")
	})

	t.Run("a link cannot point at another tenant's file", func(t *testing.T) {
		foreign := seedPhotoWorkspace(t, pool, "file-owner-ws")
		locationID := seedPhotoLocation(t, pool, ws, "Pantry", "PANT")
		foreignFile := seedPhotoFile(t, pool, foreign, "theirs.jpg", "image/jpeg", 1)

		// workspace_id says ws, file_id belongs to `foreign` — the composite
		// (workspace_id, file_id) FK is what rejects this.
		err := repo.Save(ctx, newPhoto(ws, locationID, foreignFile, "x"))
		require.Error(t, err, "cross-tenant file reference must be rejected by the FK")
	})
}
