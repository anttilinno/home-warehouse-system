# Phase 2 Quick Start Guide

**Goal**: Add handler tests for all 22 handlers to increase coverage from 53.9% → 78.9%

## Pre-Flight Checklist

Before starting Phase 2, verify:

- [ ] Phase 1 is complete: `bash docs/go-tests/scripts/validate-phase-1.sh`
- [ ] Overall coverage is ~54%: `go test ./... -short -cover | grep total`
- [ ] All Phase 1 tests pass: `go test ./... -short`
- [ ] Git working tree is clean or Phase 1 changes committed

**Run pre-flight check:**
```bash
bash docs/go-tests/scripts/validate-phase-2.sh --pre-flight
```

## Task 2.1: Handler Test Infrastructure (2 hours)

### Step 1: Create testutil package directory

```bash
mkdir -p internal/testutil
```

### Step 2: Create handler test utilities

Create `internal/testutil/handler.go` with this complete template:

```go
package testutil

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	appMiddleware "github.com/antti/home-warehouse/go-backend/internal/api/middleware"
)

// HandlerTestSetup provides common test infrastructure for handler tests
type HandlerTestSetup struct {
	Router      *chi.Mux
	API         huma.API
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
}

// NewHandlerTestSetup creates a new test setup with injected workspace context
func NewHandlerTestSetup() *HandlerTestSetup {
	r := chi.NewRouter()
	workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	userID := uuid.MustParse("00000000-0000-0000-0000-000000000002")

	// Inject workspace and user context middleware for testing
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := req.Context()
			ctx = context.WithValue(ctx, appMiddleware.WorkspaceContextKey, workspaceID)
			ctx = context.WithValue(ctx, appMiddleware.UserContextKey, userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})

	config := huma.DefaultConfig("Test API", "1.0.0")
	api := humachi.New(r, config)

	return &HandlerTestSetup{
		Router:      r,
		API:         api,
		WorkspaceID: workspaceID,
		UserID:      userID,
	}
}

// Request makes an HTTP request with JSON body
func (h *HandlerTestSetup) Request(method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.Router.ServeHTTP(rec, req)
	return rec
}

// Get makes a GET request
func (h *HandlerTestSetup) Get(path string) *httptest.ResponseRecorder {
	return h.Request("GET", path, "")
}

// Post makes a POST request with JSON body
func (h *HandlerTestSetup) Post(path, body string) *httptest.ResponseRecorder {
	return h.Request("POST", path, body)
}

// Put makes a PUT request with JSON body
func (h *HandlerTestSetup) Put(path, body string) *httptest.ResponseRecorder {
	return h.Request("PUT", path, body)
}

// Patch makes a PATCH request with JSON body
func (h *HandlerTestSetup) Patch(path, body string) *httptest.ResponseRecorder {
	return h.Request("PATCH", path, body)
}

// Delete makes a DELETE request
func (h *HandlerTestSetup) Delete(path string) *httptest.ResponseRecorder {
	return h.Request("DELETE", path, "")
}

// ParseJSONResponse parses the response body as JSON into the given type
func ParseJSONResponse[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	var result T
	err := json.Unmarshal(rec.Body.Bytes(), &result)
	assert.NoError(t, err, "Failed to parse response body")
	return result
}

// AssertStatus asserts the response status code
func AssertStatus(t *testing.T, rec *httptest.ResponseRecorder, expected int) {
	assert.Equal(t, expected, rec.Code, "Response body: %s", rec.Body.String())
}

// AssertErrorResponse asserts that the response is an error with the expected message
func AssertErrorResponse(t *testing.T, rec *httptest.ResponseRecorder, expectedStatus int, expectedMsg string) {
	AssertStatus(t, rec, expectedStatus)

	var errResp struct {
		Error   string `json:"error"`
		Message string `json:"message"`
	}
	err := json.Unmarshal(rec.Body.Bytes(), &errResp)
	assert.NoError(t, err)

	if expectedMsg != "" {
		assert.Contains(t, errResp.Message, expectedMsg)
	}
}
```

### Step 3: Test the infrastructure

Create `internal/testutil/handler_test.go`:

```go
package testutil

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHandlerTestSetup(t *testing.T) {
	setup := NewHandlerTestSetup()

	assert.NotNil(t, setup.Router)
	assert.NotNil(t, setup.API)
	assert.NotEqual(t, "", setup.WorkspaceID.String())
	assert.NotEqual(t, "", setup.UserID.String())
}

func TestHandlerTestSetup_Request(t *testing.T) {
	setup := NewHandlerTestSetup()

	// Register a test route
	setup.Router.Get("/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message":"ok"}`))
	})

	rec := setup.Get("/test")

	assert.Equal(t, http.StatusOK, rec.Code)
}
```

### Step 4: Verify infrastructure works

```bash
go test ./internal/testutil -v
```

**Expected:** All tests pass

---

## Task 2.2: Warehouse Handler Tests (25-30 hours)

This is the largest task. We'll create handler tests for 13 warehouse domain handlers.

### Template for Each Handler

Each handler test follows this pattern:

1. Create `handler_test.go` file
2. Define mock service
3. Test Create endpoint
4. Test List endpoint
5. Test Get endpoint
6. Test Update endpoint
7. Test Delete endpoint
8. Test any special endpoints (Search, etc.)

### Step 1: Item Handler (first example)

Create `internal/domain/warehouse/item/handler_test.go`:

```go
package item_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
	"github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockItemService implements item.Service interface
type MockItemService struct {
	mock.Mock
}

func (m *MockItemService) Create(ctx context.Context, workspaceID uuid.UUID, input item.CreateInput) (*item.Item, error) {
	args := m.Called(ctx, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemService) List(ctx context.Context, workspaceID uuid.UUID, offset, limit int) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, offset, limit)
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

func (m *MockItemService) Update(ctx context.Context, id, workspaceID uuid.UUID, input item.UpdateInput) (*item.Item, error) {
	args := m.Called(ctx, id, workspaceID, input)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*item.Item), args.Error(1)
}

func (m *MockItemService) Delete(ctx context.Context, id, workspaceID uuid.UUID) error {
	args := m.Called(ctx, id, workspaceID)
	return args.Error(0)
}

func (m *MockItemService) Search(ctx context.Context, workspaceID uuid.UUID, query string, offset, limit int) ([]*item.Item, int, error) {
	args := m.Called(ctx, workspaceID, query, offset, limit)
	return args.Get(0).([]*item.Item), args.Int(1), args.Error(2)
}

// Tests

func TestItemHandler_Create(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockItemService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("creates item successfully", func(t *testing.T) {
		testItem := &item.Item{
			ID:          uuid.New(),
			WorkspaceID: setup.WorkspaceID,
			Name:        "Laptop",
			SKU:         "LAP-001",
		}

		mockSvc.On("Create", mock.Anything, setup.WorkspaceID, mock.MatchedBy(func(input item.CreateInput) bool {
			return input.Name == "Laptop" && input.SKU == "LAP-001"
		})).Return(testItem, nil).Once()

		body := `{"name":"Laptop","sku":"LAP-001"}`
		rec := setup.Post(fmt.Sprintf("/workspaces/%s/items", setup.WorkspaceID), body)

		testutil.AssertStatus(t, rec, http.StatusCreated)
		response := testutil.ParseJSONResponse[item.Item](t, rec)
		assert.Equal(t, "Laptop", response.Name)
		mockSvc.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid input", func(t *testing.T) {
		body := `{"name":""}` // Empty name
		rec := setup.Post(fmt.Sprintf("/workspaces/%s/items", setup.WorkspaceID), body)

		testutil.AssertErrorResponse(t, rec, http.StatusBadRequest, "name")
	})
}

func TestItemHandler_List(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockItemService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("lists items successfully", func(t *testing.T) {
		items := []*item.Item{
			{ID: uuid.New(), Name: "Item 1"},
			{ID: uuid.New(), Name: "Item 2"},
		}

		mockSvc.On("List", mock.Anything, setup.WorkspaceID, 0, 20).
			Return(items, 2, nil).Once()

		rec := setup.Get(fmt.Sprintf("/workspaces/%s/items", setup.WorkspaceID))

		testutil.AssertStatus(t, rec, http.StatusOK)
	})
}

func TestItemHandler_Get(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockItemService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("gets item by ID", func(t *testing.T) {
		itemID := uuid.New()
		testItem := &item.Item{
			ID:   itemID,
			Name: "Laptop",
		}

		mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
			Return(testItem, nil).Once()

		rec := setup.Get(fmt.Sprintf("/workspaces/%s/items/%s", setup.WorkspaceID, itemID))

		testutil.AssertStatus(t, rec, http.StatusOK)
	})

	t.Run("returns 404 when not found", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("GetByID", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil, item.ErrNotFound).Once()

		rec := setup.Get(fmt.Sprintf("/workspaces/%s/items/%s", setup.WorkspaceID, itemID))

		testutil.AssertStatus(t, rec, http.StatusNotFound)
	})
}

func TestItemHandler_Update(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockItemService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("updates item successfully", func(t *testing.T) {
		itemID := uuid.New()
		updatedItem := &item.Item{
			ID:   itemID,
			Name: "Updated Laptop",
		}

		mockSvc.On("Update", mock.Anything, itemID, setup.WorkspaceID, mock.Anything).
			Return(updatedItem, nil).Once()

		body := `{"name":"Updated Laptop"}`
		rec := setup.Patch(fmt.Sprintf("/workspaces/%s/items/%s", setup.WorkspaceID, itemID), body)

		testutil.AssertStatus(t, rec, http.StatusOK)
	})
}

func TestItemHandler_Delete(t *testing.T) {
	setup := testutil.NewHandlerTestSetup()
	mockSvc := new(MockItemService)
	item.RegisterRoutes(setup.API, mockSvc)

	t.Run("deletes item successfully", func(t *testing.T) {
		itemID := uuid.New()

		mockSvc.On("Delete", mock.Anything, itemID, setup.WorkspaceID).
			Return(nil).Once()

		rec := setup.Delete(fmt.Sprintf("/workspaces/%s/items/%s", setup.WorkspaceID, itemID))

		testutil.AssertStatus(t, rec, http.StatusNoContent)
	})
}
```

### Step 2: Test item handler

```bash
go test ./internal/domain/warehouse/item -v -run TestItemHandler
```

**Expected:** All ItemHandler tests pass

### Step 3: Repeat for remaining warehouse handlers

Create handler_test.go files for each domain (use item as template):

- [ ] `location/handler_test.go`
- [ ] `container/handler_test.go`
- [ ] `inventory/handler_test.go`
- [ ] `loan/handler_test.go`
- [ ] `borrower/handler_test.go`
- [ ] `label/handler_test.go`
- [ ] `company/handler_test.go`
- [ ] `activity/handler_test.go`
- [ ] `attachment/handler_test.go`
- [ ] `deleted/handler_test.go`
- [ ] `favorite/handler_test.go`
- [ ] `movement/handler_test.go`

Follow the same pattern as item handler (see 2.2-warehouse-handlers.md for specifics)

### Step 4: Validate warehouse handlers

```bash
# Test all warehouse handlers
for pkg in item location container inventory loan borrower label company activity attachment deleted favorite movement; do
    echo "Testing $pkg handler..."
    go test ./internal/domain/warehouse/$pkg -run TestHandler -cover
done
```

---

## Task 2.3: Auth Handler Tests (20-25 hours)

### Step 1: User Handler

Create `internal/domain/auth/user/handler_test.go` following the same pattern as item handler.

Key differences:
- Test registration endpoint
- Test login endpoint
- Test password change endpoint
- Test profile update endpoint

See 2.3-auth-handlers.md for complete template.

### Step 2: Test remaining auth handlers

Create handler tests for:
- [ ] `workspace/handler_test.go`
- [ ] `member/handler_test.go`
- [ ] `notification/handler_test.go`

### Step 3: Validate auth handlers

```bash
for pkg in user workspace member notification; do
    echo "Testing $pkg handler..."
    go test ./internal/domain/auth/$pkg -run TestHandler -cover
done
```

---

## Task 2.4: Top-Level Handler Tests (20-25 hours)

Create handler tests for:
- [ ] `analytics/handler_test.go`
- [ ] `barcode/handler_test.go`
- [ ] `batch/handler_test.go`
- [ ] `importexport/handler_test.go`
- [ ] `sync/handler_test.go`

See 2.4-toplevel-handlers.md for templates.

---

## Phase 2 Validation

After completing all tasks, run the validation script:

```bash
bash docs/go-tests/scripts/validate-phase-2.sh
```

**Expected output:**
```
✓ Handler test infrastructure created
✓ Warehouse handlers: 13/13 complete
✓ Auth handlers: 4/4 complete
✓ Top-level handlers: 5/5 complete
✓ Handler coverage: 85%+
✓ Overall coverage: 78.9%+
✓ All tests passing

Phase 2 Complete! ✅
```

## Troubleshooting

### Mock doesn't match service interface
```bash
# Check interface definition
grep -A 20 "type.*Service interface" internal/domain/warehouse/item/service.go

# Ensure mock methods match exactly
```

### Handler routes not registered
- Check RegisterRoutes function is called in test
- Verify API setup is correct
- Check route path matches expected format

### Context values not found
- Ensure HandlerTestSetup middleware is setting context
- Check context key constants match

## Next Steps

After Phase 2 completion:
1. Commit: `git add . && git commit -m "Complete Phase 2 handler tests"`
2. Proceed to [Phase 3 Quick Start](../phase-3/QUICKSTART.md)
