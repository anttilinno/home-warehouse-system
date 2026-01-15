package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type ContainerRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewContainerRepository(pool *pgxpool.Pool) *ContainerRepository {
	return &ContainerRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *ContainerRepository) Save(ctx context.Context, c *container.Container) error {
	_, err := r.queries.CreateContainer(ctx, queries.CreateContainerParams{
		ID:          c.ID(),
		WorkspaceID: c.WorkspaceID(),
		Name:        c.Name(),
		LocationID:  c.LocationID(),
		Description: c.Description(),
		Capacity:    c.Capacity(),
		ShortCode:   c.ShortCode(),
	})
	return err
}

func (r *ContainerRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*container.Container, error) {
	row, err := r.queries.GetContainer(ctx, queries.GetContainerParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToContainer(row), nil
}

func (r *ContainerRepository) FindByLocation(ctx context.Context, workspaceID, locationID uuid.UUID) ([]*container.Container, error) {
	rows, err := r.queries.ListContainersByLocation(ctx, queries.ListContainersByLocationParams{
		WorkspaceID: workspaceID,
		LocationID:  locationID,
	})
	if err != nil {
		return nil, err
	}

	containers := make([]*container.Container, 0, len(rows))
	for _, row := range rows {
		containers = append(containers, r.rowToContainer(row))
	}

	return containers, nil
}

func (r *ContainerRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*container.Container, error) {
	row, err := r.queries.GetContainerByShortCode(ctx, queries.GetContainerByShortCodeParams{
		WorkspaceID: workspaceID,
		ShortCode:   &shortCode,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToContainer(row), nil
}

func (r *ContainerRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*container.Container, int, error) {
	rows, err := r.queries.ListContainersByWorkspace(ctx, queries.ListContainersByWorkspaceParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	containers := make([]*container.Container, 0, len(rows))
	for _, row := range rows {
		containers = append(containers, r.rowToContainer(row))
	}

	return containers, len(containers), nil
}

func (r *ContainerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteContainer(ctx, id)
}

func (r *ContainerRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	return r.queries.ContainerShortCodeExists(ctx, queries.ContainerShortCodeExistsParams{
		WorkspaceID: workspaceID,
		ShortCode:   &shortCode,
	})
}

func (r *ContainerRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*container.Container, error) {
	rows, err := r.queries.SearchContainers(ctx, queries.SearchContainersParams{
		WorkspaceID:    workspaceID,
		PlaintoTsquery: query,
		Limit:          int32(limit),
	})
	if err != nil {
		return nil, err
	}

	containers := make([]*container.Container, 0, len(rows))
	for _, row := range rows {
		containers = append(containers, r.rowToContainer(row))
	}

	return containers, nil
}

func (r *ContainerRepository) rowToContainer(row queries.WarehouseContainer) *container.Container {
	return container.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.LocationID,
		row.Name,
		row.Description,
		row.Capacity,
		row.ShortCode,
		row.IsArchived,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
