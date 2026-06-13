---
phase: 16-command-palette
plan: 03
subsystem: frontend2 / app-shell
tags: [command-palette, TUI-05, POL-04, code-splitting, e2e]
requires:
  - "16-02: @/features/command-palette default export (CommandPalette body) + usePaletteChord"
  - "16-01: cmdk/tinykeys install + the `palette` manualChunk in vite.config.ts"
provides:
  - "ShellChrome mounts the React.lazy CommandPalette + the usePaletteChord chord owner (⌘K/Ctrl+K + F2 open; ESC closes)"
  - "POL-04 bundle gate proven: cmdk + radix-dialog ship ONLY in the palette chunk; entry index-*.js is palette-free"
  - "chromium E2E spec covering SC1-4 (open via Meta+k & F2 / filter / Arrow+Enter nav / ESC / entity-search -> /items/{id})"
affects:
  - "frontend2/src/components/layout/AppShell.tsx (single-writer file for Phase 16)"
tech-stack:
  added: []
  patterns:
    - "React.lazy palette body via the feature barrel default export; usePaletteChord imported from its OWN module to keep the lazy split intact"
key-files:
  created:
    - frontend2/e2e/command-palette.spec.ts
  modified:
    - frontend2/src/components/layout/AppShell.tsx
decisions:
  - "Import usePaletteChord from @/features/command-palette/usePaletteChord (NOT the barrel) so the static chord import does not drag the palette body graph into the entry chunk (INEFFECTIVE_DYNAMIC_IMPORT fix)."
metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 16 Plan 03: Command Palette Wiring (ShellChrome mount + POL-04 gate + E2E) Summary

Mounted the cmdk command palette in `ShellChrome` exactly mirroring the existing `helpOpen` + `<F1HelpDialog>` pattern — a React.lazy body in a `<Suspense>` boundary, opened by the mount-once `usePaletteChord` tinykeys chord owner — and PROVED the POL-04 bundle gate (entry chunk carries zero palette bytes), plus added the chromium E2E spec covering SC1-4.

## What shipped

1. **ShellChrome palette mount** (`AppShell.tsx`):
   - `const [paletteOpen, setPaletteOpen] = useState(false);` sibling of `helpOpen`.
   - `usePaletteChord(() => setPaletteOpen(true));` — stable inline arrow, no memo/dep-array (the hook mounts its keydown listener once internally; render-loop landmine avoided).
   - `const CommandPalette = lazy(() => import("@/features/command-palette"));` at module scope, rendered as `{paletteOpen && (<Suspense fallback={null}><CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} /></Suspense>)}` next to the `<F1HelpDialog>` slot.
   - `lazy, Suspense` added to the existing `react` import.

2. **Chromium E2E spec** (`command-palette.spec.ts`, 3 tests, chromium project):
   - SC1: open via `Meta+k` AND via `F2` (two assertions); ESC closes without logout.
   - SC2/SC3: type "Borrowers" → row visible → ArrowDown+Enter → URL `/borrowers`; reopen → ESC pop → overlay gone, route intact.
   - SC4: seed a uniquely-named item via `page.request.post(/api/workspaces/{wsId}/items)` (cookie inherited), type its name → entity row → click → URL `/items/{id}`.

## Deviations from Plan

**1. [Rule 1/3 - lazy boundary defeated] Import `usePaletteChord` from its module, not the barrel**
- **Found during:** Task 2 (first `bun run build`).
- **Issue:** The plan's interface block specified `import { usePaletteChord } from "@/features/command-palette";`. That static barrel import re-exports the **default** `CommandPalette`, so rolldown emitted `INEFFECTIVE_DYNAMIC_IMPORT` and pulled the whole palette body graph (`recentActions`/`useEntitySearch`/`paletteRoutes`) into the entry chunk — the marker `hws-palette-recent` appeared in `index-*.js`, defeating the lazy split and the POL-04 gate.
- **Fix:** Changed the static import to the specific module path `@/features/command-palette/usePaletteChord` (which imports only React + tinykeys). The dynamic `import("@/features/command-palette")` still goes through the barrel default for the lazy body. Within the 2-file scope (AppShell.tsx only).
- **Files modified:** `frontend2/src/components/layout/AppShell.tsx`
- **Commit:** c1533305
- After the fix: no `INEFFECTIVE_DYNAMIC_IMPORT` warning; the palette body splits into its own `command-palette-*.js`; entry is palette-body-free.

No `vite.config.ts` / `package.json` / routes / command-palette-module edits — only the 2 files in `files_modified`. `bun install --frozen-lockfile` ran first; no packages installed (T-16-SC honored).

## POL-04 Bundle Gate Evidence (T-16-06 mitigation)

After `bun run build` (clean, no `INEFFECTIVE_DYNAMIC_IMPORT`):

| Marker | Holding chunk | In entry `index-d2Rq957v.js`? |
|--------|---------------|-------------------------------|
| `cmdk` | `palette-D7m0s8l1.js` (44.15 kB / 15.23 kB gz) | **NO — PASS** |
| radix-dialog runtime (`DismissableLayer`/`FocusScope`/`data-radix`) | `palette-D7m0s8l1.js` | **NO — PASS** |
| palette body (`hws-palette-recent`, route table) | `command-palette-D51P-c9R.js` (6.92 kB / 2.44 kB gz) | **NO — PASS** |

- Entry `index-*.js`: **729.67 kB raw / 197,073 bytes (≈197 kB) gzip** — cmdk-free, radix-free, palette-body-free.
- Entry-chunk before/after the barrel-path fix: **736.32 kB / 200.12 kB gz (leaking)** → **729.67 kB / 198.57 kB gz (clean)** — the entry SHRANK ~6.6 kB raw / ~1.5 kB gz once the palette body moved out. The always-loaded entry carries ZERO palette bytes; cmdk + radix download only on first palette open.

## E2E Coverage Map (SC1-4)

| SC | Test | Asserts |
|----|------|---------|
| SC1 | opens via ⌘K/Ctrl+K AND via F2 | `Meta+k` shows `data-testid=command-palette`; ESC hides + stays on `/`; `F2` shows it too |
| SC2 | filters routes | type "Borrowers" → matching row visible |
| SC3 | Arrow+Enter / ESC | ArrowDown+Enter → URL `/borrowers`; reopen → ESC → overlay hidden, route intact |
| SC4 | entity-search → navigate | seed unique item → type name → entity row → click → URL `/items/{id}` |

Discovered by `bunx playwright test --list e2e/command-palette.spec.ts --project=chromium` (3 tests). Live green run is the phase gate (orchestrator runs it on the merged tree with the dev stack up per CLAUDE.md); per instruction the live run was NOT executed here.

## Verification Gate (all green, run from `.wt/16-03/frontend2`)

- `bun run lint:tsc` — exit 0 (lazy import resolves the 16-02 default export + usePaletteChord)
- `bun run test` — 1141 passed (177 files)
- `bun run build` — `✓ built`, no INEFFECTIVE_DYNAMIC_IMPORT
- `bun run lint:imports` — OK
- `bun run lint:i18n` — OK (1016 msgids, en/et/ru parity; no new untranslated msgids — no new Lingui strings added)
- POL-04 bundle gate — all three entry-chunk assertions PASS (table above)

## Threat surface

T-16-06 (DoS / palette bytes in entry) — mitigated and PROVEN by the build gate. T-16-07 (unauth palette surface) — the mount lives in `ShellChrome`, rendered only under the authenticated WorkspaceProvider/SSEProvider subtree, so there is no unauth palette. T-16-SC — no packages installed.

## Commits

- ce043268 `feat(16-03): mount lazy CommandPalette + chord owner in ShellChrome`
- c1533305 `fix(16-03): import usePaletteChord from its module to fix lazy split (POL-04)`
- 5b209493 `test(16-03): chromium E2E for the command palette (SC1-4)`

## Self-Check: PASSED

- `frontend2/src/components/layout/AppShell.tsx` — FOUND (modified)
- `frontend2/e2e/command-palette.spec.ts` — FOUND (created)
- Commits ce043268 / c1533305 / 5b209493 — FOUND in git log
