package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type LoanRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewLoanRepository(pool *pgxpool.Pool) *LoanRepository {
	return &LoanRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *LoanRepository) Save(ctx context.Context, l *loan.Loan) error {
	var dueDate pgtype.Date
	if l.DueDate() != nil {
		dueDate = pgtype.Date{Time: *l.DueDate(), Valid: true}
	}

	_, err := r.queries.CreateLoan(ctx, queries.CreateLoanParams{
		ID:          l.ID(),
		WorkspaceID: l.WorkspaceID(),
		InventoryID: l.InventoryID(),
		BorrowerID:  l.BorrowerID(),
		Quantity:    int32(l.Quantity()),
		LoanedAt:    pgtype.Timestamptz{Time: l.LoanedAt(), Valid: true},
		DueDate:     dueDate,
		Notes:       l.Notes(),
	})
	return err
}

func (r *LoanRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*loan.Loan, error) {
	row, err := r.queries.GetLoan(ctx, queries.GetLoanParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return r.rowToLoan(row), nil
}

func (r *LoanRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, int, error) {
	rows, err := r.queries.ListLoansByWorkspace(ctx, queries.ListLoansByWorkspaceParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	loans := make([]*loan.Loan, 0, len(rows))
	for _, row := range rows {
		loans = append(loans, r.rowToLoan(row))
	}

	return loans, len(loans), nil
}

func (r *LoanRepository) FindByBorrower(ctx context.Context, workspaceID, borrowerID uuid.UUID, pagination shared.Pagination) ([]*loan.Loan, error) {
	rows, err := r.queries.ListLoansByBorrower(ctx, queries.ListLoansByBorrowerParams{
		WorkspaceID: workspaceID,
		BorrowerID:  borrowerID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	loans := make([]*loan.Loan, 0, len(rows))
	for _, row := range rows {
		loans = append(loans, r.rowToLoan(row))
	}

	return loans, nil
}

func (r *LoanRepository) FindByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*loan.Loan, error) {
	rows, err := r.queries.ListLoansByInventory(ctx, queries.ListLoansByInventoryParams{
		WorkspaceID: workspaceID,
		InventoryID: inventoryID,
	})
	if err != nil {
		return nil, err
	}

	loans := make([]*loan.Loan, 0, len(rows))
	for _, row := range rows {
		loans = append(loans, r.rowToLoan(row))
	}

	return loans, nil
}

func (r *LoanRepository) FindActiveLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	rows, err := r.queries.ListActiveLoans(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	loans := make([]*loan.Loan, 0, len(rows))
	for _, row := range rows {
		loans = append(loans, r.rowToLoan(row))
	}

	return loans, nil
}

func (r *LoanRepository) FindOverdueLoans(ctx context.Context, workspaceID uuid.UUID) ([]*loan.Loan, error) {
	rows, err := r.queries.ListOverdueLoans(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	loans := make([]*loan.Loan, 0, len(rows))
	for _, row := range rows {
		loans = append(loans, r.rowToLoan(row))
	}

	return loans, nil
}

func (r *LoanRepository) FindActiveLoanForInventory(ctx context.Context, inventoryID uuid.UUID) (*loan.Loan, error) {
	row, err := r.queries.GetActiveLoanForInventory(ctx, inventoryID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return r.rowToLoan(row), nil
}

func (r *LoanRepository) GetTotalLoanedQuantity(ctx context.Context, inventoryID uuid.UUID) (int, error) {
	total, err := r.queries.GetTotalLoanedQuantity(ctx, inventoryID)
	if err != nil {
		return 0, err
	}
	return int(total), nil
}

func (r *LoanRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Note: This would typically be a hard delete or archive
	// For now, we'll just return nil as loans are typically not deleted
	return nil
}

func (r *LoanRepository) rowToLoan(row queries.WarehouseLoan) *loan.Loan {
	var dueDate, returnedAt *time.Time
	if row.DueDate.Valid {
		dueDate = &row.DueDate.Time
	}
	if row.ReturnedAt.Valid {
		returnedAt = &row.ReturnedAt.Time
	}

	return loan.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.InventoryID,
		row.BorrowerID,
		int(row.Quantity),
		row.LoanedAt.Time,
		dueDate,
		returnedAt,
		row.Notes,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
