# Phase 65 Deferred Items

## From Plan 65-09 (Gap closure G-65-01)

### PRE-EXISTING test failure in internal/jobs — NOT introduced by 65-09

- **Package:** `github.com/antti/home-warehouse/go-backend/internal/jobs`
- **Test:** `TestCleanupConfig_RetentionPeriodUsage` (subtests `30 days` and `90 days`)
- **File:** `backend/internal/jobs/cleanup_test.go:216`
- **Status:** Confirmed pre-existing — reproduces on clean baseline (`git stash` before any 65-09 changes).
- **Scope:** Out of scope for 65-09 (unrelated to item barcode lookup). Logged here for a future stabilization plan.
