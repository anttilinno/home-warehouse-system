//go:build integration
// +build integration

package attachment_test

// Phase 14b Plan 14b-01 — ATT-03 cross-tenant IDOR regression guard (audit F1).
//
// Why this test exists: the handler unit test (handler_test.go) mocks
// ServiceInterface and therefore cannot distinguish "attachment belongs to
// another workspace" from "attachment never existed" — both surface as
// ErrAttachmentNotFound. The SQL clause `WHERE id = $1 AND workspace_id = $2`
// (FindByID:138, Delete:110, ListByItem:197 in attachments.sql.go) is the
// source of truth for cross-tenant scoping. This test exercises the real repos
// + real Postgres and asserts that truth directly: a leaked attachment UUID
// from workspace A is unreachable (404) from workspace B, and a cross-tenant
// DELETE neither succeeds nor destroys the row.
//
// Catches BACKEND regressions only (route removed, service wrapper wiring
// changed, repo FindByID/Delete clause un-scoped). A revert of the f49e4b48
// "tenant isolation threading" change fails here.
//
// Run with:
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 ./internal/domain/warehouse/attachment/... -v

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
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/attachment"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
	"github.com/antti/home-warehouse/go-backend/internal/infra/storage"
	"github.com/antti/home-warehouse/go-backend/tests/testdb"
)

// TestAttachmentHandler_CrossTenant_Integration runs the /attachments/{id}
// GET + DELETE handlers against a real Postgres connection with a real
// attachment.Service wired to real file + attachment repositories.
func TestAttachmentHandler_CrossTenant_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	ctx := context.Background()

	// workspace A = the testdb default workspace (the test user is a member).
	workspaceA := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	// workspace B = a distinct tenant; the middleware injects this for the
	// cross-tenant calls. A caller in B must never reach A's attachment.
	workspaceB := uuid.New()
	testdb.CreateTestWorkspace(t, pool, workspaceB)

	// Build real repos + service (no mocks).
	fileRepo := postgres.NewFileRepository(pool)
	attachmentRepo := postgres.NewAttachmentRepository(pool)
	store, err := storage.NewLocalStorage(t.TempDir())
	require.NoError(t, err)
	svc := attachment.NewService(fileRepo, attachmentRepo, store)

	// An item is needed so the attachment's item_id FK holds. Seed it via the
	// real item service in workspace A.
	itemRepo := postgres.NewItemRepository(pool)
	itemSvc := item.NewService(itemRepo, nil)
	seededItem, err := itemSvc.Create(ctx, item.CreateInput{
		WorkspaceID:   workspaceA,
		Name:          "Attachment Host Item",
		SKU:           "ATT-SKU-" + uuid.New().String()[:8],
		MinStockLevel: 0,
	})
	require.NoError(t, err, "seed item must succeed")
	require.NotNil(t, seededItem)

	// Seed a backing file in workspace A. The DB check constraint
	// `attachments_has_reference` requires every attachment to reference a
	// file_id OR an external_doc_id, so we attach a real file here.
	seededFile, err := svc.UploadFile(ctx, attachment.UploadFileInput{
		WorkspaceID:  workspaceA,
		OriginalName: "tenant-a-manual.pdf",
		Extension:    ".pdf",
		MimeType:     "application/pdf",
		SizeBytes:    1234,
		Checksum:     "deadbeef",
		StorageKey:   fmt.Sprintf("uploads/%s/%s/seed.pdf", workspaceA, seededItem.ID()),
	})
	require.NoError(t, err, "seed file must succeed")
	require.NotNil(t, seededFile)
	fileID := seededFile.ID()

	// Seed an attachment in workspace A via the real service.
	title := "secret-tenant-A-manual"
	seeded, err := svc.CreateAttachment(ctx, attachment.CreateAttachmentInput{
		WorkspaceID:    workspaceA,
		ItemID:         seededItem.ID(),
		FileID:         &fileID,
		AttachmentType: attachment.TypeManual,
		Title:          &title,
		IsPrimary:      false,
	})
	require.NoError(t, err, "seed attachment must succeed")
	require.NotNil(t, seeded)
	attachmentID := seeded.ID()

	// Build a minimal chi+huma test surface that injects the workspace/user
	// context middleware the handler's appMiddleware.GetWorkspaceID expects.
	// This mirrors the item handler_integration_test.go harness but is inlined
	// so the test stays buildable under the integration build tag.
	newRouter := func(wsID uuid.UUID) *chi.Mux {
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
		attachment.RegisterRoutes(api, svc, nil)
		return r
	}

	doGet := func(router *chi.Mux, path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	doDelete := func(router *chi.Mux, path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodDelete, path, nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	routerA := newRouter(workspaceA)
	routerB := newRouter(workspaceB)
	attPath := fmt.Sprintf("/attachments/%s", attachmentID)

	t.Run("control: same-tenant GET returns 200 with the seeded attachment", func(t *testing.T) {
		rec := doGet(routerA, attPath)
		require.Equal(t, http.StatusOK, rec.Code, "body: %s", rec.Body.String())

		var resp attachment.AttachmentResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.Equal(t, attachmentID, resp.ID)
		assert.Equal(t, seededItem.ID(), resp.ItemID)
		require.NotNil(t, resp.Title)
		assert.Equal(t, title, *resp.Title)
	})

	t.Run("cross-tenant GET returns 404, not workspace-A's row", func(t *testing.T) {
		// Caller is in workspace B requesting an id that only exists in A.
		// MUST be 404 — anything else is a cross-tenant metadata leak.
		rec := doGet(routerB, attPath)
		require.Equal(t, http.StatusNotFound, rec.Code,
			"cross-tenant attachment leak — FindByID WHERE clause must scope by workspace_id; body: %s",
			rec.Body.String(),
		)
		assert.NotContains(t, rec.Body.String(), title,
			"cross-tenant response must not echo the other tenant's attachment title")
	})

	t.Run("cross-tenant DELETE returns 404 and the attachment survives", func(t *testing.T) {
		// Caller is in workspace B attempting a destructive delete of A's id.
		rec := doDelete(routerB, attPath)
		require.Equal(t, http.StatusNotFound, rec.Code,
			"cross-tenant delete must 404 — Delete WHERE clause must scope by workspace_id; body: %s",
			rec.Body.String(),
		)

		// The row MUST still exist when read back from workspace A.
		recAfter := doGet(routerA, attPath)
		require.Equal(t, http.StatusOK, recAfter.Code,
			"attachment must survive a cross-tenant delete attempt; body: %s",
			recAfter.Body.String(),
		)

		// Belt-and-braces: the service itself still finds it under workspace A.
		stillThere, err := svc.GetAttachment(ctx, attachmentID, workspaceA)
		require.NoError(t, err, "attachment must still be retrievable in its own workspace")
		require.NotNil(t, stillThere)
		assert.Equal(t, attachmentID, stillThere.ID())
	})
}
