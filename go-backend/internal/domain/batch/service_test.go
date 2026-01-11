package batch

import (
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
// Helper functions for tests
// =============================================================================

func ptrUUID(u uuid.UUID) *uuid.UUID {
	return &u
}
