# Deferred Items — Phase 62 Loans

## Plan 62-01

### Pre-existing test failure (out of scope)

- `internal/jobs/cleanup_test.go::TestCleanupConfig_RetentionPeriodUsage/30_days` and `/90_days` fail with "expected: 30, actual: 29" and "expected: 90, actual: 89". This is unrelated to loan plan 62-01 (loan package tests all pass). The failure appears to be DST-boundary or calendar-arithmetic flakiness in the cleanup config — the code computes a negative duration from `time.Now()` using month arithmetic, which straddles spring DST 2026-03-29 on this run date (2026-04-17). Not introduced by this plan.
