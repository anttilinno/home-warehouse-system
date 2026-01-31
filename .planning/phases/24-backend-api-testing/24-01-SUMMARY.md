---
phase: 24-backend-api-testing
plan: 01
subsystem: testing
tags: [go, handler-tests, unit-tests, repairphoto, declutter]

requires:
  - 23-backend-business-logic-tests

provides:
  - repairphoto handler unit tests
  - declutter handler unit tests

affects:
  - 24-02 through 24-06 (API testing patterns established)

tech-stack:
  added: []
  patterns:
    - MockService pattern for handler testing
    - ServiceInterface for dependency injection
    - EventCapture for testing SSE events

key-files:
  created:
    - backend/internal/domain/warehouse/repairphoto/handler_test.go
    - backend/internal/domain/warehouse/declutter/handler_test.go
  modified:
    - backend/internal/domain/warehouse/declutter/service.go
    - backend/internal/domain/warehouse/declutter/handler.go

decisions:
  DEC-24-01:
    title: "Add ServiceInterface to declutter package"
    choice: "Created interface and updated handler to accept interface"
    rationale: "Enables mocking for handler unit tests without changing production behavior"

metrics:
  duration: "~15 min"
  completed: "2026-01-31"
---

# Phase 24 Plan 01: RepairPhoto and Declutter Handler Tests Summary

Handler unit tests for repairphoto and declutter domains using mocked services.

## Completed Tasks

### Task 1: RepairPhoto Handler Tests
Created comprehensive handler_test.go for repairphoto package:
- MockService implementing ServiceInterface (multipart.File signature)
- ListPhotos: 3 test cases (success, empty, error)
- GetPhoto: 4 test cases (success, not found, wrong repair_log_id, error)
- UpdateCaption: 7 test cases (success, null caption, not found variations, errors)
- DeletePhoto: 6 test cases (success, not found variations, errors)
- Event publishing: 2 test cases
- Nil broadcaster safety: 2 test cases

**Total: 24 test cases, 539 lines**

### Task 2: Declutter Handler Tests
Created handler_test.go and added ServiceInterface:
- Added ServiceInterface to declutter/service.go
- Updated RegisterRoutes to accept interface
- MockService implementing ServiceInterface
- List: 7 test cases (success, threshold_days, pagination, group_by options, empty, error)
- GetCounts: 3 test cases (success, zero counts, error)
- MarkUsed: 2 test cases (success, error)
- Event publishing: 1 test case
- Nil broadcaster safety: 1 test case

**Total: 14 test cases, 331 lines**

## Coverage Improvement

| Package | Before | After |
|---------|--------|-------|
| repairphoto | ~10% | 20.5% |
| declutter | ~15% | 41.6% |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Declutter ServiceInterface**
- **Found during:** Task 2
- **Issue:** Declutter RegisterRoutes accepted concrete *Service, blocking mock injection
- **Fix:** Added ServiceInterface to service.go, updated RegisterRoutes signature
- **Files modified:** declutter/service.go, declutter/handler.go
- **Commit:** 6fee00f

## Key Test Patterns

```go
// MockService pattern for handler tests
type MockService struct {
    mock.Mock
}

func (m *MockService) ListPhotos(ctx context.Context, repairLogID, workspaceID uuid.UUID) ([]*repairphoto.RepairPhoto, error) {
    args := m.Called(ctx, repairLogID, workspaceID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*repairphoto.RepairPhoto), args.Error(1)
}
```

```go
// Event capture for SSE testing
capture := testutil.NewEventCapture(setup.WorkspaceID, setup.UserID)
capture.Start()
defer capture.Stop()

// ... perform action that publishes event ...

assert.True(t, capture.WaitForEvents(1, 500*time.Millisecond))
event := capture.GetLastEvent()
assert.Equal(t, "repair_photo.updated", event.Type)
```

## Commits

| Hash | Message |
|------|---------|
| 2c38771 | test(24-01): add comprehensive handler tests for repairphoto |
| 6fee00f | test(24-01): add comprehensive handler tests for declutter |

## Next Phase Readiness

**Ready for 24-02:** Patterns established for remaining handler tests:
- Wave 2: itemlabel, loan, movement, containertag handlers
- Mock service pattern validated
- Event capture pattern validated
