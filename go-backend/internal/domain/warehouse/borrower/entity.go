package borrower

import (
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Borrower struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	name        string
	email       *string
	phone       *string
	notes       *string
	isArchived  bool
	createdAt   time.Time
	updatedAt   time.Time
}

func NewBorrower(workspaceID uuid.UUID, name string, email, phone, notes *string) (*Borrower, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "borrower name is required")
	}

	now := time.Now()
	return &Borrower{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		name:        name,
		email:       email,
		phone:       phone,
		notes:       notes,
		isArchived:  false,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

func Reconstruct(
	id, workspaceID uuid.UUID,
	name string,
	email, phone, notes *string,
	isArchived bool,
	createdAt, updatedAt time.Time,
) *Borrower {
	return &Borrower{
		id:          id,
		workspaceID: workspaceID,
		name:        name,
		email:       email,
		phone:       phone,
		notes:       notes,
		isArchived:  isArchived,
		createdAt:   createdAt,
		updatedAt:   updatedAt,
	}
}

// Getters
func (b *Borrower) ID() uuid.UUID          { return b.id }
func (b *Borrower) WorkspaceID() uuid.UUID { return b.workspaceID }
func (b *Borrower) Name() string           { return b.name }
func (b *Borrower) Email() *string         { return b.email }
func (b *Borrower) Phone() *string         { return b.phone }
func (b *Borrower) Notes() *string         { return b.notes }
func (b *Borrower) IsArchived() bool       { return b.isArchived }
func (b *Borrower) CreatedAt() time.Time   { return b.createdAt }
func (b *Borrower) UpdatedAt() time.Time   { return b.updatedAt }

type UpdateInput struct {
	Name  string
	Email *string
	Phone *string
	Notes *string
}

func (b *Borrower) Update(input UpdateInput) error {
	if input.Name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "borrower name is required")
	}

	b.name = input.Name
	b.email = input.Email
	b.phone = input.Phone
	b.notes = input.Notes
	b.updatedAt = time.Now()
	return nil
}

func (b *Borrower) Archive() {
	b.isArchived = true
	b.updatedAt = time.Now()
}

func (b *Borrower) Restore() {
	b.isArchived = false
	b.updatedAt = time.Now()
}
