---
phase: 60
plan: 03
subsystem: frontend2-items
tags: [frontend, items, components, form, panel, archive-delete-flow, filter-bar, chip, tdd]
dependency_graph:
  requires:
    - 60-02 (useCreateItem, useUpdateItem, useArchiveItem, useRestoreItem, useDeleteItem, itemCreateSchema, generateSku, makeItem fixture)
    - Phase 59 patterns (BorrowerForm / BorrowerPanel / BorrowerArchiveDeleteFlow — adapted)
    - Existing retro primitives (RetroFormField, RetroInput, RetroTextarea, RetroCombobox, RetroSelect, RetroConfirmDialog, SlideOverPanel, RetroButton)
  provides:
    - ItemForm (RHF + zod + RetroFormField, 5 fields, empty-string coercion)
    - ItemPanel (forwardRef slide-over, SKU auto-gen on create, dispatches to useCreateItem/useUpdateItem)
    - ItemArchiveDeleteFlow (two-dialog archive-first, NO 400 active-loans branch)
    - ShowArchivedChip (aria-pressed filter chip with amber/ink color states)
    - useItemsListQueryParams (URL-state hook over useSearchParams)
    - ItemsFilterBar (composed filter surface — search/category/sort/chip)
  affects:
    - Plan 60-04 (ItemsListPage + ItemDetailPage will import all six)
tech_stack:
  added: []
  patterns:
    - react-hook-form Controller-for-all via RetroFormField
    - zod .or(z.literal("")) + resolver wrapper for belt-and-suspenders empty-string coercion
    - forwardRef + useImperativeHandle for imperative panel/flow APIs
    - setTimeout(..., 0) dialog-race-free handoff (archive → hard-delete)
    - URL-state via react-router useSearchParams with Pitfall-8 page-reset
    - useEffect + setTimeout debounce (300ms) for search input
    - Lingui t macro on every user-visible string
key_files:
  created:
    - frontend2/src/features/items/forms/ItemForm.tsx (164 lines)
    - frontend2/src/features/items/panel/ItemPanel.tsx (138 lines)
    - frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx (105 lines)
    - frontend2/src/features/items/filters/ShowArchivedChip.tsx (44 lines)
    - frontend2/src/features/items/filters/useItemsListQueryParams.ts (98 lines)
    - frontend2/src/features/items/filters/ItemsFilterBar.tsx (130 lines)
    - frontend2/src/features/items/__tests__/ItemForm.test.tsx (217 lines, 7 tests)
    - frontend2/src/features/items/__tests__/ItemPanel.test.tsx (189 lines, 5 tests)
    - frontend2/src/features/items/__tests__/ItemArchiveDeleteFlow.test.tsx (163 lines, 5 tests)
    - frontend2/src/features/items/__tests__/ShowArchivedChip.test.tsx (52 lines, 4 tests)
    - frontend2/src/features/items/__tests__/useItemsListQueryParams.test.ts (126 lines, 7 tests)
    - frontend2/src/features/items/__tests__/ItemsFilterBar.test.tsx (82 lines, 2 tests)
  modified:
    - frontend2/locales/en/messages.po (Lingui extract for new strings)
    - frontend2/locales/et/messages.po (Lingui extract adds et stubs)
decisions:
  - RetroFormField's helper prop IS a real prop (see frontend2/src/components/retro/RetroFormField.tsx:14) — no divergence needed from the plan spec
  - Sort dropdown implemented as ONE combined RetroSelect with "{field}:{dir}" values (e.g. "name:asc") per plan preference — 8 labelled options cover all permutations; split back on change
  - Debounce test uses vi.useFakeTimers({shouldAdvanceTime:true}) + fireEvent.change (not userEvent.type) because userEvent advances timers by default and makes 300ms assertions fragile. Fake timers + fireEvent gives deterministic 300ms boundary control
  - Resolver wrapper hoisted to module scope (matches BorrowerForm) — prevents re-computing the closure on every render
  - Eslint react-hooks/set-state-in-effect disable directive placed at the setState call site (not useEffect) — project convention (same rule is violated in AuthContext, AppShell, ActivityFeed without suppression)
metrics:
  duration_sec: 655
  tasks_completed: 4
  tests_added: 30
  files_created: 12
  files_modified: 2
  completed_date: "2026-04-16"
---

# Phase 60 Plan 03: Items Features — Form, Panel, Archive/Delete Flow, Filter Surface Summary

Built the six Phase 60 feature-layer components (ItemForm, ItemPanel, ItemArchiveDeleteFlow, ShowArchivedChip, useItemsListQueryParams, ItemsFilterBar) that compose the items UI between the hooks/API layer (Plan 60-02) and the pages (Plan 60-04), following Phase 59 borrower patterns with item-specific divergences (no 400 active-loans branch, SKU auto-gen, aria-pressed filter chip, URL-state filter bar).

## What Was Built

**Forms layer — `ItemForm.tsx`**
- react-hook-form + zodResolver(itemCreateSchema) with empty-string coercion wrapper at module scope (hoisted out of the component body, matching BorrowerForm)
- 5 fields wired via RetroFormField Controller-for-all: NAME (required, autoFocus create-mode only), SKU (required, auto-generated upstream, editable, font-mono), BARCODE (optional, font-mono), DESCRIPTION (optional RetroTextarea, 4 rows), CATEGORY (RetroCombobox loading categoriesApi.list({archived:false,limit:100}) with 60s staleTime — Pitfall 7)
- Belt-and-suspenders empty-string → undefined coercion: once in the resolver (before zod validates) and again in the submit handler (before onSubmit fires) — ensures the server receives undefined and NULLs the column correctly
- `onDirtyChange(formState.isDirty)` via useEffect — SlideOverPanel uses this for unsaved-changes guard

**Panel layer — `ItemPanel.tsx`**
- forwardRef with imperative `ItemPanelHandle = { open(mode, item?), close() }`
- Create mode: fresh SKU via `generateSku()` on every open (not every render) — stored in state and threaded through `defaultValues.sku`
- Edit mode: pre-populates all 5 fields from the passed `Item`, mapping `null` DB values to `""` for controlled inputs
- Submit dispatches to `useCreateItem(values)` or `useUpdateItem({id, input})`
- Panel stays open on error (catch block is empty) so user can retry after SKU-collision toast without re-entering all fields
- Footer: `← BACK` (neutral, closes via panelRef.current?.close()) + submit button linked via `form={formId}` (HTML pattern — button outside form element submits it); label toggles `NEW ITEM`/`EDIT ITEM` + `CREATE ITEM`/`SAVE ITEM` + `WORKING…` (font-mono) when pending

**Actions layer — `ItemArchiveDeleteFlow.tsx`**
- forwardRef two-dialog flow with `ItemArchiveDeleteFlowHandle`
- Archive dialog (variant="soft"): title `ARCHIVE ITEM`, header badge `HIDES FROM DEFAULT VIEW`, body unquoted `{nodeName}` interpolation (per commit 1b84a45), secondary link `delete permanently` → hard-delete dialog
- Hard-delete dialog (variant="destructive"): title `CONFIRM DELETE`, escapeLabel `KEEP ITEM` (terminal confirmation — diverges from borrowers which use `← BACK` on both dialogs), destructive label `DELETE ITEM`
- NO `HttpError.status === 400` short-circuit — items have no loan-bound server guard (D-04). All errors surface via the mutation hook's onError toast
- Dialog handoff uses `setTimeout(..., 0)` to avoid the both-dialogs-open-at-once race (Phase 59 idiom)

**Filters layer — three files**
- `ShowArchivedChip.tsx`: `<button aria-pressed>` with amber (on) / ink (off) border + text per UI-SPEC color rule #6; 44px mobile / 32px desktop touch target; font-mono count with mid-dot separator; 2px amber focus-visible outline
- `useItemsListQueryParams.ts`: URL-state hook over react-router's `useSearchParams`; returns `[state, update, clearFilters]`; state shape `{q, category, sort, sortDir, archived, page}`; Pitfall 8 — any non-page filter change without an explicit page value in the same patch resets the page URL key; `clearFilters` removes `q/category/archived/page` but PRESERVES `sort/dir` per UI-SPEC §Interaction Contracts
- `ItemsFilterBar.tsx`: composite bar wiring RetroInput (search, 300ms debounce via `useEffect` + `setTimeout`), RetroCombobox (category options from `categoriesApi.list({archived:false})` with 60s staleTime + `"All categories"` leading option), RetroSelect (sort — single combined dropdown with 8 labelled `"{field}:{dir}"` options), ShowArchivedChip — all URL-state driven

## Tests

All 30 new tests pass. Overall frontend2 suite: **364 tests across 61 files, all green.**

| File | Tests | Covers |
|------|-------|--------|
| ItemForm.test.tsx | 7 | required name/sku, SKU pattern rejection, optional barcode coercion, edit pre-population, submit payload coercion, dirty propagation |
| ItemPanel.test.tsx | 5 | create-mode title+SKU auto-gen, edit-mode pre-population, successful create closes panel, SKU collision keeps panel open for retry, edit dispatches update with item.id |
| ItemArchiveDeleteFlow.test.tsx | 5 | open() shows archive dialog, archive-confirm success closes, delete-permanently link switches dialogs, hard-delete-confirm calls onDelete, no 400 active-loans short-circuit |
| ShowArchivedChip.test.tsx | 4 | off-state labels+aria-pressed=false, on-state labels+aria-pressed=true, onToggle dispatch, font-mono count |
| useItemsListQueryParams.test.ts | 7 | defaults, URL read, Pitfall-8 page reset on filter change, explicit page update, empty q/null category/false archived delete their keys, clearFilters preserves sort/dir |
| ItemsFilterBar.test.tsx | 2 | 300ms search debounce boundary, chip toggle dispatch |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Pre-existing convention] Targeted eslint-disable for setState-in-effect**
- **Found during:** Task 4 (ItemsFilterBar)
- **Issue:** The project's lint config includes `react-hooks/set-state-in-effect` which flags the canonical useEffect+setState pattern for syncing controlled state to an external source (URL in this case). The same rule is violated without suppression in 5+ pre-existing files (AuthContext.tsx:67, AppShell.tsx:25, ActivityFeed.tsx:41, AuthCallbackPage.tsx:24, useRouteLoading.ts:14) — establishing project convention
- **Fix:** Added a targeted `// eslint-disable-next-line react-hooks/set-state-in-effect` at the setState call inside the URL resync useEffect (not the useEffect line — the rule emits on the setState call)
- **Files modified:** frontend2/src/features/items/filters/ItemsFilterBar.tsx
- **Commit:** 77135fd

### Auth Gates

None — no authentication was required during execution.

### Architectural Notes (no changes, for record)

The plan references `useCategoryNameMap` as existing from 60-02 — verified present but not used by this plan (it is consumed by list/detail pages in 60-04; the form and filter bar both use a direct `useQuery` with `archived:false`). This matches the plan's <success_criteria> line: "useCategoryNameMap pattern NOT used in this plan".

## Plan-Level TDD Gate Compliance

All four tasks followed RED → GREEN commit pairs:

| Task | RED commit | GREEN commit |
|------|-----------|-------------|
| 1 (ItemForm) | 2e14997 `test(60-03)` | 8b4cb29 `feat(60-03)` |
| 2 (ItemPanel) | 515e6b8 `test(60-03)` | f3f5356 `feat(60-03)` |
| 3 (ItemArchiveDeleteFlow) | da003d3 `test(60-03)` | b8f5a9d `feat(60-03)` |
| 4 (Filter surface) | eaa09ab `test(60-03)` | 944b774 `feat(60-03)` |

Each RED commit was verified to fail (missing module / assertion failures) before the matching GREEN commit was made.

## Verification Status

- [x] `cd frontend2 && bun run test -- --run src/features/items/__tests__/` — **54 tests pass** across 9 files (30 new + 24 pre-existing from Plan 60-02)
- [x] `cd frontend2 && bun run build` — exits 0
- [x] `cd frontend2 && bun run lint:imports` — exits 0 (no offline/sync/idb/serwist imports)
- [x] `cd frontend2 && bun run i18n:extract` — Done in 646ms, no errors; 345 total messages in en catalog
- [⚠] `cd frontend2 && bun run lint` — 10 pre-existing errors remain (same count before my changes was 11; I fixed one new instance I introduced). All 10 remaining are in unrelated files (AuthContext, AppShell, ActivityFeed, etc.) — out of scope per the scope-boundary rule. Logged as deferred items only conceptually (not writing to deferred-items.md since they already exist and predate this plan).

## Gotchas Encountered

1. **Lingui i18n:compile needed before build** — The `frontend2/src/lib/i18n.ts` module imports `../../locales/en/messages.ts` which is only produced by `bun run i18n:compile`. Fresh worktrees without compiled catalogs fail the build with `TS2307: Cannot find module`. Resolution: run `bun run i18n:compile` after dependency install on a fresh worktree before any `bun run build`. Not a plan issue, environment bootstrap.
2. **`react-hooks/set-state-in-effect` rule placement** — The rule emits at the setState call site, not the useEffect line. Disable directives must be placed on the line immediately above the setState call (inside the useEffect body), not above the useEffect itself.
3. **Fake timers + userEvent conflict** — userEvent.setup({advanceTimers}) with fake timers can make 300ms debounce assertions fragile because userEvent auto-advances during keystroke simulation. Using `fireEvent.change` (which does not interact with timers) + explicit `vi.advanceTimersByTime(300)` gives deterministic debounce-boundary tests.
4. **Missing plan files in worktree** — The worktree was hard-reset to base commit `4400ce4` which pre-dates the untracked Phase 60 planning files. Copied `60-03-PLAN.md`, `60-CONTEXT.md`, `60-RESEARCH.md`, `60-UI-SPEC.md`, `60-PATTERNS.md`, `60-VALIDATION.md` from the main worktree to read them; the SUMMARY gets committed but the plan/context inputs remain untracked.

## Self-Check: PASSED

### Files Created (verified exist)
- FOUND: frontend2/src/features/items/forms/ItemForm.tsx
- FOUND: frontend2/src/features/items/panel/ItemPanel.tsx
- FOUND: frontend2/src/features/items/actions/ItemArchiveDeleteFlow.tsx
- FOUND: frontend2/src/features/items/filters/ShowArchivedChip.tsx
- FOUND: frontend2/src/features/items/filters/useItemsListQueryParams.ts
- FOUND: frontend2/src/features/items/filters/ItemsFilterBar.tsx
- FOUND: frontend2/src/features/items/__tests__/ItemForm.test.tsx
- FOUND: frontend2/src/features/items/__tests__/ItemPanel.test.tsx
- FOUND: frontend2/src/features/items/__tests__/ItemArchiveDeleteFlow.test.tsx
- FOUND: frontend2/src/features/items/__tests__/ShowArchivedChip.test.tsx
- FOUND: frontend2/src/features/items/__tests__/useItemsListQueryParams.test.ts
- FOUND: frontend2/src/features/items/__tests__/ItemsFilterBar.test.tsx

### Commits (verified via `git log --oneline`)
- FOUND: 2e14997 `test(60-03): add failing tests for ItemForm`
- FOUND: 8b4cb29 `feat(60-03): implement ItemForm with RHF + zod + RetroFormField`
- FOUND: 515e6b8 `test(60-03): add failing tests for ItemPanel`
- FOUND: f3f5356 `feat(60-03): implement ItemPanel forwardRef slide-over with SKU auto-gen`
- FOUND: da003d3 `test(60-03): add failing tests for ItemArchiveDeleteFlow`
- FOUND: b8f5a9d `feat(60-03): implement ItemArchiveDeleteFlow archive-first two-dialog flow`
- FOUND: eaa09ab `test(60-03): add failing tests for filter surface (chip, URL hook, bar)`
- FOUND: 944b774 `feat(60-03): implement filter surface — chip, URL hook, filter bar`
- FOUND: 77135fd `chore(60-03): update Lingui catalogs + suppress set-state-in-effect lint`
