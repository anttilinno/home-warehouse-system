// Package shortlink implements the public s.go/<code> QR shortlink redirect.
//
// Printed QR labels encode s.go/<short_code> where short_code is an entity's
// per-workspace VARCHAR(8) code (items, containers, locations). Angie rewrites
// s.go/{code} -> /r/{code} and proxies to this handler, which authenticates via
// the access_token cookie, scopes the lookup to all of the authed user's
// workspaces, resolves the code across the three entity tables (item-first),
// and 302-redirects to the matching dashboard page (or a claim wizard when
// there is no match / more than one match).
package shortlink

import (
	"context"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// Entity type tags used both by the repository result rows and by the encoded
// multi-match list emitted to the claim page. Kept in sync with the Next.js
// claim page decoder.
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
}

// Resolver resolves a short_code across the authed user's workspaces.
// The handler depends on this interface (not the concrete postgres repo) so the
// handler branches can be unit-tested with a fake.
type Resolver interface {
	// Resolve returns every match for code within the given workspaces, ordered
	// item-first so the caller can pick the highest-priority single match. A
	// code with no match returns an empty slice and a nil error.
	Resolve(ctx context.Context, code string, workspaceIDs []uuid.UUID) ([]Match, error)
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
	locale := resolveLocale(r)

	// --- Auth: read+validate the access_token cookie INLINE. ---
	// A missing/invalid/expired cookie is not a 401 here (that JSON response is
	// what appMiddleware.JWTAuth produces and is wrong for a browser scan);
	// redirect the browser to login with a next that resumes the redirect.
	cookie, err := r.Cookie(accessTokenCookie)
	if err != nil || cookie.Value == "" {
		h.redirectToLogin(w, r, locale, code)
		return
	}
	claims, err := h.jwtValidator.ValidateToken(cookie.Value)
	if err != nil || claims == nil {
		h.redirectToLogin(w, r, locale, code)
		return
	}

	// --- Workspace scoping: only the authed user's workspaces. ---
	wss, err := h.workspaces.GetUserWorkspaces(r.Context(), claims.UserID)
	if err != nil {
		// Treat a lookup failure as "no resolvable workspaces" -> claim wizard,
		// rather than leaking a 500 to a scanning phone.
		http.Redirect(w, r, claimPath(locale, code), http.StatusFound)
		return
	}
	workspaceIDs := make([]uuid.UUID, 0, len(wss))
	for _, ws := range wss {
		if ws == nil || ws.Workspace == nil {
			continue
		}
		workspaceIDs = append(workspaceIDs, ws.ID())
	}

	matches, err := h.resolver.Resolve(r.Context(), code, workspaceIDs)
	if err != nil {
		http.Redirect(w, r, claimPath(locale, code), http.StatusFound)
		return
	}

	switch len(matches) {
	case 0:
		// No match -> claim wizard with the short_code prefilled.
		http.Redirect(w, r, claimPath(locale, code), http.StatusFound)
	case 1:
		http.Redirect(w, r, entityPath(locale, matches[0]), http.StatusFound)
	default:
		// >1 match across the user's workspaces -> disambiguation picker.
		dest := claimPath(locale, code) + "?matches=" + url.QueryEscape(encodeMatches(matches))
		http.Redirect(w, r, dest, http.StatusFound)
	}
}

// redirectToLogin sends the browser to the locale-scoped login page with a next
// param that resumes the /r/{code} resolution after authentication. The next
// value is a fixed internal path built server-side (never echoed from the
// client), closing the open-redirect threat T-uzt-04.
func (h *Handler) redirectToLogin(w http.ResponseWriter, r *http.Request, locale, code string) {
	next := "/r/" + code
	dest := "/" + locale + "/login?next=" + url.QueryEscape(next)
	http.Redirect(w, r, dest, http.StatusFound)
}

// claimPath builds the claim-wizard path for an unresolved / multi-match code.
func claimPath(locale, code string) string {
	return "/" + locale + "/dashboard/claim/" + code
}

// entityPath maps a single match to its dashboard destination. Containers and
// locations have no [id] detail route (list-only), so they deep-link via a
// focus query param the list page reads; items have a real detail route.
func entityPath(locale string, m Match) string {
	switch m.Type {
	case TypeItem:
		return "/" + locale + "/dashboard/items/" + m.ID.String()
	case TypeContainer:
		return "/" + locale + "/dashboard/containers?focus=" + m.ID.String()
	case TypeLocation:
		return "/" + locale + "/dashboard/locations?focus=" + m.ID.String()
	default:
		// Unknown type should never happen (repo emits only the three tags);
		// fall back to the claim wizard rather than a broken link.
		return "/" + locale + "/dashboard/claim/"
	}
}

// encodeMatches serialises the multi-match list as a comma-joined list of
// "type:id" triples. URL-safe, human-debuggable, and decoded identically by the
// Next.js claim page. The whole blob is url.QueryEscaped by the caller.
func encodeMatches(matches []Match) string {
	parts := make([]string, 0, len(matches))
	for _, m := range matches {
		parts = append(parts, m.Type+":"+m.ID.String())
	}
	return strings.Join(parts, ",")
}

// resolveLocale picks the redirect locale: NEXT_LOCALE cookie -> first
// Accept-Language tag -> "en".
func resolveLocale(r *http.Request) string {
	if c, err := r.Cookie("NEXT_LOCALE"); err == nil && c.Value != "" {
		return sanitizeLocale(c.Value)
	}
	if al := r.Header.Get("Accept-Language"); al != "" {
		// First tag, dropping any quality / region suffix: "et-EE,en;q=0.9" -> "et".
		first := strings.TrimSpace(strings.SplitN(al, ",", 2)[0])
		first = strings.SplitN(first, ";", 2)[0]
		first = strings.SplitN(first, "-", 2)[0]
		if loc := sanitizeLocale(first); loc != "" {
			return loc
		}
	}
	return "en"
}

// sanitizeLocale keeps only a short lowercase alpha tag, defending the
// server-built redirect path from a tampered cookie/header (T-uzt-04).
func sanitizeLocale(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" || len(v) > 8 {
		return "en"
	}
	for _, ch := range v {
		if ch < 'a' || ch > 'z' {
			return "en"
		}
	}
	return v
}
