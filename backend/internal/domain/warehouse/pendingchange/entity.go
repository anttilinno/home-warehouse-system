// Package pendingchange implements the approval pipeline domain logic for role-based change control.
//
// The approval pipeline intercepts create, update, and delete operations from workspace members
// and routes them through admin/owner approval before being applied to the system. This provides
// data integrity oversight in multi-user collaborative workspaces.
//
// Key concepts:
//   - PendingChange: Represents a change awaiting approval
//   - Action: The type of operation (create, update, delete)
//   - Status: The approval state (pending, approved, rejected)
//   - EntityApplier: Interface for applying approved changes to different entity types
//
// Workflow:
//  1. Member submits a change (e.g., create item)
//  2. Approval middleware intercepts and creates a PendingChange
//  3. Admin/owner reviews the change
//  4. Upon approval, the change is applied to the actual entity
//  5. Upon rejection, the change is discarded with a reason
//
// See docs/APPROVAL_PIPELINE.md for complete documentation.
package pendingchange

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Action represents the type of change being requested
type Action string

const (
	ActionCreate Action = "create"
	ActionUpdate Action = "update"
	ActionDelete Action = "delete"
)

// Status represents the approval status of the pending change
type Status string

const (
	StatusPending  Status = "pending"
	StatusApproved Status = "approved"
	StatusRejected Status = "rejected"
)

// PendingChange represents a change that requires approval before being applied
type PendingChange struct {
	id              uuid.UUID
	workspaceID     uuid.UUID
	requesterID     uuid.UUID
	entityType      string
	entityID        *uuid.UUID
	action          Action
	payload         json.RawMessage
	status          Status
	reviewedBy      *uuid.UUID
	reviewedAt      *time.Time
	rejectionReason *string
	createdAt       time.Time
	updatedAt       time.Time
}

// NewPendingChange creates a new pending change
func NewPendingChange(
	workspaceID uuid.UUID,
	requesterID uuid.UUID,
	entityType string,
	entityID *uuid.UUID,
	action Action,
	payload json.RawMessage,
) (*PendingChange, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(requesterID, "requester_id"); err != nil {
		return nil, err
	}
	if entityType == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "entity_type", "entity type is required")
	}
	if !isValidAction(action) {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "action", "invalid action type")
	}
	if len(payload) == 0 {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "payload", "payload is required")
	}

	now := time.Now()
	return &PendingChange{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		requesterID: requesterID,
		entityType:  entityType,
		entityID:    entityID,
		action:      action,
		payload:     payload,
		status:      StatusPending,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

// Reconstruct rebuilds a PendingChange from persisted data
func Reconstruct(
	id uuid.UUID,
	workspaceID uuid.UUID,
	requesterID uuid.UUID,
	entityType string,
	entityID *uuid.UUID,
	action Action,
	payload json.RawMessage,
	status Status,
	reviewedBy *uuid.UUID,
	reviewedAt *time.Time,
	rejectionReason *string,
	createdAt time.Time,
	updatedAt time.Time,
) *PendingChange {
	return &PendingChange{
		id:              id,
		workspaceID:     workspaceID,
		requesterID:     requesterID,
		entityType:      entityType,
		entityID:        entityID,
		action:          action,
		payload:         payload,
		status:          status,
		reviewedBy:      reviewedBy,
		reviewedAt:      reviewedAt,
		rejectionReason: rejectionReason,
		createdAt:       createdAt,
		updatedAt:       updatedAt,
	}
}

// Getters
func (p *PendingChange) ID() uuid.UUID                { return p.id }
func (p *PendingChange) WorkspaceID() uuid.UUID       { return p.workspaceID }
func (p *PendingChange) RequesterID() uuid.UUID       { return p.requesterID }
func (p *PendingChange) EntityType() string           { return p.entityType }
func (p *PendingChange) EntityID() *uuid.UUID         { return p.entityID }
func (p *PendingChange) Action() Action               { return p.action }
func (p *PendingChange) Payload() json.RawMessage     { return p.payload }
func (p *PendingChange) Status() Status               { return p.status }
func (p *PendingChange) ReviewedBy() *uuid.UUID       { return p.reviewedBy }
func (p *PendingChange) ReviewedAt() *time.Time       { return p.reviewedAt }
func (p *PendingChange) RejectionReason() *string     { return p.rejectionReason }
func (p *PendingChange) CreatedAt() time.Time         { return p.createdAt }
func (p *PendingChange) UpdatedAt() time.Time         { return p.updatedAt }

// Approve marks the pending change as approved
func (p *PendingChange) Approve(reviewerID uuid.UUID) error {
	if p.status != StatusPending {
		return ErrChangeAlreadyReviewed
	}
	if err := shared.ValidateUUID(reviewerID, "reviewer_id"); err != nil {
		return err
	}

	now := time.Now()
	p.status = StatusApproved
	p.reviewedBy = &reviewerID
	p.reviewedAt = &now
	p.updatedAt = now
	return nil
}

// Reject marks the pending change as rejected
func (p *PendingChange) Reject(reviewerID uuid.UUID, reason string) error {
	if p.status != StatusPending {
		return ErrChangeAlreadyReviewed
	}
	if err := shared.ValidateUUID(reviewerID, "reviewer_id"); err != nil {
		return err
	}
	if reason == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "rejection_reason", "rejection reason is required")
	}

	now := time.Now()
	p.status = StatusRejected
	p.reviewedBy = &reviewerID
	p.reviewedAt = &now
	p.rejectionReason = &reason
	p.updatedAt = now
	return nil
}

// IsPending returns true if the change is awaiting review
func (p *PendingChange) IsPending() bool {
	return p.status == StatusPending
}

// IsApproved returns true if the change has been approved
func (p *PendingChange) IsApproved() bool {
	return p.status == StatusApproved
}

// IsRejected returns true if the change has been rejected
func (p *PendingChange) IsRejected() bool {
	return p.status == StatusRejected
}

// Helper functions
func isValidAction(action Action) bool {
	switch action {
	case ActionCreate, ActionUpdate, ActionDelete:
		return true
	default:
		return false
	}
}

func isValidStatus(status Status) bool {
	switch status {
	case StatusPending, StatusApproved, StatusRejected:
		return true
	default:
		return false
	}
}

// ParseAction converts a string to an Action type
func ParseAction(s string) (Action, error) {
	action := Action(s)
	if !isValidAction(action) {
		return "", shared.NewFieldError(shared.ErrInvalidInput, "action", "invalid action type")
	}
	return action, nil
}

// ParseStatus converts a string to a Status type
func ParseStatus(s string) (Status, error) {
	status := Status(s)
	if !isValidStatus(status) {
		return "", shared.NewFieldError(shared.ErrInvalidInput, "status", "invalid status type")
	}
	return status, nil
}
