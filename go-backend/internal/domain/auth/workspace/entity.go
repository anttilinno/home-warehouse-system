package workspace

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// Workspace represents a workspace in the system.
type Workspace struct {
	id          uuid.UUID
	name        string
	slug        string
	description *string
	isPersonal  bool
	createdAt   time.Time
	updatedAt   time.Time
}

// NewWorkspace creates a new workspace.
func NewWorkspace(name, slug string, description *string, isPersonal bool) (*Workspace, error) {
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "workspace name is required")
	}
	if slug == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "slug", "workspace slug is required")
	}

	now := time.Now()
	return &Workspace{
		id:          shared.NewUUID(),
		name:        name,
		slug:        slug,
		description: description,
		isPersonal:  isPersonal,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

// Reconstruct recreates a workspace from stored data.
func Reconstruct(
	id uuid.UUID,
	name, slug string,
	description *string,
	isPersonal bool,
	createdAt, updatedAt time.Time,
) *Workspace {
	return &Workspace{
		id:          id,
		name:        name,
		slug:        slug,
		description: description,
		isPersonal:  isPersonal,
		createdAt:   createdAt,
		updatedAt:   updatedAt,
	}
}

// ID returns the workspace's ID.
func (w *Workspace) ID() uuid.UUID { return w.id }

// Name returns the workspace's name.
func (w *Workspace) Name() string { return w.name }

// Slug returns the workspace's slug.
func (w *Workspace) Slug() string { return w.slug }

// Description returns the workspace's description.
func (w *Workspace) Description() *string { return w.description }

// IsPersonal returns whether the workspace is personal.
func (w *Workspace) IsPersonal() bool { return w.isPersonal }

// CreatedAt returns when the workspace was created.
func (w *Workspace) CreatedAt() time.Time { return w.createdAt }

// UpdatedAt returns when the workspace was last updated.
func (w *Workspace) UpdatedAt() time.Time { return w.updatedAt }

// Update updates the workspace's information.
func (w *Workspace) Update(name string, description *string) error {
	if name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "workspace name is required")
	}
	w.name = name
	w.description = description
	w.updatedAt = time.Now()
	return nil
}
