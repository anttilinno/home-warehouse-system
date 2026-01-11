package inventory

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateInput struct {
	WorkspaceID     uuid.UUID
	ItemID          uuid.UUID
	LocationID      uuid.UUID
	ContainerID     *uuid.UUID
	Quantity        int
	Condition       Condition
	Status          Status
	DateAcquired    *time.Time
	PurchasePrice   *int
	CurrencyCode    *string
	WarrantyExpires *time.Time
	ExpirationDate  *time.Time
	Notes           *string
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Inventory, error) {
	inv, err := NewInventory(
		input.WorkspaceID,
		input.ItemID,
		input.LocationID,
		input.ContainerID,
		input.Quantity,
		input.Condition,
		input.Status,
		input.CurrencyCode,
	)
	if err != nil {
		return nil, err
	}

	// Set optional fields
	inv.dateAcquired = input.DateAcquired
	inv.purchasePrice = input.PurchasePrice
	inv.warrantyExpires = input.WarrantyExpires
	inv.expirationDate = input.ExpirationDate
	inv.notes = input.Notes

	if err := s.repo.Save(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Inventory, error) {
	inv, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if inv == nil {
		return nil, ErrInventoryNotFound
	}
	return inv, nil
}

func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Inventory, error) {
	inv, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := inv.Update(input); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *Service) UpdateStatus(ctx context.Context, id, workspaceID uuid.UUID, status Status) (*Inventory, error) {
	inv, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := inv.UpdateStatus(status); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *Service) UpdateQuantity(ctx context.Context, id, workspaceID uuid.UUID, quantity int) (*Inventory, error) {
	inv, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := inv.UpdateQuantity(quantity); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *Service) Move(ctx context.Context, id, workspaceID, locationID uuid.UUID, containerID *uuid.UUID) (*Inventory, error) {
	inv, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := inv.Move(locationID, containerID); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, inv); err != nil {
		return nil, err
	}

	return inv, nil
}

func (s *Service) Archive(ctx context.Context, id, workspaceID uuid.UUID) error {
	inv, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	inv.Archive()
	return s.repo.Save(ctx, inv)
}

func (s *Service) Restore(ctx context.Context, id, workspaceID uuid.UUID) error {
	inv, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	inv.Restore()
	return s.repo.Save(ctx, inv)
}

func (s *Service) ListByItem(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*Inventory, error) {
	return s.repo.FindByItem(ctx, workspaceID, itemID)
}

func (s *Service) ListByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*Inventory, error) {
	return s.repo.FindByLocation(ctx, workspaceID, locationID)
}

func (s *Service) ListByContainer(ctx context.Context, workspaceID, containerID uuid.UUID) ([]*Inventory, error) {
	return s.repo.FindByContainer(ctx, workspaceID, containerID)
}

func (s *Service) GetAvailable(ctx context.Context, workspaceID, itemID uuid.UUID) ([]*Inventory, error) {
	return s.repo.FindAvailable(ctx, workspaceID, itemID)
}

func (s *Service) GetTotalQuantity(ctx context.Context, workspaceID, itemID uuid.UUID) (int, error) {
	return s.repo.GetTotalQuantity(ctx, workspaceID, itemID)
}
