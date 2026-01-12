package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

type InventoryRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewInventoryRepository(pool *pgxpool.Pool) *InventoryRepository {
	return &InventoryRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *InventoryRepository) Save(ctx context.Context, inv *inventory.Inventory) error {
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

	_, err := r.queries.CreateInventory(ctx, queries.CreateInventoryParams{
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
	row, err := r.queries.GetInventory(ctx, queries.GetInventoryParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return r.rowToInventory(row), nil
}

func (r *InventoryRepository) FindByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*inventory.Inventory, error) {
	rows, err := r.queries.ListInventoryByItem(ctx, queries.ListInventoryByItemParams{
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
	rows, err := r.queries.ListInventoryByLocation(ctx, queries.ListInventoryByLocationParams{
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
	rows, err := r.queries.ListInventoryByContainer(ctx, queries.ListInventoryByContainerParams{
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
	rows, err := r.queries.GetAvailableInventory(ctx, queries.GetAvailableInventoryParams{
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
	total, err := r.queries.GetTotalQuantityByItem(ctx, queries.GetTotalQuantityByItemParams{
		WorkspaceID: workspaceID,
		ItemID:      itemID,
	})
	if err != nil {
		return 0, err
	}
	return int(total), nil
}

func (r *InventoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.ArchiveInventory(ctx, id)
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
