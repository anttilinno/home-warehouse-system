---
phase: 26-e2e-stability-and-coverage
plan: 01
subsystem: frontend-e2e
tags: [playwright, auth, e2e, testing, stability]
dependency_graph:
  requires: []
  provides:
    - reliable-auth-setup
    - e2e-auth-state
  affects:
    - all-authenticated-e2e-tests
tech_stack:
  added: []
  patterns:
    - Promise.race for multiple wait conditions
    - waitForResponse for API call monitoring
    - retry-with-backoff for flaky operations
key_files:
  created: []
  modified:
    - frontend/e2e/auth.setup.ts
decisions:
  - id: E2E-AUTH-01
    title: Use waitForURL instead of waitForTimeout for navigation
    rationale: Event-driven waits are more reliable than arbitrary timeouts
  - id: E2E-AUTH-02
    title: Monitor API responses before waiting for navigation
    rationale: Confirms form submission worked before expecting redirect
  - id: E2E-AUTH-03
    title: Add retry logic for login form submission
    rationale: Handles React hydration timing issues on fast page loads
metrics:
  duration: 37m
  completed: 2026-01-31
---

# Phase 26 Plan 01: Fix Auth Setup Timing Issues Summary

Reliable authentication setup using proper wait conditions instead of arbitrary timeouts.

## One-Liner

Auth setup uses waitForURL and API response monitoring with 3-attempt retry for hydration resilience.

## What Was Built

### Authentication Setup Improvements

1. **Replaced waitForTimeout with event-driven waits**
   - Removed `waitForTimeout(2000)` that caused flaky tests
   - Use `waitForURL(/\/dashboard/)` for navigation detection
   - Use `Promise.race` to handle multiple outcomes (success, error, redirect)

2. **API Response Monitoring**
   - Added `waitForResponse` to monitor `/auth/login` API calls
   - Logs response status for debugging (200, 429, etc.)
   - Confirms form submission before waiting for navigation

3. **Retry Logic for Hydration Issues**
   - 3-attempt retry loop for login form submission
   - Handles cases where React event handlers aren't attached yet
   - Uses `networkidle` wait between attempts

4. **Auth State Verification**
   - Verifies dashboard URL before saving state
   - Waits for sidebar nav to be visible (confirms authenticated content)
   - Takes screenshot on failure for debugging

### Error Handling

- 30-second total timeout for auth setup
- Try/catch wrapper with screenshot on failure
- Descriptive error messages including current URL
- Logged progress for CI debugging

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Wait strategy | `waitForURL` + `waitForResponse` | Event-driven is more reliable than timeouts |
| Form submission | Click + API monitor | Confirms form actually submitted |
| Hydration handling | 3-attempt retry | React hydration timing varies |
| Auth verification | URL + sidebar nav | Ensures authenticated state before save |

## Files Changed

| File | Change |
|------|--------|
| `frontend/e2e/auth.setup.ts` | Complete rewrite with proper wait conditions |

## Deviations from Plan

### Discovered Issue: Rate Limiting

**Found during:** Task 3 stability testing

**Issue:** Backend has rate limiting (5 requests/minute) on auth endpoints. Running auth setup rapidly (>5/min) returns 429 Too Many Requests.

**Resolution:** Documented as expected behavior. In normal E2E runs, auth setup runs once and state is reused for all tests.

### Discovered Issue: React Hydration

**Found during:** Task 1 implementation

**Issue:** Form button clicks sometimes don't trigger submission due to React hydration timing - event handlers may not be attached when button is visually clickable.

**Resolution:** Added retry logic (3 attempts) with `networkidle` wait between attempts.

## Verification Results

```
1. waitForTimeout count: 0 (removed all arbitrary waits)
2. waitForURL count: 3 (proper navigation detection)
3. Auth verification: Dashboard URL + sidebar nav visible
4. Stability: 5/5 consecutive passes when rate limit respected
```

## What's Next

- Plan 26-02: Stabilize high-risk E2E tests
- Continue with remaining E2E coverage improvements

## Performance Notes

- Auth setup typically completes in ~13 seconds
- Retries add ~8 seconds per failed attempt
- Rate limiting adds variable delay if hit (up to 60 seconds)

## Commits

- `c058d73` fix(26-01): replace waitForTimeout with proper wait conditions
- `c072066` fix(26-01): add timeout safeguard and error handling
- `1a99c98` fix(26-01): verify auth stability and document rate limiting
