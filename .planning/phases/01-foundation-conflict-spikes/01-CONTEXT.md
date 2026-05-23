# Phase 1: Foundation + Conflict Spikes - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers two things in parallel:

1. **Working scaffold** — fresh Vite + React 19 + TS + Tailwind 4 + RR7 + TanStack Query SPA at `localhost:5173` with API proxy to `:8080`, CI online-only guard, and a CARRY-FORWARD.md audit document.

2. **Three locked conflict resolutions** — empirical i18n library decision, mobile FAB scope decision, and dashboard HUD rollups decision — that unblock all subsequent phases.

Phase 1 does NOT include premium-terminal tokens (Phase 2), layout primitives or Bottombar (Phase 3), or any feature surfaces. The scaffold output is a placeholder shell only.

</domain>

<decisions>
## Implementation Decisions

### i18n Spike Methodology

- **D-01:** Run a **three-part empirical test**: (1) compile under Vite 8 + SWC, (2) message extraction via CLI, (3) translated strings render at runtime. Both candidates must pass all three parts to be considered viable.
- **D-02:** Test is **two-way only** — Lingui v6 + `@lingui/swc-plugin` vs react-intl + `babel-plugin-formatjs`. Native Intl API is not a candidate (lacks extraction tooling, no compile-time key safety; project has an existing et/ru catalog).
- **D-03:** **Tiebreaker: prefer Lingui v6.** If both candidates pass all three checks, Lingui v6 wins (v2.0 precedent, existing catalog files, `@lingui/swc-plugin` is the intended SWC path). Result is locked in `.planning/research/I18N-DECISION.md`.
- **D-04:** The spike runs inside a throwaway branch or temp directory, not inside the main scaffold. Winner gets installed in the scaffold as part of the same plan.

### Mobile FAB Scope (FOUND-05 resolution)

- **D-05:** **Mobile (<768px): FAB only, no Bottombar.** The context-aware radial menu FAB replaces the Bottombar entirely on mobile viewports. The Bottombar is hidden at `<768px`.
- **D-06:** **Desktop/web (≥768px): Bottombar only, no FAB.** The function-key Bottombar is the sole shortcut surface on desktop. The FAB is hidden at `≥768px`.
- **D-07:** Mobile FAB exposes a **context-aware radial menu** (same pattern as v2.1) — actions adapt per route (scan, add item, log loan). This is not a single-action button.
- **D-08:** This decision locks the BAR phase (Phase 3) scope: Bottombar renders only at `≥768px`; FAB renders only at `<768px`. Both use the `useShortcuts` context as the single source of truth for actions.

### Dashboard Backend Rollups (FOUND-06 resolution)

- **D-09:** **HUD row ships in Phase 13 without a feature flag.** There is no production environment, so feature flags are unnecessary overhead. DASH-04 stays in scope; the HUD row (capacity gauge + 14-day activity sparkline) renders in Phase 13.
- **D-10:** **Backend endpoint specs are documented in Phase 1.** CARRY-FORWARD.md (or a companion doc) specifies what the two new backend endpoints must return so Phase 13 planning can scope them. The endpoints themselves are built as part of Phase 13 or an adjacent backend task.
- **D-11:** Proposed endpoint specs (to be refined):
  - `GET /api/workspaces/{wsId}/stats/capacity` → `{ total_items: number, capacity_target: number | null }`
  - `GET /api/workspaces/{wsId}/stats/activity?days=14` → `{ days: Array<{ date: string, count: number }> }`

### Claude's Discretion

- Scaffold file structure within `frontend2/` (entry point, router setup, query client config) — standard Vite + RR7 library-mode conventions apply.
- CARRY-FORWARD.md format and organization — the required items (port verbatim: auth flow, OAuth callback, format hooks, Playwright auth helper, grep guard; rebuild: chrome, atoms, layout, providers) are specified in FOUND-03; layout of the document is discretionary.
- CI script implementation details for `check-forbidden-imports.mjs` — port from existing implementation if one exists, otherwise write fresh.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope + Requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, dependencies, phase overview
- `.planning/REQUIREMENTS.md` — Full FOUND-01..06 requirements with acceptance criteria

### Design System
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — Locked premium-terminal design decisions from sketches 001–005 (palette, typography, icons, components, navigation)
- `.claude/skills/sketch-findings-home-warehouse-system/sources/themes/default.css` — Locked color token definitions (`--bg-*`, `--fg-*`, `--amber`, `--accent-*`, `--border-*`)

### v3.0 Research
- `.planning/research/SUMMARY.md` — v3.0 research synthesis: stack decisions, architecture constraints, pitfalls to avoid
- `.planning/research/STACK.md` — Stack decisions for v3.0 (Vite 8 + SWC, Bun, RR7 library mode, TanStack Query 5)

### Predecessor Reference (read-only archaeology)
- `.planning/milestones/v2.1-phases/` — v2.1 shipped phases; use for porting verbatim items (auth flow, format hooks, Playwright helper)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (port verbatim from `/frontend` or v2.1 archives)
- Auth flow (`lib/api.ts` cookie-JWT with single-flighted 401 refresh) — port as-is
- OAuth callback handler — port as-is
- Format hooks (`useDateFormat`, `useTimeFormat`, `useNumberFormat`) — port as-is
- Playwright auth helper — port as-is
- `scripts/check-forbidden-imports.mjs` (or equivalent grep guard) — port as-is

### Established Patterns
- **Bun** is the package manager — all install/run commands use `bun`
- **Vite 8 + SWC** — the stack is confirmed; no Babel, no esbuild-only mode
- **RR7 library mode** — not framework mode; no file-based routing
- **frontend2 is wiped** — no existing code to preserve; pure green-field

### Integration Points
- API proxy: Vite dev server proxies `/api` → `:8080` (backend Go server)
- CI: forbidden-imports check runs in lint pipeline (GitHub Actions or equivalent)

</code_context>

<specifics>
## Specific Ideas

- i18n spike: test `@lingui/swc-plugin` (Rust SWC plugin) vs `babel-plugin-formatjs` (which requires Babel in a Vite/SWC project via `vite-plugin-babel`). The compat question is specifically whether SWC can handle the transform without falling back to Babel.
- FAB radial menu actions by route: `/items` → scan + add item; `/loans` → log loan; `/scan` → FAB hidden (already on scan page); default → scan + add item.
- HUD sparkline: hand-rolled SVG per DASH-04 (no charting library in Phase 1 scope — confirmed by REQUIREMENTS.md).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation-conflict-spikes*
*Context gathered: 2026-05-01*
