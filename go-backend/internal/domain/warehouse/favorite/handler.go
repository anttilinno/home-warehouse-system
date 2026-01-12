package favorite

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// RegisterRoutes registers favorite routes.
func RegisterRoutes(api huma.API, svc *Service) {
	// List user's favorites
	huma.Get(api, "/favorites", func(ctx context.Context, input *struct{}) (*ListFavoritesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		favorites, err := svc.ListFavorites(ctx, authUser.ID, workspaceID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to list favorites")
		}

		items := make([]FavoriteResponse, len(favorites))
		for i, fav := range favorites {
			items[i] = toFavoriteResponse(fav)
		}

		return &ListFavoritesOutput{
			Body: FavoriteListResponse{Items: items},
		}, nil
	})

	// Toggle favorite (add if not exists, remove if exists)
	huma.Post(api, "/favorites", func(ctx context.Context, input *ToggleFavoriteInput) (*ToggleFavoriteOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		favoriteType := FavoriteType(input.Body.FavoriteType)
		if !favoriteType.IsValid() {
			return nil, huma.Error400BadRequest("invalid favorite type")
		}

		added, err := svc.ToggleFavorite(ctx, authUser.ID, workspaceID, favoriteType, input.Body.TargetID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to toggle favorite")
		}

		return &ToggleFavoriteOutput{
			Body: ToggleFavoriteResponse{
				Added: added,
			},
		}, nil
	})

	// Check if item is favorited
	huma.Get(api, "/favorites/check/{favorite_type}/{target_id}", func(ctx context.Context, input *CheckFavoriteInput) (*CheckFavoriteOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("authentication required")
		}

		favoriteType := FavoriteType(input.FavoriteType_)
		if !favoriteType.IsValid() {
			return nil, huma.Error400BadRequest("invalid favorite type")
		}

		isFavorite, err := svc.IsFavorite(ctx, authUser.ID, workspaceID, favoriteType, input.TargetID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to check favorite")
		}

		return &CheckFavoriteOutput{
			Body: CheckFavoriteResponse{
				IsFavorite: isFavorite,
			},
		}, nil
	})
}

func toFavoriteResponse(fav *Favorite) FavoriteResponse {
	return FavoriteResponse{
		ID:           fav.ID(),
		WorkspaceID:  fav.WorkspaceID(),
		UserID:       fav.UserID(),
		FavoriteType: string(fav.FavoriteType()),
		ItemID:       fav.ItemID(),
		LocationID:   fav.LocationID(),
		ContainerID:  fav.ContainerID(),
		CreatedAt:    fav.CreatedAt(),
	}
}

// Request/Response types

type ToggleFavoriteInput struct {
	Body struct {
		FavoriteType string    `json:"favorite_type" enum:"ITEM,LOCATION,CONTAINER" doc:"Type of entity to favorite"`
		TargetID     uuid.UUID `json:"target_id" doc:"ID of the entity to favorite"`
	}
}

type ToggleFavoriteOutput struct {
	Body ToggleFavoriteResponse
}

type ToggleFavoriteResponse struct {
	Added bool `json:"added" doc:"True if favorite was added, false if removed"`
}

type CheckFavoriteInput struct {
	FavoriteType_ string    `path:"favorite_type"`
	TargetID      uuid.UUID `path:"target_id"`
}

type CheckFavoriteOutput struct {
	Body CheckFavoriteResponse
}

type CheckFavoriteResponse struct {
	IsFavorite bool `json:"is_favorite"`
}

type ListFavoritesOutput struct {
	Body FavoriteListResponse
}

type FavoriteListResponse struct {
	Items []FavoriteResponse `json:"items"`
}

type FavoriteResponse struct {
	ID           uuid.UUID  `json:"id"`
	WorkspaceID  uuid.UUID  `json:"workspace_id"`
	UserID       uuid.UUID  `json:"user_id"`
	FavoriteType string     `json:"favorite_type" enum:"ITEM,LOCATION,CONTAINER"`
	ItemID       *uuid.UUID `json:"item_id,omitempty"`
	LocationID   *uuid.UUID `json:"location_id,omitempty"`
	ContainerID  *uuid.UUID `json:"container_id,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}
