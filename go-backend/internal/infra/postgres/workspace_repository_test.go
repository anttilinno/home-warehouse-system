package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestWorkspaceRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("saves new workspace successfully", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("My Workspace", "my-workspace-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)

		err = repo.Save(ctx, ws)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, ws.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, ws.ID(), retrieved.ID())
		assert.Equal(t, ws.Name(), retrieved.Name())
		assert.Equal(t, ws.Slug(), retrieved.Slug())
		assert.False(t, retrieved.IsPersonal())
	})

	t.Run("saves workspace with description", func(t *testing.T) {
		desc := "A workspace for testing"
		ws, err := workspace.NewWorkspace("Described Workspace", "described-ws-"+uuid.New().String()[:8], &desc, false)
		require.NoError(t, err)

		err = repo.Save(ctx, ws)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, ws.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.NotNil(t, retrieved.Description())
		assert.Equal(t, desc, *retrieved.Description())
	})

	t.Run("saves personal workspace", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("Personal Space", "personal-"+uuid.New().String()[:8], nil, true)
		require.NoError(t, err)

		err = repo.Save(ctx, ws)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, ws.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.True(t, retrieved.IsPersonal())
	})
}

func TestWorkspaceRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("finds existing workspace", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("Find Me", "find-me-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		err = repo.Save(ctx, ws)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, ws.ID())
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, ws.ID(), found.ID())
	})

	t.Run("returns nil for non-existent workspace", func(t *testing.T) {
		nonExistentID := uuid.New()
		found, err := repo.FindByID(ctx, nonExistentID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("finds test fixture workspace", func(t *testing.T) {
		// The test workspace is created by SetupTestDB
		found, err := repo.FindByID(ctx, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, testfixtures.TestWorkspaceID, found.ID())
	})
}

func TestWorkspaceRepository_FindBySlug(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("finds workspace by slug", func(t *testing.T) {
		slug := "unique-slug-" + uuid.New().String()[:8]
		ws, err := workspace.NewWorkspace("Slug Workspace", slug, nil, false)
		require.NoError(t, err)
		err = repo.Save(ctx, ws)
		require.NoError(t, err)

		found, err := repo.FindBySlug(ctx, slug)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, ws.ID(), found.ID())
		assert.Equal(t, slug, found.Slug())
	})

	t.Run("returns nil for non-existent slug", func(t *testing.T) {
		found, err := repo.FindBySlug(ctx, "non-existent-slug")
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestWorkspaceRepository_FindByUserID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	wsRepo := NewWorkspaceRepository(pool)
	memberRepo := NewMemberRepository(pool)
	ctx := context.Background()

	t.Run("finds workspaces for user", func(t *testing.T) {
		// The test user already has the test workspace
		workspaces, err := wsRepo.FindByUserID(ctx, testfixtures.TestUserID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(workspaces), 1)

		// Check that test workspace is in the list
		found := false
		for _, ws := range workspaces {
			if ws.ID() == testfixtures.TestWorkspaceID {
				found = true
				break
			}
		}
		assert.True(t, found, "test workspace should be in user's workspaces")
	})

	t.Run("returns empty for user with no workspaces", func(t *testing.T) {
		// Create a user with no workspace memberships
		newUserID := uuid.New()
		_, err := pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'No Workspace User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, newUserID, "noworkspace"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		workspaces, err := wsRepo.FindByUserID(ctx, newUserID)
		require.NoError(t, err)
		assert.Empty(t, workspaces)
	})

	t.Run("finds multiple workspaces for user", func(t *testing.T) {
		// Create another workspace and add test user to it
		ws2, err := workspace.NewWorkspace("Second Workspace", "second-ws-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		err = wsRepo.Save(ctx, ws2)
		require.NoError(t, err)

		// Add test user as member
		m, err := member.NewMember(ws2.ID(), testfixtures.TestUserID, member.RoleMember, nil)
		require.NoError(t, err)
		err = memberRepo.Save(ctx, m)
		require.NoError(t, err)

		workspaces, err := wsRepo.FindByUserID(ctx, testfixtures.TestUserID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(workspaces), 2)
	})
}

func TestWorkspaceRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("deletes workspace successfully", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("To Delete", "to-delete-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		err = repo.Save(ctx, ws)
		require.NoError(t, err)

		err = repo.Delete(ctx, ws.ID())
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, ws.ID())
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("delete non-existent workspace does not error", func(t *testing.T) {
		nonExistentID := uuid.New()
		err := repo.Delete(ctx, nonExistentID)
		assert.NoError(t, err)
	})
}

func TestWorkspaceRepository_ExistsBySlug(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing slug", func(t *testing.T) {
		slug := "exists-slug-" + uuid.New().String()[:8]
		ws, err := workspace.NewWorkspace("Exists Workspace", slug, nil, false)
		require.NoError(t, err)
		err = repo.Save(ctx, ws)
		require.NoError(t, err)

		exists, err := repo.ExistsBySlug(ctx, slug)
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent slug", func(t *testing.T) {
		exists, err := repo.ExistsBySlug(ctx, "not-exists-slug")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}
