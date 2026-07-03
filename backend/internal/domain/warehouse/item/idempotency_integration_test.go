//go:build integration
// +build integration

package item_test

// Backend Idempotency-Key support for the offline-first PWA (plan section
// "Backend"). A replayed CREATE (same client Idempotency-Key) must return
// the ORIGINAL entity instead of creating a duplicate — otherwise a create
// whose response was lost mid-drop (offline-queued mutation replay) produces
// duplicate items on reconnect. Mirrors the handler_integration_test.go
// style (real Postgres via tests/testdb, real service, a minimal chi+huma
// test surface).
//
// Run with:
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 ./internal/domain/warehouse/item/... -v

import (
	"bytes"
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
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

func newIdempotencyTestAPI(svc item.ServiceInterface, wsID uuid.UUID, userID uuid.UUID) *chi.Mux {
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
	return r
}

func postCreateItem(router *chi.Mux, sku, shortCode, idempotencyKey string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(map[string]any{
		"sku":             sku,
		"name":            "Idempotency Test Item",
		"min_stock_level": 0,
		"short_code":      shortCode,
	})
	req := httptest.NewRequest(http.MethodPost, "/items", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// TestItemHandler_Idempotency_Integration exercises the real
// POST /items handler + item.Service + Postgres idempotency store.
func TestItemHandler_Idempotency_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	itemRepo := postgres.NewItemRepository(pool)
	idemRepo := postgres.NewIdempotencyRepository(pool)
	svc := item.NewService(itemRepo, nil)
	svc.SetIdempotencyStore(idemRepo)

	countItems := func(t *testing.T, wsID uuid.UUID) int {
		t.Helper()
		var n int
		err := pool.QueryRow(context.Background(),
			`SELECT count(*) FROM warehouse.items WHERE workspace_id = $1`, wsID).Scan(&n)
		require.NoError(t, err)
		return n
	}

	t.Run("replayed create with the same Idempotency-Key returns the original item, no duplicate row", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)
		router := newIdempotencyTestAPI(svc, wsID, userID)

		idemKey := uuid.New().String()
		sku := "IDEM-SKU-" + uuid.New().String()[:8]
		shortCode := "IDM" + uuid.New().String()[:5]

		first := postCreateItem(router, sku, shortCode, idemKey)
		require.Equal(t, http.StatusOK, first.Code, "body: %s", first.Body.String())
		var firstResp item.ItemResponse
		require.NoError(t, json.Unmarshal(first.Body.Bytes(), &firstResp))

		second := postCreateItem(router, sku, shortCode, idemKey)
		require.Equal(t, http.StatusOK, second.Code, "replay must succeed, not 4xx; body: %s", second.Body.String())
		var secondResp item.ItemResponse
		require.NoError(t, json.Unmarshal(second.Body.Bytes(), &secondResp))

		require.Equal(t, firstResp.ID, secondResp.ID, "replay must return the SAME entity id")
		require.Equal(t, 1, countItems(t, wsID), "exactly one row must exist in warehouse.items")
	})

	t.Run("different Idempotency-Keys with a colliding client short_code still 4xx (human-typo path intact)", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)
		router := newIdempotencyTestAPI(svc, wsID, userID)

		shortCode := "COL" + uuid.New().String()[:5]

		first := postCreateItem(router, "SKU-A-"+uuid.New().String()[:8], shortCode, uuid.New().String())
		require.Equal(t, http.StatusOK, first.Code, "body: %s", first.Body.String())

		// A genuinely different create (different idempotency key) that
		// happens to reuse the same short_code must still be rejected — the
		// idempotency dedup is keyed on the idem key, NOT the short_code.
		second := postCreateItem(router, "SKU-B-"+uuid.New().String()[:8], shortCode, uuid.New().String())
		require.True(t, second.Code >= 400 && second.Code < 500,
			"expected a 4xx short-code-taken error, got %d: %s", second.Code, second.Body.String())
		require.Equal(t, 1, countItems(t, wsID), "the colliding create must NOT have inserted a row")
	})

	t.Run("same Idempotency-Key in two different workspaces creates independently in each", func(t *testing.T) {
		wsA := uuid.New()
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		testdb.CreateTestWorkspace(t, pool, wsB)
		routerA := newIdempotencyTestAPI(svc, wsA, userID)
		routerB := newIdempotencyTestAPI(svc, wsB, userID)

		idemKey := uuid.New().String()

		respA := postCreateItem(routerA, "SKU-WSA-"+uuid.New().String()[:8], fmt.Sprintf("WSA%s", uuid.New().String()[:5]), idemKey)
		require.Equal(t, http.StatusOK, respA.Code, "body: %s", respA.Body.String())
		var itemA item.ItemResponse
		require.NoError(t, json.Unmarshal(respA.Body.Bytes(), &itemA))

		respB := postCreateItem(routerB, "SKU-WSB-"+uuid.New().String()[:8], fmt.Sprintf("WSB%s", uuid.New().String()[:5]), idemKey)
		require.Equal(t, http.StatusOK, respB.Code, "body: %s", respB.Body.String())
		var itemB item.ItemResponse
		require.NoError(t, json.Unmarshal(respB.Body.Bytes(), &itemB))

		require.NotEqual(t, itemA.ID, itemB.ID, "same idem key in different workspaces must create independent entities")
		require.Equal(t, 1, countItems(t, wsA))
		require.Equal(t, 1, countItems(t, wsB))
	})
}
