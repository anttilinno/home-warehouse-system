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
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

func TestFileRepository_SaveAndFindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFileRepository(pool)
	ctx := context.Background()

	t.Run("saves a file and finds it by id", func(t *testing.T) {
		userID := testfixtures.TestUserID
		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "manual.pdf", "pdf", "application/pdf", "checksum-1", "storage/manual.pdf", 2048, &userID)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, f))

		found, err := repo.FindByID(ctx, f.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, f.ID(), found.ID())
		assert.Equal(t, "manual.pdf", found.OriginalName())
		assert.Equal(t, "pdf", found.Extension())
		assert.Equal(t, "application/pdf", found.MimeType())
		assert.Equal(t, int64(2048), found.SizeBytes())
		assert.Equal(t, "checksum-1", found.Checksum())
		assert.Equal(t, "storage/manual.pdf", found.StorageKey())
		require.NotNil(t, found.UploadedBy())
		assert.Equal(t, userID, *found.UploadedBy())
	})

	t.Run("saves a file without an uploader", func(t *testing.T) {
		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "anon.pdf", "pdf", "application/pdf", "checksum-2", "storage/anon.pdf", 512, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, f))

		found, err := repo.FindByID(ctx, f.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found.UploadedBy())
	})

	t.Run("returns ErrNotFound for a missing file", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak a file across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "scoped.pdf", "pdf", "application/pdf", "checksum-3", "storage/scoped.pdf", 128, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, f))

		found, err := repo.FindByID(ctx, f.ID(), otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)

		found, err = repo.FindByID(ctx, f.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestFileRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFileRepository(pool)
	ctx := context.Background()

	t.Run("deletes a file", func(t *testing.T) {
		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "delete-me.pdf", "pdf", "application/pdf", "checksum-4", "storage/delete-me.pdf", 64, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, f))

		require.NoError(t, repo.Delete(ctx, f.ID(), testfixtures.TestWorkspaceID))

		found, err := repo.FindByID(ctx, f.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete a file belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "keep-me.pdf", "pdf", "application/pdf", "checksum-5", "storage/keep-me.pdf", 64, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, f))

		require.NoError(t, repo.Delete(ctx, f.ID(), otherWorkspace))

		found, err := repo.FindByID(ctx, f.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})

	t.Run("delete of a non-existent file does not error", func(t *testing.T) {
		require.NoError(t, repo.Delete(ctx, uuid.New(), testfixtures.TestWorkspaceID))
	})
}

func TestAttachmentRepository_SaveAndFindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewAttachmentRepository(pool)
	fileRepo := NewFileRepository(pool)
	ctx := context.Background()

	t.Run("saves an attachment and finds it by id", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "photo.jpg", "jpg", "image/jpeg", "checksum-6", "storage/photo.jpg", 1024, nil)
		require.NoError(t, err)
		require.NoError(t, fileRepo.Save(ctx, f))
		fileID := f.ID()

		title := "Warranty card"
		a, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, &fileID, attachment.TypeWarranty, &title, true, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a))

		found, err := repo.FindByID(ctx, a.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, a.ID(), found.ID())
		assert.Equal(t, itemID, found.ItemID())
		require.NotNil(t, found.FileID())
		assert.Equal(t, fileID, *found.FileID())
		assert.Equal(t, attachment.TypeWarranty, found.AttachmentType())
		require.NotNil(t, found.Title())
		assert.Equal(t, title, *found.Title())
		assert.True(t, found.IsPrimary())
	})

	t.Run("saves an attachment with an external doc id and derives the dms type", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		externalDocID := "paperless-doc-1"
		a, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypeManual, nil, false, &externalDocID)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a))

		found, err := repo.FindByID(ctx, a.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found.ExternalDocID())
		assert.Equal(t, externalDocID, *found.ExternalDocID())
		require.NotNil(t, found.DMSType())
		assert.Equal(t, attachment.DMSTypePaperless, *found.DMSType())
		assert.Nil(t, found.FileID())
	})

	t.Run("returns ErrNotFound for a missing attachment", func(t *testing.T) {
		found, err := repo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not leak an attachment across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		a, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypeOther, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a))

		found, err := repo.FindByID(ctx, a.ID(), otherWorkspace)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})
}

func TestAttachmentRepository_FindByItem(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewAttachmentRepository(pool)
	ctx := context.Background()

	t.Run("lists attachments scoped to the item and workspace", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		otherItemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		a1, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypeReceipt, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a1))

		a2, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypePhoto, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a2))

		other, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, otherItemID, nil, attachment.TypeOther, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, other))

		found, err := repo.FindByItem(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.Len(t, found, 2)
	})

	t.Run("does not leak attachments across workspaces", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		a, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypeOther, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a))

		found, err := repo.FindByItem(ctx, itemID, otherWorkspace)
		require.NoError(t, err)
		assert.Empty(t, found)
	})

	t.Run("returns empty for an item with no attachments", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		found, err := repo.FindByItem(ctx, itemID, testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Empty(t, found)
	})
}

func TestAttachmentRepository_Delete(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewAttachmentRepository(pool)
	ctx := context.Background()

	t.Run("deletes an attachment", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		a, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypeOther, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a))

		require.NoError(t, repo.Delete(ctx, a.ID(), testfixtures.TestWorkspaceID))

		found, err := repo.FindByID(ctx, a.ID(), testfixtures.TestWorkspaceID)
		require.Error(t, err)
		assert.True(t, shared.IsNotFound(err))
		assert.Nil(t, found)
	})

	t.Run("does not delete an attachment belonging to another workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)
		a, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypeOther, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a))

		require.NoError(t, repo.Delete(ctx, a.ID(), otherWorkspace))

		found, err := repo.FindByID(ctx, a.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestAttachmentRepository_SetPrimaryForItem(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewAttachmentRepository(pool)
	ctx := context.Background()

	t.Run("sets one attachment as primary and unsets the others", func(t *testing.T) {
		itemID := testfixtures.CreateTestItem(t, pool, testfixtures.TestWorkspaceID)

		a1, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypePhoto, nil, true, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a1))

		a2, err := attachment.NewAttachment(testfixtures.TestWorkspaceID, itemID, nil, attachment.TypePhoto, nil, false, testfixtures.StringPtr("doc-"+uuid.NewString()[:8]))
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, a2))

		require.NoError(t, repo.SetPrimaryForItem(ctx, itemID, a2.ID(), testfixtures.TestWorkspaceID))

		found1, err := repo.FindByID(ctx, a1.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.False(t, found1.IsPrimary())

		found2, err := repo.FindByID(ctx, a2.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.True(t, found2.IsPrimary())
	})
}

func TestFileRepository_GetFileByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	repo := NewFileRepository(pool)
	ctx := context.Background()

	t.Run("implements the repairattachment.FileVerifier interface", func(t *testing.T) {
		f, err := attachment.NewFile(testfixtures.TestWorkspaceID, "verify.pdf", "pdf", "application/pdf", "checksum-7", "storage/verify.pdf", 32, nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, f))

		found, err := repo.GetFileByID(ctx, f.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Equal(t, f.ID(), found.ID())
	})
}
