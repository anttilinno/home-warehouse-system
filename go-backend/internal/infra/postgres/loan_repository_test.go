package postgres

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
	"github.com/antti/home-warehouse/go-backend/tests/testfixtures"
)

// createTestBorrower creates a borrower for loan tests
func createTestBorrower(t *testing.T, repo *BorrowerRepository, ctx context.Context, name string) *borrower.Borrower {
	t.Helper()
	b, err := borrower.NewBorrower(testfixtures.TestWorkspaceID, name, nil, nil, nil)
	require.NoError(t, err)
	err = repo.Save(ctx, b)
	require.NoError(t, err)
	return b
}

// createTestInventoryForLoan creates an inventory for loan tests
func createTestInventoryForLoan(t *testing.T, invRepo *InventoryRepository, itemRepo *ItemRepository, locRepo *LocationRepository, ctx context.Context) *inventory.Inventory {
	t.Helper()
	itm, err := item.NewItem(testfixtures.TestWorkspaceID, "Loan Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
	require.NoError(t, err)
	err = itemRepo.Save(ctx, itm)
	require.NoError(t, err)

	loc, err := location.NewLocation(testfixtures.TestWorkspaceID, "Loan Loc "+uuid.NewString()[:4], nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	err = locRepo.Save(ctx, loc)
	require.NoError(t, err)

	inv, err := inventory.NewInventory(testfixtures.TestWorkspaceID, itm.ID(), loc.ID(), nil, 10, inventory.ConditionNew, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	err = invRepo.Save(ctx, inv)
	require.NoError(t, err)

	return inv
}

func TestLoanRepository_Save(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("saves new loan successfully", func(t *testing.T) {
		b := createTestBorrower(t, borrowerRepo, ctx, "Loan Borrower")
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)

		l, err := loan.NewLoan(
			testfixtures.TestWorkspaceID,
			inv.ID(),
			b.ID(),
			2,
			time.Now(),
			nil,
			nil,
		)
		require.NoError(t, err)

		err = loanRepo.Save(ctx, l)
		require.NoError(t, err)

		retrieved, err := loanRepo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, l.ID(), retrieved.ID())
		assert.Equal(t, l.BorrowerID(), retrieved.BorrowerID())
		assert.Equal(t, l.InventoryID(), retrieved.InventoryID())
		assert.Equal(t, l.Quantity(), retrieved.Quantity())
	})

	t.Run("saves loan with due date and notes", func(t *testing.T) {
		b := createTestBorrower(t, borrowerRepo, ctx, "Due Date Borrower")
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)

		dueDate := time.Now().AddDate(0, 0, 7)
		notes := "Return by end of week"
		l, err := loan.NewLoan(
			testfixtures.TestWorkspaceID,
			inv.ID(),
			b.ID(),
			1,
			time.Now(),
			&dueDate,
			&notes,
		)
		require.NoError(t, err)

		err = loanRepo.Save(ctx, l)
		require.NoError(t, err)

		retrieved, err := loanRepo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, retrieved)
		require.NotNil(t, retrieved.DueDate())
		require.NotNil(t, retrieved.Notes())
		assert.Equal(t, notes, *retrieved.Notes())
	})
}

func TestLoanRepository_FindByID(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds existing loan", func(t *testing.T) {
		b := createTestBorrower(t, borrowerRepo, ctx, "Find Loan Borrower")
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)

		l, err := loan.NewLoan(testfixtures.TestWorkspaceID, inv.ID(), b.ID(), 1, time.Now(), nil, nil)
		require.NoError(t, err)
		err = loanRepo.Save(ctx, l)
		require.NoError(t, err)

		found, err := loanRepo.FindByID(ctx, l.ID(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, l.ID(), found.ID())
	})

	t.Run("returns nil for non-existent loan", func(t *testing.T) {
		found, err := loanRepo.FindByID(ctx, uuid.New(), testfixtures.TestWorkspaceID)
		require.NoError(t, err)
		assert.Nil(t, found)
	})

	t.Run("respects workspace isolation", func(t *testing.T) {
		workspace1 := uuid.New()
		workspace2 := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace1)
		testdb.CreateTestWorkspace(t, pool, workspace2)

		// Create dependencies in workspace1
		b, _ := borrower.NewBorrower(workspace1, "WS1 Borrower", nil, nil, nil)
		require.NoError(t, borrowerRepo.Save(ctx, b))

		itm, _ := item.NewItem(workspace1, "WS1 Item", "SKU-WS1-"+uuid.NewString()[:4], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		loc, _ := location.NewLocation(workspace1, "WS1 Loc", nil, nil, nil, nil, nil, nil)
		require.NoError(t, locRepo.Save(ctx, loc))

		inv, _ := inventory.NewInventory(workspace1, itm.ID(), loc.ID(), nil, 5, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv))

		l, _ := loan.NewLoan(workspace1, inv.ID(), b.ID(), 1, time.Now(), nil, nil)
		require.NoError(t, loanRepo.Save(ctx, l))

		// Should not find in workspace2
		found, err := loanRepo.FindByID(ctx, l.ID(), workspace2)
		require.NoError(t, err)
		assert.Nil(t, found)

		// Should find in workspace1
		found, err = loanRepo.FindByID(ctx, l.ID(), workspace1)
		require.NoError(t, err)
		assert.NotNil(t, found)
	})
}

func TestLoanRepository_FindByWorkspace(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("lists loans with pagination", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		b, _ := borrower.NewBorrower(workspace, "WS Borrower", nil, nil, nil)
		require.NoError(t, borrowerRepo.Save(ctx, b))

		for i := 0; i < 5; i++ {
			itm, _ := item.NewItem(workspace, "Item "+uuid.NewString()[:4], "SKU-"+uuid.NewString()[:8], 0)
			require.NoError(t, itemRepo.Save(ctx, itm))

			loc, _ := location.NewLocation(workspace, "Loc "+uuid.NewString()[:4], nil, nil, nil, nil, nil, nil)
			require.NoError(t, locRepo.Save(ctx, loc))

			inv, _ := inventory.NewInventory(workspace, itm.ID(), loc.ID(), nil, 10, inventory.ConditionNew, inventory.StatusAvailable, nil)
			require.NoError(t, invRepo.Save(ctx, inv))

			l, _ := loan.NewLoan(workspace, inv.ID(), b.ID(), 1, time.Now(), nil, nil)
			require.NoError(t, loanRepo.Save(ctx, l))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 3}
		loans, count, err := loanRepo.FindByWorkspace(ctx, workspace, pagination)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(loans), 3)
		assert.GreaterOrEqual(t, count, 3)
	})
}

func TestLoanRepository_FindByBorrower(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds loans by borrower", func(t *testing.T) {
		b := createTestBorrower(t, borrowerRepo, ctx, "Multi Loan Borrower")

		for i := 0; i < 3; i++ {
			inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)
			l, _ := loan.NewLoan(testfixtures.TestWorkspaceID, inv.ID(), b.ID(), 1, time.Now(), nil, nil)
			require.NoError(t, loanRepo.Save(ctx, l))
		}

		pagination := shared.Pagination{Page: 1, PageSize: 10}
		loans, err := loanRepo.FindByBorrower(ctx, testfixtures.TestWorkspaceID, b.ID(), pagination)
		require.NoError(t, err)
		assert.Len(t, loans, 3)
	})
}

func TestLoanRepository_FindByInventory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds loan by inventory", func(t *testing.T) {
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)
		b := createTestBorrower(t, borrowerRepo, ctx, "Inv Borrower")

		l, _ := loan.NewLoan(testfixtures.TestWorkspaceID, inv.ID(), b.ID(), 1, time.Now(), nil, nil)
		require.NoError(t, loanRepo.Save(ctx, l))

		loans, err := loanRepo.FindByInventory(ctx, testfixtures.TestWorkspaceID, inv.ID())
		require.NoError(t, err)
		assert.Len(t, loans, 1)
	})

	t.Run("returns empty for inventory with no loans", func(t *testing.T) {
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)

		loans, err := loanRepo.FindByInventory(ctx, testfixtures.TestWorkspaceID, inv.ID())
		require.NoError(t, err)
		assert.Empty(t, loans)
	})
}

func TestLoanRepository_FindActiveLoans(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds active loans", func(t *testing.T) {
		workspace := uuid.New()
		testdb.CreateTestWorkspace(t, pool, workspace)

		b, _ := borrower.NewBorrower(workspace, "Active Borrower", nil, nil, nil)
		require.NoError(t, borrowerRepo.Save(ctx, b))

		itm, _ := item.NewItem(workspace, "Active Item", "SKU-ACT-"+uuid.NewString()[:4], 0)
		require.NoError(t, itemRepo.Save(ctx, itm))

		loc, _ := location.NewLocation(workspace, "Active Loc", nil, nil, nil, nil, nil, nil)
		require.NoError(t, locRepo.Save(ctx, loc))

		inv, _ := inventory.NewInventory(workspace, itm.ID(), loc.ID(), nil, 5, inventory.ConditionNew, inventory.StatusAvailable, nil)
		require.NoError(t, invRepo.Save(ctx, inv))

		l, _ := loan.NewLoan(workspace, inv.ID(), b.ID(), 1, time.Now(), nil, nil)
		require.NoError(t, loanRepo.Save(ctx, l))

		loans, err := loanRepo.FindActiveLoans(ctx, workspace)
		require.NoError(t, err)
		assert.NotEmpty(t, loans)
	})
}

func TestLoanRepository_FindActiveLoanForInventory(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("finds active loan for inventory", func(t *testing.T) {
		b := createTestBorrower(t, borrowerRepo, ctx, "Active Inv Borrower")
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)

		l, _ := loan.NewLoan(testfixtures.TestWorkspaceID, inv.ID(), b.ID(), 1, time.Now(), nil, nil)
		require.NoError(t, loanRepo.Save(ctx, l))

		found, err := loanRepo.FindActiveLoanForInventory(ctx, inv.ID())
		require.NoError(t, err)
		require.NotNil(t, found)
		assert.Equal(t, l.ID(), found.ID())
	})

	t.Run("returns nil for inventory with no active loans", func(t *testing.T) {
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)

		found, err := loanRepo.FindActiveLoanForInventory(ctx, inv.ID())
		require.NoError(t, err)
		assert.Nil(t, found)
	})
}

func TestLoanRepository_GetTotalLoanedQuantity(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	pool := testdb.SetupTestDB(t)
	loanRepo := NewLoanRepository(pool)
	borrowerRepo := NewBorrowerRepository(pool)
	invRepo := NewInventoryRepository(pool)
	itemRepo := NewItemRepository(pool)
	locRepo := NewLocationRepository(pool)
	ctx := context.Background()

	t.Run("returns total loaned quantity", func(t *testing.T) {
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)
		b := createTestBorrower(t, borrowerRepo, ctx, "Qty Borrower")

		// Only one active loan per inventory allowed
		l, _ := loan.NewLoan(testfixtures.TestWorkspaceID, inv.ID(), b.ID(), 5, time.Now(), nil, nil)
		require.NoError(t, loanRepo.Save(ctx, l))

		total, err := loanRepo.GetTotalLoanedQuantity(ctx, inv.ID())
		require.NoError(t, err)
		assert.Equal(t, 5, total)
	})

	t.Run("returns zero for inventory with no loans", func(t *testing.T) {
		inv := createTestInventoryForLoan(t, invRepo, itemRepo, locRepo, ctx)

		total, err := loanRepo.GetTotalLoanedQuantity(ctx, inv.ID())
		require.NoError(t, err)
		assert.Equal(t, 0, total)
	})
}
