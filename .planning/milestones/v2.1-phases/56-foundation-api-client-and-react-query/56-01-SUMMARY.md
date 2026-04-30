---
phase: 56
plan: 01
subsystem: frontend2/api-client
tags: [react-query, tanstack, multipart, formdata, provider-wiring]
completed: "2026-04-15"
duration_minutes: 8

dependency_graph:
  requires: []
  provides:
    - queryClient singleton (frontend2/src/lib/queryClient.ts)
    - QueryClientProvider wiring in App.tsx
    - postMultipart<T> helper in lib/api.ts
    - FormData-aware request() with no Content-Type for multipart bodies
  affects:
    - All future v2.1 CRUD hooks (consume queryClient via QueryClientProvider)
    - Phase 61 item photos (consume postMultipart)

tech_stack:
  added:
    - "@tanstack/react-query@5.99.0"
    - "@tanstack/react-query-devtools@5.99.0"
  patterns:
    - TanStack Query v5 QueryClient singleton (named export, module-level)
    - React.lazy + Suspense for dev-only Devtools (tree-shaken from prod)
    - FormData instanceof detection to suppress JSON Content-Type
    - TDD RED/GREEN cycle for postMultipart behavior

key_files:
  created:
    - frontend2/src/lib/queryClient.ts
    - frontend2/src/lib/__tests__/api.multipart.test.ts
  modified:
    - frontend2/package.json (added @tanstack/react-query + devtools ^5)
    - frontend2/bun.lock (lockfile updated)
    - frontend2/src/lib/api.ts (FormData detection + postMultipart export)
    - frontend2/src/App.tsx (QueryClientProvider + lazy Devtools)

decisions:
  - "QueryClient staleTime=30s, gcTime=5min, retry=1, refetchOnWindowFocus=false — balanced for inventory app with moderate server-state freshness needs"
  - "Devtools via React.lazy inside import.meta.env.DEV gate — Vite tree-shakes the entire devtools chunk from production bundle (verified: rg finds no react-query-devtools in dist/)"
  - "postMultipart delegates to request() rather than using fetch directly — 401/refresh retry inherited automatically, no duplicate logic"
  - "FormData detection via instanceof check in request() — single detection point handles all multipart callers uniformly"

metrics:
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 4
  tests_added: 4
  tests_passing: 13
---

# Phase 56 Plan 01: Foundation — API Client & React Query Summary

**One-liner:** TanStack Query v5 wired with QueryClientProvider + lazy Devtools, and postMultipart helper added to api.ts with FormData-aware Content-Type suppression.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install TanStack Query v5 | b486ef8 | package.json, bun.lock |
| 2 (RED) | Add failing multipart tests | dae5de0 | src/lib/__tests__/api.multipart.test.ts |
| 2 (GREEN) | postMultipart + FormData-aware request() | ae238b2 | src/lib/api.ts |
| 3 | QueryClient singleton + App.tsx wiring | 4d4c233 | src/lib/queryClient.ts, src/App.tsx |

## Decisions Made

1. **QueryClient defaults:** staleTime=30s, gcTime=5min, retry=1, refetchOnWindowFocus=false, mutations retry=0. Rationale: inventory data changes infrequently; 30s staleness avoids network thrash on re-focus while keeping data reasonably fresh.

2. **Devtools lazy-loaded under import.meta.env.DEV:** Vite statically replaces `import.meta.env.DEV` at build time. Combined with `React.lazy()`, the devtools chunk is never included in the production bundle. Verified: `rg "react-query-devtools" dist/` returns no matches after `bun run build`.

3. **postMultipart delegates to request():** No separate fetch call — the existing 401→refresh→retry single-flight path is inherited automatically. Tested explicitly in Test 4 (asserting exactly one refresh call between the 401 and the successful retry).

4. **FormData detection in request():** `options.body instanceof FormData` is the canonical way to detect multipart bodies. When true, `Content-Type` is omitted so the browser can set the `multipart/form-data; boundary=...` header with the correct boundary value (manually setting `Content-Type: multipart/form-data` without a boundary causes server-side parse failure).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing compiled Lingui locale files in worktree**
- **Found during:** Task 3 production build verification
- **Issue:** `bun run build` failed with TS2307 missing `locales/en/messages.ts` — compiled Lingui artifacts are not tracked in git (generated files), so the worktree didn't have them.
- **Fix:** Ran `bun run i18n:compile` to generate the locale `.ts` files. Build then succeeded cleanly.
- **Files modified:** frontend2/locales/en/messages.ts, frontend2/locales/et/messages.ts (generated, not committed)
- **Commit:** N/A — generated files, not committed

## TDD Gate Compliance

- RED gate commit: `dae5de0` — `test(56-01): add failing tests for postMultipart and FormData-aware request()`
- GREEN gate commit: `ae238b2` — `feat(56-01): add postMultipart helper and FormData-aware request() in api.ts`
- No REFACTOR gate needed (code was clean on first implementation)

## Known Stubs

None — this plan introduces infrastructure only (no UI components with data rendering).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The postMultipart helper routes through the existing request() function which already enforces JWT cookie + 401/refresh gate.

## Verification Results

- `bun run test -- --run src/lib/__tests__/api.multipart.test.ts`: 4/4 passing
- `bun run test -- --run src/lib/__tests__/api.test.ts`: 9/9 passing (no regression)
- `bunx tsc --noEmit`: clean (0 errors)
- `bun run build`: succeeds after i18n:compile
- `rg "react-query-devtools" dist/`: no matches (Devtools tree-shaken)
- Provider nesting verified: I18nProvider > BrowserRouter > QueryClientProvider > AuthProvider > ToastProvider

## Self-Check: PASSED

- `frontend2/src/lib/queryClient.ts`: FOUND
- `frontend2/src/lib/__tests__/api.multipart.test.ts`: FOUND
- `frontend2/src/lib/api.ts` exports `postMultipart`: FOUND (line 119)
- `frontend2/src/App.tsx` contains `QueryClientProvider client={queryClient}`: FOUND
- Commits b486ef8, dae5de0, ae238b2, 4d4c233: all present in git log
