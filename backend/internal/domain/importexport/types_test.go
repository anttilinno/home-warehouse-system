package importexport

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Format Validation Tests
// =============================================================================

func TestFormat_IsValid(t *testing.T) {
	tests := []struct {
		name     string
		format   Format
		expected bool
	}{
		{"csv is valid", FormatCSV, true},
		{"json is valid", FormatJSON, true},
		{"xlsx is valid", FormatExcel, true},
		{"invalid format", Format("xml"), false},
		{"empty format", Format(""), false},
		{"yaml not supported", Format("yaml"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.format.IsValid()
			assert.Equal(t, tt.expected, result)
		})
	}
}

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
		{"category is valid", EntityTypeCategory, true},
		{"label is valid", EntityTypeLabel, true},
		{"company is valid", EntityTypeCompany, true},
		{"borrower is valid", EntityTypeBorrower, true},
		{"invalid entity type", EntityType("inventory"), false},
		{"empty entity type", EntityType(""), false},
		{"unknown entity type", EntityType("region"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.entityType.IsValid()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSupportedEntityTypes_ContainsAllTypes(t *testing.T) {
	supported := SupportedEntityTypes()

	assert.Len(t, supported, 7)
	assert.Contains(t, supported, EntityTypeItem)
	assert.Contains(t, supported, EntityTypeLocation)
	assert.Contains(t, supported, EntityTypeContainer)
	assert.Contains(t, supported, EntityTypeCategory)
	assert.Contains(t, supported, EntityTypeLabel)
	assert.Contains(t, supported, EntityTypeCompany)
	assert.Contains(t, supported, EntityTypeBorrower)
}

func TestSupportedEntityTypes_NoDuplicates(t *testing.T) {
	supported := SupportedEntityTypes()

	seen := make(map[EntityType]bool)
	for _, et := range supported {
		assert.False(t, seen[et], "EntityType %s appears more than once", et)
		seen[et] = true
	}
}

// =============================================================================
// ImportError Tests
// =============================================================================

func TestImportError_WithAllFields(t *testing.T) {
	err := ImportError{
		Row:     1,
		Column:  "name",
		Message: "Field required",
		Code:    "FIELD_REQUIRED",
	}

	assert.Equal(t, 1, err.Row)
	assert.Equal(t, "name", err.Column)
	assert.Equal(t, "Field required", err.Message)
	assert.Equal(t, "FIELD_REQUIRED", err.Code)
}

func TestImportError_WithoutColumn(t *testing.T) {
	err := ImportError{
		Row:     5,
		Column:  "",
		Message: "Invalid row format",
		Code:    "INVALID_ROW",
	}

	assert.Equal(t, 5, err.Row)
	assert.Empty(t, err.Column)
	assert.Equal(t, "Invalid row format", err.Message)
}

// =============================================================================
// ImportResult Tests
// =============================================================================

func TestImportResult_Successful(t *testing.T) {
	result := ImportResult{
		TotalRows: 10,
		Succeeded: 10,
		Failed:    0,
		Errors:    []ImportError{},
	}

	assert.Equal(t, 10, result.TotalRows)
	assert.Equal(t, 10, result.Succeeded)
	assert.Equal(t, 0, result.Failed)
	assert.Len(t, result.Errors, 0)
}

func TestImportResult_WithFailures(t *testing.T) {
	errors := []ImportError{
		{
			Row:     2,
			Column:  "sku",
			Message: "SKU already exists",
			Code:    "DUPLICATE_SKU",
		},
		{
			Row:     5,
			Column:  "name",
			Message: "Name cannot be empty",
			Code:    "EMPTY_NAME",
		},
	}

	result := ImportResult{
		TotalRows: 10,
		Succeeded: 8,
		Failed:    2,
		Errors:    errors,
	}

	assert.Equal(t, 10, result.TotalRows)
	assert.Equal(t, 8, result.Succeeded)
	assert.Equal(t, 2, result.Failed)
	assert.Len(t, result.Errors, 2)
}

func TestImportResult_AllFailed(t *testing.T) {
	result := ImportResult{
		TotalRows: 5,
		Succeeded: 0,
		Failed:    5,
		Errors: []ImportError{
			{
				Row:     1,
				Column:  "name",
				Message: "Invalid format",
				Code:    "INVALID_FORMAT",
			},
		},
	}

	assert.Equal(t, 5, result.TotalRows)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 5, result.Failed)
}

// =============================================================================
// ExportOptions Tests
// =============================================================================

func TestExportOptions_ItemExport(t *testing.T) {
	workspaceID := uuid.New()

	opts := ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeItem,
		Format:          FormatCSV,
		IncludeArchived: false,
	}

	assert.Equal(t, workspaceID, opts.WorkspaceID)
	assert.Equal(t, EntityTypeItem, opts.EntityType)
	assert.Equal(t, FormatCSV, opts.Format)
	assert.False(t, opts.IncludeArchived)
}

func TestExportOptions_JSONFormat(t *testing.T) {
	opts := ExportOptions{
		WorkspaceID:     uuid.New(),
		EntityType:      EntityTypeLocation,
		Format:          FormatJSON,
		IncludeArchived: true,
	}

	assert.Equal(t, FormatJSON, opts.Format)
	assert.True(t, opts.IncludeArchived)
}

func TestExportOptions_ExcelFormat(t *testing.T) {
	opts := ExportOptions{
		WorkspaceID:     uuid.New(),
		EntityType:      EntityTypeCategory,
		Format:          FormatExcel,
		IncludeArchived: false,
	}

	assert.Equal(t, FormatExcel, opts.Format)
}

// =============================================================================
// ItemExport Tests
// =============================================================================

func TestItemExport_Complete(t *testing.T) {
	item := ItemExport{
		ID:            "123e4567-e89b-12d3-a456-426614174000",
		SKU:           "SKU-001",
		Name:          "Test Item",
		Description:   "A test item",
		CategoryName:  "Electronics",
		Brand:         "TestBrand",
		Model:         "Model-X",
		Manufacturer:  "TestMfg",
		Barcode:       "123456789",
		ShortCode:     "TI",
		MinStockLevel: 10,
		IsArchived:    false,
		CreatedAt:     "2026-01-01T00:00:00Z",
		UpdatedAt:     "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "SKU-001", item.SKU)
	assert.Equal(t, "Test Item", item.Name)
	assert.Equal(t, int32(10), item.MinStockLevel)
	assert.False(t, item.IsArchived)
}

func TestItemExport_Minimal(t *testing.T) {
	item := ItemExport{
		ID:        "123e4567-e89b-12d3-a456-426614174000",
		SKU:       "SKU-002",
		Name:      "Simple Item",
		ShortCode: "SI",
		CreatedAt: "2026-03-01T00:00:00Z",
		UpdatedAt: "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Simple Item", item.Name)
	assert.Empty(t, item.Description)
	assert.Empty(t, item.CategoryName)
}

// =============================================================================
// ItemImport Tests
// =============================================================================

func TestItemImport_WithAllFields(t *testing.T) {
	item := ItemImport{
		SKU:           "IMP-001",
		Name:          "Imported Item",
		Description:   "Imported from CSV",
		CategoryName:  "Imported",
		Brand:         "ImportBrand",
		Model:         "ImpModel",
		Manufacturer:  "ImpMfg",
		Barcode:       "987654321",
		MinStockLevel: 5,
	}

	assert.Equal(t, "IMP-001", item.SKU)
	assert.Equal(t, "Imported Item", item.Name)
	assert.Equal(t, "Imported from CSV", item.Description)
	assert.Equal(t, int32(5), item.MinStockLevel)
}

func TestItemImport_Minimal(t *testing.T) {
	item := ItemImport{
		SKU:  "MIN-001",
		Name: "Minimal Item",
	}

	assert.Equal(t, "MIN-001", item.SKU)
	assert.Equal(t, "Minimal Item", item.Name)
	assert.Empty(t, item.Description)
	assert.Equal(t, int32(0), item.MinStockLevel)
}

// =============================================================================
// LocationExport Tests
// =============================================================================

func TestLocationExport_RootLocation(t *testing.T) {
	loc := LocationExport{
		ID:             "123e4567-e89b-12d3-a456-426614174000",
		Name:           "Warehouse",
		ParentLocation: "",
		Description:    "Main warehouse",
		ShortCode:      "W",
		IsArchived:     false,
		CreatedAt:      "2026-01-01T00:00:00Z",
		UpdatedAt:      "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Warehouse", loc.Name)
	assert.Empty(t, loc.ParentLocation)
}

func TestLocationExport_SublocationWithParent(t *testing.T) {
	loc := LocationExport{
		ID:             "123e4567-e89b-12d3-a456-426614174001",
		Name:           "Shelf A",
		ParentLocation: "parent-location-id",
		Description:    "Shelf A in Warehouse",
		ShortCode:      "SA",
		IsArchived:     false,
		CreatedAt:      "2026-02-01T00:00:00Z",
		UpdatedAt:      "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Shelf A", loc.Name)
	assert.Equal(t, "parent-location-id", loc.ParentLocation)
}

// =============================================================================
// LocationImport Tests
// =============================================================================

func TestLocationImport_Complete(t *testing.T) {
	loc := LocationImport{
		Name:           "New Location",
		ParentLocation: "parent-id",
		Description:    "A new sublocation",
	}

	assert.Equal(t, "New Location", loc.Name)
	assert.Equal(t, "parent-id", loc.ParentLocation)
	assert.Equal(t, "A new sublocation", loc.Description)
}

// =============================================================================
// CategoryExport Tests
// =============================================================================

func TestCategoryExport_RootCategory(t *testing.T) {
	cat := CategoryExport{
		ID:             "cat-001",
		Name:           "Electronics",
		ParentCategory: "",
		Description:    "Electronic devices",
		IsArchived:     false,
		CreatedAt:      "2026-01-01T00:00:00Z",
		UpdatedAt:      "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Electronics", cat.Name)
	assert.Empty(t, cat.ParentCategory)
}

func TestCategoryExport_SubcategoryWithParent(t *testing.T) {
	cat := CategoryExport{
		ID:             "cat-002",
		Name:           "Computers",
		ParentCategory: "cat-001",
		Description:    "Computer equipment",
		IsArchived:     false,
		CreatedAt:      "2026-02-01T00:00:00Z",
		UpdatedAt:      "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Computers", cat.Name)
	assert.Equal(t, "cat-001", cat.ParentCategory)
}

// =============================================================================
// CategoryImport Tests
// =============================================================================

func TestCategoryImport_Simple(t *testing.T) {
	cat := CategoryImport{
		Name:           "New Category",
		ParentCategory: "parent-cat-id",
		Description:    "A new subcategory",
	}

	assert.Equal(t, "New Category", cat.Name)
	assert.Equal(t, "parent-cat-id", cat.ParentCategory)
}

// =============================================================================
// ContainerExport Tests
// =============================================================================

func TestContainerExport_Complete(t *testing.T) {
	container := ContainerExport{
		ID:           "container-001",
		Name:         "Box A",
		LocationName: "Warehouse",
		Description:  "Storage box",
		Capacity:     "50",
		ShortCode:    "BA",
		IsArchived:   false,
		CreatedAt:    "2026-01-01T00:00:00Z",
		UpdatedAt:    "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Box A", container.Name)
	assert.Equal(t, "Warehouse", container.LocationName)
	assert.Equal(t, "50", container.Capacity)
}

// =============================================================================
// ContainerImport Tests
// =============================================================================

func TestContainerImport_Complete(t *testing.T) {
	container := ContainerImport{
		Name:         "New Container",
		LocationName: "Warehouse A",
		Description:  "New storage container",
		Capacity:     "100",
	}

	assert.Equal(t, "New Container", container.Name)
	assert.Equal(t, "Warehouse A", container.LocationName)
	assert.Equal(t, "100", container.Capacity)
}

// =============================================================================
// LabelExport Tests
// =============================================================================

func TestLabelExport_Complete(t *testing.T) {
	label := LabelExport{
		ID:          "label-001",
		Name:        "Important",
		Color:       "#FF0000",
		Description: "High priority items",
		IsArchived:  false,
		CreatedAt:   "2026-01-01T00:00:00Z",
		UpdatedAt:   "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Important", label.Name)
	assert.Equal(t, "#FF0000", label.Color)
}

// =============================================================================
// LabelImport Tests
// =============================================================================

func TestLabelImport_Complete(t *testing.T) {
	label := LabelImport{
		Name:        "New Label",
		Color:       "#00FF00",
		Description: "A new label",
	}

	assert.Equal(t, "New Label", label.Name)
	assert.Equal(t, "#00FF00", label.Color)
}

// =============================================================================
// CompanyExport Tests
// =============================================================================

func TestCompanyExport_Complete(t *testing.T) {
	company := CompanyExport{
		ID:         "company-001",
		Name:       "Acme Corp",
		Website:    "https://acme.com",
		Notes:      "Trusted vendor",
		IsArchived: false,
		CreatedAt:  "2026-01-01T00:00:00Z",
		UpdatedAt:  "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "Acme Corp", company.Name)
	assert.Equal(t, "https://acme.com", company.Website)
}

// =============================================================================
// CompanyImport Tests
// =============================================================================

func TestCompanyImport_Complete(t *testing.T) {
	company := CompanyImport{
		Name:    "New Company",
		Website: "https://newcompany.com",
		Notes:   "New vendor",
	}

	assert.Equal(t, "New Company", company.Name)
	assert.Equal(t, "https://newcompany.com", company.Website)
}

// =============================================================================
// BorrowerExport Tests
// =============================================================================

func TestBorrowerExport_Complete(t *testing.T) {
	borrower := BorrowerExport{
		ID:         "borrower-001",
		Name:       "John Doe",
		Email:      "john@example.com",
		Phone:      "+1234567890",
		Notes:      "Regular borrower",
		IsArchived: false,
		CreatedAt:  "2026-01-01T00:00:00Z",
		UpdatedAt:  "2026-03-10T00:00:00Z",
	}

	assert.Equal(t, "John Doe", borrower.Name)
	assert.Equal(t, "john@example.com", borrower.Email)
}

// =============================================================================
// BorrowerImport Tests
// =============================================================================

func TestBorrowerImport_Complete(t *testing.T) {
	borrower := BorrowerImport{
		Name:  "Jane Doe",
		Email: "jane@example.com",
		Phone: "+0987654321",
		Notes: "New borrower",
	}

	assert.Equal(t, "Jane Doe", borrower.Name)
	assert.Equal(t, "jane@example.com", borrower.Email)
}

// =============================================================================
// ExportMetadata Tests
// =============================================================================

func TestExportMetadata_Complete(t *testing.T) {
	workspaceID := uuid.New()
	exportedAt := time.Now()

	metadata := ExportMetadata{
		EntityType:   EntityTypeItem,
		Format:       FormatCSV,
		TotalRecords: 150,
		ExportedAt:   exportedAt,
		WorkspaceID:  workspaceID,
	}

	assert.Equal(t, EntityTypeItem, metadata.EntityType)
	assert.Equal(t, FormatCSV, metadata.Format)
	assert.Equal(t, 150, metadata.TotalRecords)
	assert.Equal(t, workspaceID, metadata.WorkspaceID)
}

// =============================================================================
// WorkspaceBackupResult Tests
// =============================================================================

func TestWorkspaceBackupResult_Complete(t *testing.T) {
	exportID := uuid.New()
	recordCounts := map[string]int{
		"items":     100,
		"locations": 10,
		"categories": 5,
	}

	result := WorkspaceBackupResult{
		Data:         []byte("backup data"),
		Filename:     "workspace-backup-2026-03-10.zip",
		ContentType:  "application/zip",
		RecordCounts: recordCounts,
		TotalRecords: 115,
		ExportID:     exportID,
	}

	assert.Equal(t, "workspace-backup-2026-03-10.zip", result.Filename)
	assert.Equal(t, "application/zip", result.ContentType)
	assert.Equal(t, 115, result.TotalRecords)
	assert.Equal(t, 100, result.RecordCounts["items"])
}

// =============================================================================
// WorkspaceRestoreRequest Tests
// =============================================================================

func TestWorkspaceRestoreRequest_Complete(t *testing.T) {
	base64Data := "UEsDBBQACAAIAA=="

	req := WorkspaceRestoreRequest{
		Format: FormatJSON,
		Data:   base64Data,
	}

	assert.Equal(t, FormatJSON, req.Format)
	assert.Equal(t, base64Data, req.Data)
}

func TestWorkspaceRestoreRequest_CSV(t *testing.T) {
	csvData := "aWQsc2t1LG5hbWU="

	req := WorkspaceRestoreRequest{
		Format: FormatCSV,
		Data:   csvData,
	}

	assert.Equal(t, FormatCSV, req.Format)
}
