package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/declutter"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// DeclutterRepository implements the declutter.Repository interface.
type DeclutterRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewDeclutterRepository creates a new DeclutterRepository.
func NewDeclutterRepository(pool *pgxpool.Pool) *DeclutterRepository {
	return &DeclutterRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// FindUnused returns inventory items that haven't been used for the specified threshold.
func (r *DeclutterRepository) FindUnused(ctx context.Context, params declutter.ListParams) ([]declutter.DeclutterItem, error) {
	rows, err := r.queries.ListUnusedInventory(ctx, queries.ListUnusedInventoryParams{
		WorkspaceID: params.WorkspaceID,
		Days:        int32(params.ThresholdDays),
		Limit:       int32(params.Limit()),
		Offset:      int32(params.Offset()),
		GroupBy:     string(params.GroupBy),
	})
	if err != nil {
		return nil, err
	}

	items := make([]declutter.DeclutterItem, len(rows))
	for i, row := range rows {
		items[i] = r.rowToDeclutterItem(row)
	}

	return items, nil
}

// CountUnused returns the total count of unused inventory for pagination.
func (r *DeclutterRepository) CountUnused(ctx context.Context, workspaceID uuid.UUID, thresholdDays int) (int, error) {
	count, err := r.queries.CountUnusedInventory(ctx, queries.CountUnusedInventoryParams{
		WorkspaceID: workspaceID,
		Days:        int32(thresholdDays),
	})
	if err != nil {
		return 0, err
	}
	return int(count), nil
}

// GetCounts returns summary counts of unused inventory at 90/180/365 day thresholds.
func (r *DeclutterRepository) GetCounts(ctx context.Context, workspaceID uuid.UUID) (*declutter.DeclutterCounts, error) {
	row, err := r.queries.GetUnusedInventoryCounts(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	return &declutter.DeclutterCounts{
		Unused90:  int(row.Unused90),
		Unused180: int(row.Unused180),
		Unused365: int(row.Unused365),
		Value90:   row.Value90,
		Value180:  row.Value180,
		Value365:  row.Value365,
	}, nil
}

// GetMaxValue returns the maximum purchase price in the workspace for percentile calculation.
func (r *DeclutterRepository) GetMaxValue(ctx context.Context, workspaceID uuid.UUID) (int, error) {
	maxValue, err := r.queries.GetMaxInventoryValue(ctx, workspaceID)
	if err != nil {
		return 0, err
	}
	return int(maxValue), nil
}

// MarkUsed updates the last_used_at timestamp to current time.
func (r *DeclutterRepository) MarkUsed(ctx context.Context, inventoryID, workspaceID uuid.UUID) error {
	_, err := r.queries.MarkInventoryUsed(ctx, queries.MarkInventoryUsedParams{
		ID:          inventoryID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return shared.ErrNotFound
		}
		return err
	}
	return nil
}

// rowToDeclutterItem converts a database row to a domain entity.
func (r *DeclutterRepository) rowToDeclutterItem(row queries.ListUnusedInventoryRow) declutter.DeclutterItem {
	var containerID *uuid.UUID
	if row.ContainerID.Valid {
		id := uuid.UUID(row.ContainerID.Bytes)
		containerID = &id
	}

	var condition *string
	if row.Condition.Valid {
		s := string(row.Condition.WarehouseItemConditionEnum)
		condition = &s
	}

	var status *string
	if row.Status.Valid {
		s := string(row.Status.WarehouseItemStatusEnum)
		status = &s
	}

	var purchasePrice *int
	if row.PurchasePrice != nil {
		p := int(*row.PurchasePrice)
		purchasePrice = &p
	}

	var lastUsedAt *time.Time
	if row.LastUsedAt.Valid {
		lastUsedAt = &row.LastUsedAt.Time
	}

	var categoryID *uuid.UUID
	if row.CategoryID.Valid {
		id := uuid.UUID(row.CategoryID.Bytes)
		categoryID = &id
	}

	return declutter.DeclutterItem{
		ID:            row.ID,
		WorkspaceID:   row.WorkspaceID,
		ItemID:        row.ItemID,
		LocationID:    row.LocationID,
		ContainerID:   containerID,
		Quantity:      int(row.Quantity),
		Condition:     condition,
		Status:        status,
		PurchasePrice: purchasePrice,
		CurrencyCode:  row.CurrencyCode,
		LastUsedAt:    lastUsedAt,
		CreatedAt:     row.CreatedAt.Time,
		UpdatedAt:     row.UpdatedAt.Time,
		ItemName:      row.ItemName,
		ItemSKU:       row.ItemSku,
		LocationName:  row.LocationName,
		CategoryID:    categoryID,
		CategoryName:  row.CategoryName,
		DaysUnused:    int(row.DaysUnused),
		Score:         0, // Score is calculated in service layer
	}
}
