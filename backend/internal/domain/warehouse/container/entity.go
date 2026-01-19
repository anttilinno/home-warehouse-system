package container

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Container struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	name        string
	locationID  uuid.UUID
	description *string
	capacity    *string
	shortCode   string
	isArchived  bool
	createdAt   time.Time
	updatedAt   time.Time
}

func NewContainer(workspaceID, locationID uuid.UUID, name string, description, capacity *string, shortCode string) (*Container, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if err := shared.ValidateUUID(locationID, "location_id"); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "container name is required")
	}
	if shortCode == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "short_code", "short code is required")
	}

	now := time.Now()
	return &Container{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		name:        name,
		locationID:  locationID,
		description: description,
		capacity:    capacity,
		shortCode:   shortCode,
		isArchived:  false,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

func Reconstruct(id, workspaceID, locationID uuid.UUID, name string, description, capacity *string, shortCode string, isArchived bool, createdAt, updatedAt time.Time) *Container {
	return &Container{id, workspaceID, name, locationID, description, capacity, shortCode, isArchived, createdAt, updatedAt}
}

func (c *Container) ID() uuid.UUID          { return c.id }
func (c *Container) WorkspaceID() uuid.UUID { return c.workspaceID }
func (c *Container) Name() string           { return c.name }
func (c *Container) LocationID() uuid.UUID  { return c.locationID }
func (c *Container) Description() *string   { return c.description }
func (c *Container) Capacity() *string      { return c.capacity }
func (c *Container) ShortCode() string      { return c.shortCode }
func (c *Container) IsArchived() bool       { return c.isArchived }
func (c *Container) CreatedAt() time.Time   { return c.createdAt }
func (c *Container) UpdatedAt() time.Time   { return c.updatedAt }

func (c *Container) Update(name string, locationID uuid.UUID, description, capacity *string) error {
	if name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "container name is required")
	}
	c.name = name
	c.locationID = locationID
	c.description = description
	c.capacity = capacity
	c.updatedAt = time.Now()
	return nil
}

func (c *Container) Archive() {
	c.isArchived = true
	c.updatedAt = time.Now()
}

// Restore marks the container as not archived.
func (c *Container) Restore() {
	c.isArchived = false
	c.updatedAt = time.Now()
}
