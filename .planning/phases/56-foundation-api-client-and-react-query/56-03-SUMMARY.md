---
phase: 56
plan: 03
subsystem: frontend2/api-demo-page
tags: [react-query, tanstack, lingui, public-route, smoke-test]
completed: "2026-04-15"
duration_minutes: 12

dependency_graph:
  requires:
    - queryClient singleton (56-01 provides)
    - itemsApi + itemKeys (56-02 provides)
    - useAuth hook + AuthContext (v2.0 provides)
  provides:
    - frontend2/src/pages/ApiDemoPage.tsx (smoke-test page — 5 visual states)
    - /api-demo public route registered in routes/index.tsx
    - 8 new Lingui msgids in EN catalog + full ET translations
  affects:
    - Human verification of full React Query stack (loading/success/error/empty/anonymous)
    - SC-4 satisfaction — smoke-test route proves server-state substrate end-to-end

tech_stack:
  added: []
  patterns:
    - useQuery with enabled: !!workspaceId guard (Pitfall 3 from RESEARCH.md)
    - 5-state UI pattern — authLoading early return, anonymous, isPending, isError, isSuccess
    - useLingui().t macro for all visible strings (consistent with routes/index.tsx)
    - Public route placement in "no shell" block (sibling to /demo, outside RequireAuth)

key_files:
  created:
    - frontend2/src/pages/ApiDemoPage.tsx
  modified:
    - frontend2/src/routes/index.tsx (import + Route added)
    - frontend2/locales/en/messages.po (8 new msgids extracted)
    - frontend2/locales/et/messages.po (8 Estonian translations populated)

decisions:
  - "authLoading early return renders null — avoids flashing anonymous panel before auth check resolves"
  - "enabled: !!workspaceId — query never fires when user is anonymous; backend 401 is not consumed unnecessarily"
  - "HazardStripe placed as child inside error RetroPanel — RetroPanel showHazardStripe prop places stripe before title, but error panel has no title; explicit child gives control over order relative to error text"
  - "Route placed in public block without AppShell — /api-demo is a dev/smoke-test page, same posture as /demo"

metrics:
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 3
  tests_added: 0
  tests_passing: 191
---

# Phase 56 Plan 03: API Demo Page Summary

**One-liner:** Public `/api-demo` route created with 5 visual states (anonymous, loading, error+retry, empty, success) exercising the full React Query stack — itemsApi.list through QueryClientProvider — with Lingui EN+ET catalog entries.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ApiDemoPage with 5 visual states | cbf8ee0 | src/pages/ApiDemoPage.tsx |
| 2 | Register /api-demo route + Lingui catalogs | 56a497e | src/routes/index.tsx, locales/en/messages.po, locales/et/messages.po |

## Task 3: Awaiting Human Verification

Task 3 is a `checkpoint:human-verify`. The automation stopped here per plan. The following 9 steps require manual verification:

1. Start backend (`make dev-backend`)
2. Start frontend (`cd frontend2 && bun run dev`)
3. Visit `/api-demo` anonymously — expect "Sign in to run the real API fetch…" panel
4. Sign in and visit `/api-demo` — expect loading then data or empty state
5. Set network offline, click "Retry fetch" — expect error panel with retro-red border
6. Re-enable network, click "Retry fetch" — expect loading then success
7. Open React Query Devtools — expect `["items","list",{page:1,limit:10}]` query in cache
8. Switch language to Estonian — expect all copy in Estonian
9. Production build check: `bun run build && rg -l "react-query-devtools" dist/` — expect no matches

## Decisions Made

1. **`enabled: !!workspaceId` prevents anonymous API calls:** When the user is not signed in, `workspaceId` is null. Without `enabled: false`, React Query would fire the query and hit a 401. The guard short-circuits the query and renders the anonymous explanatory panel instead.

2. **`authLoading` early return (returns `null`):** Without this guard, the anonymous panel flashes briefly for all authenticated users while `AuthContext` resolves the user. Returning null during auth loading gives a clean transition to the appropriate state.

3. **`HazardStripe` as explicit child in error `RetroPanel`:** The `showHazardStripe` prop on `RetroPanel` places the stripe above the title. The error panel has no title, so using the prop would place the stripe directly above the error text. Using `<HazardStripe className="mb-md" />` as a child gives explicit spacing control and matches the pattern in `DemoPage.tsx`.

4. **Route in public "no shell" block:** `/api-demo` is a developer smoke-test page. No `AppShell` wrapper means no sidebar navigation, same as `/demo`. The anonymous state is correctly handled inside the page itself, not by `RequireAuth`.

## Deviations from Plan

None — plan executed exactly as written. All component prop names (`showHazardStripe`, `variant="primary"`, `className`) were verified against the actual `RetroPanel`, `RetroButton`, and `HazardStripe` implementations before use.

## Known Stubs

None — `ApiDemoPage` makes a real API call via `itemsApi.list`. All 5 visual states are live (no hardcoded mock data).

## Threat Flags

None — no new network endpoints. The `/api-demo` route follows the same public-route posture as `/demo`. Threat register items T-56-08 (public exposure), T-56-09 (retry loop — mitigated by QueryClient retry:1), T-56-10 (XSS — React escapes string children) are all addressed.

## Verification Results (automated)

- `bunx tsc --noEmit`: PASSED (0 errors after each task)
- `bun run test -- --run`: 191/191 passing (no regressions)
- `bun run build`: succeeds (128 modules, no errors)
- `rg -l "react-query-devtools" dist/`: no matches (Devtools tree-shaken from prod)
- `grep -q '"/api-demo"' src/routes/index.tsx`: MATCH
- `grep -q "ApiDemoPage" src/routes/index.tsx`: MATCH
- `grep -q "API Demo" locales/en/messages.po`: MATCH
- `grep -q "Laadin andmeid" locales/et/messages.po`: MATCH

## Self-Check: PASSED

- `frontend2/src/pages/ApiDemoPage.tsx`: FOUND (91 lines, useQuery, itemKeys.list, 5 states)
- `frontend2/src/routes/index.tsx` contains `/api-demo`: FOUND
- `frontend2/locales/en/messages.po` contains `API Demo`: FOUND
- `frontend2/locales/et/messages.po` contains `Laadin andmeid API-st…`: FOUND
- Commits cbf8ee0 and 56a497e: both present in git log
