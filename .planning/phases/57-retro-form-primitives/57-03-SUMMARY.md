---
phase: 57
plan: 03
subsystem: frontend-retro-forms
tags: [frontend, forms, retro, ui-primitives, demo, i18n]
requires:
  - 57-01 (RetroTextarea, RetroCheckbox, RetroFileInput)
  - 57-02 (RetroSelect, RetroCombobox, RetroFormField)
  - Phase 56 @tanstack/react-query + categoriesApi
provides:
  - RetroPagination — stateless controlled paginator (1..7 pages, ellipsis window, mono counter)
  - RetroConfirmDialog — RetroDialog wrapper with destructive/soft variants and async pending state
  - RetroEmptyState — centered empty-state panel with optional hazard-stripe and action slot
  - /demo page showcase covering all 9 phase-57 primitives with RHF+zod form substrate
  - Lingui EN catalog populated; ET catalog compiles with `[ET] …` placeholders for phase-57 strings
affects:
  - frontend2/src/components/retro/RetroDialog.tsx (new optional hideHazardStripe prop — backwards compatible)
  - frontend2/src/components/retro/index.ts (+3 primitives + types)
  - frontend2/src/pages/DemoPage.tsx (focal form showcase + 3 new sections above existing demo)
  - frontend2/locales/en/messages.po (184 messages; 37+ new phase-57 msgids)
  - frontend2/locales/et/messages.po (phase-57 messages stubbed with `[ET]` prefix)
tech-stack:
  added: []
  patterns:
    - forwardRef + displayName on every primitive
    - RetroDialog extended (not duplicated) per planner Discretion A2 — hideHazardStripe prop
    - useLingui t macro with interpolation (`Page ${page} of ${totalPages}`)
    - async onConfirm handler with try/finally pending reset (mitigates T-57-03-02 DoS)
key-files:
  created:
    - frontend2/src/components/retro/RetroPagination.tsx
    - frontend2/src/components/retro/RetroConfirmDialog.tsx
    - frontend2/src/components/retro/RetroEmptyState.tsx
    - frontend2/src/components/retro/__tests__/RetroPagination.test.tsx
    - frontend2/src/components/retro/__tests__/RetroConfirmDialog.test.tsx
    - frontend2/src/components/retro/__tests__/RetroEmptyState.test.tsx
  modified:
    - frontend2/src/components/retro/RetroDialog.tsx
    - frontend2/src/components/retro/index.ts
    - frontend2/src/pages/DemoPage.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
decisions:
  - Added hideHazardStripe?: boolean to RetroDialog (default false) — preserves backwards compat for RetroDialog.test and all existing callers
  - Dropped `toast({ kind, title })` from plan pseudocode in favor of existing addToast(message, variant) API on ToastProvider (no-op for planner signature drift)
  - RetroCombobox queryKey composed from categoryKeys.list({}) + search suffix — the existing categoryKeys factory, not a phantom `queryKeys.categories.search` barrel
  - Test for RetroPagination mono counter queries `.font-mono` nodes and filters by "Page" text because ← PREV / NEXT → buttons also use font-mono
  - ET catalog phase-57 msgids stubbed with `[ET] <source>` so ET catalog compiles and renders with visible translation placeholders; remaining 123 pre-existing missing ET translations are out of scope
  - Task 3 (human-verify checkpoint) cannot be executed by a parallel worktree executor — implementation complete, checkpoint awaits orchestrator/user sign-off
metrics:
  duration: ~8 min
  completed: 2026-04-15
  tasks_completed: 2
  tasks_pending_human: 1
  files_created: 6
  files_modified: 5
---

# Phase 57 Plan 03: Structural Primitives + Demo Integration + i18n Summary

Shipped the three structural primitives (RetroPagination, RetroConfirmDialog, RetroEmptyState), extended `/demo` with the full 9-primitive focal showcase using RHF+zod via RetroFormField, and populated both Lingui catalogs. 19 test files / 118 retro tests green; full suite 38 files / 237 tests green.

## Tasks Completed

| Task | Name                                                           | Commit  |
| ---- | -------------------------------------------------------------- | ------- |
| 1    | RED tests + RetroPagination + RetroConfirmDialog + RetroEmptyState + barrel | 5d1cdaf + 4702b1c |
| 2    | Wire /demo page + Lingui catalogs                              | 3977426 |
| 3    | Human-verify checkpoint                                        | pending |

## Key Changes

- **RetroPagination**: stateless; `Math.ceil(totalCount / pageSize)`; returns null when `totalCount <= pageSize`; 1..7 window logic with `…` ellipses; buttons `min-h-[44px] md:min-h-[36px]`; active page `bg-retro-amber`; trailing `Page N of M` in `font-mono`.
- **RetroConfirmDialog**: `forwardRef<RetroConfirmDialogHandle>` wraps RetroDialog via `useRef`; `useImperativeHandle` proxies open/close; async onConfirm flips `pending` via try/finally (mitigates T-57-03-02); destructive variant uses danger button + hazard stripe, soft uses primary (amber) with `hideHazardStripe=true`.
- **RetroEmptyState**: presentational; optional HazardStripe, title, default body string (Lingui t macro), optional action slot.
- **RetroDialog**: new optional `hideHazardStripe?: boolean` prop — existing 7-test suite still green.
- **/demo focal section**: RHF `useForm` + `zodResolver` + zod schema binding all 6 RetroFormField rows (RetroInput, RetroTextarea, RetroSelect, RetroCombobox, RetroCheckbox, RetroFileInput) with `SAVE CHANGES` amber primary CTA. Three additional sections for RetroPagination, RetroConfirmDialog (both variants + toast), RetroEmptyState.
- **Lingui**: `bun run i18n:extract` → 184 EN msgids, 0 warnings. `bun run i18n:compile` → success. ET catalog phase-57 msgids populated with `[ET] <source>` placeholders.
- **Barrel**: `@/components/retro` now re-exports `RetroPagination`, `RetroConfirmDialog`, `RetroConfirmDialogHandle`, `RetroEmptyState` plus their Props types.

## Verification

- `cd frontend2 && bun run test --run` → 38 files, 237 tests passed
- `cd frontend2 && bun run test --run src/components/retro/__tests__/` → 19 files, 118 tests passed (12 new: 4 Pagination + 5 ConfirmDialog + 3 EmptyState)
- `cd frontend2 && bun run lint` — phase-57 files clean (8 pre-existing errors in ActivityFeed/AppShell/useRouteLoading/AuthCallbackPage/AuthContext/api.ts/i18n.ts/RequireAuth.test/RetroToast.test already logged in `deferred-items.md`)
- `cd frontend2 && bun run i18n:compile` → 0 warnings
- `cd frontend2 && bun run build` — TS error in `src/pages/ApiDemoPage.tsx:47` pre-existing from Phase 56 (commit dc23d36); not introduced by this plan
- Barrel export count: `grep -E "^export (\\{|type)" frontend2/src/components/retro/index.ts | wc -l` → 26 lines (above the ≥20 threshold)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Adjustment] RetroPagination mono counter query collided with PREV/NEXT buttons**
- **Found during:** Task 1 GREEN run.
- **Issue:** `container.querySelector(".font-mono")` returned `← PREV` button (which also uses `font-mono`), so the `Page 2 of 6` assertion failed.
- **Fix:** Changed the test to `querySelectorAll(".font-mono")` + `Array.find` on textContent matching `/Page/i`, then assert both the text and the `font-mono` className.
- **Files modified:** `frontend2/src/components/retro/__tests__/RetroPagination.test.tsx`
- **Commit:** 4702b1c

**2. [Rule 3 - Blocking] Worktree missing node_modules**
- **Found during:** Task 1 RED verification.
- **Fix:** Ran `bun install` in the worktree (371 packages installed).
- **Commit:** N/A (install is not a code change; `bun.lock` unchanged; added to test commit).

**3. [Rule 1 - API mismatch] Plan pseudocode referenced `toast({ kind, title })` but existing ToastProvider exports `addToast(message, variant)`**
- **Found during:** Task 2 implementation.
- **Fix:** Used `addToast(t\`Deleted.\`, "success")` — matches the API shipped in Phase 32 RetroToast.
- **Commit:** 3977426

**4. [Rule 1 - API mismatch] Plan referenced phantom `queryKeys.categories.search` + `categoriesApi.list({ signal })`**
- **Found during:** Task 2 implementation.
- **Issue:** `categoriesApi.list` signature is `(wsId, params)` — no `signal` param and no cursor/search. `queryKeys.*` barrel does not exist; `categoryKeys` is exported from `@/lib/api/categories`.
- **Fix:** Used `const { workspaceId } = useAuth();` with `useQuery({ queryKey: [...categoryKeys.list({}), { search: locationQuery, ws: workspaceId }], queryFn: () => categoriesApi.list(workspaceId!), enabled: Boolean(workspaceId) && locationQuery.length > 0 })` and filtered client-side by `c.name.includes(locationQuery)`. Still demonstrates real async API usage per RESEARCH open-question #2.
- **Commit:** 3977426

**5. [Rule 1 - Lint] Unused `eslint-disable no-console` directive**
- **Found during:** Task 2 lint run.
- **Fix:** Removed the directive; wrapped `console.log` in a block form submit handler so the lint rule does not fire.
- **Commit:** 3977426 (applied before commit)

## Pending Human Verification (Task 3)

This is a `checkpoint:human-verify` task that cannot be executed by a parallel-worktree executor. Implementation is complete per the plan's acceptance criteria; orchestrator or user must perform the manual `/demo` walkthrough documented in 57-03-PLAN.md tasks.3.how-to-verify:

1. Focal hierarchy / above-the-fold — RETRO FORM PRIMITIVES form
2. RetroCombobox keyboard nav + 250ms debounced async fetch
3. RetroFileInput drag-and-drop + value-reset pitfall
4. RetroConfirmDialog focus trap + Esc = cancel + WORKING… pending swap
5. Soft variant — no hazard stripe, amber (not red) confirm button
6. RetroPagination boundary disabled states + current page amber
7. Mobile 44px targets at 375px viewport
8. RetroEmptyState centered with default body + action
9. Language toggle renders ET `[ET] …` placeholders
10. `bun run i18n:compile` exits 0 — already verified automated

## Deferred Issues

Pre-existing lint/TS errors from earlier phases (Phase 56 ApiDemoPage TS2322; ActivityFeed cascading-render lint; api.ts no-useless-catch; i18n.ts; AppShell; useRouteLoading; AuthCallbackPage; AuthContext; RequireAuth.test; RetroToast.test). Out of scope per executor scope-boundary rule; tracked in `.planning/phases/57-retro-form-primitives/deferred-items.md`.

Remaining 85+ pre-existing missing ET translations (not introduced by phase 57) are not addressed — user-preference sub-item per plan.

## TDD Gate Compliance

- **RED** gate: `test(57-03): add failing tests for RetroPagination, RetroConfirmDialog, RetroEmptyState` (5d1cdaf) — confirmed module-not-found failure before implementation.
- **GREEN** gates: `feat(57-03): add RetroPagination, RetroConfirmDialog, RetroEmptyState primitives` (4702b1c) + `feat(57-03): wire /demo page with all 9 retro form primitives + Lingui catalogs` (3977426) — 12 new tests green, full suite 237/237.

## Self-Check: PASSED

- FOUND: frontend2/src/components/retro/RetroPagination.tsx
- FOUND: frontend2/src/components/retro/RetroConfirmDialog.tsx
- FOUND: frontend2/src/components/retro/RetroEmptyState.tsx
- FOUND: frontend2/src/components/retro/__tests__/RetroPagination.test.tsx
- FOUND: frontend2/src/components/retro/__tests__/RetroConfirmDialog.test.tsx
- FOUND: frontend2/src/components/retro/__tests__/RetroEmptyState.test.tsx
- FOUND commits: 5d1cdaf, 4702b1c, 3977426
