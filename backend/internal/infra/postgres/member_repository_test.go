//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestMemberRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMemberRepository(pool)
	wsRepo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("saves new member successfully", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("Save Member WS", "save-member-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, ws))

		userID := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Save Member User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "save-member-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		m, err := member.NewMember(ws.ID(), userID, member.RoleMember, nil)
		require.NoError(t, err)

		require.NoError(t, repo.Save(ctx, m))

		found, err := repo.FindByWorkspaceAndUser(ctx, ws.ID(), userID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, m.ID(), found.ID())
		assert.Equal(t, member.RoleMember, found.Role())
		assert.Nil(t, found.InvitedBy())
	})

	t.Run("saves member with invited_by", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("Invited Member WS", "invited-member-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, ws))

		userID := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Invited Member User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "invited-member-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		inviterID := testfixtures.TestUserID
		m, err := member.NewMember(ws.ID(), userID, member.RoleAdmin, &inviterID)
		require.NoError(t, err)

		require.NoError(t, repo.Save(ctx, m))

		found, err := repo.FindByWorkspaceAndUser(ctx, ws.ID(), userID)
		require.NoError(t, err)
		require.NotNil(t, found)
		require.NotNil(t, found.InvitedBy())
		assert.Equal(t, inviterID, *found.InvitedBy())
	})
}

func TestMemberRepository_FindByWorkspaceAndUser(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMemberRepository(pool)
	wsRepo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("returns ErrNotFound for a user with no membership", func(t *testing.T) {
		found, err := repo.FindByWorkspaceAndUser(ctx, testfixtures.TestWorkspaceID, uuid.New())
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak membership across workspaces", func(t *testing.T) {
		wsA, err := workspace.NewWorkspace("Tenant A", "tenant-a-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsA))

		wsB, err := workspace.NewWorkspace("Tenant B", "tenant-b-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsB))

		userID := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Tenant User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "tenant-user-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		m, err := member.NewMember(wsA.ID(), userID, member.RoleMember, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, m))

		// Member of workspace A must not be visible when queried under workspace B.
		found, err := repo.FindByWorkspaceAndUser(ctx, wsB.ID(), userID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)

		// Sanity: the same user is still found in their actual workspace.
		found, err = repo.FindByWorkspaceAndUser(ctx, wsA.ID(), userID)
		require.NoError(t, err)
		require.NotNil(t, found)
	})
}

func TestMemberRepository_ListByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMemberRepository(pool)
	wsRepo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("lists members scoped to their workspace only", func(t *testing.T) {
		wsA, err := workspace.NewWorkspace("List A", "list-a-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsA))

		wsB, err := workspace.NewWorkspace("List B", "list-b-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsB))

		userA := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'List User A', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userA, "list-user-a-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		userB := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'List User B', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userB, "list-user-b-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		mA, err := member.NewMember(wsA.ID(), userA, member.RoleOwner, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, mA))

		mB, err := member.NewMember(wsB.ID(), userB, member.RoleOwner, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, mB))

		membersA, err := repo.ListByWorkspace(ctx, wsA.ID())
		require.NoError(t, err)
		require.Len(t, membersA, 1)
		assert.Equal(t, userA, membersA[0].UserID())
		assert.Equal(t, "List User A", membersA[0].FullName())

		membersB, err := repo.ListByWorkspace(ctx, wsB.ID())
		require.NoError(t, err)
		require.Len(t, membersB, 1)
		assert.Equal(t, userB, membersB[0].UserID())
	})

	t.Run("returns empty for a workspace with no members", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("Empty WS", "empty-ws-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, ws))

		members, err := repo.ListByWorkspace(ctx, ws.ID())
		require.NoError(t, err)
		assert.Empty(t, members)
	})
}

func TestMemberRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMemberRepository(pool)
	wsRepo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("deletes a member", func(t *testing.T) {
		ws, err := workspace.NewWorkspace("Delete Member WS", "delete-member-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, ws))

		userID := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Delete Member User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "delete-member-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		m, err := member.NewMember(ws.ID(), userID, member.RoleMember, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, m))

		require.NoError(t, repo.Delete(ctx, ws.ID(), userID))

		found, err := repo.FindByWorkspaceAndUser(ctx, ws.ID(), userID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not remove membership in another workspace", func(t *testing.T) {
		wsA, err := workspace.NewWorkspace("Delete Tenant A", "delete-tenant-a-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsA))

		wsB, err := workspace.NewWorkspace("Delete Tenant B", "delete-tenant-b-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsB))

		userID := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Delete Tenant User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "delete-tenant-user-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		mA, err := member.NewMember(wsA.ID(), userID, member.RoleMember, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, mA))

		mB, err := member.NewMember(wsB.ID(), userID, member.RoleMember, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, mB))

		// Deleting the membership in workspace B must not touch workspace A's row.
		require.NoError(t, repo.Delete(ctx, wsB.ID(), userID))

		foundA, err := repo.FindByWorkspaceAndUser(ctx, wsA.ID(), userID)
		require.NoError(t, err)
		assert.NotNil(t, foundA)

		foundB, err := repo.FindByWorkspaceAndUser(ctx, wsB.ID(), userID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, foundB)
	})

	t.Run("delete of non-existent membership does not error", func(t *testing.T) {
		require.NoError(t, repo.Delete(ctx, testfixtures.TestWorkspaceID, uuid.New()))
	})
}

func TestMemberRepository_CountOwners(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMemberRepository(pool)
	wsRepo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("counts owners scoped to the workspace", func(t *testing.T) {
		wsA, err := workspace.NewWorkspace("Owners A", "owners-a-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsA))

		wsB, err := workspace.NewWorkspace("Owners B", "owners-b-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsB))

		ownerA1 := uuid.New()
		ownerA2 := uuid.New()
		memberA := uuid.New()
		ownerB := uuid.New()
		for i, id := range []uuid.UUID{ownerA1, ownerA2, memberA, ownerB} {
			_, err = pool.Exec(ctx, `
				INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
				VALUES ($1, $2, 'Owners User', '$2a$10$dummy_hash', false, NOW(), NOW())
			`, id, "owners-user-"+uuid.NewString()[:8]+"-"+uuid.NewString()[:4]+"@example.com")
			require.NoError(t, err, "insert user %d", i)
		}

		mkMember := func(wsID, userID uuid.UUID, role member.Role) {
			m, err := member.NewMember(wsID, userID, role, nil)
			require.NoError(t, err)
			require.NoError(t, repo.Save(ctx, m))
		}
		mkMember(wsA.ID(), ownerA1, member.RoleOwner)
		mkMember(wsA.ID(), ownerA2, member.RoleOwner)
		mkMember(wsA.ID(), memberA, member.RoleMember)
		mkMember(wsB.ID(), ownerB, member.RoleOwner)

		countA, err := repo.CountOwners(ctx, wsA.ID())
		require.NoError(t, err)
		assert.Equal(t, int64(2), countA)

		countB, err := repo.CountOwners(ctx, wsB.ID())
		require.NoError(t, err)
		assert.Equal(t, int64(1), countB)
	})
}

func TestMemberRepository_Exists(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewMemberRepository(pool)
	wsRepo := NewWorkspaceRepository(pool)
	ctx := context.Background()

	t.Run("true for an existing member, false otherwise, scoped per workspace", func(t *testing.T) {
		wsA, err := workspace.NewWorkspace("Exists A", "exists-a-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsA))

		wsB, err := workspace.NewWorkspace("Exists B", "exists-b-"+uuid.New().String()[:8], nil, false)
		require.NoError(t, err)
		require.NoError(t, wsRepo.Save(ctx, wsB))

		userID := uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Exists User', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, userID, "exists-user-"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		m, err := member.NewMember(wsA.ID(), userID, member.RoleMember, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, m))

		exists, err := repo.Exists(ctx, wsA.ID(), userID)
		require.NoError(t, err)
		assert.True(t, exists)

		// Same user, different workspace: must not report existence.
		exists, err = repo.Exists(ctx, wsB.ID(), userID)
		require.NoError(t, err)
		assert.False(t, exists)

		exists, err = repo.Exists(ctx, wsA.ID(), uuid.New())
		require.NoError(t, err)
		assert.False(t, exists)
	})
}
