package paperless

import (
	"context"
	"errors"
	"time"

	"github.com/danielgtaylor/huma/v2"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	infrapaperless "github.com/antti/home-warehouse/go-backend/internal/infra/paperless"
)

const (
	pathPaperlessSettings       = "/paperless/settings"
	msgWorkspaceContextRequired = "workspace context required"
)

// RegisterRoutes registers Paperless integration routes on the workspace tree.
//
// Attach/detach of a Paperless document to an item is intentionally NOT here:
// it rides the existing attachment endpoints (POST /items/{item_id}/attachments
// with external_doc_id, DELETE /attachments/{id}).
func RegisterRoutes(api huma.API, svc ServiceInterface) {
	huma.Get(api, pathPaperlessSettings, getSettings(svc))
	huma.Put(api, pathPaperlessSettings, saveSettings(svc))
	huma.Delete(api, pathPaperlessSettings, deleteSettings(svc))
	huma.Get(api, "/paperless/search", searchDocuments(svc))
	huma.Get(api, "/paperless/documents/{id}", resolveDocument(svc))
}

// getSettings returns workspace Paperless settings. Always 200; configured=false
// when the workspace has no settings row yet.
func getSettings(svc ServiceInterface) func(context.Context, *struct{}) (*GetSettingsOutput, error) {
	return func(ctx context.Context, _ *struct{}) (*GetSettingsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		settings, err := svc.GetSettings(ctx, workspaceID)
		if err != nil {
			if errors.Is(err, ErrNotConfigured) {
				return &GetSettingsOutput{Body: SettingsResponse{Configured: false}}, nil
			}
			return nil, huma.Error500InternalServerError("failed to load paperless settings")
		}

		return &GetSettingsOutput{Body: toSettingsResponse(settings)}, nil
	}
}

// saveSettings creates or updates workspace Paperless settings. The token is
// write-only: omit api_token to keep the stored one; the response never includes it.
func saveSettings(svc ServiceInterface) func(context.Context, *SaveSettingsInputBody) (*GetSettingsOutput, error) {
	return func(ctx context.Context, input *SaveSettingsInputBody) (*GetSettingsOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		settings, err := svc.SaveSettings(ctx, workspaceID, SaveSettingsInput{
			BaseURL:         input.Body.BaseURL,
			APIToken:        input.Body.APIToken,
			SyncTagsEnabled: input.Body.SyncTagsEnabled,
			IsEnabled:       input.Body.IsEnabled,
		})
		if err != nil {
			switch {
			case errors.Is(err, ErrInvalidBaseURL), errors.Is(err, ErrTokenRequired):
				return nil, huma.Error400BadRequest(err.Error())
			case errors.Is(err, ErrEncryptionKeyMissing):
				return nil, huma.Error503ServiceUnavailable(err.Error())
			}
			return nil, huma.Error500InternalServerError("failed to save paperless settings")
		}

		return &GetSettingsOutput{Body: toSettingsResponse(settings)}, nil
	}
}

// deleteSettings removes the workspace's Paperless configuration entirely.
func deleteSettings(svc ServiceInterface) func(context.Context, *struct{}) (*struct{}, error) {
	return func(ctx context.Context, _ *struct{}) (*struct{}, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		if err := svc.DeleteSettings(ctx, workspaceID); err != nil {
			return nil, huma.Error500InternalServerError("failed to delete paperless settings")
		}
		return nil, nil
	}
}

// searchDocuments proxies a fulltext search to GET {base_url}/api/documents/?query=.
func searchDocuments(svc ServiceInterface) func(context.Context, *SearchInput) (*SearchOutput, error) {
	return func(ctx context.Context, input *SearchInput) (*SearchOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		result, err := svc.Search(ctx, workspaceID, input.Query, input.Page, input.PageSize)
		if err != nil {
			return nil, mapIntegrationError(err)
		}

		docs := make([]DocumentResponse, len(result.Results))
		for i, doc := range result.Results {
			docs[i] = DocumentResponse{
				ID:               doc.ID,
				Title:            doc.Title,
				Created:          doc.Created,
				OriginalFileName: doc.OriginalFileName,
			}
		}

		return &SearchOutput{Body: SearchResponse{Count: result.Count, Results: docs}}, nil
	}
}

// resolveDocument resolves a Paperless document id for display
// (title + download/preview/web URLs).
func resolveDocument(svc ServiceInterface) func(context.Context, *ResolveDocumentInput) (*ResolveDocumentOutput, error) {
	return func(ctx context.Context, input *ResolveDocumentInput) (*ResolveDocumentOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized(msgWorkspaceContextRequired)
		}

		details, err := svc.ResolveDocument(ctx, workspaceID, input.ID)
		if err != nil {
			return nil, mapIntegrationError(err)
		}

		return &ResolveDocumentOutput{Body: DocumentDetailsResponse{
			ID:               details.ID,
			Title:            details.Title,
			Created:          details.Created,
			OriginalFileName: details.OriginalFileName,
			DownloadURL:      details.DownloadURL,
			PreviewURL:       details.PreviewURL,
			WebURL:           details.WebURL,
		}}, nil
	}
}

// mapIntegrationError translates service/client errors into HTTP errors.
func mapIntegrationError(err error) error {
	switch {
	case errors.Is(err, ErrNotConfigured), errors.Is(err, ErrNotEnabled):
		return huma.Error409Conflict(err.Error())
	case errors.Is(err, ErrEncryptionKeyMissing):
		return huma.Error503ServiceUnavailable(err.Error())
	case errors.Is(err, infrapaperless.ErrUnauthorized):
		// 502: OUR token toward Paperless is bad — not the caller's auth.
		return huma.Error502BadGateway("paperless rejected the configured API token")
	case errors.Is(err, infrapaperless.ErrDocumentNotFound):
		return huma.Error404NotFound("paperless document not found")
	case errors.Is(err, infrapaperless.ErrUnavailable):
		return huma.Error502BadGateway("paperless instance unavailable")
	}
	return huma.Error500InternalServerError("paperless request failed")
}

func toSettingsResponse(s *Settings) SettingsResponse {
	return SettingsResponse{
		Configured:      true,
		BaseURL:         s.BaseURL,
		IsEnabled:       s.IsEnabled,
		SyncTagsEnabled: s.SyncTagsEnabled,
		HasToken:        s.HasToken,
		LastSyncAt:      s.LastSyncAt,
		UpdatedAt:       &s.UpdatedAt,
	}
}

// Request/Response types

type SettingsResponse struct {
	Configured      bool       `json:"configured" doc:"Whether the workspace has Paperless settings stored"`
	BaseURL         string     `json:"base_url,omitempty" doc:"Paperless-ngx instance base URL"`
	IsEnabled       bool       `json:"is_enabled" doc:"Whether the integration is active"`
	SyncTagsEnabled bool       `json:"sync_tags_enabled" doc:"Whether label/tag sync is requested (not yet implemented)"`
	HasToken        bool       `json:"has_token" doc:"Whether an API token is stored (the token itself is never returned)"`
	LastSyncAt      *time.Time `json:"last_sync_at,omitempty"`
	UpdatedAt       *time.Time `json:"updated_at,omitempty"`
}

type GetSettingsOutput struct {
	Body SettingsResponse
}

type SaveSettingsInputBody struct {
	Body struct {
		BaseURL         string  `json:"base_url" minLength:"1" maxLength:"500" doc:"Paperless-ngx instance base URL, e.g. https://paperless.k3s.lan"`
		APIToken        *string `json:"api_token,omitempty" maxLength:"500" doc:"Paperless API token. Omit to keep the currently stored token."`
		IsEnabled       bool    `json:"is_enabled" doc:"Enable/disable the integration"`
		SyncTagsEnabled bool    `json:"sync_tags_enabled" doc:"Request label/tag sync (stored, not yet consumed)"`
	}
}

type SearchInput struct {
	Query    string `query:"query" minLength:"1" maxLength:"500" doc:"Fulltext query forwarded to Paperless"`
	Page     int    `query:"page" default:"1" minimum:"1"`
	PageSize int    `query:"page_size" default:"20" minimum:"1" maximum:"100"`
}

type DocumentResponse struct {
	ID               int     `json:"id"`
	Title            string  `json:"title"`
	Created          *string `json:"created,omitempty"`
	OriginalFileName *string `json:"original_file_name,omitempty"`
}

type SearchResponse struct {
	Count   int                `json:"count"`
	Results []DocumentResponse `json:"results"`
}

type SearchOutput struct {
	Body SearchResponse
}

type ResolveDocumentInput struct {
	ID int `path:"id" minimum:"1" doc:"Paperless document id"`
}

type DocumentDetailsResponse struct {
	ID               int     `json:"id"`
	Title            string  `json:"title"`
	Created          *string `json:"created,omitempty"`
	OriginalFileName *string `json:"original_file_name,omitempty"`
	DownloadURL      string  `json:"download_url" doc:"Direct download URL on the Paperless instance"`
	PreviewURL       string  `json:"preview_url" doc:"Inline preview URL on the Paperless instance"`
	WebURL           string  `json:"web_url" doc:"Deep link to the document page in the Paperless web UI"`
}

type ResolveDocumentOutput struct {
	Body DocumentDetailsResponse
}
