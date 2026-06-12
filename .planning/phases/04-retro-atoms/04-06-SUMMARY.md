---
phase: 04-retro-atoms
plan: 06
subsystem: frontend-filter-atoms
tags: [ui, filters, localstorage, popover, bulk-actions, saved-filters, a11y, tdd]

requires:
  - phase: 04-retro-atoms (Plan 04-01)
    provides: "Popover (chromeless anchored panel, ESC via useModalStack) + RetroConfirmDialog (pink, focus-on-cancel) + RetroDialog"
  - phase: 04-retro-atoms (Plan 04-04)
    provides: "RetroCheckbox (facet checklist rows), RetroInput (preset-name field)"
  - phase: 01 (retro chrome)
    provides: "BevelButton, RetroBadge, RetroInput field chrome, bevel tokens"
provides:
  - "FilterBar (ATOM-FB-01) — recessed bg-bg-panel-2 toolbar: search + facet trigger slots + {n} items count + CTA + removable blue chips + CLEAR ALL"
  - "FilterPopover (ATOM-FB-02) — RetroCheckbox facet checklist on the Plan 04-01 Popover; multi-select keeps open; ESC via useModalStack"
  - "BulkActionBar (ATOM-FB-03) — inline mobile selection surface (role=toolbar, polite-live {n} SELECTED); destructive actions route through RetroConfirmDialog"
  - "useSavedFilters (ATOM-FB-04) — localStorage preset hook (save/apply/setAsDefault/getDefault/delete/update); malformed-tolerant try/catch JSON.parse + shape guard"
  - "SavedFilters (ATOM-FB-04) — preset chips (active = blue + aria-pressed) + ▾ PRESETS menu (SAVE CURRENT… dialog + per-preset delete confirm)"
  - "@/components/retro barrel re-exports ./filters"
affects:
  - "Phases 7/8/14 consume these four filter atoms instead of three ad-hoc copies"
  - "Phase 12 server-side filter prefs supersede the localStorage hook (forward-compatible SavedFilter[] storage shape)"

tech-stack:
  added: []
  patterns:
    - "Untrusted-localStorage read: try/catch JSON.parse + an isSavedFilterArray shape guard; malformed (non-JSON) OR wrong-shape (valid JSON, not a SavedFilter[]) payload resets to [] without throwing (ASVS V5)"
    - "Functional setState in the hook mutators (setSavedFilters(prev => …)) so save→setDefault→delete sequenced in one act() block stay consistent without stale closures"
    - "Presentational atoms + consumer-wired hook: SavedFilters takes savedFilters[] + callbacks (the page wires useSavedFilters); keeps the atom testable and the persistence boundary explicit"
    - "Single ESC authority preserved: FilterPopover + SavedFilters menu render through the Plan 04-01 Popover, so ESC routes via useModalStack — zero document-level ESC listeners in filter source (TUI-02 LOCKED)"
    - "Destructive bulk/preset actions route through RetroConfirmDialog (pink, focus-on-cancel) before executing — the handler fires only on explicit confirm"

key-files:
  created:
    - "frontend2/src/components/retro/filters/useSavedFilters.ts (+ .test.ts)"
    - "frontend2/src/components/retro/filters/SavedFilters.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/filters/FilterBar.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/filters/FilterPopover.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/filters/BulkActionBar.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/filters/index.ts"
  modified:
    - "frontend2/src/components/retro/index.ts (appended ./filters re-export)"

key-decisions:
  - "SavedFilters is presentational (props: savedFilters[] + onApply/onDelete/onSaveCurrent); the consuming page wires useSavedFilters. Keeps the localStorage boundary explicit and the atom unit-testable without a real store."
  - "Hook mutators use functional setState (prev => next) and persist the computed next array inside the updater, so chained save/setAsDefault/delete in one act() block don't read stale state."
  - "FilterBar facets are render-slots ({ key, label, trigger }), so a FilterBar consumer composes a <FilterPopover> per facet rather than FilterBar owning facet popover state — matches the legacy chip contract while extending it with search/facets/CTA slots."
  - "BulkActionBar takes an optional structured destructiveAction ({label, confirmTitle, confirmBody, onConfirm}) so the confirm wiring lives in the atom; non-destructive actions remain free-form children BevelButtons."

requirements-completed: [ATOM-FB-01, ATOM-FB-02, ATOM-FB-03, ATOM-FB-04]

duration: ~18min
completed: 2026-06-13
---

# Phase 4 Plan 06: Filter Atoms Summary

**The four filter atoms (ATOM-FB-01..04) built once on the earlier-plan primitives: a recessed `FilterBar` toolbar (search + facet slots + count + CTA + removable blue chips + CLEAR ALL), a `FilterPopover` RetroCheckbox facet checklist on the Plan 04-01 Popover, an inline-mobile `BulkActionBar` (role=toolbar, polite-live count, destructive actions gated by RetroConfirmDialog), and a malformed-tolerant localStorage `useSavedFilters` hook feeding a `SavedFilters` preset-chip + ▾ PRESETS menu.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 (both TDD: RED verified → GREEN)
- **Files created:** 11 (5 atoms/hook + 5 specs + filters barrel)
- **Files modified:** 1 (retro root barrel — appended `./filters`)
- **Tests:** 31 filter-family specs (Task 1: 11; Task 2: 20); full suite 239 passed (37 files)

## Accomplishments

- **useSavedFilters** (`useSavedFilters.ts`) — localStorage-backed presets keyed by `storageKey`. Returns `{ savedFilters, saveFilter, deleteFilter, updateFilter, applyFilter, setAsDefault, getDefaultFilter }`. Legacy contract ported with `any`→`unknown` (`filters: Record<string, unknown>`). **The read is try/catch-wrapped AND shape-guarded** (`isSavedFilterArray`): a non-JSON payload (catch) or a valid-JSON-but-wrong-shape payload (guard) both reset to `[]` without throwing — the persisted blob is untrusted input (ASVS V5). Mutators use functional setState and persist the computed next array, so chained save/setAsDefault/delete stay consistent. Setting a new default clears the prior default flag. Storage shape = `SavedFilter[]` under `storageKey` (forward-compatible with Phase 12 server prefs).
- **SavedFilters** (`SavedFilters.tsx`) — preset chips as `<button aria-pressed>` (active = `bg-titlebar-blue`) + a `▾ PRESETS` BevelButton opening the Plan 04-01 Popover (`role="menu"`). Menu lists presets (apply on click) with a per-preset delete (✕ → RetroConfirmDialog), a `SAVE CURRENT…` item (opens a RetroDialog with a RetroInput name field), and an empty-state row `No saved filters yet.` All preset names render as JSX text nodes (auto-escape — no raw-HTML injection).
- **FilterBar** (`FilterBar.tsx`) — recessed `bg-bg-panel-2 p-sp-3` toolbar: a `type="search"` sunken `w-[260px]` input (`Filter items…`), facet trigger slots (`{ key, label, trigger }`), a `flex-1` spacer, a mono `{n} items` count, a primary CTA slot, and a chip row of active filters (`bg-titlebar-blue` + ink ✕ → `onRemoveFilter`) with a `CLEAR ALL` text button. Extends the legacy `{ filterChips, onRemoveFilter, onClearAll }` contract with search/facets/CTA slots.
- **FilterPopover** (`FilterPopover.tsx`) — a facet BevelButton (`label ▾`, `aria-haspopup="listbox"`) + a `RetroCheckbox` checklist on the Plan 04-01 Popover (`role="listbox"`). Toggling calls `onChange(next)` and **keeps the popover open** (multi-select); ESC closes via `useModalStack`.
- **BulkActionBar** (`BulkActionBar.tsx`) — the inline mobile/contextual surface (desktop bulk actions surface via the Phase 3 Bottombar SSOT — this is NOT a second desktop bar). `bg-bg-panel-2 border-2 border-border-ink bevel-raised p-sp-3` strip, `role="toolbar" aria-label="Bulk actions"`, a polite-live `{n} SELECTED` RetroBadge (blue), free-form action children, an optional structured `destructiveAction` routed through RetroConfirmDialog before executing, and a `✕ CLEAR` deselect.
- **Barrels** — `retro/filters/index.ts` exports all four atoms + the hook + types; `retro/index.ts` appends `export * from "./filters"` per the locked single-barrel v2.0 convention.

## Task Commits

1. **Task 1** — `908909d` (feat) — useSavedFilters + SavedFilters (RED verified before GREEN: modules unresolved → fail; then 11/11 green)
2. **Task 2** — `00646e7` (feat) — FilterBar + FilterPopover + BulkActionBar + filters barrel + retro `./filters` line (RED verified; then 20/20 green)

_TDD: each task wrote failing specs first (confirmed RED), then the implementation. GREEN was clean after the two in-task fixes below — no refactor commits needed._

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] SavedFilters/FilterPopover/BulkActionBar specs need a ModalStackProvider wrapper**
- **Found during:** Task 1 (SavedFilters) + Task 2.
- **Issue:** Those atoms render the Plan 04-01 Popover/RetroConfirmDialog, which call `useModalStack` and throw `useModalStackContext must be used within a <ModalStackProvider>` when rendered bare in RTL.
- **Fix:** Wrapped each spec's `wrap()` helper in `<ModalStackProvider>` (the same pattern the Plan 04-04 RetroCombobox spec uses). Production consumers render inside AppShell, which provides the stack.
- **Files:** `SavedFilters.test.tsx`, `FilterPopover.test.tsx`, `BulkActionBar.test.tsx`. **Committed in:** 908909d / 00646e7.

**2. [Rule 3 — Blocking] `dangerouslySetInnerHTML` grep gate tripped by a doc comment**
- **Found during:** Task 1.
- **Issue:** A SavedFilters doc comment literally contained the string `dangerouslySetInnerHTML` (explaining we DON'T use it), making the `grep -c … = 0` acceptance gate read 1.
- **Fix:** Reworded the comment to "never raw-HTML injection" (the same false-positive remedy the Plan 04-04 FileInput summary used for its content-read grep). Gate now reads 0; behavior unchanged (no raw-HTML sink ever existed).
- **Files:** `SavedFilters.tsx`. **Committed in:** 908909d.

**3. [Rule 1 — Test fixture] FilterBar spec passed an empty `<span />` as a facet trigger but asserted a named button**
- **Found during:** Task 2 (FilterBar GREEN).
- **Issue:** FilterBar renders facet `trigger` slots verbatim; the test fixture's `trigger: <span />` produced no accessible button, so `getByRole("button", { name: /category/i })` found nothing. This is a spec-fixture defect, not an atom bug (the atom correctly renders whatever trigger it's handed).
- **Fix:** Made the fixture triggers real `<button>Category ▾</button>` slots (what a real consumer passes — typically a `<FilterPopover>`). Atom code unchanged.
- **Files:** `FilterBar.test.tsx`. **Committed in:** 00646e7.

---

**Total deviations:** 3 auto-fixed (2 blocking test-harness, 1 fixture). No scope creep; no atom contract changed.

## Issues Encountered

`node_modules/` was absent on the fresh worktree; ran `bun install --frozen-lockfile` (all packages already in the lockfile — **none added**). All bun commands used the explicit worktree `frontend2` cwd (#3097 guard); per-commit cwd-drift + HEAD-namespace assertions ran clean.

## Threat Model Compliance

- **T-04-06-LS (DoS/Tampering — localStorage read):** mitigated — `useSavedFilters` wraps the read in try/catch AND validates the parsed value with `isSavedFilterArray`; a malformed (non-JSON) payload and a wrong-shape (valid-JSON, not-an-array) payload both reset to `[]` without throwing. Two dedicated specs enforce both branches. `grep -c JSON.parse useSavedFilters.ts` = 1 (inside the try).
- **T-04-06-XSS (Tampering/Elevation — preset/chip text):** mitigated — all preset names + chip labels render as JSX text nodes (React auto-escape). `grep -c dangerouslySetInnerHTML SavedFilters.tsx` = 0.
- **T-04-06-ESC (Elevation/DoS — popover/menu ESC):** mitigated — FilterPopover + SavedFilters menu close via the Plan 04-01 Popover→`useModalStack` only; no filter source owns a document-level ESC listener (preserves TUI-02). The FilterPopover ESC spec asserts close-on-Escape via the stack.
- **T-04-06-DEL (safety — destructive actions):** mitigated — BulkActionBar destructive actions + SavedFilters per-preset delete both route through RetroConfirmDialog (pink, focus-on-cancel); the destructive handler fires only on explicit confirm-button activation (specs assert the handler is NOT called until confirm).

## Verification

- `bun run test src/components/retro/filters/` → 20 passed (Task 2 run); Task 1 isolate → 11 passed. Combined filter-family = 31 specs.
- Full suite `bun run test` → 239 passed (37 files).
- `bun run lint:tsc` → exit 0. `bun run lint:imports` → OK.
- Gates: `grep -c JSON.parse useSavedFilters.ts` = 1; `grep -c dangerouslySetInnerHTML SavedFilters.tsx` = 0; `grep -c Popover FilterPopover.tsx` = 7 (≥1); `grep -c 'role="toolbar"' BulkActionBar.tsx` = 2 (≥1).

## Next Phase Readiness

- All four ATOM-FB atoms ship on the shared overlay/form/feedback primitives, barrel-exported via `@/components/retro`. Phases 7/8/14 consume them directly.
- `useSavedFilters` storage shape (`SavedFilter[]` under a per-table key) is forward-compatible with the Phase 12 server-prefs migration.
- Worktree clean; **STATE.md / ROADMAP.md NOT touched** (orchestrator owns those writes).

## Self-Check: PASSED

- Files: all 5 atom/hook `.tsx`/`.ts` + 5 specs + `filters/index.ts` FOUND; `retro/index.ts` modified (appended `./filters`).
- Commits: 908909d, 00646e7 both in `git log`.
- No file deletions across the 2 commits; working tree clean.

---
*Phase: 04-retro-atoms*
*Completed: 2026-06-13*
