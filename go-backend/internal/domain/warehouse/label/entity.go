package label

import (
	"regexp"
	"time"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

type Label struct {
	id          uuid.UUID
	workspaceID uuid.UUID
	name        string
	color       *string
	description *string
	isArchived  bool
	createdAt   time.Time
	updatedAt   time.Time
}

var hexColorRegex = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

func NewLabel(workspaceID uuid.UUID, name string, color, description *string) (*Label, error) {
	if err := shared.ValidateUUID(workspaceID, "workspace_id"); err != nil {
		return nil, err
	}
	if name == "" {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "name", "label name is required")
	}
	if color != nil && !hexColorRegex.MatchString(*color) {
		return nil, shared.NewFieldError(shared.ErrInvalidInput, "color", "color must be a valid hex color code")
	}

	now := time.Now()
	return &Label{
		id:          shared.NewUUID(),
		workspaceID: workspaceID,
		name:        name,
		color:       color,
		description: description,
		isArchived:  false,
		createdAt:   now,
		updatedAt:   now,
	}, nil
}

func Reconstruct(id, workspaceID uuid.UUID, name string, color *string, description *string, isArchived bool, createdAt, updatedAt time.Time) *Label {
	return &Label{id, workspaceID, name, color, description, isArchived, createdAt, updatedAt}
}

func (l *Label) ID() uuid.UUID          { return l.id }
func (l *Label) WorkspaceID() uuid.UUID { return l.workspaceID }
func (l *Label) Name() string           { return l.name }
func (l *Label) Color() *string         { return l.color }
func (l *Label) Description() *string   { return l.description }
func (l *Label) IsArchived() bool       { return l.isArchived }
func (l *Label) CreatedAt() time.Time   { return l.createdAt }
func (l *Label) UpdatedAt() time.Time   { return l.updatedAt }

func (l *Label) Update(name string, color, description *string) error {
	if name == "" {
		return shared.NewFieldError(shared.ErrInvalidInput, "name", "label name is required")
	}
	if color != nil && !hexColorRegex.MatchString(*color) {
		return shared.NewFieldError(shared.ErrInvalidInput, "color", "color must be a valid hex color code")
	}
	l.name = name
	l.color = color
	l.description = description
	l.updatedAt = time.Now()
	return nil
}

func (l *Label) Archive() {
	l.isArchived = true
	l.updatedAt = time.Now()
}

// Restore marks the label as not archived.
func (l *Label) Restore() {
	l.isArchived = false
	l.updatedAt = time.Now()
}
