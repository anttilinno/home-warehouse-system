package batch

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// OperationType represents the type of batch operation.
type OperationType string

const (
	OperationCreate OperationType = "create"
	OperationUpdate OperationType = "update"
	OperationDelete OperationType = "delete"
)

// IsValid checks if the operation type is valid.
func (o OperationType) IsValid() bool {
	switch o {
	case OperationCreate, OperationUpdate, OperationDelete:
		return true
	}
	return false
}

// EntityType represents the type of entity being operated on.
type EntityType string

const (
	EntityItem      EntityType = "item"
	EntityLocation  EntityType = "location"
	EntityContainer EntityType = "container"
	EntityInventory EntityType = "inventory"
	EntityCategory  EntityType = "category"
	EntityLabel     EntityType = "label"
	EntityCompany   EntityType = "company"
	EntityBorrower  EntityType = "borrower"
	EntityLoan      EntityType = "loan"
)

// IsValid checks if the entity type is valid.
func (e EntityType) IsValid() bool {
	switch e {
	case EntityItem, EntityLocation, EntityContainer, EntityInventory,
		EntityCategory, EntityLabel, EntityCompany, EntityBorrower, EntityLoan:
		return true
	}
	return false
}

// Operation represents a single batch operation.
type Operation struct {
	Operation  OperationType   `json:"operation"`
	EntityType EntityType      `json:"entity_type"`
	EntityID   *uuid.UUID      `json:"entity_id,omitempty"`
	Data       json.RawMessage `json:"data,omitempty"`
	UpdatedAt  *time.Time      `json:"updated_at,omitempty"` // For conflict detection
}

// BatchRequest represents a batch of operations.
type BatchRequest struct {
	Operations []Operation `json:"operations"`
}

// ResultStatus represents the status of a batch operation result.
type ResultStatus string

const (
	StatusSuccess  ResultStatus = "success"
	StatusError    ResultStatus = "error"
	StatusConflict ResultStatus = "conflict"
	StatusSkipped  ResultStatus = "skipped"
)

// OperationResult represents the result of a single operation.
type OperationResult struct {
	Index       int              `json:"index"`
	Status      ResultStatus     `json:"status"`
	EntityID    *uuid.UUID       `json:"entity_id,omitempty"`
	Error       *string          `json:"error,omitempty"`
	ErrorCode   *string          `json:"error_code,omitempty"`
	HasConflict bool             `json:"has_conflict,omitempty"`
	ServerData  *json.RawMessage `json:"server_data,omitempty"` // Current server state on conflict
}

// BatchResponse represents the response from a batch operation.
type BatchResponse struct {
	Results   []OperationResult `json:"results"`
	Succeeded int               `json:"succeeded"`
	Failed    int               `json:"failed"`
	Conflicts int               `json:"conflicts"`
}

// ConflictInfo holds information about a detected conflict.
type ConflictInfo struct {
	EntityID        uuid.UUID   `json:"entity_id"`
	EntityType      EntityType  `json:"entity_type"`
	ClientUpdatedAt time.Time   `json:"client_updated_at"`
	ServerUpdatedAt time.Time   `json:"server_updated_at"`
	ServerData      interface{} `json:"server_data"`
}
