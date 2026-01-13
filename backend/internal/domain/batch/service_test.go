package batch

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
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

func TestStringPtr(t *testing.T) {
	result := stringPtr("test")
	assert.NotNil(t, result)
	assert.Equal(t, "test", *result)
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

func TestMarshalEntity_WithInvalidData(t *testing.T) {
	// Test with nil pointer - should handle gracefully
	result := marshalEntity(nil)
	// nil input should still produce valid JSON ("null")
	assert.NotNil(t, result)
}

// =============================================================================
// Helper functions for tests
// =============================================================================

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

