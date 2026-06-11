package maintenance

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// ServiceInterface defines the maintenance schedule service operations.
type ServiceInterface interface {
	Create(ctx context.Context, input CreateInput) (*Schedule, error)
	GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Schedule, error)
	Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Schedule, error)
	Delete(ctx context.Context, id, workspaceID uuid.UUID) error
	List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Schedule, int, error)
	ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Schedule, error)
	ListDue(ctx context.Context, workspaceID uuid.UUID, withinDays int) ([]DueSchedule, error)
	// Complete records a maintenance completion: creates a COMPLETED
	// repair_logs row, sets last_completed_at and advances next_due — all in
	// one transaction.
	Complete(ctx context.Context, id, workspaceID uuid.UUID, notes *string) (*Schedule, error)
}

// Transactor runs a function inside a single database transaction. It is a
// port implemented by infra/postgres.TxManager — same convention as the loan
// and pendingchange domains, keeping this package free of infra imports.
type Transactor interface {
	WithTx(ctx context.Context, fn func(context.Context) error) error
}

// noopTransactor executes the function without a surrounding transaction. It
// is the fallback when no Transactor is wired (unit tests with mocked
// repositories).
type noopTransactor struct{}

func (noopTransactor) WithTx(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

// Service implements maintenance schedule business logic.
type Service struct {
	repo          Repository
	inventoryRepo inventory.Repository
	tx            Transactor
}

// NewService creates a maintenance service. tx may be nil (falls back to a
// non-transactional no-op — acceptable only for unit tests with mocks).
func NewService(repo Repository, inventoryRepo inventory.Repository, tx Transactor) *Service {
	if tx == nil {
		tx = noopTransactor{}
	}
	return &Service{
		repo:          repo,
		inventoryRepo: inventoryRepo,
		tx:            tx,
	}
}

// CreateInput contains the data needed to create a maintenance schedule.
type CreateInput struct {
	WorkspaceID  uuid.UUID
	InventoryID  uuid.UUID
	Title        string
	Notes        *string
	IntervalDays int
	NextDue      time.Time
}

// UpdateInput contains the data for a partial schedule update. Nil pointers
// mean "unchanged".
type UpdateInput struct {
	Title        *string
	Notes        *string
	IntervalDays *int
	NextDue      *time.Time
	IsActive     *bool
}

// Create creates a new maintenance schedule after validating the inventory
// entry exists in the workspace.
func (s *Service) Create(ctx context.Context, input CreateInput) (*Schedule, error) {
	if _, err := s.inventoryRepo.FindByID(ctx, input.InventoryID, input.WorkspaceID); err != nil {
		return nil, err
	}

	schedule, err := NewSchedule(
		input.WorkspaceID,
		input.InventoryID,
		input.Title,
		input.Notes,
		input.IntervalDays,
		input.NextDue,
	)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, schedule); err != nil {
		return nil, err
	}
	return schedule, nil
}

// GetByID retrieves a schedule by ID.
func (s *Service) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*Schedule, error) {
	return s.repo.FindByID(ctx, id, workspaceID)
}

// Update applies a partial update to a schedule.
func (s *Service) Update(ctx context.Context, id, workspaceID uuid.UUID, input UpdateInput) (*Schedule, error) {
	schedule, err := s.repo.FindByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}

	title := schedule.Title()
	if input.Title != nil {
		title = *input.Title
	}
	notes := schedule.Notes()
	if input.Notes != nil {
		notes = input.Notes
	}
	intervalDays := schedule.IntervalDays()
	if input.IntervalDays != nil {
		intervalDays = *input.IntervalDays
	}
	nextDue := schedule.NextDue()
	if input.NextDue != nil {
		nextDue = *input.NextDue
	}
	isActive := schedule.IsActive()
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	if err := schedule.UpdateDetails(title, notes, intervalDays, nextDue, isActive); err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, schedule); err != nil {
		return nil, err
	}
	return schedule, nil
}

// Delete removes a schedule.
func (s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	if _, err := s.repo.FindByID(ctx, id, workspaceID); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id, workspaceID)
}

// List returns schedules for a workspace with pagination.
func (s *Service) List(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*Schedule, int, error) {
	return s.repo.FindByWorkspace(ctx, workspaceID, pagination)
}

// ListByInventory returns all schedules for an inventory entry.
func (s *Service) ListByInventory(ctx context.Context, workspaceID, inventoryID uuid.UUID) ([]*Schedule, error) {
	return s.repo.FindByInventory(ctx, workspaceID, inventoryID)
}

// ListDue returns active schedules due within the next withinDays days,
// overdue ones included.
func (s *Service) ListDue(ctx context.Context, workspaceID uuid.UUID, withinDays int) ([]DueSchedule, error) {
	return s.repo.FindDue(ctx, workspaceID, time.Now().AddDate(0, 0, withinDays))
}

// Complete records a maintenance completion in one transaction:
//
//  1. a COMPLETED repair_logs row is created (the maintenance history lives
//     in the repair log, feeding total-cost-of-ownership views), and
//  2. the schedule's last_completed_at is set and next_due advanced
//     (max(today, next_due + interval) — see Schedule.Complete for the
//     overdue catch-up semantics).
//
// If either write fails the transaction rolls back and the schedule is left
// untouched.
func (s *Service) Complete(ctx context.Context, id, workspaceID uuid.UUID, notes *string) (*Schedule, error) {
	var schedule *Schedule
	err := s.tx.WithTx(ctx, func(ctx context.Context) error {
		var err error
		schedule, err = s.repo.FindByID(ctx, id, workspaceID)
		if err != nil {
			return err
		}
		if !schedule.IsActive() {
			return ErrScheduleInactive
		}

		description := fmt.Sprintf("Maintenance: %s", schedule.Title())
		if err := s.repo.CreateCompletionRepairLog(ctx, workspaceID, schedule.InventoryID(), description, notes); err != nil {
			return err
		}

		schedule.Complete(time.Now())
		return s.repo.Save(ctx, schedule)
	})
	if err != nil {
		return nil, err
	}
	return schedule, nil
}
