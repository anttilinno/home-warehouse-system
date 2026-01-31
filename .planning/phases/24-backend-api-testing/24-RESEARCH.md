# Phase 24: Backend API Testing - Research

**Researched:** 2026-01-31
**Domain:** Go API layer testing (handlers, request/response validation, integration)
**Confidence:** HIGH

## Summary

This phase focuses on API layer testing for the Go backend, building on the test infrastructure established in Phase 22 (factories) and patterns from Phase 23 (business logic tests). The codebase uses Huma v2 for HTTP API definition with Chi router, and has well-established patterns for both unit tests (with mocked services) and integration tests (against a test database).

Research reveals two distinct testing patterns already in use:
1. **Handler unit tests** (`internal/testutil/handler.go`): Mock service dependencies, test request parsing, response formatting, and error handling without touching the database
2. **Integration tests** (`tests/integration/`): Full request/response cycles with TestServer, test database, and authentication flows

The codebase has ~40 handler files across warehouse domains, auth, and supporting services. Many already have handler tests (item, location, container, etc.), but coverage varies. Integration tests provide comprehensive CRUD coverage for core entities.

**Primary recommendation:** Focus on handler unit tests for domains lacking coverage (repairlog, declutter, repairphoto, repairattachment), add request validation tests for all endpoints, and expand integration tests for critical multi-entity flows (loan lifecycle, approval pipeline, sync/batch operations).

## Current State Analysis

### Handler Test Coverage

| Domain | Handler Exists | Test Exists | Test Coverage | Notes |
|--------|---------------|-------------|---------------|-------|
| item | Yes | Yes | Good | CRUD, labels, search |
| location | Yes | Yes | Good | CRUD, search |
| container | Yes | Yes | Good | CRUD, search |
| inventory | Yes | Yes | Good | CRUD, movements |
| category | Yes | Yes | Good | CRUD, tree |
| label | Yes | Yes | Good | CRUD |
| borrower | Yes | Yes | Good | CRUD, search |
| loan | Yes | Yes | Partial | Missing lifecycle tests |
| company | Yes | Yes | Good | CRUD |
| favorite | Yes | Yes | Good | Toggle |
| activity | Yes | Yes | Basic | List only |
| movement | Yes | Yes | Basic | List only |
| deleted | Yes | Yes | Basic | List only |
| attachment | Yes | Yes | Good | CRUD |
| itemphoto | Yes | Yes | Good | Upload, serve, bulk |
| repairlog | Yes | Yes | Minimal | **Gap** |
| repairphoto | Yes | No | **None** | **Gap** |
| repairattachment | Yes | No | **None** | **Gap** |
| declutter | Yes | No | **None** | **Gap** |
| importjob | Yes | Yes | Good | CRUD, upload |
| pendingchange | Yes | Partial | Partial | Integration only |

### Integration Test Coverage

| Test File | Entities Covered | Coverage |
|-----------|------------------|----------|
| auth_test.go | User, Login, Token | Comprehensive |
| warehouse_test.go | All CRUD entities | Comprehensive |
| workspace_test.go | Workspace CRUD | Good |
| permission_test.go | Role-based access | Good |
| multitenant_test.go | Workspace isolation | Good |
| constraints_test.go | DB constraints | Good |
| workflow_test.go | Complex workflows | Basic |
| approval_pipeline_test.go | Pending changes | Comprehensive |
| batch_test.go | Batch operations | Good |
| item_photos_test.go | Photo operations | Good |
| import_test.go | CSV import | Good |

## Standard Stack

### Core Testing Tools
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| testing | stdlib | Test framework | Go standard library |
| testify/assert | v1.9+ | Assertions | Used throughout codebase |
| testify/mock | v1.9+ | Mocking | Established pattern |
| testify/require | v1.9+ | Fatal assertions | For setup failures |
| httptest | stdlib | HTTP testing | Handler tests |

### Existing Test Infrastructure
| Component | Location | Purpose |
|-----------|----------|---------|
| HandlerTestSetup | `internal/testutil/handler.go` | Unit test setup with mocked context |
| TestServer | `tests/integration/setup.go` | Full API integration testing |
| Factory | `internal/testutil/factory/` | Test data generation |
| testdb | `tests/testdb/testdb.go` | Database setup/cleanup |

### Huma-Specific Testing
| Pattern | Description | When to Use |
|---------|-------------|-------------|
| humachi adapter | Huma API on Chi router | All handler tests |
| Context injection | WorkspaceID, UserID via middleware | Handler unit tests |
| Request/Response types | Huma auto-generates from schema | Validation tests |

## Architecture Patterns

### Handler Unit Test Pattern
```go
// Source: backend/internal/domain/warehouse/item/handler_test.go
func TestItemHandler_Create(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    item.RegisterRoutes(setup.API, mockSvc, nil)

    t.Run("creates item successfully", func(t *testing.T) {
        testItem, _ := item.NewItem(setup.WorkspaceID, "Laptop", "LAP-001", 0)

        mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input item.CreateInput) bool {
            return input.Name == "Laptop" && input.SKU == "LAP-001"
        })).Return(testItem, nil).Once()

        body := `{"name":"Laptop","sku":"LAP-001","min_stock_level":0}`
        rec := setup.Post("/items", body)

        testutil.AssertStatus(t, rec, http.StatusOK)
        mockSvc.AssertExpectations(t)
    })

    t.Run("returns 422 for invalid min stock level", func(t *testing.T) {
        // Validation happens at HTTP layer, service is never called
        body := `{"name":"Laptop","sku":"LAP-001","min_stock_level":-1}`
        rec := setup.Post("/items", body)

        testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
    })
}
```

### Integration Test Pattern
```go
// Source: backend/tests/integration/warehouse_test.go
//go:build integration

func TestContainerCRUD(t *testing.T) {
    ts := NewTestServer(t)

    token := ts.AuthHelper(t, "container_"+uuid.New().String()[:8]+"@example.com")
    ts.SetToken(token)

    // Create workspace
    slug := "container-test-ws-" + uuid.New().String()[:8]
    resp := ts.Post("/workspaces", map[string]interface{}{
        "name":        "Container Test Workspace",
        "slug":        slug,
        "is_personal": false,
    })
    RequireStatus(t, resp, http.StatusOK)

    var wsResult struct { ID uuid.UUID `json:"id"` }
    wsResult = ParseResponse[struct { ID uuid.UUID `json:"id"` }](t, resp)

    workspacePath := fmt.Sprintf("/workspaces/%s", wsResult.ID)

    // Continue with CRUD operations...
}
```

### Mock Service Pattern
```go
// Source: backend/internal/domain/warehouse/item/handler_test.go
type MockService struct {
    mock.Mock
}

func (m *MockService) Create(ctx context.Context, input item.CreateInput) (*item.Item, error) {
    args := m.Called(ctx, input)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*item.Item), args.Error(1)
}

// Return nil safely for pointer returns
func (m *MockService) GetByID(ctx context.Context, id, workspaceID uuid.UUID) (*item.Item, error) {
    args := m.Called(ctx, id, workspaceID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*item.Item), args.Error(1)
}
```

### Request Validation Test Pattern
```go
// Test Huma validation for request payloads
func TestHandler_RequestValidation(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    entity.RegisterRoutes(setup.API, mockSvc, nil)

    tests := []struct {
        name       string
        body       string
        wantStatus int
        wantErr    string
    }{
        {
            name:       "missing required field",
            body:       `{"optional_field":"value"}`,
            wantStatus: http.StatusUnprocessableEntity,
            wantErr:    "required_field is required",
        },
        {
            name:       "invalid enum value",
            body:       `{"status":"INVALID"}`,
            wantStatus: http.StatusUnprocessableEntity,
            wantErr:    "must be one of",
        },
        {
            name:       "invalid uuid format",
            body:       `{"parent_id":"not-a-uuid"}`,
            wantStatus: http.StatusUnprocessableEntity,
            wantErr:    "invalid uuid",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            rec := setup.Post("/entities", tt.body)
            testutil.AssertStatus(t, rec, tt.wantStatus)
            assert.Contains(t, rec.Body.String(), tt.wantErr)
        })
    }
}
```

### Authentication/Authorization Test Pattern
```go
// Source: backend/tests/integration/auth_test.go
func TestGetMe_Unauthorized(t *testing.T) {
    ts := NewTestServer(t)

    resp := ts.Get("/users/me")
    RequireStatus(t, resp, http.StatusUnauthorized)
}

// Role-based access from permission_test.go
func TestMemberCannotDeleteItems(t *testing.T) {
    ts := NewTestServer(t)

    // Setup owner and member...
    ts.SetToken(memberToken)
    resp := ts.Delete(fmt.Sprintf("%s/items/%s", workspacePath, itemID))
    RequireStatus(t, resp, http.StatusForbidden)
}
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Focus on request/response contract, not internal handler mechanics
- **Over-mocking in integration tests:** Use TestServer with real database for E2E flows
- **Ignoring error response format:** Verify error messages match API contract
- **Missing authorization tests:** Every protected endpoint needs auth tests

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP test setup | Manual httptest | testutil.HandlerTestSetup | Context injection, convenience methods |
| Integration test server | Custom server setup | TestServer | Database setup, auth helpers |
| Mock services | Manual mock structs | testify/mock | Automatic expectation tracking |
| Test data | Hardcoded values | Factory pattern | Consistent, realistic data |
| Request building | String concatenation | json.Marshal() | Type-safe payloads |
| Response parsing | Manual json.Unmarshal | ParseResponse[T] | Generic, error handling |

**Key insight:** The existing testutil and integration packages provide comprehensive infrastructure. Extend these patterns rather than creating new ones.

## Common Pitfalls

### Pitfall 1: Context Not Injected in Unit Tests
**What goes wrong:** Handler returns 401 or panics due to missing workspace/user context
**Why it happens:** Forgot to use HandlerTestSetup which injects context
**How to avoid:** Always use `testutil.NewHandlerTestSetup()` for handler unit tests
**Warning signs:** "workspace_id not in context" errors

### Pitfall 2: Mock Expectations Not Met
**What goes wrong:** Tests pass despite bugs because mock wasn't called as expected
**Why it happens:** Forgot to call `mockSvc.AssertExpectations(t)` at end of test
**How to avoid:** Always assert expectations; use `.Once()` for precise call counts
**Warning signs:** Tests passing but bugs in production

### Pitfall 3: Integration Test Isolation
**What goes wrong:** Tests fail when run together but pass individually
**Why it happens:** Shared database state, non-unique emails/slugs
**How to avoid:** Use `uuid.New().String()[:8]` suffixes for unique identifiers
**Warning signs:** Flaky tests, "duplicate key" errors

### Pitfall 4: Huma Validation vs Service Validation
**What goes wrong:** Confusing which layer validates what
**Why it happens:** Huma validates request schema, service validates business rules
**How to avoid:**
  - 422 UnprocessableEntity: Request schema violations (missing required, wrong type)
  - 400 BadRequest: Business rule violations (duplicate SKU, invalid state transition)
  - 404 NotFound: Entity doesn't exist
**Warning signs:** Unexpected status codes

### Pitfall 5: Event Publishing in Handler Tests
**What goes wrong:** Tests fail due to nil broadcaster
**Why it happens:** Some handlers publish SSE events via broadcaster
**How to avoid:** Pass `nil` for broadcaster in unit tests (handlers check nil); use EventCapture in event tests
**Warning signs:** Nil pointer panic on event publish

## Code Examples

### Complete Handler Test File Structure
```go
package entity_test

import (
    "context"
    "net/http"
    "testing"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"

    "github.com/antti/home-warehouse/go-backend/internal/domain/warehouse/entity"
    "github.com/antti/home-warehouse/go-backend/internal/testutil"
)

// MockService implements the service interface
type MockService struct {
    mock.Mock
}

// Implement all service methods...

func TestHandler_Create(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    entity.RegisterRoutes(setup.API, mockSvc, nil)

    t.Run("creates successfully", func(t *testing.T) {
        // Arrange
        expected := entity.New(...)
        mockSvc.On("Create", mock.Anything, mock.Anything).Return(expected, nil).Once()

        // Act
        rec := setup.Post("/entities", `{"name":"test"}`)

        // Assert
        testutil.AssertStatus(t, rec, http.StatusOK)
        mockSvc.AssertExpectations(t)
    })

    t.Run("returns 400 for duplicate", func(t *testing.T) {
        mockSvc.On("Create", mock.Anything, mock.Anything).
            Return(nil, entity.ErrDuplicate).Once()

        rec := setup.Post("/entities", `{"name":"test"}`)

        testutil.AssertStatus(t, rec, http.StatusBadRequest)
        mockSvc.AssertExpectations(t)
    })

    t.Run("returns 422 for invalid request", func(t *testing.T) {
        // Service not called for validation errors
        rec := setup.Post("/entities", `{}`)
        testutil.AssertStatus(t, rec, http.StatusUnprocessableEntity)
    })
}

func TestHandler_Get(t *testing.T) {
    // Similar pattern...
}

func TestHandler_Update(t *testing.T) {
    // Similar pattern...
}

func TestHandler_Delete(t *testing.T) {
    // Similar pattern...
}
```

### Integration Test for Multi-Entity Flow
```go
//go:build integration

func TestLoanLifecycle(t *testing.T) {
    ts := NewTestServer(t)
    token := ts.AuthHelper(t, "loan_lifecycle_"+uuid.New().String()[:8]+"@example.com")
    ts.SetToken(token)

    // Setup: workspace, item, inventory, borrower
    ws := createTestWorkspace(t, ts, "Loan Lifecycle")
    workspacePath := fmt.Sprintf("/workspaces/%s", ws.ID)

    item := createTestItem(t, ts, workspacePath)
    location := createTestLocation(t, ts, workspacePath)
    inventory := createTestInventory(t, ts, workspacePath, item.ID, location.ID)
    borrower := createTestBorrower(t, ts, workspacePath)

    // Create loan
    resp := ts.Post(workspacePath+"/loans", map[string]interface{}{
        "inventory_id": inventory.ID,
        "borrower_id":  borrower.ID,
        "due_date":     time.Now().AddDate(0, 0, 7).Format("2006-01-02"),
    })
    RequireStatus(t, resp, http.StatusOK)
    loan := ParseResponse[struct { ID uuid.UUID }](t, resp)

    // Verify inventory status changed
    resp = ts.Get(fmt.Sprintf("%s/inventory/%s", workspacePath, inventory.ID))
    RequireStatus(t, resp, http.StatusOK)
    inv := ParseResponse[struct { Status string }](t, resp)
    assert.Equal(t, "ON_LOAN", inv.Status)

    // Return loan
    resp = ts.Post(fmt.Sprintf("%s/loans/%s/return", workspacePath, loan.ID), nil)
    RequireStatus(t, resp, http.StatusOK)

    // Verify inventory status restored
    resp = ts.Get(fmt.Sprintf("%s/inventory/%s", workspacePath, inventory.ID))
    RequireStatus(t, resp, http.StatusOK)
    inv = ParseResponse[struct { Status string }](t, resp)
    assert.Equal(t, "AVAILABLE", inv.Status)
}
```

## Work Division Recommendation

### Plan 1: Handler Unit Test Infrastructure and Patterns (24-01)
**Focus:** Establish patterns, fill gaps in handler unit tests
**Domains:** repairlog, repairphoto, repairattachment, declutter
**Approach:**
- Create mock services for each domain
- Test all CRUD operations with success/error cases
- Test validation at HTTP layer
**Estimated:** 3-4 hours

### Plan 2: Critical Flow Integration Tests (24-02)
**Focus:** Multi-entity workflows that span services
**Flows:**
- Loan lifecycle (create, extend, return, overdue)
- Repair log workflow (create, start, complete, warranty)
- Sync/batch operations (offline sync, conflict resolution)
**Approach:** Use TestServer with test database
**Estimated:** 3-4 hours

### Plan 3: Request/Response Validation Tests (24-03)
**Focus:** Comprehensive validation coverage across all endpoints
**Categories:**
- Required field validation
- Type validation (UUID, date, enum)
- Range validation (min/max, string length)
- Cross-field validation
- Error response format consistency
**Approach:** Table-driven tests for each domain
**Estimated:** 2-3 hours

## Open Questions

1. **Coverage targets for handler tests vs integration tests**
   - What we know: Phase 23 established 80% target for business logic
   - What's unclear: Should handlers aim for same target or lower (since integration tests also cover them)?
   - Recommendation: 60-70% for handlers, rely on integration tests for full coverage

2. **SSE event testing approach**
   - What we know: EventCapture helper exists in testutil
   - What's unclear: How thoroughly should events be tested in handler unit tests vs integration?
   - Recommendation: Basic event tests in unit tests, comprehensive in integration

3. **Approval middleware testing**
   - What we know: middleware has integration tests, handler_integration_test.go exists
   - What's unclear: Is current coverage sufficient?
   - Recommendation: Focus on pending change service tests in Phase 23 gaps, not duplicate effort

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All handler files examined
- Existing test patterns: `internal/testutil/`, `tests/integration/`
- Phase 22 and 23 research: Factory and service test patterns

### Secondary (MEDIUM confidence)
- testify documentation: Mock and assert patterns
- Huma v2 documentation: Request validation, error handling

## Metadata

**Confidence breakdown:**
- Handler test patterns: HIGH - Derived from existing codebase
- Coverage gaps: HIGH - Direct file analysis
- Integration patterns: HIGH - Extensive existing tests
- Work estimates: MEDIUM - Based on complexity analysis

**Research date:** 2026-01-31
**Valid until:** 2026-03-02 (30 days - stable domain)
