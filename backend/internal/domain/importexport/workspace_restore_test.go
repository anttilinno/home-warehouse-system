package importexport

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/xuri/excelize/v2"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// =============================================================================
// Helper Functions for Creating Test Excel Files
// =============================================================================

func createTestExcelFile(t *testing.T, sheets map[string][][]string) []byte {
	t.Helper()
	f := excelize.NewFile()
	defer f.Close()

	// Delete default sheet
	f.DeleteSheet("Sheet1")

	for sheetName, rows := range sheets {
		_, err := f.NewSheet(sheetName)
		if err != nil {
			t.Fatalf("Failed to create sheet %s: %v", sheetName, err)
		}
		for rowIdx, row := range rows {
			for colIdx, value := range row {
				cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+1)
				f.SetCellValue(sheetName, cell, value)
			}
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		t.Fatalf("Failed to write Excel to buffer: %v", err)
	}
	return buf.Bytes()
}

// =============================================================================
// Import Workspace Tests - JSON Format
// =============================================================================

func TestImportWorkspace_Success_JSON(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Create test data to import
	testData := WorkspaceData{
		Categories: []queries.WarehouseCategory{
			{
				ID:   uuid.New(),
				Name: "Electronics",
			},
		},
		Labels:      []queries.WarehouseLabel{},
		Companies:   []queries.WarehouseCompany{},
		Locations:   []queries.WarehouseLocation{},
		Borrowers:   []queries.WarehouseBorrower{},
		Items:       []queries.WarehouseItem{},
		Containers:  []queries.WarehouseContainer{},
		Inventory:   []queries.WarehouseInventory{},
		Loans:       []queries.WarehouseLoan{},
		Attachments: []queries.WarehouseAttachment{},
	}

	jsonData, err := json.Marshal(testData)
	assert.NoError(t, err)

	// Mock the category creation
	mockQueries.On("CreateCategory", ctx, mock.MatchedBy(func(arg queries.CreateCategoryParams) bool {
		return arg.WorkspaceID == workspaceID && arg.Name == "Electronics"
	})).Return(queries.WarehouseCategory{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 1, result.TotalRows)
	assert.Equal(t, 1, result.Succeeded)
	assert.Equal(t, 0, result.Failed)

	mockQueries.AssertExpectations(t)
}

func TestImportWorkspace_Success_Excel(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	catID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Create test Excel file with categories
	excelData := createTestExcelFile(t, map[string][][]string{
		"Categories": {
			{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"},
			{catID.String(), "Tools", "", "Hand tools", "false", "", ""},
		},
	})

	// Mock the category creation
	mockQueries.On("CreateCategory", ctx, mock.MatchedBy(func(arg queries.CreateCategoryParams) bool {
		return arg.WorkspaceID == workspaceID && arg.Name == "Tools"
	})).Return(queries.WarehouseCategory{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 1, result.TotalRows)
	assert.Equal(t, 1, result.Succeeded)
	assert.Equal(t, 0, result.Failed)

	mockQueries.AssertExpectations(t)
}

func TestImportWorkspace_UnsupportedFormat(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)
	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ImportWorkspace(ctx, workspaceID, Format("xml"), []byte("data"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported format")
}

func TestImportWorkspace_InvalidJSON(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)
	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, []byte("invalid json"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse import file")
}

func TestImportWorkspace_InvalidExcel(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)
	svc := &WorkspaceBackupService{queries: mockQueries}

	// Pass invalid Excel data (just random bytes)
	_, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, []byte("not an excel file"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse import file")
}

func TestImportWorkspace_EmptyFile(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)
	svc := &WorkspaceBackupService{queries: mockQueries}

	// Create empty Excel file
	excelData := createTestExcelFile(t, map[string][][]string{
		"Categories": {
			{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"},
			// No data rows
		},
	})

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 0, result.TotalRows)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 0, result.Failed)
}

// =============================================================================
// Import Categories Tests
// =============================================================================

func TestImportWorkspace_Categories_WithParent(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	parentID := uuid.New()
	childID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Create Excel with parent and child categories
	excelData := createTestExcelFile(t, map[string][][]string{
		"Categories": {
			{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"},
			{parentID.String(), "Electronics", "", "Electronic devices", "false", "", ""},
			{childID.String(), "Phones", parentID.String(), "Mobile phones", "false", "", ""},
		},
	})

	// Mock parent category creation (first pass - no parent)
	mockQueries.On("CreateCategory", ctx, mock.MatchedBy(func(arg queries.CreateCategoryParams) bool {
		return arg.Name == "Electronics" && !arg.ParentCategoryID.Valid
	})).Return(queries.WarehouseCategory{ID: uuid.New()}, nil)

	// Mock child category creation (second pass - with parent)
	mockQueries.On("CreateCategory", ctx, mock.MatchedBy(func(arg queries.CreateCategoryParams) bool {
		return arg.Name == "Phones" && arg.ParentCategoryID.Valid
	})).Return(queries.WarehouseCategory{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 2, result.TotalRows)
	assert.Equal(t, 2, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

func TestImportWorkspace_Categories_CreateError(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Create test data with one category
	testData := WorkspaceData{
		Categories: []queries.WarehouseCategory{
			{ID: uuid.New(), Name: "Test Category"},
		},
	}
	jsonData, _ := json.Marshal(testData)

	// Mock category creation failure
	mockQueries.On("CreateCategory", ctx, mock.Anything).
		Return(queries.WarehouseCategory{}, fmt.Errorf("database error"))

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	// Import continues despite errors
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 1, result.TotalRows)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Errors, 1)
	assert.Contains(t, result.Errors[0].Message, "database error")

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Import Labels Tests
// =============================================================================

func TestImportWorkspace_Labels(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	labelID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	excelData := createTestExcelFile(t, map[string][][]string{
		"Labels": {
			{"ID", "Name", "Color", "Description", "Archived", "Created At", "Updated At"},
			{labelID.String(), "Fragile", "#FF0000", "Handle with care", "false", "", ""},
		},
	})

	mockQueries.On("CreateLabel", ctx, mock.MatchedBy(func(arg queries.CreateLabelParams) bool {
		return arg.WorkspaceID == workspaceID && arg.Name == "Fragile"
	})).Return(queries.WarehouseLabel{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.TotalRows)
	assert.Equal(t, 1, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

func TestImportWorkspace_Labels_CreateError(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	testData := WorkspaceData{
		Labels: []queries.WarehouseLabel{
			{ID: uuid.New(), Name: "Test Label"},
		},
	}
	jsonData, _ := json.Marshal(testData)

	mockQueries.On("CreateLabel", ctx, mock.Anything).
		Return(queries.WarehouseLabel{}, fmt.Errorf("constraint violation"))

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Errors, 1)

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Import Companies Tests
// =============================================================================

func TestImportWorkspace_Companies(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	companyID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	excelData := createTestExcelFile(t, map[string][][]string{
		"Companies": {
			{"ID", "Name", "Website", "Notes", "Archived", "Created At", "Updated At"},
			{companyID.String(), "Acme Corp", "https://acme.com", "Main supplier", "false", "", ""},
		},
	})

	mockQueries.On("CreateCompany", ctx, mock.MatchedBy(func(arg queries.CreateCompanyParams) bool {
		return arg.WorkspaceID == workspaceID && arg.Name == "Acme Corp"
	})).Return(queries.WarehouseCompany{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Import Locations Tests
// =============================================================================

func TestImportWorkspace_Locations(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	excelData := createTestExcelFile(t, map[string][][]string{
		"Locations": {
			{"ID", "Name", "Parent Location ID", "Description", "Short Code", "Archived", "Created At", "Updated At"},
			{locID.String(), "Warehouse A", "", "Main warehouse", "WH-A", "false", "", ""},
		},
	})

	mockQueries.On("CreateLocation", ctx, mock.MatchedBy(func(arg queries.CreateLocationParams) bool {
		return arg.WorkspaceID == workspaceID && arg.Name == "Warehouse A"
	})).Return(queries.WarehouseLocation{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

func TestImportWorkspace_Locations_WithParent(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	parentID := uuid.New()
	childID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	excelData := createTestExcelFile(t, map[string][][]string{
		"Locations": {
			{"ID", "Name", "Parent Location ID", "Description", "Short Code", "Archived", "Created At", "Updated At"},
			{parentID.String(), "Building A", "", "Main building", "BLD-A", "false", "", ""},
			{childID.String(), "Room 101", parentID.String(), "First floor room", "R101", "false", "", ""},
		},
	})

	// Parent location (no parent)
	mockQueries.On("CreateLocation", ctx, mock.MatchedBy(func(arg queries.CreateLocationParams) bool {
		return arg.Name == "Building A" && !arg.ParentLocation.Valid
	})).Return(queries.WarehouseLocation{ID: uuid.New()}, nil)

	// Child location (with parent)
	mockQueries.On("CreateLocation", ctx, mock.MatchedBy(func(arg queries.CreateLocationParams) bool {
		return arg.Name == "Room 101" && arg.ParentLocation.Valid
	})).Return(queries.WarehouseLocation{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 2, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Import Borrowers Tests
// =============================================================================

func TestImportWorkspace_Borrowers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	borrowerID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	excelData := createTestExcelFile(t, map[string][][]string{
		"Borrowers": {
			{"ID", "Name", "Email", "Phone", "Notes", "Archived", "Created At", "Updated At"},
			{borrowerID.String(), "John Doe", "john@example.com", "+1234567890", "Regular borrower", "false", "", ""},
		},
	})

	mockQueries.On("CreateBorrower", ctx, mock.MatchedBy(func(arg queries.CreateBorrowerParams) bool {
		return arg.WorkspaceID == workspaceID && arg.Name == "John Doe"
	})).Return(queries.WarehouseBorrower{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Import Items Tests
// =============================================================================

func TestImportWorkspace_Items(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	excelData := createTestExcelFile(t, map[string][][]string{
		"Items": {
			{"ID", "SKU", "Name", "Description", "Category ID", "Brand", "Model", "Manufacturer", "Barcode", "Short Code", "Min Stock", "Archived", "Created At", "Updated At"},
			{itemID.String(), "SKU-001", "Hammer", "Ball peen hammer", "", "Stanley", "HPT-100", "Stanley Black & Decker", "1234567890123", "HAM-001", "5", "false", "", ""},
		},
	})

	mockQueries.On("CreateItem", ctx, mock.MatchedBy(func(arg queries.CreateItemParams) bool {
		return arg.WorkspaceID == workspaceID && arg.Name == "Hammer" && arg.Sku == "SKU-001"
	})).Return(queries.WarehouseItem{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Import Containers Tests
// =============================================================================

func TestImportWorkspace_Containers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	containerID := uuid.New()
	locationID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// The container's location must be part of the same backup: its ID is
	// resolved through the location import mapping, never inserted verbatim.
	excelData := createTestExcelFile(t, map[string][][]string{
		"Locations": {
			{"ID", "Name", "Parent Location ID", "Description", "Short Code", "Archived", "Created At", "Updated At"},
			{locationID.String(), "Garage", "", "Main garage", "GAR-001", "false", "", ""},
		},
		"Containers": {
			{"ID", "Name", "Location ID", "Description", "Capacity", "Short Code", "Archived", "Created At", "Updated At"},
			{containerID.String(), "Box A1", locationID.String(), "Storage box", "100 items", "BOX-A1", "false", "", ""},
		},
	})

	var newLocationID uuid.UUID
	mockQueries.On("CreateLocation", ctx, mock.MatchedBy(func(arg queries.CreateLocationParams) bool {
		if arg.WorkspaceID == workspaceID && arg.Name == "Garage" {
			newLocationID = arg.ID
			return true
		}
		return false
	})).Return(queries.WarehouseLocation{ID: uuid.New()}, nil)

	mockQueries.On("CreateContainer", ctx, mock.MatchedBy(func(arg queries.CreateContainerParams) bool {
		// LocationID must be the NEW id created during this import,
		// not the original file-supplied id.
		return arg.WorkspaceID == workspaceID && arg.Name == "Box A1" &&
			arg.LocationID == newLocationID && arg.LocationID != locationID
	})).Return(queries.WarehouseContainer{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 2, result.Succeeded)

	mockQueries.AssertExpectations(t)
}

// TestImportWorkspace_Containers_RejectsForeignLocation verifies the
// cross-tenant FK injection fix: a backup whose container references a
// location NOT included in the backup (e.g. another tenant's location ID)
// must be skipped with a clean ImportError instead of inserting the
// file-supplied ID verbatim.
func TestImportWorkspace_Containers_RejectsForeignLocation(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	containerID := uuid.New()
	foreignLocationID := uuid.New() // not part of the backup

	mockQueries := new(MockWorkspaceBackupQueries)

	excelData := createTestExcelFile(t, map[string][][]string{
		"Containers": {
			{"ID", "Name", "Location ID", "Description", "Capacity", "Short Code", "Archived", "Created At", "Updated At"},
			{containerID.String(), "Box A1", foreignLocationID.String(), "Storage box", "100 items", "BOX-A1", "false", "", ""},
		},
	})

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatExcel, excelData)

	assert.NoError(t, err)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	if assert.Len(t, result.Errors, 1) {
		assert.Equal(t, "LOCATION_NOT_FOUND", result.Errors[0].Code)
	}

	// CreateContainer must never have been called
	mockQueries.AssertNotCalled(t, "CreateContainer", mock.Anything, mock.Anything)
}

// =============================================================================
// Parse Functions Tests
// =============================================================================

func TestParseCategoriesFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	catID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name     string
		rows     [][]string
		expected int
	}{
		{
			name: "valid rows",
			rows: [][]string{
				{catID.String(), "Electronics", "", "Electronic items", "false"},
				{uuid.New().String(), "Phones", parentID.String(), "Mobile phones", "true"},
			},
			expected: 2,
		},
		{
			name: "row with insufficient columns skipped",
			rows: [][]string{
				{catID.String()}, // Only one column
				{uuid.New().String(), "Valid"},
			},
			expected: 1,
		},
		{
			name:     "empty rows",
			rows:     [][]string{},
			expected: 0,
		},
		{
			name: "invalid UUID handled",
			rows: [][]string{
				{"invalid-uuid", "Test Category", "", "", "false"},
			},
			expected: 1, // Row is still processed, just ID won't be set
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.parseCategoriesFromRows(tt.rows)
			assert.Len(t, result, tt.expected)
		})
	}
}

func TestParseLabelsFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	labelID := uuid.New()

	tests := []struct {
		name     string
		rows     [][]string
		expected int
	}{
		{
			name: "valid rows",
			rows: [][]string{
				{labelID.String(), "Fragile", "#FF0000", "Handle with care", "false"},
			},
			expected: 1,
		},
		{
			name: "row with insufficient columns skipped",
			rows: [][]string{
				{labelID.String()}, // Only ID
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.parseLabelsFromRows(tt.rows)
			assert.Len(t, result, tt.expected)
		})
	}
}

func TestParseCompaniesFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	companyID := uuid.New()

	rows := [][]string{
		{companyID.String(), "Acme Corp", "https://acme.com", "Notes", "false"},
	}

	result := svc.parseCompaniesFromRows(rows)
	assert.Len(t, result, 1)
	assert.Equal(t, "Acme Corp", result[0].Name)
}

func TestParseLocationsFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	locID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name      string
		rows      [][]string
		expected  int
		hasParent bool
	}{
		{
			name: "location without parent",
			rows: [][]string{
				{locID.String(), "Warehouse A", "", "Main warehouse", "WH-A", "false"},
			},
			expected:  1,
			hasParent: false,
		},
		{
			name: "location with parent",
			rows: [][]string{
				{locID.String(), "Room 101", parentID.String(), "A room", "R101", "false"},
			},
			expected:  1,
			hasParent: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.parseLocationsFromRows(tt.rows)
			assert.Len(t, result, tt.expected)
			if tt.expected > 0 {
				assert.Equal(t, tt.hasParent, result[0].ParentLocation.Valid)
			}
		})
	}
}

func TestParseBorrowersFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	borrowerID := uuid.New()

	rows := [][]string{
		{borrowerID.String(), "John Doe", "john@example.com", "+1234567890", "Notes", "false"},
	}

	result := svc.parseBorrowersFromRows(rows)
	assert.Len(t, result, 1)
	assert.Equal(t, "John Doe", result[0].Name)
	assert.Equal(t, "john@example.com", *result[0].Email)
}

func TestParseItemsFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	itemID := uuid.New()
	categoryID := uuid.New()

	tests := []struct {
		name        string
		rows        [][]string
		expected    int
		hasCategory bool
	}{
		{
			name: "item without category",
			rows: [][]string{
				{itemID.String(), "SKU-001", "Hammer", "Description", "", "Brand", "Model", "Manufacturer", "Barcode", "SHORT", "5", "false"},
			},
			expected:    1,
			hasCategory: false,
		},
		{
			name: "item with category",
			rows: [][]string{
				{itemID.String(), "SKU-002", "Drill", "Power drill", categoryID.String(), "DeWalt", "DW-100", "DeWalt Inc", "9876543210", "DRL", "3", "false"},
			},
			expected:    1,
			hasCategory: true,
		},
		{
			name: "row with insufficient columns skipped",
			rows: [][]string{
				{itemID.String(), "SKU-003"}, // Only 2 columns, need at least 3
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.parseItemsFromRows(tt.rows)
			assert.Len(t, result, tt.expected)
			if tt.expected > 0 {
				assert.Equal(t, tt.hasCategory, result[0].CategoryID.Valid)
			}
		})
	}
}

func TestParseContainersFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	containerID := uuid.New()
	locationID := uuid.New()

	rows := [][]string{
		{containerID.String(), "Box A1", locationID.String(), "Description", "100 items", "BOX-A1", "false"},
	}

	result := svc.parseContainersFromRows(rows)
	assert.Len(t, result, 1)
	assert.Equal(t, "Box A1", result[0].Name)
	assert.Equal(t, locationID, result[0].LocationID)
}

func TestParseInventoryFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	invID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	containerID := uuid.New()

	tests := []struct {
		name         string
		rows         [][]string
		expected     int
		hasContainer bool
	}{
		{
			name: "inventory without container",
			rows: [][]string{
				{invID.String(), itemID.String(), locationID.String(), "", "10", "GOOD", "AVAILABLE", "Notes"},
			},
			expected:     1,
			hasContainer: false,
		},
		{
			name: "inventory with container",
			rows: [][]string{
				{invID.String(), itemID.String(), locationID.String(), containerID.String(), "5", "NEW", "IN_USE", "More notes"},
			},
			expected:     1,
			hasContainer: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.parseInventoryFromRows(tt.rows)
			assert.Len(t, result, tt.expected)
			if tt.expected > 0 {
				assert.Equal(t, tt.hasContainer, result[0].ContainerID.Valid)
			}
		})
	}

	t.Run("quantity, condition and status parsed", func(t *testing.T) {
		result := svc.parseInventoryFromRows([][]string{
			{invID.String(), itemID.String(), locationID.String(), "", "10", "GOOD", "AVAILABLE", "Notes"},
		})
		if assert.Len(t, result, 1) {
			assert.Equal(t, int32(10), result[0].Quantity)
			assert.True(t, result[0].Condition.Valid)
			assert.Equal(t, queries.WarehouseItemConditionEnumGOOD, result[0].Condition.WarehouseItemConditionEnum)
			assert.True(t, result[0].Status.Valid)
			assert.Equal(t, queries.WarehouseItemStatusEnumAVAILABLE, result[0].Status.WarehouseItemStatusEnum)
		}
	})

	t.Run("empty condition and status stay NULL", func(t *testing.T) {
		result := svc.parseInventoryFromRows([][]string{
			{invID.String(), itemID.String(), locationID.String(), "", "1", "", "", ""},
		})
		if assert.Len(t, result, 1) {
			assert.False(t, result[0].Condition.Valid)
			assert.False(t, result[0].Status.Valid)
		}
	})
}

func TestParseLoansFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	loanID := uuid.New()
	borrowerID := uuid.New()
	inventoryID := uuid.New()

	rows := [][]string{
		{loanID.String(), borrowerID.String(), inventoryID.String(), "2", "2026-01-02T15:04:05Z", "2026-02-01", "", "Notes"},
	}

	result := svc.parseLoansFromRows(rows)
	assert.Len(t, result, 1)
	assert.Equal(t, borrowerID, result[0].BorrowerID)
	assert.Equal(t, int32(2), result[0].Quantity)
	assert.True(t, result[0].LoanedAt.Valid)
	assert.Equal(t, time.Date(2026, 1, 2, 15, 4, 5, 0, time.UTC), result[0].LoanedAt.Time.UTC())
	assert.True(t, result[0].DueDate.Valid)
	assert.Equal(t, time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC), result[0].DueDate.Time)
	assert.False(t, result[0].ReturnedAt.Valid) // empty cell stays NULL
}

func TestParseAttachmentsFromRows(t *testing.T) {
	svc := &WorkspaceBackupService{}
	attID := uuid.New()
	itemID := uuid.New()
	fileID := uuid.New()

	tests := []struct {
		name      string
		rows      [][]string
		expected  int
		hasFileID bool
	}{
		{
			name: "attachment without file ID",
			rows: [][]string{
				{attID.String(), itemID.String(), "", "PHOTO", "Photo title", "true", ""},
			},
			expected:  1,
			hasFileID: false,
		},
		{
			name: "attachment with file ID",
			rows: [][]string{
				{attID.String(), itemID.String(), fileID.String(), "MANUAL", "Manual", "false", ""},
			},
			expected:  1,
			hasFileID: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.parseAttachmentsFromRows(tt.rows)
			assert.Len(t, result, tt.expected)
			if tt.expected > 0 {
				assert.Equal(t, tt.hasFileID, result[0].FileID.Valid)
			}
		})
	}

	t.Run("attachment type parsed", func(t *testing.T) {
		result := svc.parseAttachmentsFromRows([][]string{
			{attID.String(), itemID.String(), "", "MANUAL", "Manual", "false", ""},
		})
		if assert.Len(t, result, 1) {
			assert.Equal(t, queries.WarehouseAttachmentTypeEnumMANUAL, result[0].AttachmentType)
		}
	})
}

// =============================================================================
// getCellValue Helper Function Tests
// =============================================================================

func TestGetCellValue(t *testing.T) {
	tests := []struct {
		name     string
		row      []string
		index    int
		expected string
	}{
		{
			name:     "valid index",
			row:      []string{"a", "b", "c"},
			index:    1,
			expected: "b",
		},
		{
			name:     "index out of bounds",
			row:      []string{"a", "b"},
			index:    5,
			expected: "",
		},
		{
			name:     "empty row",
			row:      []string{},
			index:    0,
			expected: "",
		},
		{
			name:     "first element",
			row:      []string{"first", "second"},
			index:    0,
			expected: "first",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getCellValue(tt.row, tt.index)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// stringToPtr Helper Function Tests
// =============================================================================

func TestStringToPtr(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected *string
	}{
		{
			name:     "non-empty string",
			input:    "test",
			expected: strPtr("test"),
		},
		{
			name:     "empty string",
			input:    "",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := stringToPtr(tt.input)
			if tt.expected == nil {
				assert.Nil(t, result)
			} else {
				assert.Equal(t, *tt.expected, *result)
			}
		})
	}
}

// =============================================================================
// Full Import Workflow Tests
// =============================================================================

func TestImportWorkspace_MultipleEntityTypes(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Create test data with multiple entity types
	testData := WorkspaceData{
		Categories: []queries.WarehouseCategory{
			{ID: uuid.New(), Name: "Tools"},
		},
		Labels: []queries.WarehouseLabel{
			{ID: uuid.New(), Name: "Urgent"},
		},
		Companies: []queries.WarehouseCompany{
			{ID: uuid.New(), Name: "Supplier Co"},
		},
		Locations: []queries.WarehouseLocation{
			{ID: uuid.New(), Name: "Warehouse"},
		},
		Borrowers: []queries.WarehouseBorrower{
			{ID: uuid.New(), Name: "Jane Doe"},
		},
	}
	jsonData, _ := json.Marshal(testData)

	// Mock all create operations
	mockQueries.On("CreateCategory", ctx, mock.Anything).
		Return(queries.WarehouseCategory{ID: uuid.New()}, nil)
	mockQueries.On("CreateLabel", ctx, mock.Anything).
		Return(queries.WarehouseLabel{ID: uuid.New()}, nil)
	mockQueries.On("CreateCompany", ctx, mock.Anything).
		Return(queries.WarehouseCompany{ID: uuid.New()}, nil)
	mockQueries.On("CreateLocation", ctx, mock.Anything).
		Return(queries.WarehouseLocation{ID: uuid.New()}, nil)
	mockQueries.On("CreateBorrower", ctx, mock.Anything).
		Return(queries.WarehouseBorrower{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 5, result.TotalRows)
	assert.Equal(t, 5, result.Succeeded)
	assert.Equal(t, 0, result.Failed)

	mockQueries.AssertExpectations(t)
}

func TestImportWorkspace_PartialFailure(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	testData := WorkspaceData{
		Categories: []queries.WarehouseCategory{
			{ID: uuid.New(), Name: "Success Category"},
			{ID: uuid.New(), Name: "Fail Category"},
		},
	}
	jsonData, _ := json.Marshal(testData)

	// First call succeeds, second fails
	mockQueries.On("CreateCategory", ctx, mock.MatchedBy(func(arg queries.CreateCategoryParams) bool {
		return arg.Name == "Success Category"
	})).Return(queries.WarehouseCategory{ID: uuid.New()}, nil)

	mockQueries.On("CreateCategory", ctx, mock.MatchedBy(func(arg queries.CreateCategoryParams) bool {
		return arg.Name == "Fail Category"
	})).Return(queries.WarehouseCategory{}, fmt.Errorf("duplicate name"))

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 2, result.TotalRows)
	assert.Equal(t, 1, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Errors, 1)

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// parseExcel Tests
// =============================================================================

func TestParseExcel_AllSheets(t *testing.T) {
	svc := &WorkspaceBackupService{}

	// Create a comprehensive Excel file with all sheets
	excelData := createTestExcelFile(t, map[string][][]string{
		"Categories": {
			{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "Cat1", "", "Desc", "false", "", ""},
		},
		"Labels": {
			{"ID", "Name", "Color", "Description", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "Label1", "#FF0000", "Desc", "false", "", ""},
		},
		"Companies": {
			{"ID", "Name", "Website", "Notes", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "Company1", "https://example.com", "Notes", "false", "", ""},
		},
		"Locations": {
			{"ID", "Name", "Parent Location ID", "Description", "Short Code", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "Location1", "", "Desc", "LOC-1", "false", "", ""},
		},
		"Borrowers": {
			{"ID", "Name", "Email", "Phone", "Notes", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "Borrower1", "email@test.com", "123", "Notes", "false", "", ""},
		},
		"Items": {
			{"ID", "SKU", "Name", "Description", "Category ID", "Brand", "Model", "Manufacturer", "Barcode", "Short Code", "Min Stock", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "SKU-1", "Item1", "Desc", "", "Brand", "Model", "Mfg", "123", "ITM-1", "5", "false", "", ""},
		},
		"Containers": {
			{"ID", "Name", "Location ID", "Description", "Capacity", "Short Code", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "Container1", uuid.New().String(), "Desc", "100", "CNT-1", "false", "", ""},
		},
		"Inventory": {
			{"ID", "Item ID", "Location ID", "Container ID", "Quantity", "Condition", "Status", "Notes", "Created At", "Updated At"},
			{uuid.New().String(), uuid.New().String(), uuid.New().String(), "", "10", "GOOD", "AVAILABLE", "Notes", "", ""},
		},
		"Loans": {
			{"ID", "Borrower ID", "Inventory ID", "Quantity", "Loaned At", "Due Date", "Returned At", "Notes", "Created At", "Updated At"},
			{uuid.New().String(), uuid.New().String(), uuid.New().String(), "1", "", "", "", "Notes", "", ""},
		},
		"Attachments": {
			{"ID", "Item ID", "File ID", "Type", "Title", "Is Primary", "External Doc ID", "Created At", "Updated At"},
			{uuid.New().String(), uuid.New().String(), "", "PHOTO", "Photo", "true", "", "", ""},
		},
	})

	result, err := svc.parseExcel(excelData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Categories, 1)
	assert.Len(t, result.Labels, 1)
	assert.Len(t, result.Companies, 1)
	assert.Len(t, result.Locations, 1)
	assert.Len(t, result.Borrowers, 1)
	assert.Len(t, result.Items, 1)
	assert.Len(t, result.Containers, 1)
	assert.Len(t, result.Inventory, 1)
	assert.Len(t, result.Loans, 1)
	assert.Len(t, result.Attachments, 1)
}

func TestParseExcel_MissingSheets(t *testing.T) {
	svc := &WorkspaceBackupService{}

	// Create Excel with only some sheets
	excelData := createTestExcelFile(t, map[string][][]string{
		"Categories": {
			{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"},
			{uuid.New().String(), "Cat1", "", "Desc", "false", "", ""},
		},
		// Missing other sheets - should not cause error
	})

	result, err := svc.parseExcel(excelData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Categories, 1)
	assert.Len(t, result.Labels, 0)    // Missing sheet results in empty slice
	assert.Len(t, result.Companies, 0) // Missing sheet results in empty slice
}

func TestParseExcel_HeaderOnlySheets(t *testing.T) {
	svc := &WorkspaceBackupService{}

	// Sheets with only headers (no data rows)
	excelData := createTestExcelFile(t, map[string][][]string{
		"Categories": {
			{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"},
			// No data rows
		},
	})

	result, err := svc.parseExcel(excelData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Categories, 0) // Header only, no data
}

// =============================================================================
// Import Inventory / Loans / Attachments Tests
// =============================================================================

// TestImportWorkspace_Inventory_RemapsReferences verifies that restored
// inventory rows reference the NEW item/location/container IDs created during
// this import — never the original file-supplied IDs (tenant-safety: a
// crafted backup must not be able to point at another tenant's rows).
func TestImportWorkspace_Inventory_RemapsReferences(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	origLocationID := uuid.New()
	origItemID := uuid.New()
	origContainerID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	testData := WorkspaceData{
		Locations: []queries.WarehouseLocation{
			{ID: origLocationID, Name: "Garage", ShortCode: "GAR"},
		},
		Items: []queries.WarehouseItem{
			{ID: origItemID, Sku: "SKU-001", Name: "Hammer", ShortCode: "HAM"},
		},
		Containers: []queries.WarehouseContainer{
			{ID: origContainerID, Name: "Box A1", LocationID: origLocationID, ShortCode: "BOX"},
		},
		Inventory: []queries.WarehouseInventory{
			{
				ID:          uuid.New(),
				ItemID:      origItemID,
				LocationID:  origLocationID,
				ContainerID: pgtype.UUID{Bytes: origContainerID, Valid: true},
				Quantity:    5,
				Status: queries.NullWarehouseItemStatusEnum{
					WarehouseItemStatusEnum: queries.WarehouseItemStatusEnumAVAILABLE,
					Valid:                   true,
				},
				Notes: strPtr("shelf 3"),
			},
		},
	}
	jsonData, err := json.Marshal(testData)
	assert.NoError(t, err)

	var newLocationID, newItemID, newContainerID uuid.UUID
	mockQueries.On("CreateLocation", ctx, mock.MatchedBy(func(arg queries.CreateLocationParams) bool {
		newLocationID = arg.ID
		return arg.WorkspaceID == workspaceID && arg.Name == "Garage"
	})).Return(queries.WarehouseLocation{ID: uuid.New()}, nil)

	mockQueries.On("CreateItem", ctx, mock.MatchedBy(func(arg queries.CreateItemParams) bool {
		newItemID = arg.ID
		return arg.WorkspaceID == workspaceID && arg.Name == "Hammer"
	})).Return(queries.WarehouseItem{ID: uuid.New()}, nil)

	mockQueries.On("CreateContainer", ctx, mock.MatchedBy(func(arg queries.CreateContainerParams) bool {
		newContainerID = arg.ID
		return arg.WorkspaceID == workspaceID && arg.Name == "Box A1"
	})).Return(queries.WarehouseContainer{ID: uuid.New()}, nil)

	mockQueries.On("CreateInventory", ctx, mock.MatchedBy(func(arg queries.CreateInventoryParams) bool {
		// All references must be the NEW ids created during this import,
		// never the original file-supplied ids.
		return arg.WorkspaceID == workspaceID &&
			arg.ItemID == newItemID && arg.ItemID != origItemID &&
			arg.LocationID == newLocationID && arg.LocationID != origLocationID &&
			arg.ContainerID.Valid &&
			uuid.UUID(arg.ContainerID.Bytes) == newContainerID &&
			uuid.UUID(arg.ContainerID.Bytes) != origContainerID &&
			arg.Quantity == 5 &&
			arg.Status.Valid &&
			arg.Status.WarehouseItemStatusEnum == queries.WarehouseItemStatusEnumAVAILABLE &&
			arg.Notes != nil && *arg.Notes == "shelf 3"
	})).Return(queries.WarehouseInventory{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 4, result.TotalRows)
	assert.Equal(t, 4, result.Succeeded)
	assert.Equal(t, 0, result.Failed)

	mockQueries.AssertExpectations(t)
}

// TestImportWorkspace_Inventory_RejectsForeignRefs verifies that inventory
// rows referencing an item, location, or container that is NOT part of the
// backup are skipped with a clean ImportError — never inserted verbatim.
func TestImportWorkspace_Inventory_RejectsForeignRefs(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	origLocationID := uuid.New()
	origItemID := uuid.New()
	foreignItemID := uuid.New()      // not part of the backup
	foreignLocationID := uuid.New()  // not part of the backup
	foreignContainerID := uuid.New() // not part of the backup

	mockQueries := new(MockWorkspaceBackupQueries)

	testData := WorkspaceData{
		Locations: []queries.WarehouseLocation{
			{ID: origLocationID, Name: "Garage", ShortCode: "GAR"},
		},
		Items: []queries.WarehouseItem{
			{ID: origItemID, Sku: "SKU-001", Name: "Hammer", ShortCode: "HAM"},
		},
		Inventory: []queries.WarehouseInventory{
			{ID: uuid.New(), ItemID: foreignItemID, LocationID: origLocationID, Quantity: 1},
			{ID: uuid.New(), ItemID: origItemID, LocationID: foreignLocationID, Quantity: 1},
			{ID: uuid.New(), ItemID: origItemID, LocationID: origLocationID, ContainerID: pgtype.UUID{Bytes: foreignContainerID, Valid: true}, Quantity: 1},
		},
	}
	jsonData, err := json.Marshal(testData)
	assert.NoError(t, err)

	mockQueries.On("CreateLocation", ctx, mock.Anything).
		Return(queries.WarehouseLocation{ID: uuid.New()}, nil)
	mockQueries.On("CreateItem", ctx, mock.Anything).
		Return(queries.WarehouseItem{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 5, result.TotalRows)
	assert.Equal(t, 2, result.Succeeded) // location + item
	assert.Equal(t, 3, result.Failed)
	if assert.Len(t, result.Errors, 3) {
		codes := make([]string, 0, len(result.Errors))
		for _, e := range result.Errors {
			codes = append(codes, e.Code)
		}
		assert.Contains(t, codes, "ITEM_NOT_FOUND")
		assert.Contains(t, codes, "LOCATION_NOT_FOUND")
		assert.Contains(t, codes, "CONTAINER_NOT_FOUND")
	}

	// CreateInventory must never have been called
	mockQueries.AssertNotCalled(t, "CreateInventory", mock.Anything, mock.Anything)
}

// TestImportWorkspace_Loans_RemapsReferences verifies that restored loans
// reference the NEW inventory/borrower IDs created during this import.
func TestImportWorkspace_Loans_RemapsReferences(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	origLocationID := uuid.New()
	origItemID := uuid.New()
	origBorrowerID := uuid.New()
	origInventoryID := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	loanedAt := time.Date(2026, 1, 2, 15, 4, 5, 0, time.UTC)
	dueDate := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	testData := WorkspaceData{
		Locations: []queries.WarehouseLocation{
			{ID: origLocationID, Name: "Garage", ShortCode: "GAR"},
		},
		Borrowers: []queries.WarehouseBorrower{
			{ID: origBorrowerID, Name: "John Doe"},
		},
		Items: []queries.WarehouseItem{
			{ID: origItemID, Sku: "SKU-001", Name: "Hammer", ShortCode: "HAM"},
		},
		Inventory: []queries.WarehouseInventory{
			{ID: origInventoryID, ItemID: origItemID, LocationID: origLocationID, Quantity: 3},
		},
		Loans: []queries.WarehouseLoan{
			{
				ID:          uuid.New(),
				InventoryID: origInventoryID,
				BorrowerID:  origBorrowerID,
				Quantity:    2,
				LoanedAt:    pgtype.Timestamptz{Time: loanedAt, Valid: true},
				DueDate:     pgtype.Date{Time: dueDate, Valid: true},
				Notes:       strPtr("weekend project"),
			},
		},
	}
	jsonData, err := json.Marshal(testData)
	assert.NoError(t, err)

	var newBorrowerID, newInventoryID uuid.UUID
	mockQueries.On("CreateLocation", ctx, mock.Anything).
		Return(queries.WarehouseLocation{ID: uuid.New()}, nil)
	mockQueries.On("CreateItem", ctx, mock.Anything).
		Return(queries.WarehouseItem{ID: uuid.New()}, nil)
	mockQueries.On("CreateBorrower", ctx, mock.MatchedBy(func(arg queries.CreateBorrowerParams) bool {
		newBorrowerID = arg.ID
		return arg.WorkspaceID == workspaceID && arg.Name == "John Doe"
	})).Return(queries.WarehouseBorrower{ID: uuid.New()}, nil)
	mockQueries.On("CreateInventory", ctx, mock.MatchedBy(func(arg queries.CreateInventoryParams) bool {
		newInventoryID = arg.ID
		return arg.WorkspaceID == workspaceID
	})).Return(queries.WarehouseInventory{ID: uuid.New()}, nil)

	mockQueries.On("CreateLoan", ctx, mock.MatchedBy(func(arg queries.CreateLoanParams) bool {
		// References must be the NEW ids created during this import,
		// never the original file-supplied ids.
		return arg.WorkspaceID == workspaceID &&
			arg.InventoryID == newInventoryID && arg.InventoryID != origInventoryID &&
			arg.BorrowerID == newBorrowerID && arg.BorrowerID != origBorrowerID &&
			arg.Quantity == 2 &&
			arg.LoanedAt.Valid && arg.LoanedAt.Time.Equal(loanedAt) &&
			arg.DueDate.Valid && arg.DueDate.Time.Equal(dueDate) &&
			arg.Notes != nil && *arg.Notes == "weekend project"
	})).Return(queries.WarehouseLoan{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 5, result.TotalRows)
	assert.Equal(t, 5, result.Succeeded)
	assert.Equal(t, 0, result.Failed)

	mockQueries.AssertExpectations(t)
}

// TestImportWorkspace_Loans_RejectsForeignRefs verifies that loans
// referencing an inventory row or borrower that is NOT part of the backup
// are skipped with a clean ImportError instead of silently dropped or
// inserted verbatim.
func TestImportWorkspace_Loans_RejectsForeignRefs(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	origLocationID := uuid.New()
	origItemID := uuid.New()
	origInventoryID := uuid.New()
	foreignInventoryID := uuid.New() // not part of the backup
	foreignBorrowerID := uuid.New()  // not part of the backup

	mockQueries := new(MockWorkspaceBackupQueries)

	testData := WorkspaceData{
		Locations: []queries.WarehouseLocation{
			{ID: origLocationID, Name: "Garage", ShortCode: "GAR"},
		},
		Items: []queries.WarehouseItem{
			{ID: origItemID, Sku: "SKU-001", Name: "Hammer", ShortCode: "HAM"},
		},
		Inventory: []queries.WarehouseInventory{
			{ID: origInventoryID, ItemID: origItemID, LocationID: origLocationID, Quantity: 1},
		},
		Loans: []queries.WarehouseLoan{
			{ID: uuid.New(), InventoryID: foreignInventoryID, BorrowerID: foreignBorrowerID, Quantity: 1},
			{ID: uuid.New(), InventoryID: origInventoryID, BorrowerID: foreignBorrowerID, Quantity: 1},
		},
	}
	jsonData, err := json.Marshal(testData)
	assert.NoError(t, err)

	mockQueries.On("CreateLocation", ctx, mock.Anything).
		Return(queries.WarehouseLocation{ID: uuid.New()}, nil)
	mockQueries.On("CreateItem", ctx, mock.Anything).
		Return(queries.WarehouseItem{ID: uuid.New()}, nil)
	mockQueries.On("CreateInventory", ctx, mock.Anything).
		Return(queries.WarehouseInventory{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 5, result.TotalRows)
	assert.Equal(t, 3, result.Succeeded) // location + item + inventory
	assert.Equal(t, 2, result.Failed)
	if assert.Len(t, result.Errors, 2) {
		codes := []string{result.Errors[0].Code, result.Errors[1].Code}
		assert.Contains(t, codes, "INVENTORY_NOT_FOUND")
		assert.Contains(t, codes, "BORROWER_NOT_FOUND")
	}

	// CreateLoan must never have been called
	mockQueries.AssertNotCalled(t, "CreateLoan", mock.Anything, mock.Anything)
}

// TestImportWorkspace_Attachments_RemapsItemAndNullsFileID verifies that
// restored attachments reference the NEW item ID created during this import
// and that file_id is always restored as NULL (warehouse.files rows are not
// part of the backup, so the file-supplied file_id must never be inserted
// verbatim — it could attach another tenant's file).
func TestImportWorkspace_Attachments_RemapsItemAndNullsFileID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	origItemID := uuid.New()
	origFileID := uuid.New() // files are NOT part of the backup

	mockQueries := new(MockWorkspaceBackupQueries)

	isPrimary := true
	testData := WorkspaceData{
		Items: []queries.WarehouseItem{
			{ID: origItemID, Sku: "SKU-001", Name: "Hammer", ShortCode: "HAM"},
		},
		Attachments: []queries.WarehouseAttachment{
			{
				ID:             uuid.New(),
				ItemID:         origItemID,
				FileID:         pgtype.UUID{Bytes: origFileID, Valid: true},
				AttachmentType: queries.WarehouseAttachmentTypeEnumPHOTO,
				Title:          strPtr("Front view"),
				IsPrimary:      &isPrimary,
			},
		},
	}
	jsonData, err := json.Marshal(testData)
	assert.NoError(t, err)

	var newItemID uuid.UUID
	mockQueries.On("CreateItem", ctx, mock.MatchedBy(func(arg queries.CreateItemParams) bool {
		newItemID = arg.ID
		return arg.WorkspaceID == workspaceID && arg.Name == "Hammer"
	})).Return(queries.WarehouseItem{ID: uuid.New()}, nil)

	mockQueries.On("CreateAttachment", ctx, mock.MatchedBy(func(arg queries.CreateAttachmentParams) bool {
		return arg.WorkspaceID == workspaceID &&
			arg.ItemID == newItemID && arg.ItemID != origItemID &&
			!arg.FileID.Valid && // file_id must be NULLed, never restored verbatim
			arg.AttachmentType == queries.WarehouseAttachmentTypeEnumPHOTO &&
			arg.Title != nil && *arg.Title == "Front view" &&
			arg.IsPrimary != nil && *arg.IsPrimary
	})).Return(queries.WarehouseAttachment{ID: uuid.New()}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 2, result.TotalRows)
	assert.Equal(t, 2, result.Succeeded)
	assert.Equal(t, 0, result.Failed)

	mockQueries.AssertExpectations(t)
}

// TestImportWorkspace_Attachments_RejectsForeignItem verifies that
// attachments referencing an item NOT part of the backup are skipped with a
// clean ImportError instead of silently dropped or inserted verbatim.
func TestImportWorkspace_Attachments_RejectsForeignItem(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	foreignItemID := uuid.New() // not part of the backup

	mockQueries := new(MockWorkspaceBackupQueries)

	testData := WorkspaceData{
		Attachments: []queries.WarehouseAttachment{
			{
				ID:             uuid.New(),
				ItemID:         foreignItemID,
				AttachmentType: queries.WarehouseAttachmentTypeEnumPHOTO,
			},
		},
	}
	jsonData, err := json.Marshal(testData)
	assert.NoError(t, err)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ImportWorkspace(ctx, workspaceID, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.TotalRows)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	if assert.Len(t, result.Errors, 1) {
		assert.Equal(t, "ITEM_NOT_FOUND", result.Errors[0].Code)
	}

	// CreateAttachment must never have been called
	mockQueries.AssertNotCalled(t, "CreateAttachment", mock.Anything, mock.Anything)
}

// =============================================================================
// Verify Mock Implementation is Complete
// =============================================================================

// Compile-time check that mock implements required interface
var _ WorkspaceBackupQueries = (*MockWorkspaceBackupQueries)(nil)
