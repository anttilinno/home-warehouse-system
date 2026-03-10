package sync

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// EntityType Validation Tests
// =============================================================================

func TestEntityType_IsValid(t *testing.T) {
	tests := []struct {
		name       string
		entityType EntityType
		expected   bool
	}{
		{"item is valid", EntityTypeItem, true},
		{"location is valid", EntityTypeLocation, true},
		{"container is valid", EntityTypeContainer, true},
		{"inventory is valid", EntityTypeInventory, true},
		{"category is valid", EntityTypeCategory, true},
		{"label is valid", EntityTypeLabel, true},
		{"company is valid", EntityTypeCompany, true},
		{"borrower is valid", EntityTypeBorrower, true},
		{"loan is valid", EntityTypeLoan, true},
		{"invalid entity type", EntityType("invalid"), false},
		{"empty entity type", EntityType(""), false},
		{"region not supported", EntityType("region"), false},
		{"warehouse not supported", EntityType("warehouse"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.entityType.IsValid()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestAllEntityTypes_ContainsAllTypes(t *testing.T) {
	allTypes := AllEntityTypes()

	assert.Len(t, allTypes, 9)
	assert.Contains(t, allTypes, EntityTypeItem)
	assert.Contains(t, allTypes, EntityTypeLocation)
	assert.Contains(t, allTypes, EntityTypeContainer)
	assert.Contains(t, allTypes, EntityTypeInventory)
	assert.Contains(t, allTypes, EntityTypeCategory)
	assert.Contains(t, allTypes, EntityTypeLabel)
	assert.Contains(t, allTypes, EntityTypeCompany)
	assert.Contains(t, allTypes, EntityTypeBorrower)
	assert.Contains(t, allTypes, EntityTypeLoan)
}

func TestAllEntityTypes_NoDuplicates(t *testing.T) {
	allTypes := AllEntityTypes()

	seen := make(map[EntityType]bool)
	for _, et := range allTypes {
		assert.False(t, seen[et], "EntityType %s appears more than once", et)
		seen[et] = true
	}
}

// =============================================================================
// DeletedRecord Tests
// =============================================================================

func TestDeletedRecord_Structure(t *testing.T) {
	id := uuid.New()
	entityID := uuid.New()
	deletedBy := uuid.New()
	deletedAt := time.Now()

	record := DeletedRecord{
		ID:         id,
		EntityType: "item",
		EntityID:   entityID,
		DeletedAt:  deletedAt,
		DeletedBy:  &deletedBy,
	}

	assert.Equal(t, id, record.ID)
	assert.Equal(t, "item", record.EntityType)
	assert.Equal(t, entityID, record.EntityID)
	assert.Equal(t, deletedAt, record.DeletedAt)
	assert.NotNil(t, record.DeletedBy)
	assert.Equal(t, deletedBy, *record.DeletedBy)
}

func TestDeletedRecord_WithoutDeletedBy(t *testing.T) {
	id := uuid.New()
	entityID := uuid.New()

	record := DeletedRecord{
		ID:         id,
		EntityType: "location",
		EntityID:   entityID,
		DeletedAt:  time.Now(),
		DeletedBy:  nil,
	}

	assert.Nil(t, record.DeletedBy)
}

// =============================================================================
// SyncResult Tests
// =============================================================================

func TestSyncResult_EmptySync(t *testing.T) {
	syncedAt := time.Now()

	result := SyncResult{
		Items:      []ItemSyncData{},
		Locations:  []LocationSyncData{},
		Containers: []ContainerSyncData{},
		Inventory:  []InventorySyncData{},
		Categories: []CategorySyncData{},
		Labels:     []LabelSyncData{},
		Companies:  []CompanySyncData{},
		Borrowers:  []BorrowerSyncData{},
		Loans:      []LoanSyncData{},
		Deleted:    []DeletedRecord{},
		SyncedAt:   syncedAt,
		HasMore:    false,
	}

	assert.Len(t, result.Items, 0)
	assert.Len(t, result.Locations, 0)
	assert.Len(t, result.Deleted, 0)
	assert.Equal(t, syncedAt, result.SyncedAt)
	assert.False(t, result.HasMore)
}

func TestSyncResult_WithData(t *testing.T) {
	itemID := uuid.New()
	workspaceID := uuid.New()

	result := SyncResult{
		Items: []ItemSyncData{
			{
				ID:          itemID,
				WorkspaceID: workspaceID,
				Name:        "Test Item",
				SKU:         ptrString("TEST-001"),
				ShortCode:   "T1",
				IsArchived:  false,
				CreatedAt:   time.Now(),
				UpdatedAt:   time.Now(),
			},
		},
		SyncedAt: time.Now(),
		HasMore:  false,
	}

	assert.Len(t, result.Items, 1)
	assert.Equal(t, "Test Item", result.Items[0].Name)
	assert.Equal(t, "TEST-001", *result.Items[0].SKU)
}

func TestSyncResult_WithDeletedRecords(t *testing.T) {
	result := SyncResult{
		Deleted: []DeletedRecord{
			{
				ID:         uuid.New(),
				EntityType: "item",
				EntityID:   uuid.New(),
				DeletedAt:  time.Now(),
				DeletedBy:  nil,
			},
			{
				ID:         uuid.New(),
				EntityType: "location",
				EntityID:   uuid.New(),
				DeletedAt:  time.Now(),
				DeletedBy:  nil,
			},
		},
		SyncedAt: time.Now(),
		HasMore:  true,
	}

	assert.Len(t, result.Deleted, 2)
	assert.True(t, result.HasMore)
}

// =============================================================================
// ItemSyncData Tests
// =============================================================================

func TestItemSyncData_Minimal(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	item := ItemSyncData{
		ID:          id,
		WorkspaceID: workspaceID,
		Name:        "Item",
		ShortCode:   "I",
		IsArchived:  false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	assert.Equal(t, id, item.ID)
	assert.Equal(t, workspaceID, item.WorkspaceID)
	assert.Equal(t, "Item", item.Name)
	assert.Equal(t, "I", item.ShortCode)
	assert.Nil(t, item.SKU)
	assert.Nil(t, item.Description)
}

func TestItemSyncData_Complete(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	categoryID := uuid.New()
	purchasedFrom := uuid.New()
	minStockLevel := int32(10)
	now := time.Now()

	item := ItemSyncData{
		ID:               id,
		WorkspaceID:      workspaceID,
		SKU:              ptrString("SKU-123"),
		Name:             "Complete Item",
		Description:      ptrString("A complete item"),
		CategoryID:       &categoryID,
		Brand:            ptrString("Brand"),
		Model:            ptrString("Model"),
		ImageURL:         ptrString("https://example.com/img.jpg"),
		SerialNumber:     ptrString("SN-123"),
		Manufacturer:     ptrString("Manufacturer"),
		Barcode:          ptrString("123456789"),
		IsInsured:        true,
		LifetimeWarranty: false,
		NeedsReview:      false,
		WarrantyDetails:  ptrString("1 year"),
		PurchasedFrom:    &purchasedFrom,
		MinStockLevel:    &minStockLevel,
		ShortCode:        "CI",
		IsArchived:       false,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	assert.Equal(t, "SKU-123", *item.SKU)
	assert.Equal(t, "Complete Item", item.Name)
	assert.Equal(t, "A complete item", *item.Description)
	assert.Equal(t, categoryID, *item.CategoryID)
	assert.Equal(t, "Brand", *item.Brand)
	assert.Equal(t, int32(10), *item.MinStockLevel)
}

// =============================================================================
// LocationSyncData Tests
// =============================================================================

func TestLocationSyncData_Minimal(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	now := time.Now()

	loc := LocationSyncData{
		ID:          id,
		WorkspaceID: workspaceID,
		Name:        "Location",
		ShortCode:   "L",
		IsArchived:  false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	assert.Equal(t, "Location", loc.Name)
	assert.Nil(t, loc.ParentLocation)
	assert.Nil(t, loc.Description)
}

func TestLocationSyncData_WithParent(t *testing.T) {
	parentID := uuid.New()

	loc := LocationSyncData{
		ID:             uuid.New(),
		WorkspaceID:    uuid.New(),
		Name:           "Sublocation",
		ParentLocation: &parentID,
		Description:    ptrString("Child location"),
		ShortCode:      "SL",
		IsArchived:     false,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	assert.NotNil(t, loc.ParentLocation)
	assert.Equal(t, parentID, *loc.ParentLocation)
}

// =============================================================================
// ContainerSyncData Tests
// =============================================================================

func TestContainerSyncData_Complete(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	locationID := uuid.New()
	capacity := int32(50)
	now := time.Now()

	container := ContainerSyncData{
		ID:          id,
		WorkspaceID: workspaceID,
		Name:        "Box A",
		LocationID:  locationID,
		Description: ptrString("Storage box"),
		Capacity:    &capacity,
		ShortCode:   "BA",
		IsArchived:  false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	assert.Equal(t, "Box A", container.Name)
	assert.Equal(t, int32(50), *container.Capacity)
}

// =============================================================================
// InventorySyncData Tests
// =============================================================================

func TestInventorySyncData_Basic(t *testing.T) {
	id := uuid.New()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	inv := InventorySyncData{
		ID:          id,
		WorkspaceID: workspaceID,
		ItemID:      itemID,
		LocationID:  locationID,
		Quantity:    5,
		Condition:   "new",
		Status:      "available",
		IsArchived:  false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	assert.Equal(t, int32(5), inv.Quantity)
	assert.Equal(t, "new", inv.Condition)
	assert.Nil(t, inv.ContainerID)
}

func TestInventorySyncData_WithContainer(t *testing.T) {
	containerID := uuid.New()
	dateAcquired := time.Now().AddDate(-1, 0, 0)
	purchasePrice := int32(10000)
	warrantyExpires := time.Now().AddDate(2, 0, 0)

	inv := InventorySyncData{
		ID:              uuid.New(),
		WorkspaceID:     uuid.New(),
		ItemID:          uuid.New(),
		LocationID:      uuid.New(),
		ContainerID:     &containerID,
		Quantity:        1,
		Condition:       "good",
		Status:          "in-use",
		DateAcquired:    &dateAcquired,
		PurchasePrice:   &purchasePrice,
		CurrencyCode:    ptrString("USD"),
		WarrantyExpires: &warrantyExpires,
		IsArchived:      false,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	assert.NotNil(t, inv.ContainerID)
	assert.NotNil(t, inv.DateAcquired)
	assert.NotNil(t, inv.PurchasePrice)
	assert.Equal(t, int32(10000), *inv.PurchasePrice)
}

// =============================================================================
// CategorySyncData Tests
// =============================================================================

func TestCategorySyncData_Root(t *testing.T) {
	cat := CategorySyncData{
		ID:          uuid.New(),
		WorkspaceID: uuid.New(),
		Name:        "Electronics",
		Description: ptrString("Electronic devices"),
		IsArchived:  false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	assert.Equal(t, "Electronics", cat.Name)
	assert.Nil(t, cat.ParentCategoryID)
}

func TestCategorySyncData_WithParent(t *testing.T) {
	parentID := uuid.New()

	cat := CategorySyncData{
		ID:               uuid.New(),
		WorkspaceID:      uuid.New(),
		Name:             "Computers",
		ParentCategoryID: &parentID,
		IsArchived:       false,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	assert.NotNil(t, cat.ParentCategoryID)
	assert.Equal(t, parentID, *cat.ParentCategoryID)
}

// =============================================================================
// LabelSyncData Tests
// =============================================================================

func TestLabelSyncData_Complete(t *testing.T) {
	label := LabelSyncData{
		ID:          uuid.New(),
		WorkspaceID: uuid.New(),
		Name:        "Important",
		Color:       "#FF0000",
		Description: ptrString("High priority"),
		IsArchived:  false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	assert.Equal(t, "Important", label.Name)
	assert.Equal(t, "#FF0000", label.Color)
}

// =============================================================================
// CompanySyncData Tests
// =============================================================================

func TestCompanySyncData_Complete(t *testing.T) {
	company := CompanySyncData{
		ID:          uuid.New(),
		WorkspaceID: uuid.New(),
		Name:        "Acme Corp",
		Website:     ptrString("https://acme.com"),
		Phone:       ptrString("+1234567890"),
		Email:       ptrString("contact@acme.com"),
		Notes:       ptrString("Trusted vendor"),
		IsArchived:  false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	assert.Equal(t, "Acme Corp", company.Name)
	assert.Equal(t, "https://acme.com", *company.Website)
	assert.Equal(t, "+1234567890", *company.Phone)
}

// =============================================================================
// BorrowerSyncData Tests
// =============================================================================

func TestBorrowerSyncData_Complete(t *testing.T) {
	borrower := BorrowerSyncData{
		ID:          uuid.New(),
		WorkspaceID: uuid.New(),
		Name:        "John Doe",
		Email:       ptrString("john@example.com"),
		Phone:       ptrString("+1234567890"),
		Notes:       ptrString("Regular borrower"),
		IsArchived:  false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	assert.Equal(t, "John Doe", borrower.Name)
	assert.Equal(t, "john@example.com", *borrower.Email)
}

// =============================================================================
// LoanSyncData Tests
// =============================================================================

func TestLoanSyncData_Complete(t *testing.T) {
	loanedAt := time.Now().AddDate(-1, 0, 0)
	dueDate := time.Now().AddDate(0, 0, 30)
	returnedAt := time.Now()

	loan := LoanSyncData{
		ID:          uuid.New(),
		WorkspaceID: uuid.New(),
		InventoryID: uuid.New(),
		BorrowerID:  uuid.New(),
		Quantity:    2,
		LoanedAt:    loanedAt,
		DueDate:     &dueDate,
		ReturnedAt:  &returnedAt,
		Notes:       ptrString("Borrowed for project"),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	assert.Equal(t, int32(2), loan.Quantity)
	assert.NotNil(t, loan.DueDate)
	assert.NotNil(t, loan.ReturnedAt)
}

func TestLoanSyncData_Active(t *testing.T) {
	loanedAt := time.Now().AddDate(-2, 0, 0)
	dueDate := time.Now().AddDate(0, 1, 0)

	loan := LoanSyncData{
		ID:          uuid.New(),
		WorkspaceID: uuid.New(),
		InventoryID: uuid.New(),
		BorrowerID:  uuid.New(),
		Quantity:    1,
		LoanedAt:    loanedAt,
		DueDate:     &dueDate,
		ReturnedAt:  nil,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	assert.Nil(t, loan.ReturnedAt)
	assert.NotNil(t, loan.DueDate)
	assert.True(t, loan.LoanedAt.Before(loan.UpdatedAt))
}

// =============================================================================
// Helper Function
// =============================================================================

func ptrString(s string) *string {
	return &s
}
