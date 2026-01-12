# Go Backend Test Coverage Improvement Plan

**Goal**: Increase test coverage from 38.9% to 95%

**Current State**: 38.9% overall coverage (786 tests passing)

## Executive Summary

The Go backend has excellent test infrastructure and service-layer coverage, but suffers from three critical gaps:
1. **Handler tests missing** (95% of HTTP handlers untested)
2. **Entity validation tests missing** (96% of domain entities untested)
3. **Service error paths incomplete** (40-60% coverage in many services)

This plan provides a systematic, phase-by-phase approach to achieve 95% coverage while maintaining test quality and execution speed.

---

## Phase 1: Foundation & Quick Wins (Target: +15% → 53.9%)

### Objective
Complete partially tested packages and add missing unit tests for middleware and utilities.

### Tasks

#### 1.1 Complete Middleware Testing (internal/api/middleware)
**Current**: 49.3% | **Target**: 95%

Files to test:
- `auth.go` - JWTAuth middleware (currently 0% covered)
- `workspace.go` - Workspace middleware (currently 0% covered)
- `errors.go` - ErrorTransformer (currently 0% covered)

Test approach:
```go
// Test JWTAuth with mock JWT service
func TestJWTAuth_ValidToken(t *testing.T) {
    mockJWT := &MockJWTService{
        ValidateTokenFunc: func(token string) (*jwt.Claims, error) {
            return &jwt.Claims{UserID: uuid.New(), Email: "test@example.com"}, nil
        },
    }

    handler := JWTAuth(mockJWT)(testHandler)
    req := httptest.NewRequest("GET", "/", nil)
    req.Header.Set("Authorization", "Bearer valid-token")
    rec := httptest.NewRecorder()

    handler.ServeHTTP(rec, req)
    assert.Equal(t, http.StatusOK, rec.Code)
}
```

Critical files:
- `internal/api/middleware/auth.go:29-64`
- `internal/api/middleware/workspace.go:15-38`
- `internal/api/middleware/errors.go:12-26`

**Estimated effort**: 3-4 hours | **Tests to add**: 15-20

#### 1.2 Add Entity Validation Tests
**Current**: 4% (only category) | **Target**: 90%

Entities needing tests:
- `warehouse/item/entity.go` - Item creation, validation, updates
- `warehouse/location/entity.go` - Location hierarchy validation
- `warehouse/container/entity.go` - Container validation
- `warehouse/inventory/entity.go` - Inventory state transitions
- `warehouse/loan/entity.go` - Loan validation and state
- `warehouse/borrower/entity.go` - Borrower validation
- `auth/user/entity.go` - User creation, password hashing
- `auth/workspace/entity.go` - Workspace creation
- `auth/member/entity.go` - Member role validation

Test pattern (replicate category_test.go):
```go
func TestNewItem(t *testing.T) {
    tests := []struct {
        name    string
        input   CreateInput
        wantErr bool
        errMsg  string
    }{
        {
            name: "valid item",
            input: CreateInput{Name: "Laptop", SKU: "LAP-001"},
            wantErr: false,
        },
        {
            name: "missing required field",
            input: CreateInput{Name: ""},
            wantErr: true,
            errMsg: "name is required",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            item, err := NewItem(workspaceID, tt.input)
            if tt.wantErr {
                assert.Error(t, err)
                assert.Contains(t, err.Error(), tt.errMsg)
            } else {
                assert.NoError(t, err)
                assert.NotNil(t, item)
            }
        })
    }
}
```

Critical files:
- Create `*_entity_test.go` for each domain in `internal/domain/warehouse/` and `internal/domain/auth/`

**Estimated effort**: 8-10 hours | **Tests to add**: 100-150

#### 1.3 Complete Job Testing (internal/jobs)
**Current**: 15.4% | **Target**: 40% (integration tests excluded)

Add unit tests for:
- `scheduler.go` - Constructor tests, config validation
- `loan_reminders.go` - Payload construction, time calculations
- `cleanup.go` - Cutoff date calculations

Note: Full integration tests require Redis and are in separate integration suite.

Test approach:
```go
func TestScheduler_Configuration(t *testing.T) {
    config := DefaultSchedulerConfig("localhost:6379")
    sched := NewScheduler(nil, config)

    assert.NotNil(t, sched)
    assert.NotNil(t, sched.Client())
    assert.Equal(t, "localhost:6379", config.RedisAddr)
}

func TestLoanReminderPayload_IsOverdue(t *testing.T) {
    now := time.Now()
    payload := LoanReminderPayload{
        DueDate: now.Add(-24 * time.Hour),
    }

    assert.True(t, payload.DueDate.Before(now))
}
```

**Estimated effort**: 3-4 hours | **Tests to add**: 20-30

---

## Phase 2: Handler Test Suite (Target: +25% → 78.9%)

### Objective
Add comprehensive HTTP handler tests for all 22 missing handlers, following the category pattern.

### Strategy
Replicate the successful pattern from `category/handler_test.go` (75.1% coverage) across all domains.

### Tasks

#### 2.1 Create Handler Test Infrastructure

Create shared test utilities in `internal/testutil/handler.go`:

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
}

func NewHandlerTestSetup() *HandlerTestSetup {
    r := chi.NewRouter()
    workspaceID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

    // Inject workspace context middleware
    r.Use(func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
            ctx := context.WithValue(req.Context(), appMiddleware.WorkspaceContextKey, workspaceID)
            next.ServeHTTP(w, req.WithContext(ctx))
        })
    })

    config := huma.DefaultConfig("Test API", "1.0.0")
    api := humachi.New(r, config)

    return &HandlerTestSetup{
        Router:      r,
        API:         api,
        WorkspaceID: workspaceID,
    }
}

func (h *HandlerTestSetup) Request(method, path, body string) *httptest.ResponseRecorder {
    req := httptest.NewRequest(method, path, strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    rec := httptest.NewRecorder()
    h.Router.ServeHTTP(rec, req)
    return rec
}

func ParseJSONResponse[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
    var result T
    err := json.Unmarshal(rec.Body.Bytes(), &result)
    assert.NoError(t, err)
    return result
}
```

**Estimated effort**: 2 hours

#### 2.2 Warehouse Domain Handlers (Priority: High)

Add handler tests for each warehouse domain:

| Domain | File | Coverage Target | Priority | Test Count |
|--------|------|----------------|----------|------------|
| item | `item/handler_test.go` | 85% | HIGH | 15-20 |
| location | `location/handler_test.go` | 85% | HIGH | 15-20 |
| container | `container/handler_test.go` | 85% | HIGH | 15-20 |
| inventory | `inventory/handler_test.go` | 85% | HIGH | 15-20 |
| loan | `loan/handler_test.go` | 85% | HIGH | 20-25 |
| borrower | `borrower/handler_test.go` | 80% | MEDIUM | 12-15 |
| label | `label/handler_test.go` | 80% | MEDIUM | 10-12 |
| company | `company/handler_test.go` | 75% | MEDIUM | 10-12 |
| activity | `activity/handler_test.go` | 75% | MEDIUM | 8-10 |
| attachment | `attachment/handler_test.go` | 75% | MEDIUM | 12-15 |
| deleted | `deleted/handler_test.go` | 70% | LOW | 8-10 |
| favorite | `favorite/handler_test.go` | 70% | LOW | 8-10 |
| movement | `movement/handler_test.go` | 70% | LOW | 8-10 |

Test template for each handler:
```go
// Example: item/handler_test.go
package item_test

import (
    "context"
    "testing"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"

    "github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/item"
    "github.com/antti/home-warehouse/go-backend/internal/testutil"
)

type MockItemService struct {
    mock.Mock
}

func (m *MockItemService) Create(ctx context.Context, input item.CreateInput) (*item.Item, error) {
    args := m.Called(ctx, input)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*item.Item), args.Error(1)
}

// Add all service methods...

func TestItemHandler_Create(t *testing.T) {
    t.Run("creates item successfully", func(t *testing.T) {
        setup := testutil.NewHandlerTestSetup()
        mockSvc := new(MockItemService)

        testItem, _ := item.NewItem(setup.WorkspaceID, "Laptop", "LAP-001", nil)
        mockSvc.On("Create", mock.Anything, mock.Anything).Return(testItem, nil)

        item.RegisterRoutes(setup.API, mockSvc)

        body := `{"name":"Laptop","sku":"LAP-001"}`
        rec := setup.Request("POST", "/items", body)

        assert.Equal(t, http.StatusCreated, rec.Code)
        mockSvc.AssertExpectations(t)
    })

    t.Run("returns 400 for invalid input", func(t *testing.T) {
        // Test validation errors
    })

    t.Run("returns 404 when not found", func(t *testing.T) {
        // Test not found scenarios
    })
}

func TestItemHandler_List(t *testing.T) {
    // List endpoint tests
}

func TestItemHandler_Get(t *testing.T) {
    // Get endpoint tests
}

func TestItemHandler_Update(t *testing.T) {
    // Update endpoint tests
}

func TestItemHandler_Delete(t *testing.T) {
    // Delete endpoint tests
}

func TestItemHandler_Search(t *testing.T) {
    // Search endpoint tests
}
```

**Estimated effort**: 40-50 hours | **Tests to add**: 180-220

#### 2.3 Auth Domain Handlers (Priority: Critical)

| Domain | File | Coverage Target | Test Count |
|--------|------|----------------|------------|
| user | `auth/user/handler_test.go` | 90% | 25-30 |
| workspace | `auth/workspace/handler_test.go` | 85% | 20-25 |
| member | `auth/member/handler_test.go` | 80% | 15-20 |
| notification | `auth/notification/handler_test.go` | 75% | 12-15 |

User handler is most critical as it handles authentication:

```go
func TestUserHandler_Register(t *testing.T) {
    t.Run("registers new user successfully", func(t *testing.T) {
        mockSvc := new(MockUserService)
        mockSvc.On("Create", mock.Anything, mock.Anything).Return(testUser, nil)

        body := `{"email":"test@example.com","password":"SecurePass123"}`
        rec := setup.Request("POST", "/auth/register", body)

        assert.Equal(t, http.StatusCreated, rec.Code)
    })

    t.Run("returns 409 for duplicate email", func(t *testing.T) {
        mockSvc := new(MockUserService)
        mockSvc.On("Create", mock.Anything, mock.Anything).
            Return(nil, user.ErrDuplicateEmail)

        body := `{"email":"existing@example.com","password":"Pass123"}`
        rec := setup.Request("POST", "/auth/register", body)

        assert.Equal(t, http.StatusConflict, rec.Code)
    })
}

func TestUserHandler_Login(t *testing.T) {
    t.Run("authenticates user successfully", func(t *testing.T) {
        // Test successful login with JWT token generation
    })

    t.Run("returns 401 for invalid credentials", func(t *testing.T) {
        // Test authentication failure
    })
}
```

**Estimated effort**: 20-25 hours | **Tests to add**: 70-90

#### 2.4 Top-Level Domain Handlers

| Domain | File | Coverage Target | Test Count |
|--------|------|----------------|------------|
| analytics | `analytics/handler_test.go` | 80% | 15-20 |
| barcode | `barcode/handler_test.go` | 75% | 8-10 |
| batch | `batch/handler_test.go` | 70% | 10-12 |
| importexport | `importexport/handler_test.go` | 85% | 20-25 |
| sync | `sync/handler_test.go` | 80% | 12-15 |

**Estimated effort**: 20-25 hours | **Tests to add**: 65-82

---

## Phase 3: Service Error Path Coverage (Target: +8% → 86.9%)

### Objective
Improve service layer coverage by adding comprehensive error scenario testing.

### Tasks

#### 3.1 Add Service Error Path Tests

For each service with <70% coverage, add tests for:

**Error scenarios to cover:**
- Database connection failures
- Validation errors (unique constraints, foreign keys)
- Not found errors
- Permission/authorization errors
- Concurrent modification conflicts
- Transaction rollback scenarios
- Pagination edge cases (offset > count, negative limits)
- Search with special characters
- Null/empty input handling

Example for item service:
```go
func TestItemService_Create_ValidationErrors(t *testing.T) {
    t.Run("returns error for duplicate SKU", func(t *testing.T) {
        mockRepo := new(MockItemRepository)
        mockRepo.On("Save", mock.Anything, mock.Anything).
            Return(postgres.ErrUniqueViolation)

        svc := item.NewService(mockRepo)
        _, err := svc.Create(ctx, duplicateInput)

        assert.Error(t, err)
        assert.Equal(t, item.ErrDuplicateSKU, err)
    })

    t.Run("returns error for invalid workspace", func(t *testing.T) {
        // Test workspace validation
    })
}

func TestItemService_List_PaginationEdgeCases(t *testing.T) {
    t.Run("handles offset beyond count", func(t *testing.T) {
        mockRepo := new(MockItemRepository)
        mockRepo.On("List", mock.Anything, workspaceID, 1000, 10).
            Return([]*item.Item{}, 50, nil)

        svc := item.NewService(mockRepo)
        items, total, err := svc.List(ctx, workspaceID, 1000, 10)

        assert.NoError(t, err)
        assert.Empty(t, items)
        assert.Equal(t, 50, total)
    })
}
```

Packages to improve:
- `activity` (40.2%) → 75%
- `movement` (43.9%) → 70%
- `loan` (46.5%) → 75%
- `company` (47.3%) → 70%
- `user` (33.9%) → 70%
- `notification` (37.9%) → 70%
- `workspace` (42.2%) → 70%
- `member` (48.5%) → 70%

**Estimated effort**: 25-30 hours | **Tests to add**: 150-200

---

## Phase 4: Integration Test Expansion (Target: +5% → 91.9%)

### Objective
Add comprehensive integration tests for complex workflows and error scenarios.

### Tasks

#### 4.1 Expand E2E Integration Tests

Add integration tests in `tests/integration/` for:

**New test files needed:**
- `attachment_flow_test.go` - File upload/download workflows
- `company_flow_test.go` - Company CRUD operations
- `label_flow_test.go` - Label management
- `favorite_flow_test.go` - Favorite operations
- `activity_flow_test.go` - Activity tracking
- `movement_flow_test.go` - Inventory movement tracking
- `deleted_flow_test.go` - Soft delete/restore workflows
- `permission_flow_test.go` - Role-based access control
- `concurrent_flow_test.go` - Concurrent operations
- `pagination_flow_test.go` - Large dataset pagination

Example integration test:
```go
//go:build integration
// +build integration

func TestAttachmentUploadDownload(t *testing.T) {
    ts := NewTestServer(t)
    ts.SetToken(ts.AuthHelper(t, "attachment@example.com"))

    // Create workspace
    wsID := ts.CreateWorkspace(t, "Attachment Test WS")

    // Create item
    itemID := ts.CreateItem(t, wsID, "Test Item")

    // Upload file
    fileContent := []byte("test file content")
    resp := ts.Upload(fmt.Sprintf("/workspaces/%s/items/%s/attachments", wsID, itemID),
        "test.pdf", fileContent)
    RequireStatus(t, resp, http.StatusCreated)

    var attachment AttachmentResponse
    attachment = ParseResponse[AttachmentResponse](t, resp)

    // Download file
    downloadResp := ts.Get(fmt.Sprintf("/workspaces/%s/attachments/%s/download",
        wsID, attachment.ID))
    RequireStatus(t, downloadResp, http.StatusOK)

    body, _ := io.ReadAll(downloadResp.Body)
    assert.Equal(t, fileContent, body)
}
```

**Estimated effort**: 15-20 hours | **Tests to add**: 50-70

#### 4.2 Add Negative Integration Tests

Test permission violations, constraint failures, and error recovery:

```go
func TestPermissionDenied(t *testing.T) {
    ts := NewTestServer(t)

    // User 1 creates workspace
    user1Token := ts.AuthHelper(t, "user1@example.com")
    ts.SetToken(user1Token)
    wsID := ts.CreateWorkspace(t, "User 1 Workspace")

    // User 2 tries to access User 1's workspace
    user2Token := ts.AuthHelper(t, "user2@example.com")
    ts.SetToken(user2Token)

    resp := ts.Get(fmt.Sprintf("/workspaces/%s/items", wsID))
    RequireStatus(t, resp, http.StatusForbidden)
}
```

**Estimated effort**: 10-12 hours | **Tests to add**: 30-40

---

## Phase 5: Remaining Gaps & Polish (Target: +3.1% → 95%)

### Objective
Fill remaining coverage gaps and polish test suite.

### Tasks

#### 5.1 Test Router and API Setup

Add tests for `internal/api/router.go`:

```go
func TestNewRouter(t *testing.T) {
    pool := testdb.SetupTestDB(t)
    cfg := &config.Config{
        JWTSecret: "test-secret",
        JWTExpirationHours: 24,
    }

    router := NewRouter(pool, cfg)

    assert.NotNil(t, router)

    // Test health endpoint
    req := httptest.NewRequest("GET", "/health", nil)
    rec := httptest.NewRecorder()
    router.ServeHTTP(rec, req)

    assert.Equal(t, http.StatusOK, rec.Code)
}
```

**Estimated effort**: 3-4 hours | **Tests to add**: 10-15

#### 5.2 Test Documentation Routes

Add tests for `internal/api/docs.go`:

```go
func TestRegisterDocsRoutes(t *testing.T) {
    r := chi.NewRouter()
    config := huma.DefaultConfig("Test API", "1.0.0")
    api := humachi.New(r, config)

    RegisterDocsRoutes(api)

    // Test redoc endpoint exists
    req := httptest.NewRequest("GET", "/redoc", nil)
    rec := httptest.NewRecorder()
    r.ServeHTTP(rec, req)

    assert.Equal(t, http.StatusOK, rec.Code)
}
```

**Estimated effort**: 2 hours | **Tests to add**: 5-8

#### 5.3 Add Batch Operation Tests

Complete batch package testing with mocked service dependencies:

```go
func TestBatchService_ItemOperations(t *testing.T) {
    mockItemSvc := new(MockItemService)
    svc := batch.NewService(mockItemSvc, nil, nil, nil, nil, nil, nil)

    testItem := &item.Item{...}
    mockItemSvc.On("GetByID", mock.Anything, itemID, workspaceID).
        Return(testItem, nil)
    mockItemSvc.On("Update", mock.Anything, itemID, workspaceID, mock.Anything).
        Return(testItem, nil)

    req := batch.BatchRequest{
        Operations: []batch.Operation{
            {
                Operation: batch.OperationUpdate,
                EntityType: batch.EntityItem,
                EntityID: &itemID,
                Data: json.RawMessage(`{"name":"Updated"}`),
            },
        },
    }

    resp, err := svc.ProcessBatch(ctx, workspaceID, req)

    assert.NoError(t, err)
    assert.Equal(t, 1, resp.Succeeded)
}
```

**Estimated effort**: 5-6 hours | **Tests to add**: 25-30

#### 5.4 Test Coverage Analysis & Gap Filling

Run coverage analysis and identify any remaining gaps:

```bash
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

Manually review HTML coverage report and add targeted tests for:
- Uncovered error branches
- Edge case scenarios
- Untested helper functions

**Estimated effort**: 8-10 hours | **Tests to add**: 40-60

---

## Implementation Guidelines

### Testing Standards

1. **Test naming convention**: `Test<Type>_<Method>_<Scenario>`
   - Example: `TestItemService_Create_ReturnsDuplicateError`

2. **Table-driven tests** for multiple scenarios:
```go
func TestValidation(t *testing.T) {
    tests := []struct {
        name    string
        input   Input
        wantErr bool
    }{
        {"valid input", ValidInput, false},
        {"missing field", InvalidInput, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test logic
        })
    }
}
```

3. **Mock expectations**: Always assert mock calls
```go
mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)
// ... test code
mockRepo.AssertExpectations(t)
```

4. **Test isolation**: Use `t.Cleanup()` for resource cleanup
```go
pool := testdb.SetupTestDB(t)
// t.Cleanup is called automatically by SetupTestDB
```

5. **Error assertions**: Use specific error comparisons
```go
assert.Equal(t, ErrDuplicateSKU, err)  // Not just assert.Error(t, err)
```

### Test Organization

```
internal/domain/warehouse/item/
├── entity.go
├── entity_test.go          # Entity validation tests
├── service.go
├── service_test.go         # Service unit tests (mocked repo)
├── handler.go
├── handler_test.go         # NEW: Handler HTTP tests (mocked service)
├── repository.go
└── repository_test.go      # Integration tests (real DB)
```

### Running Tests

```bash
# Unit tests only (fast, no DB)
go test ./internal/... -short

# Unit + repository integration tests
go test ./internal/...

# Full integration tests (with E2E)
go test ./... -tags=integration

# Coverage report
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out | grep total
```

---

## Progress Tracking

Track progress using coverage percentage by package:

```bash
# Generate detailed coverage by package
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out | grep -v "100.0%" | sort -k3 -n
```

**Milestones**:
- Phase 1 Complete: 53.9% ✓ (when entity + middleware tests done)
- Phase 2 Complete: 78.9% ✓ (when all handler tests done)
- Phase 3 Complete: 86.9% ✓ (when service error paths done)
- Phase 4 Complete: 91.9% ✓ (when integration tests expanded)
- Phase 5 Complete: 95%+ ✓ (all gaps filled)

---

## Critical Files to Modify/Create

### Phase 1 (Foundation)
- `internal/api/middleware/auth_test.go` (create)
- `internal/api/middleware/workspace_test.go` (create)
- `internal/api/middleware/errors_test.go` (create)
- `internal/domain/warehouse/item/entity_test.go` (create)
- `internal/domain/warehouse/location/entity_test.go` (create)
- `internal/domain/warehouse/container/entity_test.go` (create)
- `internal/domain/warehouse/inventory/entity_test.go` (create)
- `internal/domain/warehouse/loan/entity_test.go` (create)
- `internal/domain/warehouse/borrower/entity_test.go` (create)
- `internal/domain/auth/user/entity_test.go` (create)
- `internal/domain/auth/workspace/entity_test.go` (create)
- `internal/jobs/scheduler_test.go` (extend)

### Phase 2 (Handlers)
- `internal/testutil/handler.go` (create - shared test utilities)
- Create `*_handler_test.go` for 22 handlers:
  - Warehouse: item, location, container, inventory, loan, borrower, label, company, activity, attachment, deleted, favorite, movement
  - Auth: user, workspace, member, notification
  - Top-level: analytics, barcode, batch, importexport, sync

### Phase 3 (Service Error Paths)
- Extend existing `*_service_test.go` files in all domain packages
- Add error scenario test functions

### Phase 4 (Integration Tests)
- `tests/integration/attachment_flow_test.go` (create)
- `tests/integration/company_flow_test.go` (create)
- `tests/integration/label_flow_test.go` (create)
- `tests/integration/favorite_flow_test.go` (create)
- `tests/integration/activity_flow_test.go` (create)
- `tests/integration/movement_flow_test.go` (create)
- `tests/integration/deleted_flow_test.go` (create)
- `tests/integration/permission_flow_test.go` (create)

### Phase 5 (Remaining Gaps)
- `internal/api/router_test.go` (create)
- `internal/api/docs_test.go` (extend)
- `internal/domain/batch/service_test.go` (extend)

---

## Verification & Testing

After each phase, verify coverage improvements:

1. **Run full test suite**:
```bash
TEST_DATABASE_URL="postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable" \
go test ./... -coverprofile=coverage.out -covermode=atomic
```

2. **Generate coverage report**:
```bash
go tool cover -func=coverage.out | grep "total:"
go tool cover -html=coverage.out -o coverage.html
```

3. **Review HTML report**: Open `coverage.html` in browser to identify remaining gaps

4. **Package-level verification**:
```bash
go test ./internal/domain/warehouse/item -cover  # Should show 85%+
go test ./internal/api/middleware -cover          # Should show 95%+
```

5. **CI/CD Integration**: Add coverage enforcement to CI pipeline:
```yaml
# .github/workflows/test.yml
- name: Test with coverage
  run: go test ./... -coverprofile=coverage.out -covermode=atomic

- name: Check coverage threshold
  run: |
    coverage=$(go tool cover -func=coverage.out | grep total | awk '{print $3}' | sed 's/%//')
    if (( $(echo "$coverage < 95.0" | bc -l) )); then
      echo "Coverage $coverage% is below 95% threshold"
      exit 1
    fi
```

---

## Time Estimates

| Phase | Tasks | Tests to Add | Estimated Time |
|-------|-------|--------------|----------------|
| Phase 1 | Middleware + Entities + Jobs | 135-200 | 14-18 hours |
| Phase 2 | All Handler Tests | 315-392 | 80-100 hours |
| Phase 3 | Service Error Paths | 150-200 | 25-30 hours |
| Phase 4 | Integration Tests | 80-110 | 25-32 hours |
| Phase 5 | Gaps & Polish | 80-113 | 18-22 hours |
| **TOTAL** | **All Phases** | **760-1,015** | **162-202 hours** |

**Realistic timeline**: 4-6 weeks (1 developer, full-time focus on testing)

---

## Success Criteria

✅ **Coverage Targets Met**:
- Overall: 95%+
- Handlers: 85%+ (up from ~4%)
- Services: 80%+ (up from ~50% average)
- Entities: 90%+ (up from 4%)
- Middleware: 95%+ (up from 49.3%)
- Integration: Comprehensive E2E coverage

✅ **Test Quality**:
- All tests pass consistently
- No flaky tests
- Fast execution (<2 min for unit tests, <5 min total)
- Clear test names and documentation

✅ **Maintainability**:
- Consistent patterns across all tests
- Shared test utilities for common operations
- Easy to add new tests following existing patterns
- Clear separation: unit tests (mocked) vs integration tests (real DB)

---

## Notes

- Integration tests with `//go:build integration` tag don't count toward standard coverage but provide critical E2E validation
- Focus on meaningful tests over coverage numbers - don't test getters/setters excessively
- Mock external dependencies (JWT, database, Redis) in unit tests
- Keep integration tests in separate suite for CI/CD optimization
- Consider using `testify/suite` for complex test setups if needed
- All new tests should follow existing patterns from high-coverage packages (category, importexport)
