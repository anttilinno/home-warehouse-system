package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/itemphoto"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// PrimaryPhotoLookup is the narrow interface LoanDecorationLookup needs from
// itemphoto to fetch primary-photo records (the URL is derived separately via
// a generator matching the itemphoto.RegisterRoutes URL shape).
type PrimaryPhotoLookup interface {
	ListPrimaryByItemIDs(ctx context.Context, workspaceID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID]*itemphoto.ItemPhoto, error)
}

// PhotoURLGenerator mirrors item.PrimaryPhotoURLGenerator so the loan
// decoration lookup emits the same thumbnail URL shape as item/itemphoto
// handlers. isThumbnail must always be true for the loan decoration path.
type PhotoURLGenerator func(workspaceID, itemID, photoID uuid.UUID, isThumbnail bool) string

// LoanDecorationLookup is the postgres-backed implementation of
// loan.DecorationLookup. It batches item, primary-photo, and borrower reads
// into exactly 3 SQL round-trips regardless of the loan list size (plan
// 62-01 T-62-08).
type LoanDecorationLookup struct {
	queries     *queries.Queries
	photos      PrimaryPhotoLookup
	photoURLGen PhotoURLGenerator
}

// NewLoanDecorationLookup wires the postgres queries, an itemphoto
// PrimaryPhotoLookup, and a URL generator into a loan.DecorationLookup.
func NewLoanDecorationLookup(pool *pgxpool.Pool, photos PrimaryPhotoLookup, photoURLGen PhotoURLGenerator) *LoanDecorationLookup {
	return &LoanDecorationLookup{
		queries:     queries.New(pool),
		photos:      photos,
		photoURLGen: photoURLGen,
	}
}

// ItemsByInventoryIDs looks up {inventoryID -> (itemID, itemName)} in a single
// SQL call, scoped by workspace_id. Missing rows are simply absent from the
// returned map (callers handle with a zero-name fallback).
func (l *LoanDecorationLookup) ItemsByInventoryIDs(ctx context.Context, workspaceID uuid.UUID, inventoryIDs []uuid.UUID) (map[uuid.UUID]loan.ItemLookupRow, error) {
	out := map[uuid.UUID]loan.ItemLookupRow{}
	if len(inventoryIDs) == 0 {
		return out, nil
	}
	rows, err := l.queries.ListItemNamesByInventoryIDs(ctx, queries.ListItemNamesByInventoryIDsParams{
		WorkspaceID:  workspaceID,
		InventoryIds: inventoryIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("loan decoration: items by inventory IDs: %w", err)
	}
	for _, row := range rows {
		out[row.InventoryID] = loan.ItemLookupRow{
			ItemID:   row.ItemID,
			ItemName: row.ItemName,
		}
	}
	return out, nil
}

// PrimaryPhotoThumbnailURLsByItemIDs returns {itemID -> thumbnailURL} using
// the existing itemphoto batch-lookup (already workspace-scoped internally)
// and the shared URL generator. Missing primaries or a nil photos dependency
// return an empty map rather than failing.
func (l *LoanDecorationLookup) PrimaryPhotoThumbnailURLsByItemIDs(ctx context.Context, workspaceID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	out := map[uuid.UUID]string{}
	if l.photos == nil || l.photoURLGen == nil || len(itemIDs) == 0 {
		return out, nil
	}
	primaryByItem, err := l.photos.ListPrimaryByItemIDs(ctx, workspaceID, itemIDs)
	if err != nil {
		return nil, fmt.Errorf("loan decoration: primary photo batch: %w", err)
	}
	for itemID, photo := range primaryByItem {
		if photo == nil {
			continue
		}
		url := l.photoURLGen(photo.WorkspaceID, photo.ItemID, photo.ID, true)
		if url != "" {
			out[itemID] = url
		}
	}
	return out, nil
}

// BorrowersByIDs returns {borrowerID -> name}, scoped by workspace_id in a
// single SQL call. Missing rows are absent from the returned map.
func (l *LoanDecorationLookup) BorrowersByIDs(ctx context.Context, workspaceID uuid.UUID, borrowerIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	out := map[uuid.UUID]string{}
	if len(borrowerIDs) == 0 {
		return out, nil
	}
	rows, err := l.queries.ListBorrowerNamesByIDs(ctx, queries.ListBorrowerNamesByIDsParams{
		WorkspaceID: workspaceID,
		BorrowerIds: borrowerIDs,
	})
	if err != nil {
		return nil, fmt.Errorf("loan decoration: borrowers by IDs: %w", err)
	}
	for _, row := range rows {
		out[row.ID] = row.Name
	}
	return out, nil
}
