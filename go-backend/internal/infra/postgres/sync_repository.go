package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// SyncRepository handles sync-related database operations
type SyncRepository struct {
	q *queries.Queries
}

// NewSyncRepository creates a new sync repository from a pool
func NewSyncRepository(pool *pgxpool.Pool) *SyncRepository {
	return &SyncRepository{q: queries.New(pool)}
}

// NewSyncRepositoryFromQueries creates a new sync repository from queries
func NewSyncRepositoryFromQueries(q *queries.Queries) *SyncRepository {
	return &SyncRepository{q: q}
}

// ListItemsModifiedSince returns items modified since the given timestamp
func (r *SyncRepository) ListItemsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseItem, error) {
	return r.q.ListItemsModifiedSince(ctx, queries.ListItemsModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListLocationsModifiedSince returns locations modified since the given timestamp
func (r *SyncRepository) ListLocationsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLocation, error) {
	return r.q.ListLocationsModifiedSince(ctx, queries.ListLocationsModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListContainersModifiedSince returns containers modified since the given timestamp
func (r *SyncRepository) ListContainersModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseContainer, error) {
	return r.q.ListContainersModifiedSince(ctx, queries.ListContainersModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListInventoryModifiedSince returns inventory records modified since the given timestamp
func (r *SyncRepository) ListInventoryModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseInventory, error) {
	return r.q.ListInventoryModifiedSince(ctx, queries.ListInventoryModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListCategoriesModifiedSince returns categories modified since the given timestamp
func (r *SyncRepository) ListCategoriesModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseCategory, error) {
	return r.q.ListCategoriesModifiedSince(ctx, queries.ListCategoriesModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListLabelsModifiedSince returns labels modified since the given timestamp
func (r *SyncRepository) ListLabelsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLabel, error) {
	return r.q.ListLabelsModifiedSince(ctx, queries.ListLabelsModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListCompaniesModifiedSince returns companies modified since the given timestamp
func (r *SyncRepository) ListCompaniesModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseCompany, error) {
	return r.q.ListCompaniesModifiedSince(ctx, queries.ListCompaniesModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListBorrowersModifiedSince returns borrowers modified since the given timestamp
func (r *SyncRepository) ListBorrowersModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseBorrower, error) {
	return r.q.ListBorrowersModifiedSince(ctx, queries.ListBorrowersModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListLoansModifiedSince returns loans modified since the given timestamp
func (r *SyncRepository) ListLoansModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLoan, error) {
	return r.q.ListLoansModifiedSince(ctx, queries.ListLoansModifiedSinceParams{
		WorkspaceID: workspaceID,
		UpdatedAt:   timeToPgTimestamptz(modifiedSince),
		Limit:       limit,
	})
}

// ListDeletedRecordsModifiedSince returns deleted records since the given timestamp
func (r *SyncRepository) ListDeletedRecordsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseDeletedRecord, error) {
	return r.q.ListDeletedRecordsModifiedSince(ctx, queries.ListDeletedRecordsModifiedSinceParams{
		WorkspaceID: workspaceID,
		DeletedAt:   modifiedSince,
		Limit:       limit,
	})
}

// timeToPgTimestamptz converts a Go time.Time to pgtype.Timestamptz
func timeToPgTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:  t,
		Valid: !t.IsZero(),
	}
}
