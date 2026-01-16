package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/pendingchange"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// PendingChangeRepository provides PostgreSQL persistence for pending changes in the approval pipeline.
// It implements the pendingchange.Repository interface using sqlc-generated queries.
type PendingChangeRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

// NewPendingChangeRepository creates a new PostgreSQL-backed repository for pending changes.
func NewPendingChangeRepository(pool *pgxpool.Pool) *PendingChangeRepository {
	return &PendingChangeRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

// Save persists a pending change to the database.
// For new changes, this inserts a row. For existing changes being approved/rejected, this updates the row.
// Uses an upsert pattern to handle both cases.
func (r *PendingChangeRepository) Save(ctx context.Context, change *pendingchange.PendingChange) error {
	var entityID pgtype.UUID
	if change.EntityID() != nil {
		entityID = pgtype.UUID{Bytes: *change.EntityID(), Valid: true}
	}

	_, err := r.queries.CreatePendingChange(ctx, queries.CreatePendingChangeParams{
		ID:          change.ID(),
		WorkspaceID: change.WorkspaceID(),
		RequesterID: change.RequesterID(),
		EntityType:  change.EntityType(),
		EntityID:    entityID,
		Action:      actionToSqlc(change.Action()),
		Payload:     change.Payload(),
		Status:      statusToSqlc(change.Status()),
	})
	return err
}

// FindByID retrieves a pending change by its unique identifier.
// Returns shared.ErrNotFound if the change does not exist.
func (r *PendingChangeRepository) FindByID(ctx context.Context, id uuid.UUID) (*pendingchange.PendingChange, error) {
	row, err := r.queries.GetPendingChangeByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToPendingChange(row), nil
}

// FindByWorkspace retrieves all pending changes for a workspace, optionally filtered by status.
// If status is nil, returns changes in all statuses (pending, approved, rejected).
// If status is provided, returns only changes matching that status.
// Used to populate the approval queue for admins.
func (r *PendingChangeRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, status *pendingchange.Status) ([]*pendingchange.PendingChange, error) {
	var statusEnum queries.NullWarehousePendingChangeStatusEnum
	if status != nil {
		statusEnum = queries.NullWarehousePendingChangeStatusEnum{
			WarehousePendingChangeStatusEnum: statusToSqlc(*status),
			Valid:                            true,
		}
	}

	rows, err := r.queries.ListPendingChangesByWorkspace(ctx, queries.ListPendingChangesByWorkspaceParams{
		WorkspaceID: workspaceID,
		Status:      statusEnum,
	})
	if err != nil {
		return nil, err
	}

	changes := make([]*pendingchange.PendingChange, 0, len(rows))
	for _, row := range rows {
		changes = append(changes, r.rowToPendingChange(row))
	}

	return changes, nil
}

// FindByRequester retrieves all pending changes submitted by a specific user, optionally filtered by status.
// If status is nil, returns changes in all statuses.
// If status is provided, returns only changes matching that status.
// Used to populate the "My Changes" page for members to track their submissions.
func (r *PendingChangeRepository) FindByRequester(ctx context.Context, requesterID uuid.UUID, status *pendingchange.Status) ([]*pendingchange.PendingChange, error) {
	var statusEnum queries.NullWarehousePendingChangeStatusEnum
	if status != nil {
		statusEnum = queries.NullWarehousePendingChangeStatusEnum{
			WarehousePendingChangeStatusEnum: statusToSqlc(*status),
			Valid:                            true,
		}
	}

	rows, err := r.queries.ListPendingChangesByRequester(ctx, queries.ListPendingChangesByRequesterParams{
		RequesterID: requesterID,
		Status:      statusEnum,
	})
	if err != nil {
		return nil, err
	}

	changes := make([]*pendingchange.PendingChange, 0, len(rows))
	for _, row := range rows {
		changes = append(changes, r.rowToPendingChange(row))
	}

	return changes, nil
}

func (r *PendingChangeRepository) FindByEntity(ctx context.Context, entityType string, entityID uuid.UUID) ([]*pendingchange.PendingChange, error) {
	rows, err := r.queries.ListPendingChangesByEntity(ctx, queries.ListPendingChangesByEntityParams{
		EntityType: entityType,
		EntityID:   pgtype.UUID{Bytes: entityID, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	changes := make([]*pendingchange.PendingChange, 0, len(rows))
	for _, row := range rows {
		changes = append(changes, r.rowToPendingChange(row))
	}

	return changes, nil
}

func (r *PendingChangeRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeletePendingChange(ctx, id)
}

func (r *PendingChangeRepository) rowToPendingChange(row queries.WarehousePendingChange) *pendingchange.PendingChange {
	var entityID *uuid.UUID
	if row.EntityID.Valid {
		id := uuid.UUID(row.EntityID.Bytes)
		entityID = &id
	}

	var reviewedBy *uuid.UUID
	if row.ReviewedBy.Valid {
		id := uuid.UUID(row.ReviewedBy.Bytes)
		reviewedBy = &id
	}

	var reviewedAt *time.Time
	if row.ReviewedAt.Valid {
		reviewedAt = &row.ReviewedAt.Time
	}

	return pendingchange.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.RequesterID,
		row.EntityType,
		entityID,
		actionFromSqlc(row.Action),
		json.RawMessage(row.Payload),
		statusFromSqlc(row.Status),
		reviewedBy,
		reviewedAt,
		row.RejectionReason,
		row.CreatedAt,
		row.UpdatedAt,
	)
}

// Helper functions for type conversions

func actionToSqlc(action pendingchange.Action) queries.WarehousePendingChangeActionEnum {
	switch action {
	case pendingchange.ActionCreate:
		return queries.WarehousePendingChangeActionEnumCreate
	case pendingchange.ActionUpdate:
		return queries.WarehousePendingChangeActionEnumUpdate
	case pendingchange.ActionDelete:
		return queries.WarehousePendingChangeActionEnumDelete
	default:
		return queries.WarehousePendingChangeActionEnumCreate
	}
}

func actionFromSqlc(action queries.WarehousePendingChangeActionEnum) pendingchange.Action {
	switch action {
	case queries.WarehousePendingChangeActionEnumCreate:
		return pendingchange.ActionCreate
	case queries.WarehousePendingChangeActionEnumUpdate:
		return pendingchange.ActionUpdate
	case queries.WarehousePendingChangeActionEnumDelete:
		return pendingchange.ActionDelete
	default:
		return pendingchange.ActionCreate
	}
}

func statusToSqlc(status pendingchange.Status) queries.WarehousePendingChangeStatusEnum {
	switch status {
	case pendingchange.StatusPending:
		return queries.WarehousePendingChangeStatusEnumPending
	case pendingchange.StatusApproved:
		return queries.WarehousePendingChangeStatusEnumApproved
	case pendingchange.StatusRejected:
		return queries.WarehousePendingChangeStatusEnumRejected
	default:
		return queries.WarehousePendingChangeStatusEnumPending
	}
}

func statusFromSqlc(status queries.WarehousePendingChangeStatusEnum) pendingchange.Status {
	switch status {
	case queries.WarehousePendingChangeStatusEnumPending:
		return pendingchange.StatusPending
	case queries.WarehousePendingChangeStatusEnumApproved:
		return pendingchange.StatusApproved
	case queries.WarehousePendingChangeStatusEnumRejected:
		return pendingchange.StatusRejected
	default:
		return pendingchange.StatusPending
	}
}
