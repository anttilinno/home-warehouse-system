---
phase: 04-retro-atoms
plan: 02
subsystem: ui
tags: [react, hooks, accessibility, table-selection, pagination, tabs, lingui, vitest, retro-os]

# Dependency graph
requires:
  - phase: 04-retro-atoms (plan 04-01, sibling)
    provides: BevelButton, RetroTable, .rtable globals, retro/ barrel (consumed here)
  - phase: 03 (shipped)
    provides: bevel/titlebar token system, useShortcuts SSOT (future consumer of selection actions)
provides:
  - useTableSelection — id-keyed anchor+range selection hook (TUI-06), survives re-sort/re-filter
  - RetroPagination — sketch-008 beveled pager strip with accent-current page + mono meta
  - RetroTabs — folder-tab control with roving tabindex + full tablist/tab/tabpanel ARIA
  - retro/data barrel exporting the data family
affects: [04-retro-atoms demo page, Phase 6 dashboard StatusDot wiring, Phase 7/8 list pages + FilterBar/BulkActionBar, Phase 11 scan list]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Id-keyed selection: Set<string> + anchor id; Shift-range computed from current order at click time, never index-stored (Pitfall 1)"
    - "Roving tabindex: only the active tab is tabIndex=0; arrow nav skips disabled tabs and wraps"
    - "useLingui().t for dynamic/interpolated strings (aria-labels, meta sentence); <Trans> reserved for static copy"
    - "Shared test setup activates the 'en' i18n locale so useLingui().t consumers render under <I18nProvider>"

key-files:
  created:
    - frontend2/src/components/retro/data/useTableSelection.ts
    - frontend2/src/components/retro/data/useTableSelection.test.ts
    - frontend2/src/components/retro/data/RetroPagination.tsx
    - frontend2/src/components/retro/data/RetroPagination.test.tsx
    - frontend2/src/components/retro/data/RetroTabs.tsx
    - frontend2/src/components/retro/data/RetroTabs.test.tsx
    - frontend2/src/components/retro/data/index.ts
  modified:
    - frontend2/src/test-utils.tsx

key-decisions:
  - "Shift+Click keeps the anchor fixed (re-extendable range) rather than moving it to the target — matches the classic file-manager idiom and lets the user grow/shrink one span."
  - "Filtered-out anchor/target falls back to a single select instead of crashing or no-op'ing."
  - "Activated the source i18n locale in the shared test-utils (not per-test) so every useLingui().t consumer renders correctly under <I18nProvider>."

patterns-established:
  - "Pattern: id-keyed table selection that is immune to sort/filter reordering (the TUI-06 correctness primitive)."
  - "Pattern: retro/data subdir barrel for the data atom family, mirroring retro/index.ts."

requirements-completed: [TUI-04, TUI-06]

# Metrics
duration: ~20min
completed: 2026-06-13
---

# Phase 4 Plan 02: Retro Data Family Summary

**Id-keyed `useTableSelection` (anchor+range, survives re-sort), plus sketch-008 `RetroPagination` and a roving-tabindex folder-tab `RetroTabs` — the data atom family for every list page.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (both TDD)
- **Files created:** 7
- **Files modified:** 1

## Accomplishments
- `useTableSelection<T extends {id:string}>` stores `Set<string>` + anchor id; plain click single-selects, Shift+Click range-selects (computed from current rendered order at click time), Ctrl/Cmd+Click toggles and moves the anchor, `clear()` empties both. The critical re-sort survival test proves the range is id-keyed, never index-keyed (Pitfall 1 / threat T-04-02-SEL mitigated).
- `RetroPagination` renders `<nav aria-label="Pagination">` with `◂ PREV`/`NEXT ▸` BevelButtons (disabled at bounds), numbered page buttons with the current page taking `bg-titlebar-blue font-bold shadow-hard-ink` + `aria-current="page"`, and a right-aligned `font-mono tabular-nums` meta sentence `page {n} of {m} · {k} / page`.
- `RetroTabs` is the folder-tab idiom: `role="tablist"` with `role="tab"`/`role="tabpanel"`, `aria-selected`/`aria-controls`/`aria-labelledby` wiring, roving tabindex (only active tab `tabIndex=0`), and ←/→ arrow navigation that skips disabled tabs and wraps. Active tab takes the accent fill and connects into the panel.
- `retro/data/index.ts` barrel exports the data family.

## Task Commits

1. **Task 1: useTableSelection (id-keyed anchor+range) — TUI-06** — `56b8348` (test RED) → `2463b86` (feat GREEN)
2. **Task 2: RetroPagination + RetroTabs** — `5c9ca0b` (test RED) → `77b59ea` (feat GREEN)

## Files Created/Modified
- `frontend2/src/components/retro/data/useTableSelection.ts` — id-keyed anchor+range selection hook.
- `frontend2/src/components/retro/data/useTableSelection.test.ts` — 7 specs incl. the re-sort survival test.
- `frontend2/src/components/retro/data/RetroPagination.tsx` — sketch-008 beveled pager.
- `frontend2/src/components/retro/data/RetroPagination.test.tsx` — 6 specs (nav/aria-current/bounds/onPageChange/meta).
- `frontend2/src/components/retro/data/RetroTabs.tsx` — folder-tab control with roving tabindex.
- `frontend2/src/components/retro/data/RetroTabs.test.tsx` — 6 specs (ARIA wiring, click, roving, arrow-skip-disabled).
- `frontend2/src/components/retro/data/index.ts` — data family barrel.
- `frontend2/src/test-utils.tsx` — activates the `en` i18n locale for the unit-test run (deviation, below).

## Decisions Made
- Anchor stays fixed on Shift+Click so a range can be re-extended from the same end (classic file-manager behavior).
- Filtered-out anchor/target → graceful single-select fallback (no crash, no empty selection).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Activated the `en` i18n locale in shared test setup**
- **Found during:** Task 2 (RetroPagination)
- **Issue:** `RetroPagination`/`RetroTabs` use `useLingui().t` for dynamic aria-labels and the interpolated meta sentence. Under `<I18nProvider i18n={i18n}>` with no active locale (unit tests don't go through `main.tsx`'s `loadCatalog()`), `t` renders empty — the component returned an empty DOM and all 6 pager tests failed. `<Trans>` degrades to source text without an active locale, but `t` does not.
- **Fix:** `src/test-utils.tsx` (the global vitest `setupFiles`) now calls `i18n.load("en", {})` + `i18n.activate("en")`, mirroring `main.tsx`. This is test infra only — no production code changed.
- **Files modified:** frontend2/src/test-utils.tsx
- **Verification:** Full suite green (152 tests, 19 files); no pre-existing test regressed.
- **Committed in:** `77b59ea` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Test-infra fix required to make `useLingui().t` consumers testable; scoped to the shared setup file, no scope creep, no production behavior change.

## Issues Encountered
- The empty-render failure mode of `useLingui().t` without an active locale was non-obvious (no thrown error surfaced in the runner). Diagnosed by dumping `container.innerHTML` in a throwaway probe test, then confirmed the fix activates correctly.

## Verification
- `bun run test src/components/retro/data/` → 18 passed (3 files).
- Full suite `bun run test` → 152 passed (19 files).
- `bun run lint:tsc` → exit 0.
- `bun run lint:imports` → OK.
- Acceptance greps: `Set<string>` ×3 in the hook (indexOf used only for click-time range, not storage); `aria-current` ×1 in pager; `role="tablist"` ×2 in tabs.

## Known Stubs
None — all three atoms are fully wired and prop-driven; consumer wiring (Bottombar bulk-action registration, demo page) is explicitly out of scope per the plan objective and lands in later plans.

## Next Phase Readiness
- Data family ready for the `/demo` review surface (sibling/later plan) and for Phase 7/8 list pages.
- `useTableSelection` exposes `{ selected, onRowClick, clear }`; the bulk-action `useShortcuts` registration is consumer-side (RESEARCH data-flow trace), not built here.

## Self-Check: PASSED

All 7 created files and the SUMMARY verified present on disk; all 4 task commits (`56b8348`, `2463b86`, `5c9ca0b`, `77b59ea`) verified in git history.

---
*Phase: 04-retro-atoms*
*Completed: 2026-06-13*
