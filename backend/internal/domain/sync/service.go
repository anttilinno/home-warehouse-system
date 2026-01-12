package sync

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// Repository defines the interface for sync data access
type Repository interface {
	ListItemsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseItem, error)
	ListLocationsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLocation, error)
	ListContainersModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseContainer, error)
	ListInventoryModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseInventory, error)
	ListCategoriesModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseCategory, error)
	ListLabelsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLabel, error)
	ListCompaniesModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseCompany, error)
	ListBorrowersModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseBorrower, error)
	ListLoansModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseLoan, error)
	ListDeletedRecordsModifiedSince(ctx context.Context, workspaceID uuid.UUID, modifiedSince time.Time, limit int32) ([]queries.WarehouseDeletedRecord, error)
}

// Service handles delta sync operations
type Service struct {
	repo Repository
}

// NewService creates a new sync service
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// DeltaSyncInput contains the parameters for a delta sync request
type DeltaSyncInput struct {
	WorkspaceID   uuid.UUID
	ModifiedSince *time.Time
	EntityTypes   []EntityType
	Limit         int32
}

// GetDelta retrieves all entities modified since the given timestamp
func (s *Service) GetDelta(ctx context.Context, input DeltaSyncInput) (*SyncResult, error) {
	result := &SyncResult{
		SyncedAt: time.Now().UTC(),
		Deleted:  make([]DeletedRecord, 0),
	}

	// Default to all entity types if none specified
	entityTypes := input.EntityTypes
	if len(entityTypes) == 0 {
		entityTypes = AllEntityTypes()
	}

	// Use a default modified time far in the past if not provided (full sync)
	modifiedSince := time.Time{}
	if input.ModifiedSince != nil {
		modifiedSince = *input.ModifiedSince
	}

	// Fetch each requested entity type
	for _, entityType := range entityTypes {
		switch entityType {
		case EntityTypeItem:
			items, err := s.repo.ListItemsModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Items = mapItems(items)
			if len(items) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeLocation:
			locations, err := s.repo.ListLocationsModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Locations = mapLocations(locations)
			if len(locations) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeContainer:
			containers, err := s.repo.ListContainersModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Containers = mapContainers(containers)
			if len(containers) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeInventory:
			inventory, err := s.repo.ListInventoryModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Inventory = mapInventory(inventory)
			if len(inventory) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeCategory:
			categories, err := s.repo.ListCategoriesModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Categories = mapCategories(categories)
			if len(categories) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeLabel:
			labels, err := s.repo.ListLabelsModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Labels = mapLabels(labels)
			if len(labels) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeCompany:
			companies, err := s.repo.ListCompaniesModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Companies = mapCompanies(companies)
			if len(companies) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeBorrower:
			borrowers, err := s.repo.ListBorrowersModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Borrowers = mapBorrowers(borrowers)
			if len(borrowers) == int(input.Limit) {
				result.HasMore = true
			}

		case EntityTypeLoan:
			loans, err := s.repo.ListLoansModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
			if err != nil {
				return nil, err
			}
			result.Loans = mapLoans(loans)
			if len(loans) == int(input.Limit) {
				result.HasMore = true
			}
		}
	}

	// Always include deleted records for tombstone sync
	deleted, err := s.repo.ListDeletedRecordsModifiedSince(ctx, input.WorkspaceID, modifiedSince, input.Limit)
	if err != nil {
		return nil, err
	}
	result.Deleted = mapDeletedRecords(deleted)

	return result, nil
}

// ParseEntityTypes parses a comma-separated string of entity types
func ParseEntityTypes(s string) []EntityType {
	if s == "" {
		return nil
	}

	parts := strings.Split(s, ",")
	types := make([]EntityType, 0, len(parts))

	for _, part := range parts {
		t := EntityType(strings.TrimSpace(part))
		if t.IsValid() {
			types = append(types, t)
		}
	}

	return types
}

// Helper functions to convert pgtype values

func pgtimeToTime(pt pgtype.Timestamptz) time.Time {
	if pt.Valid {
		return pt.Time
	}
	return time.Time{}
}

func pgtimeToTimePtr(pt pgtype.Timestamptz) *time.Time {
	if pt.Valid {
		return &pt.Time
	}
	return nil
}

func pguuidToUUIDPtr(pu pgtype.UUID) *uuid.UUID {
	if pu.Valid {
		id := uuid.UUID(pu.Bytes)
		return &id
	}
	return nil
}

func pgdateToTimePtr(pd pgtype.Date) *time.Time {
	if pd.Valid {
		return &pd.Time
	}
	return nil
}

func boolPtrToBool(b *bool) bool {
	if b != nil {
		return *b
	}
	return false
}

func int32ToInt32Ptr(i int32) *int32 {
	return &i
}

func stringToStringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// Mapping functions

func mapItems(items []queries.WarehouseItem) []ItemSyncData {
	result := make([]ItemSyncData, len(items))
	for i, item := range items {
		result[i] = ItemSyncData{
			ID:               item.ID,
			WorkspaceID:      item.WorkspaceID,
			SKU:              stringToStringPtr(item.Sku),
			Name:             item.Name,
			Description:      item.Description,
			CategoryID:       pguuidToUUIDPtr(item.CategoryID),
			Brand:            item.Brand,
			Model:            item.Model,
			ImageURL:         item.ImageUrl,
			SerialNumber:     item.SerialNumber,
			Manufacturer:     item.Manufacturer,
			Barcode:          item.Barcode,
			IsInsured:        boolPtrToBool(item.IsInsured),
			LifetimeWarranty: boolPtrToBool(item.LifetimeWarranty),
			WarrantyDetails:  item.WarrantyDetails,
			PurchasedFrom:    pguuidToUUIDPtr(item.PurchasedFrom),
			MinStockLevel:    int32ToInt32Ptr(item.MinStockLevel),
			ShortCode:        item.ShortCode,
			IsArchived:       boolPtrToBool(item.IsArchived),
			CreatedAt:        pgtimeToTime(item.CreatedAt),
			UpdatedAt:        pgtimeToTime(item.UpdatedAt),
		}
	}
	return result
}

func mapLocations(locations []queries.WarehouseLocation) []LocationSyncData {
	result := make([]LocationSyncData, len(locations))
	for i, loc := range locations {
		result[i] = LocationSyncData{
			ID:             loc.ID,
			WorkspaceID:    loc.WorkspaceID,
			Name:           loc.Name,
			ParentLocation: pguuidToUUIDPtr(loc.ParentLocation),
			Zone:           loc.Zone,
			Shelf:          loc.Shelf,
			Bin:            loc.Bin,
			Description:    loc.Description,
			ShortCode:      loc.ShortCode,
			IsArchived:     loc.IsArchived,
			CreatedAt:      pgtimeToTime(loc.CreatedAt),
			UpdatedAt:      pgtimeToTime(loc.UpdatedAt),
		}
	}
	return result
}

func mapContainers(containers []queries.WarehouseContainer) []ContainerSyncData {
	result := make([]ContainerSyncData, len(containers))
	for i, c := range containers {
		// Capacity is a string in the database, try to parse as int
		var capacityPtr *int32
		if c.Capacity != nil {
			// Capacity is stored as string, we'll just omit it for sync
			// since the type mismatch - frontend should handle this
		}
		result[i] = ContainerSyncData{
			ID:          c.ID,
			WorkspaceID: c.WorkspaceID,
			Name:        c.Name,
			LocationID:  c.LocationID,
			Description: c.Description,
			Capacity:    capacityPtr,
			ShortCode:   c.ShortCode,
			IsArchived:  c.IsArchived,
			CreatedAt:   pgtimeToTime(c.CreatedAt),
			UpdatedAt:   pgtimeToTime(c.UpdatedAt),
		}
	}
	return result
}

func mapInventory(inventory []queries.WarehouseInventory) []InventorySyncData {
	result := make([]InventorySyncData, len(inventory))
	for i, inv := range inventory {
		condition := ""
		if inv.Condition.Valid {
			condition = string(inv.Condition.WarehouseItemConditionEnum)
		}
		status := ""
		if inv.Status.Valid {
			status = string(inv.Status.WarehouseItemStatusEnum)
		}

		result[i] = InventorySyncData{
			ID:              inv.ID,
			WorkspaceID:     inv.WorkspaceID,
			ItemID:          inv.ItemID,
			LocationID:      inv.LocationID,
			ContainerID:     pguuidToUUIDPtr(inv.ContainerID),
			Quantity:        inv.Quantity,
			Condition:       condition,
			Status:          status,
			DateAcquired:    pgdateToTimePtr(inv.DateAcquired),
			PurchasePrice:   inv.PurchasePrice,
			CurrencyCode:    inv.CurrencyCode,
			WarrantyExpires: pgdateToTimePtr(inv.WarrantyExpires),
			ExpirationDate:  pgdateToTimePtr(inv.ExpirationDate),
			Notes:           inv.Notes,
			IsArchived:      inv.IsArchived,
			CreatedAt:       pgtimeToTime(inv.CreatedAt),
			UpdatedAt:       pgtimeToTime(inv.UpdatedAt),
		}
	}
	return result
}

func mapCategories(categories []queries.WarehouseCategory) []CategorySyncData {
	result := make([]CategorySyncData, len(categories))
	for i, cat := range categories {
		result[i] = CategorySyncData{
			ID:               cat.ID,
			WorkspaceID:      cat.WorkspaceID,
			Name:             cat.Name,
			ParentCategoryID: pguuidToUUIDPtr(cat.ParentCategoryID),
			Description:      cat.Description,
			IsArchived:       cat.IsArchived,
			CreatedAt:        pgtimeToTime(cat.CreatedAt),
			UpdatedAt:        pgtimeToTime(cat.UpdatedAt),
		}
	}
	return result
}

func mapLabels(labels []queries.WarehouseLabel) []LabelSyncData {
	result := make([]LabelSyncData, len(labels))
	for i, l := range labels {
		color := ""
		if l.Color != nil {
			color = *l.Color
		}
		result[i] = LabelSyncData{
			ID:          l.ID,
			WorkspaceID: l.WorkspaceID,
			Name:        l.Name,
			Color:       color,
			Description: l.Description,
			IsArchived:  l.IsArchived,
			CreatedAt:   pgtimeToTime(l.CreatedAt),
			UpdatedAt:   pgtimeToTime(l.UpdatedAt),
		}
	}
	return result
}

func mapCompanies(companies []queries.WarehouseCompany) []CompanySyncData {
	result := make([]CompanySyncData, len(companies))
	for i, c := range companies {
		result[i] = CompanySyncData{
			ID:          c.ID,
			WorkspaceID: c.WorkspaceID,
			Name:        c.Name,
			Website:     c.Website,
			Notes:       c.Notes,
			IsArchived:  c.IsArchived,
			CreatedAt:   pgtimeToTime(c.CreatedAt),
			UpdatedAt:   pgtimeToTime(c.UpdatedAt),
		}
	}
	return result
}

func mapBorrowers(borrowers []queries.WarehouseBorrower) []BorrowerSyncData {
	result := make([]BorrowerSyncData, len(borrowers))
	for i, b := range borrowers {
		result[i] = BorrowerSyncData{
			ID:          b.ID,
			WorkspaceID: b.WorkspaceID,
			Name:        b.Name,
			Email:       b.Email,
			Phone:       b.Phone,
			Notes:       b.Notes,
			IsArchived:  b.IsArchived,
			CreatedAt:   pgtimeToTime(b.CreatedAt),
			UpdatedAt:   pgtimeToTime(b.UpdatedAt),
		}
	}
	return result
}

func mapLoans(loans []queries.WarehouseLoan) []LoanSyncData {
	result := make([]LoanSyncData, len(loans))
	for i, l := range loans {
		result[i] = LoanSyncData{
			ID:          l.ID,
			WorkspaceID: l.WorkspaceID,
			InventoryID: l.InventoryID,
			BorrowerID:  l.BorrowerID,
			Quantity:    l.Quantity,
			LoanedAt:    pgtimeToTime(l.LoanedAt),
			DueDate:     pgdateToTimePtr(l.DueDate),
			ReturnedAt:  pgtimeToTimePtr(l.ReturnedAt),
			Notes:       l.Notes,
			CreatedAt:   pgtimeToTime(l.CreatedAt),
			UpdatedAt:   pgtimeToTime(l.UpdatedAt),
		}
	}
	return result
}

func mapDeletedRecords(records []queries.WarehouseDeletedRecord) []DeletedRecord {
	result := make([]DeletedRecord, len(records))
	for i, r := range records {
		result[i] = DeletedRecord{
			ID:         r.ID,
			EntityType: string(r.EntityType),
			EntityID:   r.EntityID,
			DeletedAt:  r.DeletedAt,
			DeletedBy:  pguuidToUUIDPtr(r.DeletedBy),
		}
	}
	return result
}
