package company

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Company struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	name        string
	website     *string
	notes       *string
	isArchived  bool
	createdAt   time.Time
	updatedAt   time.Time
}

func NewCompany(workspaceID uuid.UUID, name string, website, notes *string) (*Company, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "company name is required")
	}

	now := time.Now()
	return &Company{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		name:        name,
		website:     website,
		notes:       notes,
		isArchived:  false,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

func Reconstruct(id, workspaceID uuid.UUID, name string, website, notes *string, isArchived bool, createdAt, updatedAt time.Time) *Company {
	return &Company{id, workspaceID, name, website, notes, isArchived, createdAt, updatedAt}
}

func (c *Company) ID() uuid.UUID          { return c.id }
func (c *Company) WorkspaceID() uuid.UUID { return c.workspaceID }
func (c *Company) Name() string           { return c.name }
func (c *Company) Website() *string       { return c.website }
func (c *Company) Notes() *string         { return c.notes }
func (c *Company) IsArchived() bool       { return c.isArchived }
func (c *Company) CreatedAt() time.Time   { return c.createdAt }
func (c *Company) UpdatedAt() time.Time   { return c.updatedAt }

func (c *Company) Update(name string, website, notes *string) error {
	if name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "company name is required")
	}
	c.name = name
	c.website = website
	c.notes = notes
	c.updatedAt = time.Now()
	return nil
}

func (c *Company) Archive() {
	c.isArchived = true
	c.updatedAt = time.Now()
}

// Restore marks the company as not archived.
func (c *Company) Restore() {
	c.isArchived = false
	c.updatedAt = time.Now()
}
