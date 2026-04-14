---
phase: 54-tech-debt-code-fixes
plan: "01"
subsystem: frontend2/nav+auth+settings
tags: [nav, sidebar, auth, http-error, data-page, tech-debt]
dependency_graph:
  requires: []
  provides: [HttpError class in api.ts, 4-link Sidebar, hardened AuthContext, null-guarded DataPage buttons]
  affects: [frontend2/src/lib/api.ts, frontend2/src/features/auth/AuthContext.tsx, frontend2/src/components/layout/Sidebar.tsx, frontend2/src/features/settings/DataPage.tsx]
tech_stack:
  added: []
  patterns: [HttpError class with status field, importOriginal in vi.mock for partial mocking]
key_files:
  created: []
  modified:
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/components/layout/__tests__/Sidebar.test.tsx
    - frontend2/src/lib/api.ts
    - frontend2/src/features/auth/AuthContext.tsx
    - frontend2/src/features/auth/__tests__/AuthContext.test.tsx
    - frontend2/src/features/settings/DataPage.tsx
decisions:
  - "HttpError replaces plain Error in parseError so callers can distinguish HTTP status codes from network failures"
  - "AuthContext catch block guards on HttpError 401/403 only — transient network errors and 5xx no longer clear the session"
  - "AuthContext test mock updated to importOriginal so the HttpError class is available for instanceof checks"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-14T17:10:53Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 6
---

# Phase 54 Plan 01: Nav + Auth Hardening Summary

**One-liner:** Added ITEMS/LOANS sidebar nav links, introduced HttpError class with status field replacing plain Error, hardened AuthContext to only invalidate sessions on 401/403, and null-guarded DataPage export/import buttons against missing workspaceId.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ITEMS and LOANS NavLinks to Sidebar + update tests | 92e7b20 | Sidebar.tsx, Sidebar.test.tsx |
| 2 | Add HttpError class to api.ts and harden AuthContext catch block | 656172f | api.ts, AuthContext.tsx, AuthContext.test.tsx |
| 3 | DataPage workspaceId null-guard on export and import buttons | e5c5b05 | DataPage.tsx |

## Success Criteria Verified

- SC-1: Sidebar renders 4 NavLinks (DASHBOARD, ITEMS, LOANS, SETTINGS) with correct routes; 9 tests cover all 4 including active-state assertions
- SC-2: api.ts exports HttpError; AuthContext catch block clears token only on 401/403
- SC-3: DataPage EXPORT disabled when `exporting || !workspaceId`; IMPORT disabled when `importing || !workspaceId`
- TypeScript build clean (tsc + vite build exit 0)
- All 152 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AuthContext test mock missing HttpError export**
- **Found during:** Task 2 verification (test run)
- **Issue:** The existing `vi.mock("@/lib/api", () => ({ ... }))` used a manual factory that did not include `HttpError`. When AuthContext imported `HttpError` from `@/lib/api`, vitest threw "No HttpError export is defined on the mock". Additionally, the test "handles /users/me failure gracefully" threw a plain `Error("Unauthorized")` which no longer triggers `setRefreshToken(null)` under the new HttpError 401/403 guard logic.
- **Fix:** Updated `vi.mock` to use `importOriginal` pattern (`vi.mock(import("@/lib/api"), async (importOriginal) => { const actual = await importOriginal(); return { ...actual, get: vi.fn(), ... } })`) so the real HttpError class is available. Updated the failing test to throw `new HttpError(401, "Unauthorized")` matching the new catch-block semantics.
- **Files modified:** `frontend2/src/features/auth/__tests__/AuthContext.test.tsx`
- **Commit:** 656172f

## Known Stubs

None — all data sources are wired; no placeholder values introduced.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `frontend2/src/lib/api.ts` — FOUND
- `frontend2/src/features/auth/AuthContext.tsx` — FOUND
- `frontend2/src/components/layout/Sidebar.tsx` — FOUND
- `frontend2/src/features/settings/DataPage.tsx` — FOUND
- commit 92e7b20 — FOUND
- commit 656172f — FOUND
- commit e5c5b05 — FOUND
