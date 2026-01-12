package favorite

import (
	"context"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) AddFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) (*Favorite, error) {
	// Check if already favorited
	exists, err := s.repo.IsFavorite(ctx, userID, workspaceID, favoriteType, targetID)
	if err != nil {
		return nil, err
	}
	if exists {
		// Already favorited, return nil (idempotent operation)
		return nil, nil
	}

	favorite, err := NewFavorite(userID, workspaceID, favoriteType, targetID)
	if err != nil {
		return nil, err
	}

	if err := s.repo.Save(ctx, favorite); err != nil {
		return nil, err
	}

	return favorite, nil
}

func (s *Service) RemoveFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) error {
	return s.repo.DeleteByTarget(ctx, userID, workspaceID, favoriteType, targetID)
}

func (s *Service) ToggleFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) (bool, error) {
	exists, err := s.repo.IsFavorite(ctx, userID, workspaceID, favoriteType, targetID)
	if err != nil {
		return false, err
	}

	if exists {
		if err := s.RemoveFavorite(ctx, userID, workspaceID, favoriteType, targetID); err != nil {
			return false, err
		}
		return false, nil
	}

	if _, err := s.AddFavorite(ctx, userID, workspaceID, favoriteType, targetID); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Service) ListFavorites(ctx context.Context, userID, workspaceID uuid.UUID) ([]*Favorite, error) {
	return s.repo.FindByUser(ctx, userID, workspaceID)
}

func (s *Service) IsFavorite(ctx context.Context, userID, workspaceID uuid.UUID, favoriteType FavoriteType, targetID uuid.UUID) (bool, error) {
	return s.repo.IsFavorite(ctx, userID, workspaceID, favoriteType, targetID)
}
