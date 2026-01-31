package factory

import (
	"github.com/brianvoe/gofakeit/v7"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
)

// LocationOpt is a functional option for customizing a Location.
type LocationOpt func(*location.Location)

// Location creates a new Location entity with realistic fake data.
// Options can be used to override specific fields.
func (f *Factory) Location(opts ...LocationOpt) *location.Location {
	name := gofakeit.RandomString([]string{
		"Garage", "Basement", "Attic", "Kitchen", "Living Room",
		"Bedroom", "Office", "Storage Room", "Closet", "Shed",
		"Workshop", "Utility Room", "Pantry", "Laundry Room",
	})
	shortCode := "L-" + gofakeit.LetterN(2) + gofakeit.DigitN(3)
	description := gofakeit.Sentence(6)

	l, err := location.NewLocation(f.workspaceID, name, nil, &description, shortCode)
	if err != nil {
		panic("factory: failed to create location: " + err.Error())
	}

	for _, opt := range opts {
		opt(l)
	}

	return l
}

// WithLocationName sets the location's name.
func WithLocationName(name string) LocationOpt {
	return func(l *location.Location) {
		_ = l.Update(name, l.ParentLocation(), l.Description())
	}
}

// WithLocationParent sets the location's parent location ID.
func WithLocationParent(parentID uuid.UUID) LocationOpt {
	return func(l *location.Location) {
		_ = l.Update(l.Name(), &parentID, l.Description())
	}
}

// WithLocationDescription sets the location's description.
func WithLocationDescription(description string) LocationOpt {
	return func(l *location.Location) {
		_ = l.Update(l.Name(), l.ParentLocation(), &description)
	}
}

// WithLocationShortCode sets the location's short code.
func WithLocationShortCode(shortCode string) LocationOpt {
	return func(l *location.Location) {
		*l = *location.Reconstruct(
			l.ID(),
			l.WorkspaceID(),
			l.Name(),
			l.ParentLocation(),
			l.Description(),
			shortCode,
			l.IsArchived(),
			l.CreatedAt(),
			l.UpdatedAt(),
		)
	}
}
