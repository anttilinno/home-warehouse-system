---
phase: 52-dashboard
fixed_at: 2026-04-11T13:19:30Z
review_path: .planning/phases/52-dashboard/52-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 52: Code Review Fix Report

**Fixed at:** 2026-04-11T13:19:30Z
**Source review:** .planning/phases/52-dashboard/52-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 2
- Skipped: 1

## Fixed Issues

### WR-02: `RecentActivity.entity_name` typed as `string | undefined` but `null` is used at runtime

**Files modified:** `frontend2/src/lib/types.ts`
**Commit:** f268dfd
**Applied fix:** Changed `entity_name?: string` to `entity_name?: string | null` in the `RecentActivity` interface. This aligns the TypeScript type with the runtime behaviour (backend returns JSON null) and fixes the test fixture type error (IN-03) as a side effect. Full `npx tsc --noEmit` confirmed zero type errors after the change.

### WR-03: Transient network error in `loadUser` clears refresh token, causing spurious logout

**Files modified:** `frontend2/src/features/auth/AuthContext.tsx`
**Commit:** 1200761
**Applied fix:** Changed `catch {}` to `catch (err) {}` and wrapped `setRefreshToken(null)` in `if (!(err instanceof TypeError))`. The API client (`@/lib/api`) throws a plain `Error` for HTTP-level failures (401, 403, etc.) and `fetch` itself throws `TypeError` for network-level failures (ECONNREFUSED, DNS timeout, etc.). This means auth failures still clear the token while transient network errors do not. All 13 existing `AuthContext` tests continue to pass — the test fixture uses `new Error("Unauthorized")` (not `TypeError`), so the token-clearing path is still exercised by the test. Fix classification: **requires human verification** (logic change — confirm `TypeError` is the correct discriminator for your deployment's network error shape).

## Skipped Issues

### WR-01: SSE URL uses `/api/` prefix — inconsistent with REST calls

**File:** `frontend2/src/features/dashboard/ActivityFeed.tsx:46`
**Reason:** skipped — code context differs from review; finding is a false positive.
**Original issue:** Reviewer observed that REST calls use no `/api/` prefix while SSE URL hardcodes `/api/`. However, after reading `frontend2/src/lib/api.ts`, the API client declares `const BASE_URL = "/api"` and prepends it to every REST endpoint: `get('/workspaces/...')` expands to `fetch('/api/workspaces/...')`. Vite proxy maps `/api/*` → backend with prefix stripped for both REST and SSE. The SSE URL `/api/workspaces/${workspaceId}/sse` is fully consistent with how REST calls are routed. No fix needed.

---

_Fixed: 2026-04-11T13:19:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
