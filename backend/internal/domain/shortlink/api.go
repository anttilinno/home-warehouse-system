package shortlink

import (
	"context"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// The JSON sibling of the browser-facing /r/{code} redirect (Redirect above).
// Same registry, same resolver — but scoped to the ONE workspace in context
// rather than every workspace the user belongs to, and answering with data
// instead of a 302 so the SPA can act on the result without a page load.
//
// Two callers need this:
//   - the create forms, which turn a "short code already exists" 400 into
//     "already used by <name>" plus a link to the owner;
//   - /scan, whose resolve funnel only knows how to look up ITEMS by barcode,
//     so scanning an existing location/container label reports NOT FOUND.

// ResolveShortCodeInput is the path-param input. The 4..12 bounds mirror the
// registry's chk_short_codes_code CHECK — a code outside them can't exist, so
// it is rejected at the edge rather than costing a query.
type ResolveShortCodeInput struct {
	Code string `path:"code" minLength:"4" maxLength:"12" pattern:"^[A-Za-z0-9]+$" doc:"Short code from a printed QR label (case-sensitive)."`
}

type ResolveShortCodeOutput struct {
	Body ShortCodeMatchResponse
}

type ShortCodeMatchResponse struct {
	EntityType string    `json:"entity_type" doc:"item | location | container"`
	EntityID   uuid.UUID `json:"entity_id"`
	Name       string    `json:"name" doc:"Display name of the owning entity."`
}

// RegisterRoutes registers the workspace-scoped JSON resolve route.
func RegisterRoutes(api huma.API, resolver Resolver) {
	huma.Get(api, "/short-codes/{code}", resolveShortCode(resolver))
}

// resolveShortCode answers "which entity owns this code?" within the current
// workspace. An unknown code — or one owned by another workspace — is a 404
// either way, so the route can't be used to probe another tenant's registry.
func resolveShortCode(resolver Resolver) func(context.Context, *ResolveShortCodeInput) (*ResolveShortCodeOutput, error) {
	return func(ctx context.Context, input *ResolveShortCodeInput) (*ResolveShortCodeOutput, error) {
		workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
		if !ok {
			return nil, huma.Error401Unauthorized("workspace context required")
		}

		match, err := resolver.Resolve(ctx, input.Code, []uuid.UUID{workspaceID})
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to resolve short code")
		}
		if match == nil {
			return nil, huma.Error404NotFound("short code not found")
		}

		return &ResolveShortCodeOutput{
			Body: ShortCodeMatchResponse{
				EntityType: match.Type,
				EntityID:   match.ID,
				Name:       match.Name,
			},
		}, nil
	}
}
