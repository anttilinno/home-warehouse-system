//go:build integration
// +build integration

package postgres

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

// createTestInventoryWithItem creates an item + location + inventory row in
// workspaceID for loan decoration lookup tests and returns (inventoryID,
// itemID, itemName).
func createTestInventoryWithItem(t *testing.T, pool *pgxpool.Pool, workspaceID uuid.UUID, itemName string) (uuid.UUID, uuid.UUID, string) {
	t.Helper()

	itm, err := item.NewItem(workspaceID, itemName, "SKU-"+uuid.NewString()[:8], 0)
	require.NoError(t, err)
	itm.SetShortCode(uuid.NewString()[:8])
	require.NoError(t, NewItemRepository(pool).Save(context.Background(), itm))

	loc, err := location.NewLocation(workspaceID, "Loan Loc "+uuid.NewString()[:4], nil, nil, uuid.NewString()[:8])
	require.NoError(t, err)
	require.NoError(t, NewLocationRepository(pool).Save(context.Background(), loc))

	inv, err := inventory.NewInventory(workspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionNew, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	require.NoError(t, NewInventoryRepository(pool).Save(context.Background(), inv))

	return inv.ID(), itm.ID(), itemName
}

func createTestBorrowerInWorkspace(t *testing.T, pool *pgxpool.Pool, workspaceID uuid.UUID, name string) uuid.UUID {
	t.Helper()

	b, err := borrower.NewBorrower(workspaceID, name, nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, NewBorrowerRepository(pool).Create(context.Background(), b))

	return b.ID()
}

func TestLoanDecorationLookup_ItemsByInventoryIDs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	lookup := NewLoanDecorationLookup(pool, nil, nil)
	ctx := context.Background()

	t.Run("looks up item id and name by inventory id, scoped by workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		inventoryID, itemID, itemName := createTestInventoryWithItem(t, pool, testfixtures.TestWorkspaceID, "Lookup Item")
		otherInventoryID, _, _ := createTestInventoryWithItem(t, pool, otherWorkspace, "Other Workspace Item")

		found, err := lookup.ItemsByInventoryIDs(ctx, testfixtures.TestWorkspaceID, []uuid.UUID{inventoryID, otherInventoryID})
		require.NoError(t, err)
		require.Len(t, found, 1)
		row, ok := found[inventoryID]
		require.True(t, ok)
		assert.Equal(t, itemID, row.ItemID)
		assert.Equal(t, itemName, row.ItemName)
	})

	t.Run("returns an empty map for no inventory ids", func(t *testing.T) {
		found, err := lookup.ItemsByInventoryIDs(ctx, testfixtures.TestWorkspaceID, nil)
		require.NoError(t, err)
		assert.Empty(t, found)
	})
}

func TestLoanDecorationLookup_BorrowersByIDs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	lookup := NewLoanDecorationLookup(pool, nil, nil)
	ctx := context.Background()

	t.Run("looks up borrower names by id, scoped by workspace", func(t *testing.T) {
		otherWorkspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspace)

		borrowerID := createTestBorrowerInWorkspace(t, pool, testfixtures.TestWorkspaceID, "Alice")
		otherBorrowerID := createTestBorrowerInWorkspace(t, pool, otherWorkspace, "Bob")

		found, err := lookup.BorrowersByIDs(ctx, testfixtures.TestWorkspaceID, []uuid.UUID{borrowerID, otherBorrowerID})
		require.NoError(t, err)
		require.Len(t, found, 1)
		assert.Equal(t, "Alice", found[borrowerID])
	})

	t.Run("returns an empty map for no borrower ids", func(t *testing.T) {
		found, err := lookup.BorrowersByIDs(ctx, testfixtures.TestWorkspaceID, nil)
		require.NoError(t, err)
		assert.Empty(t, found)
	})
}

func TestLoanDecorationLookup_PrimaryPhotoThumbnailURLsByItemIDs(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	photoRepo := NewItemPhotoRepository(pool, NewTxManager(pool))
	urlGen := func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string {
		return fmt.Sprintf("https://example.com/%s/%s/%s?thumb=%v", workspaceID, itemID, photoID, isThumbnail)
	}
	ctx := context.Background()

	t.Run("resolves the primary photo thumbnail url for an item", func(t *testing.T) {
		_, itemID, _ := createTestInventoryWithItem(t, pool, testfixtures.TestWorkspaceID, "Photo Item")

		photo := &itemphoto.ItemPhoto{
			ID:            uuid.New(),
			ItemID:        itemID,
			WorkspaceID:   testfixtures.TestWorkspaceID,
			Filename:      "primary.jpg",
			StoragePath:   "storage/primary.jpg",
			ThumbnailPath: "storage/primary-thumb.jpg",
			FileSize:      1024,
			MimeType:      itemphoto.MimeTypeJPEG,
			Width:         640,
			Height:        480,
			DisplayOrder:  0,
			IsPrimary:     true,
			UploadedBy:    testfixtures.TestUserID,
		}
		created, err := photoRepo.Create(ctx, photo)
		require.NoError(t, err)

		lookup := NewLoanDecorationLookup(pool, photoRepo, urlGen)
		found, err := lookup.PrimaryPhotoThumbnailURLsByItemIDs(ctx, testfixtures.TestWorkspaceID, []uuid.UUID{itemID})
		require.NoError(t, err)
		require.Contains(t, found, itemID)
		assert.Equal(t, urlGen(testfixtures.TestWorkspaceID, itemID, created.ID, true), found[itemID])
	})

	t.Run("returns an empty map when the photos dependency is nil", func(t *testing.T) {
		lookup := NewLoanDecorationLookup(pool, nil, urlGen)
		found, err := lookup.PrimaryPhotoThumbnailURLsByItemIDs(ctx, testfixtures.TestWorkspaceID, []uuid.UUID{uuid.New()})
		require.NoError(t, err)
		assert.Empty(t, found)
	})
}
