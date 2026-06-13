---
phase: 16-command-palette
plan: 02
subsystem: ui
tags: [cmdk, tinykeys, command-palette, react-query, lingui, msw, localStorage, retro-os]

# Dependency graph
requires:
  - phase: 16-01
    provides: cmdk@1.1.1 + tinykeys@4.0.0 deps (frozen lockfile) + the `palette` vite manualChunks rule
provides:
  - "src/features/command-palette/ module — the full cmdk palette body, tinykeys open-chord owner, localStorage MRU, static route table, and debounced 4-domain entity-search hooks, all unit-proven"
  - "index.ts export surface: DEFAULT export CommandPalette (React.lazy target) + NAMED export usePaletteChord + type CommandPaletteProps"
  - "et + ru translations for all 6 new palette msgids (catalog parity green)"
affects: [16-03]

# Tech tracking
tech-stack:
  added: []  # deps landed in 16-01; this plan installs nothing (bun install --frozen-lockfile only)
  patterns:
    - "cmdk fully-controlled mode (shouldFilter={false} + controlled value/onValueChange, stable id-based item values) for mixed static + async rows"
    - "tinykeys mount-once open-chord owner (useEffect([]) + openRef ref-sync, ignore:()=>false override) — render-loop-safe"
    - "debounced (250ms, timer in ref) React Query entity search, domain-prefixed keys [domain, wsId, 'search', q], limit-clamped, enabled only when wsId && q>=2"
    - "localStorage MRU mirroring scan-history.ts safe-parse (de-dup by id, cap 10, []-on-bad-JSON)"
    - "scoped jsdom test stubs (ResizeObserver + scrollIntoView) inside the spec for cmdk, avoiding edits to the shared test setup"

key-files:
  created:
    - frontend2/src/features/command-palette/recentActions.ts
    - frontend2/src/features/command-palette/paletteRoutes.ts
    - frontend2/src/features/command-palette/useEntitySearch.ts
    - frontend2/src/features/command-palette/usePaletteChord.ts
    - frontend2/src/features/command-palette/CommandPalette.tsx
    - frontend2/src/features/command-palette/index.ts
    - frontend2/src/features/command-palette/__tests__/recentActions.test.ts
    - frontend2/src/features/command-palette/__tests__/usePaletteChord.test.tsx
    - frontend2/src/features/command-palette/__tests__/CommandPalette.test.tsx
    - frontend2/src/features/command-palette/__tests__/entitySearch.msw.ts
  modified:
    - frontend2/src/locales/en/messages.po
    - frontend2/src/locales/et/messages.po
    - frontend2/src/locales/ru/messages.po

key-decisions:
  - "Route labels use msg`` descriptors from @lingui/core/macro (resolved with useLingui().t(label) at render) — the first @lingui/core/macro usage in the codebase; extraction confirmed it harvests"
  - "Most route-label msgids already existed (reused from Sidebar.tsx) so were already et/ru-translated; only 6 genuinely-new UI msgids needed filling"
  - "cmdk's jsdom gaps (ResizeObserver, scrollIntoView) stubbed inside CommandPalette.test.tsx (a files_modified file) rather than the shared src/test/setup.ts (out of this plan's edit scope)"
  - "value reset only on QUERY change (not per fetch settle) so async entity arrivals don't reset cmdk selection (Pitfall 3)"

patterns-established:
  - "Palette feature module convention: one feature dir, index.ts default-exports the lazy body + named-exports the main-bundle chord hook"
  - "Per-spec jsdom polyfill stubs for third-party combobox libs"

requirements-completed: [TUI-05]

# Metrics
duration: ~35min
completed: 2026-06-13
---

# Phase 16 Plan 02: Command Palette Module Summary

**The complete `command-palette` feature module — cmdk palette body (4 groups: Routes / Workspaces / Recent / live debounced entity search), a render-loop-safe tinykeys open-chord owner, a localStorage MRU, and the debounced 4-domain entity-search hooks — all TDD-proven and translated, exporting the lazy body + chord hook for 16-03 to mount.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-06-13
- **Tasks:** 3 of 3
- **Files modified:** 13 (10 created, 3 catalogs modified)

## Accomplishments
- Full cmdk palette body with controlled state, 4 source groups, retro-os pastel chrome, ESC via the shared modal stack, and MRU recording on every selection — 7 unit tests green.
- tinykeys mount-once open-chord owner ($mod+k + F2, fires from inside focused inputs via `ignore:()=>false`, preventDefault) with the documented render-loop landmine avoided (openRef + `[]` deps) — 6 unit tests green.
- Debounced (250ms) workspace-scoped entity search across items/borrowers/locations/containers with domain-prefixed query keys and limit clamp, backed by MSW handlers for all 4 /search endpoints.
- localStorage MRU (`hws-palette-recent`, cap 10, de-dup by id, safe-on-bad-JSON) with 8 unit tests.
- All 6 new palette msgids hand-translated in et + ru; catalog guard reports full parity.

## Task Commits

1. **Task 1: MRU store + static routes + entity-search hooks (+ tests/MSW)** — `2568c1dd` (feat)
2. **Task 2: tinykeys chord owner + cmdk palette body + retro chrome (+ tests)** — `43484080` (feat)
3. **Task 3: extract + translate new palette msgids (et + ru)** — `d8193e11` (i18n)

_TDD note: RED was driven by writing each spec first and confirming module-resolution / assertion failures before implementing; the project commits test+impl together per file group rather than separate RED/GREEN commits._

## Export Surface (for 16-03's ShellChrome mount + E2E spec)

`@/features/command-palette` (index.ts):
- **default export** = `CommandPalette` — the React.lazy body. Lands cmdk + radix-dialog in the `palette` chunk (16-01's vite rule) when 16-03 does `lazy(() => import("@/features/command-palette"))`.
- **named export** = `usePaletteChord(open: () => void): void` — the tinykeys owner; STAYS in main bundle. 16-03 calls `usePaletteChord(() => setPaletteOpen(true))` in ShellChrome.
- **named type** = `CommandPaletteProps`.

**CommandPalette prop shape:** `{ open: boolean; onClose: () => void }`.

**Root data-testid:** `command-palette` (on the full-screen scrim div).

**Combobox role:** the search input renders `role="combobox"` (cmdk default) — query it in specs via `getByRole("combobox")`.

**MRU storage key:** `hws-palette-recent` (localStorage; entry shape `{ id, kind, label, to? }`, kind ∈ route|workspace|item|borrower|location|container).

**Open chord:** `$mod+k` (⌘K mac / Ctrl+K elsewhere) + `F2`; fires even from inside a focused input.

**Entity row navigation targets:** item → `/items/{id}`, borrower → `/borrowers/{id}`, location → `/taxonomy?tab=locations`, container → `/taxonomy?tab=containers`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom missing ResizeObserver + Element.scrollIntoView for cmdk**
- **Found during:** Task 2 (CommandPalette.test.tsx)
- **Issue:** cmdk subscribes a `ResizeObserver` and calls `scrollIntoView` on selection; jsdom ships neither, so the palette threw `ResizeObserver is not defined` / `scrollIntoView is not a function` on mount and on ArrowDown.
- **Fix:** Added minimal scoped stubs at the top of `CommandPalette.test.tsx` (a `files_modified` file) rather than touching the shared `src/test/setup.ts` (outside this plan's edit scope).
- **Files modified:** `frontend2/src/features/command-palette/__tests__/CommandPalette.test.tsx`
- **Commit:** `43484080`

**2. [Rule 1 - Test fixture] tinykeys jsdom KeyboardEvent needs `code`; $mod is platform-bound**
- **Found during:** Task 2 (usePaletteChord.test.tsx)
- **Issue:** tinykeys' `isKeyboardEvent` guard requires `key && code && getModifierState`; jsdom events built with only `key` were ignored. Also a Meta+k assertion was wrong on the (Linux) test platform where `$mod`→Control.
- **Fix:** Derived a `code` from the key in the test dispatcher; replaced the mac-only Meta+k case with a "bare k does NOT fire" assertion that's correct on the non-mac test platform. Implementation unchanged.
- **Files modified:** `frontend2/src/features/command-palette/__tests__/usePaletteChord.test.tsx`
- **Commit:** `43484080`

These are test-environment fixes; the production code matched the plan exactly.

## Notes for 16-03

- The module is NOT mounted anywhere yet — the build correctly tree-shakes it out entirely (no `palette-*.js` chunk is produced on this branch; cmdk/radix-dialog are absent from `index-*.js`). The `palette` chunk only materializes once 16-03 adds the `lazy(import("@/features/command-palette"))` + the `<Suspense>` mount in ShellChrome. The bundle gate (cmdk ∈ palette-*.js, ∉ entry) is therefore 16-03's to assert post-mount.
- `usePaletteChord` must be called UNCONDITIONALLY (it's a hook); gate the lazy `<CommandPalette open={paletteOpen} .../>` render on `paletteOpen` instead.

## Self-Check: PASSED

All 13 declared files exist on disk; all 3 task commits (`2568c1dd`, `43484080`, `d8193e11`) are present in git history.
