package shortlink

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// Reuses fakeResolver from handler_test.go.

func TestResolveShortCodeRoute(t *testing.T) {
	t.Run("resolves a known code to its entity", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		entityID := uuid.MustParse("00000000-0000-0000-0000-0000000000aa")
		fake := &fakeResolver{match: &Match{
			Type:        TypeLocation,
			ID:          entityID,
			WorkspaceID: setup.WorkspaceID,
			Name:        "Garage shelf B",
		}}
		RegisterRoutes(setup.API, fake)

		rec := setup.Get("/short-codes/7F3K2A")

		testutil.AssertStatus(t, rec, http.StatusOK)
		body := rec.Body.String()
		for _, want := range []string{`"entity_type":"location"`, entityID.String(), "Garage shelf B"} {
			if !strings.Contains(body, want) {
				t.Fatalf("response %q missing %q", body, want)
			}
		}
		// Scoped to the ONE workspace in context, never the user's full set.
		if len(fake.gotWorkspace) != 1 || fake.gotWorkspace[0] != setup.WorkspaceID {
			t.Fatalf("expected scope [%s], got %v", setup.WorkspaceID, fake.gotWorkspace)
		}
		// Codes are case-sensitive — the path segment is passed through verbatim.
		if fake.gotCode != "7F3K2A" {
			t.Fatalf("expected code 7F3K2A, got %q", fake.gotCode)
		}
	})

	t.Run("unknown code is 404", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		RegisterRoutes(setup.API, &fakeResolver{match: nil})

		testutil.AssertStatus(t, setup.Get("/short-codes/ZZZZ99"), http.StatusNotFound)
	})

	t.Run("a foreign-workspace code is 404, not a leak", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		// The repo returns (nil, nil) for a code owned by another workspace —
		// indistinguishable from unknown, by design.
		RegisterRoutes(setup.API, &fakeResolver{match: nil})

		testutil.AssertStatus(t, setup.Get("/short-codes/OTHER1"), http.StatusNotFound)
	})

	t.Run("resolver failure is 500", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		RegisterRoutes(setup.API, &fakeResolver{err: errors.New("db down")})

		testutil.AssertStatus(t, setup.Get("/short-codes/7F3K2A"), http.StatusInternalServerError)
	})

	t.Run("codes outside the registry CHECK are rejected at the edge", func(t *testing.T) {
		setup := testutil.NewHandlerTestSetup()
		fake := &fakeResolver{match: nil}
		RegisterRoutes(setup.API, fake)

		// 3 chars (below the 4..12 CHECK) and a non-alphanumeric code never
		// reach the resolver.
		testutil.AssertStatus(t, setup.Get("/short-codes/ABC"), http.StatusUnprocessableEntity)
		testutil.AssertStatus(t, setup.Get("/short-codes/AB-CD"), http.StatusUnprocessableEntity)
		if fake.gotCode != "" {
			t.Fatalf("resolver was called with %q; validation should have short-circuited", fake.gotCode)
		}
	})
}
