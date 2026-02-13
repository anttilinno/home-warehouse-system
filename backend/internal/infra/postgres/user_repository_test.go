//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

func TestUserRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	t.Run("saves new user successfully", func(t *testing.T) {
		u, err := user.NewUser("newuser@example.com", "New User", "password123")
		require.NoError(t, err)

		err = repo.Save(ctx, u)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, u.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, u.ID(), retrieved.ID())
		assert.Equal(t, u.Email(), retrieved.Email())
		assert.Equal(t, u.FullName(), retrieved.FullName())
		assert.True(t, retrieved.IsActive())
		assert.False(t, retrieved.IsSuperuser())
	})

	t.Run("updates existing user on conflict", func(t *testing.T) {
		u, err := user.NewUser("updateuser@example.com", "Original Name", "password123")
		require.NoError(t, err)

		err = repo.Save(ctx, u)
		require.NoError(t, err)

		// Update the user
		err = u.UpdateProfile("Updated Name")
		require.NoError(t, err)

		err = repo.Save(ctx, u)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, u.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, "Updated Name", retrieved.FullName())
	})

	t.Run("saves user with preferences", func(t *testing.T) {
		u, err := user.NewUser("prefuser@example.com", "Pref User", "password123")
		require.NoError(t, err)
		u.UpdatePreferences("DD/MM/YYYY", "fi", "dark", "", "", "", nil)

		err = repo.Save(ctx, u)
		require.NoError(t, err)

		retrieved, err := repo.FindByID(ctx, u.ID())
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		assert.Equal(t, "DD/MM/YYYY", retrieved.DateFormat())
		assert.Equal(t, "fi", retrieved.Language())
		assert.Equal(t, "dark", retrieved.Theme())
	})
}

func TestUserRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	t.Run("finds existing user", func(t *testing.T) {
		u, err := user.NewUser("findbyid@example.com", "Find User", "password123")
		require.NoError(t, err)
		err = repo.Save(ctx, u)
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, u.ID())
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, u.ID(), found.ID())
		assert.Equal(t, u.Email(), found.Email())
	})

	t.Run("returns nil for non-existent user", func(t *testing.T) {
		nonExistentID := uuid.New()
		found, err := repo.FindByID(ctx, nonExistentID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestUserRepository_FindByEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	t.Run("finds user by email", func(t *testing.T) {
		email := "findbyemail@example.com"
		u, err := user.NewUser(email, "Email User", "password123")
		require.NoError(t, err)
		err = repo.Save(ctx, u)
		require.NoError(t, err)

		found, err := repo.FindByEmail(ctx, email)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, u.ID(), found.ID())
		assert.Equal(t, email, found.Email())
	})

	t.Run("returns nil for non-existent email", func(t *testing.T) {
		found, err := repo.FindByEmail(ctx, "nonexistent@example.com")
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestUserRepository_List(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	t.Run("lists active users with pagination", func(t *testing.T) {
		// Create multiple users
		for i := 0; i < 5; i++ {
			u, err := user.NewUser(
				"listuser"+uuid.New().String()[:8]+"@example.com",
				"List User",
				"password123",
			)
			require.NoError(t, err)
			err = repo.Save(ctx, u)
			require.NoError(t, err)
		}

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		users, total, err := repo.List(ctx, pagination)
		require.NoError(t, err)
		// Should have at least our 5 users plus the test fixture user
		assert.GreaterOrEqual(t, total, 5)
		assert.GreaterOrEqual(t, len(users), 5)
	})

	t.Run("respects pagination limit", func(t *testing.T) {
		pagination := shared.Pagination{Page: 1, PageSize: 2}
		users, _, err := repo.List(ctx, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(users), 2)
	})

	t.Run("excludes inactive users", func(t *testing.T) {
		u, err := user.NewUser("inactive@example.com", "Inactive User", "password123")
		require.NoError(t, err)
		u.Deactivate()
		err = repo.Save(ctx, u)
		require.NoError(t, err)

		pagination := shared.Pagination{Page: 1, PageSize: 100}
		users, _, err := repo.List(ctx, pagination)
		require.NoError(t, err)

		for _, listedUser := range users {
			assert.NotEqual(t, u.ID(), listedUser.ID(), "inactive user should not be in list")
		}
	})
}

func TestUserRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	t.Run("deletes user successfully", func(t *testing.T) {
		u, err := user.NewUser("todelete@example.com", "To Delete", "password123")
		require.NoError(t, err)
		err = repo.Save(ctx, u)
		require.NoError(t, err)

		err = repo.Delete(ctx, u.ID())
		require.NoError(t, err)

		found, err := repo.FindByID(ctx, u.ID())
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("delete non-existent user does not error", func(t *testing.T) {
		nonExistentID := uuid.New()
		err := repo.Delete(ctx, nonExistentID)
		assert.NoError(t, err)
	})
}

func TestUserRepository_ExistsByEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	t.Run("returns true for existing email", func(t *testing.T) {
		email := "exists@example.com"
		u, err := user.NewUser(email, "Exists User", "password123")
		require.NoError(t, err)
		err = repo.Save(ctx, u)
		require.NoError(t, err)

		exists, err := repo.ExistsByEmail(ctx, email)
		require.NoError(t, err)
		assert.True(t, exists)
	})

	t.Run("returns false for non-existent email", func(t *testing.T) {
		exists, err := repo.ExistsByEmail(ctx, "notexists@example.com")
		require.NoError(t, err)
		assert.False(t, exists)
	})
}

func TestUserRepository_PasswordVerification(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewUserRepository(pool)
	ctx := context.Background()

	t.Run("stored password hash can verify password", func(t *testing.T) {
		password := "securePassword123"
		u, err := user.NewUser("passtest@example.com", "Password User", password)
		require.NoError(t, err)
		err = repo.Save(ctx, u)
		require.NoError(t, err)

		retrieved, err := repo.FindByEmail(ctx, "passtest@example.com")
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.True(t, retrieved.CheckPassword(password))
		assert.False(t, retrieved.CheckPassword("wrongPassword"))
	})
}
