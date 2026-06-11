package postgres

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type InventoryRepository struct {
	pool *pgxpool.Pool
}

func NewInventoryRepository(pool *pgxpool.Pool) *InventoryRepository {
	return &InventoryRepository{
		pool: pool,
	}
}

// q returns Queries bound to the active transaction in ctx (if any) or the
// pool, so reads/writes participate in TxManager.WithTx transactions (WR-01).
func (r *InventoryRepository) q(ctx context.Context) *queries.Queries {
	return queries.New(GetDBTX(ctx, r.pool))
}

func (r *InventoryRepository) Save(ctx context.Context, inv *inventory.Inventory) error {
	// Check if inventory already exists
	existing, err := r.q(ctx).GetInventory(ctx, queries.GetInventoryParams{
		ID:          inv.ID(),
		WorkspaceID: inv.WorkspaceID(),
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	var containerID pgtype.UUID
	if inv.ContainerID() != nil {
		containerID = pgtype.UUID{Bytes: *inv.ContainerID(), Valid: true}
	}

	var dateAcquired, warrantyExpires, expirationDate pgtype.Date
	if inv.DateAcquired() != nil {
		dateAcquired = pgtype.Date{Time: *inv.DateAcquired(), Valid: true}
	}
	if inv.WarrantyExpires() != nil {
		warrantyExpires = pgtype.Date{Time: *inv.WarrantyExpires(), Valid: true}
	}
	if inv.ExpirationDate() != nil {
		expirationDate = pgtype.Date{Time: *inv.ExpirationDate(), Valid: true}
	}

	var purchasePrice *int32
	if inv.PurchasePrice() != nil {
		price := int32(*inv.PurchasePrice())
		purchasePrice = &price
	}

	condition := queries.NullWarehouseItemConditionEnum{
		WarehouseItemConditionEnum: queries.WarehouseItemConditionEnum(inv.Condition()),
		Valid:                      true,
	}
	status := queries.NullWarehouseItemStatusEnum{
		WarehouseItemStatusEnum: queries.WarehouseItemStatusEnum(inv.Status()),
		Valid:                   true,
	}

	// If inventory exists, update it; otherwise create it
	if existing.ID != uuid.Nil {
		// Update existing inventory
		_, err = r.q(ctx).UpdateInventory(ctx, queries.UpdateInventoryParams{
			ID:              inv.ID(),
			WorkspaceID:     inv.WorkspaceID(),
			LocationID:      inv.LocationID(),
			ContainerID:     containerID,
			Quantity:        int32(inv.Quantity()),
			Condition:       condition,
			DateAcquired:    dateAcquired,
			PurchasePrice:   purchasePrice,
			CurrencyCode:    inv.CurrencyCode(),
			WarrantyExpires: warrantyExpires,
			ExpirationDate:  expirationDate,
			Notes:           inv.Notes(),
		})
		if err != nil {
			return err
		}
		// Separately update status since UpdateInventory doesn't include it
		_, err = r.q(ctx).UpdateInventoryStatus(ctx, queries.UpdateInventoryStatusParams{
			ID:          inv.ID(),
			WorkspaceID: inv.WorkspaceID(),
			Status:      status,
		})
		return err
	}

	// Create new inventory
	_, err = r.q(ctx).CreateInventory(ctx, queries.CreateInventoryParams{
		ID:              inv.ID(),
		WorkspaceID:     inv.WorkspaceID(),
		ItemID:          inv.ItemID(),
		LocationID:      inv.LocationID(),
		ContainerID:     containerID,
		Quantity:        int32(inv.Quantity()),
		Condition:       condition,
		Status:          status,
		DateAcquired:    dateAcquired,
		PurchasePrice:   purchasePrice,
		CurrencyCode:    inv.CurrencyCode(),
		WarrantyExpires: warrantyExpires,
		ExpirationDate:  expirationDate,
		Notes:           inv.Notes(),
	})
	return err
}

func (r *InventoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*inventory.Inventory, error) {
	row, err := r.q(ctx).GetInventory(ctx, queries.GetInventoryParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToInventory(row), nil
}

func (r *InventoryRepository) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*inventory.Inventory, int, error) {
	// Get total count
	total, err := r.q(ctx).CountInventory(ctx, workspaceID)
	if err != nil {
		return nil, 0, err
	}

	// Get paginated list
	rows, err := r.q(ctx).ListInventory(ctx, queries.ListInventoryParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	inventories := make([]*inventory.Inventory, 0, len(rows))
	for _, row := range rows {
		inventories = append(inventories, r.rowToInventory(row))
	}

	return inventories, int(total), nil
}

func (r *InventoryRepository) FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	rows, err := r.q(ctx).ListInventoryByItem(ctx, queries.ListInventoryByItemParams{
		WorkspaceID: workspaceID,
		ItemID:      itemID,
	})
	if err != nil {
		return nil, err
	}

	inventories := make([]*inventory.Inventory, 0, len(rows))
	for _, row := range rows {
		inventories = append(inventories, r.rowToInventory(row))
	}

	return inventories, nil
}

func (r *InventoryRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*inventory.Inventory, error) {
	rows, err := r.q(ctx).ListInventoryByLocation(ctx, queries.ListInventoryByLocationParams{
		WorkspaceID: workspaceID,
		LocationID:  locationID,
	})
	if err != nil {
		return nil, err
	}

	inventories := make([]*inventory.Inventory, 0, len(rows))
	for _, row := range rows {
		inventories = append(inventories, r.rowToInventory(row))
	}

	return inventories, nil
}

func (r *InventoryRepository) FindByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*inventory.Inventory, error) {
	rows, err := r.q(ctx).ListInventoryByContainer(ctx, queries.ListInventoryByContainerParams{
		WorkspaceID: workspaceID,
		ContainerID: pgtype.UUID{Bytes: containerID, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	inventories := make([]*inventory.Inventory, 0, len(rows))
	for _, row := range rows {
		inventories = append(inventories, r.rowToInventory(row))
	}

	return inventories, nil
}

func (r *InventoryRepository) FindAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	rows, err := r.q(ctx).GetAvailableInventory(ctx, queries.GetAvailableInventoryParams{
		WorkspaceID: workspaceID,
		ItemID:      itemID,
	})
	if err != nil {
		return nil, err
	}

	inventories := make([]*inventory.Inventory, 0, len(rows))
	for _, row := range rows {
		inventories = append(inventories, r.rowToInventory(row))
	}

	return inventories, nil
}

func (r *InventoryRepository) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	total, err := r.q(ctx).GetTotalQuantityByItem(ctx, queries.GetTotalQuantityByItemParams{
		WorkspaceID: workspaceID,
		ItemID:      itemID,
	})
	if err != nil {
		return 0, err
	}
	return int(total), nil
}

func (r *InventoryRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	return r.q(ctx).ArchiveInventory(ctx, queries.ArchiveInventoryParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
}

func (r *InventoryRepository) rowToInventory(row queries.WarehouseInventory) *inventory.Inventory {
	var containerID *uuid.UUID
	if row.ContainerID.Valid {
		id := uuid.UUID(row.ContainerID.Bytes)
		containerID = &id
	}

	var dateAcquired, warrantyExpires, expirationDate *time.Time
	if row.DateAcquired.Valid {
		dateAcquired = &row.DateAcquired.Time
	}
	if row.WarrantyExpires.Valid {
		warrantyExpires = &row.WarrantyExpires.Time
	}
	if row.ExpirationDate.Valid {
		expirationDate = &row.ExpirationDate.Time
	}

	var purchasePrice *int
	if row.PurchasePrice != nil {
		price := int(*row.PurchasePrice)
		purchasePrice = &price
	}

	// Convert NULL enums - use default values if not valid
	condition := inventory.ConditionNew
	if row.Condition.Valid {
		condition = inventory.Condition(row.Condition.WarehouseItemConditionEnum)
	}

	status := inventory.StatusAvailable
	if row.Status.Valid {
		status = inventory.Status(row.Status.WarehouseItemStatusEnum)
	}

	return inventory.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.ItemID,
		row.LocationID,
		containerID,
		int(row.Quantity),
		condition,
		status,
		dateAcquired,
		purchasePrice,
		row.CurrencyCode,
		warrantyExpires,
		expirationDate,
		row.Notes,
		row.IsArchived,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}

// FindExpiring returns inventory entries whose expiration_date and/or
// warranty_expires falls between today and today+withinDays. Warranty entries
// for items with lifetime_warranty are excluded by the query. Results are
// merged across both kinds and sorted by date ascending.
func (r *InventoryRepository) FindExpiring(ctx context.Context, workspaceID uuid.UUID, withinDays int) ([]inventory.ExpiringInventory, error) {
	cutoff := pgtype.Date{Time: time.Now().AddDate(0, 0, withinDays), Valid: true}

	expiring, err := r.q(ctx).ListInventoryExpiringSoon(ctx, queries.ListInventoryExpiringSoonParams{
		WorkspaceID:    workspaceID,
		ExpirationDate: cutoff,
	})
	if err != nil {
		return nil, err
	}

	warranties, err := r.q(ctx).ListWarrantiesExpiringSoon(ctx, queries.ListWarrantiesExpiringSoonParams{
		WorkspaceID:     workspaceID,
		WarrantyExpires: cutoff,
	})
	if err != nil {
		return nil, err
	}

	results := make([]inventory.ExpiringInventory, 0, len(expiring)+len(warranties))
	for _, row := range expiring {
		if !row.ExpirationDate.Valid {
			continue
		}
		results = append(results, inventory.ExpiringInventory{
			InventoryID: row.ID,
			ItemID:      row.ItemID,
			ItemName:    row.ItemName,
			Quantity:    int(row.Quantity),
			Kind:        inventory.ExpiringKindExpiration,
			Date:        row.ExpirationDate.Time,
		})
	}
	for _, row := range warranties {
		if !row.WarrantyExpires.Valid {
			continue
		}
		results = append(results, inventory.ExpiringInventory{
			InventoryID: row.ID,
			ItemID:      row.ItemID,
			ItemName:    row.ItemName,
			Quantity:    int(row.Quantity),
			Kind:        inventory.ExpiringKindWarranty,
			Date:        row.WarrantyExpires.Time,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Date.Before(results[j].Date)
	})

	return results, nil
}
