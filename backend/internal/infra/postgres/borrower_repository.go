package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type BorrowerRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewBorrowerRepository(pool *pgxpool.Pool) *BorrowerRepository {
	return &BorrowerRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *BorrowerRepository) Save(ctx context.Context, b *borrower.Borrower) error {
	_, err := r.queries.CreateBorrower(ctx, queries.CreateBorrowerParams{
		ID:          b.ID(),
		WorkspaceID: b.WorkspaceID(),
		Name:        b.Name(),
		Email:       b.Email(),
		Phone:       b.Phone(),
		Notes:       b.Notes(),
	})
	return err
}

func (r *BorrowerRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*borrower.Borrower, error) {
	row, err := r.queries.GetBorrower(ctx, queries.GetBorrowerParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return r.rowToBorrower(row), nil
}

func (r *BorrowerRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*borrower.Borrower, int, error) {
	rows, err := r.queries.ListBorrowers(ctx, queries.ListBorrowersParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	borrowers := make([]*borrower.Borrower, 0, len(rows))
	for _, row := range rows {
		borrowers = append(borrowers, r.rowToBorrower(row))
	}

	return borrowers, len(borrowers), nil
}

func (r *BorrowerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.ArchiveBorrower(ctx, id)
}

func (r *BorrowerRepository) HasActiveLoans(ctx context.Context, id uuid.UUID) (bool, error) {
	return r.queries.HasActiveLoans(ctx, id)
}

func (r *BorrowerRepository) rowToBorrower(row queries.WarehouseBorrower) *borrower.Borrower {
	return borrower.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.Name,
		row.Email,
		row.Phone,
		row.Notes,
		row.IsArchived,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
