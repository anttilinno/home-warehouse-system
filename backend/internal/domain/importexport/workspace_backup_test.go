package importexport

import (
	"bytes"
	"context"
	"encoding/json"
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
// Mock Queries Interface for Workspace Backup
// =============================================================================

// MockWorkspaceBackupQueries mocks the queries methods needed for workspace backup
type MockWorkspaceBackupQueries struct {
	mock.Mock
}

func (m *MockWorkspaceBackupQueries) ListAllCategories(ctx context.Context, arg queries.ListAllCategoriesParams) ([]queries.WarehouseCategory, error) {
	args := m.Called(ctx, arg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseCategory), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllLabels(ctx context.Context, arg queries.ListAllLabelsParams) ([]queries.WarehouseLabel, error) {
	args := m.Called(ctx, arg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLabel), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllCompanies(ctx context.Context, arg queries.ListAllCompaniesParams) ([]queries.WarehouseCompany, error) {
	args := m.Called(ctx, arg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseCompany), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllLocations(ctx context.Context, arg queries.ListAllLocationsParams) ([]queries.WarehouseLocation, error) {
	args := m.Called(ctx, arg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLocation), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllBorrowers(ctx context.Context, arg queries.ListAllBorrowersParams) ([]queries.WarehouseBorrower, error) {
	args := m.Called(ctx, arg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseBorrower), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllItems(ctx context.Context, arg queries.ListAllItemsParams) ([]queries.WarehouseItem, error) {
	args := m.Called(ctx, arg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseItem), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllContainers(ctx context.Context, arg queries.ListAllContainersParams) ([]queries.WarehouseContainer, error) {
	args := m.Called(ctx, arg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseContainer), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllInventory(ctx context.Context, workspaceID uuid.UUID) ([]queries.WarehouseInventory, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseInventory), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllLoans(ctx context.Context, workspaceID uuid.UUID) ([]queries.WarehouseLoan, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLoan), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) ListAllAttachments(ctx context.Context, workspaceID uuid.UUID) ([]queries.WarehouseAttachment, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseAttachment), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) CreateWorkspaceExport(ctx context.Context, arg queries.CreateWorkspaceExportParams) error {
	args := m.Called(ctx, arg)
	return args.Error(0)
}

func (m *MockWorkspaceBackupQueries) CreateCategory(ctx context.Context, arg queries.CreateCategoryParams) (queries.WarehouseCategory, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(queries.WarehouseCategory), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) CreateLabel(ctx context.Context, arg queries.CreateLabelParams) (queries.WarehouseLabel, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(queries.WarehouseLabel), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) CreateCompany(ctx context.Context, arg queries.CreateCompanyParams) (queries.WarehouseCompany, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(queries.WarehouseCompany), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) CreateLocation(ctx context.Context, arg queries.CreateLocationParams) (queries.WarehouseLocation, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(queries.WarehouseLocation), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) CreateBorrower(ctx context.Context, arg queries.CreateBorrowerParams) (queries.WarehouseBorrower, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(queries.WarehouseBorrower), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) CreateItem(ctx context.Context, arg queries.CreateItemParams) (queries.WarehouseItem, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(queries.WarehouseItem), args.Error(1)
}

func (m *MockWorkspaceBackupQueries) CreateContainer(ctx context.Context, arg queries.CreateContainerParams) (queries.WarehouseContainer, error) {
	args := m.Called(ctx, arg)
	return args.Get(0).(queries.WarehouseContainer), args.Error(1)
}

// =============================================================================
// Test Helper Functions
// =============================================================================

func makeTimestamp(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func makeNullUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func makeNullableUUID() pgtype.UUID {
	return pgtype.UUID{Valid: false}
}

func strPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}

// =============================================================================
// Test Data Factories
// =============================================================================

func makeTestCategory(workspaceID uuid.UUID, name string) queries.WarehouseCategory {
	now := time.Now().UTC()
	return queries.WarehouseCategory{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Description: strPtr("Test category description"),
		IsArchived:  false,
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestLabel(workspaceID uuid.UUID, name string) queries.WarehouseLabel {
	now := time.Now().UTC()
	return queries.WarehouseLabel{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Color:       strPtr("#FF5733"),
		Description: strPtr("Test label description"),
		IsArchived:  false,
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestCompany(workspaceID uuid.UUID, name string) queries.WarehouseCompany {
	now := time.Now().UTC()
	return queries.WarehouseCompany{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Website:     strPtr("https://example.com"),
		Notes:       strPtr("Test company notes"),
		IsArchived:  false,
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestLocation(workspaceID uuid.UUID, name string) queries.WarehouseLocation {
	now := time.Now().UTC()
	return queries.WarehouseLocation{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Description: strPtr("Test location description"),
		ShortCode:   "LOC-001",
		IsArchived:  false,
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestBorrower(workspaceID uuid.UUID, name string) queries.WarehouseBorrower {
	now := time.Now().UTC()
	return queries.WarehouseBorrower{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Name:        name,
		Email:       strPtr("borrower@example.com"),
		Phone:       strPtr("+1234567890"),
		Notes:       strPtr("Test borrower notes"),
		IsArchived:  false,
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestItem(workspaceID uuid.UUID, name string, sku string) queries.WarehouseItem {
	now := time.Now().UTC()
	return queries.WarehouseItem{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Sku:         sku,
		Name:        name,
		Description: strPtr("Test item description"),
		Brand:       strPtr("TestBrand"),
		Model:       strPtr("TestModel"),
		Manufacturer: strPtr("TestManufacturer"),
		Barcode:     strPtr("1234567890123"),
		ShortCode:   "ITM-001",
		IsArchived:  boolPtr(false),
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestContainer(workspaceID uuid.UUID, locationID uuid.UUID, name string) queries.WarehouseContainer {
	now := time.Now().UTC()
	return queries.WarehouseContainer{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		LocationID:  locationID,
		Name:        name,
		Description: strPtr("Test container description"),
		Capacity:    strPtr("100 items"),
		ShortCode:   "CNT-001",
		IsArchived:  false,
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestInventory(workspaceID uuid.UUID, itemID uuid.UUID, locationID uuid.UUID) queries.WarehouseInventory {
	now := time.Now().UTC()
	return queries.WarehouseInventory{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		ItemID:      itemID,
		LocationID:  locationID,
		Quantity:    10,
		Notes:       strPtr("Test inventory notes"),
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestLoan(workspaceID uuid.UUID, borrowerID uuid.UUID, inventoryID uuid.UUID) queries.WarehouseLoan {
	now := time.Now().UTC()
	return queries.WarehouseLoan{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		BorrowerID:  borrowerID,
		InventoryID: inventoryID,
		Quantity:    1,
		LoanedAt:    makeTimestamp(now),
		Notes:       strPtr("Test loan notes"),
		CreatedAt:   makeTimestamp(now),
		UpdatedAt:   makeTimestamp(now),
	}
}

func makeTestAttachment(itemID uuid.UUID) queries.WarehouseAttachment {
	now := time.Now().UTC()
	isPrimary := true
	return queries.WarehouseAttachment{
		ID:             uuid.New(),
		ItemID:         itemID,
		AttachmentType: queries.WarehouseAttachmentTypeEnumPHOTO,
		Title:          strPtr("Test Photo"),
		IsPrimary:      &isPrimary,
		CreatedAt:      makeTimestamp(now),
		UpdatedAt:      makeTimestamp(now),
	}
}

// =============================================================================
// fetchAllData Tests - Test using ExportWorkspace which calls fetchAllData
// =============================================================================

func TestExportWorkspace_Success_Excel(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Set up test data
	categories := []queries.WarehouseCategory{makeTestCategory(workspaceID, "Electronics")}
	labels := []queries.WarehouseLabel{makeTestLabel(workspaceID, "Fragile")}
	companies := []queries.WarehouseCompany{makeTestCompany(workspaceID, "Acme Corp")}
	locations := []queries.WarehouseLocation{makeTestLocation(workspaceID, "Warehouse A")}
	borrowers := []queries.WarehouseBorrower{makeTestBorrower(workspaceID, "John Doe")}
	items := []queries.WarehouseItem{makeTestItem(workspaceID, "Test Item", "SKU-001")}
	containers := []queries.WarehouseContainer{makeTestContainer(workspaceID, locations[0].ID, "Box A1")}
	inventory := []queries.WarehouseInventory{makeTestInventory(workspaceID, items[0].ID, locations[0].ID)}
	loans := []queries.WarehouseLoan{makeTestLoan(workspaceID, borrowers[0].ID, inventory[0].ID)}
	attachments := []queries.WarehouseAttachment{makeTestAttachment(items[0].ID)}

	// Set up mock expectations
	mockQueries.On("ListAllCategories", ctx, mock.MatchedBy(func(arg queries.ListAllCategoriesParams) bool {
		return arg.WorkspaceID == workspaceID
	})).Return(categories, nil)
	mockQueries.On("ListAllLabels", ctx, mock.MatchedBy(func(arg queries.ListAllLabelsParams) bool {
		return arg.WorkspaceID == workspaceID
	})).Return(labels, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.MatchedBy(func(arg queries.ListAllCompaniesParams) bool {
		return arg.WorkspaceID == workspaceID
	})).Return(companies, nil)
	mockQueries.On("ListAllLocations", ctx, mock.MatchedBy(func(arg queries.ListAllLocationsParams) bool {
		return arg.WorkspaceID == workspaceID
	})).Return(locations, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.MatchedBy(func(arg queries.ListAllBorrowersParams) bool {
		return arg.WorkspaceID == workspaceID
	})).Return(borrowers, nil)
	mockQueries.On("ListAllItems", ctx, mock.MatchedBy(func(arg queries.ListAllItemsParams) bool {
		return arg.WorkspaceID == workspaceID
	})).Return(items, nil)
	mockQueries.On("ListAllContainers", ctx, mock.MatchedBy(func(arg queries.ListAllContainersParams) bool {
		return arg.WorkspaceID == workspaceID
	})).Return(containers, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return(inventory, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return(loans, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return(attachments, nil)
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(nil)

	// Create service with mock
	svc := &WorkspaceBackupService{queries: mockQueries}

	// Execute
	result, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	// Verify
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotEmpty(t, result.Data)
	assert.Contains(t, result.Filename, "workspace_backup_")
	assert.Contains(t, result.Filename, ".xlsx")
	assert.Equal(t, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", result.ContentType)
	assert.Equal(t, 10, result.TotalRecords) // 1 of each entity type
	assert.Equal(t, 1, result.RecordCounts["categories"])
	assert.Equal(t, 1, result.RecordCounts["labels"])
	assert.Equal(t, 1, result.RecordCounts["companies"])
	assert.Equal(t, 1, result.RecordCounts["locations"])
	assert.Equal(t, 1, result.RecordCounts["borrowers"])
	assert.Equal(t, 1, result.RecordCounts["items"])
	assert.Equal(t, 1, result.RecordCounts["containers"])
	assert.Equal(t, 1, result.RecordCounts["inventory"])
	assert.Equal(t, 1, result.RecordCounts["loans"])
	assert.Equal(t, 1, result.RecordCounts["attachments"])

	// Verify the Excel file can be parsed
	f, err := excelize.OpenReader(bytes.NewReader(result.Data))
	assert.NoError(t, err)
	defer f.Close()

	// Check sheets exist
	sheets := f.GetSheetList()
	assert.Contains(t, sheets, "Categories")
	assert.Contains(t, sheets, "Labels")
	assert.Contains(t, sheets, "Companies")
	assert.Contains(t, sheets, "Locations")
	assert.Contains(t, sheets, "Borrowers")
	assert.Contains(t, sheets, "Items")
	assert.Contains(t, sheets, "Containers")
	assert.Contains(t, sheets, "Inventory")
	assert.Contains(t, sheets, "Loans")
	assert.Contains(t, sheets, "Attachments")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_Success_JSON(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Set up test data - just one category for simplicity
	categories := []queries.WarehouseCategory{makeTestCategory(workspaceID, "Electronics")}

	// Set up mock expectations for all entity types (most returning empty)
	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return(categories, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return([]queries.WarehouseAttachment{}, nil)
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ExportWorkspace(ctx, workspaceID, FormatJSON, false, exportedBy)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotEmpty(t, result.Data)
	assert.Contains(t, result.Filename, ".json")
	assert.Equal(t, "application/json", result.ContentType)
	assert.Equal(t, 1, result.TotalRecords)

	// Verify JSON structure
	var data WorkspaceData
	err = json.Unmarshal(result.Data, &data)
	assert.NoError(t, err)
	assert.Len(t, data.Categories, 1)
	assert.Equal(t, "Electronics", data.Categories[0].Name)

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_EmptyWorkspace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// All lists return empty
	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return([]queries.WarehouseAttachment{}, nil)
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 0, result.TotalRecords)
	assert.Equal(t, 0, result.RecordCounts["categories"])
	assert.Equal(t, 0, result.RecordCounts["items"])

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_UnsupportedFormat(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Set up mock for data fetching (will be called before format check)
	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return([]queries.WarehouseAttachment{}, nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, Format("xml"), false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported format")
}

func TestExportWorkspace_FetchError_Categories(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Categories fetch fails
	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to fetch workspace data")
	assert.Contains(t, err.Error(), "categories")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Labels(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "labels")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Companies(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "companies")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Locations(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "locations")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Borrowers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "borrowers")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Items(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "items")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Containers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "containers")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Inventory(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "inventory")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Loans(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "loans")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_FetchError_Attachments(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return(nil, assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "attachments")

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_AuditRecordError_ContinuesSuccessfully(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Set up successful data fetching
	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return([]queries.WarehouseAttachment{}, nil)
	// Audit record fails - should NOT cause export to fail
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(assert.AnError)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	// Export should succeed even if audit record fails
	assert.NoError(t, err)
	assert.NotNil(t, result)

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_WithIncludeArchived(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Verify includeArchived flag is passed correctly
	mockQueries.On("ListAllCategories", ctx, mock.MatchedBy(func(arg queries.ListAllCategoriesParams) bool {
		return arg.IncludeArchived == true
	})).Return([]queries.WarehouseCategory{}, nil)
	mockQueries.On("ListAllLabels", ctx, mock.MatchedBy(func(arg queries.ListAllLabelsParams) bool {
		return arg.IncludeArchived == true
	})).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.MatchedBy(func(arg queries.ListAllCompaniesParams) bool {
		return arg.IncludeArchived == true
	})).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.MatchedBy(func(arg queries.ListAllLocationsParams) bool {
		return arg.IncludeArchived == true
	})).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.MatchedBy(func(arg queries.ListAllBorrowersParams) bool {
		return arg.IncludeArchived == true
	})).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.MatchedBy(func(arg queries.ListAllItemsParams) bool {
		return arg.IncludeArchived == true
	})).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.MatchedBy(func(arg queries.ListAllContainersParams) bool {
		return arg.IncludeArchived == true
	})).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return([]queries.WarehouseAttachment{}, nil)
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	_, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, true, exportedBy)

	assert.NoError(t, err)
	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Excel Generation Tests (via Export)
// =============================================================================

func TestExportWorkspace_ExcelContainsCorrectHeaders(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Set up minimal data
	categories := []queries.WarehouseCategory{makeTestCategory(workspaceID, "Test")}

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return(categories, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return([]queries.WarehouseAttachment{}, nil)
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)
	assert.NoError(t, err)

	f, err := excelize.OpenReader(bytes.NewReader(result.Data))
	assert.NoError(t, err)
	defer f.Close()

	// Check Categories header row
	catRows, err := f.GetRows("Categories")
	assert.NoError(t, err)
	assert.Greater(t, len(catRows), 0)

	expectedHeaders := []string{"ID", "Name", "Parent Category ID", "Description", "Archived", "Created At", "Updated At"}
	for i, header := range expectedHeaders {
		assert.Equal(t, header, catRows[0][i], "Category header mismatch at index %d", i)
	}

	mockQueries.AssertExpectations(t)
}

func TestExportWorkspace_ExcelContainsCorrectData(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Set up test category
	category := makeTestCategory(workspaceID, "Electronics")
	categories := []queries.WarehouseCategory{category}

	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return(categories, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return([]queries.WarehouseLocation{}, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return([]queries.WarehouseBorrower{}, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return([]queries.WarehouseItem{}, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return([]queries.WarehouseContainer{}, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return([]queries.WarehouseInventory{}, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return([]queries.WarehouseLoan{}, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return([]queries.WarehouseAttachment{}, nil)
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(nil)

	svc := &WorkspaceBackupService{queries: mockQueries}

	result, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)
	assert.NoError(t, err)

	f, err := excelize.OpenReader(bytes.NewReader(result.Data))
	assert.NoError(t, err)
	defer f.Close()

	// Check data row (row 2, index 1)
	catRows, err := f.GetRows("Categories")
	assert.NoError(t, err)
	assert.Len(t, catRows, 2) // Header + 1 data row

	dataRow := catRows[1]
	assert.Equal(t, category.ID.String(), dataRow[0])       // ID
	assert.Equal(t, "Electronics", dataRow[1])              // Name
	// Column 2 is parent category ID (empty for this test)
	assert.Equal(t, "Test category description", dataRow[3]) // Description

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Helper Function Tests
// =============================================================================

func TestFormatTimestamp(t *testing.T) {
	tests := []struct {
		name     string
		ts       pgtype.Timestamptz
		expected string
	}{
		{
			name:     "valid timestamp",
			ts:       pgtype.Timestamptz{Time: time.Date(2024, 1, 15, 10, 30, 0, 0, time.UTC), Valid: true},
			expected: "2024-01-15T10:30:00Z",
		},
		{
			name:     "invalid timestamp",
			ts:       pgtype.Timestamptz{Valid: false},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatTimestamp(tt.ts)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestFormatDate(t *testing.T) {
	tests := []struct {
		name     string
		d        pgtype.Date
		expected string
	}{
		{
			name:     "valid date",
			d:        pgtype.Date{Time: time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC), Valid: true},
			expected: "2024-01-15",
		},
		{
			name:     "invalid date",
			d:        pgtype.Date{Valid: false},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatDate(tt.d)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestPtrToString(t *testing.T) {
	str := "test"
	tests := []struct {
		name     string
		input    *string
		expected string
	}{
		{
			name:     "non-nil pointer",
			input:    &str,
			expected: "test",
		},
		{
			name:     "nil pointer",
			input:    nil,
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ptrToString(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestPtrToBool(t *testing.T) {
	trueVal := true
	falseVal := false
	tests := []struct {
		name     string
		input    *bool
		expected bool
	}{
		{
			name:     "true pointer",
			input:    &trueVal,
			expected: true,
		},
		{
			name:     "false pointer",
			input:    &falseVal,
			expected: false,
		},
		{
			name:     "nil pointer",
			input:    nil,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ptrToBool(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// =============================================================================
// Constructor Test
// =============================================================================

func TestNewWorkspaceBackupService(t *testing.T) {
	mockQueries := new(MockWorkspaceBackupQueries)

	svc := NewWorkspaceBackupService(mockQueries)

	assert.NotNil(t, svc)
	assert.Equal(t, mockQueries, svc.queries)
}

// =============================================================================
// Excel Sheet Generation Edge Cases
// =============================================================================

func TestExportWorkspace_ExcelWithParentReferences(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	exportedBy := uuid.New()

	mockQueries := new(MockWorkspaceBackupQueries)

	// Create categories with parent reference
	parentCatID := uuid.New()
	childCatID := uuid.New()
	categories := []queries.WarehouseCategory{
		{
			ID:          parentCatID,
			WorkspaceID: workspaceID,
			Name:        "Parent Category",
			IsArchived:  false,
			CreatedAt:   makeTimestamp(time.Now()),
			UpdatedAt:   makeTimestamp(time.Now()),
		},
		{
			ID:               childCatID,
			WorkspaceID:      workspaceID,
			Name:             "Child Category",
			ParentCategoryID: makeNullUUID(parentCatID),
			IsArchived:       false,
			CreatedAt:        makeTimestamp(time.Now()),
			UpdatedAt:        makeTimestamp(time.Now()),
		},
	}

	// Create locations with parent reference
	parentLocID := uuid.New()
	childLocID := uuid.New()
	locations := []queries.WarehouseLocation{
		{
			ID:          parentLocID,
			WorkspaceID: workspaceID,
			Name:        "Building A",
			ShortCode:   "BLD-A",
			IsArchived:  false,
			CreatedAt:   makeTimestamp(time.Now()),
			UpdatedAt:   makeTimestamp(time.Now()),
		},
		{
			ID:             childLocID,
			WorkspaceID:    workspaceID,
			Name:           "Room 101",
			ParentLocation: makeNullUUID(parentLocID),
			ShortCode:      "R-101",
			IsArchived:     false,
			CreatedAt:      makeTimestamp(time.Now()),
			UpdatedAt:      makeTimestamp(time.Now()),
		},
	}

	// Create item with category reference
	itemID := uuid.New()
	items := []queries.WarehouseItem{
		{
			ID:          itemID,
			WorkspaceID: workspaceID,
			Sku:         "SKU-001",
			Name:        "Test Item",
			CategoryID:  makeNullUUID(parentCatID),
			IsArchived:  boolPtr(false),
			CreatedAt:   makeTimestamp(time.Now()),
			UpdatedAt:   makeTimestamp(time.Now()),
		},
	}

	// Create inventory with container
	containerID := uuid.New()
	containers := []queries.WarehouseContainer{
		{
			ID:          containerID,
			WorkspaceID: workspaceID,
			LocationID:  parentLocID,
			Name:        "Box A1",
			ShortCode:   "BOX-A1",
			IsArchived:  false,
			CreatedAt:   makeTimestamp(time.Now()),
			UpdatedAt:   makeTimestamp(time.Now()),
		},
	}

	inventoryID := uuid.New()
	inventory := []queries.WarehouseInventory{
		{
			ID:          inventoryID,
			WorkspaceID: workspaceID,
			ItemID:      itemID,
			LocationID:  parentLocID,
			ContainerID: makeNullUUID(containerID),
			Quantity:    10,
			Condition:   queries.NullWarehouseItemConditionEnum{WarehouseItemConditionEnum: queries.WarehouseItemConditionEnumGOOD, Valid: true},
			Status:      queries.NullWarehouseItemStatusEnum{WarehouseItemStatusEnum: queries.WarehouseItemStatusEnumAVAILABLE, Valid: true},
			CreatedAt:   makeTimestamp(time.Now()),
			UpdatedAt:   makeTimestamp(time.Now()),
		},
	}

	// Create loan with due date
	borrowerID := uuid.New()
	borrowers := []queries.WarehouseBorrower{
		{
			ID:          borrowerID,
			WorkspaceID: workspaceID,
			Name:        "John Doe",
			IsArchived:  false,
			CreatedAt:   makeTimestamp(time.Now()),
			UpdatedAt:   makeTimestamp(time.Now()),
		},
	}

	loans := []queries.WarehouseLoan{
		{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			BorrowerID:  borrowerID,
			InventoryID: inventoryID,
			Quantity:    1,
			LoanedAt:    makeTimestamp(time.Now()),
			DueDate:     pgtype.Date{Time: time.Now().AddDate(0, 0, 30), Valid: true},
			ReturnedAt:  makeTimestamp(time.Now().AddDate(0, 0, 15)),
			CreatedAt:   makeTimestamp(time.Now()),
			UpdatedAt:   makeTimestamp(time.Now()),
		},
	}

	// Create attachment with file ID
	attachments := []queries.WarehouseAttachment{
		{
			ID:             uuid.New(),
			ItemID:         itemID,
			FileID:         makeNullUUID(uuid.New()),
			AttachmentType: queries.WarehouseAttachmentTypeEnumPHOTO,
			Title:          strPtr("Item Photo"),
			IsPrimary:      boolPtr(true),
			CreatedAt:      makeTimestamp(time.Now()),
			UpdatedAt:      makeTimestamp(time.Now()),
		},
	}

	// Set up mocks
	mockQueries.On("ListAllCategories", ctx, mock.Anything).Return(categories, nil)
	mockQueries.On("ListAllLabels", ctx, mock.Anything).Return([]queries.WarehouseLabel{}, nil)
	mockQueries.On("ListAllCompanies", ctx, mock.Anything).Return([]queries.WarehouseCompany{}, nil)
	mockQueries.On("ListAllLocations", ctx, mock.Anything).Return(locations, nil)
	mockQueries.On("ListAllBorrowers", ctx, mock.Anything).Return(borrowers, nil)
	mockQueries.On("ListAllItems", ctx, mock.Anything).Return(items, nil)
	mockQueries.On("ListAllContainers", ctx, mock.Anything).Return(containers, nil)
	mockQueries.On("ListAllInventory", ctx, workspaceID).Return(inventory, nil)
	mockQueries.On("ListAllLoans", ctx, workspaceID).Return(loans, nil)
	mockQueries.On("ListAllAttachments", ctx, workspaceID).Return(attachments, nil)
	mockQueries.On("CreateWorkspaceExport", ctx, mock.AnythingOfType("queries.CreateWorkspaceExportParams")).Return(nil)

	svc := NewWorkspaceBackupService(mockQueries)

	result, err := svc.ExportWorkspace(ctx, workspaceID, FormatExcel, false, exportedBy)

	assert.NoError(t, err)
	assert.NotNil(t, result)

	// Verify the Excel content
	f, err := excelize.OpenReader(bytes.NewReader(result.Data))
	assert.NoError(t, err)
	defer f.Close()

	// Check Categories sheet - verify parent category is included
	catRows, err := f.GetRows("Categories")
	assert.NoError(t, err)
	assert.Len(t, catRows, 3) // Header + 2 data rows

	// Verify child category has parent ID
	childRow := catRows[2] // Second data row (index 2)
	assert.Equal(t, parentCatID.String(), childRow[2]) // Parent Category ID column

	// Check Locations sheet - verify parent location is included
	locRows, err := f.GetRows("Locations")
	assert.NoError(t, err)
	assert.Len(t, locRows, 3) // Header + 2 data rows

	// Check Inventory sheet - verify container ID and enum values
	invRows, err := f.GetRows("Inventory")
	assert.NoError(t, err)
	assert.Len(t, invRows, 2) // Header + 1 data row
	invDataRow := invRows[1]
	assert.Equal(t, containerID.String(), invDataRow[3]) // Container ID column
	assert.Equal(t, "GOOD", invDataRow[5])               // Condition column
	assert.Equal(t, "AVAILABLE", invDataRow[6])          // Status column

	// Check Loans sheet - verify dates
	loanRows, err := f.GetRows("Loans")
	assert.NoError(t, err)
	assert.Len(t, loanRows, 2) // Header + 1 data row
	loanDataRow := loanRows[1]
	assert.NotEmpty(t, loanDataRow[4]) // Loaned At
	assert.NotEmpty(t, loanDataRow[5]) // Due Date
	assert.NotEmpty(t, loanDataRow[6]) // Returned At

	// Check Attachments sheet - verify file ID
	attRows, err := f.GetRows("Attachments")
	assert.NoError(t, err)
	assert.Len(t, attRows, 2) // Header + 1 data row
	attDataRow := attRows[1]
	assert.NotEmpty(t, attDataRow[2]) // File ID column

	mockQueries.AssertExpectations(t)
}

// =============================================================================
// Interface Implementation Test
// =============================================================================

// Ensure MockWorkspaceBackupQueries implements a compatible interface
// This tests type compatibility at compile time
var _ interface {
	ListAllCategories(ctx context.Context, arg queries.ListAllCategoriesParams) ([]queries.WarehouseCategory, error)
	CreateWorkspaceExport(ctx context.Context, arg queries.CreateWorkspaceExportParams) error
} = (*MockWorkspaceBackupQueries)(nil)
