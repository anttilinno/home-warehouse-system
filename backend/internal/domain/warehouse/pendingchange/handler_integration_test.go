//go:build integration
// +build integration

package pendingchange

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/member"
	"github.com/antti/home-warehouse/go-backend/internal/domain/auth/user"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/borrower"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/category"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/container"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/inventory"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/label"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/loan"
	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/location"
	"github.com/antti/home-warehouse/go-backend/internal/infra/postgres"
)

func getTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://wh:wh@localhost:5432/warehouse_test"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Skipf("skipping integration test: database connection failed: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		t.Skipf("skipping integration test: database ping failed: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

type testUsers struct {
	ownerID  uuid.UUID
	adminID  uuid.UUID
	memberID uuid.UUID
}

func setupTestWorkspace(t *testing.T, pool *pgxpool.Pool) (uuid.UUID, testUsers) {
	t.Helper()
	ctx := context.Background()
	workspaceID := uuid.New()

	users := testUsers{
		ownerID:  uuid.New(),
		adminID:  uuid.New(),
		memberID: uuid.New(),
	}

	// Insert test owner user
	_, err := pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Test Owner', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, users.ownerID, "owner_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert test admin user
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Test Admin', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, users.adminID, "admin_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert test member user
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
		VALUES ($1, $2, 'Test Member', '$2a$10$dummy_hash', false, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, users.memberID, "member_"+uuid.New().String()[:8]+"@example.com")
	require.NoError(t, err)

	// Insert test workspace
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspaces (id, name, slug, created_at, updated_at)
		VALUES ($1, 'Test Workspace', $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, workspaceID, "test-"+uuid.New().String()[:8])
	require.NoError(t, err)

	// Insert workspace memberships
	_, err = pool.Exec(ctx, `
		INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
		VALUES
			(gen_random_uuid(), $1, $2, 'owner', NOW(), NOW()),
			(gen_random_uuid(), $1, $3, 'admin', NOW(), NOW()),
			(gen_random_uuid(), $1, $4, 'member', NOW(), NOW())
		ON CONFLICT DO NOTHING
	`, workspaceID, users.ownerID, users.adminID, users.memberID)
	require.NoError(t, err)

	return workspaceID, users
}

func setupTestAPI(t *testing.T, pool *pgxpool.Pool) (huma.API, *Service, user.Repository) {
	t.Helper()

	// Initialize repositories
	userRepo := postgres.NewUserRepository(pool)
	memberRepo := postgres.NewMemberRepository(pool)
	itemRepo := postgres.NewItemRepository(pool)
	categoryRepo := postgres.NewCategoryRepository(pool)
	locationRepo := postgres.NewLocationRepository(pool)
	containerRepo := postgres.NewContainerRepository(pool)
	inventoryRepo := postgres.NewInventoryRepository(pool)
	borrowerRepo := postgres.NewBorrowerRepository(pool)
	loanRepo := postgres.NewLoanRepository(pool)
	labelRepo := postgres.NewLabelRepository(pool)
	pendingChangeRepo := postgres.NewPendingChangeRepository(pool)

	// Create service
	svc := NewService(
		pendingChangeRepo,
		memberRepo,
		itemRepo,
		categoryRepo,
		locationRepo,
		containerRepo,
		inventoryRepo,
		borrowerRepo,
		loanRepo,
		labelRepo,
	)

	// Create router and API
	r := chi.NewRouter()
	config := huma.DefaultConfig("Test API", "1.0.0")
	config.DocsPath = ""
	config.OpenAPIPath = ""
	api := humachi.New(r, config)

	return api, svc, userRepo
}

func addAuthContext(ctx context.Context, workspaceID uuid.UUID, userID uuid.UUID, role string) context.Context {
	authUser := &appMiddleware.AuthUser{
		ID:       userID,
		Email:    "test@example.com",
		FullName: "Test User",
	}
	ctx = context.WithValue(ctx, appMiddleware.WorkspaceContextKey, workspaceID)
	ctx = context.WithValue(ctx, appMiddleware.UserContextKey, authUser)
	ctx = context.WithValue(ctx, appMiddleware.RoleContextKey, role)
	return ctx
}

func TestPendingChangeHandler_ListPendingChanges(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, users := setupTestWorkspace(t, pool)
	api, svc, userRepo := setupTestAPI(t, pool)

	// Create some pending changes
	payload1 := json.RawMessage(`{"name":"Test Item 1","sku":"TST-001","min_stock_level":0}`)
	change1, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload1)
	require.NoError(t, err)

	payload2 := json.RawMessage(`{"name":"Test Category","description":"A test category"}`)
	change2, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "category", nil, ActionCreate, payload2)
	require.NoError(t, err)

	// Register routes
	RegisterRoutes(api, svc, userRepo)

	t.Run("owner can list all pending changes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/pending-changes", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.ownerID, "owner"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeListResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(result.Changes), 2)
		assert.GreaterOrEqual(t, result.Total, 2)

		// Verify requester details are included
		for _, change := range result.Changes {
			if change.ID == change1.ID() || change.ID == change2.ID() {
				assert.Equal(t, "Test Member", change.RequesterName)
				assert.NotEmpty(t, change.RequesterEmail)
			}
		}
	})

	t.Run("admin can list all pending changes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/pending-changes", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.adminID, "admin"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
	})

	t.Run("member cannot list all pending changes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/pending-changes", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.memberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusForbidden, resp.Code)
	})

	t.Run("filter by status", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/pending-changes?status=pending", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.ownerID, "owner"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeListResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		for _, change := range result.Changes {
			assert.Equal(t, "pending", change.Status)
		}
	})
}

func TestPendingChangeHandler_GetPendingChange(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, users := setupTestWorkspace(t, pool)
	api, svc, userRepo := setupTestAPI(t, pool)

	// Create a pending change
	payload := json.RawMessage(`{"name":"Test Item","sku":"TST-001","min_stock_level":0}`)
	change, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload)
	require.NoError(t, err)

	// Register routes
	RegisterRoutes(api, svc, userRepo)

	t.Run("owner can view pending change", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/pending-changes/"+change.ID().String(), nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.ownerID, "owner"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.Equal(t, change.ID(), result.ID)
		assert.Equal(t, "Test Member", result.RequesterName)
	})

	t.Run("requester can view their own pending change", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/pending-changes/"+change.ID().String(), nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.memberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
	})

	t.Run("other member cannot view pending change", func(t *testing.T) {
		otherMemberID := uuid.New()
		_, err := pool.Exec(ctx, `
			INSERT INTO auth.users (id, email, full_name, password_hash, is_superuser, created_at, updated_at)
			VALUES ($1, $2, 'Other Member', '$2a$10$dummy_hash', false, NOW(), NOW())
		`, otherMemberID, "other_"+uuid.New().String()[:8]+"@example.com")
		require.NoError(t, err)

		_, err = pool.Exec(ctx, `
			INSERT INTO auth.workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, 'member', NOW(), NOW())
		`, workspaceID, otherMemberID)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "/pending-changes/"+change.ID().String(), nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, otherMemberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusForbidden, resp.Code)
	})
}

func TestPendingChangeHandler_ListMyPendingChanges(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, users := setupTestWorkspace(t, pool)
	api, svc, userRepo := setupTestAPI(t, pool)

	// Create pending changes for member
	payload1 := json.RawMessage(`{"name":"My Item 1","sku":"MY-001","min_stock_level":0}`)
	change1, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload1)
	require.NoError(t, err)

	payload2 := json.RawMessage(`{"name":"My Item 2","sku":"MY-002","min_stock_level":0}`)
	_, err = svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload2)
	require.NoError(t, err)

	// Approve one of them
	err = svc.ApproveChange(ctx, change1.ID(), users.ownerID)
	require.NoError(t, err)

	// Register routes
	RegisterRoutes(api, svc, userRepo)

	t.Run("member can list their own pending changes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/my-pending-changes", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.memberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeListResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(result.Changes), 2)
	})

	t.Run("filter by status - pending only", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/my-pending-changes?status=pending", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.memberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeListResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		for _, change := range result.Changes {
			assert.Equal(t, "pending", change.Status)
		}
	})

	t.Run("filter by status - approved only", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/my-pending-changes?status=approved", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.memberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeListResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)

		for _, change := range result.Changes {
			assert.Equal(t, "approved", change.Status)
		}
	})
}

func TestPendingChangeHandler_ApproveChange(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, users := setupTestWorkspace(t, pool)
	api, svc, userRepo := setupTestAPI(t, pool)

	// Create a pending change
	payload := json.RawMessage(`{"name":"Test Item","sku":"TST-001","min_stock_level":0}`)
	change, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload)
	require.NoError(t, err)

	// Register routes
	RegisterRoutes(api, svc, userRepo)

	t.Run("owner can approve pending change", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change.ID().String()+"/approve", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.ownerID, "owner"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.Equal(t, "approved", result.Status)
		assert.NotNil(t, result.ReviewedBy)
		assert.Equal(t, users.ownerID, *result.ReviewedBy)
		assert.NotNil(t, result.ReviewedAt)
		assert.NotNil(t, result.ReviewerName)
		assert.Equal(t, "Test Owner", *result.ReviewerName)
	})

	t.Run("admin can approve pending change", func(t *testing.T) {
		// Create another pending change
		payload2 := json.RawMessage(`{"name":"Another Item","sku":"TST-002","min_stock_level":0}`)
		change2, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload2)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change2.ID().String()+"/approve", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.adminID, "admin"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeResponse
		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.Equal(t, "approved", result.Status)
	})

	t.Run("member cannot approve pending change", func(t *testing.T) {
		// Create another pending change
		payload3 := json.RawMessage(`{"name":"Third Item","sku":"TST-003","min_stock_level":0}`)
		change3, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload3)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change3.ID().String()+"/approve", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.memberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusForbidden, resp.Code)
	})

	t.Run("cannot approve already reviewed change", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change.ID().String()+"/approve", nil)
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.ownerID, "owner"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})
}

func TestPendingChangeHandler_RejectChange(t *testing.T) {
	pool := getTestPool(t)
	ctx := context.Background()
	workspaceID, users := setupTestWorkspace(t, pool)
	api, svc, userRepo := setupTestAPI(t, pool)

	// Create a pending change
	payload := json.RawMessage(`{"name":"Test Item","sku":"TST-001","min_stock_level":0}`)
	change, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload)
	require.NoError(t, err)

	// Register routes
	RegisterRoutes(api, svc, userRepo)

	t.Run("owner can reject pending change", func(t *testing.T) {
		body := `{"reason":"Not needed right now"}`
		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change.ID().String()+"/reject", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.ownerID, "owner"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)

		var result PendingChangeResponse
		err := json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err)
		assert.Equal(t, "rejected", result.Status)
		assert.NotNil(t, result.RejectionReason)
		assert.Equal(t, "Not needed right now", *result.RejectionReason)
		assert.NotNil(t, result.ReviewedBy)
		assert.Equal(t, users.ownerID, *result.ReviewedBy)
	})

	t.Run("admin can reject pending change", func(t *testing.T) {
		// Create another pending change
		payload2 := json.RawMessage(`{"name":"Another Item","sku":"TST-002","min_stock_level":0}`)
		change2, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload2)
		require.NoError(t, err)

		body := `{"reason":"Duplicate item"}`
		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change2.ID().String()+"/reject", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.adminID, "admin"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusOK, resp.Code)
	})

	t.Run("member cannot reject pending change", func(t *testing.T) {
		// Create another pending change
		payload3 := json.RawMessage(`{"name":"Third Item","sku":"TST-003","min_stock_level":0}`)
		change3, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload3)
		require.NoError(t, err)

		body := `{"reason":"I changed my mind"}`
		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change3.ID().String()+"/reject", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.memberID, "member"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusForbidden, resp.Code)
	})

	t.Run("rejection requires reason", func(t *testing.T) {
		// Create another pending change
		payload4 := json.RawMessage(`{"name":"Fourth Item","sku":"TST-004","min_stock_level":0}`)
		change4, err := svc.CreatePendingChange(ctx, workspaceID, users.memberID, "item", nil, ActionCreate, payload4)
		require.NoError(t, err)

		body := `{"reason":""}`
		req := httptest.NewRequest(http.MethodPost, "/pending-changes/"+change4.ID().String()+"/reject", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(addAuthContext(ctx, workspaceID, users.ownerID, "owner"))

		resp := httptest.NewRecorder()
		api.Adapter().ServeHTTP(resp, req)

		assert.Equal(t, http.StatusUnprocessableEntity, resp.Code)
	})
}
