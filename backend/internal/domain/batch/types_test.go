package batch

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// OperationType Validation Tests
// =============================================================================

func TestOperationType_IsValid(t *testing.T) {
	tests := []struct {
		name      string
		operation OperationType
		expected  bool
	}{
		{"create is valid", OperationCreate, true},
		{"update is valid", OperationUpdate, true},
		{"delete is valid", OperationDelete, true},
		{"invalid operation", OperationType("invalid"), false},
		{"empty operation", OperationType(""), false},
		{"unknown operation", OperationType("merge"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.operation.IsValid()
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
		{"item is valid", EntityItem, true},
		{"location is valid", EntityLocation, true},
		{"container is valid", EntityContainer, true},
		{"inventory is valid", EntityInventory, true},
		{"category is valid", EntityCategory, true},
		{"label is valid", EntityLabel, true},
		{"company is valid", EntityCompany, true},
		{"borrower is valid", EntityBorrower, true},
		{"loan is valid", EntityLoan, true},
		{"invalid entity type", EntityType("invalid"), false},
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

// =============================================================================
// Operation Struct Tests
// =============================================================================

func TestOperation_Structure(t *testing.T) {
	entityID := uuid.New()
	updatedAt := time.Now()
	data := json.RawMessage(`{"name":"test"}`)

	op := Operation{
		Operation:  OperationCreate,
		EntityType: EntityItem,
		EntityID:   &entityID,
		Data:       data,
		UpdatedAt:  &updatedAt,
	}

	assert.Equal(t, OperationCreate, op.Operation)
	assert.Equal(t, EntityItem, op.EntityType)
	assert.NotNil(t, op.EntityID)
	assert.Equal(t, entityID, *op.EntityID)
	assert.NotNil(t, op.Data)
	assert.NotNil(t, op.UpdatedAt)
}

func TestOperation_MinimalFields(t *testing.T) {
	op := Operation{
		Operation:  OperationDelete,
		EntityType: EntityLocation,
	}

	assert.Equal(t, OperationDelete, op.Operation)
	assert.Equal(t, EntityLocation, op.EntityType)
	assert.Nil(t, op.EntityID)
	assert.Nil(t, op.Data)
	assert.Nil(t, op.UpdatedAt)
}

func TestOperation_JSONMarshaling(t *testing.T) {
	entityID := uuid.New()
	op := Operation{
		Operation:  OperationCreate,
		EntityType: EntityItem,
		EntityID:   &entityID,
		Data:       json.RawMessage(`{"name":"item1"}`),
	}

	jsonBytes, err := json.Marshal(op)
	assert.NoError(t, err)
	assert.NotEmpty(t, jsonBytes)

	var unmarshaled Operation
	err = json.Unmarshal(jsonBytes, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, op.Operation, unmarshaled.Operation)
	assert.Equal(t, op.EntityType, unmarshaled.EntityType)
}

// =============================================================================
// BatchRequest Tests
// =============================================================================

func TestBatchRequest_SingleOperation(t *testing.T) {
	op := Operation{
		Operation:  OperationCreate,
		EntityType: EntityItem,
	}

	batch := BatchRequest{
		Operations: []Operation{op},
	}

	assert.Len(t, batch.Operations, 1)
	assert.Equal(t, OperationCreate, batch.Operations[0].Operation)
}

func TestBatchRequest_MultipleOperations(t *testing.T) {
	ops := []Operation{
		{
			Operation:  OperationCreate,
			EntityType: EntityItem,
		},
		{
			Operation:  OperationUpdate,
			EntityType: EntityLocation,
		},
		{
			Operation:  OperationDelete,
			EntityType: EntityContainer,
		},
	}

	batch := BatchRequest{
		Operations: ops,
	}

	assert.Len(t, batch.Operations, 3)
	assert.Equal(t, OperationCreate, batch.Operations[0].Operation)
	assert.Equal(t, OperationUpdate, batch.Operations[1].Operation)
	assert.Equal(t, OperationDelete, batch.Operations[2].Operation)
}

func TestBatchRequest_EmptyOperations(t *testing.T) {
	batch := BatchRequest{
		Operations: []Operation{},
	}

	assert.Len(t, batch.Operations, 0)
}

func TestBatchRequest_JSONMarshaling(t *testing.T) {
	ops := []Operation{
		{
			Operation:  OperationCreate,
			EntityType: EntityItem,
		},
	}

	batch := BatchRequest{
		Operations: ops,
	}

	jsonBytes, err := json.Marshal(batch)
	assert.NoError(t, err)
	assert.NotEmpty(t, jsonBytes)

	var unmarshaled BatchRequest
	err = json.Unmarshal(jsonBytes, &unmarshaled)
	assert.NoError(t, err)
	assert.Len(t, unmarshaled.Operations, 1)
	assert.Equal(t, OperationCreate, unmarshaled.Operations[0].Operation)
}

// =============================================================================
// ResultStatus Validation Tests
// =============================================================================

func TestResultStatus_Values(t *testing.T) {
	tests := []struct {
		name     string
		status   ResultStatus
		expected string
	}{
		{"success status", StatusSuccess, "success"},
		{"error status", StatusError, "error"},
		{"conflict status", StatusConflict, "conflict"},
		{"skipped status", StatusSkipped, "skipped"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, ResultStatus(tt.expected), tt.status)
		})
	}
}

// =============================================================================
// OperationResult Tests
// =============================================================================

func TestOperationResult_SuccessResult(t *testing.T) {
	entityID := uuid.New()

	result := OperationResult{
		Index:     0,
		Status:    StatusSuccess,
		EntityID:  &entityID,
		Error:     nil,
		ErrorCode: nil,
	}

	assert.Equal(t, 0, result.Index)
	assert.Equal(t, StatusSuccess, result.Status)
	assert.NotNil(t, result.EntityID)
	assert.Equal(t, entityID, *result.EntityID)
	assert.Nil(t, result.Error)
	assert.Nil(t, result.ErrorCode)
	assert.False(t, result.HasConflict)
}

func TestOperationResult_ErrorResult(t *testing.T) {
	errorMsg := "invalid entity"
	errorCode := "INVALID_ENTITY"

	result := OperationResult{
		Index:     1,
		Status:    StatusError,
		EntityID:  nil,
		Error:     &errorMsg,
		ErrorCode: &errorCode,
	}

	assert.Equal(t, 1, result.Index)
	assert.Equal(t, StatusError, result.Status)
	assert.Nil(t, result.EntityID)
	assert.NotNil(t, result.Error)
	assert.Equal(t, "invalid entity", *result.Error)
	assert.NotNil(t, result.ErrorCode)
	assert.Equal(t, "INVALID_ENTITY", *result.ErrorCode)
}

func TestOperationResult_ConflictResult(t *testing.T) {
	entityID := uuid.New()
	serverData := json.RawMessage(`{"name":"server version"}`)

	result := OperationResult{
		Index:      2,
		Status:     StatusConflict,
		EntityID:   &entityID,
		HasConflict: true,
		ServerData: &serverData,
	}

	assert.Equal(t, 2, result.Index)
	assert.Equal(t, StatusConflict, result.Status)
	assert.True(t, result.HasConflict)
	assert.NotNil(t, result.ServerData)
}

func TestOperationResult_SkippedResult(t *testing.T) {
	result := OperationResult{
		Index:  3,
		Status: StatusSkipped,
	}

	assert.Equal(t, 3, result.Index)
	assert.Equal(t, StatusSkipped, result.Status)
	assert.Nil(t, result.EntityID)
}

func TestOperationResult_JSONMarshaling(t *testing.T) {
	entityID := uuid.New()
	errorMsg := "test error"

	result := OperationResult{
		Index:     0,
		Status:    StatusError,
		EntityID:  &entityID,
		Error:     &errorMsg,
		ErrorCode: nil,
	}

	jsonBytes, err := json.Marshal(result)
	assert.NoError(t, err)
	assert.NotEmpty(t, jsonBytes)

	var unmarshaled OperationResult
	err = json.Unmarshal(jsonBytes, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, result.Index, unmarshaled.Index)
	assert.Equal(t, result.Status, unmarshaled.Status)
}

// =============================================================================
// BatchResponse Tests
// =============================================================================

func TestBatchResponse_AllSuccessful(t *testing.T) {
	results := []OperationResult{
		{
			Index:  0,
			Status: StatusSuccess,
		},
		{
			Index:  1,
			Status: StatusSuccess,
		},
	}

	response := BatchResponse{
		Results:   results,
		Succeeded: 2,
		Failed:    0,
		Conflicts: 0,
	}

	assert.Len(t, response.Results, 2)
	assert.Equal(t, 2, response.Succeeded)
	assert.Equal(t, 0, response.Failed)
	assert.Equal(t, 0, response.Conflicts)
}

func TestBatchResponse_MixedResults(t *testing.T) {
	errorMsg := "validation failed"
	results := []OperationResult{
		{
			Index:  0,
			Status: StatusSuccess,
		},
		{
			Index:     1,
			Status:    StatusError,
			Error:     &errorMsg,
			ErrorCode: nil,
		},
		{
			Index:       2,
			Status:      StatusConflict,
			HasConflict: true,
		},
	}

	response := BatchResponse{
		Results:   results,
		Succeeded: 1,
		Failed:    1,
		Conflicts: 1,
	}

	assert.Len(t, response.Results, 3)
	assert.Equal(t, 1, response.Succeeded)
	assert.Equal(t, 1, response.Failed)
	assert.Equal(t, 1, response.Conflicts)
}

func TestBatchResponse_AllFailed(t *testing.T) {
	errorMsg := "unknown entity type"
	results := []OperationResult{
		{
			Index:     0,
			Status:    StatusError,
			Error:     &errorMsg,
			ErrorCode: nil,
		},
		{
			Index:     1,
			Status:    StatusError,
			Error:     &errorMsg,
			ErrorCode: nil,
		},
	}

	response := BatchResponse{
		Results:   results,
		Succeeded: 0,
		Failed:    2,
		Conflicts: 0,
	}

	assert.Len(t, response.Results, 2)
	assert.Equal(t, 0, response.Succeeded)
	assert.Equal(t, 2, response.Failed)
	assert.Equal(t, 0, response.Conflicts)
}

func TestBatchResponse_JSONMarshaling(t *testing.T) {
	results := []OperationResult{
		{
			Index:  0,
			Status: StatusSuccess,
		},
	}

	response := BatchResponse{
		Results:   results,
		Succeeded: 1,
		Failed:    0,
		Conflicts: 0,
	}

	jsonBytes, err := json.Marshal(response)
	assert.NoError(t, err)
	assert.NotEmpty(t, jsonBytes)

	var unmarshaled BatchResponse
	err = json.Unmarshal(jsonBytes, &unmarshaled)
	assert.NoError(t, err)
	assert.Equal(t, response.Succeeded, unmarshaled.Succeeded)
	assert.Equal(t, response.Failed, unmarshaled.Failed)
	assert.Equal(t, response.Conflicts, unmarshaled.Conflicts)
}

// =============================================================================
// ConflictInfo Tests
// =============================================================================

func TestConflictInfo_Structure(t *testing.T) {
	entityID := uuid.New()
	clientUpdated := time.Now().Add(-1 * time.Hour)
	serverUpdated := time.Now()

	conflict := ConflictInfo{
		EntityID:        entityID,
		EntityType:      EntityItem,
		ClientUpdatedAt: clientUpdated,
		ServerUpdatedAt: serverUpdated,
		ServerData: map[string]interface{}{
			"name": "server version",
		},
	}

	assert.Equal(t, entityID, conflict.EntityID)
	assert.Equal(t, EntityItem, conflict.EntityType)
	assert.Equal(t, clientUpdated, conflict.ClientUpdatedAt)
	assert.Equal(t, serverUpdated, conflict.ServerUpdatedAt)
	assert.NotNil(t, conflict.ServerData)
}

func TestConflictInfo_TimestampOrdering(t *testing.T) {
	entityID := uuid.New()
	clientUpdated := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	serverUpdated := time.Date(2026, 3, 10, 14, 30, 0, 0, time.UTC)

	conflict := ConflictInfo{
		EntityID:        entityID,
		EntityType:      EntityLocation,
		ClientUpdatedAt: clientUpdated,
		ServerUpdatedAt: serverUpdated,
		ServerData:      nil,
	}

	assert.True(t, conflict.ClientUpdatedAt.Before(conflict.ServerUpdatedAt))
}

// =============================================================================
// Edge Cases and Boundary Tests
// =============================================================================

func TestOperation_WithoutOptionalFields(t *testing.T) {
	op := Operation{
		Operation:  OperationCreate,
		EntityType: EntityCategory,
		EntityID:   nil,
		Data:       nil,
		UpdatedAt:  nil,
	}

	assert.NotNil(t, op)
	assert.Nil(t, op.EntityID)
	assert.Nil(t, op.Data)
	assert.Nil(t, op.UpdatedAt)
}

func TestBatchRequest_LargeOperationSet(t *testing.T) {
	ops := make([]Operation, 100)
	for i := 0; i < 100; i++ {
		ops[i] = Operation{
			Operation:  OperationCreate,
			EntityType: EntityItem,
		}
	}

	batch := BatchRequest{
		Operations: ops,
	}

	assert.Len(t, batch.Operations, 100)
}

func TestOperationResult_WithAllNilOptionals(t *testing.T) {
	result := OperationResult{
		Index:       0,
		Status:      StatusSuccess,
		EntityID:    nil,
		Error:       nil,
		ErrorCode:   nil,
		HasConflict: false,
		ServerData:  nil,
	}

	assert.Nil(t, result.EntityID)
	assert.Nil(t, result.Error)
	assert.Nil(t, result.ErrorCode)
	assert.Nil(t, result.ServerData)
}

func TestBatchResponse_EmptyResults(t *testing.T) {
	response := BatchResponse{
		Results:   []OperationResult{},
		Succeeded: 0,
		Failed:    0,
		Conflicts: 0,
	}

	assert.Len(t, response.Results, 0)
	assert.Equal(t, 0, response.Succeeded)
}
