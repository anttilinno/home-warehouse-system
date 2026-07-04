//go:build integration
// +build integration

package inventory_test

// Backend Idempotency-Key support for offline-created inventory (stock) entries
// — the C-create half of Offline PWA v2 (.planning/OFFLINE-PWA-V2-PLAN.md). A
// replayed CREATE (same client Idempotency-Key, resent on reconnect after a
// lost response) must return the ORIGINAL inventory entry instead of creating a
// duplicate stock row. Mirrors item/idempotency_integration_test.go: real
// Postgres via tests/testdb, real services, a minimal chi+huma surface.
//
// Run with:
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 ./internal/domain/warehouse/inventory/... -v

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/movement"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

func newInventoryTestAPI(svc inventory.ServiceInterface, wsID, userID uuid.UUID) *chi.Mux {
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
	inventory.RegisterRoutes(api, svc, nil)
	return r
}

func postCreateInventory(router *chi.Mux, itemID, locationID uuid.UUID, idempotencyKey string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(map[string]any{
		"item_id":     itemID,
		"location_id": locationID,
		"quantity":    1,
		"condition":   "GOOD",
		"status":      "AVAILABLE",
	})
	req := httptest.NewRequest(http.MethodPost, "/inventory", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

// TestInventoryHandler_Idempotency_Integration exercises the real
// POST /inventory handler + inventory.Service + Postgres idempotency store.
func TestInventoryHandler_Idempotency_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	itemRepo := postgres.NewItemRepository(pool)
	locationRepo := postgres.NewLocationRepository(pool)
	containerRepo := postgres.NewContainerRepository(pool)
	categoryRepo := postgres.NewCategoryRepository(pool)
	movementRepo := postgres.NewMovementRepository(pool)
	inventoryRepo := postgres.NewInventoryRepository(pool)
	idemRepo := postgres.NewIdempotencyRepository(pool)

	itemSvc := item.NewService(itemRepo, categoryRepo)
	locationSvc := location.NewService(locationRepo)
	movementSvc := movement.NewService(movementRepo)
	svc := inventory.NewService(inventoryRepo, movementSvc, itemRepo, locationRepo, containerRepo)
	svc.SetIdempotencyStore(idemRepo)

	// seedItemAndLocation creates a real item + location in the workspace so an
	// inventory create passes its cross-workspace FK validation.
	seedItemAndLocation := func(t *testing.T, wsID uuid.UUID) (uuid.UUID, uuid.UUID) {
		t.Helper()
		ctx := context.Background()
		it, err := itemSvc.Create(ctx, item.CreateInput{
			WorkspaceID:   wsID,
			SKU:           "INV-IDEM-" + uuid.New().String()[:8],
			Name:          "Idempotency Test Item",
			MinStockLevel: 0,
		})
		require.NoError(t, err)
		loc, err := locationSvc.Create(ctx, location.CreateInput{
			WorkspaceID: wsID,
			Name:        "Idempotency Test Location",
		})
		require.NoError(t, err)
		return it.ID(), loc.ID()
	}

	countInventory := func(t *testing.T, wsID uuid.UUID) int {
		t.Helper()
		var n int
		err := pool.QueryRow(context.Background(),
			`SELECT count(*) FROM warehouse.inventory WHERE workspace_id = $1`, wsID).Scan(&n)
		require.NoError(t, err)
		return n
	}

	t.Run("replayed create with the same Idempotency-Key returns the original entry, no duplicate row", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)
		itemID, locationID := seedItemAndLocation(t, wsID)
		router := newInventoryTestAPI(svc, wsID, userID)

		idemKey := uuid.New().String()

		first := postCreateInventory(router, itemID, locationID, idemKey)
		require.Equal(t, http.StatusOK, first.Code, "body: %s", first.Body.String())
		var firstResp inventory.InventoryResponse
		require.NoError(t, json.Unmarshal(first.Body.Bytes(), &firstResp))

		second := postCreateInventory(router, itemID, locationID, idemKey)
		require.Equal(t, http.StatusOK, second.Code, "replay must succeed, not 4xx; body: %s", second.Body.String())
		var secondResp inventory.InventoryResponse
		require.NoError(t, json.Unmarshal(second.Body.Bytes(), &secondResp))

		require.Equal(t, firstResp.ID, secondResp.ID, "replay must return the SAME entry id")
		require.Equal(t, 1, countInventory(t, wsID), "exactly one row must exist in warehouse.inventory")
	})

	t.Run("no Idempotency-Key: two creates make two independent rows", func(t *testing.T) {
		wsID := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsID)
		itemID, locationID := seedItemAndLocation(t, wsID)
		router := newInventoryTestAPI(svc, wsID, userID)

		first := postCreateInventory(router, itemID, locationID, "")
		require.Equal(t, http.StatusOK, first.Code, "body: %s", first.Body.String())
		second := postCreateInventory(router, itemID, locationID, "")
		require.Equal(t, http.StatusOK, second.Code, "body: %s", second.Body.String())

		require.Equal(t, 2, countInventory(t, wsID),
			"without a dedup key, two creates are two distinct stock rows")
	})

	t.Run("same Idempotency-Key in two different workspaces creates independently in each", func(t *testing.T) {
		wsA := uuid.New()
		wsB := uuid.New()
		testdb.CreateTestWorkspace(t, pool, wsA)
		testdb.CreateTestWorkspace(t, pool, wsB)
		itemA, locA := seedItemAndLocation(t, wsA)
		itemB, locB := seedItemAndLocation(t, wsB)
		routerA := newInventoryTestAPI(svc, wsA, userID)
		routerB := newInventoryTestAPI(svc, wsB, userID)

		idemKey := uuid.New().String()

		respA := postCreateInventory(routerA, itemA, locA, idemKey)
		require.Equal(t, http.StatusOK, respA.Code, "body: %s", respA.Body.String())
		var invA inventory.InventoryResponse
		require.NoError(t, json.Unmarshal(respA.Body.Bytes(), &invA))

		respB := postCreateInventory(routerB, itemB, locB, idemKey)
		require.Equal(t, http.StatusOK, respB.Code, "body: %s", respB.Body.String())
		var invB inventory.InventoryResponse
		require.NoError(t, json.Unmarshal(respB.Body.Bytes(), &invB))

		require.NotEqual(t, invA.ID, invB.ID, "same idem key in different workspaces must create independent entries")
		require.Equal(t, 1, countInventory(t, wsA))
		require.Equal(t, 1, countInventory(t, wsB))
	})
}
