package user

import (
	"context"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Repository defines the interface for user persistence.
type Repository interface {
	// Save persists a user (create or update).
	Save(ctx context.Context, user *User) error

	// FindByID retrieves a user by ID.
	FindByID(ctx context.Context, id uuid.UUID) (*User, error)

	// FindByEmail retrieves a user by email.
	FindByEmail(ctx context.Context, email string) (*User, error)

	// List retrieves users with pagination.
	List(ctx context.Context, pagination shared.Pagination) ([]*User, int, error)

	// Delete removes a user by ID.
	Delete(ctx context.Context, id uuid.UUID) error

	// ExistsByEmail checks if a user with the given email exists.
	ExistsByEmail(ctx context.Context, email string) (bool, error)

	// UpdateAvatar updates a user's avatar path.
	UpdateAvatar(ctx context.Context, id uuid.UUID, path *string) (*User, error)

	// UpdateEmail updates a user's email address.
	UpdateEmail(ctx context.Context, id uuid.UUID, email string) (*User, error)
}
