package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/antti/home-warehouse/go-backend/internal/domain/paperless"
	"github.com/antti/home-warehouse/go-backend/internal/infra/queries"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
)

// PaperlessSettingsRepository persists per-workspace Paperless-ngx settings
// (auth.workspace_paperless_settings).
type PaperlessSettingsRepository struct {
	pool    *pgxpool.Pool
	queries *queries.Queries
}

func NewPaperlessSettingsRepository(pool *pgxpool.Pool) *PaperlessSettingsRepository {
	return &PaperlessSettingsRepository{
		pool:    pool,
		queries: queries.New(pool),
	}
}

func (r *PaperlessSettingsRepository) Get(ctx context.Context, workspaceID uuid.UUID) (*paperless.StoredSettings, error) {
	row, err := r.queries.GetWorkspacePaperlessSettings(ctx, workspaceID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, shared.ErrNotFound
		}
		return nil, err
	}
	return rowToStoredSettings(row), nil
}

func (r *PaperlessSettingsRepository) Upsert(ctx context.Context, params paperless.UpsertParams) (*paperless.StoredSettings, error) {
	syncTags := params.SyncTagsEnabled
	isEnabled := params.IsEnabled
	row, err := r.queries.UpsertWorkspacePaperlessSettings(ctx, queries.UpsertWorkspacePaperlessSettingsParams{
		ID:                shared.NewUUID(),
		WorkspaceID:       params.WorkspaceID,
		BaseUrl:           params.BaseURL,
		ApiTokenEncrypted: params.APITokenEncrypted,
		SyncTagsEnabled:   &syncTags,
		IsEnabled:         &isEnabled,
	})
	if err != nil {
		return nil, err
	}
	return rowToStoredSettings(row), nil
}

func (r *PaperlessSettingsRepository) Delete(ctx context.Context, workspaceID uuid.UUID) error {
	return r.queries.DeleteWorkspacePaperlessSettings(ctx, workspaceID)
}

func rowToStoredSettings(row queries.AuthWorkspacePaperlessSetting) *paperless.StoredSettings {
	syncTags := false
	if row.SyncTagsEnabled != nil {
		syncTags = *row.SyncTagsEnabled
	}
	isEnabled := false
	if row.IsEnabled != nil {
		isEnabled = *row.IsEnabled
	}
	var lastSyncAt *time.Time
	if row.LastSyncAt.Valid {
		t := row.LastSyncAt.Time
		lastSyncAt = &t
	}

	return &paperless.StoredSettings{
		ID:                row.ID,
		WorkspaceID:       row.WorkspaceID,
		BaseURL:           row.BaseUrl,
		APITokenEncrypted: row.ApiTokenEncrypted,
		SyncTagsEnabled:   syncTags,
		IsEnabled:         isEnabled,
		LastSyncAt:        lastSyncAt,
		CreatedAt:         row.CreatedAt.Time,
		UpdatedAt:         row.UpdatedAt.Time,
	}
}
