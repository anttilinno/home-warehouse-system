package batch

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/company"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// =============================================================================
// Type Validation Tests
// =============================================================================

func TestOperationType_IsValid(t *testing.T) {
	tests := []struct {
		name     string
		opType   OperationType
		expected bool
	}{
		{"create is valid", OperationCreate, true},
		{"update is valid", OperationUpdate, true},
		{"delete is valid", OperationDelete, true},
		{"invalid operation", OperationType("invalid"), false},
		{"empty operation", OperationType(""), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.opType.IsValid())
		})
	}
}

func TestEntityType_IsValid(t *testing.T) {
	tests := []struct {
		name       string
		entityType EntityType
		expected   bool
	}{
		{"item is valid", EntityItem, true},
		{"location is valid", EntityLocation, true},
		{"container is valid", EntityContainer, true},
		{"inventory is valid", EntityInventory, true},
		{"category is valid", EntityCategory, true},
		{"label is valid", EntityLabel, true},
		{"company is valid", EntityCompany, true},
		{"borrower is valid", EntityBorrower, true},
		{"loan is valid", EntityLoan, true},
		{"invalid entity", EntityType("invalid"), false},
		{"empty entity", EntityType(""), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, tt.entityType.IsValid())
		})
	}
}

// =============================================================================
// Helper Function Tests
// =============================================================================

func TestCheckConflict(t *testing.T) {
	now := time.Now()

	tests := []struct {
		name             string
		clientUpdatedAt  time.Time
		serverUpdatedAt  time.Time
		expectedConflict bool
	}{
		{
			name:             "server newer - has conflict",
			clientUpdatedAt:  now.Add(-time.Hour),
			serverUpdatedAt:  now,
			expectedConflict: true,
		},
		{
			name:             "client newer - no conflict",
			clientUpdatedAt:  now,
			serverUpdatedAt:  now.Add(-time.Hour),
			expectedConflict: false,
		},
		{
			name:             "same time - no conflict",
			clientUpdatedAt:  now,
			serverUpdatedAt:  now,
			expectedConflict: false,
		},
		{
			name:             "server 1 second newer - has conflict",
			clientUpdatedAt:  now,
			serverUpdatedAt:  now.Add(time.Second),
			expectedConflict: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CheckConflict(tt.clientUpdatedAt, tt.serverUpdatedAt)
			assert.Equal(t, tt.expectedConflict, result)
		})
	}
}

func TestSuccessResult(t *testing.T) {
	id := uuid.New()
	result := successResult(0, &id)

	assert.Equal(t, 0, result.Index)
	assert.Equal(t, StatusSuccess, result.Status)
	assert.Equal(t, &id, result.EntityID)
	assert.Nil(t, result.Error)
	assert.Nil(t, result.ErrorCode)
	assert.False(t, result.HasConflict)
}

func TestSuccessResult_WithDifferentIndex(t *testing.T) {
	id := uuid.New()
	result := successResult(42, &id)

	assert.Equal(t, 42, result.Index)
	assert.Equal(t, StatusSuccess, result.Status)
	assert.Equal(t, &id, result.EntityID)
}

func TestSuccessResult_NilEntityID(t *testing.T) {
	result := successResult(0, nil)

	assert.Equal(t, 0, result.Index)
	assert.Equal(t, StatusSuccess, result.Status)
	assert.Nil(t, result.EntityID)
}

func TestErrorResult(t *testing.T) {
	result := errorResult(5, "something went wrong", "ERROR_CODE")

	assert.Equal(t, 5, result.Index)
	assert.Equal(t, StatusError, result.Status)
	assert.Nil(t, result.EntityID)
	assert.NotNil(t, result.Error)
	assert.Equal(t, "something went wrong", *result.Error)
	assert.NotNil(t, result.ErrorCode)
	assert.Equal(t, "ERROR_CODE", *result.ErrorCode)
	assert.False(t, result.HasConflict)
}

func TestErrorResult_DifferentErrorCodes(t *testing.T) {
	tests := []struct {
		name      string
		message   string
		errorCode string
	}{
		{"not found", "item not found", "NOT_FOUND"},
		{"validation error", "name is required", "VALIDATION_ERROR"},
		{"update failed", "failed to update", "UPDATE_FAILED"},
		{"delete failed", "failed to delete", "DELETE_FAILED"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := errorResult(0, tt.message, tt.errorCode)
			assert.Equal(t, tt.message, *result.Error)
			assert.Equal(t, tt.errorCode, *result.ErrorCode)
		})
	}
}

func TestConflictResult(t *testing.T) {
	id := uuid.New()
	serverData := json.RawMessage(`{"name":"test"}`)
	result := conflictResult(3, &id, &serverData)

	assert.Equal(t, 3, result.Index)
	assert.Equal(t, StatusConflict, result.Status)
	assert.Equal(t, &id, result.EntityID)
	assert.True(t, result.HasConflict)
	assert.NotNil(t, result.ServerData)
}

func TestConflictResult_NilServerData(t *testing.T) {
	id := uuid.New()
	result := conflictResult(0, &id, nil)

	assert.Equal(t, StatusConflict, result.Status)
	assert.True(t, result.HasConflict)
	assert.Nil(t, result.ServerData)
}

func TestMarshalEntity(t *testing.T) {
	type testEntity struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	entity := testEntity{Name: "test", Value: 42}
	result := marshalEntity(entity)

	assert.NotNil(t, result)

	var unmarshaled testEntity
	err := json.Unmarshal(*result, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, entity, unmarshaled)
}

func TestMarshalEntity_WithNilPointer(t *testing.T) {
	result := marshalEntity(nil)
	assert.NotNil(t, result)
}

func TestMarshalEntity_WithComplexStruct(t *testing.T) {
	type nested struct {
		Inner string `json:"inner"`
	}
	type complex struct {
		Name   string  `json:"name"`
		Nested *nested `json:"nested"`
	}

	entity := complex{Name: "test", Nested: &nested{Inner: "value"}}
	result := marshalEntity(entity)

	assert.NotNil(t, result)

	var unmarshaled complex
	err := json.Unmarshal(*result, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, entity.Name, unmarshaled.Name)
	assert.Equal(t, entity.Nested.Inner, unmarshaled.Nested.Inner)
}

func TestStringPtr(t *testing.T) {
	result := stringPtr("test")
	assert.NotNil(t, result)
	assert.Equal(t, "test", *result)
}

func TestStringPtr_EmptyString(t *testing.T) {
	result := stringPtr("")
	assert.NotNil(t, result)
	assert.Equal(t, "", *result)
}

// =============================================================================
// BatchRequest/Response Tests
// =============================================================================

func TestBatchRequest_JSON(t *testing.T) {
	id := uuid.New()
	now := time.Now().UTC().Truncate(time.Second)
	data := json.RawMessage(`{"name":"Updated Item"}`)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &id,
				Data:       data,
				UpdatedAt:  &now,
			},
			{
				Operation:  OperationDelete,
				EntityType: EntityLocation,
				EntityID:   &id,
			},
		},
	}

	// Test marshaling
	jsonData, err := json.Marshal(req)
	assert.NoError(t, err)

	// Test unmarshaling
	var unmarshaled BatchRequest
	err = json.Unmarshal(jsonData, &unmarshaled)
	assert.NoError(t, err)

	assert.Len(t, unmarshaled.Operations, 2)
	assert.Equal(t, OperationUpdate, unmarshaled.Operations[0].Operation)
	assert.Equal(t, EntityItem, unmarshaled.Operations[0].EntityType)
	assert.Equal(t, OperationDelete, unmarshaled.Operations[1].Operation)
	assert.Equal(t, EntityLocation, unmarshaled.Operations[1].EntityType)
}

func TestBatchResponse_Counters(t *testing.T) {
	response := BatchResponse{
		Results: []OperationResult{
			{Index: 0, Status: StatusSuccess},
			{Index: 1, Status: StatusSuccess},
			{Index: 2, Status: StatusError},
			{Index: 3, Status: StatusConflict},
		},
		Succeeded: 2,
		Failed:    1,
		Conflicts: 1,
	}

	// Test marshaling
	jsonData, err := json.Marshal(response)
	assert.NoError(t, err)

	// Test unmarshaling
	var unmarshaled BatchResponse
	err = json.Unmarshal(jsonData, &unmarshaled)
	assert.NoError(t, err)

	assert.Len(t, unmarshaled.Results, 4)
	assert.Equal(t, 2, unmarshaled.Succeeded)
	assert.Equal(t, 1, unmarshaled.Failed)
	assert.Equal(t, 1, unmarshaled.Conflicts)
}

func TestOperation_RequiredFields(t *testing.T) {
	tests := []struct {
		name        string
		operation   Operation
		validOp     bool
		validEntity bool
	}{
		{
			name: "valid update operation",
			operation: Operation{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   ptrUUID(uuid.New()),
			},
			validOp:     true,
			validEntity: true,
		},
		{
			name: "invalid operation type",
			operation: Operation{
				Operation:  OperationType("patch"),
				EntityType: EntityItem,
			},
			validOp:     false,
			validEntity: true,
		},
		{
			name: "invalid entity type",
			operation: Operation{
				Operation:  OperationUpdate,
				EntityType: EntityType("unknown"),
			},
			validOp:     true,
			validEntity: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.validOp, tt.operation.Operation.IsValid())
			assert.Equal(t, tt.validEntity, tt.operation.EntityType.IsValid())
		})
	}
}

func TestResultStatus_Values(t *testing.T) {
	assert.Equal(t, ResultStatus("success"), StatusSuccess)
	assert.Equal(t, ResultStatus("error"), StatusError)
	assert.Equal(t, ResultStatus("conflict"), StatusConflict)
	assert.Equal(t, ResultStatus("skipped"), StatusSkipped)
}

// =============================================================================
// Service Constructor Test
// =============================================================================

func TestNewService(t *testing.T) {
	// Test that NewService creates a service with nil dependencies (for unit test coverage)
	// In production, actual services would be injected
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)
	assert.NotNil(t, svc)
}

// =============================================================================
// ProcessBatch Validation Tests
// =============================================================================

func TestProcessBatch_InvalidOperationType(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationType("patch"), // invalid
				EntityType: EntityItem,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusError, resp.Results[0].Status)
	assert.Contains(t, *resp.Results[0].Error, "invalid operation type")
	assert.Equal(t, "INVALID_OPERATION", *resp.Results[0].ErrorCode)
	assert.Equal(t, 1, resp.Failed)
	assert.Equal(t, 0, resp.Succeeded)
}

func TestProcessBatch_InvalidEntityType(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityType("unknown"), // invalid
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusError, resp.Results[0].Status)
	assert.Contains(t, *resp.Results[0].Error, "invalid entity type")
	assert.Equal(t, "INVALID_ENTITY_TYPE", *resp.Results[0].ErrorCode)
	assert.Equal(t, 1, resp.Failed)
}

func TestProcessBatch_UnsupportedEntityTypes(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	unsupportedTypes := []EntityType{
		EntityInventory,
		EntityBorrower,
		EntityLoan,
	}

	for _, entityType := range unsupportedTypes {
		t.Run(string(entityType), func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  OperationUpdate,
						EntityType: entityType,
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.NotNil(t, resp)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Contains(t, *resp.Results[0].Error, "not yet supported")
			assert.Equal(t, "UNSUPPORTED_ENTITY", *resp.Results[0].ErrorCode)
		})
	}
}

func TestProcessBatch_EmptyOperations(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	req := BatchRequest{
		Operations: []Operation{},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 0)
	assert.Equal(t, 0, resp.Succeeded)
	assert.Equal(t, 0, resp.Failed)
	assert.Equal(t, 0, resp.Conflicts)
}

func TestProcessBatch_MultipleValidationErrors(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationType("invalid_op"),
				EntityType: EntityItem,
			},
			{
				Operation:  OperationUpdate,
				EntityType: EntityType("invalid_entity"),
			},
			{
				Operation:  OperationUpdate,
				EntityType: EntityInventory, // unsupported
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 3)
	assert.Equal(t, 3, resp.Failed)
	assert.Equal(t, 0, resp.Succeeded)

	// First error: invalid operation
	assert.Equal(t, "INVALID_OPERATION", *resp.Results[0].ErrorCode)
	// Second error: invalid entity type
	assert.Equal(t, "INVALID_ENTITY_TYPE", *resp.Results[1].ErrorCode)
	// Third error: unsupported entity
	assert.Equal(t, "UNSUPPORTED_ENTITY", *resp.Results[2].ErrorCode)
}

// =============================================================================
// Entity-specific Operation Tests (without mocks - tests validation paths)
// =============================================================================

func TestProcessBatch_ItemOperation_MissingEntityID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	tests := []struct {
		name      string
		operation OperationType
		errorCode string
	}{
		{"update without entity_id", OperationUpdate, "MISSING_ENTITY_ID"},
		{"delete without entity_id", OperationDelete, "MISSING_ENTITY_ID"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  tt.operation,
						EntityType: EntityItem,
						EntityID:   nil, // Missing entity ID
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.NotNil(t, resp)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Equal(t, tt.errorCode, *resp.Results[0].ErrorCode)
		})
	}
}

func TestProcessBatch_LocationOperation_MissingEntityID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	tests := []struct {
		name      string
		operation OperationType
		errorCode string
	}{
		{"update without entity_id", OperationUpdate, "MISSING_ENTITY_ID"},
		{"delete without entity_id", OperationDelete, "MISSING_ENTITY_ID"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  tt.operation,
						EntityType: EntityLocation,
						EntityID:   nil,
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Equal(t, tt.errorCode, *resp.Results[0].ErrorCode)
		})
	}
}

func TestProcessBatch_ContainerOperation_MissingEntityID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	tests := []struct {
		name      string
		operation OperationType
		errorCode string
	}{
		{"update without entity_id", OperationUpdate, "MISSING_ENTITY_ID"},
		{"delete without entity_id", OperationDelete, "MISSING_ENTITY_ID"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  tt.operation,
						EntityType: EntityContainer,
						EntityID:   nil,
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Equal(t, tt.errorCode, *resp.Results[0].ErrorCode)
		})
	}
}

func TestProcessBatch_CategoryOperation_MissingEntityID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	tests := []struct {
		name      string
		operation OperationType
		errorCode string
	}{
		{"update without entity_id", OperationUpdate, "MISSING_ENTITY_ID"},
		{"delete without entity_id", OperationDelete, "MISSING_ENTITY_ID"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  tt.operation,
						EntityType: EntityCategory,
						EntityID:   nil,
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Equal(t, tt.errorCode, *resp.Results[0].ErrorCode)
		})
	}
}

func TestProcessBatch_LabelOperation_MissingEntityID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	tests := []struct {
		name      string
		operation OperationType
		errorCode string
	}{
		{"update without entity_id", OperationUpdate, "MISSING_ENTITY_ID"},
		{"delete without entity_id", OperationDelete, "MISSING_ENTITY_ID"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  tt.operation,
						EntityType: EntityLabel,
						EntityID:   nil,
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Equal(t, tt.errorCode, *resp.Results[0].ErrorCode)
		})
	}
}

func TestProcessBatch_CompanyOperation_MissingEntityID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	tests := []struct {
		name      string
		operation OperationType
		errorCode string
	}{
		{"update without entity_id", OperationUpdate, "MISSING_ENTITY_ID"},
		{"delete without entity_id", OperationDelete, "MISSING_ENTITY_ID"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  tt.operation,
						EntityType: EntityCompany,
						EntityID:   nil,
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Equal(t, tt.errorCode, *resp.Results[0].ErrorCode)
		})
	}
}

func TestProcessBatch_UnsupportedCreateOperations(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	svc := NewService(nil, nil, nil, nil, nil, nil, nil)

	entityTypes := []EntityType{
		EntityItem,
		EntityLocation,
		EntityContainer,
		EntityCategory,
		EntityLabel,
		EntityCompany,
	}

	for _, entityType := range entityTypes {
		t.Run(string(entityType), func(t *testing.T) {
			req := BatchRequest{
				Operations: []Operation{
					{
						Operation:  OperationCreate, // create not supported
						EntityType: entityType,
						EntityID:   ptrUUID(uuid.New()),
					},
				},
			}

			resp, err := svc.ProcessBatch(ctx, workspaceID, req)
			assert.NoError(t, err)
			assert.Len(t, resp.Results, 1)
			assert.Equal(t, StatusError, resp.Results[0].Status)
			assert.Equal(t, "UNSUPPORTED_OPERATION", *resp.Results[0].ErrorCode)
			assert.Contains(t, *resp.Results[0].Error, "create not supported")
		})
	}
}

// =============================================================================
// Mock Repository Implementations for Service Tests
// =============================================================================

// MockItemRepository is a mock implementation of the item.Repository interface
type MockItemRepository struct {
	mock.Mock
}

func (m *MockItemRepository) Save(ctx context.Context, i *item.Item) error {
	args := m.Called(ctx, i)
	return args.Error(0)
}

func (m *MockItemRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindBySKU(ctx context.Context, workspaceID uuid.UUID, sku string) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, sku)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindByBarcode(ctx context.Context, workspaceID uuid.UUID, barcode string) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, barcode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

func (m *MockItemRepository) FindByCategory(ctx context.Context, workspaceID, categoryID uuid.UUID, pagination shared.Pagination) ([]*item.Item, error) {
	args := m.Called(ctx, workspaceID, categoryID, pagination)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*item.Item), args.Error(1)
}

func (m *MockItemRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*item.Item, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*item.Item), args.Error(1)
}

func (m *MockItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockItemRepository) SKUExists(ctx context.Context, workspaceID uuid.UUID, sku string) (bool, error) {
	args := m.Called(ctx, workspaceID, sku)
	return args.Bool(0), args.Error(1)
}

func (m *MockItemRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	return args.Bool(0), args.Error(1)
}

func (m *MockItemRepository) AttachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID)
	return args.Error(0)
}

func (m *MockItemRepository) DetachLabel(ctx context.Context, itemID, labelID uuid.UUID) error {
	args := m.Called(ctx, itemID, labelID)
	return args.Error(0)
}

func (m *MockItemRepository) GetItemLabels(ctx context.Context, itemID uuid.UUID) ([]uuid.UUID, error) {
	args := m.Called(ctx, itemID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

// MockLocationRepository is a mock implementation of the location.Repository interface
type MockLocationRepository struct {
	mock.Mock
}

func (m *MockLocationRepository) Save(ctx context.Context, loc *location.Location) error {
	args := m.Called(ctx, loc)
	return args.Error(0)
}

func (m *MockLocationRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*location.Location, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}

func (m *MockLocationRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*location.Location, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*location.Location), args.Int(1), args.Error(2)
}

func (m *MockLocationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockLocationRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	return args.Bool(0), args.Error(1)
}

func (m *MockLocationRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*location.Location, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*location.Location), args.Error(1)
}

func (m *MockLocationRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*location.Location, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*location.Location), args.Error(1)
}

func (m *MockLocationRepository) FindRootLocations(ctx context.Context, workspaceID uuid.UUID) ([]*location.Location, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*location.Location), args.Error(1)
}

// MockContainerRepository is a mock implementation of the container.Repository interface
type MockContainerRepository struct {
	mock.Mock
}

func (m *MockContainerRepository) Save(ctx context.Context, c *container.Container) error {
	args := m.Called(ctx, c)
	return args.Error(0)
}

func (m *MockContainerRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*container.Container, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*container.Container), args.Error(1)
}

func (m *MockContainerRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*container.Container, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*container.Container), args.Int(1), args.Error(2)
}

func (m *MockContainerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockContainerRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	return args.Bool(0), args.Error(1)
}

func (m *MockContainerRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*container.Container, error) {
	args := m.Called(ctx, workspaceID, query, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*container.Container), args.Error(1)
}

func (m *MockContainerRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*container.Container, error) {
	args := m.Called(ctx, workspaceID, locationID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*container.Container), args.Error(1)
}

func (m *MockContainerRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*container.Container, error) {
	args := m.Called(ctx, workspaceID, shortCode)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*container.Container), args.Error(1)
}

// MockCategoryRepository is a mock implementation of the category.Repository interface
type MockCategoryRepository struct {
	mock.Mock
}

func (m *MockCategoryRepository) Save(ctx context.Context, cat *category.Category) error {
	args := m.Called(ctx, cat)
	return args.Error(0)
}

func (m *MockCategoryRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*category.Category, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindByParent(ctx context.Context, workspaceID, parentID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) FindRootCategories(ctx context.Context, workspaceID uuid.UUID) ([]*category.Category, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCategoryRepository) HasChildren(ctx context.Context, id uuid.UUID) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

// MockLabelRepository is a mock implementation of the label.Repository interface
type MockLabelRepository struct {
	mock.Mock
}

func (m *MockLabelRepository) Save(ctx context.Context, lbl *label.Label) error {
	args := m.Called(ctx, lbl)
	return args.Error(0)
}

func (m *MockLabelRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*label.Label, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*label.Label), args.Error(1)
}

func (m *MockLabelRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*label.Label, error) {
	args := m.Called(ctx, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*label.Label), args.Error(1)
}

func (m *MockLabelRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockLabelRepository) NameExists(ctx context.Context, workspaceID uuid.UUID, name string) (bool, error) {
	args := m.Called(ctx, workspaceID, name)
	return args.Bool(0), args.Error(1)
}

func (m *MockLabelRepository) FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*label.Label, error) {
	args := m.Called(ctx, workspaceID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*label.Label), args.Error(1)
}

// MockCompanyRepository is a mock implementation of the company.Repository interface
type MockCompanyRepository struct {
	mock.Mock
}

func (m *MockCompanyRepository) Save(ctx context.Context, comp *company.Company) error {
	args := m.Called(ctx, comp)
	return args.Error(0)
}

func (m *MockCompanyRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*company.Company, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*company.Company), args.Error(1)
}

func (m *MockCompanyRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*company.Company, int, error) {
	args := m.Called(ctx, workspaceID, pagination)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*company.Company), args.Int(1), args.Error(2)
}

func (m *MockCompanyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCompanyRepository) NameExists(ctx context.Context, workspaceID uuid.UUID, name string) (bool, error) {
	args := m.Called(ctx, workspaceID, name)
	return args.Bool(0), args.Error(1)
}

func (m *MockCompanyRepository) FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*company.Company, error) {
	args := m.Called(ctx, workspaceID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*company.Company), args.Error(1)
}

// =============================================================================
// Service Tests with Mocked Repositories
// =============================================================================

func createTestItemService(repo *MockItemRepository) *item.Service {
	return item.NewService(repo)
}

func createTestLocationService(repo *MockLocationRepository) *location.Service {
	return location.NewService(repo)
}

func createTestContainerService(repo *MockContainerRepository) *container.Service {
	return container.NewService(repo)
}

func createTestCategoryService(repo *MockCategoryRepository) *category.Service {
	return category.NewService(repo)
}

func createTestLabelService(repo *MockLabelRepository) *label.Service {
	return label.NewService(repo)
}

func createTestCompanyService(repo *MockCompanyRepository) *company.Service {
	return company.NewService(repo)
}

// =============================================================================
// Item Operation Tests
// =============================================================================

func TestProcessBatch_ItemUpdate_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Original Name",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, now, now,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
	mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)

	updateData := json.RawMessage(`{"name":"Updated Name","min_stock_level":10}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, &itemID, resp.Results[0].EntityID)
	assert.Equal(t, 1, resp.Succeeded)
	assert.Equal(t, 0, resp.Failed)

	mockItemRepo.AssertExpectations(t)
}

func TestProcessBatch_ItemUpdate_NotFound(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, errors.New("item not found"))

	updateData := json.RawMessage(`{"name":"Updated Name"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusError, resp.Results[0].Status)
	assert.Equal(t, "NOT_FOUND", *resp.Results[0].ErrorCode)
	assert.Equal(t, 0, resp.Succeeded)
	assert.Equal(t, 1, resp.Failed)

	mockItemRepo.AssertExpectations(t)
}

func TestProcessBatch_ItemUpdate_Conflict(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	serverTime := time.Now()
	clientTime := serverTime.Add(-time.Hour) // Client has older version

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Server Name",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, serverTime, serverTime,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)

	updateData := json.RawMessage(`{"name":"Client Name"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       updateData,
				UpdatedAt:  &clientTime,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusConflict, resp.Results[0].Status)
	assert.True(t, resp.Results[0].HasConflict)
	assert.NotNil(t, resp.Results[0].ServerData)
	assert.Equal(t, 0, resp.Succeeded)
	assert.Equal(t, 0, resp.Failed)
	assert.Equal(t, 1, resp.Conflicts)

	mockItemRepo.AssertExpectations(t)
}

func TestProcessBatch_ItemUpdate_InvalidData(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Original Name",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, now, now,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)

	updateData := json.RawMessage(`invalid json`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusError, resp.Results[0].Status)
	assert.Equal(t, "INVALID_DATA", *resp.Results[0].ErrorCode)

	mockItemRepo.AssertExpectations(t)
}

func TestProcessBatch_ItemDelete_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Test Item",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, now, now,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
	mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationDelete,
				EntityType: EntityItem,
				EntityID:   &itemID,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, &itemID, resp.Results[0].EntityID)
	assert.Equal(t, 1, resp.Succeeded)

	mockItemRepo.AssertExpectations(t)
}

func TestProcessBatch_ItemDelete_NotFound(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, errors.New("item not found"))

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationDelete,
				EntityType: EntityItem,
				EntityID:   &itemID,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusError, resp.Results[0].Status)
	assert.Equal(t, "DELETE_FAILED", *resp.Results[0].ErrorCode)

	mockItemRepo.AssertExpectations(t)
}

// =============================================================================
// Location Operation Tests
// =============================================================================

func TestProcessBatch_LocationUpdate_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	mockLocationRepo := new(MockLocationRepository)
	locationSvc := createTestLocationService(mockLocationRepo)
	svc := NewService(nil, locationSvc, nil, nil, nil, nil, nil)

	existingLocation := location.Reconstruct(
		locationID, workspaceID, "Original Room", nil, nil, "LOC001", false, now, now,
	)

	mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(existingLocation, nil)
	mockLocationRepo.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)

	updateData := json.RawMessage(`{"name":"Updated Room"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityLocation,
				EntityID:   &locationID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 1)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, 1, resp.Succeeded)

	mockLocationRepo.AssertExpectations(t)
}

func TestProcessBatch_LocationUpdate_Conflict(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locationID := uuid.New()
	serverTime := time.Now()
	clientTime := serverTime.Add(-time.Hour)

	mockLocationRepo := new(MockLocationRepository)
	locationSvc := createTestLocationService(mockLocationRepo)
	svc := NewService(nil, locationSvc, nil, nil, nil, nil, nil)

	existingLocation := location.Reconstruct(
		locationID, workspaceID, "Server Room", nil, nil, "LOC001", false, serverTime, serverTime,
	)

	mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(existingLocation, nil)

	updateData := json.RawMessage(`{"name":"Client Room"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityLocation,
				EntityID:   &locationID,
				Data:       updateData,
				UpdatedAt:  &clientTime,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusConflict, resp.Results[0].Status)
	assert.Equal(t, 1, resp.Conflicts)

	mockLocationRepo.AssertExpectations(t)
}

func TestProcessBatch_LocationDelete_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	mockLocationRepo := new(MockLocationRepository)
	locationSvc := createTestLocationService(mockLocationRepo)
	svc := NewService(nil, locationSvc, nil, nil, nil, nil, nil)

	existingLocation := location.Reconstruct(
		locationID, workspaceID, "Test Room", nil, nil, "LOC001", false, now, now,
	)

	mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(existingLocation, nil)
	mockLocationRepo.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationDelete,
				EntityType: EntityLocation,
				EntityID:   &locationID,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, 1, resp.Succeeded)

	mockLocationRepo.AssertExpectations(t)
}

// =============================================================================
// Container Operation Tests
// =============================================================================

func TestProcessBatch_ContainerUpdate_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	containerID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	mockContainerRepo := new(MockContainerRepository)
	containerSvc := createTestContainerService(mockContainerRepo)
	svc := NewService(nil, nil, containerSvc, nil, nil, nil, nil)

	existingContainer := container.Reconstruct(
		containerID, workspaceID, locationID, "Original Box", nil, nil, "CON001", false, now, now,
	)

	mockContainerRepo.On("FindByID", ctx, containerID, workspaceID).Return(existingContainer, nil)
	mockContainerRepo.On("Save", ctx, mock.AnythingOfType("*container.Container")).Return(nil)

	updateData := json.RawMessage(`{"name":"Updated Box","location_id":"` + locationID.String() + `"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityContainer,
				EntityID:   &containerID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, 1, resp.Succeeded)

	mockContainerRepo.AssertExpectations(t)
}

func TestProcessBatch_ContainerDelete_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	containerID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	mockContainerRepo := new(MockContainerRepository)
	containerSvc := createTestContainerService(mockContainerRepo)
	svc := NewService(nil, nil, containerSvc, nil, nil, nil, nil)

	existingContainer := container.Reconstruct(
		containerID, workspaceID, locationID, "Test Box", nil, nil, "CON001", false, now, now,
	)

	mockContainerRepo.On("FindByID", ctx, containerID, workspaceID).Return(existingContainer, nil)
	mockContainerRepo.On("Save", ctx, mock.AnythingOfType("*container.Container")).Return(nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationDelete,
				EntityType: EntityContainer,
				EntityID:   &containerID,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)

	mockContainerRepo.AssertExpectations(t)
}

// =============================================================================
// Category Operation Tests
// =============================================================================

func TestProcessBatch_CategoryUpdate_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()
	now := time.Now()

	mockCategoryRepo := new(MockCategoryRepository)
	categorySvc := createTestCategoryService(mockCategoryRepo)
	svc := NewService(nil, nil, nil, nil, categorySvc, nil, nil)

	existingCategory := category.Reconstruct(
		categoryID, workspaceID, "Original Category", nil, nil, false, now, now,
	)

	mockCategoryRepo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCategory, nil)
	mockCategoryRepo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)

	updateData := json.RawMessage(`{"name":"Updated Category"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityCategory,
				EntityID:   &categoryID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, 1, resp.Succeeded)

	mockCategoryRepo.AssertExpectations(t)
}

func TestProcessBatch_CategoryDelete_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	categoryID := uuid.New()
	now := time.Now()

	mockCategoryRepo := new(MockCategoryRepository)
	categorySvc := createTestCategoryService(mockCategoryRepo)
	svc := NewService(nil, nil, nil, nil, categorySvc, nil, nil)

	existingCategory := category.Reconstruct(
		categoryID, workspaceID, "Test Category", nil, nil, false, now, now,
	)

	mockCategoryRepo.On("FindByID", ctx, categoryID, workspaceID).Return(existingCategory, nil)
	mockCategoryRepo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationDelete,
				EntityType: EntityCategory,
				EntityID:   &categoryID,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)

	mockCategoryRepo.AssertExpectations(t)
}

// =============================================================================
// Label Operation Tests
// =============================================================================

func TestProcessBatch_LabelUpdate_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	labelID := uuid.New()
	now := time.Now()

	mockLabelRepo := new(MockLabelRepository)
	labelSvc := createTestLabelService(mockLabelRepo)
	svc := NewService(nil, nil, nil, nil, nil, labelSvc, nil)

	existingLabel := label.Reconstruct(
		labelID, workspaceID, "Original Label", ptrString("#FF0000"), nil, false, now, now,
	)

	mockLabelRepo.On("FindByID", ctx, labelID, workspaceID).Return(existingLabel, nil)
	mockLabelRepo.On("NameExists", ctx, workspaceID, "Updated Label").Return(false, nil)
	mockLabelRepo.On("Save", ctx, mock.AnythingOfType("*label.Label")).Return(nil)

	updateData := json.RawMessage(`{"name":"Updated Label","color":"#00FF00"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityLabel,
				EntityID:   &labelID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)

	mockLabelRepo.AssertExpectations(t)
}

func TestProcessBatch_LabelDelete_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	labelID := uuid.New()
	now := time.Now()

	mockLabelRepo := new(MockLabelRepository)
	labelSvc := createTestLabelService(mockLabelRepo)
	svc := NewService(nil, nil, nil, nil, nil, labelSvc, nil)

	existingLabel := label.Reconstruct(
		labelID, workspaceID, "Test Label", nil, nil, false, now, now,
	)

	mockLabelRepo.On("FindByID", ctx, labelID, workspaceID).Return(existingLabel, nil)
	mockLabelRepo.On("Save", ctx, mock.AnythingOfType("*label.Label")).Return(nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationDelete,
				EntityType: EntityLabel,
				EntityID:   &labelID,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)

	mockLabelRepo.AssertExpectations(t)
}

// =============================================================================
// Company Operation Tests
// =============================================================================

func TestProcessBatch_CompanyUpdate_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	companyID := uuid.New()
	now := time.Now()

	mockCompanyRepo := new(MockCompanyRepository)
	companySvc := createTestCompanyService(mockCompanyRepo)
	svc := NewService(nil, nil, nil, nil, nil, nil, companySvc)

	existingCompany := company.Reconstruct(
		companyID, workspaceID, "Original Company", nil, nil, false, now, now,
	)

	mockCompanyRepo.On("FindByID", ctx, companyID, workspaceID).Return(existingCompany, nil)
	mockCompanyRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(nil)

	updateData := json.RawMessage(`{"name":"Updated Company"}`)
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityCompany,
				EntityID:   &companyID,
				Data:       updateData,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)

	mockCompanyRepo.AssertExpectations(t)
}

func TestProcessBatch_CompanyDelete_Success(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	companyID := uuid.New()
	now := time.Now()

	mockCompanyRepo := new(MockCompanyRepository)
	companySvc := createTestCompanyService(mockCompanyRepo)
	svc := NewService(nil, nil, nil, nil, nil, nil, companySvc)

	existingCompany := company.Reconstruct(
		companyID, workspaceID, "Test Company", nil, nil, false, now, now,
	)

	mockCompanyRepo.On("FindByID", ctx, companyID, workspaceID).Return(existingCompany, nil)
	mockCompanyRepo.On("Save", ctx, mock.AnythingOfType("*company.Company")).Return(nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationDelete,
				EntityType: EntityCompany,
				EntityID:   &companyID,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)

	mockCompanyRepo.AssertExpectations(t)
}

// =============================================================================
// Mixed Batch Operation Tests
// =============================================================================

func TestProcessBatch_MixedOperations_PartialSuccess(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	categoryID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	mockCategoryRepo := new(MockCategoryRepository)
	itemSvc := createTestItemService(mockItemRepo)
	categorySvc := createTestCategoryService(mockCategoryRepo)
	svc := NewService(itemSvc, nil, nil, nil, categorySvc, nil, nil)

	// Item update will succeed
	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Original Item",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, now, now,
	)
	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
	mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)

	// Category update will fail (not found)
	mockCategoryRepo.On("FindByID", ctx, categoryID, workspaceID).Return(nil, nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       json.RawMessage(`{"name":"Updated Item"}`),
			},
			{
				Operation:  OperationUpdate,
				EntityType: EntityCategory,
				EntityID:   &categoryID,
				Data:       json.RawMessage(`{"name":"Updated Category"}`),
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Len(t, resp.Results, 2)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, StatusError, resp.Results[1].Status)
	assert.Equal(t, 1, resp.Succeeded)
	assert.Equal(t, 1, resp.Failed)

	mockItemRepo.AssertExpectations(t)
	mockCategoryRepo.AssertExpectations(t)
}

func TestProcessBatch_MixedOperations_AllSuccess(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	mockLocationRepo := new(MockLocationRepository)
	itemSvc := createTestItemService(mockItemRepo)
	locationSvc := createTestLocationService(mockLocationRepo)
	svc := NewService(itemSvc, locationSvc, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Original Item",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, now, now,
	)
	existingLocation := location.Reconstruct(
		locationID, workspaceID, "Original Room", nil, nil, "LOC001", false, now, now,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
	mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)
	mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(existingLocation, nil)
	mockLocationRepo.On("Save", ctx, mock.AnythingOfType("*location.Location")).Return(nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       json.RawMessage(`{"name":"Updated Item"}`),
			},
			{
				Operation:  OperationUpdate,
				EntityType: EntityLocation,
				EntityID:   &locationID,
				Data:       json.RawMessage(`{"name":"Updated Room"}`),
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Len(t, resp.Results, 2)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, StatusSuccess, resp.Results[1].Status)
	assert.Equal(t, 2, resp.Succeeded)
	assert.Equal(t, 0, resp.Failed)
	assert.Equal(t, 0, resp.Conflicts)

	mockItemRepo.AssertExpectations(t)
	mockLocationRepo.AssertExpectations(t)
}

func TestProcessBatch_MixedOperations_AllFailed(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()

	mockItemRepo := new(MockItemRepository)
	mockLocationRepo := new(MockLocationRepository)
	itemSvc := createTestItemService(mockItemRepo)
	locationSvc := createTestLocationService(mockLocationRepo)
	svc := NewService(itemSvc, locationSvc, nil, nil, nil, nil, nil)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(nil, errors.New("item not found"))
	mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(nil, nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       json.RawMessage(`{"name":"Updated Item"}`),
			},
			{
				Operation:  OperationUpdate,
				EntityType: EntityLocation,
				EntityID:   &locationID,
				Data:       json.RawMessage(`{"name":"Updated Room"}`),
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Len(t, resp.Results, 2)
	assert.Equal(t, StatusError, resp.Results[0].Status)
	assert.Equal(t, StatusError, resp.Results[1].Status)
	assert.Equal(t, 0, resp.Succeeded)
	assert.Equal(t, 2, resp.Failed)

	mockItemRepo.AssertExpectations(t)
	mockLocationRepo.AssertExpectations(t)
}

func TestProcessBatch_MixedOperations_WithConflicts(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	locationID := uuid.New()
	serverTime := time.Now()
	clientTime := serverTime.Add(-time.Hour)

	mockItemRepo := new(MockItemRepository)
	mockLocationRepo := new(MockLocationRepository)
	itemSvc := createTestItemService(mockItemRepo)
	locationSvc := createTestLocationService(mockLocationRepo)
	svc := NewService(itemSvc, locationSvc, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Server Item",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, serverTime, serverTime,
	)
	existingLocation := location.Reconstruct(
		locationID, workspaceID, "Server Room", nil, nil, "LOC001", false, serverTime, serverTime,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
	mockLocationRepo.On("FindByID", ctx, locationID, workspaceID).Return(existingLocation, nil)

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       json.RawMessage(`{"name":"Client Item"}`),
				UpdatedAt:  &clientTime,
			},
			{
				Operation:  OperationUpdate,
				EntityType: EntityLocation,
				EntityID:   &locationID,
				Data:       json.RawMessage(`{"name":"Client Room"}`),
				UpdatedAt:  &clientTime,
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Len(t, resp.Results, 2)
	assert.Equal(t, StatusConflict, resp.Results[0].Status)
	assert.Equal(t, StatusConflict, resp.Results[1].Status)
	assert.Equal(t, 0, resp.Succeeded)
	assert.Equal(t, 0, resp.Failed)
	assert.Equal(t, 2, resp.Conflicts)

	mockItemRepo.AssertExpectations(t)
	mockLocationRepo.AssertExpectations(t)
}

// =============================================================================
// Large Batch Tests
// =============================================================================

func TestProcessBatch_LargeBatch_AllSuccess(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	// Create 5 batch operations manually to avoid loop variable capture issues
	id1, id2, id3, id4, id5 := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()

	// Set up mocks for each
	item1 := item.Reconstruct(id1, workspaceID, "SKU-001", "Item 1", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 5, "SHORT1", nil, nil, now, now)
	item2 := item.Reconstruct(id2, workspaceID, "SKU-002", "Item 2", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 5, "SHORT2", nil, nil, now, now)
	item3 := item.Reconstruct(id3, workspaceID, "SKU-003", "Item 3", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 5, "SHORT3", nil, nil, now, now)
	item4 := item.Reconstruct(id4, workspaceID, "SKU-004", "Item 4", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 5, "SHORT4", nil, nil, now, now)
	item5 := item.Reconstruct(id5, workspaceID, "SKU-005", "Item 5", nil, nil, nil, nil, nil, nil, nil, nil, ptrBool(false), ptrBool(false), ptrBool(false), nil, nil, 5, "SHORT5", nil, nil, now, now)

	mockItemRepo.On("FindByID", ctx, id1, workspaceID).Return(item1, nil)
	mockItemRepo.On("FindByID", ctx, id2, workspaceID).Return(item2, nil)
	mockItemRepo.On("FindByID", ctx, id3, workspaceID).Return(item3, nil)
	mockItemRepo.On("FindByID", ctx, id4, workspaceID).Return(item4, nil)
	mockItemRepo.On("FindByID", ctx, id5, workspaceID).Return(item5, nil)
	mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil).Times(5)

	req := BatchRequest{
		Operations: []Operation{
			{Operation: OperationUpdate, EntityType: EntityItem, EntityID: &id1, Data: json.RawMessage(`{"name":"Updated 1"}`)},
			{Operation: OperationUpdate, EntityType: EntityItem, EntityID: &id2, Data: json.RawMessage(`{"name":"Updated 2"}`)},
			{Operation: OperationUpdate, EntityType: EntityItem, EntityID: &id3, Data: json.RawMessage(`{"name":"Updated 3"}`)},
			{Operation: OperationUpdate, EntityType: EntityItem, EntityID: &id4, Data: json.RawMessage(`{"name":"Updated 4"}`)},
			{Operation: OperationUpdate, EntityType: EntityItem, EntityID: &id5, Data: json.RawMessage(`{"name":"Updated 5"}`)},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Len(t, resp.Results, 5)
	assert.Equal(t, 5, resp.Succeeded)
	assert.Equal(t, 0, resp.Failed)
	assert.Equal(t, 0, resp.Conflicts)

	mockItemRepo.AssertExpectations(t)
}

// =============================================================================
// ConflictInfo Tests
// =============================================================================

func TestConflictInfo_JSON(t *testing.T) {
	id := uuid.New()
	now := time.Now().UTC().Truncate(time.Second)

	info := ConflictInfo{
		EntityID:        id,
		EntityType:      EntityItem,
		ClientUpdatedAt: now.Add(-time.Hour),
		ServerUpdatedAt: now,
		ServerData:      map[string]string{"name": "Server Data"},
	}

	jsonData, err := json.Marshal(info)
	assert.NoError(t, err)

	var unmarshaled ConflictInfo
	err = json.Unmarshal(jsonData, &unmarshaled)
	assert.NoError(t, err)

	assert.Equal(t, id, unmarshaled.EntityID)
	assert.Equal(t, EntityItem, unmarshaled.EntityType)
}

// =============================================================================
// Edge Cases Tests
// =============================================================================

func TestProcessBatch_NilUpdatedAt_NoConflictCheck(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Original Name",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, now, now,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
	mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(nil)

	// No UpdatedAt provided - should skip conflict check
	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       json.RawMessage(`{"name":"Updated Name"}`),
				UpdatedAt:  nil, // No timestamp provided
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusSuccess, resp.Results[0].Status)
	assert.Equal(t, 1, resp.Succeeded)

	mockItemRepo.AssertExpectations(t)
}

func TestProcessBatch_UpdateFailure(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New()
	itemID := uuid.New()
	now := time.Now()

	mockItemRepo := new(MockItemRepository)
	itemSvc := createTestItemService(mockItemRepo)
	svc := NewService(itemSvc, nil, nil, nil, nil, nil, nil)

	existingItem := item.Reconstruct(
		itemID, workspaceID, "SKU-001", "Original Name",
		nil, nil, nil, nil, nil, nil, nil, nil,
		ptrBool(false), ptrBool(false), ptrBool(false), nil, nil,
		5, "SHORT1", nil, nil, now, now,
	)

	mockItemRepo.On("FindByID", ctx, itemID, workspaceID).Return(existingItem, nil)
	mockItemRepo.On("Save", ctx, mock.AnythingOfType("*item.Item")).Return(errors.New("database error"))

	req := BatchRequest{
		Operations: []Operation{
			{
				Operation:  OperationUpdate,
				EntityType: EntityItem,
				EntityID:   &itemID,
				Data:       json.RawMessage(`{"name":"Updated Name"}`),
			},
		},
	}

	resp, err := svc.ProcessBatch(ctx, workspaceID, req)
	assert.NoError(t, err)
	assert.Equal(t, StatusError, resp.Results[0].Status)
	assert.Equal(t, "UPDATE_FAILED", *resp.Results[0].ErrorCode)
	assert.Equal(t, 1, resp.Failed)

	mockItemRepo.AssertExpectations(t)
}

// =============================================================================
// Helper functions for tests
// =============================================================================

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

func ptrString(s string) *string {
	return &s
}

func ptrBool(b bool) *bool {
	return &b
}
