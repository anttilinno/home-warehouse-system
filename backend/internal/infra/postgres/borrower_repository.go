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
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToBorrower(row), nil
}

func (r *BorrowerRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination, includeArchived bool) ([]*borrower.Borrower, int, error) {
	// Encode includeArchived → nullable archived param:
	//   includeArchived=true  → pass *bool=true  → SQL includes all rows
	//   includeArchived=false → pass *bool=false → SQL restricts to non-archived
	archivedParam := includeArchived
	rows, err := r.queries.ListBorrowers(ctx, queries.ListBorrowersParams{
		WorkspaceID: workspaceID,
		Archived:    &archivedParam,
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

// Archive soft-archives a borrower by setting is_archived=true.
func (r *BorrowerRepository) Archive(ctx context.Context, id uuid.UUID) error {
	return r.queries.ArchiveBorrower(ctx, id)
}

// Restore flips is_archived back to false.
func (r *BorrowerRepository) Restore(ctx context.Context, id uuid.UUID) error {
	return r.queries.RestoreBorrower(ctx, id)
}

// Delete hard-deletes a borrower by ID.
func (r *BorrowerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteBorrower(ctx, id)
}

func (r *BorrowerRepository) HasActiveLoans(ctx context.Context, id uuid.UUID) (bool, error) {
	return r.queries.HasActiveLoans(ctx, id)
}

func (r *BorrowerRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*borrower.Borrower, error) {
	rows, err := r.queries.SearchBorrowers(ctx, queries.SearchBorrowersParams{
		WorkspaceID:    workspaceID,
		PlaintoTsquery: query,
		Limit:          int32(limit),
	})
	if err != nil {
		return nil, err
	}

	borrowers := make([]*borrower.Borrower, 0, len(rows))
	for _, row := range rows {
		borrowers = append(borrowers, r.rowToBorrower(row))
	}

	return borrowers, nil
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
