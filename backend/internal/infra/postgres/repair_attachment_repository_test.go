//go:build integration
// +build integration

package postgres

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairattachment"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestRepairAttachmentRepository_CreateAndGetByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairAttachmentRepository(pool)
	fileRepo := NewFileRepository(pool)
	ctx := context.Background()

	t.Run("creates a repair attachment and gets it by id", func(t *testing.T) {
		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)

		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "receipt.pdf", "pdf", "application/pdf", "checksum-ra-1", "storage/receipt.pdf", 512, nil)
		require.NoError(t, err)
		require.NoError(t, fileRepo.Save(ctx, f))

		title := "Repair receipt"
		ra, err := repairattachment.NewRepairAttachment(repairLogID, testfixtures.TestWorkspaceID, f.ID(), attachment.TypeReceipt, &title)
		require.NoError(t, err)
		require.NoError(t, repo.Create(ctx, ra))

		found, err := repo.GetByID(ctx, ra.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, ra.ID(), found.ID())
		assert.Equal(t, repairLogID, found.RepairLogID())
		assert.Equal(t, f.ID(), found.FileID())
		assert.Equal(t, attachment.TypeReceipt, found.AttachmentType())
		require.NotNil(t, found.Title())
		assert.Equal(t, title, *found.Title())
	})

	t.Run("returns ErrNotFound for a missing repair attachment", func(t *testing.T) {
		found, err := repo.GetByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a repair attachment across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "scoped.pdf", "pdf", "application/pdf", "checksum-ra-2", "storage/scoped.pdf", 256, nil)
		require.NoError(t, err)
		require.NoError(t, fileRepo.Save(ctx, f))

		ra, err := repairattachment.NewRepairAttachment(repairLogID, testfixtures.TestWorkspaceID, f.ID(), attachment.TypeOther, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Create(ctx, ra))

		found, err := repo.GetByID(ctx, ra.ID(), otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestRepairAttachmentRepository_ListByRepairLog(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairAttachmentRepository(pool)
	fileRepo := NewFileRepository(pool)
	ctx := context.Background()

	t.Run("lists attachments with file metadata scoped to the repair log and workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		otherRepairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)

		f1, err := attachment.NewFile(testfixtures.TestWorkspaceID, "one.pdf", "pdf", "application/pdf", "checksum-ra-3", "storage/one.pdf", 128, nil)
		require.NoError(t, err)
		require.NoError(t, fileRepo.Save(ctx, f1))
		ra1, err := repairattachment.NewRepairAttachment(repairLogID, testfixtures.TestWorkspaceID, f1.ID(), attachment.TypeReceipt, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Create(ctx, ra1))

		f2, err := attachment.NewFile(testfixtures.TestWorkspaceID, "two.pdf", "pdf", "application/pdf", "checksum-ra-4", "storage/two.pdf", 128, nil)
		require.NoError(t, err)
		require.NoError(t, fileRepo.Save(ctx, f2))
		ra2, err := repairattachment.NewRepairAttachment(otherRepairLogID, testfixtures.TestWorkspaceID, f2.ID(), attachment.TypeOther, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Create(ctx, ra2))

		found, err := repo.ListByRepairLog(ctx, repairLogID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.Len(t, found, 1)
		assert.Equal(t, ra1.ID(), found[0].ID())
		assert.Equal(t, "one.pdf", found[0].FileName)

		found, err = repo.ListByRepairLog(ctx, repairLogID, otherWorkspace)
		require.NoError(t, err)
		assert.Empty(t, found)
	})
}

func TestRepairAttachmentRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewRepairAttachmentRepository(pool)
	fileRepo := NewFileRepository(pool)
	ctx := context.Background()

	t.Run("deletes a repair attachment", func(t *testing.T) {
		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "delete-me.pdf", "pdf", "application/pdf", "checksum-ra-5", "storage/delete-me.pdf", 64, nil)
		require.NoError(t, err)
		require.NoError(t, fileRepo.Save(ctx, f))

		ra, err := repairattachment.NewRepairAttachment(repairLogID, testfixtures.TestWorkspaceID, f.ID(), attachment.TypeOther, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Create(ctx, ra))

		require.NoError(t, repo.Delete(ctx, ra.ID(), testfixtures.TestWorkspaceID))

		found, err := repo.GetByID(ctx, ra.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete a repair attachment belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		repairLogID := createTestRepairLogForPhoto(t, pool, testfixtures.TestWorkspaceID)
		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "keep-me.pdf", "pdf", "application/pdf", "checksum-ra-6", "storage/keep-me.pdf", 64, nil)
		require.NoError(t, err)
		require.NoError(t, fileRepo.Save(ctx, f))

		ra, err := repairattachment.NewRepairAttachment(repairLogID, testfixtures.TestWorkspaceID, f.ID(), attachment.TypeOther, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Create(ctx, ra))

		require.NoError(t, repo.Delete(ctx, ra.ID(), otherWorkspace))

		found, err := repo.GetByID(ctx, ra.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}
