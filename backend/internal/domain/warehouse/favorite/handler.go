package favorite

import (
	"context"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/infra/events"
)

const (
	msgWorkspaceContextRequired = "workspace context required"
	msgAuthenticationRequired   = "authentication required"
)

// RegisterRoutes registers favorite routes.
// Each handler is a package factory func (see below) so this stays a flat list
// of registrations rather than a single god-function of inline closures.
func RegisterRoutes(api huma.API, svc ServiceInterface, broadcaster *events.Broadcaster) {
	huma.Get(api, "/favorites", listFavorites(svc))
	huma.Post(api, "/favorites", toggleFavorite(svc, broadcaster))
	huma.Get(api, "/favorites/check/{favorite_type}/{target_id}", checkFavorite(svc))
}

// listFavorites lists the authenticated user's favorites.
func listFavorites(svc ServiceInterface) func(context.Context, *struct{}) (*ListFavoritesOutput, error) {
	return func(ctx context.Context, input *struct{}) (*ListFavoritesOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgAuthenticationRequired)
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
	}
}

// toggleFavorite adds a favorite if not present, or removes it if it exists.
func toggleFavorite(svc ServiceInterface, broadcaster *events.Broadcaster) func(context.Context, *ToggleFavoriteInput) (*ToggleFavoriteOutput, error) {
	return func(ctx context.Context, input *ToggleFavoriteInput) (*ToggleFavoriteOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgAuthenticationRequired)
		}

		favoriteType := FavoriteType(input.Body.FavoriteType)
		if !favoriteType.IsValid() {
			return nil, huma.Error400BadRequest("invalid favorite type")
		}

		added, err := svc.ToggleFavorite(ctx, authUser.ID, workspaceID, favoriteType, input.Body.TargetID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to toggle favorite")
		}

		// Publish event
		if broadcaster != nil && authUser != nil {
			userName := appMiddleware.GetUserDisplayName(ctx)
			eventType := "favorite.deleted"
			if added {
				eventType = "favorite.created"
			}
			broadcaster.Publish(workspaceID, events.Event{
				Type:       eventType,
				EntityID:   input.Body.TargetID.String(),
				EntityType: "favorite",
				UserID:     authUser.ID,
				Data: map[string]any{
					"target_id":     input.Body.TargetID,
					"favorite_type": input.Body.FavoriteType,
					"added":         added,
					"user_name":     userName,
				},
			})
		}

		return &ToggleFavoriteOutput{
			Body: ToggleFavoriteResponse{
				Added: added,
			},
		}, nil
	}
}

// checkFavorite reports whether the target entity is favorited by the user.
func checkFavorite(svc ServiceInterface) func(context.Context, *CheckFavoriteInput) (*CheckFavoriteOutput, error) {
	return func(ctx context.Context, input *CheckFavoriteInput) (*CheckFavoriteOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		authUser, ok := appMiddleware.GetAuthUser(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgAuthenticationRequired)
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
	}
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
