# Phase 23: Backend Business Logic Tests - Research

**Researched:** 2026-01-31
**Domain:** Go unit testing for domain/business logic packages
**Confidence:** HIGH

## Summary

This phase focuses on increasing test coverage from current baselines (17-40%) to 80%+ for 6 backend packages: importexport, pendingchange, importjob, jobs, itemphoto, and repairlog. The codebase already has established testing patterns using testify (assert/mock) and table-driven tests.

Research reveals that Phase 22 established test factory infrastructure at `backend/internal/testutil/factory/` with factories for Item, Location, Container, Inventory, User, Workspace, Category, and Borrower using gofakeit for realistic data. This infrastructure should be extended and leveraged for the new tests.

Each package has different characteristics: some are purely business logic (entity validation, state machines), others have service layers with repository dependencies requiring mocks, and handlers that need HTTP testing.

**Primary recommendation:** Focus on service layer tests with mocks for each package, then entity validation tests, targeting 80% coverage per package. Jobs package may need a relaxed target due to external dependencies (Redis, asynq).

## Current State Analysis

### Package Coverage Baselines

| Package | Current | Target | Gap | Lines of Code |
|---------|---------|--------|-----|---------------|
| importexport | 31% | 80% | +49% | 5,646 |
| pendingchange | 29% | 80% | +51% | 4,510 |
| importjob | 38% | 80% | +42% | 1,488 |
| jobs | 17% | 80% | +63% | 4,332 |
| itemphoto | 40% | 80% | +40% | 4,034 |
| repairlog | 36% | 80% | +44% | 2,065 |

### What Each Package Contains

**importexport** (5,646 lines)
- `service.go` (739 lines) - Export/import for 7 entity types, CSV/JSON formats
- `workspace_backup.go` (697 lines) - Full workspace backup to Excel/JSON
- `workspace_restore.go` (767 lines) - Workspace restore from Excel/JSON
- `handler.go` (260 lines) - HTTP handlers
- `types.go` (255 lines) - Type definitions
- Existing tests: service_test.go (2,493 lines), handler_test.go (436 lines)

**pendingchange** (4,510 lines)
- `service.go` (1,015 lines) - Approval pipeline logic for 8 entity types
- `handler.go` (402 lines) - HTTP handlers
- `entity.go` (243 lines) - PendingChange entity with state machine
- `middleware_adapter.go` (54 lines) - Request interception
- Existing tests: service_test.go (1,753 lines), entity_test.go (434 lines)

**importjob** (1,488 lines)
- `entity.go` (270 lines) - ImportJob and ImportError entities
- `handler.go` (279 lines) - HTTP handlers
- `upload_handler.go` (152 lines) - File upload handling
- Existing tests: entity_test.go (755 lines) - only entity tests exist

**jobs** (4,332 lines)
- `scheduler.go` (202 lines) - Asynq scheduler setup
- `cleanup.go` (95 lines) - Deleted records/activity cleanup
- `loan_reminders.go` (220 lines) - Due date reminder scheduling
- `repair_reminders.go` (251 lines) - Maintenance reminder scheduling
- `thumbnail_processor.go` (207 lines) - Background image processing
- Existing tests: cleanup_test.go (271 lines), scheduler_test.go (470 lines), loan_reminders_test.go (633 lines), repair_reminders_test.go (358 lines)

**itemphoto** (4,034 lines)
- `service.go` (547 lines) - Photo upload, CRUD, bulk operations, duplicate detection
- `handler.go` (895 lines) - HTTP handlers
- `entity.go` (230 lines) - ItemPhoto entity with validation
- Existing tests: service_test.go (1,865 lines), handler_test.go (408 lines)

**repairlog** (2,065 lines)
- `service.go` (301 lines) - Repair lifecycle management
- `handler.go` (514 lines) - HTTP handlers
- `entity.go` (278 lines) - RepairLog entity with state machine
- Existing tests: service_test.go (553 lines), entity_test.go (350 lines)

## Standard Stack

### Core Testing Tools
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| testing | stdlib | Test framework | Go standard library |
| testify/assert | v1.9+ | Assertions | Used throughout codebase |
| testify/mock | v1.9+ | Mocking | Established pattern in codebase |
| testify/require | v1.9+ | Fatal assertions | For setup failures |

### Supporting Tools
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gofakeit/v7 | v7.0+ | Fake data | Realistic test data via factories |
| httptest | stdlib | HTTP testing | Handler tests |
| context | stdlib | Context handling | All service/handler tests |

### Existing Test Factories (from Phase 22)
| Factory | Location | Creates |
|---------|----------|---------|
| Item | `testutil/factory/item.go` | Item entities with options |
| Location | `testutil/factory/location.go` | Location entities |
| Container | `testutil/factory/container.go` | Container entities |
| Inventory | `testutil/factory/inventory.go` | Inventory entities |
| User | `testutil/factory/user.go` | User entities |
| Workspace | `testutil/factory/workspace.go` | Workspace entities |
| Category | `testutil/factory/category.go` | Category entities |
| Borrower | `testutil/factory/borrower.go` | Borrower entities |

## Architecture Patterns

### Test File Organization
```
backend/internal/domain/warehouse/[package]/
├── entity.go
├── entity_test.go           # Entity validation, state transitions
├── service.go
├── service_test.go          # Service logic with mocked repos
├── handler.go
├── handler_test.go          # HTTP handler tests (optional)
└── repository.go
```

### Pattern 1: Mock Repository with testify/mock
**What:** Create mock implementations of repository interfaces
**When to use:** Service layer tests
**Example:**
```go
// Existing pattern from pendingchange/service_test.go
type MockPendingChangeRepository struct {
    mock.Mock
}

func (m *MockPendingChangeRepository) Save(ctx context.Context, change *PendingChange) error {
    args := m.Called(ctx, change)
    return args.Error(0)
}

func (m *MockPendingChangeRepository) FindByID(ctx context.Context, id uuid.UUID) (*PendingChange, error) {
    args := m.Called(ctx, id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*PendingChange), args.Error(1)
}
```

### Pattern 2: Table-Driven Tests
**What:** Define test cases as a slice of structs
**When to use:** Testing multiple similar scenarios
**Example:**
```go
// Existing pattern from importjob/entity_test.go
func TestNewImportJob(t *testing.T) {
    tests := []struct {
        name          string
        workspaceID   uuid.UUID
        userID        uuid.UUID
        entityType    importjob.EntityType
        fileName      string
        filePath      string
        fileSizeBytes int64
        wantErr       bool
        errMsg        string
    }{
        {
            name:          "valid import job with items entity type",
            workspaceID:   workspaceID,
            // ...
        },
        // more test cases
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            job, err := importjob.NewImportJob(/* params */)
            if tt.wantErr {
                assert.Error(t, err)
                // ...
            } else {
                assert.NoError(t, err)
                // ...
            }
        })
    }
}
```

### Pattern 3: Entity Reconstruct for Testing
**What:** Use Reconstruct functions to create entities in specific states
**When to use:** Testing state-dependent logic (e.g., status transitions)
**Example:**
```go
// Existing pattern from repairlog/service_test.go
func newInProgressRepairLog(workspaceID, inventoryID uuid.UUID) *RepairLog {
    return Reconstruct(
        uuid.New(),
        workspaceID,
        inventoryID,
        StatusInProgress,  // Specific state for testing
        "Test repair",
        nil, nil, nil, nil, nil, nil, nil,
        false, nil, false,
        time.Now(),
        time.Now(),
    )
}
```

### Pattern 4: Service with Multiple Mock Dependencies
**What:** Inject multiple mock repositories into service
**When to use:** Complex services with cross-domain operations
**Example:**
```go
// Existing pattern from pendingchange/service_test.go
service := &Service{
    repo:       mockRepo,
    memberRepo: mockMemberRepo,
    userRepo:   mockUserRepo,
    itemRepo:   mockItemRepo,
}
```

### Anti-Patterns to Avoid
- **Testing implementation details:** Test behavior, not internal state
- **Over-mocking:** Don't mock pure functions or value objects
- **Ignoring error paths:** Always test error cases
- **Flaky time tests:** Use deterministic time or time injection

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test assertions | Custom assert functions | testify/assert | Battle-tested, clear failure messages |
| Mock implementations | Manual mock structs | testify/mock | Automatic expectation tracking |
| Fake data | Hardcoded strings | gofakeit via factories | Realistic, varied data |
| HTTP testing | Manual request building | httptest.NewRecorder() | Standard library support |
| Context timeouts | Untested contexts | context.WithTimeout() | Prevent hanging tests |

## Coverage Gaps by Package

### importexport - Primary Gaps
1. **workspace_backup.go** (697 lines) - No tests
   - `ExportWorkspace()` - Full workspace export
   - `fetchAllData()` - Multi-entity fetching
   - `generateExcel()` - Excel file generation

2. **workspace_restore.go** (767 lines) - No tests
   - `ImportWorkspace()` - Full workspace import
   - `parseExcel()` - Excel parsing
   - Multiple `parse*FromRows()` functions
   - Multiple `import*()` functions

3. **Service error paths**
   - Repository errors during export
   - Parse errors during import
   - Mixed success/failure scenarios

### pendingchange - Primary Gaps
1. **Service apply methods** (untested entity types)
   - `applyCategoryChange()` - Category CRUD
   - `applyLocationChange()` - Location CRUD
   - `applyContainerChange()` - Container CRUD
   - `applyInventoryChange()` - Inventory CRUD
   - `applyBorrowerChange()` - Borrower CRUD
   - `applyLoanChange()` - Loan CRUD
   - `applyLabelChange()` - Label CRUD

2. **Handler tests** - Minimal coverage
   - Request parsing
   - Error responses
   - Authentication checks

3. **Middleware adapter** - No tests

### importjob - Primary Gaps
1. **handler.go** (279 lines) - No tests
   - List import jobs
   - Get import job
   - Cancel import job
   - List import errors

2. **upload_handler.go** (152 lines) - No tests
   - File upload validation
   - MIME type checking
   - Size limits

### jobs - Primary Gaps
1. **loan_reminders.go processor** - Partial
   - `LoanReminderProcessor.ProcessTask()` - asynq task handling
   - Error scenarios

2. **repair_reminders.go** - Partial
   - `RepairReminderProcessor.ProcessTask()` - asynq task handling

3. **thumbnail_processor.go** (207 lines) - No tests
   - Multi-size thumbnail generation
   - Error handling
   - SSE event publishing

4. **scheduler.go integration** - Complex
   - Task registration
   - Scheduled tasks

### itemphoto - Primary Gaps
1. **Bulk operations** - Partial
   - `BulkDeletePhotos()` - edge cases
   - `BulkUpdateCaptions()` - error paths

2. **CheckDuplicates()** - Minimal
   - Perceptual hash comparison
   - Similarity scoring

3. **Handler tests** - Partial (408 lines)
   - File serving
   - Thumbnail endpoints
   - Bulk operation endpoints

### repairlog - Primary Gaps
1. **Service methods** - Partial
   - `SetWarrantyClaim()` - error paths
   - `SetReminderDate()` - error paths
   - `GetTotalRepairCost()` - not tested

2. **Handler tests** - No tests
   - All endpoints untested

## Common Pitfalls

### Pitfall 1: Mock Expectation Order
**What goes wrong:** Tests fail due to unexpected call order
**Why it happens:** testify/mock tracks call order
**How to avoid:** Use `mock.Anything` when order doesn't matter, or set explicit expectations
**Warning signs:** "expected 0 calls but received 1" errors

### Pitfall 2: Nil Pointer in Mock Returns
**What goes wrong:** Panic when accessing mock return values
**Why it happens:** Returning nil without proper nil check
**How to avoid:** Always check `args.Get(0) == nil` before casting
```go
// Correct pattern
func (m *MockRepo) FindByID(ctx context.Context, id uuid.UUID) (*Entity, error) {
    args := m.Called(ctx, id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*Entity), args.Error(1)
}
```

### Pitfall 3: Time-Based Test Flakiness
**What goes wrong:** Tests pass sometimes, fail other times
**Why it happens:** Comparing `time.Now()` values
**How to avoid:** Use time tolerance or freeze time
```go
// Use tolerance
assert.WithinDuration(t, expected, actual, time.Second)
// Or compare with After/Before
assert.True(t, job.UpdatedAt().After(originalUpdatedAt))
```

### Pitfall 4: Incomplete Mock Setup
**What goes wrong:** "method X was not expected to be called"
**Why it happens:** Forgot to set up expectation for a method
**How to avoid:** Review all repository calls in the code path being tested

### Pitfall 5: State Machine Test Gaps
**What goes wrong:** Invalid state transitions not caught
**Why it happens:** Only testing happy paths
**How to avoid:** Test all invalid transitions explicitly
```go
// Test invalid transitions
t.Run("fails when already completed", func(t *testing.T) {
    repair := newCompletedRepairLog()
    err := repair.Complete(nil)
    assert.Equal(t, ErrInvalidStatusTransition, err)
})
```

## Code Examples

### Complete Service Test Pattern
```go
// Based on existing repairlog/service_test.go pattern
func TestCreate_Success(t *testing.T) {
    mockRepo := new(MockRepository)
    mockInvRepo := new(MockInventoryRepository)
    svc := NewService(mockRepo, mockInvRepo)

    ctx := context.Background()
    workspaceID := uuid.New()
    inventoryID := uuid.New()

    inv := newTestInventory(workspaceID, itemID, locationID)

    mockInvRepo.On("FindByID", ctx, inventoryID, workspaceID).Return(inv, nil)
    mockRepo.On("Save", ctx, mock.AnythingOfType("*repairlog.RepairLog")).Return(nil)

    input := CreateInput{
        WorkspaceID: workspaceID,
        InventoryID: inventoryID,
        Description: "Screen replacement",
    }

    repairLog, err := svc.Create(ctx, input)

    assert.NoError(t, err)
    assert.NotNil(t, repairLog)
    assert.Equal(t, StatusPending, repairLog.Status())
    mockInvRepo.AssertExpectations(t)
    mockRepo.AssertExpectations(t)
}
```

### Entity State Machine Test Pattern
```go
// Based on existing entity_test patterns
func TestRepairLog_StatusTransitions(t *testing.T) {
    tests := []struct {
        name          string
        initialStatus RepairStatus
        action        string
        wantErr       error
        wantStatus    RepairStatus
    }{
        {
            name:          "pending to in_progress",
            initialStatus: StatusPending,
            action:        "start",
            wantErr:       nil,
            wantStatus:    StatusInProgress,
        },
        {
            name:          "in_progress to completed",
            initialStatus: StatusInProgress,
            action:        "complete",
            wantErr:       nil,
            wantStatus:    StatusCompleted,
        },
        {
            name:          "pending cannot complete directly",
            initialStatus: StatusPending,
            action:        "complete",
            wantErr:       ErrInvalidStatusTransition,
            wantStatus:    StatusPending,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            repair := createRepairWithStatus(tt.initialStatus)

            var err error
            switch tt.action {
            case "start":
                err = repair.StartRepair()
            case "complete":
                err = repair.Complete(nil)
            }

            if tt.wantErr != nil {
                assert.Equal(t, tt.wantErr, err)
            } else {
                assert.NoError(t, err)
            }
            assert.Equal(t, tt.wantStatus, repair.Status())
        })
    }
}
```

### Handler Test Pattern
```go
// Standard HTTP handler test pattern
func TestHandler_ListByInventory(t *testing.T) {
    mockService := new(MockService)
    handler := NewHandler(mockService)

    ctx := context.Background()
    workspaceID := uuid.New()
    inventoryID := uuid.New()

    repairs := []*RepairLog{newTestRepairLog()}
    mockService.On("ListByInventory", mock.Anything, workspaceID, inventoryID).Return(repairs, nil)

    req := httptest.NewRequest("GET", "/repairs?inventory_id="+inventoryID.String(), nil)
    req = req.WithContext(context.WithValue(req.Context(), "workspace_id", workspaceID))
    rec := httptest.NewRecorder()

    handler.ServeHTTP(rec, req)

    assert.Equal(t, http.StatusOK, rec.Code)
    mockService.AssertExpectations(t)
}
```

## Work Division Recommendation

### Plan 1: importexport (Estimated: 4-6 hours)
- Focus: workspace_backup.go, workspace_restore.go
- Approach: Create mock queries interface, test export/import flows
- Dependencies: Need mock for queries.Queries

### Plan 2: pendingchange (Estimated: 3-4 hours)
- Focus: apply* methods for remaining entity types
- Approach: Add mock repos for each entity type, test CRUD for all 8 types
- Dependencies: Existing mock infrastructure

### Plan 3: importjob (Estimated: 2-3 hours)
- Focus: handler.go, upload_handler.go
- Approach: HTTP handler tests with mock service
- Dependencies: Minimal

### Plan 4: jobs (Estimated: 3-4 hours)
- Focus: thumbnail_processor.go, processor task handling
- Approach: Mock dependencies (storage, processor), test task execution
- Note: May accept lower coverage due to external deps

### Plan 5: itemphoto (Estimated: 2-3 hours)
- Focus: Bulk operations, duplicate detection, remaining handlers
- Approach: Extend existing mock infrastructure
- Dependencies: Existing mocks

### Plan 6: repairlog (Estimated: 2-3 hours)
- Focus: Remaining service methods, handler tests
- Approach: HTTP handler tests, error path coverage
- Dependencies: Existing mocks

## Open Questions

1. **Jobs package coverage target**
   - What we know: Jobs package has heavy external dependencies (Redis, asynq)
   - What's unclear: Is 80% achievable without integration tests?
   - Recommendation: Accept 60-70% for jobs, focus on testable business logic

2. **workspace_backup/restore testing strategy**
   - What we know: These use queries.Queries directly (not repository pattern)
   - What's unclear: Best way to mock sqlc-generated code
   - Recommendation: Create interface wrapper or accept integration-only testing

3. **Handler test value vs. effort**
   - What we know: Handler tests are verbose and often duplicate service tests
   - What's unclear: Whether handler coverage is worth the effort
   - Recommendation: Focus on service tests, add handler tests only for complex request parsing

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 6 target packages examined in full
- Existing test files: Patterns extracted from service_test.go, entity_test.go
- Phase 22 factory infrastructure: backend/internal/testutil/factory/

### Secondary (MEDIUM confidence)
- testify documentation: Mock and assert patterns
- Go testing stdlib: Table-driven test patterns

## Metadata

**Confidence breakdown:**
- Package analysis: HIGH - Full source code review
- Coverage gaps: HIGH - Based on actual test coverage output
- Testing patterns: HIGH - Derived from existing codebase
- Work estimates: MEDIUM - Based on code complexity analysis

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable domain)
