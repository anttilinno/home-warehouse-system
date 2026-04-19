//go:build integration
// +build integration

package item_test

// Phase 65 Plan 65-11 — G-65-01 regression guard (Branch B: Go integration test).
//
// Why this test exists: the handler unit test (TestItemHandler_LookupByBarcode
// in handler_test.go) mocks ServiceInterface and therefore cannot distinguish
// "item exists in another workspace" from "item never existed" — both surface
// as ErrItemNotFound. The SQL clause `WHERE barcode = $2 AND workspace_id = $1`
// is the source of truth for cross-tenant scoping. This test exercises the
// real repo + real Postgres and asserts that truth directly.
//
// Catches BACKEND regressions only (route removed, service wrapper wiring
// changed, repo FindByBarcode clause broken). Frontend-side reverts of Plan
// 65-10 are caught by the sibling Playwright spec at frontend2/e2e/scan-lookup.spec.ts.
//
// Run with:
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 ./internal/domain/warehouse/item/... -v

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// TestItemHandler_LookupByBarcode_Integration runs the /items/by-barcode/{code}
// handler against a real Postgres connection with a real item.Service wired to
// a real item repository.
func TestItemHandler_LookupByBarcode_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	ctx := context.Background()

	// Use the default test workspace from testdb.SetupTestDB.
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	// Build real repo + service (no mocks). categoryRepo is nil because the
	// LookupByBarcode path never consults it; Service.Create only touches
	// categoryRepo when CategoryID is set, which we never do in seeding.
	itemRepo := postgres.NewItemRepository(pool)
	svc := item.NewService(itemRepo, nil)

	// Build a minimal chi+huma test surface that injects the workspace/user
	// context middleware the handler's appMiddleware.GetWorkspaceID expects.
	// This mirrors testutil.NewHandlerTestSetup but is inlined here so the
	// test remains buildable without pulling testutil under the integration
	// build tag.
	newAPI := func(wsID uuid.UUID) (huma.API, *chi.Mux) {
		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				reqCtx := req.Context()
				reqCtx = context.WithValue(reqCtx, appMiddleware.WorkspaceContextKey, wsID)
				reqCtx = context.WithValue(reqCtx, appMiddleware.UserContextKey, &appMiddleware.AuthUser{
					ID:    userID,
					Email: "test@example.com",
				})
				next.ServeHTTP(w, req.WithContext(reqCtx))
			})
		})
		config := huma.DefaultConfig("Integration Test API", "1.0.0")
		api := humachi.New(r, config)
		item.RegisterRoutes(api, svc, nil, nil, nil)
		return api, r
	}

	doGet := func(router *chi.Mux, path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	// Seed an item via the real Service.Create path so the short_code auto-
	// generation + barcode persistence exercise the same code production does.
	barcode := fmt.Sprintf("INT-TEST-%s", uuid.New().String()[:8])
	seeded, err := svc.Create(ctx, item.CreateInput{
		WorkspaceID:   workspaceID,
		Name:          "Integration Test Cola",
		SKU:           "INT-SKU-" + uuid.New().String()[:8],
		Barcode:       &barcode,
		MinStockLevel: 0,
	})
	require.NoError(t, err, "seed item must succeed")
	require.NotNil(t, seeded)
	require.NotNil(t, seeded.Barcode())
	require.Equal(t, barcode, *seeded.Barcode())

	_, router := newAPI(workspaceID)

	t.Run("returns 200 with the seeded item on exact barcode match (G-65-01 happy path)", func(t *testing.T) {
		rec := doGet(router, fmt.Sprintf("/items/by-barcode/%s", barcode))
		require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())

		var resp item.ItemResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.Equal(t, seeded.ID(), resp.ID)
		assert.Equal(t, workspaceID, resp.WorkspaceID)
		assert.NotNil(t, resp.Barcode)
		assert.Equal(t, barcode, *resp.Barcode)
		assert.Equal(t, "Integration Test Cola", resp.Name)
	})

	t.Run("returns 404 for non-existent barcode", func(t *testing.T) {
		// Guaranteed-unique code with the same shape guard the Service uses.
		unknownCode := "NEVER-EXISTED-" + uuid.New().String()[:8]
		rec := doGet(router, fmt.Sprintf("/items/by-barcode/%s", unknownCode))
		require.Equal(t, http.StatusNotFound, rec.Code, "body: %s", rec.Body.String())
	})

	t.Run("returns 404 for barcode that only exists in another workspace (cross-tenant isolation)", func(t *testing.T) {
		// This is the truth the handler unit test cannot assert: with a mocked
		// service "other workspace" is indistinguishable from "never existed".
		// Here we actually seed the barcode in a different workspace and query
		// from OURS — the SQL WHERE workspace_id = $1 clause in FindByBarcode
		// is what makes this return 404.
		otherWorkspaceID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, otherWorkspaceID)

		otherBarcode := fmt.Sprintf("OTHER-WS-%s", uuid.New().String()[:8])
		otherItem, err := svc.Create(ctx, item.CreateInput{
			WorkspaceID:   otherWorkspaceID,
			Name:          "Other Workspace Item",
			SKU:           "OTHER-SKU-" + uuid.New().String()[:8],
			Barcode:       &otherBarcode,
			MinStockLevel: 0,
		})
		require.NoError(t, err, "seed into other workspace must succeed")
		require.NotNil(t, otherItem)

		// Query from OUR workspace's router for a barcode that only exists in
		// otherWorkspaceID. MUST be 404 — anything else is a cross-tenant leak.
		rec := doGet(router, fmt.Sprintf("/items/by-barcode/%s", otherBarcode))
		require.Equal(t, http.StatusNotFound, rec.Code,
			"cross-tenant barcode leak — FindByBarcode WHERE clause must scope by workspace_id; body: %s",
			rec.Body.String(),
		)
	})
}
