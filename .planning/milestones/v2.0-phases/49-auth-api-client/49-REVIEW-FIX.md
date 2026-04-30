---
phase: 49-auth-api-client
fixed_at: 2026-04-11T00:00:00Z
review_path: .planning/phases/49-auth-api-client/49-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 49: Code Review Fix Report

**Fixed at:** 2026-04-11T00:00:00Z
**Source review:** .planning/phases/49-auth-api-client/49-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02; IN-* excluded per fix_scope=critical_warning)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Non-deterministic fetch call ordering in concurrent-401 test

**Files modified:** `frontend2/src/lib/__tests__/api.test.ts`
**Commit:** 0bd6663
**Applied fix:** Replaced the five positional `mockResolvedValueOnce` calls in the "concurrent 401s deduplicate refresh" test with a single `mockImplementation` that dispatches responses by URL and per-URL call count. This eliminates the reliance on microtask scheduling order when two concurrent requests race to the positional mock queue — each URL now deterministically receives a 401 on the first call and a 200 on the retry, regardless of execution order.

### WR-02: Missing assertion that refresh token is cleared after refresh failure

**Files modified:** `frontend2/src/lib/__tests__/api.test.ts`
**Commit:** 0bd6663
**Applied fix:** Added `expect(getRefreshToken()).toBeNull()` after the existing `rejects.toThrow("Session expired")` assertion in the "refresh failure" test. This explicitly verifies the invariant that a stale/expired refresh token is cleared from memory after a failed refresh, preventing repeated invalid refresh attempts on subsequent calls.

---

_Fixed: 2026-04-11T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
