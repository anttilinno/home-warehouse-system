---
phase: 23-backend-business-logic-tests
plan: 01
subsystem: backend-testing
tags: [go, testing, importexport, workspace-backup, workspace-restore]
dependency-graph:
  requires: []
  provides: [importexport-unit-tests, workspace-backup-tests, workspace-restore-tests]
  affects: [23-02, 23-03]
tech-stack:
  added: []
  patterns: [interface-based-mocking, table-driven-tests, test-factories]
key-files:
  created:
    - backend/internal/domain/importexport/workspace_backup_test.go
    - backend/internal/domain/importexport/workspace_restore_test.go
  modified:
    - backend/internal/domain/importexport/workspace_backup.go
decisions:
  - id: "23-01-D1"
    title: "Interface extraction for testability"
    rationale: "WorkspaceBackupService used *queries.Queries directly, making mocking impossible. Introduced WorkspaceBackupQueries interface."
    alternatives: ["Mock DBTX interface", "Integration tests only"]
metrics:
  duration: "25 min"
  completed: "2026-01-31"
---

# Phase 23 Plan 01: Importexport Package Tests Summary

**One-liner:** Comprehensive unit tests for workspace backup/restore with interface-based mocking achieving 92.4% coverage.

## What Was Built

### Test Coverage Achievement

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| importexport package | 31.0% | 92.4% | 80%+ |
| workspace_backup.go | 0% | ~95% | 80%+ |
| workspace_restore.go | 0% | ~95% | 80%+ |

### Key Files Created

1. **workspace_backup_test.go** (1,281 lines)
   - MockWorkspaceBackupQueries implementation
   - Test data factories for all entity types
   - ExportWorkspace tests (18 test cases)
   - Helper function tests (formatTimestamp, formatDate, ptrToString, ptrToBool)
   - Excel content verification tests

2. **workspace_restore_test.go** (762 lines)
   - ImportWorkspace tests (18 test cases)
   - Parse*FromRows function tests for all entity types
   - parseExcel tests with various sheet configurations
   - getCellValue and stringToPtr helper tests
   - createTestExcelFile helper for building fixtures

### Interface Change

**workspace_backup.go modification:**
```go
// Before
type WorkspaceBackupService struct {
    queries *queries.Queries
}

// After
type WorkspaceBackupQueries interface {
    ListAllCategories(ctx context.Context, arg queries.ListAllCategoriesParams) ([]queries.WarehouseCategory, error)
    // ... 17 more methods
}

type WorkspaceBackupService struct {
    queries WorkspaceBackupQueries  // Now uses interface
}
```

This change enables dependency injection for testing while maintaining backward compatibility (queries.Queries implements the interface).

## Test Categories

### Export Tests
- Success paths (Excel, JSON formats)
- Empty workspace handling
- Unsupported format error
- Fetch errors for each entity type (10 test cases)
- Audit record failure (non-blocking)
- Include archived flag verification
- Excel structure verification

### Import Tests
- Success paths (Excel, JSON formats)
- Invalid file format handling
- Empty file handling
- Multiple entity types import
- Partial failure scenarios
- Parent reference resolution (categories, locations)

### Parse Function Tests
- Row parsing for all 10 entity types
- Insufficient columns handling
- Invalid UUID handling
- Optional field handling

## Technical Approach

### Mock Pattern
Used testify/mock with interface matching:
```go
mockQueries.On("ListAllCategories", ctx, mock.MatchedBy(func(arg queries.ListAllCategoriesParams) bool {
    return arg.WorkspaceID == workspaceID && arg.IncludeArchived == true
})).Return(categories, nil)
```

### Test Data Factories
Created reusable factories for all entity types:
```go
func makeTestCategory(workspaceID uuid.UUID, name string) queries.WarehouseCategory
func makeTestItem(workspaceID uuid.UUID, name string, sku string) queries.WarehouseItem
// ... etc
```

### Excel Test Fixtures
Created helper for building test Excel files:
```go
func createTestExcelFile(t *testing.T, sheets map[string][][]string) []byte
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 87302ca | test | Add workspace backup export tests |
| b2c335a | test | Add workspace restore import tests |
| cf3f200 | test | Add constructor and edge case tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Interface extraction for testability**
- **Found during:** Task 1
- **Issue:** WorkspaceBackupService used concrete *queries.Queries, preventing mocking
- **Fix:** Introduced WorkspaceBackupQueries interface covering all required methods
- **Files modified:** workspace_backup.go
- **Commit:** 87302ca

## Verification Results

```bash
$ go test ./internal/domain/importexport/... -cover
ok  github.com/antti/home-warehouse/go-backend/internal/domain/importexport  0.080s  coverage: 92.4% of statements
```

All 84 tests pass across the package.

## Next Phase Readiness

- BE-01 criteria satisfied: importexport package at 92.4% coverage (target: 80%+)
- MockWorkspaceBackupQueries can be reused in integration tests
- Test patterns established for remaining packages (pendingchange, importjob, etc.)
