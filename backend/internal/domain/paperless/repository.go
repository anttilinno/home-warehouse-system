package paperless

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// StoredSettings is the persisted per-workspace Paperless configuration,
// including the encrypted API token. It never leaves the service layer —
// handlers only ever see Settings (which carries has_token, not the token).
type StoredSettings struct {
	ID                uuid.UUID
	WorkspaceID       uuid.UUID
	BaseURL           string
	APITokenEncrypted string
	SyncTagsEnabled   bool
	IsEnabled         bool
	LastSyncAt        *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// UpsertParams carries the full desired state for a workspace's settings row.
type UpsertParams struct {
	WorkspaceID       uuid.UUID
	BaseURL           string
	APITokenEncrypted string
	SyncTagsEnabled   bool
	IsEnabled         bool
}

// Repository persists per-workspace Paperless settings.
// All operations are workspace-scoped.
type Repository interface {
	Get(ctx context.Context, workspaceID uuid.UUID) (*StoredSettings, error)
	Upsert(ctx context.Context, params UpsertParams) (*StoredSettings, error)
	Delete(ctx context.Context, workspaceID uuid.UUID) error
}
