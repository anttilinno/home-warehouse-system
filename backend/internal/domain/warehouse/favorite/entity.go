package favorite

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type FavoriteType string

const (
	TypeItem      FavoriteType = "ITEM"
	TypeLocation  FavoriteType = "LOCATION"
	TypeContainer FavoriteType = "CONTAINER"
)

func (f FavoriteType) IsValid() bool {
	switch f {
	case TypeItem, TypeLocation, TypeContainer:
		return true
	}
	return false
}

type Favorite struct {
	id           uuid.UUID
	userID       uuid.UUID
	workspaceID  uuid.UUID
	favoriteType FavoriteType
	itemID       *uuid.UUID
	locationID   *uuid.UUID
	containerID  *uuid.UUID
	createdAt    time.Time
}

func NewFavorite(
	userID, workspaceID uuid.UUID,
	favoriteType FavoriteType,
	targetID uuid.UUID,
) (*Favorite, error) {
	if err := shared.ValidateUUID(userID, "user_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if !favoriteType.IsValid() {
		return nil, ErrInvalidFavoriteType
	}
	if err := shared.ValidateUUID(targetID, "target_id"); err != nil {
		return nil, err
	}

	var itemID, locationID, containerID *uuid.UUID
	switch favoriteType {
	case TypeItem:
		itemID = &targetID
	case TypeLocation:
		locationID = &targetID
	case TypeContainer:
		containerID = &targetID
	}

	return &Favorite{
		id:           shared.NewUUID(),
		userID:       userID,
		workspaceID:  workspaceID,
		favoriteType: favoriteType,
		itemID:       itemID,
		locationID:   locationID,
		containerID:  containerID,
		createdAt:    time.Now(),
	}, nil
}

func Reconstruct(
	id, userID, workspaceID uuid.UUID,
	favoriteType FavoriteType,
	itemID, locationID, containerID *uuid.UUID,
	createdAt time.Time,
) *Favorite {
	return &Favorite{
		id:           id,
		userID:       userID,
		workspaceID:  workspaceID,
		favoriteType: favoriteType,
		itemID:       itemID,
		locationID:   locationID,
		containerID:  containerID,
		createdAt:    createdAt,
	}
}

// Getters
func (f *Favorite) ID() uuid.UUID             { return f.id }
func (f *Favorite) UserID() uuid.UUID         { return f.userID }
func (f *Favorite) WorkspaceID() uuid.UUID    { return f.workspaceID }
func (f *Favorite) FavoriteType() FavoriteType { return f.favoriteType }
func (f *Favorite) ItemID() *uuid.UUID        { return f.itemID }
func (f *Favorite) LocationID() *uuid.UUID    { return f.locationID }
func (f *Favorite) ContainerID() *uuid.UUID   { return f.containerID }
func (f *Favorite) CreatedAt() time.Time      { return f.createdAt }

func (f *Favorite) TargetID() uuid.UUID {
	switch f.favoriteType {
	case TypeItem:
		if f.itemID != nil {
			return *f.itemID
		}
	case TypeLocation:
		if f.locationID != nil {
			return *f.locationID
		}
	case TypeContainer:
		if f.containerID != nil {
			return *f.containerID
		}
	}
	return uuid.Nil
}
