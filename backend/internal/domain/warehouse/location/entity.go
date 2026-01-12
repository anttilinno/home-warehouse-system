package location

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Location represents a physical location in the warehouse.
type Location struct {
	id             uuid.UUID
	workspaceID    uuid.UUID
	name           string
	parentLocation *uuid.UUID
	zone           *string
	shelf          *string
	bin            *string
	description    *string
	shortCode      *string
	isArchived     bool
	createdAt      time.Time
	updatedAt      time.Time
}

// NewLocation creates a new location.
func NewLocation(workspaceID uuid.UUID, name string, parentLocation *uuid.UUID, zone, shelf, bin, description, shortCode *string) (*Location, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "location name is required")
	}

	now := time.Now()
	return &Location{
		id:             shared.NewUUID(),
		workspaceID:    workspaceID,
		name:           name,
		parentLocation: parentLocation,
		zone:           zone,
		shelf:          shelf,
		bin:            bin,
		description:    description,
		shortCode:      shortCode,
		isArchived:     false,
		createdAt:      now,
		updatedAt:      now,
	}, nil
}

// Reconstruct recreates a location from stored data.
func Reconstruct(
	id, workspaceID uuid.UUID,
	name string,
	parentLocation *uuid.UUID,
	zone, shelf, bin, description, shortCode *string,
	isArchived bool,
	createdAt, updatedAt time.Time,
) *Location {
	return &Location{
		id:             id,
		workspaceID:    workspaceID,
		name:           name,
		parentLocation: parentLocation,
		zone:           zone,
		shelf:          shelf,
		bin:            bin,
		description:    description,
		shortCode:      shortCode,
		isArchived:     isArchived,
		createdAt:      createdAt,
		updatedAt:      updatedAt,
	}
}

// Getters
func (l *Location) ID() uuid.UUID              { return l.id }
func (l *Location) WorkspaceID() uuid.UUID     { return l.workspaceID }
func (l *Location) Name() string               { return l.name }
func (l *Location) ParentLocation() *uuid.UUID { return l.parentLocation }
func (l *Location) Zone() *string              { return l.zone }
func (l *Location) Shelf() *string             { return l.shelf }
func (l *Location) Bin() *string               { return l.bin }
func (l *Location) Description() *string       { return l.description }
func (l *Location) ShortCode() *string         { return l.shortCode }
func (l *Location) IsArchived() bool           { return l.isArchived }
func (l *Location) CreatedAt() time.Time       { return l.createdAt }
func (l *Location) UpdatedAt() time.Time       { return l.updatedAt }

// Update updates the location's information.
func (l *Location) Update(name string, parentLocation *uuid.UUID, zone, shelf, bin, description *string) error {
	if name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "location name is required")
	}
	l.name = name
	l.parentLocation = parentLocation
	l.zone = zone
	l.shelf = shelf
	l.bin = bin
	l.description = description
	l.updatedAt = time.Now()
	return nil
}

// Archive marks the location as archived.
func (l *Location) Archive() {
	l.isArchived = true
	l.updatedAt = time.Now()
}

// Restore marks the location as not archived.
func (l *Location) Restore() {
	l.isArchived = false
	l.updatedAt = time.Now()
}
