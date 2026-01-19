package importexport

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

// MockRepository is a mock implementation of the Repository interface
type MockRepository struct {
	mock.Mock
}

func (m *MockRepository) ListAllItems(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseItem, error) {
	args := m.Called(ctx, workspaceID, includeArchived)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseItem), args.Error(1)
}

func (m *MockRepository) CreateItem(ctx context.Context, params queries.CreateItemParams) (queries.WarehouseItem, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(queries.WarehouseItem), args.Error(1)
}

func (m *MockRepository) GetCategoryByName(ctx context.Context, workspaceID uuid.UUID, name string) (*queries.WarehouseCategory, error) {
	args := m.Called(ctx, workspaceID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*queries.WarehouseCategory), args.Error(1)
}

func (m *MockRepository) ListAllLocations(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseLocation, error) {
	args := m.Called(ctx, workspaceID, includeArchived)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLocation), args.Error(1)
}

func (m *MockRepository) CreateLocation(ctx context.Context, params queries.CreateLocationParams) (queries.WarehouseLocation, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(queries.WarehouseLocation), args.Error(1)
}

func (m *MockRepository) GetLocationByName(ctx context.Context, workspaceID uuid.UUID, name string) (*queries.WarehouseLocation, error) {
	args := m.Called(ctx, workspaceID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*queries.WarehouseLocation), args.Error(1)
}

func (m *MockRepository) ListAllCategories(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseCategory, error) {
	args := m.Called(ctx, workspaceID, includeArchived)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseCategory), args.Error(1)
}

func (m *MockRepository) CreateCategory(ctx context.Context, params queries.CreateCategoryParams) (queries.WarehouseCategory, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(queries.WarehouseCategory), args.Error(1)
}

func (m *MockRepository) ListAllContainers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseContainer, error) {
	args := m.Called(ctx, workspaceID, includeArchived)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseContainer), args.Error(1)
}

func (m *MockRepository) CreateContainer(ctx context.Context, params queries.CreateContainerParams) (queries.WarehouseContainer, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(queries.WarehouseContainer), args.Error(1)
}

func (m *MockRepository) ListAllLabels(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseLabel, error) {
	args := m.Called(ctx, workspaceID, includeArchived)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseLabel), args.Error(1)
}

func (m *MockRepository) CreateLabel(ctx context.Context, params queries.CreateLabelParams) (queries.WarehouseLabel, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(queries.WarehouseLabel), args.Error(1)
}

func (m *MockRepository) ListAllCompanies(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseCompany, error) {
	args := m.Called(ctx, workspaceID, includeArchived)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseCompany), args.Error(1)
}

func (m *MockRepository) CreateCompany(ctx context.Context, params queries.CreateCompanyParams) (queries.WarehouseCompany, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(queries.WarehouseCompany), args.Error(1)
}

func (m *MockRepository) ListAllBorrowers(ctx context.Context, workspaceID uuid.UUID, includeArchived bool) ([]queries.WarehouseBorrower, error) {
	args := m.Called(ctx, workspaceID, includeArchived)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]queries.WarehouseBorrower), args.Error(1)
}

func (m *MockRepository) CreateBorrower(ctx context.Context, params queries.CreateBorrowerParams) (queries.WarehouseBorrower, error) {
	args := m.Called(ctx, params)
	return args.Get(0).(queries.WarehouseBorrower), args.Error(1)
}

// Helper functions for creating test data
func ptrString(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}

func pgTimestamp(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// =============================================================================
// Type Validation Tests
// =============================================================================

func TestFormat_IsValid(t *testing.T) {
	tests := []struct {
		format   Format
		expected bool
	}{
		{FormatCSV, true},
		{FormatJSON, true},
		{Format("xml"), false},
		{Format(""), false},
		{Format("CSV"), false}, // Case sensitive
	}

	for _, tt := range tests {
		t.Run(string(tt.format), func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.format.IsValid())
		})
	}
}

func TestEntityType_IsValid(t *testing.T) {
	tests := []struct {
		entityType EntityType
		expected   bool
	}{
		{EntityTypeItem, true},
		{EntityTypeLocation, true},
		{EntityTypeContainer, true},
		{EntityTypeCategory, true},
		{EntityTypeLabel, true},
		{EntityTypeCompany, true},
		{EntityTypeBorrower, true},
		{EntityType("invalid"), false},
		{EntityType(""), false},
		{EntityType("Item"), false}, // Case sensitive
	}

	for _, tt := range tests {
		t.Run(string(tt.entityType), func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.entityType.IsValid())
		})
	}
}

func TestSupportedEntityTypes(t *testing.T) {
	types := SupportedEntityTypes()
	assert.Len(t, types, 7)
	assert.Contains(t, types, EntityTypeItem)
	assert.Contains(t, types, EntityTypeLocation)
	assert.Contains(t, types, EntityTypeContainer)
	assert.Contains(t, types, EntityTypeCategory)
	assert.Contains(t, types, EntityTypeLabel)
	assert.Contains(t, types, EntityTypeCompany)
	assert.Contains(t, types, EntityTypeBorrower)
}

// =============================================================================
// Export Tests
// =============================================================================

func TestService_Export_Items_JSON(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllItems", ctx, workspaceID, false).Return([]queries.WarehouseItem{
		{
			ID:          itemID,
			WorkspaceID: workspaceID,
			Sku:         "SKU-001",
			Name:        "Test Item",
			Description: ptrString("A test item"),
			Brand:       ptrString("TestBrand"),
			IsArchived:  ptrBool(false),
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeItem,
		Format:          FormatJSON,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, EntityTypeItem, metadata.EntityType)
	assert.Equal(t, FormatJSON, metadata.Format)
	assert.Equal(t, 1, metadata.TotalRecords)

	var items []ItemExport
	err = json.Unmarshal(data, &items)
	assert.NoError(t, err)
	assert.Len(t, items, 1)
	assert.Equal(t, "Test Item", items[0].Name)
	assert.Equal(t, "SKU-001", items[0].SKU)
	assert.Equal(t, "TestBrand", items[0].Brand)

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Items_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllItems", ctx, workspaceID, false).Return([]queries.WarehouseItem{
		{
			ID:          itemID,
			WorkspaceID: workspaceID,
			Sku:         "SKU-001",
			Name:        "Test Item",
			IsArchived:  ptrBool(false),
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeItem,
		Format:          FormatCSV,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, 1, metadata.TotalRecords)

	csvContent := string(data)
	assert.Contains(t, csvContent, "id,sku,name")
	assert.Contains(t, csvContent, "SKU-001")
	assert.Contains(t, csvContent, "Test Item")

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Categories(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	catID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllCategories", ctx, workspaceID, true).Return([]queries.WarehouseCategory{
		{
			ID:          catID,
			WorkspaceID: workspaceID,
			Name:        "Electronics",
			Description: ptrString("Electronic items"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeCategory,
		Format:          FormatJSON,
		IncludeArchived: true,
	})

	assert.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, 1, metadata.TotalRecords)

	var categories []CategoryExport
	err = json.Unmarshal(data, &categories)
	assert.NoError(t, err)
	assert.Len(t, categories, 1)
	assert.Equal(t, "Electronics", categories[0].Name)

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Categories_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	catID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllCategories", ctx, workspaceID, true).Return([]queries.WarehouseCategory{
		{
			ID:          catID,
			WorkspaceID: workspaceID,
			Name:        "Electronics",
			Description: ptrString("Electronic items"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeCategory,
		Format:          FormatCSV,
		IncludeArchived: true,
	})

	assert.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, 1, metadata.TotalRecords)

	csvContent := string(data)
	assert.Contains(t, csvContent, "id,name,parent_category")
	assert.Contains(t, csvContent, "Electronics")

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Locations(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllLocations", ctx, workspaceID, false).Return([]queries.WarehouseLocation{
		{
			ID:          locID,
			WorkspaceID: workspaceID,
			Name:        "Warehouse A",
			Description: ptrString("Main storage"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeLocation,
		Format:          FormatJSON,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.NotNil(t, metadata)
	assert.Equal(t, 1, metadata.TotalRecords)

	var locations []LocationExport
	err = json.Unmarshal(data, &locations)
	assert.NoError(t, err)
	assert.Len(t, locations, 1)
	assert.Equal(t, "Warehouse A", locations[0].Name)
	assert.Equal(t, "Main storage", locations[0].Description)

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Labels(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	labelID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllLabels", ctx, workspaceID, false).Return([]queries.WarehouseLabel{
		{
			ID:          labelID,
			WorkspaceID: workspaceID,
			Name:        "Fragile",
			Color:       ptrString("#FF0000"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeLabel,
		Format:          FormatJSON,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	var labels []LabelExport
	err = json.Unmarshal(data, &labels)
	assert.NoError(t, err)
	assert.Len(t, labels, 1)
	assert.Equal(t, "Fragile", labels[0].Name)
	assert.Equal(t, "#FF0000", labels[0].Color)

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Companies(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	companyID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllCompanies", ctx, workspaceID, false).Return([]queries.WarehouseCompany{
		{
			ID:          companyID,
			WorkspaceID: workspaceID,
			Name:        "Acme Corp",
			Website:     ptrString("https://acme.example.com"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeCompany,
		Format:          FormatJSON,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	var companies []CompanyExport
	err = json.Unmarshal(data, &companies)
	assert.NoError(t, err)
	assert.Len(t, companies, 1)
	assert.Equal(t, "Acme Corp", companies[0].Name)

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Borrowers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllBorrowers", ctx, workspaceID, false).Return([]queries.WarehouseBorrower{
		{
			ID:          borrowerID,
			WorkspaceID: workspaceID,
			Name:        "John Doe",
			Email:       ptrString("john@example.com"),
			Phone:       ptrString("+1234567890"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeBorrower,
		Format:          FormatJSON,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	var borrowers []BorrowerExport
	err = json.Unmarshal(data, &borrowers)
	assert.NoError(t, err)
	assert.Len(t, borrowers, 1)
	assert.Equal(t, "John Doe", borrowers[0].Name)
	assert.Equal(t, "john@example.com", borrowers[0].Email)

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Containers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	containerID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllContainers", ctx, workspaceID, false).Return([]queries.WarehouseContainer{
		{
			ID:          containerID,
			WorkspaceID: workspaceID,
			Name:        "Box A1",
			Capacity:    ptrString("100 items"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeContainer,
		Format:          FormatJSON,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	var containers []ContainerExport
	err = json.Unmarshal(data, &containers)
	assert.NoError(t, err)
	assert.Len(t, containers, 1)
	assert.Equal(t, "Box A1", containers[0].Name)

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Locations_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllLocations", ctx, workspaceID, false).Return([]queries.WarehouseLocation{
		{
			ID:          locID,
			WorkspaceID: workspaceID,
			Name:        "Warehouse A",
			Description: ptrString("Main storage"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeLocation,
		Format:          FormatCSV,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	csvContent := string(data)
	assert.Contains(t, csvContent, "id,name,parent_location")
	assert.Contains(t, csvContent, "Warehouse A")

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Labels_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	labelID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllLabels", ctx, workspaceID, false).Return([]queries.WarehouseLabel{
		{
			ID:          labelID,
			WorkspaceID: workspaceID,
			Name:        "Urgent",
			Color:       ptrString("#FF0000"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeLabel,
		Format:          FormatCSV,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	csvContent := string(data)
	assert.Contains(t, csvContent, "id,name,color")
	assert.Contains(t, csvContent, "Urgent")

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Companies_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	companyID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllCompanies", ctx, workspaceID, false).Return([]queries.WarehouseCompany{
		{
			ID:          companyID,
			WorkspaceID: workspaceID,
			Name:        "Acme Corp",
			Website:     ptrString("https://acme.com"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeCompany,
		Format:          FormatCSV,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	csvContent := string(data)
	assert.Contains(t, csvContent, "id,name,website")
	assert.Contains(t, csvContent, "Acme Corp")

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Borrowers_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	borrowerID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllBorrowers", ctx, workspaceID, false).Return([]queries.WarehouseBorrower{
		{
			ID:          borrowerID,
			WorkspaceID: workspaceID,
			Name:        "John Doe",
			Email:       ptrString("john@example.com"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeBorrower,
		Format:          FormatCSV,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	csvContent := string(data)
	assert.Contains(t, csvContent, "id,name,email")
	assert.Contains(t, csvContent, "John Doe")

	mockRepo.AssertExpectations(t)
}

func TestService_Export_Containers_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	containerID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllContainers", ctx, workspaceID, false).Return([]queries.WarehouseContainer{
		{
			ID:          containerID,
			WorkspaceID: workspaceID,
			Name:        "Box A1",
			Capacity:    ptrString("100 items"),
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	data, metadata, err := svc.Export(ctx, ExportOptions{
		WorkspaceID:     workspaceID,
		EntityType:      EntityTypeContainer,
		Format:          FormatCSV,
		IncludeArchived: false,
	})

	assert.NoError(t, err)
	assert.Equal(t, 1, metadata.TotalRecords)

	csvContent := string(data)
	assert.Contains(t, csvContent, "id,name,location_name")
	assert.Contains(t, csvContent, "Box A1")

	mockRepo.AssertExpectations(t)
}

func TestService_Export_UnsupportedEntityType_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	_, _, err := svc.Export(ctx, ExportOptions{
		WorkspaceID: workspaceID,
		EntityType:  EntityType("invalid_type"),
		Format:      FormatCSV,
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported entity type")
}

func TestService_Export_UnsupportedEntityType(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	_, _, err := svc.Export(ctx, ExportOptions{
		WorkspaceID: workspaceID,
		EntityType:  EntityType("invalid"),
		Format:      FormatJSON,
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported entity type")
}

func TestService_Export_UnsupportedFormat(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now().UTC()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllCategories", ctx, workspaceID, false).Return([]queries.WarehouseCategory{
		{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			Name:        "Test",
			IsArchived:  false,
			CreatedAt:   pgTimestamp(now),
			UpdatedAt:   pgTimestamp(now),
		},
	}, nil)

	_, _, err := svc.Export(ctx, ExportOptions{
		WorkspaceID: workspaceID,
		EntityType:  EntityTypeCategory,
		Format:      Format("xml"),
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported format")
}

func TestService_Export_RepositoryError(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	mockRepo.On("ListAllItems", ctx, workspaceID, false).Return(nil, fmt.Errorf("database error"))

	_, _, err := svc.Export(ctx, ExportOptions{
		WorkspaceID: workspaceID,
		EntityType:  EntityTypeItem,
		Format:      FormatJSON,
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "database error")
}

// =============================================================================
// Import Tests
// =============================================================================

func TestService_Import_Categories_CSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// CSV without parent_category - no GetCategoryByName calls expected
	csvData := []byte("name,description\nElectronics,Electronic items\nTools,Hand tools")

	mockRepo.On("CreateCategory", ctx, mock.MatchedBy(func(p queries.CreateCategoryParams) bool {
		return p.WorkspaceID == workspaceID && (p.Name == "Electronics" || p.Name == "Tools")
	})).Return(queries.WarehouseCategory{}, nil).Times(2)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 2, result.TotalRows)
	assert.Equal(t, 2, result.Succeeded)
	assert.Equal(t, 0, result.Failed)
	assert.Empty(t, result.Errors)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Categories_JSON(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// JSON without parent_category - no GetCategoryByName calls expected
	jsonData := []byte(`[
		{"name": "Electronics", "description": "Electronic items"},
		{"name": "Tools", "description": "Hand tools"}
	]`)

	mockRepo.On("CreateCategory", ctx, mock.MatchedBy(func(p queries.CreateCategoryParams) bool {
		return p.WorkspaceID == workspaceID
	})).Return(queries.WarehouseCategory{}, nil).Times(2)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 2, result.TotalRows)
	assert.Equal(t, 2, result.Succeeded)
	assert.Equal(t, 0, result.Failed)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Category_WithParent(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	parentID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,parent_category,description\nSubcategory,Parent,A subcategory")

	mockRepo.On("GetCategoryByName", ctx, workspaceID, "Parent").Return(&queries.WarehouseCategory{
		ID:          parentID,
		WorkspaceID: workspaceID,
		Name:        "Parent",
	}, nil)

	mockRepo.On("CreateCategory", ctx, mock.MatchedBy(func(p queries.CreateCategoryParams) bool {
		return p.Name == "Subcategory" && p.ParentCategoryID.Valid && p.ParentCategoryID.Bytes == parentID
	})).Return(queries.WarehouseCategory{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Labels(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,color,description\nFragile,#FF0000,Handle with care")

	mockRepo.On("CreateLabel", ctx, mock.MatchedBy(func(p queries.CreateLabelParams) bool {
		return p.Name == "Fragile" && *p.Color == "#FF0000"
	})).Return(queries.WarehouseLabel{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeLabel, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Labels_DefaultColor(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,description\nNoColor,A label without color")

	mockRepo.On("CreateLabel", ctx, mock.MatchedBy(func(p queries.CreateLabelParams) bool {
		return p.Name == "NoColor" && *p.Color == "#808080"
	})).Return(queries.WarehouseLabel{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeLabel, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Companies(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	jsonData := []byte(`[{"name": "Acme Corp", "website": "https://acme.com", "notes": "Main supplier"}]`)

	mockRepo.On("CreateCompany", ctx, mock.MatchedBy(func(p queries.CreateCompanyParams) bool {
		return p.Name == "Acme Corp" && *p.Website == "https://acme.com"
	})).Return(queries.WarehouseCompany{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCompany, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Borrowers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,email,phone,notes\nJohn Doe,john@example.com,+1234567890,VIP customer")

	mockRepo.On("CreateBorrower", ctx, mock.MatchedBy(func(p queries.CreateBorrowerParams) bool {
		return p.Name == "John Doe" && *p.Email == "john@example.com"
	})).Return(queries.WarehouseBorrower{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeBorrower, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Locations(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Location without parent_location - no GetLocationByName calls expected
	csvData := []byte("name,description,short_code\nWarehouse A,Main storage,WH-A")

	mockRepo.On("CreateLocation", ctx, mock.MatchedBy(func(p queries.CreateLocationParams) bool {
		return p.Name == "Warehouse A" && *p.Description == "Main storage"
	})).Return(queries.WarehouseLocation{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeLocation, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Locations_WithParent(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	parentID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,parent_location,description\nRoom A,Building 1,A room")

	mockRepo.On("GetLocationByName", ctx, workspaceID, "Building 1").Return(&queries.WarehouseLocation{
		ID:          parentID,
		WorkspaceID: workspaceID,
		Name:        "Building 1",
	}, nil)

	mockRepo.On("CreateLocation", ctx, mock.MatchedBy(func(p queries.CreateLocationParams) bool {
		return p.Name == "Room A" && p.ParentLocation.Valid && p.ParentLocation.Bytes == parentID
	})).Return(queries.WarehouseLocation{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeLocation, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Items(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	catID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,sku,category_name,brand,model\nWidget,SKU-001,Electronics,Acme,Model X")

	mockRepo.On("GetCategoryByName", ctx, workspaceID, "Electronics").Return(&queries.WarehouseCategory{
		ID:          catID,
		WorkspaceID: workspaceID,
		Name:        "Electronics",
	}, nil)

	mockRepo.On("CreateItem", ctx, mock.MatchedBy(func(p queries.CreateItemParams) bool {
		return p.Name == "Widget" && p.Sku == "SKU-001" && p.CategoryID.Valid
	})).Return(queries.WarehouseItem{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeItem, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Items_AutoGenerateSKU(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Item without category_name - no GetCategoryByName calls expected
	csvData := []byte("name,brand\nWidget Without SKU,Acme")

	mockRepo.On("CreateItem", ctx, mock.MatchedBy(func(p queries.CreateItemParams) bool {
		return p.Name == "Widget Without SKU" && strings.HasPrefix(p.Sku, "SKU-")
	})).Return(queries.WarehouseItem{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeItem, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Containers(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,location_name,description,capacity\nBox A1,Warehouse A,Storage box,100 items")

	mockRepo.On("GetLocationByName", ctx, workspaceID, "Warehouse A").Return(&queries.WarehouseLocation{
		ID:          locID,
		WorkspaceID: workspaceID,
		Name:        "Warehouse A",
	}, nil)

	mockRepo.On("CreateContainer", ctx, mock.MatchedBy(func(p queries.CreateContainerParams) bool {
		return p.Name == "Box A1" && p.LocationID == locID
	})).Return(queries.WarehouseContainer{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeContainer, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Container_MissingLocation(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,location_name\nBox A1,Nonexistent")

	mockRepo.On("GetLocationByName", ctx, workspaceID, "Nonexistent").Return(nil, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeContainer, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Errors, 1)
	assert.Contains(t, result.Errors[0].Message, "not found")

	mockRepo.AssertExpectations(t)
}

func TestService_Import_Container_MissingLocationName(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name,description\nBox A1,A box without location")

	result, err := svc.Import(ctx, workspaceID, EntityTypeContainer, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	assert.Contains(t, result.Errors[0].Message, "location_name is required")
}

func TestService_Import_MissingRequiredField(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("description\nA category without name")

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Errors, 1)
	assert.Contains(t, result.Errors[0].Message, "name is required")
}

func TestService_Import_PartialSuccess(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Categories without parent_category - no GetCategoryByName calls expected
	csvData := []byte("name,description\nValid Category,Good\n,Missing Name")

	mockRepo.On("CreateCategory", ctx, mock.MatchedBy(func(p queries.CreateCategoryParams) bool {
		return p.Name == "Valid Category"
	})).Return(queries.WarehouseCategory{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 2, result.TotalRows)
	assert.Equal(t, 1, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Errors, 1)
	assert.Equal(t, 2, result.Errors[0].Row)

	mockRepo.AssertExpectations(t)
}

func TestService_Import_UnsupportedFormat(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	_, err := svc.Import(ctx, workspaceID, EntityTypeCategory, Format("xml"), []byte("<data/>"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported format")
}

func TestService_Import_UnsupportedEntityType(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	csvData := []byte("name\nTest")

	result, err := svc.Import(ctx, workspaceID, EntityType("invalid"), FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Failed)
	assert.Contains(t, result.Errors[0].Message, "unsupported entity type")
}

func TestService_Import_InvalidCSV(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Empty CSV
	_, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatCSV, []byte{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse")
}

func TestService_Import_InvalidJSON(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	_, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatJSON, []byte("{invalid}"))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse")
}

func TestService_Import_CreateError(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Category without parent_category - no GetCategoryByName calls expected
	csvData := []byte("name,description\nTest Category,Description")

	mockRepo.On("CreateCategory", ctx, mock.Anything).Return(queries.WarehouseCategory{}, fmt.Errorf("database error"))

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatCSV, csvData)

	assert.NoError(t, err) // The import itself doesn't fail
	assert.Equal(t, 0, result.Succeeded)
	assert.Equal(t, 1, result.Failed)
	assert.Contains(t, result.Errors[0].Message, "database error")

	mockRepo.AssertExpectations(t)
}

// =============================================================================
// CSV/JSON Parsing Tests
// =============================================================================

func TestService_parseCSV_WithWhitespace(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// CSV with extra whitespace, without parent_category - no GetCategoryByName calls expected
	csvData := []byte("  name  ,  description  \n  Test  ,  A test  ")

	mockRepo.On("CreateCategory", ctx, mock.MatchedBy(func(p queries.CreateCategoryParams) bool {
		return p.Name == "Test" && *p.Description == "A test"
	})).Return(queries.WarehouseCategory{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatCSV, csvData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_parseJSON_WithNumericValues(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// JSON with numeric values that should be converted to strings
	// Item without category_name - no GetCategoryByName calls expected
	jsonData := []byte(`[{"name": "Test", "min_stock_level": 10}]`)

	mockRepo.On("CreateItem", ctx, mock.Anything).Return(queries.WarehouseItem{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeItem, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_parseJSON_WithBooleanValues(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Category without parent_category - no GetCategoryByName calls expected
	jsonData := []byte(`[{"name": "Test", "is_active": true}]`)

	mockRepo.On("CreateCategory", ctx, mock.Anything).Return(queries.WarehouseCategory{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}

func TestService_parseJSON_WithNullValues(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()

	mockRepo := new(MockRepository)
	svc := NewService(mockRepo)

	// Category without parent_category - no GetCategoryByName calls expected
	jsonData := []byte(`[{"name": "Test", "description": null}]`)

	mockRepo.On("CreateCategory", ctx, mock.MatchedBy(func(p queries.CreateCategoryParams) bool {
		return p.Name == "Test" && p.Description == nil
	})).Return(queries.WarehouseCategory{}, nil)

	result, err := svc.Import(ctx, workspaceID, EntityTypeCategory, FormatJSON, jsonData)

	assert.NoError(t, err)
	assert.Equal(t, 1, result.Succeeded)

	mockRepo.AssertExpectations(t)
}
