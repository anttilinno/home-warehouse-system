package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/favorite"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
)

type FavoriteRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewFavoriteRepository(pool *pgxpool.Pool) *FavoriteRepository {
	return &FavoriteRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *FavoriteRepository) Save(ctx context.Context, f *favorite.Favorite) error {
	var itemID, locationID, containerID pgtype.UUID

	if f.ItemID() != nil {
		itemID = pgtype.UUID{Bytes: *f.ItemID(), Valid: true}
	}
	if f.LocationID() != nil {
		locationID = pgtype.UUID{Bytes: *f.LocationID(), Valid: true}
	}
	if f.ContainerID() != nil {
		containerID = pgtype.UUID{Bytes: *f.ContainerID(), Valid: true}
	}

	_, err := r.queries.CreateFavorite(ctx, queries.CreateFavoriteParams{
		ID:           f.ID(),
		UserID:       f.UserID(),
		WorkspaceID:  f.WorkspaceID(),
		FavoriteType: queries.WarehouseFavoriteTypeEnum(f.FavoriteType()),
		ItemID:       itemID,
		LocationID:   locationID,
		ContainerID:  containerID,
	})
	return err
}

func (r *FavoriteRepository) FindByID(ctx context.Context, id uuid.UUID) (*favorite.Favorite, error) {
	row, err := r.queries.GetFavorite(ctx, id)
	if err != nil {
		return nil, err
	}
	return r.rowToFavorite(row), nil
}

func (r *FavoriteRepository) FindByUser(ctx context.Context, userID, workspaceID uuid.UUID) ([]*favorite.Favorite, error) {
	rows, err := r.queries.ListFavoritesByUser(ctx, queries.ListFavoritesByUserParams{
		UserID:      userID,
		WorkspaceID: workspaceID,
	})
	if err != nil {
		return nil, err
	}

	favorites := make([]*favorite.Favorite, len(rows))
	for i, row := range rows {
		favorites[i] = r.rowToFavorite(row)
	}
	return favorites, nil
}

func (r *FavoriteRepository) IsFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType favorite.FavoriteType, targetID uuid.UUID) (bool, error) {
	return r.queries.IsFavorite(ctx, queries.IsFavoriteParams{
		UserID:       userID,
		WorkspaceID:  workspaceID,
		FavoriteType: queries.WarehouseFavoriteTypeEnum(favoriteType),
		ItemID:       pgtype.UUID{Bytes: targetID, Valid: true},
	})
}

func (r *FavoriteRepository) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return r.queries.DeleteFavorite(ctx, queries.DeleteFavoriteParams{
		ID:     id,
		UserID: userID,
	})
}

func (r *FavoriteRepository) DeleteByTarget(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType favorite.FavoriteType, targetID uuid.UUID) error {
	return r.queries.DeleteFavoriteByTarget(ctx, queries.DeleteFavoriteByTargetParams{
		UserID:       userID,
		WorkspaceID:  workspaceID,
		FavoriteType: queries.WarehouseFavoriteTypeEnum(favoriteType),
		ItemID:       pgtype.UUID{Bytes: targetID, Valid: true},
	})
}

func (r *FavoriteRepository) rowToFavorite(row queries.WarehouseFavorite) *favorite.Favorite {
	var itemID, locationID, containerID *uuid.UUID

	if row.ItemID.Valid {
		id := uuid.UUID(row.ItemID.Bytes)
		itemID = &id
	}
	if row.LocationID.Valid {
		id := uuid.UUID(row.LocationID.Bytes)
		locationID = &id
	}
	if row.ContainerID.Valid {
		id := uuid.UUID(row.ContainerID.Bytes)
		containerID = &id
	}

	return favorite.Reconstruct(
		row.ID,
		row.UserID,
		row.WorkspaceID,
		favorite.FavoriteType(row.FavoriteType),
		itemID,
		locationID,
		containerID,
		row.CreatedAt.Time,
	)
}
