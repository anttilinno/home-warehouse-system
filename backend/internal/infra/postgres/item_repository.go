package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type ItemRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewItemRepository(pool *pgxpool.Pool) *ItemRepository {
	return &ItemRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *ItemRepository) Save(ctx context.Context, i *item.Item) error {
	// Check if item already exists
	existing, err := r.queries.GetItem(ctx, queries.GetItemParams{
		ID:          i.ID(),
		WorkspaceID: i.WorkspaceID(),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	var categoryID, purchasedFrom pgtype.UUID
	if i.CategoryID() != nil {
		categoryID = pgtype.UUID{Bytes: *i.CategoryID(), Valid: true}
	}
	if i.PurchasedFrom() != nil {
		purchasedFrom = pgtype.UUID{Bytes: *i.PurchasedFrom(), Valid: true}
	}

	// If item exists, check what kind of update to make
	if existing.ID != uuid.Nil {
		// If item is being archived
		existingArchived := existing.IsArchived != nil && *existing.IsArchived
		itemArchived := i.IsArchived() != nil && *i.IsArchived()
		if itemArchived && !existingArchived {
			err = r.queries.ArchiveItem(ctx, i.ID())
			return err
		}

		// Otherwise, update the item
		_, err = r.queries.UpdateItem(ctx, queries.UpdateItemParams{
			ID:                i.ID(),
			Name:              i.Name(),
			Description:       i.Description(),
			CategoryID:        categoryID,
			Brand:             i.Brand(),
			Model:             i.Model(),
			ImageUrl:          i.ImageURL(),
			SerialNumber:      i.SerialNumber(),
			Manufacturer:      i.Manufacturer(),
			Barcode:           i.Barcode(),
			IsInsured:         i.IsInsured(),
			LifetimeWarranty:  i.LifetimeWarranty(),
			WarrantyDetails:   i.WarrantyDetails(),
			PurchasedFrom:     purchasedFrom,
			MinStockLevel:     int32(i.MinStockLevel()),
			ObsidianVaultPath: i.ObsidianVaultPath(),
			ObsidianNotePath:  i.ObsidianNotePath(),
		})
		return err
	}

	// Create new item
	_, err = r.queries.CreateItem(ctx, queries.CreateItemParams{
		ID:                i.ID(),
		WorkspaceID:       i.WorkspaceID(),
		Sku:               i.SKU(),
		Name:              i.Name(),
		Description:       i.Description(),
		CategoryID:        categoryID,
		Brand:             i.Brand(),
		Model:             i.Model(),
		ImageUrl:          i.ImageURL(),
		SerialNumber:      i.SerialNumber(),
		Manufacturer:      i.Manufacturer(),
		Barcode:           i.Barcode(),
		IsInsured:         i.IsInsured(),
		LifetimeWarranty:  i.LifetimeWarranty(),
		WarrantyDetails:   i.WarrantyDetails(),
		PurchasedFrom:     purchasedFrom,
		MinStockLevel:     int32(i.MinStockLevel()),
		ShortCode:         i.ShortCode(),
		ObsidianVaultPath: i.ObsidianVaultPath(),
		ObsidianNotePath:  i.ObsidianNotePath(),
	})
	return err
}

func (r *ItemRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
	row, err := r.queries.GetItem(ctx, queries.GetItemParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToItem(row), nil
}

func (r *ItemRepository) FindBySKU(ctx context.Context, workspaceID uuid.UUID, sku string) (*item.Item, error) {
	row, err := r.queries.GetItemBySKU(ctx, queries.GetItemBySKUParams{
		WorkspaceID: workspaceID,
		Sku:         sku,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToItem(row), nil
}

func (r *ItemRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*item.Item, error) {
	row, err := r.queries.GetItemByShortCode(ctx, queries.GetItemByShortCodeParams{
		WorkspaceID: workspaceID,
		ShortCode:   &shortCode,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToItem(row), nil
}

func (r *ItemRepository) FindByBarcode(ctx context.Context, workspaceID uuid.UUID, barcode string) (*item.Item, error) {
	row, err := r.queries.GetItemByBarcode(ctx, queries.GetItemByBarcodeParams{
		WorkspaceID: workspaceID,
		Barcode:     &barcode,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToItem(row), nil
}

func (r *ItemRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	rows, err := r.queries.ListItems(ctx, queries.ListItemsParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	items := make([]*item.Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, r.rowToItem(row))
	}

	return items, len(items), nil
}

func (r *ItemRepository) FindByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*item.Item, error) {
	rows, err := r.queries.ListItemsByCategory(ctx, queries.ListItemsByCategoryParams{
		WorkspaceID: workspaceID,
		CategoryID:  pgtype.UUID{Bytes: categoryID, Valid: true},
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, err
	}

	items := make([]*item.Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, r.rowToItem(row))
	}

	return items, nil
}

func (r *ItemRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*item.Item, error) {
	rows, err := r.queries.SearchItems(ctx, queries.SearchItemsParams{
		WorkspaceID:    workspaceID,
		PlaintoTsquery: query,
		Limit:          int32(limit),
	})
	if err != nil {
		return nil, err
	}

	items := make([]*item.Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, r.rowToItem(row))
	}

	return items, nil
}

func (r *ItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.ArchiveItem(ctx, id)
}

func (r *ItemRepository) SKUExists(ctx context.Context, workspaceID uuid.UUID, sku string) (bool, error) {
	return r.queries.ItemSKUExists(ctx, queries.ItemSKUExistsParams{
		WorkspaceID: workspaceID,
		Sku:         sku,
	})
}

func (r *ItemRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	return r.queries.ItemShortCodeExists(ctx, queries.ItemShortCodeExistsParams{
		WorkspaceID: workspaceID,
		ShortCode:   &shortCode,
	})
}

func (r *ItemRepository) AttachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	return r.queries.AttachLabel(ctx, queries.AttachLabelParams{
		ItemID:  itemID,
		LabelID: labelID,
	})
}

func (r *ItemRepository) DetachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	return r.queries.DetachLabel(ctx, queries.DetachLabelParams{
		ItemID:  itemID,
		LabelID: labelID,
	})
}

func (r *ItemRepository) GetItemLabels(ctx context.Context, itemID uuid.UUID) ([]uuid.UUID, error) {
	labels, err := r.queries.GetItemLabels(ctx, itemID)
	if err != nil {
		return nil, err
	}

	labelIDs := make([]uuid.UUID, len(labels))
	for i, label := range labels {
		labelIDs[i] = label.ID
	}
	return labelIDs, nil
}

func (r *ItemRepository) rowToItem(row queries.WarehouseItem) *item.Item {
	var categoryID, purchasedFrom *uuid.UUID
	if row.CategoryID.Valid {
		id := uuid.UUID(row.CategoryID.Bytes)
		categoryID = &id
	}
	if row.PurchasedFrom.Valid {
		id := uuid.UUID(row.PurchasedFrom.Bytes)
		purchasedFrom = &id
	}

	return item.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.Sku,
		row.Name,
		row.Description,
		categoryID,
		row.Brand,
		row.Model,
		row.ImageUrl,
		row.SerialNumber,
		row.Manufacturer,
		row.Barcode,
		row.IsInsured,
		row.IsArchived,
		row.LifetimeWarranty,
		row.WarrantyDetails,
		purchasedFrom,
		int(row.MinStockLevel),
		row.ShortCode,
		row.ObsidianVaultPath,
		row.ObsidianNotePath,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
