# Phase 16 — Command Palette — VALIDATION

Maps TUI-05 Success Criteria → observable proof. Gate is GREEN only when every row passes.

## Success-criteria proofs

| # | Criterion | Proof (automated) | Proof (live) |
|---|-----------|-------------------|--------------|
| SC1 | Cmd+K / Ctrl+K / F2 opens a cmdk palette with full-screen retro-panel chrome | Unit: tinykeys handler test fires `$mod+k` + `F2` → `setPaletteOpen(true)`; palette renders cmdk `Command` + retro chrome (testid). | E2E: press `Meta+k` (and `F2`) on `/` → palette dialog visible. |
| SC2 | Typing fuzzy-filters across routes + recent actions + workspaces | Unit: type "item" → Items route row visible, unrelated rows hidden; workspaces group filters; recent group filters. | E2E: type a route name → matching row highlighted/selectable. |
| SC3 | Arrow navigate, Enter select, ESC dismiss; tinykeys opens, cmdk filters | Unit: ArrowDown moves cmdk selection; Enter on a route row calls `navigate(to)` + closes; ESC pops via modal stack (palette closes, underlying route intact). | E2E: open → ArrowDown → Enter navigates; open → ESC closes. |
| SC4 (parity §4) | Global entity search folded into palette (items/borrowers/locations/containers), debounced, live | Unit: typing ≥2 chars fires debounced `itemsApi.list({search})` / `borrowersApi.search` / `locationApi.search` / `containerApi.search` (MSW); grouped results render; Enter on entity row navigates to its detail route + records MRU. | E2E: seed an item, open palette, type its name → entity result row appears → Enter → lands on `/items/{id}`. |

## Acceptance gate (must all be GREEN)
- `cd frontend2 && bun run lint:tsc` (project-references typecheck — NOT bare tsc) ✅
- `cd frontend2 && bun run test` (full vitest suite green; current baseline 1120 + new palette tests) ✅
- `cd frontend2 && bun run build` ✅
- `cd frontend2 && bun run lint:imports` (FOUND-02 — palette/cmdk/tinykeys/recent names are SAFE; no `sync`/`idb`/`offline` substrings) ✅
- `cd frontend2 && bun run lint:i18n` (Phase 15 catalog guard — every NEW `<Trans>`/`t` msgid filled in et + ru; run `bun run i18n:extract` then translate before gate) ✅
- `cd frontend2 && bun run lint:i18n:format` (no raw Date/Number locale calls — palette renders no dates/numbers, should be trivially clean) ✅
- **Bundle gate (POL-04):** after `bun run build`, `cmdk`/`command-score` appear ONLY in `palette-*.js`; entry `index-*.js` contains NO cmdk (grep dist like 13b bundle gate). ✅
- Live E2E: `E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e e2e/command-palette.spec.ts` (chromium; 20/min auth limiter — restart backend if mass auth-fail). ✅
- `gsd-verifier` (sonnet) goal-backward PASS on TUI-05.

## Backend
None — frontend-only phase. No Go build/test, no restart.

## Render-loop guard (recurring 4× bug)
- tinykeys listener in `useEffect(…, [])` mounted ONCE; toggles via stable `setPaletteOpen`.
- cmdk controlled `value`/`onValueChange` + debounced query state must NOT put fresh fns/objects in deps.
- `useModalStack(open, onClose)` already ref-stabilizes onClose — pass it directly.

## Residues likely (→ v3.0-FINAL-REVIEW-CHECKLIST)
- Live visual fidelity of full-screen retro-panel chrome vs sketch 006-008 (browser-UAT; E2E asserts presence not pixels).
- Cross-workspace switch via palette (needs ≥2 workspaces seeded — human-UAT).
- et/ru translation quality of new palette strings (machine-translated).
