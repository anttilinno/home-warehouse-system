package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type LocationRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewLocationRepository(pool *pgxpool.Pool) *LocationRepository {
	return &LocationRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *LocationRepository) Save(ctx context.Context, l *location.Location) error {
	var parentLocation pgtype.UUID
	if l.ParentLocation() != nil {
		parentLocation = pgtype.UUID{Bytes: *l.ParentLocation(), Valid: true}
	}

	_, err := r.queries.CreateLocation(ctx, queries.CreateLocationParams{
		ID:             l.ID(),
		WorkspaceID:    l.WorkspaceID(),
		Name:           l.Name(),
		ParentLocation: parentLocation,
		Zone:           l.Zone(),
		Shelf:          l.Shelf(),
		Bin:            l.Bin(),
		Description:    l.Description(),
		ShortCode:      l.ShortCode(),
	})
	return err
}

func (r *LocationRepository) FindByID(ctx context.Context, id, workspaceID uuid.UUID) (*location.Location, error) {
	row, err := r.queries.GetLocation(ctx, queries.GetLocationParams{
		ID:          id,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToLocation(row), nil
}

func (r *LocationRepository) FindByShortCode(ctx context.Context, workspaceID uuid.UUID, shortCode string) (*location.Location, error) {
	row, err := r.queries.GetLocationByShortCode(ctx, queries.GetLocationByShortCodeParams{
		WorkspaceID: workspaceID,
		ShortCode:   &shortCode,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}

	return r.rowToLocation(row), nil
}

func (r *LocationRepository) FindByWorkspace(ctx context.Context, workspaceID uuid.UUID, pagination shared.Pagination) ([]*location.Location, int, error) {
	rows, err := r.queries.ListLocations(ctx, queries.ListLocationsParams{
		WorkspaceID: workspaceID,
		Limit:       int32(pagination.Limit()),
		Offset:      int32(pagination.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}

	locations := make([]*location.Location, 0, len(rows))
	for _, row := range rows {
		locations = append(locations, r.rowToLocation(row))
	}

	return locations, len(locations), nil
}

func (r *LocationRepository) FindRootLocations(ctx context.Context, workspaceID uuid.UUID) ([]*location.Location, error) {
	rows, err := r.queries.ListRootLocations(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	locations := make([]*location.Location, 0, len(rows))
	for _, row := range rows {
		locations = append(locations, r.rowToLocation(row))
	}

	return locations, nil
}

func (r *LocationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.queries.DeleteLocation(ctx, id)
}

func (r *LocationRepository) ShortCodeExists(ctx context.Context, workspaceID uuid.UUID, shortCode string) (bool, error) {
	return r.queries.ShortCodeExists(ctx, queries.ShortCodeExistsParams{
		WorkspaceID: workspaceID,
		ShortCode:   &shortCode,
	})
}

func (r *LocationRepository) Search(ctx context.Context, workspaceID uuid.UUID, query string, limit int) ([]*location.Location, error) {
	rows, err := r.queries.SearchLocations(ctx, queries.SearchLocationsParams{
		WorkspaceID:    workspaceID,
		PlaintoTsquery: query,
		Limit:          int32(limit),
	})
	if err != nil {
		return nil, err
	}

	locations := make([]*location.Location, 0, len(rows))
	for _, row := range rows {
		locations = append(locations, r.rowToLocation(row))
	}

	return locations, nil
}

func (r *LocationRepository) rowToLocation(row queries.WarehouseLocation) *location.Location {
	var parentLocation *uuid.UUID
	if row.ParentLocation.Valid {
		id := uuid.UUID(row.ParentLocation.Bytes)
		parentLocation = &id
	}

	return location.Reconstruct(
		row.ID,
		row.WorkspaceID,
		row.Name,
		parentLocation,
		row.Zone,
		row.Shelf,
		row.Bin,
		row.Description,
		row.ShortCode,
		row.IsArchived,
		row.CreatedAt.Time,
		row.UpdatedAt.Time,
	)
}
