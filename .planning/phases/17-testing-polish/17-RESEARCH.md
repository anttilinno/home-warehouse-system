# Phase 17: Testing & Polish - Research

**Researched:** 2026-01-25
**Domain:** Go backend testing, SSE event publishing verification
**Confidence:** HIGH

## Summary

Phase 17 focuses on adding SSE event publishing tests to 9 handler domains and documenting the import workflow for manual testing. The codebase already has excellent infrastructure for SSE event testing:

1. **`testutil.EventCapture`** - A ready-to-use test utility that captures SSE events published by handlers
2. **Established patterns** - `item/handler_test.go` and `loan/handler_test.go` demonstrate the exact pattern to follow
3. **All handlers already publish events** - The `broadcaster.Publish()` calls exist in all 9 target handlers; tests just need to verify them

**Primary recommendation:** Copy the proven SSE test pattern from `item/handler_test.go` to the 9 remaining handlers. The infrastructure is 100% ready; this is copy-and-adapt work.

## Standard Stack

### Core Testing Infrastructure

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| testify/mock | v1.9+ | Mock services for handler tests | Already used throughout codebase |
| testify/assert | v1.9+ | Test assertions | Already used throughout codebase |
| testutil.EventCapture | internal | Captures SSE events for verification | Custom test utility already built |
| testutil.HandlerTestSetup | internal | HTTP handler test setup with mocked auth | Custom test utility already built |

### Testing Pattern Overview

```
Test Flow:
1. Create HandlerTestSetup (provides mocked workspace/user context)
2. Create EventCapture with same workspace/user IDs
3. Start event capture (capture.Start())
4. Register routes with capture.GetBroadcaster()
5. Execute HTTP request
6. Wait for events (capture.WaitForEvents())
7. Verify event properties
8. Stop capture (capture.Stop() in defer)
```

## Architecture Patterns

### SSE Event Test Pattern (ESTABLISHED)

This exact pattern exists in `item/handler_test.go` and `loan/handler_test.go`:

```go
func TestHandler_Operation_PublishesEvent(t *testing.T) {
    // 1. Setup
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
    capture.Start()
    defer capture.Stop()

    // 2. Register routes with broadcaster
    entity.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

    // 3. Mock service call
    mockSvc.On("Create", mock.Anything, mock.Anything).Return(entity, nil).Once()

    // 4. Make request
    rec := setup.Post("/entities", body)
    testutil.AssertStatus(t, rec, http.StatusOK)
    mockSvc.AssertExpectations(t)

    // 5. Verify event
    assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

    event := capture.GetLastEvent()
    assert.NotNil(t, event)
    assert.Equal(t, "entity.created", event.Type)
    assert.Equal(t, "entity", event.EntityType)
    assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
    assert.Equal(t, setup.UserID, event.UserID)
    assert.Equal(t, entityID.String(), event.EntityID)
}
```

### Nil Broadcaster Safety Test Pattern

Each handler test file should also verify handlers don't crash with nil broadcaster:

```go
func TestHandler_Operation_NilBroadcaster_NoError(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    // Register with nil broadcaster
    entity.RegisterRoutes(setup.API, mockSvc, nil)

    // ... perform operation ...

    // Should not panic and should succeed
    testutil.AssertStatus(t, rec, http.StatusOK)
}
```

### Event Types by Handler

| Handler | Create Event | Update Event | Delete Event | Special Events |
|---------|--------------|--------------|--------------|----------------|
| borrower | `borrower.created` | `borrower.updated` | `borrower.deleted` | - |
| inventory | `inventory.created` | `inventory.updated` | `inventory.deleted` | `inventory.moved`, `inventory.status_changed` |
| location | `location.created` | `location.updated` | `location.deleted` | - |
| container | `container.created` | `container.updated` | `container.deleted` | - |
| category | `category.created` | `category.updated` | `category.deleted` | - |
| label | `label.created` | `label.updated` | `label.deleted` | - |
| company | `company.created` | `company.updated` | `company.deleted` | - |
| favorite | `favorite.toggled` | - | - | Only toggle operation |
| attachment | `attachment.created` | - | `attachment.deleted` | `attachment.primary_changed` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event capture for tests | Custom broadcaster wrapper | `testutil.EventCapture` | Already exists, handles goroutine sync |
| Handler test setup | Manual chi router setup | `testutil.NewHandlerTestSetup()` | Pre-configures workspace context |
| Event timing | `time.Sleep()` | `capture.WaitForEvents(count, timeout)` | Handles async correctly |
| Broadcaster injection | Global broadcaster | `RegisterRoutes(..., broadcaster)` | All handlers accept broadcaster param |

## Common Pitfalls

### Pitfall 1: Missing `capture.Start()` call
**What goes wrong:** No events captured, test times out
**Why it happens:** EventCapture needs explicit start to begin listening
**How to avoid:** Always call `capture.Start()` before making requests
**Warning signs:** WaitForEvents returns false despite correct handler code

### Pitfall 2: Forgetting `defer capture.Stop()`
**What goes wrong:** Goroutine leaks, channel not closed properly
**Why it happens:** EventCapture runs background goroutine
**How to avoid:** Always `defer capture.Stop()` immediately after `Start()`
**Warning signs:** Race condition warnings in tests

### Pitfall 3: Timeout too short for CI
**What goes wrong:** Tests flaky on slower CI machines
**Why it happens:** 100ms timeout may be too aggressive under load
**How to avoid:** Use 500ms timeout as standard (matches existing tests)
**Warning signs:** Test passes locally but fails in CI

### Pitfall 4: Testing with wrong UserID
**What goes wrong:** Event UserID doesn't match expected
**Why it happens:** EventCapture created with different UserID than setup
**How to avoid:** Always use `setup.UserID` when creating EventCapture
**Warning signs:** Event assertions fail on UserID comparison

### Pitfall 5: Mock service not returning expected data
**What goes wrong:** Handler doesn't publish event because service returned nil/error
**Why it happens:** Event publishing happens after successful service call
**How to avoid:** Ensure mock returns valid entity for success tests
**Warning signs:** No event captured despite 200 response

## Code Examples

### Example: Borrower Handler SSE Tests

```go
// Source: Pattern from backend/internal/domain/warehouse/item/handler_test.go

func TestBorrowerHandler_Create_PublishesEvent(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
    capture.Start()
    defer capture.Stop()

    borrower.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

    email := "test@example.com"
    testBorrower, _ := borrower.NewBorrower(setup.WorkspaceID, "Test Borrower", &email, nil, nil)

    mockSvc.On("Create", mock.Anything, mock.MatchedBy(func(input borrower.CreateInput) bool {
        return input.Name == "Test Borrower"
    })).Return(testBorrower, nil).Once()

    body := `{"name":"Test Borrower","email":"test@example.com"}`
    rec := setup.Post("/borrowers", body)

    testutil.AssertStatus(t, rec, http.StatusOK)
    mockSvc.AssertExpectations(t)

    // Verify event
    assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

    event := capture.GetLastEvent()
    assert.NotNil(t, event)
    assert.Equal(t, "borrower.created", event.Type)
    assert.Equal(t, "borrower", event.EntityType)
    assert.Equal(t, setup.WorkspaceID, event.WorkspaceID)
    assert.Equal(t, setup.UserID, event.UserID)
    assert.Equal(t, testBorrower.ID().String(), event.EntityID)
    assert.Equal(t, testBorrower.ID(), event.Data["id"])
    assert.Equal(t, testBorrower.Name(), event.Data["name"])
}

func TestBorrowerHandler_Update_PublishesEvent(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
    capture.Start()
    defer capture.Stop()

    borrower.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

    testBorrower, _ := borrower.NewBorrower(setup.WorkspaceID, "Updated Borrower", nil, nil, nil)
    borrowerID := testBorrower.ID()

    mockSvc.On("Update", mock.Anything, borrowerID, setup.WorkspaceID, mock.Anything).
        Return(testBorrower, nil).Once()

    body := `{"name":"Updated Borrower"}`
    rec := setup.Patch(fmt.Sprintf("/borrowers/%s", borrowerID), body)

    testutil.AssertStatus(t, rec, http.StatusOK)
    mockSvc.AssertExpectations(t)

    assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

    event := capture.GetLastEvent()
    assert.NotNil(t, event)
    assert.Equal(t, "borrower.updated", event.Type)
    assert.Equal(t, "borrower", event.EntityType)
    assert.Equal(t, borrowerID.String(), event.EntityID)
}

func TestBorrowerHandler_Delete_PublishesEvent(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
    capture.Start()
    defer capture.Stop()

    borrower.RegisterRoutes(setup.API, mockSvc, capture.GetBroadcaster())

    borrowerID := uuid.New()

    mockSvc.On("Archive", mock.Anything, borrowerID, setup.WorkspaceID).
        Return(nil).Once()

    rec := setup.Delete(fmt.Sprintf("/borrowers/%s", borrowerID))

    testutil.AssertStatus(t, rec, http.StatusNoContent)
    mockSvc.AssertExpectations(t)

    assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond), "Event should be published")

    event := capture.GetLastEvent()
    assert.NotNil(t, event)
    assert.Equal(t, "borrower.deleted", event.Type)
    assert.Equal(t, "borrower", event.EntityType)
    assert.Equal(t, borrowerID.String(), event.EntityID)
}

func TestBorrowerHandler_Create_NilBroadcaster_NoError(t *testing.T) {
    setup := testutil.NewHandlerTestSetup()
    mockSvc := new(MockService)
    borrower.RegisterRoutes(setup.API, mockSvc, nil)

    testBorrower, _ := borrower.NewBorrower(setup.WorkspaceID, "Test", nil, nil, nil)
    mockSvc.On("Create", mock.Anything, mock.Anything).Return(testBorrower, nil).Once()

    body := `{"name":"Test"}`
    rec := setup.Post("/borrowers", body)

    testutil.AssertStatus(t, rec, http.StatusOK)
    mockSvc.AssertExpectations(t)
}
```

## Import Workflow Manual Testing Checklist

The import feature is a background worker process that:
1. Receives import jobs via Redis queue
2. Parses CSV files
3. Creates entities in batches
4. Publishes SSE progress events
5. Records errors for failed rows

### Import Components

| Component | Path | Purpose |
|-----------|------|---------|
| Import Handler | `internal/domain/importexport/handler.go` | HTTP API for import/export |
| Import Worker | `internal/worker/import_worker.go` | Background job processor |
| Import Job Entity | `internal/domain/warehouse/importjob/` | Job state management |
| Queue | `internal/infra/queue/queue.go` | Redis-based job queue |

### Supported Entity Types

1. **Items** (`items`) - name, sku, description, brand, model, manufacturer
2. **Locations** (`locations`) - name, parent_location, description, short_code
3. **Containers** (`containers`) - name, location, description, capacity, short_code
4. **Categories** (`categories`) - name, parent_category, description
5. **Borrowers** (`borrowers`) - name, email, phone, notes
6. **Inventory** (`inventory`) - item, location, container, quantity, condition, status

### Manual Testing Checklist Template

```markdown
## Import Workflow Manual Testing Checklist

### Pre-requisites
- [ ] Backend server running (`mise run dev`)
- [ ] Worker process running (`mise run worker`)
- [ ] Redis running (`mise run dc-up`)
- [ ] PostgreSQL running
- [ ] Test workspace created

### Test 1: Items Import - Happy Path
- [ ] Create CSV: `name,sku,description\nItem A,SKU001,Test\nItem B,SKU002,Test2`
- [ ] POST to `/workspaces/{id}/import/item` with base64 encoded data
- [ ] Verify 200 response with job ID
- [ ] Check worker logs show processing
- [ ] Verify items created in database
- [ ] Verify import_jobs table shows completed status

### Test 2: Items Import - Validation Errors
- [ ] Create CSV with missing names: `name,sku\n,SKU001\nItem B,SKU002`
- [ ] POST to import endpoint
- [ ] Verify job completes with error_count > 0
- [ ] Check import_errors table has row-level errors

### Test 3: Locations Import with Hierarchy
- [ ] Create CSV: `name,short_code,parent_location\nWarehouse,WH-A,\nShelf 1,SH-1,Warehouse`
- [ ] Import and verify parent-child relationship

### Test 4: Inventory Import with References
- [ ] Pre-create items and locations
- [ ] Create CSV referencing them by name/short_code
- [ ] Verify inventory records created with correct FKs

### Test 5: Progress Events (SSE)
- [ ] Connect to SSE endpoint for workspace
- [ ] Start large import (100+ rows)
- [ ] Verify `import.progress` events received
- [ ] Verify progress percentage increases
- [ ] Verify final 100% event on completion

### Test 6: Export-Import Round Trip
- [ ] Export existing items via `/export/item?format=csv`
- [ ] Clear items from workspace
- [ ] Import the exported CSV
- [ ] Verify data matches original

### Test 7: Error Handling
- [ ] Import with invalid entity type
- [ ] Import with malformed CSV
- [ ] Import with duplicate SKUs
- [ ] Verify appropriate error messages

### Notes
- All imports are workspace-scoped
- Progress events include: id, status, progress, processed_rows, success_count, error_count, total_rows
- Worker polls Redis every 5 seconds for jobs
```

## Gaps Identified

### Gap 1: No Automated Integration Tests for Import Worker
**Current state:** Import worker tested manually; integration tests exist for repository only
**Impact:** Worker processing logic not covered by CI
**Recommendation:** Manual testing checklist suffices for Phase 17; consider automated integration tests in future

### Gap 2: Event Data Assertions May Vary
**Current state:** Some handlers include different data fields in events
**Impact:** Need to verify actual handler code for exact event.Data fields
**Recommendation:** Check each handler's `broadcaster.Publish()` call for exact Data map

## Sources

### Primary (HIGH confidence)
- `backend/internal/testutil/event_capture.go` - EventCapture implementation
- `backend/internal/testutil/handler.go` - HandlerTestSetup implementation
- `backend/internal/domain/warehouse/item/handler_test.go` - SSE test pattern example
- `backend/internal/domain/warehouse/loan/handler_test.go` - SSE test pattern example

### Secondary (HIGH confidence)
- Handler files for each domain - verified `broadcaster.Publish()` locations
- `backend/internal/infra/events/broadcaster.go` - Broadcaster interface

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified existing test infrastructure
- Architecture: HIGH - Established pattern with working examples
- Pitfalls: HIGH - Derived from actual test code and async patterns

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (stable testing patterns)

## Handler SSE Coverage Analysis

Current state of SSE tests in handler test files:

| Handler | Has SSE Tests | Event Count | File Path |
|---------|---------------|-------------|-----------|
| item | YES | 5 tests | `internal/domain/warehouse/item/handler_test.go` |
| loan | YES | 4 tests | `internal/domain/warehouse/loan/handler_test.go` |
| borrower | NO | 0 tests | `internal/domain/warehouse/borrower/handler_test.go` |
| inventory | NO | 0 tests | `internal/domain/warehouse/inventory/handler_test.go` |
| location | NO | 0 tests | `internal/domain/warehouse/location/handler_test.go` |
| container | NO | 0 tests | `internal/domain/warehouse/container/handler_test.go` |
| category | NO | 0 tests | `internal/domain/warehouse/category/handler_test.go` |
| label | NO | 0 tests | `internal/domain/warehouse/label/handler_test.go` |
| company | NO | 0 tests | `internal/domain/warehouse/company/handler_test.go` |
| favorite | NO | 0 tests | `internal/domain/warehouse/favorite/handler_test.go` |
| attachment | NO | 0 tests | `internal/domain/warehouse/attachment/handler_test.go` |

**Required SSE tests per handler (based on Publish() calls in handler.go):**

- **borrower** (3): created, updated, deleted
- **inventory** (7): created, updated x2, moved, status_changed, quantity_changed, deleted
- **location** (5): created, updated, archived, restored, deleted
- **container** (5): created, updated, archived, restored, deleted
- **category** (5): created, updated, archived, restored, deleted
- **label** (5): created, updated, archived, restored, deleted
- **company** (5): created, updated, archived, restored, deleted
- **favorite** (1): toggled
- **attachment** (4): created x2, primary_changed, deleted
