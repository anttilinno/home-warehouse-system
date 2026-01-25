package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/repairattachment"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// RepairAttachmentRepository implements repairattachment.Repository using PostgreSQL.
type RepairAttachmentRepository struct {
	pool *pgxpool.Pool
}

// NewRepairAttachmentRepository creates a new repair attachment repository.
func NewRepairAttachmentRepository(pool *pgxpool.Pool) *RepairAttachmentRepository {
	return &RepairAttachmentRepository{pool: pool}
}

// Create inserts a new repair attachment.
func (r *RepairAttachmentRepository) Create(ctx context.Context, ra *repairattachment.RepairAttachment) error {
	q := queries.New(r.pool)

	_, err := q.InsertRepairAttachment(ctx, queries.InsertRepairAttachmentParams{
		ID:             ra.ID(),
		RepairLogID:    ra.RepairLogID(),
		WorkspaceID:    ra.WorkspaceID(),
		FileID:         ra.FileID(),
		AttachmentType: queries.WarehouseAttachmentTypeEnum(ra.AttachmentType()),
		Title:          ra.Title(),
	})
	return err
}

// GetByID retrieves a repair attachment by ID and workspace.
func (r *RepairAttachmentRepository) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*repairattachment.RepairAttachment, error) {
	q := queries.New(r.pool)

	row, err := q.GetRepairAttachment(ctx, queries.GetRepairAttachmentParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return repairattachment.Reconstruct(
		row.ID,
		row.RepairLogID,
		row.WorkspaceID,
		row.FileID,
		attachment.AttachmentType(row.AttachmentType),
		row.Title,
		row.CreatedAt,
		row.UpdatedAt,
	), nil
}

// ListByRepairLog retrieves all attachments for a repair log with file metadata.
func (r *RepairAttachmentRepository) ListByRepairLog(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*repairattachment.RepairAttachmentWithFile, error) {
	q := queries.New(r.pool)

	rows, err := q.ListRepairAttachmentsByRepairLog(ctx, queries.ListRepairAttachmentsByRepairLogParams{
		RepairLogID: repairLogID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return nil, err
	}

	result := make([]*repairattachment.RepairAttachmentWithFile, len(rows))
	for i, row := range rows {
		result[i] = repairattachment.ReconstructWithFile(
			row.ID,
			row.RepairLogID,
			row.WorkspaceID,
			row.FileID,
			attachment.AttachmentType(row.AttachmentType),
			row.Title,
			row.CreatedAt,
			row.UpdatedAt,
			row.FileName,
			row.FileMimeType,
			row.FileSize,
			row.FileStorageKey,
		)
	}
	return result, nil
}

// Delete removes a repair attachment by ID and workspace.
func (r *RepairAttachmentRepository) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	q := queries.New(r.pool)

	return q.DeleteRepairAttachment(ctx, queries.DeleteRepairAttachmentParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
}
