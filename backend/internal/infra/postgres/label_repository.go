package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type LabelRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewLabelRepository(pool *pgxpool.Pool) *LabelRepository {
	return &LabelRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *LabelRepository) Save(ctx context.Context, l *label.Label) error {
	_, err := r.queries.CreateLabel(ctx, queries.CreateLabelParams{
		ID:          l.ID(),
		WorkspaceID: l.WorkspaceID(),
		Name:        l.Name(),
		Color:       l.Color(),
		Description: l.Description(),
	})
	return err
}

func (r *LabelRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*label.Label, error) {
	row, err := r.queries.GetLabel(ctx, queries.GetLabelParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToLabel(row), nil
}

func (r *LabelRepository) FindByName(ctx context.Context, workspaceID uuid.UUID, name string) (*label.Label, error) {
	row, err := r.queries.GetLabelByName(ctx, queries.GetLabelByNameParams{
		WorkspaceID: workspaceID,
		Name:        name,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToLabel(row), nil
}

func (r *LabelRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]*label.Label, error) {
	rows, err := r.queries.ListLabels(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	labels := make([]*label.Label, 0, len(rows))
	for _, row := range rows {
		labels = append(labels, r.rowToLabel(row))
	}

	return labels, nil
}

func (r *LabelRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteLabel(ctx, id)
}

func (r *LabelRepository) NameExists(ctx context.Context, workspaceID uuid.UUID, name string) (bool, error) {
	return r.queries.LabelNameExists(ctx, queries.LabelNameExistsParams{
		WorkspaceID: workspaceID,
		Name:        name,
	})
}

func (r *LabelRepository) rowToLabel(row queries.WarehouseLabel) *label.Label {
	return label.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.Name,
		row.Color,
		row.Description,
		row.IsArchived,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
