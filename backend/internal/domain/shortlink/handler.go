// Package shortlink implements the public s.go/<code> QR shortlink redirect.
//
// Printed QR labels encode s.go/<short_code>. Angie rewrites s.go/{code} ->
// /r/{code} and proxies to this handler, which authenticates via the
// access_token cookie, resolves the code with ONE lookup against the global
// warehouse.short_codes registry (migration 005) scoped to the authed user's
// workspaces, and 302-redirects to the matching dashboard page (or a claim
// wizard when there is no match). Codes are globally unique, so the resolver
// returns at most one match — the old multi-match disambiguation path is gone.
package shortlink

import (
	"context"
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// Entity type tags emitted by the repository result rows (lowercased
// warehouse.short_codes.entity_type values).
const (
	TypeItem      = "item"
	TypeContainer = "container"
	TypeLocation  = "location"
)

const accessTokenCookie = "access_token"

// Match is a single short_code resolution result.
type Match struct {
	Type        string    // TypeItem | TypeContainer | TypeLocation
	ID          uuid.UUID // entity primary key
	WorkspaceID uuid.UUID // owning workspace
	Name        string    // display name of the owning entity ("" if unreadable)
}

// Resolver resolves a short_code against the global registry, scoped to the
// authed user's workspaces. The handler depends on this interface (not the
// concrete postgres repo) so the handler branches can be unit-tested with a
// fake.
type Resolver interface {
	// Resolve returns the registry match for code within the given workspaces.
	// A code that is unknown — or registered to a workspace the user is not a
	// member of — returns (nil, nil).
	Resolve(ctx context.Context, code string, workspaceIDs []uuid.UUID) (*Match, error)
}

// JWTValidator is the subset of jwt.Service the handler needs.
type JWTValidator interface {
	ValidateToken(tokenString string) (*jwt.Claims, error)
}

// WorkspaceLister is the subset of workspace.Service the handler needs.
type WorkspaceLister interface {
	GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*workspace.WorkspaceWithRole, error)
}

// Handler holds dependencies for the shortlink redirect handler.
type Handler struct {
	resolver     Resolver
	jwtValidator JWTValidator
	workspaces   WorkspaceLister
}

// NewHandler creates a new shortlink redirect handler.
func NewHandler(resolver Resolver, jwtValidator JWTValidator, workspaces WorkspaceLister) *Handler {
	return &Handler{
		resolver:     resolver,
		jwtValidator: jwtValidator,
		workspaces:   workspaces,
	}
}

// Redirect handles GET /r/{code}. Raw chi handler (not Huma) because it
// performs browser-facing redirects. Mirrors the oauth.Handler.Initiate style.
func (h *Handler) Redirect(w http.ResponseWriter, r *http.Request) {
	// Treat the path segment verbatim — short codes are case-sensitive
	// alphanumeric, never lowercased.
	code := chi.URLParam(r, "code")

	// --- Auth: read+validate the access_token cookie INLINE. ---
	// A missing/invalid/expired cookie is not a 401 here (that JSON response is
	// what appMiddleware.JWTAuth produces and is wrong for a browser scan);
	// redirect the browser to login with a next that resumes the redirect.
	cookie, err := r.Cookie(accessTokenCookie)
	if err != nil || cookie.Value == "" {
		h.redirectToLogin(w, r, code)
		return
	}
	claims, err := h.jwtValidator.ValidateToken(cookie.Value)
	if err != nil || claims == nil {
		h.redirectToLogin(w, r, code)
		return
	}

	// --- Workspace scoping: only the authed user's workspaces. ---
	wss, err := h.workspaces.GetUserWorkspaces(r.Context(), claims.UserID)
	if err != nil {
		// Treat a lookup failure as "no resolvable workspaces" -> claim wizard,
		// rather than leaking a 500 to a scanning phone.
		http.Redirect(w, r, claimPath(code), http.StatusFound)
		return
	}
	workspaceIDs := make([]uuid.UUID, 0, len(wss))
	for _, ws := range wss {
		if ws == nil || ws.Workspace == nil {
			continue
		}
		workspaceIDs = append(workspaceIDs, ws.ID())
	}

	match, err := h.resolver.Resolve(r.Context(), code, workspaceIDs)
	if err != nil {
		http.Redirect(w, r, claimPath(code), http.StatusFound)
		return
	}
	if match == nil {
		// No match (unknown code or foreign workspace) -> claim wizard with
		// the short_code prefilled.
		http.Redirect(w, r, claimPath(code), http.StatusFound)
		return
	}
	http.Redirect(w, r, entityPath(*match), http.StatusFound)
}

// redirectToLogin sends the browser to the login page with a next
// param that resumes the /r/{code} resolution after authentication. The next
// value is a fixed internal path built server-side (never echoed from the
// client), closing the open-redirect threat T-uzt-04.
func (h *Handler) redirectToLogin(w http.ResponseWriter, r *http.Request, code string) {
	next := "/r/" + code
	dest := "/login?next=" + url.QueryEscape(next)
	http.Redirect(w, r, dest, http.StatusFound)
}

// claimPath builds the claim-wizard path for an unresolved code.
func claimPath(code string) string {
	return "/claim/" + code
}

// entityPath maps a single match to its destination in the v3 route table
// (frontend/src/routes/index.tsx). Containers and locations have no detail
// route (the taxonomy tabs are list-only), so they deep-link via the tab's
// ?focus= param; items have a real detail route.
//
// These were v2.1 Next.js paths ("/{locale}/dashboard/...") until the v3 SPA
// replaced them — every scanned label 302'd into a 404. v3 has no locale path
// segment at all (lingui switches locale in-app), so none is emitted.
func entityPath(m Match) string {
	switch m.Type {
	case TypeItem:
		return "/items/" + m.ID.String()
	case TypeContainer:
		return "/taxonomy?tab=containers&focus=" + m.ID.String()
	case TypeLocation:
		return "/taxonomy?tab=locations&focus=" + m.ID.String()
	default:
		// Unknown type should never happen (repo emits only the three tags);
		// fall back to the claim wizard rather than a broken link.
		return "/claim/"
	}
}
