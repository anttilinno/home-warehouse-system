//go:build integration
// +build integration

package loan_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/testutil/factory"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// failingLoanRepo wraps the real loan repository but errors on Save, to prove
// that a failed loan insert rolls back the inventory status write (WR-01).
type failingLoanRepo struct {
	loan.Repository
}

var errSaveBoom = errors.New("simulated loan save failure")

func (f *failingLoanRepo) Save(ctx context.Context, l *loan.Loan) error {
	return errSaveBoom
}

// TestLoanCreate_FailedSaveRollsBackInventoryStatus is the WR-01 regression
// test: Create flips inventory to ON_LOAN and inserts the loan inside one
// transaction. If the loan insert fails, the inventory row must still read
// AVAILABLE afterwards — before the fix it was left stuck ON_LOAN with no
// loan record.
func TestLoanCreate_FailedSaveRollsBackInventoryStatus(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	ctx := context.Background()
	workspaceID := factory.DefaultWorkspaceID

	itemRepo := postgres.NewItemRepository(pool)
	locationRepo := postgres.NewLocationRepository(pool)
	inventoryRepo := postgres.NewInventoryRepository(pool)
	borrowerRepo := postgres.NewBorrowerRepository(pool)
	loanRepo := postgres.NewLoanRepository(pool)
	txManager := postgres.NewTxManager(pool)

	// Seed item -> location -> inventory -> borrower.
	itm, err := item.NewItem(workspaceID, "WR01 Drill", "WR01-SKU-1", 0)
	require.NoError(t, err)
	itm.SetShortCode("WR01I")
	require.NoError(t, itemRepo.Save(ctx, itm))

	loc, err := location.NewLocation(workspaceID, "WR01 Garage", nil, nil, "WR01L")
	require.NoError(t, err)
	require.NoError(t, locationRepo.Save(ctx, loc))

	inv, err := inventory.NewInventory(workspaceID, itm.ID(), loc.ID(), nil, 1, inventory.ConditionGood, inventory.StatusAvailable, nil)
	require.NoError(t, err)
	require.NoError(t, inventoryRepo.Save(ctx, inv))

	bor, err := borrower.NewBorrower(workspaceID, "WR01 Borrower", nil, nil, nil)
	require.NoError(t, err)
	require.NoError(t, borrowerRepo.Create(ctx, bor))

	createInput := loan.CreateInput{
		WorkspaceID: workspaceID,
		InventoryID: inv.ID(),
		BorrowerID:  bor.ID(),
		Quantity:    1,
		LoanedAt:    time.Now(),
	}

	// Failing loan repo: Create must error and the ON_LOAN flip must be
	// rolled back.
	svc := loan.NewService(&failingLoanRepo{Repository: loanRepo}, inventoryRepo, txManager)
	_, err = svc.Create(ctx, createInput)
	require.ErrorIs(t, err, errSaveBoom)

	reloaded, err := inventoryRepo.FindByID(ctx, inv.ID(), workspaceID)
	require.NoError(t, err)
	require.Equal(t, inventory.StatusAvailable, reloaded.Status(),
		"failed loan save must roll back the inventory ON_LOAN status flip")

	// Sanity: with the real repo the same input succeeds, flips ON_LOAN, and
	// Return atomically flips it back.
	realSvc := loan.NewService(loanRepo, inventoryRepo, txManager)
	created, err := realSvc.Create(ctx, createInput)
	require.NoError(t, err)

	reloaded, err = inventoryRepo.FindByID(ctx, inv.ID(), workspaceID)
	require.NoError(t, err)
	require.Equal(t, inventory.StatusOnLoan, reloaded.Status())

	_, err = realSvc.Return(ctx, created.ID(), workspaceID)
	require.NoError(t, err)

	reloaded, err = inventoryRepo.FindByID(ctx, inv.ID(), workspaceID)
	require.NoError(t, err)
	require.Equal(t, inventory.StatusAvailable, reloaded.Status())
}
