---
phase: 22-test-infrastructure-setup
plan: 01
subsystem: testing
tags: [gofakeit, factory-pattern, functional-options, go-testing, domain-entities]

# Dependency graph
requires:
  - phase: domain-entities
    provides: Domain entity constructors (NewItem, NewLocation, etc.)
provides:
  - Test factory package with 8 entity factories
  - Builder pattern with functional options for test data
  - Multi-tenant workspace context for test isolation
  - gofakeit integration for realistic fake data
affects: [23-backend-coverage-push, 24-frontend-coverage-push, handler-tests, service-tests]

# Tech tracking
tech-stack:
  added: [github.com/brianvoe/gofakeit/v7]
  patterns: [factory-pattern, functional-options]

key-files:
  created:
    - backend/internal/testutil/factory/factory.go
    - backend/internal/testutil/factory/item.go
    - backend/internal/testutil/factory/location.go
    - backend/internal/testutil/factory/container.go
    - backend/internal/testutil/factory/inventory.go
    - backend/internal/testutil/factory/user.go
    - backend/internal/testutil/factory/workspace.go
    - backend/internal/testutil/factory/category.go
    - backend/internal/testutil/factory/borrower.go
    - backend/internal/testutil/factory/factory_test.go
  modified:
    - backend/go.mod
    - backend/go.sum

key-decisions:
  - "Use functional options pattern for factory customization"
  - "Factory creates immutable entities via Reconstruct when setters unavailable"
  - "Container and Inventory require parent IDs as parameters, not options"
  - "Default workspace/user IDs are deterministic UUIDs for test reproducibility"

patterns-established:
  - "Factory pattern: f := factory.New() then f.Item(), f.Location() etc."
  - "Functional options: f.Item(factory.WithItemName('...'), factory.WithItemSKU('...'))"
  - "Workspace context: f.WithWorkspace(id).Item() inherits workspace ID"
  - "Multi-tenant test isolation: each factory instance has workspace/user context"

# Metrics
duration: 6min
completed: 2026-01-31
---

# Phase 22 Plan 01: Test Factory Infrastructure Summary

**Go test factories with gofakeit for 8 warehouse entities using functional options pattern**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-31T13:36:19Z
- **Completed:** 2026-01-31T13:42:xx
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Created factory package with workspace/user context for multi-tenant isolation
- Implemented 8 entity factories: User, Workspace, Category, Borrower, Item, Location, Container, Inventory
- Each factory uses domain constructors with gofakeit for realistic fake data
- 28 tests demonstrating one-call creation, options customization, and workspace inheritance

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gofakeit dependency and create factory base** - `f09bc27` (feat)
2. **Task 2: Create entity factories for core warehouse entities** - `5f6705e` (feat)
3. **Task 3: Add factory unit tests and verify usage pattern** - `707d469` (test)

## Files Created/Modified

- `backend/internal/testutil/factory/factory.go` - Factory base with workspace/user context
- `backend/internal/testutil/factory/user.go` - User entity factory
- `backend/internal/testutil/factory/workspace.go` - Workspace entity factory
- `backend/internal/testutil/factory/category.go` - Category entity factory
- `backend/internal/testutil/factory/borrower.go` - Borrower entity factory
- `backend/internal/testutil/factory/item.go` - Item entity factory with SKU, brand, category options
- `backend/internal/testutil/factory/location.go` - Location entity factory with parent, short code options
- `backend/internal/testutil/factory/container.go` - Container entity factory (requires locationID)
- `backend/internal/testutil/factory/inventory.go` - Inventory entity factory (requires itemID, locationID)
- `backend/internal/testutil/factory/factory_test.go` - 28 unit tests for all factories
- `backend/go.mod` - Added gofakeit/v7 dependency

## Decisions Made

1. **Functional options pattern** - Chose functional options (`WithItemName()`) over builder methods for Go idiom consistency and cleaner API
2. **Reconstruct for immutable updates** - Used domain `Reconstruct()` functions when entities lack setters (e.g., email in User)
3. **Required parameters vs options** - Container requires `locationID` as parameter, Inventory requires `itemID` and `locationID` as parameters rather than options, ensuring valid entity relationships
4. **Deterministic default IDs** - Default workspace/user IDs are fixed UUIDs for test reproducibility across runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Factory infrastructure ready for Phase 23 (Backend Coverage Push)
- Tests can now create entities with one call: `f.Item()`, `f.Location()`, `f.Inventory(itemID, locID)`
- Multi-tenant test isolation supported via `f.WithWorkspace(id)`

---
*Phase: 22-test-infrastructure-setup*
*Completed: 2026-01-31*
