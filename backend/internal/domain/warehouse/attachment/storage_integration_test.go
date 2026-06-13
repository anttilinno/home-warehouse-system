//go:build integration
// +build integration

package attachment_test

// Phase 14b Plan 14b-02 — ATT-01 byte-storage round-trip guard.
//
// Why this test exists: the attachment upload route used to record a `files`
// row with a placeholder storage_key and DISCARD the uploaded bytes (no
// Storage.Save call). The unit/handler tests mock the service and therefore
// cannot prove that real bytes land on disk and come back unchanged. This
// test exercises the REAL storage-backed service + the new Chi multipart
// upload route and serve route against a real Postgres, and asserts:
//
//   1. upload persists the exact bytes  (POST .../attachments/file → 201)
//   2. download returns the SAME bytes  (GET /attachments/{id}/file → 200)
//      with Content-Type == sent mime and X-Content-Type-Options: nosniff
//   3. a cross-tenant attachment id on the serve route → 404 (T-14b-04 IDOR)
//
// Run with:
//   cd backend
//   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
//     go test -tags=integration -count=1 \
//     ./internal/domain/warehouse/attachment/... -v

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

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

// newAttachmentRouter builds a chi router with the byte-upload + serve handlers
// registered and a middleware that injects the given workspace + the default
// test user into the request context (mirrors the real workspace closure).
func newAttachmentRouter(t *testing.T, svc attachment.ServiceInterface, store storage.Storage, wsID, userID uuid.UUID) *chi.Mux {
	t.Helper()
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := req.Context()
			ctx = context.WithValue(ctx, appMiddleware.WorkspaceContextKey, wsID)
			ctx = context.WithValue(ctx, appMiddleware.UserContextKey, &appMiddleware.AuthUser{
				ID:    userID,
				Email: "test@example.com",
			})
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	// Pass nil broadcaster — events are not under test here.
	attachment.RegisterUploadHandler(r, svc, nil)
	attachment.RegisterServeHandler(r, svc, store)
	return r
}

// buildMultipart returns a multipart body with a single "file" part carrying
// the given bytes + content type, plus the form content-type header value.
func buildMultipart(t *testing.T, filename, contentType string, payload []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)

	hdr := make(map[string][]string)
	hdr["Content-Disposition"] = []string{`form-data; name="file"; filename="` + filename + `"`}
	hdr["Content-Type"] = []string{contentType}
	part, err := mw.CreatePart(hdr)
	require.NoError(t, err)
	_, err = part.Write(payload)
	require.NoError(t, err)

	require.NoError(t, mw.WriteField("attachment_type", "MANUAL"))
	require.NoError(t, mw.WriteField("title", "round-trip test"))
	require.NoError(t, mw.Close())
	return body, mw.FormDataContentType()
}

func TestAttachment_ByteRoundTrip_Integration(t *testing.T) {
	pool := testdb.SetupTestDB(t)
	ctx := context.Background()

	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	// Real repos + a storage-backed service. t.TempDir() keeps blobs out of the
	// real upload dir and is auto-cleaned, so the test is self-contained.
	fileRepo := postgres.NewFileRepository(pool)
	attachmentRepo := postgres.NewAttachmentRepository(pool)
	store, err := storage.NewLocalStorage(t.TempDir())
	require.NoError(t, err)
	svc := attachment.NewService(fileRepo, attachmentRepo, store)

	// Seed an item so the attachments FK (workspace_id, item_id) holds. Use the
	// real item.Service.Create path (categoryRepo nil — unused without a
	// CategoryID).
	itemSvc := item.NewService(postgres.NewItemRepository(pool), nil)
	seededItem, err := itemSvc.Create(ctx, item.CreateInput{
		WorkspaceID:   workspaceID,
		Name:          "Attachment Host Item",
		SKU:           "ATT-SKU-" + uuid.New().String()[:8],
		MinStockLevel: 0,
	})
	require.NoError(t, err, "seed item must succeed")

	router := newAttachmentRouter(t, svc, store, workspaceID, userID)

	payload := []byte("the quick brown fox jumps over the lazy dog\n\x00\x01\x02binary-tail")
	const sentMime = "application/pdf"

	// --- 1. UPLOAD: real bytes persist → 201 + attachment id ---
	body, formContentType := buildMultipart(t, "manual.pdf", sentMime, payload)
	uploadReq := httptest.NewRequest(http.MethodPost,
		"/items/"+seededItem.ID().String()+"/attachments/file", body)
	uploadReq.Header.Set("Content-Type", formContentType)
	uploadRec := httptest.NewRecorder()
	router.ServeHTTP(uploadRec, uploadReq)

	require.Equal(t, http.StatusCreated, uploadRec.Code, "upload body: %s", uploadRec.Body.String())

	var created attachment.AttachmentResponse
	require.NoError(t, json.Unmarshal(uploadRec.Body.Bytes(), &created))
	require.NotEqual(t, uuid.Nil, created.ID)
	require.NotNil(t, created.FileID, "upload must mint a file id")
	assert.Equal(t, "MANUAL", created.AttachmentType)

	// --- 2. DOWNLOAD: same bytes back, correct mime + nosniff ---
	dlReq := httptest.NewRequest(http.MethodGet,
		"/attachments/"+created.ID.String()+"/file", nil)
	dlRec := httptest.NewRecorder()
	router.ServeHTTP(dlRec, dlReq)

	require.Equal(t, http.StatusOK, dlRec.Code, "download body: %s", dlRec.Body.String())
	assert.Equal(t, payload, dlRec.Body.Bytes(), "downloaded bytes must equal uploaded bytes")
	assert.Equal(t, sentMime, dlRec.Header().Get("Content-Type"))
	assert.Equal(t, "nosniff", dlRec.Header().Get("X-Content-Type-Options"))
	assert.Contains(t, dlRec.Header().Get("Content-Disposition"), "attachment")

	// --- 3. CROSS-TENANT: workspace B asking for ws-A's attachment → 404 ---
	otherWorkspaceID := uuid.New()
	testdb.CreateTestWorkspace(t, pool, otherWorkspaceID)
	otherRouter := newAttachmentRouter(t, svc, store, otherWorkspaceID, userID)

	leakReq := httptest.NewRequest(http.MethodGet,
		"/attachments/"+created.ID.String()+"/file", nil)
	leakRec := httptest.NewRecorder()
	otherRouter.ServeHTTP(leakRec, leakReq)

	require.Equal(t, http.StatusNotFound, leakRec.Code,
		"cross-tenant attachment leak — serve route must scope by workspace_id (T-14b-04); body: %s",
		leakRec.Body.String(),
	)
}
