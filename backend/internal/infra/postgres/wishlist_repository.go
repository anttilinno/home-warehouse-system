package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/wishlist"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// WishlistRepository implements the wishlist.Repository interface.
type WishlistRepository struct {
	pool *pgxpool.Pool
}

// NewWishlistRepository creates a new WishlistRepository.
func NewWishlistRepository(pool *pgxpool.Pool) *WishlistRepository {
	return &WishlistRepository{pool: pool}
}

// q returns Queries bound to the active transaction in ctx (if any) or the
// pool, so approval-pipeline applies stay atomic under TxManager.WithTx.
func (r *WishlistRepository) q(ctx context.Context) *queries.Queries {
	return queries.New(GetDBTX(ctx, r.pool))
}

// Save creates or updates a wishlist item.
func (r *WishlistRepository) Save(ctx context.Context, item *wishlist.Item) error {
	existing, err := r.q(ctx).GetWishlistItem(ctx, queries.GetWishlistItemParams{
		ID:          item.ID(),
		WorkspaceID: item.WorkspaceID(),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if existing.ID != uuid.Nil {
		_, err = r.q(ctx).UpdateWishlistItem(ctx, queries.UpdateWishlistItemParams{
			ID:                item.ID(),
			WorkspaceID:       item.WorkspaceID(),
			Name:              item.Name(),
			Notes:             item.Notes(),
			Url:               item.URL(),
			PriceEstimate:     intPtrToInt32Ptr(item.PriceEstimate()),
			CurrencyCode:      item.CurrencyCode(),
			Priority:          int16(item.Priority()),
			DesiredCategoryID: uuidPtrToPgtype(item.DesiredCategoryID()),
			Status:            string(item.Status()),
			AcquiredItemID:    uuidPtrToPgtype(item.AcquiredItemID()),
		})
		return err
	}

	_, err = r.q(ctx).CreateWishlistItem(ctx, queries.CreateWishlistItemParams{
		ID:                item.ID(),
		WorkspaceID:       item.WorkspaceID(),
		Name:              item.Name(),
		Notes:             item.Notes(),
		Url:               item.URL(),
		PriceEstimate:     intPtrToInt32Ptr(item.PriceEstimate()),
		CurrencyCode:      item.CurrencyCode(),
		Priority:          int16(item.Priority()),
		DesiredCategoryID: uuidPtrToPgtype(item.DesiredCategoryID()),
		Status:            string(item.Status()),
		AcquiredItemID:    uuidPtrToPgtype(item.AcquiredItemID()),
		CreatedBy:         uuidPtrToPgtype(item.CreatedBy()),
	})
	return err
}

// FindByID retrieves a wishlist item by ID within a workspace.
func (r *WishlistRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*wishlist.Item, error) {
	row, err := r.q(ctx).GetWishlistItem(ctx, queries.GetWishlistItemParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}
	return rowToWishlistItem(row), nil
}

// FindByWorkspace retrieves wishlist items for a workspace with pagination,
// optionally filtered by status.
func (r *WishlistRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, status *wishlist.Status, pagination shared.Pagination) ([]*wishlist.Item, int, error) {
	var statusFilter *string
	if status != nil {
		s := string(*status)
		statusFilter = &s
	}

	rows, err := r.q(ctx).ListWishlistItemsByWorkspace(ctx, queries.ListWishlistItemsByWorkspaceParams{
		WorkspaceID: workspaceID,
		Status:      statusFilter,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := r.q(ctx).CountWishlistItemsByWorkspace(ctx, queries.CountWishlistItemsByWorkspaceParams{
		WorkspaceID: workspaceID,
		Status:      statusFilter,
	})
	if err != nil {
		return nil, 0, err
	}

	items := make([]*wishlist.Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, rowToWishlistItem(row))
	}
	return items, int(total), nil
}

// Delete removes a wishlist item by ID.
func (r *WishlistRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return r.q(ctx).DeleteWishlistItem(ctx, queries.DeleteWishlistItemParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
}

// rowToWishlistItem converts a database row to a domain entity.
func rowToWishlistItem(row queries.WarehouseWishlistItem) *wishlist.Item {
	return wishlist.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.Name,
		row.Notes,
		row.Url,
		int32PtrToIntPtr(row.PriceEstimate),
		row.CurrencyCode,
		int(row.Priority),
		pgtypeToUUIDPtr(row.DesiredCategoryID),
		wishlist.Status(row.Status),
		pgtypeToUUIDPtr(row.AcquiredItemID),
		pgtypeToUUIDPtr(row.CreatedBy),
		row.CreatedAt,
		row.UpdatedAt,
	)
}

// uuidPtrToPgtype converts a *uuid.UUID to a pgtype.UUID (nil -> NULL).
func uuidPtrToPgtype(p *uuid.UUID) pgtype.UUID {
	if p == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *p, Valid: true}
}

// pgtypeToUUIDPtr converts a pgtype.UUID to a *uuid.UUID (NULL -> nil).
func pgtypeToUUIDPtr(p pgtype.UUID) *uuid.UUID {
	if !p.Valid {
		return nil
	}
	id := uuid.UUID(p.Bytes)
	return &id
}

// intPtrToInt32Ptr converts a *int to a *int32 (nil-safe).
func intPtrToInt32Ptr(p *int) *int32 {
	if p == nil {
		return nil
	}
	v := int32(*p)
	return &v
}

// int32PtrToIntPtr converts a *int32 to a *int (nil-safe).
func int32PtrToIntPtr(p *int32) *int {
	if p == nil {
		return nil
	}
	v := int(*p)
	return &v
}
