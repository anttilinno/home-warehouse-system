package batch

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/company"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
)

// ServiceInterface defines the interface for batch service operations
type ServiceInterface interface {
	ProcessBatch(ctx context.Context, workspaceID uuid.UUID, req BatchRequest) (*BatchResponse, error)
}

// Service handles batch operations with optimistic locking.
type Service struct {
	itemSvc      *item.Service
	locationSvc  *location.Service
	containerSvc *container.Service
	inventorySvc *inventory.Service
	categorySvc  *category.Service
	labelSvc     *label.Service
	companySvc   *company.Service
}

// NewService creates a new batch service.
func NewService(
	itemSvc *item.Service,
	locationSvc *location.Service,
	containerSvc *container.Service,
	inventorySvc *inventory.Service,
	categorySvc *category.Service,
	labelSvc *label.Service,
	companySvc *company.Service,
) *Service {
	return &Service{
		itemSvc:      itemSvc,
		locationSvc:  locationSvc,
		containerSvc: containerSvc,
		inventorySvc: inventorySvc,
		categorySvc:  categorySvc,
		labelSvc:     labelSvc,
		companySvc:   companySvc,
	}
}

// ProcessBatch processes a batch of operations with conflict detection.
func (s *Service) ProcessBatch(ctx context.Context, workspaceID uuid.UUID, req BatchRequest) (*BatchResponse, error) {
	response := &BatchResponse{
		Results: make([]OperationResult, len(req.Operations)),
	}

	for i, op := range req.Operations {
		result := s.processOperation(ctx, workspaceID, i, op)
		response.Results[i] = result

		switch result.Status {
		case StatusSuccess:
			response.Succeeded++
		case StatusError:
			response.Failed++
		case StatusConflict:
			response.Conflicts++
		}
	}

	return response, nil
}

// processOperation processes a single operation.
func (s *Service) processOperation(ctx context.Context, workspaceID uuid.UUID, index int, op Operation) OperationResult {
	// Validate operation
	if !op.Operation.IsValid() {
		errMsg := fmt.Sprintf("invalid operation type: %s", op.Operation)
		return OperationResult{
			Index:     index,
			Status:    StatusError,
			Error:     &errMsg,
			ErrorCode: stringPtr("INVALID_OPERATION"),
		}
	}

	if !op.EntityType.IsValid() {
		errMsg := fmt.Sprintf("invalid entity type: %s", op.EntityType)
		return OperationResult{
			Index:     index,
			Status:    StatusError,
			Error:     &errMsg,
			ErrorCode: stringPtr("INVALID_ENTITY_TYPE"),
		}
	}

	// Process based on entity type
	switch op.EntityType {
	case EntityItem:
		return s.processItemOperation(ctx, workspaceID, index, op)
	case EntityLocation:
		return s.processLocationOperation(ctx, workspaceID, index, op)
	case EntityContainer:
		return s.processContainerOperation(ctx, workspaceID, index, op)
	case EntityCategory:
		return s.processCategoryOperation(ctx, workspaceID, index, op)
	case EntityLabel:
		return s.processLabelOperation(ctx, workspaceID, index, op)
	case EntityCompany:
		return s.processCompanyOperation(ctx, workspaceID, index, op)
	default:
		errMsg := fmt.Sprintf("entity type %s not yet supported for batch operations", op.EntityType)
		return OperationResult{
			Index:     index,
			Status:    StatusError,
			Error:     &errMsg,
			ErrorCode: stringPtr("UNSUPPORTED_ENTITY"),
		}
	}
}

// processItemOperation handles item batch operations.
func (s *Service) processItemOperation(ctx context.Context, workspaceID uuid.UUID, index int, op Operation) OperationResult {
	switch op.Operation {
	case OperationUpdate:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for update", "MISSING_ENTITY_ID")
		}

		// Check for conflict
		existing, err := s.itemSvc.GetByID(ctx, *op.EntityID, workspaceID)
		if err != nil {
			return errorResult(index, err.Error(), "NOT_FOUND")
		}

		if op.UpdatedAt != nil && existing.UpdatedAt().After(*op.UpdatedAt) {
			serverData := marshalEntity(existing)
			return conflictResult(index, op.EntityID, serverData)
		}

		// Parse update data
		var updateData item.UpdateInput
		if err := json.Unmarshal(op.Data, &updateData); err != nil {
			return errorResult(index, "invalid update data", "INVALID_DATA")
		}

		// Apply update
		updated, err := s.itemSvc.Update(ctx, *op.EntityID, workspaceID, updateData)
		if err != nil {
			return errorResult(index, err.Error(), "UPDATE_FAILED")
		}

		id := updated.ID()
		return successResult(index, &id)

	case OperationDelete:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for delete", "MISSING_ENTITY_ID")
		}

		if err := s.itemSvc.Archive(ctx, *op.EntityID, workspaceID); err != nil {
			return errorResult(index, err.Error(), "DELETE_FAILED")
		}

		return successResult(index, op.EntityID)

	default:
		return errorResult(index, "create not supported in batch for items", "UNSUPPORTED_OPERATION")
	}
}

// processLocationOperation handles location batch operations.
func (s *Service) processLocationOperation(ctx context.Context, workspaceID uuid.UUID, index int, op Operation) OperationResult {
	switch op.Operation {
	case OperationUpdate:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for update", "MISSING_ENTITY_ID")
		}

		existing, err := s.locationSvc.GetByID(ctx, *op.EntityID, workspaceID)
		if err != nil {
			return errorResult(index, err.Error(), "NOT_FOUND")
		}

		if op.UpdatedAt != nil && existing.UpdatedAt().After(*op.UpdatedAt) {
			serverData := marshalEntity(existing)
			return conflictResult(index, op.EntityID, serverData)
		}

		var updateData location.UpdateInput
		if err := json.Unmarshal(op.Data, &updateData); err != nil {
			return errorResult(index, "invalid update data", "INVALID_DATA")
		}

		updated, err := s.locationSvc.Update(ctx, *op.EntityID, workspaceID, updateData)
		if err != nil {
			return errorResult(index, err.Error(), "UPDATE_FAILED")
		}

		id := updated.ID()
		return successResult(index, &id)

	case OperationDelete:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for delete", "MISSING_ENTITY_ID")
		}

		if err := s.locationSvc.Archive(ctx, *op.EntityID, workspaceID); err != nil {
			return errorResult(index, err.Error(), "DELETE_FAILED")
		}

		return successResult(index, op.EntityID)

	default:
		return errorResult(index, "create not supported in batch for locations", "UNSUPPORTED_OPERATION")
	}
}

// processContainerOperation handles container batch operations.
func (s *Service) processContainerOperation(ctx context.Context, workspaceID uuid.UUID, index int, op Operation) OperationResult {
	switch op.Operation {
	case OperationUpdate:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for update", "MISSING_ENTITY_ID")
		}

		existing, err := s.containerSvc.GetByID(ctx, *op.EntityID, workspaceID)
		if err != nil {
			return errorResult(index, err.Error(), "NOT_FOUND")
		}

		if op.UpdatedAt != nil && existing.UpdatedAt().After(*op.UpdatedAt) {
			serverData := marshalEntity(existing)
			return conflictResult(index, op.EntityID, serverData)
		}

		var updateData container.UpdateInput
		if err := json.Unmarshal(op.Data, &updateData); err != nil {
			return errorResult(index, "invalid update data", "INVALID_DATA")
		}

		updated, err := s.containerSvc.Update(ctx, *op.EntityID, workspaceID, updateData)
		if err != nil {
			return errorResult(index, err.Error(), "UPDATE_FAILED")
		}

		id := updated.ID()
		return successResult(index, &id)

	case OperationDelete:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for delete", "MISSING_ENTITY_ID")
		}

		if err := s.containerSvc.Archive(ctx, *op.EntityID, workspaceID); err != nil {
			return errorResult(index, err.Error(), "DELETE_FAILED")
		}

		return successResult(index, op.EntityID)

	default:
		return errorResult(index, "create not supported in batch for containers", "UNSUPPORTED_OPERATION")
	}
}

// processCategoryOperation handles category batch operations.
func (s *Service) processCategoryOperation(ctx context.Context, workspaceID uuid.UUID, index int, op Operation) OperationResult {
	switch op.Operation {
	case OperationUpdate:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for update", "MISSING_ENTITY_ID")
		}

		existing, err := s.categorySvc.GetByID(ctx, *op.EntityID, workspaceID)
		if err != nil {
			return errorResult(index, err.Error(), "NOT_FOUND")
		}

		if op.UpdatedAt != nil && existing.UpdatedAt().After(*op.UpdatedAt) {
			serverData := marshalEntity(existing)
			return conflictResult(index, op.EntityID, serverData)
		}

		var updateData category.UpdateInput
		if err := json.Unmarshal(op.Data, &updateData); err != nil {
			return errorResult(index, "invalid update data", "INVALID_DATA")
		}

		updated, err := s.categorySvc.Update(ctx, *op.EntityID, workspaceID, updateData)
		if err != nil {
			return errorResult(index, err.Error(), "UPDATE_FAILED")
		}

		id := updated.ID()
		return successResult(index, &id)

	case OperationDelete:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for delete", "MISSING_ENTITY_ID")
		}

		if err := s.categorySvc.Archive(ctx, *op.EntityID, workspaceID); err != nil {
			return errorResult(index, err.Error(), "DELETE_FAILED")
		}

		return successResult(index, op.EntityID)

	default:
		return errorResult(index, "create not supported in batch for categories", "UNSUPPORTED_OPERATION")
	}
}

// processLabelOperation handles label batch operations.
func (s *Service) processLabelOperation(ctx context.Context, workspaceID uuid.UUID, index int, op Operation) OperationResult {
	switch op.Operation {
	case OperationUpdate:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for update", "MISSING_ENTITY_ID")
		}

		existing, err := s.labelSvc.GetByID(ctx, *op.EntityID, workspaceID)
		if err != nil {
			return errorResult(index, err.Error(), "NOT_FOUND")
		}

		if op.UpdatedAt != nil && existing.UpdatedAt().After(*op.UpdatedAt) {
			serverData := marshalEntity(existing)
			return conflictResult(index, op.EntityID, serverData)
		}

		var updateData label.UpdateInput
		if err := json.Unmarshal(op.Data, &updateData); err != nil {
			return errorResult(index, "invalid update data", "INVALID_DATA")
		}

		updated, err := s.labelSvc.Update(ctx, *op.EntityID, workspaceID, updateData)
		if err != nil {
			return errorResult(index, err.Error(), "UPDATE_FAILED")
		}

		id := updated.ID()
		return successResult(index, &id)

	case OperationDelete:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for delete", "MISSING_ENTITY_ID")
		}

		if err := s.labelSvc.Archive(ctx, *op.EntityID, workspaceID); err != nil {
			return errorResult(index, err.Error(), "DELETE_FAILED")
		}

		return successResult(index, op.EntityID)

	default:
		return errorResult(index, "create not supported in batch for labels", "UNSUPPORTED_OPERATION")
	}
}

// processCompanyOperation handles company batch operations.
func (s *Service) processCompanyOperation(ctx context.Context, workspaceID uuid.UUID, index int, op Operation) OperationResult {
	switch op.Operation {
	case OperationUpdate:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for update", "MISSING_ENTITY_ID")
		}

		existing, err := s.companySvc.GetByID(ctx, *op.EntityID, workspaceID)
		if err != nil {
			return errorResult(index, err.Error(), "NOT_FOUND")
		}

		if op.UpdatedAt != nil && existing.UpdatedAt().After(*op.UpdatedAt) {
			serverData := marshalEntity(existing)
			return conflictResult(index, op.EntityID, serverData)
		}

		var updateData company.UpdateInput
		if err := json.Unmarshal(op.Data, &updateData); err != nil {
			return errorResult(index, "invalid update data", "INVALID_DATA")
		}

		updated, err := s.companySvc.Update(ctx, *op.EntityID, workspaceID, updateData)
		if err != nil {
			return errorResult(index, err.Error(), "UPDATE_FAILED")
		}

		id := updated.ID()
		return successResult(index, &id)

	case OperationDelete:
		if op.EntityID == nil {
			return errorResult(index, "entity_id required for delete", "MISSING_ENTITY_ID")
		}

		if err := s.companySvc.Archive(ctx, *op.EntityID, workspaceID); err != nil {
			return errorResult(index, err.Error(), "DELETE_FAILED")
		}

		return successResult(index, op.EntityID)

	default:
		return errorResult(index, "create not supported in batch for companies", "UNSUPPORTED_OPERATION")
	}
}

// Helper functions

func successResult(index int, entityID *uuid.UUID) OperationResult {
	return OperationResult{
		Index:    index,
		Status:   StatusSuccess,
		EntityID: entityID,
	}
}

func errorResult(index int, message, code string) OperationResult {
	return OperationResult{
		Index:     index,
		Status:    StatusError,
		Error:     &message,
		ErrorCode: &code,
	}
}

func conflictResult(index int, entityID *uuid.UUID, serverData *json.RawMessage) OperationResult {
	return OperationResult{
		Index:       index,
		Status:      StatusConflict,
		EntityID:    entityID,
		HasConflict: true,
		ServerData:  serverData,
	}
}

func marshalEntity(entity interface{}) *json.RawMessage {
	data, err := json.Marshal(entity)
	if err != nil {
		return nil
	}
	raw := json.RawMessage(data)
	return &raw
}

func stringPtr(s string) *string {
	return &s
}

// CheckConflict checks if there's a conflict between client and server timestamps.
func CheckConflict(clientUpdatedAt, serverUpdatedAt time.Time) bool {
	return serverUpdatedAt.After(clientUpdatedAt)
}
