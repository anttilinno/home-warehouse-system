package factory

import (
	"github.com/brianvoe/gofakeit/v7"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
)

// ContainerOpt is a functional option for customizing a Container.
type ContainerOpt func(*container.Container)

// Container creates a new Container entity with realistic fake data.
// Requires a location ID. Use f.Location() to create one first, or provide WithContainerLocation.
// Options can be used to override specific fields.
func (f *Factory) Container(locationID uuid.UUID, opts ...ContainerOpt) *container.Container {
	name := gofakeit.RandomString([]string{
		"Cardboard Box", "Plastic Bin", "Metal Cabinet", "Drawer",
		"Shelf Unit", "Toolbox", "Storage Tote", "Filing Cabinet",
		"Rack", "Crate", "Basket", "Container",
	}) + " " + gofakeit.DigitN(2)
	shortCode := "C-" + gofakeit.LetterN(2) + gofakeit.DigitN(3)
	description := gofakeit.Sentence(5)
	capacity := gofakeit.RandomString([]string{"Small", "Medium", "Large", "XL"})

	c, err := container.NewContainer(f.workspaceID, locationID, name, &description, &capacity, shortCode)
	if err != nil {
		panic("factory: failed to create container: " + err.Error())
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

// WithContainerName sets the container's name.
func WithContainerName(name string) ContainerOpt {
	return func(c *container.Container) {
		_ = c.Update(name, c.LocationID(), c.Description(), c.Capacity())
	}
}

// WithContainerLocation sets the container's location ID.
func WithContainerLocation(locationID uuid.UUID) ContainerOpt {
	return func(c *container.Container) {
		_ = c.Update(c.Name(), locationID, c.Description(), c.Capacity())
	}
}

// WithContainerDescription sets the container's description.
func WithContainerDescription(description string) ContainerOpt {
	return func(c *container.Container) {
		_ = c.Update(c.Name(), c.LocationID(), &description, c.Capacity())
	}
}

// WithContainerCapacity sets the container's capacity.
func WithContainerCapacity(capacity string) ContainerOpt {
	return func(c *container.Container) {
		_ = c.Update(c.Name(), c.LocationID(), c.Description(), &capacity)
	}
}

// WithContainerShortCode sets the container's short code.
func WithContainerShortCode(shortCode string) ContainerOpt {
	return func(c *container.Container) {
		*c = *container.Reconstruct(
			c.ID(),
			c.WorkspaceID(),
			c.LocationID(),
			c.Name(),
			c.Description(),
			c.Capacity(),
			shortCode,
			c.IsArchived(),
			c.CreatedAt(),
			c.UpdatedAt(),
		)
	}
}
