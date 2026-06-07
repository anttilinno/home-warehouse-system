---
phase: quick-260607-vdf
plan: 01
subsystem: shortlink (s.go) — claim/scan prefill + resolver integration test
tags: [frontend, backend, integration-test, shortlink, prefill]
requires: [shortlink resolver (260607-uzt), claim wizard page (260607-uzt)]
provides:
  - Postgres integration test for ShortlinkRepository.Resolve
  - ?short_code= / ?barcode= prefill in item create wizard
  - ?create=1&short_code= auto-open + prefill in location/container create dialogs
affects: []
key-files:
  created:
    - backend/internal/infra/postgres/shortlink_repository_integration_test.go
  modified:
    - frontend/app/[locale]/(dashboard)/dashboard/items/new/page.tsx
    - frontend/components/items/create-item-wizard/index.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx
    - frontend/app/[locale]/(dashboard)/dashboard/claim/[code]/page.tsx
decisions:
  - "openCreateDialog refactored to take an optional shortCode arg (not a separate helper) — minimal diff, existing onClick sites wrapped as () => openCreateDialog() to avoid passing the React event as the code"
  - "[searchParams] dep array satisfies eslint exhaustive-deps directly — the planned eslint-disable directive was redundant and removed"
metrics:
  duration: ~25 min
  completed: 2026-06-07
---

# Quick Task 260607-vdf: Finish s.go shortlink wiring (claim-page prefill + resolver integration test) Summary

Wired the three create surfaces to consume the claim-page contract (item wizard reads `?short_code`/`?barcode`; location/container list pages auto-open + prefill their create dialog from `?create=1&short_code=`), and added a Postgres integration test that locks the resolver's item-first priority and cross-workspace `ANY($2)` scoping at the real-DB layer.

## What changed

### Part C — backend integration test (Task 1)
`backend/internal/infra/postgres/shortlink_repository_integration_test.go` (new). First two lines are `//go:build integration` / `// +build integration` so it is invisible to plain `go test ./...`. External `postgres_test` package, reuses `testdb.SetupTestDB` + `testdb.CreateTestWorkspace` (no parallel plumbing — same convention the prior planner's fork suggestion was rejected for). Direct-SQL seed helpers (`seedItem`/`seedLocation`/`seedContainer`; location seeded first for the container NOT-NULL FK). Six subtests: item match, container match, location match, item-first priority (shared code, `matches[0].Type==item`), cross-workspace scoping (code in wsB invisible to wsA-scoped query; visible when both scoped), and the empty/sentinel not-found case (`[]`,nil + `nil`,nil on empty workspace set).

### Part B — frontend prefill (Tasks 2 & 3)
- `create-item-wizard/index.tsx`: added optional `initialValues?: Partial<CreateItemFormData>` prop, merged as `defaultValues={{ ...createItemDefaults, ...initialValues }}`. No-arg call site preserved.
- `items/new/page.tsx`: reads `short_code` + `barcode` via `useSearchParams` (trimmed, verbatim, only included when non-empty), passes as `initialValues`.
- `locations/page.tsx` + `containers/page.tsx`: added `useSearchParams` + a `useRef` one-shot guard; an effect auto-opens the create dialog with `short_code` prefilled when `create === "1"`. `openCreateDialog` refactored to accept an optional `shortCode`; the two existing `onClick={openCreateDialog}` sites wrapped to `() => openCreateDialog()`. short_code passed verbatim (NOT through `extractScanCode`, per locked case-sensitive design).
- `claim/[code]/page.tsx`: URLs unchanged (already match consumers). Stale comment block rewritten to state the wiring is now live.

## Test results

- **Task 1:** New file verified type-correct under `-tags=integration` in isolation (siblings removed → `go vet -tags=integration` rc=0). `go build ./...` clean. Default-lane `go vet ./internal/infra/postgres/...` (no tag) rc=0 — integration file invisible. Live-Postgres 6-subtest run is the documented human-check (blocked package-wide; see Deferred).
- **Tasks 2 & 3:** `bunx tsc --noEmit` rc=0 (clean). `bunx eslint` on changed files added **zero** new errors (6 pre-existing errors identical to HEAD, confirmed via stash). `bunx vitest run` on the touched API test files (locations + containers) 21/21 pass.
- All verify greps pass: claim page emits `create=1&short_code=` and `items/new?short_code=`; all three consuming pages read `useSearchParams`; wizard has `initialValues`.

## Field-name deviations found during investigation

Investigated the real components before editing. Findings vs. the plan's `<interfaces>`:

- **Locations `openCreateDialog` also clears `formDescription`** (plan listed only name/parentId/shortCode/editing). Preserved that reset; just threaded the optional `shortCode`.
- **Containers `openCreateDialog` also clears `formDescription`, `formLocationId`, `formCapacity`** (more state than the plan's `<interfaces>` summary listed). All preserved; only `setFormShortCode("")` → `setFormShortCode(shortCode)`.
- **`openCreateDialog` is used directly as an `onClick` handler** in both pages (2 sites each). The plan did not mention this. Making it accept a param meant the click event would be passed as `shortCode`; wrapped the JSX call sites as `() => openCreateDialog()` to keep behaviour identical. (Rule 1 — would otherwise store a MouseEvent in the short_code field.)
- **No `next/navigation` import existed** in either list page — added `useSearchParams` import + `useRef` to the existing react import.
- **`frontend/` vs `frontend2/`:** the plan and all targets live under `frontend/` (Next.js `[locale]` app dir). The repo also has `frontend2/` (Vite SPA) referenced in CLAUDE.md/STATE history, but it is not the target here — all five files exist and were edited under `frontend/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `onClick={openCreateDialog}` would pass the React event as `shortCode`**
- Found during: Task 3
- Issue: refactoring `openCreateDialog` to `(shortCode = "")` meant the four direct `onClick={openCreateDialog}` sites (2 locations + 2 containers) would store the MouseEvent in the short_code field.
- Fix: wrapped each as `onClick={() => openCreateDialog()}`.
- Files: locations/page.tsx, containers/page.tsx
- Commit: 0f88236

**2. [Rule 3 - Blocking] Removed redundant eslint-disable directive**
- Found during: Task 3
- Issue: the plan suggested guarding the effect with `// eslint-disable-next-line react-hooks/exhaustive-deps`, but the `[searchParams]` dep array satisfies the rule directly; the directive was flagged as an "Unused eslint-disable directive" error.
- Fix: removed the two redundant directives; lint clean for the new code.
- Commit: 0f88236

## Deferred Issues (out of scope — see deferred-items.md)

- **Pre-existing: postgres integration test lane does not compile.** `borrower/category/company/container/label/location_repository_test.go` (all `//go:build integration`) call drifted `repo.Delete(ctx, id)` instead of the current `Delete(ctx, wsID, id)`. This blocks the package-wide `go vet -tags=integration` and therefore the live-Postgres 6-subtest human-check for the new shortlink test (the test itself is sound — verified in isolation). Recommend a stabilization task to update the drifted call sites.
- **Pre-existing: 6 frontend lint errors** (`no-explicit-any`, `no-unescaped-entities`) in containers/locations pages, identical on HEAD, unrelated to the prefill wiring.

## Commits

- `1dee019` test(quick-260607-vdf): add Postgres integration test for ShortlinkRepository.Resolve
- `c7a9874` feat(quick-260607-vdf): prefill item create wizard from ?short_code= and ?barcode=
- `0f88236` feat(quick-260607-vdf): auto-open + prefill location/container create dialogs from ?create=1&short_code=

## Self-Check: PASSED

- backend/internal/infra/postgres/shortlink_repository_integration_test.go — FOUND
- commits 1dee019, c7a9874, 0f88236 — FOUND in git log
