---
phase: 04-retro-atoms
plan: 07
subsystem: frontend2-demo-integration
tags: [demo, integration-test, esc-stack, modal-stack, shortcuts-ssot, bulk-actions, tui-02, a11y, retro-os]

requires:
  - phase: 04-retro-atoms (Plans 04-01..04-06)
    provides: "every atom family — overlay (RetroDialog/RetroConfirmDialog/Popover), form, feedback (RetroToaster/retroToast/StatusDot/StatusPill/EmptyState), data (RetroTable/useTableSelection/RetroPagination/RetroTabs), filters (FilterBar/FilterPopover/BulkActionBar/SavedFilters)"
  - phase: 03 (shipped)
    provides: "AppShell layout route, ModalStackProvider (capture-phase ESC arbiter), ShortcutsProvider SSOT (Bottombar reads it), Sidebar SYSTEM nav group"
provides:
  - "/demo — DEV-gated atom review surface rendering every Phase 4 family inside AppShell (Success Criterion 1)"
  - "escStack.test.tsx — TUI-02 composition proof across stacked heterogeneous overlays (dialog -> drawer -> menu) + bulk-chip registration proof (Success Criterion 5)"
  - "DemoPage bulk-action wiring pattern: useTableSelection -> useShortcuts(\"bulk-actions\") -> Bottombar chips"
affects:
  - "Phase 6 provider stack (AppShell will mount its own RetroToaster; /demo mounts one locally)"
  - "Phases 7/8/14 list pages reuse the DemoPage selection -> bulk-action SSOT wiring pattern verbatim"

tech-stack:
  added: []
  patterns:
    - "Bulk-action SSOT wiring: pull the STABLE `selection.clear` out of the useTableSelection object, depend the useMemo only on [selectedCount, clearSelection] — never the whole `selection` object (fresh each render -> infinite register loop). Pitfall 3 enforced."
    - "TUI-02 composition test pattern: stack three heterogeneous overlays in one ModalStackProvider, drive `userEvent.keyboard('{Escape}')`, assert topmost-first pop by which overlay content disappears at each step, plus a LogoutOnEscape sentinel that fires ONLY once the stack drains to empty."
    - "DEV-gated route + nav: both the <Route path=\"demo\"> and the Sidebar <NavItem to=\"/demo\"> are wrapped in `import.meta.env.DEV` so the surface is reachable for review but tree-shaken out of production."

key-files:
  created:
    - "frontend2/src/routes/demo/DemoPage.tsx"
    - "frontend2/src/routes/demo/DemoPage.test.tsx"
    - "frontend2/src/components/retro/overlay/escStack.test.tsx"
  modified:
    - "frontend2/src/routes/index.tsx (DEV-gated /demo child route under AppShell)"
    - "frontend2/src/components/layout/Sidebar.tsx (DEV-gated SYSTEM > Demo NavItem)"

key-decisions:
  - "DemoPage mounts its own RetroToaster locally so toast launchers render on the page (AppShell mounts the app-wide one in Phase 6); for a self-contained review surface this is the correct scope."
  - "The 'drawer' in the dialog->drawer->menu stack is a second RetroDialog (a heterogeneous overlay type sharing the same arbiter) rather than MobileDrawer — MobileDrawer is responsive-CSS-gated and renders nothing under jsdom's default viewport, which would make the stack-depth assertion unobservable. A second RetroDialog proves the same TUI-02 invariant (topmost-first pop across overlay instances) deterministically."
  - "Header select-all + per-row checkbox toggles route through `onRowClick(id, {metaKey:true})` (the hook's Ctrl/Cmd toggle path) so they compose with the existing id-keyed selection instead of forking a second selection mechanism."

requirements-completed: [TUI-02, TUI-03, TUI-04, TUI-06, ATOM-FB-01, ATOM-FB-02, ATOM-FB-03, ATOM-FB-04]

metrics:
  duration: ~40min
  completed: 2026-06-13
  tasks: 2 auto + 1 checkpoint (pre-resolved)
  files_created: 3
  files_modified: 2
  full_suite: "250 passed (39 files)"
---

# Phase 4 Plan 07: /demo Surface + TUI-02 Composition Proof Summary

**The `/demo` review surface (every Phase 4 atom family rendered inside AppShell, DEV-gated route + Sidebar link) and the `escStack` integration test that proves TUI-02 across a stacked dialog -> drawer -> menu (topmost-first ESC pop, logout never fires while open, balanced stack after close) plus the Success-Criterion-5 bulk-action chip registration into the shortcuts SSOT.**

## What Was Built

**Task 1 — DemoPage + route + Sidebar registration** (commit `4a2151a`)
- `routes/demo/DemoPage.tsx`: one `Window` section per atom family with the UI-SPEC semantic titlebar mood — FORM (blue), OVERLAY (blue), FEEDBACK (mint), DATA (mint), FILTER (butter). Each atom renders with its key states and a 14px `text-fg-muted` caption naming it:
  - **FORM**: RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox (checked / indeterminate / disabled), RetroFileInput, RetroFormField (hint + error variants).
  - **OVERLAY**: BevelButtons launching RetroDialog (blue/mint/butter titlebars), RetroConfirmDialog, and a Popover menu.
  - **FEEDBACK**: four `retroToast` launchers, three RetroStatusDot states (live/idle/error), four StatusPills (OK/WARN/INFO/DANGER), two RetroEmptyState variants (no-data + filtered).
  - **DATA**: a RetroTable wired to `useTableSelection` (row click, header select-all with indeterminate dash, tabular-nums Qty column), RetroPagination, RetroTabs (with a disabled tab).
  - **FILTER**: FilterBar (search + a FilterPopover facet + chips + count + CTA), BulkActionBar (destructive routes through a confirm), SavedFilters (preset chips + ▾ PRESETS menu).
- A local `RetroToaster` is mounted on the page so toast launchers render here. Section rhythm `gap-sp-6`, within-section `gap-sp-4`.
- **Bulk-action SSOT wiring (Success Criterion 5):** `useTableSelection` drives a memoized `bulkActions` array registered via `useShortcuts("bulk-actions", …)`. The Phase 3 Bottombar reads the same `useShortcutsContext().shortcuts` SSOT, so a non-empty selection surfaces desktop key-cap chips; clearing the selection unregisters the group (empty array -> no chips).
- `routes/index.tsx`: `/demo` added as a child route under the AppShell layout route, wrapped in `import.meta.env.DEV`. `Sidebar.tsx`: a DEV-gated `<NavItem to="/demo">` under the SYSTEM group.
- `DemoPage.test.tsx`: 6 smoke specs assert all five family section headings render and at least one atom from each family mounts (inside the I18n + Shortcuts + ModalStack provider harness).

**Task 2 — escStack TUI-02 composition proof + bulk-chip registration** (commit `e9a98ec`)
- `components/retro/overlay/escStack.test.tsx`: the integration proof Phase 3 could not write (Phase 3 unit-tested the *provider*; this proves the *composition*).
  - Stacks a real RetroDialog -> a second RetroDialog (the drawer) -> a Popover menu, all open simultaneously in one `ModalStackProvider`. The first ESC pops the **menu** (topmost), the second pops the **drawer**, the third pops the **dialog** — topmost-first ordering asserted by which overlay content disappears at each step.
  - A `LogoutOnEscape` sentinel (bubble-phase `keydown` that fires on a bare, non-defaultPrevented ESC) **never fires while any overlay is open** — the capture-phase arbiter preventDefaults every ESC. It fires exactly once only after the stack drains to empty, proving the arbiter swallows ESC *only* while overlays are open (balanced push/pop, no double-pop, no crash).
  - A separate describe block mounts a RetroTable + `useTableSelection` + a `useShortcutsContext` probe; selecting a row registers the `bulk-actions` group into the merged SSOT (`delete 1 selected`), clearing the selection unregisters it.

**Task 3 — /demo visual review (checkpoint:human-verify, pre-resolved):** per the standing autonomous mandate this run does not pause. The `<what-built>` / `<how-to-verify>` is documented below; the visual review is delegated to `.planning/v3.0-FINAL-REVIEW-CHECKLIST.md` (the orchestrator appends the entry). Treated as resolved.

## Checkpoint (delegated visual review)

**What was built:** `/demo` renders every Phase 4 atom family with retro-os pastel chrome. Automated specs cover behavior + ARIA; the visual fidelity (window chrome, pinstriped titlebars, Silkscreen ≥16px titles, radius-0 toast skin, hard step-end StatusDot blink, combobox keyboard feel, table range-select + indeterminate dash) is the one thing RTL/jsdom cannot assert.

**How to verify (for the FINAL-REVIEW checklist):**
1. `cd frontend2 && bun run dev`; log in; navigate to `/demo` (the DEV-only SYSTEM > Demo nav link).
2. Eyeball each family section vs sketches 006-008: window chrome, pinstriped titlebars, bevels, Silkscreen ≥16px titles only, Plex body/data, radius-0 except 2px chips/pills.
3. Fire all 4 toast types — mini-Window chrome with NO rounded corners, semantic titlebar stripes (mint/blue/butter/pink), stacking, hover-pause; the danger/ERROR toast must NOT auto-dismiss.
4. StatusDot: live dot blinks hard (step-end), goes solid under OS reduce-motion.
5. Combobox: arrow/type/select keyboard flow; selected option shows ✓; ESC closes.
6. Table: Shift+Click range-selects; header checkbox shows the indeterminate dash on partial selection; Qty is tabular-aligned. Selecting rows surfaces bulk-action chips in the Bottombar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Infinite render loop from an unstable bulk-action memo dependency**
- **Found during:** Task 1 (first DemoPage test run — vitest workers pegged at 100% CPU, no test output).
- **Issue:** `bulkActions = useMemo(…, [selectedCount, selection])` depended on the whole `selection` object returned by `useTableSelection`, which is a *fresh object every render*. That recomputed `bulkActions` each render -> `useShortcuts` re-registered -> `ShortcutsProvider.setGroups` re-rendered -> loop. The same trap is called out as Pitfall 3 in the plan interface notes.
- **Fix:** Pulled the STABLE `selection.clear` (a `useCallback` from the hook) into `clearSelection` and changed the memo deps to `[selectedCount, clearSelection]` — both stable. Applied the identical pattern in the escStack `BulkSelectionHost`.
- **Files:** `DemoPage.tsx`, `escStack.test.tsx`.
- **Commit:** `4a2151a` (DemoPage) / `e9a98ec` (test).

**2. [Rule 3 — Blocking] `SavedFilter` requires `createdAt`**
- **Found during:** Task 1 (tsc).
- **Issue:** The demo `savedFilters` fixtures omitted the required `createdAt: string` field on `SavedFilter` (TS2741).
- **Fix:** Added `createdAt` to both demo presets.
- **Files:** `DemoPage.tsx`. **Commit:** `4a2151a`.

**Total:** 2 auto-fixed (1 bug, 1 blocking). No architectural changes; no scope creep.

## Threat Model Compliance

- **T-04-07-ESC (Elevation/DoS — stacked overlay ESC):** mitigated — `escStack.test.tsx` proves topmost-first pop across dialog -> drawer -> menu, that logout is unreachable on bare ESC while any overlay is open, and that the stack returns balanced (the sentinel fires exactly once only after the stack empties). `grep -c Escape` = 13, `grep -c bulk-actions` = 7.
- **T-04-07-DEMO (Information disclosure — /demo exposure):** accepted as planned — the route AND the Sidebar link are both `import.meta.env.DEV`-gated (production build tree-shakes them); the page renders presentational atoms only, no real data or endpoints.
- **T-04-07-XSS (Tampering — demo labels):** accepted — all demo content is static JSX text (React auto-escaped); no `dangerouslySetInnerHTML`.

## Verification

- `bun run test src/routes/demo/DemoPage.test.tsx` -> 6 passed.
- `bun run test src/components/retro/overlay/escStack.test.tsx` -> 5 passed.
- **Full suite** `bun run test` -> **250 passed (39 files)**, EXIT 0.
- `bun run build` -> prebuild `lint:imports` OK, `tsc -b` clean, vite build succeeded (EXIT 0). `bun run lint:tsc` -> EXIT 0.
- Acceptance greps: `path="demo"` in routes/index.tsx = 1; `/demo` in Sidebar.tsx = 2; `import.meta.env.DEV` present in BOTH routes/index.tsx and Sidebar.tsx; `Escape` in escStack = 13; `bulk-actions` in escStack = 7.

## Metrics — final suite count & bundle delta

- **Final full-suite count:** 250 tests across 39 files (this plan added 11: 6 DemoPage smoke + 5 escStack). Prior wave high-water was 239 (Plan 04-06).
- **Cumulative sonner gzip delta vs the Phase 3 baseline:** Plan 04-01 recorded sonner's install acceptance at **~13.45 KB gzip** (dist `index.mjs`). This plan adds NO new dependency. The production build's main JS chunk is `index-DCw-Dcd3.js` 414.78 kB raw / **125.23 kB gzip** (+ a 50.77 kB / 18.50 kB-gzip CSS chunk). sonner is bundled into that chunk; the ~13.45 KB sonner contribution is the full cumulative toast-engine cost carried since 04-01 — Phase 4 introduced no further runtime deps.

## Known Stubs

None. The DemoPage is a review surface by design: its data (DEMO_ROWS, demo saved filters, toast copy) is static fixture content for visual review, not an unwired production data source. All atoms are fully composed against the live AppShell providers; the bulk-action wiring is real (registers into the same SSOT the Bottombar reads).

## Self-Check: PASSED

- Files: DemoPage.tsx, DemoPage.test.tsx, escStack.test.tsx all created; routes/index.tsx + Sidebar.tsx modified.
- Commits: `4a2151a` (Task 1) and `e9a98ec` (Task 2) both in git log.
- No STATE.md / ROADMAP.md changes (orchestrator owns those writes). Working tree clean; `dist/` gitignored.

---
*Phase: 04-retro-atoms*
*Completed: 2026-06-13*
