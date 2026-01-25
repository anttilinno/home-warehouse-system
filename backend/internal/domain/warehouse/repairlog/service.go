package repairlog

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the repair log service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*RepairLog, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairLog, error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*RepairLog, error)
	StartRepair(ctx context.Context, id, workspaceID uuid.UUID) (*RepairLog, error)
	Complete(ctx context.Context, id, workspaceID uuid.UUID, newCondition *string) (*RepairLog, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*RepairLog, error)
	ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*RepairLog, int, error)
	ListByStatus(ctx context.Context, workspaceID uuid.UUID, status RepairStatus, pagination shared.Pagination) ([]*RepairLog, error)
	SetWarrantyClaim(ctx context.Context, id, workspaceID uuid.UUID, isWarrantyClaim bool) (*RepairLog, error)
	SetReminderDate(ctx context.Context, id, workspaceID uuid.UUID, reminderDate *time.Time) (*RepairLog, error)
	GetTotalRepairCost(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]RepairCostSummary, error)
}

// Service implements repair log business logic.
type Service struct {
	repo          Repository
	inventoryRepo inventory.Repository
}

// NewService creates a new repair log service.
func NewService(repo Repository, inventoryRepo inventory.Repository) *Service {
	return &Service{
		repo:          repo,
		inventoryRepo: inventoryRepo,
	}
}

// CreateInput contains the data needed to create a repair log.
type CreateInput struct {
	WorkspaceID     uuid.UUID
	InventoryID     uuid.UUID
	Description     string
	RepairDate      *time.Time
	Cost            *int
	CurrencyCode    *string
	ServiceProvider *string
	Notes           *string
	IsWarrantyClaim bool
	ReminderDate    *time.Time
}

// UpdateInput contains the data for updating a repair log.
type UpdateInput struct {
	Description     *string
	RepairDate      *time.Time
	Cost            *int
	CurrencyCode    *string
	ServiceProvider *string
	Notes           *string
}

// Create creates a new repair log.
func (s *Service) Create(ctx context.Context, input CreateInput) (*RepairLog, error) {
	// Validate inventory exists
	_, err := s.inventoryRepo.FindByID(ctx, input.InventoryID, input.WorkspaceID)
	if err != nil {
		return nil, err
	}

	// Create new repair log entity
	repairLog, err := NewRepairLog(
		input.WorkspaceID,
		input.InventoryID,
		input.Description,
		input.RepairDate,
		input.Cost,
		input.CurrencyCode,
		input.ServiceProvider,
		input.Notes,
		input.IsWarrantyClaim,
		input.ReminderDate,
	)
	if err != nil {
		return nil, err
	}

	// Save to repository
	if err := s.repo.Save(ctx, repairLog); err != nil {
		return nil, err
	}

	return repairLog, nil
}

// GetByID retrieves a repair log by ID.
func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*RepairLog, error) {
	repairLog, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	return repairLog, nil
}

// Update updates repair log details.
func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*RepairLog, error) {
	repairLog, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	// Build update values, keeping existing values if not provided
	description := repairLog.Description()
	if input.Description != nil {
		description = *input.Description
	}

	repairDate := repairLog.RepairDate()
	if input.RepairDate != nil {
		repairDate = input.RepairDate
	}

	cost := repairLog.Cost()
	if input.Cost != nil {
		cost = input.Cost
	}

	currencyCode := repairLog.CurrencyCode()
	if input.CurrencyCode != nil {
		currencyCode = input.CurrencyCode
	}

	serviceProvider := repairLog.ServiceProvider()
	if input.ServiceProvider != nil {
		serviceProvider = input.ServiceProvider
	}

	notes := repairLog.Notes()
	if input.Notes != nil {
		notes = input.Notes
	}

	// Update entity
	if err := repairLog.UpdateDetails(
		description,
		repairDate,
		cost,
		currencyCode,
		serviceProvider,
		notes,
	); err != nil {
		return nil, err
	}

	// Save changes
	if err := s.repo.Save(ctx, repairLog); err != nil {
		return nil, err
	}

	return repairLog, nil
}

// StartRepair transitions a repair from PENDING to IN_PROGRESS.
func (s *Service) StartRepair(ctx context.Context, id, workspaceID uuid.UUID) (*RepairLog, error) {
	repairLog, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := repairLog.StartRepair(); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, repairLog); err != nil {
		return nil, err
	}

	return repairLog, nil
}

// Complete transitions a repair from IN_PROGRESS to COMPLETED.
// If newCondition is provided, updates the inventory's condition.
func (s *Service) Complete(ctx context.Context, id, workspaceID uuid.UUID, newCondition *string) (*RepairLog, error) {
	repairLog, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := repairLog.Complete(newCondition); err != nil {
		return nil, err
	}

	// If new condition is provided, update inventory condition
	if newCondition != nil {
		inv, err := s.inventoryRepo.FindByID(ctx, repairLog.InventoryID(), workspaceID)
		if err != nil {
			return nil, err
		}

		// Get current inventory values for update
		updateInput := inventory.UpdateInput{
			LocationID:      inv.LocationID(),
			ContainerID:     inv.ContainerID(),
			Quantity:        inv.Quantity(),
			Condition:       inventory.Condition(*newCondition),
			DateAcquired:    inv.DateAcquired(),
			PurchasePrice:   inv.PurchasePrice(),
			CurrencyCode:    inv.CurrencyCode(),
			WarrantyExpires: inv.WarrantyExpires(),
			ExpirationDate:  inv.ExpirationDate(),
			Notes:           inv.Notes(),
		}

		if err := inv.Update(updateInput); err != nil {
			return nil, err
		}

		if err := s.inventoryRepo.Save(ctx, inv); err != nil {
			return nil, err
		}
	}

	// Save repair log
	if err := s.repo.Save(ctx, repairLog); err != nil {
		return nil, err
	}

	return repairLog, nil
}

// Delete removes a repair log.
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	// Verify repair log exists
	_, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return err
	}

	return s.repo.Delete(ctx, id)
}

// ListByInventory returns all repair logs for an inventory item.
func (s *Service) ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*RepairLog, error) {
	return s.repo.FindByInventory(ctx, workspaceID, inventoryID)
}

// ListByWorkspace returns repair logs for a workspace with pagination.
func (s *Service) ListByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*RepairLog, int, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, pagination)
}

// ListByStatus returns repair logs filtered by status.
func (s *Service) ListByStatus(ctx context.Context, workspaceID uuid.UUID, status RepairStatus, pagination shared.Pagination) ([]*RepairLog, error) {
	return s.repo.FindByStatus(ctx, workspaceID, status, pagination)
}

// SetWarrantyClaim sets whether the repair was covered under warranty.
func (s *Service) SetWarrantyClaim(ctx context.Context, id, workspaceID uuid.UUID, isWarrantyClaim bool) (*RepairLog, error) {
	repairLog, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := repairLog.SetWarrantyClaim(isWarrantyClaim); err != nil {
		return nil, err
	}

	if err := s.repo.UpdateWarrantyClaim(ctx, id, workspaceID, isWarrantyClaim); err != nil {
		return nil, err
	}

	return repairLog, nil
}

// SetReminderDate sets the reminder date for future maintenance notification.
func (s *Service) SetReminderDate(ctx context.Context, id, workspaceID uuid.UUID, reminderDate *time.Time) (*RepairLog, error) {
	repairLog, err := s.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if err := repairLog.SetReminderDate(reminderDate); err != nil {
		return nil, err
	}

	if err := s.repo.UpdateReminderDate(ctx, id, workspaceID, reminderDate); err != nil {
		return nil, err
	}

	return repairLog, nil
}

// GetTotalRepairCost returns the total repair cost summary for an inventory item.
func (s *Service) GetTotalRepairCost(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]RepairCostSummary, error) {
	return s.repo.GetTotalRepairCost(ctx, workspaceID, inventoryID)
}
