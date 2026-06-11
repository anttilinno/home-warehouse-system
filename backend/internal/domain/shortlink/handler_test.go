package shortlink

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/workspace"
	"github.com/antti/home-warehouse/go-backend/internal/shared/jwt"
)

// --- fakes ---

type fakeResolver struct {
	match *Match
	err   error
	// captured args
	gotCode      string
	gotWorkspace []uuid.UUID
}

func (f *fakeResolver) Resolve(_ context.Context, code string, workspaceIDs []uuid.UUID) (*Match, error) {
	f.gotCode = code
	f.gotWorkspace = workspaceIDs
	if f.err != nil {
		return nil, f.err
	}
	return f.match, nil
}

type fakeWorkspaceLister struct {
	workspaceIDs []uuid.UUID
	err          error
}

func (f *fakeWorkspaceLister) GetUserWorkspaces(_ context.Context, _ uuid.UUID) ([]*workspace.WorkspaceWithRole, error) {
	if f.err != nil {
		return nil, f.err
	}
	out := make([]*workspace.WorkspaceWithRole, 0, len(f.workspaceIDs))
	for _, id := range f.workspaceIDs {
		out = append(out, &workspace.WorkspaceWithRole{
			Workspace: workspace.Reconstruct(id, "ws", "ws-"+id.String(), nil, false, time.Time{}, time.Time{}),
			Role:      "owner",
		})
	}
	return out, nil
}

// --- helpers ---

const testSecret = "test-secret-shortlink"

func newTestJWT() *jwt.Service { return jwt.NewService(testSecret, 24) }

func validTokenFor(t *testing.T, svc *jwt.Service) string {
	t.Helper()
	tok, err := svc.GenerateToken(uuid.New(), "u@example.com", "User", false)
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	return tok
}

// doRequest wires the handler into a chi router so chi.URLParam("code") works,
// optionally attaching an access_token cookie, then returns the recorder.
func doRequest(t *testing.T, h *Handler, code, token string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	router := chi.NewRouter()
	router.Get("/r/{code}", h.Redirect)

	req := httptest.NewRequest(http.MethodGet, "/r/"+code, nil)
	if token != "" {
		req.AddCookie(&http.Cookie{Name: accessTokenCookie, Value: token})
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// --- tests ---

func TestRedirect_NoCookie_RedirectsToLogin(t *testing.T) {
	h := NewHandler(&fakeResolver{}, newTestJWT(), &fakeWorkspaceLister{})
	rec := doRequest(t, h, "ABC123", "")

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	got := rec.Header().Get("Location")
	want := "/en/login?next=" + url.QueryEscape("/r/ABC123")
	if got != want {
		t.Fatalf("Location = %q, want %q", got, want)
	}
}

func TestRedirect_InvalidToken_RedirectsToLogin(t *testing.T) {
	h := NewHandler(&fakeResolver{}, newTestJWT(), &fakeWorkspaceLister{})
	rec := doRequest(t, h, "ABC123", "not-a-real-jwt")

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	if !strings.HasPrefix(rec.Header().Get("Location"), "/en/login?next=") {
		t.Fatalf("Location = %q, want login redirect", rec.Header().Get("Location"))
	}
}

func TestRedirect_SingleItemMatch(t *testing.T) {
	svc := newTestJWT()
	itemID := uuid.New()
	wsID := uuid.New()
	res := &fakeResolver{match: &Match{Type: TypeItem, ID: itemID, WorkspaceID: wsID}}
	h := NewHandler(res, svc, &fakeWorkspaceLister{workspaceIDs: []uuid.UUID{wsID}})

	rec := doRequest(t, h, "ITEMXX", validTokenFor(t, svc))

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	want := "/en/dashboard/items/" + itemID.String()
	if got := rec.Header().Get("Location"); got != want {
		t.Fatalf("Location = %q, want %q", got, want)
	}
	// Resolver received the verbatim code and the user's workspace IDs.
	if res.gotCode != "ITEMXX" {
		t.Fatalf("resolver code = %q, want ITEMXX", res.gotCode)
	}
	if len(res.gotWorkspace) != 1 || res.gotWorkspace[0] != wsID {
		t.Fatalf("resolver workspaces = %v, want [%s]", res.gotWorkspace, wsID)
	}
}

func TestRedirect_SingleContainerMatch(t *testing.T) {
	svc := newTestJWT()
	id := uuid.New()
	res := &fakeResolver{match: &Match{Type: TypeContainer, ID: id, WorkspaceID: uuid.New()}}
	h := NewHandler(res, svc, &fakeWorkspaceLister{workspaceIDs: []uuid.UUID{uuid.New()}})

	rec := doRequest(t, h, "CONTNR", validTokenFor(t, svc))

	want := "/en/dashboard/containers?focus=" + id.String()
	if got := rec.Header().Get("Location"); got != want {
		t.Fatalf("Location = %q, want %q", got, want)
	}
}

func TestRedirect_SingleLocationMatch(t *testing.T) {
	svc := newTestJWT()
	id := uuid.New()
	res := &fakeResolver{match: &Match{Type: TypeLocation, ID: id, WorkspaceID: uuid.New()}}
	h := NewHandler(res, svc, &fakeWorkspaceLister{workspaceIDs: []uuid.UUID{uuid.New()}})

	rec := doRequest(t, h, "LOCXYZ", validTokenFor(t, svc))

	want := "/en/dashboard/locations?focus=" + id.String()
	if got := rec.Header().Get("Location"); got != want {
		t.Fatalf("Location = %q, want %q", got, want)
	}
}

func TestRedirect_NotFound_RedirectsToClaim(t *testing.T) {
	svc := newTestJWT()
	res := &fakeResolver{match: nil}
	h := NewHandler(res, svc, &fakeWorkspaceLister{workspaceIDs: []uuid.UUID{uuid.New()}})

	rec := doRequest(t, h, "NOPE12", validTokenFor(t, svc))

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	want := "/en/dashboard/claim/NOPE12"
	if got := rec.Header().Get("Location"); got != want {
		t.Fatalf("Location = %q, want %q", got, want)
	}
}

// TestRedirect_ForeignWorkspace_RedirectsToClaim covers the membership-check
// branch: the registry resolver returns nil for a code owned by a workspace
// the user is not a member of, so the handler falls back to the claim wizard
// (the same observable behaviour as a genuinely unknown code).
func TestRedirect_ForeignWorkspace_RedirectsToClaim(t *testing.T) {
	svc := newTestJWT()
	res := &fakeResolver{match: nil} // registry scoped the lookup -> no row
	userWs := uuid.New()
	h := NewHandler(res, svc, &fakeWorkspaceLister{workspaceIDs: []uuid.UUID{userWs}})

	rec := doRequest(t, h, "FOREIGN1", validTokenFor(t, svc))

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302", rec.Code)
	}
	if got := rec.Header().Get("Location"); got != "/en/dashboard/claim/FOREIGN1" {
		t.Fatalf("Location = %q, want claim fallback", got)
	}
	// The resolver must have been scoped to exactly the user's workspaces.
	if len(res.gotWorkspace) != 1 || res.gotWorkspace[0] != userWs {
		t.Fatalf("resolver workspaces = %v, want [%s]", res.gotWorkspace, userWs)
	}
}

func TestRedirect_LocaleFromCookie(t *testing.T) {
	svc := newTestJWT()
	res := &fakeResolver{match: nil}
	h := NewHandler(res, svc, &fakeWorkspaceLister{workspaceIDs: []uuid.UUID{uuid.New()}})

	rec := doRequest(t, h, "NOPE12", validTokenFor(t, svc),
		&http.Cookie{Name: "NEXT_LOCALE", Value: "et"})

	if got := rec.Header().Get("Location"); got != "/et/dashboard/claim/NOPE12" {
		t.Fatalf("Location = %q, want et locale", got)
	}
}

func TestRedirect_LocaleFromAcceptLanguage(t *testing.T) {
	svc := newTestJWT()
	res := &fakeResolver{match: nil}
	h := NewHandler(res, svc, &fakeWorkspaceLister{workspaceIDs: []uuid.UUID{uuid.New()}})

	router := chi.NewRouter()
	router.Get("/r/{code}", h.Redirect)
	req := httptest.NewRequest(http.MethodGet, "/r/NOPE12", nil)
	req.AddCookie(&http.Cookie{Name: accessTokenCookie, Value: validTokenFor(t, svc)})
	req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9,en;q=0.8")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if got := rec.Header().Get("Location"); got != "/ru/dashboard/claim/NOPE12" {
		t.Fatalf("Location = %q, want ru locale", got)
	}
}

func TestRedirect_WorkspaceLookupError_RedirectsToClaim(t *testing.T) {
	svc := newTestJWT()
	h := NewHandler(&fakeResolver{}, svc, &fakeWorkspaceLister{err: errors.New("db down")})

	rec := doRequest(t, h, "ANYXXX", validTokenFor(t, svc))

	if got := rec.Header().Get("Location"); got != "/en/dashboard/claim/ANYXXX" {
		t.Fatalf("Location = %q, want claim fallback", got)
	}
}
