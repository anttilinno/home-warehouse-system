# Phase 61 — Deferred Items

## Found during 61-01 execution

### Pre-existing: `TestCleanupConfig_RetentionPeriodUsage` DST flakiness (not in scope)

**Observed:** `backend/internal/jobs/cleanup_test.go:216` asserts that `now.Sub(now.AddDate(0, 0, -N)).Hours() / 24 == N`. During DST transitions (UTC+3 → UTC+2 observed locally ~2026-04-16), this can compute 29 instead of 30 due to the 23-hour day, yielding:

```
Error: expected: 30, actual: 29
Error: expected: 90, actual: 89
```

**Assessment:** Not caused by this plan (no files touched in `internal/jobs/`). The test has a date-math bug (uses floating-point division on elapsed hours without handling DST); the fix is orthogonal. Suggested: use `cutoffDate.Sub(now) / (24 * time.Hour)` with integer truncation OR use `now.AddDate(0, 0, -N)` comparison by date-equal instead of hour math.

**Action:** Logged here — NOT fixed in 61-01 (out of scope). Can be picked up in tech-debt sweep.
