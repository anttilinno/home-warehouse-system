// Package paperless implements the workspace-scoped Paperless-ngx DMS
// integration: settings CRUD (encrypted API token at rest), fulltext search
// proxy, and document resolution for display/deep-linking.
//
// Read-only by design: there is no ingest/write path to Paperless. Linking a
// document to an item is "manual attach" — the user searches or pastes an
// existing Paperless document id, which lands in
// warehouse.attachments.external_doc_id (dms_type = 'paperless').
//
// TODO(tag-sync): warehouse labels <-> Paperless tags sync is a deliberate
// later step (docs/ROADMAP.md "DMS Migration"); sync_tags_enabled is stored
// but not yet consumed.
package paperless

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	infrapaperless "github.com/antti/home-warehouse/go-backend/internal/infra/paperless"
	"github.com/antti/home-warehouse/go-backend/internal/shared"
	"github.com/antti/home-warehouse/go-backend/internal/shared/crypto"
)

// DocumentClient is the read-only Paperless API surface the service needs.
// Implemented by infra/paperless.Client.
type DocumentClient interface {
	GetDocument(ctx context.Context, baseURL, token string, documentID int) (*infrapaperless.Document, error)
	Search(ctx context.Context, baseURL, token, query string, page, pageSize int) (*infrapaperless.SearchResult, error)
}

// Settings is the handler-facing view of a workspace's Paperless settings.
// The API token is never exposed — only whether one is stored.
type Settings struct {
	BaseURL         string
	SyncTagsEnabled bool
	IsEnabled       bool
	HasToken        bool
	LastSyncAt      *time.Time
	UpdatedAt       time.Time
}

// DocumentDetails is a resolved Paperless document plus the URLs the UI
// needs: API download/preview plus the human-facing web page deep link.
type DocumentDetails struct {
	ID               int
	Title            string
	Created          *string
	OriginalFileName *string
	DownloadURL      string
	PreviewURL       string
	WebURL           string
}

// ServiceInterface defines the Paperless integration operations.
type ServiceInterface interface {
	GetSettings(ctx context.Context, workspaceID uuid.UUID) (*Settings, error)
	SaveSettings(ctx context.Context, workspaceID uuid.UUID, input SaveSettingsInput) (*Settings, error)
	DeleteSettings(ctx context.Context, workspaceID uuid.UUID) error
	Search(ctx context.Context, workspaceID uuid.UUID, query string, page, pageSize int) (*infrapaperless.SearchResult, error)
	ResolveDocument(ctx context.Context, workspaceID uuid.UUID, documentID int) (*DocumentDetails, error)
}

type Service struct {
	repo      Repository
	client    DocumentClient
	encryptor *crypto.Encryptor // nil when PAPERLESS_TOKEN_KEY is unset
}

// NewService creates the Paperless service. encryptor may be nil (token key
// not configured); settings writes that include a token will then fail with
// ErrEncryptionKeyMissing rather than storing anything in plaintext.
func NewService(repo Repository, client DocumentClient, encryptor *crypto.Encryptor) *Service {
	return &Service{repo: repo, client: client, encryptor: encryptor}
}

func (s *Service) GetSettings(ctx context.Context, workspaceID uuid.UUID) (*Settings, error) {
	stored, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		if errors.Is(err, shared.ErrNotFound) {
			return nil, ErrNotConfigured
		}
		return nil, err
	}
	return toSettings(stored), nil
}

// SaveSettingsInput carries a settings upsert. A nil APIToken means "keep the
// already-stored token" (required to exist); a non-nil one replaces it.
type SaveSettingsInput struct {
	BaseURL         string
	APIToken        *string
	SyncTagsEnabled bool
	IsEnabled       bool
}

func (s *Service) SaveSettings(ctx context.Context, workspaceID uuid.UUID, input SaveSettingsInput) (*Settings, error) {
	baseURL, err := normalizeBaseURL(input.BaseURL)
	if err != nil {
		return nil, err
	}

	existing, err := s.repo.Get(ctx, workspaceID)
	if err != nil && !errors.Is(err, shared.ErrNotFound) {
		return nil, err
	}

	var encryptedToken string
	switch {
	case input.APIToken != nil && *input.APIToken != "":
		if s.encryptor == nil {
			return nil, ErrEncryptionKeyMissing
		}
		encryptedToken, err = s.encryptor.Encrypt(*input.APIToken)
		if err != nil {
			return nil, fmt.Errorf("encrypt api token: %w", err)
		}
	case existing != nil:
		encryptedToken = existing.APITokenEncrypted
	default:
		return nil, ErrTokenRequired
	}

	stored, err := s.repo.Upsert(ctx, UpsertParams{
		WorkspaceID:       workspaceID,
		BaseURL:           baseURL,
		APITokenEncrypted: encryptedToken,
		SyncTagsEnabled:   input.SyncTagsEnabled,
		IsEnabled:         input.IsEnabled,
	})
	if err != nil {
		return nil, err
	}
	return toSettings(stored), nil
}

func (s *Service) DeleteSettings(ctx context.Context, workspaceID uuid.UUID) error {
	return s.repo.Delete(ctx, workspaceID)
}

func (s *Service) Search(ctx context.Context, workspaceID uuid.UUID, query string, page, pageSize int) (*infrapaperless.SearchResult, error) {
	baseURL, token, err := s.connection(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	return s.client.Search(ctx, baseURL, token, query, page, pageSize)
}

func (s *Service) ResolveDocument(ctx context.Context, workspaceID uuid.UUID, documentID int) (*DocumentDetails, error) {
	baseURL, token, err := s.connection(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	doc, err := s.client.GetDocument(ctx, baseURL, token, documentID)
	if err != nil {
		return nil, err
	}

	return &DocumentDetails{
		ID:               doc.ID,
		Title:            doc.Title,
		Created:          doc.Created,
		OriginalFileName: doc.OriginalFileName,
		DownloadURL:      fmt.Sprintf("%s/api/documents/%d/download/", baseURL, doc.ID),
		PreviewURL:       fmt.Sprintf("%s/api/documents/%d/preview/", baseURL, doc.ID),
		WebURL:           fmt.Sprintf("%s/documents/%d/details", baseURL, doc.ID),
	}, nil
}

// connection loads the workspace's settings and returns a ready-to-use
// (baseURL, decrypted token) pair, enforcing is_enabled.
func (s *Service) connection(ctx context.Context, workspaceID uuid.UUID) (string, string, error) {
	stored, err := s.repo.Get(ctx, workspaceID)
	if err != nil {
		if errors.Is(err, shared.ErrNotFound) {
			return "", "", ErrNotConfigured
		}
		return "", "", err
	}
	if !stored.IsEnabled {
		return "", "", ErrNotEnabled
	}
	if s.encryptor == nil {
		return "", "", ErrEncryptionKeyMissing
	}
	token, err := s.encryptor.Decrypt(stored.APITokenEncrypted)
	if err != nil {
		return "", "", fmt.Errorf("decrypt api token: %w", err)
	}
	return strings.TrimRight(stored.BaseURL, "/"), token, nil
}

func toSettings(stored *StoredSettings) *Settings {
	return &Settings{
		BaseURL:         stored.BaseURL,
		SyncTagsEnabled: stored.SyncTagsEnabled,
		IsEnabled:       stored.IsEnabled,
		HasToken:        stored.APITokenEncrypted != "",
		LastSyncAt:      stored.LastSyncAt,
		UpdatedAt:       stored.UpdatedAt,
	}
}

// normalizeBaseURL validates and trims the configured base URL.
func normalizeBaseURL(raw string) (string, error) {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")
	if trimmed == "" {
		return "", ErrInvalidBaseURL
	}
	u, err := url.Parse(trimmed)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", ErrInvalidBaseURL
	}
	return trimmed, nil
}
