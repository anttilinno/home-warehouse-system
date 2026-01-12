package favorite

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	Save(ctx context.Context, favorite *Favorite) error
	FindByID(ctx context.Context, id uuid.UUID) (*Favorite, error)
	FindByUser(ctx context.Context, userID, workspaceID uuid.UUID) ([]*Favorite, error)
	Delete(ctx context.Context, id, userID uuid.UUID) error
	DeleteByTarget(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) error
	IsFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) (bool, error)
}
