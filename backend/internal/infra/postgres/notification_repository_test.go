//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/notification"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

// createTestUserForNotification inserts a second auth.users row so
// notification scoping (which is per-user, not per-workspace) can be tested
// against a distinct owner.
func createTestUserForNotification(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()

	userID := uuid.New()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Other User', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, "other-"+userID.String()[:8]+"@example.com")
	require.NoError(t, err)

	return userID
}

func TestNotificationRepository_SaveAndFindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewNotificationRepository(pool)
	ctx := context.Background()

	t.Run("saves a notification and finds it by id", func(t *testing.T) {
		wsID := testfixtures.TestWorkspaceID
		n, err := notification.NewNotification(testfixtures.TestUserID, &wsID, notification.TypeLoanDueSoon, "Loan due", "Your loan is due soon", map[string]interface{}{"loan_id": "abc"})
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n))

		found, err := repo.FindByID(ctx, n.ID(), testfixtures.TestUserID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, n.ID(), found.ID())
		assert.Equal(t, "Loan due", found.Title())
		assert.Equal(t, notification.TypeLoanDueSoon, found.NotificationType())
		assert.False(t, found.IsRead())
		require.NotNil(t, found.WorkspaceID())
		assert.Equal(t, wsID, *found.WorkspaceID())
	})

	t.Run("returns ErrNotFound for a missing notification", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestUserID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a notification across users", func(t *testing.T) {
		otherUserID := createTestUserForNotification(t, pool)

		n, err := notification.NewNotification(testfixtures.TestUserID, nil, notification.TypeSystem, "Mine", "For me only", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n))

		found, err := repo.FindByID(ctx, n.ID(), otherUserID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestNotificationRepository_FindByUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewNotificationRepository(pool)
	ctx := context.Background()

	t.Run("lists and counts notifications scoped to the user", func(t *testing.T) {
		otherUserID := createTestUserForNotification(t, pool)

		n1, err := notification.NewNotification(testfixtures.TestUserID, nil, notification.TypeSystem, "One", "First", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n1))

		n2, err := notification.NewNotification(testfixtures.TestUserID, nil, notification.TypeSystem, "Two", "Second", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n2))

		other, err := notification.NewNotification(otherUserID, nil, notification.TypeSystem, "Other", "Not mine", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, other))

		found, total, err := repo.FindByUser(ctx, testfixtures.TestUserID, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 2, total)
		assert.Len(t, found, 2)

		found, total, err = repo.FindByUser(ctx, otherUserID, shared.DefaultPagination())
		require.NoError(t, err)
		assert.Equal(t, 1, total)
		assert.Len(t, found, 1)
	})
}

func TestNotificationRepository_ReadState(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewNotificationRepository(pool)
	ctx := context.Background()

	t.Run("marks a notification as read and updates the unread count", func(t *testing.T) {
		n1, err := notification.NewNotification(testfixtures.TestUserID, nil, notification.TypeSystem, "Unread 1", "msg", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n1))

		n2, err := notification.NewNotification(testfixtures.TestUserID, nil, notification.TypeSystem, "Unread 2", "msg", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n2))

		unread, err := repo.FindUnreadByUser(ctx, testfixtures.TestUserID)
		require.NoError(t, err)
		assert.Len(t, unread, 2)

		count, err := repo.GetUnreadCount(ctx, testfixtures.TestUserID)
		require.NoError(t, err)
		assert.Equal(t, int64(2), count)

		require.NoError(t, repo.MarkAsRead(ctx, n1.ID(), testfixtures.TestUserID))

		found, err := repo.FindByID(ctx, n1.ID(), testfixtures.TestUserID)
		require.NoError(t, err)
		assert.True(t, found.IsRead())
		assert.NotNil(t, found.ReadAt())

		count, err = repo.GetUnreadCount(ctx, testfixtures.TestUserID)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)

		require.NoError(t, repo.MarkAllAsRead(ctx, testfixtures.TestUserID))

		count, err = repo.GetUnreadCount(ctx, testfixtures.TestUserID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("marking as read does not affect another user's notification", func(t *testing.T) {
		otherUserID := createTestUserForNotification(t, pool)

		n, err := notification.NewNotification(otherUserID, nil, notification.TypeSystem, "Not yours", "msg", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n))

		require.NoError(t, repo.MarkAsRead(ctx, n.ID(), testfixtures.TestUserID))

		found, err := repo.FindByID(ctx, n.ID(), otherUserID)
		require.NoError(t, err)
		assert.False(t, found.IsRead())
	})
}
