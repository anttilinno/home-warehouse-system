package repairlog

import (
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RepairStatus represents the status of a repair log.
type RepairStatus string

const (
	// StatusPending indicates the repair is pending/scheduled.
	StatusPending RepairStatus = "PENDING"
	// StatusInProgress indicates the repair is currently in progress.
	StatusInProgress RepairStatus = "IN_PROGRESS"
	// StatusCompleted indicates the repair has been completed.
	StatusCompleted RepairStatus = "COMPLETED"
)

// RepairLog represents a repair record for an inventory item.
type RepairLog struct {
	id              uuid.UUID
	workspaceID     uuid.UUID
	inventoryID     uuid.UUID
	status          RepairStatus
	description     string
	repairDate      *time.Time
	cost            *int // cents
	currencyCode    *string
	serviceProvider *string
	completedAt     *time.Time
	newCondition    *string
	notes           *string
	createdAt       time.Time
	updatedAt       time.Time
}

// NewRepairLog creates a new repair log with default status PENDING.
func NewRepairLog(
	workspaceID, inventoryID uuid.UUID,
	description string,
	repairDate *time.Time,
	cost *int,
	currencyCode *string,
	serviceProvider *string,
	notes *string,
) (*RepairLog, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(inventoryID, "inventory_id"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(description) == "" {
		return nil, ErrInvalidDescription
	}

	now := time.Now()
	return &RepairLog{
		id:              shared.NewUUID(),
		workspaceID:     workspaceID,
		inventoryID:     inventoryID,
		status:          StatusPending,
		description:     description,
		repairDate:      repairDate,
		cost:            cost,
		currencyCode:    currencyCode,
		serviceProvider: serviceProvider,
		completedAt:     nil,
		newCondition:    nil,
		notes:           notes,
		createdAt:       now,
		updatedAt:       now,
	}, nil
}

// Reconstruct creates a RepairLog from database values without validation.
// Used when loading from the database.
func Reconstruct(
	id, workspaceID, inventoryID uuid.UUID,
	status RepairStatus,
	description string,
	repairDate *time.Time,
	cost *int,
	currencyCode *string,
	serviceProvider *string,
	completedAt *time.Time,
	newCondition *string,
	notes *string,
	createdAt, updatedAt time.Time,
) *RepairLog {
	return &RepairLog{
		id:              id,
		workspaceID:     workspaceID,
		inventoryID:     inventoryID,
		status:          status,
		description:     description,
		repairDate:      repairDate,
		cost:            cost,
		currencyCode:    currencyCode,
		serviceProvider: serviceProvider,
		completedAt:     completedAt,
		newCondition:    newCondition,
		notes:           notes,
		createdAt:       createdAt,
		updatedAt:       updatedAt,
	}
}

// Getters

// ID returns the repair log's unique identifier.
func (r *RepairLog) ID() uuid.UUID { return r.id }

// WorkspaceID returns the workspace this repair log belongs to.
func (r *RepairLog) WorkspaceID() uuid.UUID { return r.workspaceID }

// InventoryID returns the inventory item being repaired.
func (r *RepairLog) InventoryID() uuid.UUID { return r.inventoryID }

// Status returns the current status of the repair.
func (r *RepairLog) Status() RepairStatus { return r.status }

// Description returns the repair description.
func (r *RepairLog) Description() string { return r.description }

// RepairDate returns the scheduled or actual repair date.
func (r *RepairLog) RepairDate() *time.Time { return r.repairDate }

// Cost returns the repair cost in cents.
func (r *RepairLog) Cost() *int { return r.cost }

// CurrencyCode returns the currency code for the cost.
func (r *RepairLog) CurrencyCode() *string { return r.currencyCode }

// ServiceProvider returns the name of the service provider.
func (r *RepairLog) ServiceProvider() *string { return r.serviceProvider }

// CompletedAt returns the completion timestamp.
func (r *RepairLog) CompletedAt() *time.Time { return r.completedAt }

// NewCondition returns the condition to set on inventory when completed.
func (r *RepairLog) NewCondition() *string { return r.newCondition }

// Notes returns additional notes about the repair.
func (r *RepairLog) Notes() *string { return r.notes }

// CreatedAt returns the creation timestamp.
func (r *RepairLog) CreatedAt() time.Time { return r.createdAt }

// UpdatedAt returns the last update timestamp.
func (r *RepairLog) UpdatedAt() time.Time { return r.updatedAt }

// Status transition methods

// StartRepair transitions the repair from PENDING to IN_PROGRESS.
func (r *RepairLog) StartRepair() error {
	if r.status != StatusPending {
		return ErrInvalidStatusTransition
	}
	r.status = StatusInProgress
	r.updatedAt = time.Now()
	return nil
}

// Complete transitions the repair from IN_PROGRESS to COMPLETED.
// Optionally sets a new condition for the inventory item.
func (r *RepairLog) Complete(newCondition *string) error {
	if r.status != StatusInProgress {
		return ErrInvalidStatusTransition
	}
	r.status = StatusCompleted
	now := time.Now()
	r.completedAt = &now
	r.newCondition = newCondition
	r.updatedAt = now
	return nil
}

// UpdateDetails updates the repair log details.
// Cannot update a completed repair.
func (r *RepairLog) UpdateDetails(
	description string,
	repairDate *time.Time,
	cost *int,
	currencyCode *string,
	serviceProvider *string,
	notes *string,
) error {
	if r.status == StatusCompleted {
		return ErrRepairAlreadyCompleted
	}
	if strings.TrimSpace(description) == "" {
		return ErrInvalidDescription
	}

	r.description = description
	r.repairDate = repairDate
	r.cost = cost
	r.currencyCode = currencyCode
	r.serviceProvider = serviceProvider
	r.notes = notes
	r.updatedAt = time.Now()
	return nil
}

// Helper methods

// IsPending returns true if the repair is pending.
func (r *RepairLog) IsPending() bool {
	return r.status == StatusPending
}

// IsInProgress returns true if the repair is in progress.
func (r *RepairLog) IsInProgress() bool {
	return r.status == StatusInProgress
}

// IsCompleted returns true if the repair is completed.
func (r *RepairLog) IsCompleted() bool {
	return r.status == StatusCompleted
}
