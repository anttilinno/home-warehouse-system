package movement

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the movement service operations.
type ServiceInterface interface {
	RecordMovement(ctx context.Context, input RecordMovementInput) (*InventoryMovement, error)
	ListByInventory(ctx context.Context, inventoryID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error)
	ListByLocation(ctx context.Context, locationID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error)
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type RecordMovementInput struct {
	WorkspaceID     uuid.UUID
	InventoryID     uuid.UUID
	FromLocationID  *uuid.UUID
	FromContainerID *uuid.UUID
	ToLocationID    *uuid.UUID
	ToContainerID   *uuid.UUID
	Quantity        int
	MovedBy         *uuid.UUID
	Reason          *string
}

func (s *Service) RecordMovement(ctx context.Context, input RecordMovementInput) (*InventoryMovement, error) {
	movement, err := NewInventoryMovement(
		input.WorkspaceID,
		input.InventoryID,
		input.FromLocationID,
		input.FromContainerID,
		input.ToLocationID,
		input.ToContainerID,
		input.Quantity,
		input.MovedBy,
		input.Reason,
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, movement); err != nil {
		return nil, err
	}

	return movement, nil
}

func (s *Service) ListByInventory(ctx context.Context, inventoryID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error) {
	return s.repo.FindByInventory(ctx, inventoryID, workspaceID, pagination)
}

func (s *Service) ListByLocation(ctx context.Context, locationID, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error) {
	return s.repo.FindByLocation(ctx, locationID, workspaceID, pagination)
}

func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*InventoryMovement, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, pagination)
}
