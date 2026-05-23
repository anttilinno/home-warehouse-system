# Phase 1: Foundation + Conflict Spikes — Research

**Researched:** 2026-05-01
**Domain:** Vite 8 + React 19 + Tailwind 4 + RR7 (library mode) + TanStack Query 5 SPA scaffold; CI online-only grep guard; three Phase 0 conflict-resolution spikes (i18n / mobile FAB / dashboard rollups)
**Confidence:** HIGH on scaffold mechanics + grep guard + carry-forward enumeration; MEDIUM on Lingui v6 + Vite 8 SWC pipeline empirical compat (must be empirically tested, not assumed); MEDIUM on Tailwind v4 + Vite 8 plugin edge cases.

## Summary

Phase 1 produces a working Vite + React 19 + TS + Tailwind 4 + RR7 (library mode) + TanStack Query 5 scaffold under `frontend2/` (currently empty), wires `bun run dev` → `localhost:5173` with `/api` proxied to `:8080`, ports the existing `scripts/check-forbidden-imports.mjs` grep guard into a CI step, runs the three-part empirical i18n spike (Lingui v6 vs react-intl) in a throwaway branch and locks the result in `.planning/research/I18N-DECISION.md`, and writes `.planning/research/CARRY-FORWARD.md` enumerating port-verbatim items vs rebuild items. The mobile-FAB scope decision (D-05..D-08, FAB-only on `<768px`, Bottombar-only on `≥768px`) and the dashboard HUD rollup decision (D-09..D-11, ship without flag, document endpoint specs) are recorded in v3.0 milestone scope per CONTEXT.md.

Every dependency version in the recommended stack was verified against the npm registry on 2026-05-01 — see `## Standard Stack` for the exact pins. The grep guard at `scripts/check-forbidden-imports.mjs` already exists and works (verified by reading source); the only Phase 1 work on it is wiring it into a GitHub Actions workflow (or the project's chosen CI surface) and confirming the `frontend2/src` scan path resolves on a fresh checkout.

**Primary recommendation:** Scaffold with `bun create vite frontend2 --template react-swc-ts` then layer the v3.0-prescribed deps (per `STACK.md`), keep the i18n spike strictly in a throwaway branch (do NOT contaminate the main scaffold during the empirical test), and follow the locked decisions D-01..D-11 from CONTEXT.md verbatim — Phase 1 is high-discipline plumbing, not architectural exploration. The three discretionary surfaces are (1) scaffold internal file layout within `frontend2/`, (2) CARRY-FORWARD.md document layout, and (3) CI grep-guard wiring details.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### i18n Spike Methodology

- **D-01:** Run a **three-part empirical test**: (1) compile under Vite 8 + SWC, (2) message extraction via CLI, (3) translated strings render at runtime. Both candidates must pass all three parts to be considered viable.
- **D-02:** Test is **two-way only** — Lingui v6 + `@lingui/swc-plugin` vs react-intl + `babel-plugin-formatjs`. Native Intl API is not a candidate (lacks extraction tooling, no compile-time key safety; project has an existing et/ru catalog).
- **D-03:** **Tiebreaker: prefer Lingui v6.** If both candidates pass all three checks, Lingui v6 wins (v2.0 precedent, existing catalog files, `@lingui/swc-plugin` is the intended SWC path). Result is locked in `.planning/research/I18N-DECISION.md`.
- **D-04:** The spike runs inside a throwaway branch or temp directory, not inside the main scaffold. Winner gets installed in the scaffold as part of the same plan.

#### Mobile FAB Scope (FOUND-05 resolution)

- **D-05:** **Mobile (<768px): FAB only, no Bottombar.** The context-aware radial menu FAB replaces the Bottombar entirely on mobile viewports. The Bottombar is hidden at `<768px`.
- **D-06:** **Desktop/web (≥768px): Bottombar only, no FAB.** The function-key Bottombar is the sole shortcut surface on desktop. The FAB is hidden at `≥768px`.
- **D-07:** Mobile FAB exposes a **context-aware radial menu** (same pattern as v2.1) — actions adapt per route (scan, add item, log loan). This is not a single-action button.
- **D-08:** This decision locks the BAR phase (Phase 3) scope: Bottombar renders only at `≥768px`; FAB renders only at `<768px`. Both use the `useShortcuts` context as the single source of truth for actions.

#### Dashboard Backend Rollups (FOUND-06 resolution)

- **D-09:** **HUD row ships in Phase 13 without a feature flag.** There is no production environment, so feature flags are unnecessary overhead. DASH-04 stays in scope; the HUD row (capacity gauge + 14-day activity sparkline) renders in Phase 13.
- **D-10:** **Backend endpoint specs are documented in Phase 1.** CARRY-FORWARD.md (or a companion doc) specifies what the two new backend endpoints must return so Phase 13 planning can scope them. The endpoints themselves are built as part of Phase 13 or an adjacent backend task.
- **D-11:** Proposed endpoint specs (to be refined):
  - `GET /api/workspaces/{wsId}/stats/capacity` → `{ total_items: number, capacity_target: number | null }`
  - `GET /api/workspaces/{wsId}/stats/activity?days=14` → `{ days: Array<{ date: string, count: number }> }`

### Claude's Discretion

- Scaffold file structure within `frontend2/` (entry point, router setup, query client config) — standard Vite + RR7 library-mode conventions apply.
- CARRY-FORWARD.md format and organization — the required items (port verbatim: auth flow, OAuth callback, format hooks, Playwright auth helper, grep guard; rebuild: chrome, atoms, layout, providers) are specified in FOUND-03; layout of the document is discretionary.
- CI script implementation details for `check-forbidden-imports.mjs` — port from existing implementation if one exists, otherwise write fresh. **(Existing implementation found at `scripts/check-forbidden-imports.mjs` — confirmed working. Phase 1 wires it into CI; no rewrite needed.)**

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | User-facing scaffold — fresh Vite + React 19 + TS 5.9 + Tailwind CSS 4 + RR7 library mode + TanStack Query 5 + react-hook-form 7 + zod 4 boots from a blank `/frontend2` and serves a placeholder shell at `localhost:5173`. | `## Standard Stack` (verified versions), `## Architecture Patterns → Pattern 1: Scaffold init flow`, `## Code Examples → Vite config`, `## Code Examples → Provider stack skeleton` |
| FOUND-02 | CI-enforced online-only constraint — `scripts/check-forbidden-imports.mjs` blocks any new import of `idb`, `serwist`, `offline`, or `sync*` and runs in the lint pipeline. | `## Architecture Patterns → Pattern 4: CI grep guard wiring`, `## Code Examples → GitHub Actions workflow` |
| FOUND-03 | Carry-forward audit document at `.planning/research/CARRY-FORWARD.md` enumerates port-verbatim vs rebuild items. | `## Architecture Patterns → Pattern 5: CARRY-FORWARD.md structure`, `## Existing Code Insights` (port-verbatim sources identified) |
| FOUND-04 | i18n library decision (Conflict 1) resolved by Phase 0 spike — empirical Vite-8-+-SWC compat test on Lingui v6 vs react-intl, locked decision documented in `.planning/research/I18N-DECISION.md`. | `## Architecture Patterns → Pattern 2: i18n empirical spike protocol`, `## Code Examples → Lingui v6 + SWC config`, `## Code Examples → react-intl + Babel config`, `## Common Pitfalls → Pitfall 2 (Lingui v5 → v6 catalog migration)` |
| FOUND-05 | Mobile FAB scope (Conflict 2) explicitly resolved in v3.0 milestone scope. | Locked by D-05..D-08 (CONTEXT.md). Phase 1 records this in v3.0 milestone scope; no further research needed. |
| FOUND-06 | Dashboard backend rollups (Conflict 3) decision recorded; backend coordination kicked off if shipping. | Locked by D-09..D-11 (CONTEXT.md). Phase 1 documents endpoint specs per D-11; Phase 13 builds endpoints. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`/home/antti/CLAUDE.md` describes the **ROT-MUD** project (a different project on this user's machine) — those constraints (Go server, TOML data, Lua VM) DO NOT apply to home-warehouse-system. The project-root `CLAUDE.md` at `/home/antti/Repos/Misc/home-warehouse-system/CLAUDE.md` is authoritative for THIS project. Extracted directives:

- **Bun + Vite stack** — frontend2 dev server is `bun run dev` (Vite serves on **5173** with `/api` proxied to `:8080`). Backend Go server listens on **8080**. `warehouse_dev` Postgres on `localhost:5432`. Phase 1 scaffold MUST preserve this proxy contract because Playwright `baseURL` and the existing E2E auth contract both assume it.
- **Playwright E2E pattern** — `frontend2/e2e/*.spec.ts`, two projects (`chromium` + `firefox`), no `webServer` config (expects dev stack running). `baseURL` defaults to `http://localhost:5173`. Auth contract: `/login` → fill `email` + `password` labels → click submit-type button matching `^LOG IN$` (exact). Cookies (access_token) inherited by both `page` and `page.request`. **Carry forward verbatim** — auth helper is the contract, Phase 1 must not reinvent.
- **Backend Go integration test pattern** — `-tags=integration`, `TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test`, harness at `backend/tests/testdb`. Phase 1 doesn't add new Go code, but the pattern is referenced in CARRY-FORWARD.md as the test-substrate v3.0 inherits.
- **Auto-loaded skill** — `Skill("sketch-findings-home-warehouse-system")`. Phase 1 doesn't render UI beyond a placeholder shell, so the design-token work is Phase 2's domain. The skill is referenced for context only.
- **GSD Workflow Enforcement** — file-changing tools must go through a GSD command. Phase 1 plan and execute happen via `/gsd-execute-phase` (this research output is consumed by the planner).

## Architectural Responsibility Map

Phase 1 capabilities map to architectural tiers as follows:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vite scaffold + dev server | Browser / Client (build tooling) | — | Vite is a browser-first SPA bundler; no SSR or backend integration. |
| `/api` proxy to `:8080` | Browser / Client (Vite dev server) | API / Backend | Dev-time proxy is a browser-tier configuration; backend (Go) serves the proxied target unchanged. |
| Provider stack skeleton (App.tsx) | Browser / Client | — | Pure React Provider mounting; runs entirely in the browser. |
| TanStack Query client | Browser / Client | API / Backend | Cache lives in the browser; queries hit the API tier via `/api` proxy. |
| RR7 library-mode router | Browser / Client | — | SPA client-side routing. No SSR. |
| Tailwind v4 + `@theme` build | Browser / Client (build tooling) | — | CSS compiled at build time, served as static asset. |
| `scripts/check-forbidden-imports.mjs` CI guard | CI / Static (lint pipeline) | — | Runs in GitHub Actions (or equivalent), not in the running app. |
| Vite proxy config | Browser / Client (Vite dev server) | — | Dev-only; production deploy uses a reverse proxy (Nginx/Caddy) that's out of v3.0 scope per online-only constraint. |
| i18n spike (compile / extract / runtime) | Browser / Client (build tooling + runtime) | — | All three test phases run in the SPA build pipeline + browser runtime. |
| CARRY-FORWARD.md / I18N-DECISION.md | CI / Static (planning docs) | — | Markdown artifacts, not runtime code. |

**Why this matters:** Phase 1 has zero backend or DB work. If a plan task accidentally proposes a backend change (e.g., "add `/api/health` endpoint"), it's mis-tiered — defer to Phase 13 (or backend coordination per D-10/D-11). The HUD endpoints (D-11) are deferred to Phase 13 per the locked decision.

## Standard Stack

All versions verified against the npm registry on 2026-05-01.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | `^8.0.10` | Build + dev server | Predecessor v2.1 baseline; HMR sub-50ms; SWC + Tailwind v4 + Lingui SWC plugin all run cleanly. `[VERIFIED: npm view vite version → 8.0.10]` |
| `@vitejs/plugin-react-swc` | `^4.3.0` | React + SWC | Required for Lingui SWC plugin compatibility (same compile pass). `[VERIFIED: npm view @vitejs/plugin-react-swc version → 4.3.0]` |
| `react` | `^19.2.5` | View library | Predecessor stack. `[VERIFIED: npm view react version → 19.2.5]` |
| `react-dom` | `^19.2.5` | DOM renderer | Pairs with React. `[VERIFIED]` |
| `react-router` | `^7.14.2` (library mode) | SPA routing | Library mode (declarative `<Routes>`), not framework mode. `[VERIFIED: npm view react-router version → 7.14.2]` |
| `typescript` | `^5.9.5` | Type system | STACK.md prescribes 5.9.5 for `verbatimModuleSyntax` + `using` keyword. **NOTE:** registry latest is `6.0.3` as of 2026-05-01 (`[VERIFIED: npm view typescript dist-tags → latest: 6.0.3]`); TS 6.0 is brand-new and the spike branch should NOT be the place to debut a major TS version. Pin `5.9.5` for Phase 1; revisit TS 6 in a later phase under its own spike. |
| `tailwindcss` | `^4.2.4` | Utility CSS | v4's `@theme` block + CSS-variable-first design is a perfect fit for the locked design tokens (Phase 2). `[VERIFIED: npm view tailwindcss version → 4.2.4]` |
| `@tailwindcss/vite` | `^4.2.4` | Tailwind Vite integration | Replaces `@tailwindcss/postcss` for Vite. `[VERIFIED]` |
| `bun` | `^1.3.13` | Package manager + script runner | Predecessor uses `bun install` + `bun run dev`. Vite drives dev/build, not Bun's bundler. `[CITED: STACK.md]` |

### Data, Forms, State

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | `^5.100.7` | Server state + caching | Predecessor stack; the only persistence layer (CI grep guard enforces this). `[VERIFIED: npm view @tanstack/react-query version → 5.100.7]` |
| `@tanstack/react-query-devtools` | `^5.100.7` | Query inspector (dev) | Tree-shaken from prod bundle via `import.meta.env.DEV`. `[VERIFIED]` |
| `react-hook-form` | `^7.74.0` | Form state | RHF + zod is the v2.1 form contract. `[VERIFIED: npm view react-hook-form version → 7.74.0]` |
| `@hookform/resolvers` | `^5.2.2` | RHF ↔ zod bridge | Resolvers v5 targets zod v4. `[VERIFIED]` |
| `zod` | `^4.4.1` | Schema validation | zod v4 differs non-trivially from v3; v2.1 already migrated. `[VERIFIED]` |

### i18n (decision pending Phase 1 spike — D-04)

**Both candidates installed in spike branches; only the winner goes into the scaffold.**

| Candidate A: Lingui v6 | Version | Verified |
|------------------------|---------|----------|
| `@lingui/core` | `^6.0.1` | `[VERIFIED: npm view @lingui/core version → 6.0.1]` |
| `@lingui/react` | `^6.0.1` | `[VERIFIED]` |
| `@lingui/cli` (dev) | `^6.0.1` | `[VERIFIED]` |
| `@lingui/swc-plugin` (dev) | `^6.0.0` | `[VERIFIED: peerDeps `@lingui/core: 5 || 6`]` |
| `@lingui/vite-plugin` (dev) | `^6.0.1` | `[VERIFIED]` |

| Candidate B: react-intl | Version | Verified |
|-------------------------|---------|----------|
| `react-intl` | `^6.0.3` | `[VERIFIED: npm view react-intl version → 6.0.3, peerDeps react: 19]`. Note: STACK.md says ~30KB gzip; ARCHITECTURE.md says ~30KB gzip — verify actual with `vite build --report` during spike. |
| `@formatjs/cli` (dev) | `^7.x` | `[VERIFIED: published latest 7.x line]` — for extraction |
| `babel-plugin-formatjs` (dev, ONLY for spike) | latest | `[ASSUMED]` — not yet verified registry version. The spike will install this only as a one-off; the winner of the spike likely won't drag Babel forward into the scaffold. |
| `vite-plugin-babel` (dev, ONLY for spike) | `^1.6.0` | `[VERIFIED: npm view vite-plugin-babel version → 1.6.0]`. Required only for the react-intl + Babel macro path; loses if Lingui SWC compat works. |

**Locked tiebreaker (D-03):** Lingui v6 wins on tie. Both must clear all three test parts (compile / extract / runtime).

### UI Building Blocks (NOT Phase 1 scope — listed for forward compat)

These ship in Phase 2-6, not Phase 1. Listed here so the planner does not accidentally pull them into Phase 1.

| Library | Version | Phase |
|---------|---------|-------|
| `@floating-ui/react` | `^0.27.19` | Phase 4 (atoms) |
| `lucide-react` | `^1.14.0` | Phase 3 |
| `sonner` | `^2.0.7` | Phase 6 (providers) |
| `cmdk` | `^1.1.1` | Phase 16 (command palette) |
| `tinykeys` | `^3.0.0` | Phase 3 (Bottombar / FAB) |
| `@fontsource-variable/jetbrains-mono` | `^5.2.8` | Phase 2 (typography) |

### Testing (Phase 1 includes scaffold for these; first specs in Phase 4-5)

| Library | Version | Purpose |
|---------|---------|---------|
| `vitest` | `^4.1.5` | Unit + component tests `[VERIFIED]` |
| `@testing-library/react` | `^16.3.2` | RTL v16 supports React 19 |
| `@testing-library/jest-dom` | latest | Matchers |
| `@testing-library/user-event` | latest | Simulated user input |
| `@playwright/test` | `^1.59.1` | E2E (carry forward Phase 65 Plan 65-11 pattern from CLAUDE.md) `[VERIFIED]` |
| `msw` | `^2.14.2` | Network mocking for unit tests (NEW in v3.0) |
| `rollup-plugin-visualizer` | latest (dev) | Bundle inspection — required for Phase 1 acceptance check that scanner WASM gets manual-chunked in later phases (forward-compat) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RR7 library mode | RR7 framework mode | Framework mode revalidates per nav, conflicts with TanStack Query, forces Vite plugin re-architecture, brings SSR machinery this app does not need. **Locked: library mode.** (See `## Anti-Patterns to Avoid → AP-1`.) |
| Vite + RR7 | TanStack Start (Router + Start) | Co-located server functions; we don't have any (backend is Go). RR7 simpler. |
| Vite + RR7 | Next.js 16 App Router | SSR/RSC unneeded; would undo "frontend2 is separate UI track" decision. |
| Lingui v6 | react-intl | The Phase 1 spike (D-01..D-04) is the empirical answer. Tiebreaker: Lingui v6. |
| Lingui v6 | Native `Intl.MessageFormat` | TC39 stage 2 in early 2026 — too early; Safari support behind flag. **Excluded by D-02.** |
| Lingui v6 | next-intl | Next.js-coupled APIs do not run on Vite SPA. **Excluded by D-02.** |
| `@vitejs/plugin-react-swc` | `@vitejs/plugin-react` (Babel) | Babel works but Lingui's SWC plugin is the official path; mixing toolchains adds compile-pass complexity. |
| Vitest | Jest | Jest doesn't share Vite's compile pipeline; Vitest reuses `vite.config.ts`. |
| TS 5.9.5 | TS 6.0.3 (current registry latest) | TS 6 just shipped (May 2026); STACK.md prescribed 5.9.5; Phase 1 should not debut a brand-new TS major. Defer TS 6 to a later spike. |

**Installation (after winning i18n candidate is locked):**

```bash
# Initial scaffold (cwd: repo root)
bun create vite frontend2 --template react-swc-ts
cd frontend2

# Core
bun add react@^19.2.5 react-dom@^19.2.5 react-router@^7.14.2

# Styling
bun add tailwindcss@^4.2.4 @tailwindcss/vite@^4.2.4

# Data, forms, state
bun add @tanstack/react-query@^5.100.7
bun add react-hook-form@^7.74.0 @hookform/resolvers@^5.2.2 zod@^4.4.1

# i18n: install ONLY the winner of the spike (D-04). Examples:
#   if Lingui:   bun add @lingui/core@^6.0.1 @lingui/react@^6.0.1
#                bun add -d @lingui/cli@^6.0.1 @lingui/vite-plugin@^6.0.1 @lingui/swc-plugin@^6.0.0
#   if react-intl: bun add react-intl@^6.0.3
#                  bun add -d @formatjs/cli@^7

# Testing scaffolding (Phase 1 installs; Phase 4+ uses)
bun add -d @vitejs/plugin-react-swc@^4.3.0
bun add -d typescript@^5.9.5
bun add -d vitest@^4.1.5 @testing-library/react@^16.3.2 @testing-library/jest-dom @testing-library/user-event
bun add -d @playwright/test@^1.59.1
bun add -d msw@^2.14.2
bun add -d @tanstack/react-query-devtools@^5.100.7
bun add -d rollup-plugin-visualizer
```

**Version verification protocol:** Before committing any package.json, the planner's tasks should re-run `npm view <pkg> version` to confirm no version moved between research date (2026-05-01) and execution date. Pin exact `^X.Y.Z` versions; do not use `latest`.

## Architecture Patterns

### System Architecture Diagram

Phase 1 produces ONLY this scaffold layer; feature modules and chrome are downstream phases.

```
[ Developer runs `bun run dev` ]
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│ Vite 8 dev server on :5173                              │
│  ┌────────────────────────────────────────────────┐    │
│  │ vite.config.ts                                 │    │
│  │  - @vitejs/plugin-react-swc                    │    │
│  │  - @tailwindcss/vite                           │    │
│  │  - (Lingui plugin OR no plugin) ← spike winner │    │
│  │  - server.proxy: { "/api": "http://:8080" }    │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  Compiles src/main.tsx → src/App.tsx                   │
└──────────────────────┬──────────────────────────────────┘
                       │ /api/* requests
                       ▼
       ┌──────────────────────────────────┐
       │ Backend Go server on :8080       │
       │ (UNCHANGED in Phase 1)           │
       └──────────────────────────────────┘

[ Developer pushes PR ]
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│ CI lint pipeline (GitHub Actions or equivalent)         │
│  ┌────────────────────────────────────────────────┐    │
│  │ node scripts/check-forbidden-imports.mjs       │    │
│  │  - walks frontend2/src/**/*.{ts,tsx,js,jsx}    │    │
│  │  - rejects: idb, serwist, @serwist/*,          │    │
│  │             /offline/i, /sync/i specifiers     │    │
│  │  - exit 1 on first offender                    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 1 only — minimal scaffold)

```
frontend2/                              # currently empty (verified)
├── public/                             # static assets (kept tiny in Phase 1)
├── src/
│   ├── main.tsx                        # ReactDOM.createRoot + <App />
│   ├── App.tsx                         # provider stack: QueryClientProvider + BrowserRouter + RootRoute
│   ├── routes/
│   │   └── index.tsx                   # placeholder <Route index element={<PlaceholderPage />} />
│   ├── lib/
│   │   ├── queryClient.ts              # singleton QueryClient with staleTime defaults
│   │   └── api.ts                      # PORT VERBATIM from frontend2 v2.1 archive (fetch + 401 single-flight refresh + HttpError + postMultipart)
│   └── styles/
│       └── globals.css                 # @import "tailwindcss"; minimal body resets only (Phase 2 fills in tokens)
├── vite.config.ts                      # see ## Code Examples
├── tsconfig.json                       # strict + verbatimModuleSyntax
├── tsconfig.node.json                  # for vite.config.ts
├── package.json                        # deps + scripts (dev/build/test/test:e2e/lint:imports)
├── index.html                          # entry HTML
├── .gitignore                          # node_modules, dist, test-results, playwright-report, .env*
└── e2e/                                # Playwright test directory (empty in Phase 1; specs land Phase 4+)

scripts/                                # repo root, EXISTING
├── check-forbidden-imports.mjs         # PORT VERBATIM (already exists; verified working)
└── __tests__/
    ├── check-forbidden-imports.test.mjs
    └── fixtures/

.planning/research/                     # repo root, EXISTING
├── CARRY-FORWARD.md                    # NEW — written by Phase 1
└── I18N-DECISION.md                    # NEW — written by Phase 1 (after spike)

.github/workflows/                      # NEW directory if absent
└── lint-frontend2.yml                  # NEW — wires check-forbidden-imports.mjs + tsc --noEmit
```

### Pattern 1: Scaffold Init Flow

**What:** Use Vite's official `react-swc-ts` template as the seed; layer v3.0-prescribed deps and config on top. Do not hand-write the scaffold from scratch — the template gets `tsconfig`, `tsconfig.node.json`, `index.html`, `main.tsx`, and `vite.config.ts` close enough to correct that overriding is trivial.

**When to use:** Once, in the Phase 1 scaffold task.

**Sequence:**

1. `cd /home/antti/Repos/Misc/home-warehouse-system && bun create vite frontend2 --template react-swc-ts` (verify `frontend2/` is empty first)
2. Replace `vite.config.ts` with the v3.0 version (see `## Code Examples`)
3. Add Tailwind v4: `cd frontend2 && bun add tailwindcss@^4.2.4 @tailwindcss/vite@^4.2.4`
4. Add core deps (see `## Standard Stack → Installation`)
5. Replace `src/App.tsx` with the provider-stack skeleton (see `## Code Examples`)
6. Add `src/lib/queryClient.ts` and `src/lib/api.ts` (port verbatim from v2.1 archive — see `## Existing Code Insights`)
7. Add `bun run dev`, `bun run build`, `bun run test`, `bun run test:e2e`, `bun run lint:imports` to `package.json` scripts
8. Run `bun run dev` from `frontend2/` and verify localhost:5173 serves the placeholder shell
9. Run `bun run lint:imports` and verify it returns OK on the empty `src/`
10. Commit

**Source:** `[CITED: https://vite.dev/guide/ — official Vite scaffolding command]`, `[CITED: STACK.md ## Installation]`

### Pattern 2: i18n Empirical Spike Protocol (D-01..D-04)

**What:** Run a parallel three-part test on each of two candidates; gate scaffold installation on the empirical result.

**When to use:** Once, in a throwaway branch (e.g., `spike/i18n-decision`) created from the Phase 1 scaffold commit but NEVER merged. The winner gets installed cleanly in the main scaffold branch.

**Three test parts (D-01):**

| # | Test | Pass criterion |
|---|------|----------------|
| 1 | **Compile under Vite 8 + SWC** | `bun run build` exits 0; no Babel fallback; bundle includes the i18n runtime. |
| 2 | **Message extraction via CLI** | Run candidate's CLI (Lingui: `lingui extract`; FormatJS: `formatjs extract 'src/**/*.{ts,tsx}' --out-file en.json`); output catalog file contains the test message IDs. |
| 3 | **Translated strings render at runtime** | Browser smoke test: load page in `et` locale, confirm translated string appears in DOM (not the source key). |

**Test harness:** Three minimal source files per candidate exercising one `<Trans>` (Lingui) or one `<FormattedMessage>` (react-intl), one plural rule, and one interpolation. Same three messages on both candidates so results are comparable.

**Decision tree:**

```
                  ┌──────────────────────────┐
                  │ Both pass all 3 parts?   │
                  └──────────┬───────────────┘
                  YES        │       NO
        ┌────────────────────┴──────────────────────┐
        ▼                                            ▼
  Lingui wins (D-03 tiebreaker)         ┌──────────────────────┐
                                        │ Only one passed?     │
                                        └──────────┬───────────┘
                                       YES         │     NO
                          ┌─────────────────────────┴──────────────┐
                          ▼                                         ▼
                  That one wins.                      BLOCK Phase 1; escalate
                                                      (no viable i18n path).
```

**Output:** `.planning/research/I18N-DECISION.md` with:
- Date, branch SHA used for spike
- For each candidate: 3 evidence rows (compile log excerpt, extracted catalog excerpt, browser screenshot or DOM snapshot)
- Final verdict and rationale
- Bundle-size measurement for the winner (`vite build --report`)

**Source:** `[CITED: CONTEXT.md decisions D-01..D-04]`, `[CITED: STACK.md i18n section]`, `[CITED: ARCHITECTURE.md Pattern 8 i18n]`

### Pattern 3: Vite Dev-Server Proxy → Backend Go Server

**What:** `vite.config.ts` declares `server.proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true } }`. Browser fetches `/api/items` → Vite dev server forwards to `http://localhost:8080/api/items` → Go backend serves the response.

**When to use:** Always, in dev. Production deployment uses a reverse proxy (out of v3.0 scope).

**Why this exact shape:** The legacy `/frontend` (Next.js) ships a `proxy.ts` with the same contract. Playwright's `baseURL=http://localhost:5173` AND `page.request.post("/api/...")` patterns BOTH require this proxy to work. Any deviation (different port, different prefix) breaks the existing E2E auth contract from CLAUDE.md.

**Source:** `[CITED: project-root CLAUDE.md "Frontend serves on :5173 and proxies /api to :8080"]`, `[CITED: https://vite.dev/config/server-options.html#server-proxy]`

### Pattern 4: CI Grep Guard Wiring

**What:** The existing `scripts/check-forbidden-imports.mjs` walks `frontend2/src/**/*.{ts,tsx,js,jsx,mjs,cjs}` and rejects any file importing `idb`, `serwist`, `@serwist/*`, or any specifier whose path/name matches `/offline/i` or `/sync/i`. Verified by reading the script (2026-05-01): exit 1 with a list of offenders; exit 0 on clean.

**When to use:** Every PR that touches `frontend2/`. CI failure blocks merge.

**Wiring options (Claude's discretion per CONTEXT.md):**

| Option | Where | Notes |
|--------|-------|-------|
| GitHub Actions workflow | `.github/workflows/lint-frontend2.yml` | NEW directory; project does not yet have GH Actions surface (verified — `.github/` does not exist at repo root). Phase 1 may create. |
| Bun script + pre-push hook | `frontend2/package.json` `scripts.lint:imports` | Always available locally; planner may also add a husky-style hook. |
| `mise run lint:imports` task | `.mise.toml` | Already the project's task runner pattern; minimal-friction option. |

**Recommendation:** Add BOTH (1) `frontend2/package.json` script `"lint:imports": "node ../scripts/check-forbidden-imports.mjs"` AND (2) a `.github/workflows/lint-frontend2.yml` that runs `bun run lint:imports` on PRs touching `frontend2/`. The package script gives developers local feedback; the GH Actions step provides the merge gate.

**Existing tests:** `scripts/__tests__/check-forbidden-imports.test.mjs` exists (verified). Confirm tests pass on Phase 1 scaffold commit via `node --test scripts/__tests__/check-forbidden-imports.test.mjs` or equivalent.

**Source:** `[VERIFIED: read scripts/check-forbidden-imports.mjs source 2026-05-01]`, `[CITED: CONTEXT.md "port from existing implementation if one exists"]`

### Pattern 5: CARRY-FORWARD.md Structure (FOUND-03)

**What:** A planning artifact at `.planning/research/CARRY-FORWARD.md` enumerating, for every concept that survives the v2.1/v2.2 wipe, exactly which file/pattern carries forward verbatim and which gets rebuilt. The downstream phase planners read this to avoid re-deciding ported items.

**Recommended document layout (discretionary per CONTEXT.md):**

```markdown
# v3.0 Carry-Forward Audit

Date: <YYYY-MM-DD>
Wipe SHA: <SHA of frontend2 wipe commit>
v2.1 archive: .planning/milestones/v2.1-phases/

## Port Verbatim (FOUND-03 explicit list)

| # | Item | Source | Destination | Notes |
|---|------|--------|-------------|-------|
| 1 | Auth flow (cookie-JWT, single-flight 401 refresh) | <v2.1 archive path or /frontend lib/api.ts> | frontend2/src/lib/api.ts | Pitfall #10 — do not regress to localStorage Bearer |
| 2 | OAuth callback handler | <v2.1 archive path> | frontend2/src/features/auth/AuthCallbackPage.tsx | Phase 5 ports; Phase 1 reserves the path |
| 3 | Format hooks (useDateFormat / useTimeFormat / useNumberFormat) | <v2.1 archive path> | frontend2/src/hooks/useDateFormat.ts (etc.) | Phase 12 ports; Phase 1 reserves the path |
| 4 | Playwright auth helper | frontend2/e2e/scan-lookup.spec.ts (v2.2 archive) + CLAUDE.md auth contract | frontend2/e2e/_helpers/auth.ts (refactor) | "/login" form contract; ^LOG IN$ exact match |
| 5 | scripts/check-forbidden-imports.mjs | scripts/check-forbidden-imports.mjs (EXISTING — verified) | scripts/check-forbidden-imports.mjs (no move) | Wired into CI in Phase 1 |

## Rebuild from Scratch (FOUND-03 explicit list)

| # | Concept | Why Rebuild | Phase |
|---|---------|-------------|-------|
| 1 | Chrome (TopBar / Sidebar / Bottombar / PageHeader) | Sketch 005 fidelity is new; v2.1 chrome is partial | 3 |
| 2 | Retro atoms (Panel / Button / Badge / Input / Table / Dialog / etc.) | Visual re-derivation per sketch 005 + new constraints from layout | 4 |
| 3 | Layout grid + design tokens | Token system locked from sketches 001-005 | 2 |
| 4 | Provider stack composition | Some providers new (Shortcuts, ToastProvider as sonner) | 6 |

## Backend Endpoint Specs (D-10/D-11 — for Phase 13 dashboard rollups)

### `GET /api/workspaces/{wsId}/stats/capacity`
Returns: `{ total_items: number, capacity_target: number | null }`
Empty state: capacity_target = null (no warehouse-capacity feature yet)
Used by: HUD capacity gauge (DASH-04, Phase 13)

### `GET /api/workspaces/{wsId}/stats/activity?days=14`
Returns: `{ days: Array<{ date: string (YYYY-MM-DD), count: number }> }`
Notes: 14 days ending today (UTC); zero-fill missing days; count = item-mutation events
Used by: HUD 14-day activity sparkline (DASH-04, Phase 13)

## Out of Scope (Reaffirmed)

- IndexedDB / Serwist / offline / sync* — CI grep guard enforced
- Lingui v5 macros (replaced by spike winner per D-04)
- v2.1 retro atom files (component-by-component re-derivation per Phase 2-4)
```

**Source:** `[CITED: CONTEXT.md FOUND-03]`, `[CITED: SUMMARY.md ## Implications for Roadmap → Phase 0]`

### Anti-Patterns to Avoid

- **AP-1: Switching to RR7 framework mode.** Locked: library mode. Framework mode revalidates per nav, conflicts with TanStack Query, brings SSR machinery this app does not need. `[CITED: ARCHITECTURE.md Anti-Pattern 1]`
- **AP-2: Storing JWT in localStorage in the rebuild.** Locked: HttpOnly cookie auth via `credentials: "include"`. v2.0 already shipped this; rewriting auth is out of scope. `[CITED: PITFALLS.md Pitfall #10]`
- **AP-3: Adding `idb` / `serwist` / any offline-sync dep.** Online-only is CI-enforced. The grep guard catches both direct and substring matches. `[CITED: PITFALLS.md Pitfall #17]`
- **AP-4: Putting i18n spike code into the main scaffold branch.** D-04 explicitly requires throwaway branch. The contamination risk is that a half-installed candidate's deps linger in `package.json` even after the decision is made.
- **AP-5: Hand-writing the Vite scaffold.** Use `bun create vite frontend2 --template react-swc-ts`. Hand-writing risks subtle config divergence (React 19 plugin version, tsconfig flags, default index.html) and saves no time.
- **AP-6: Using `latest` or unversioned deps in package.json.** Pin exact `^X.Y.Z`; the registry moves between Phase 1 plan-time and execution time. Stack research dates dependencies; the planner re-verifies before commit.
- **AP-7: Mixing Babel and SWC compilers in Vite.** If react-intl wins the spike, do NOT also keep `@vitejs/plugin-react-swc` running Lingui macros. Pick one compile pass; if you need Babel for `babel-plugin-formatjs` AOT extraction (and the spike confirms it's needed), use `vite-plugin-babel` for the extraction pass only or do extraction out-of-band via the FormatJS CLI. Mixing toolchains for one feature is a path to brittleness.
- **AP-8: Dropping the existing Playwright auth contract.** CLAUDE.md documents the `^LOG IN$` exact match and the cookie-inheritance contract. Phase 1 doesn't write E2E tests, but the contract is reserved by CARRY-FORWARD.md so Phase 5+ can reuse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vite project skeleton | Hand-written `vite.config.ts` + `index.html` + `main.tsx` from scratch | `bun create vite frontend2 --template react-swc-ts` | The template hits 90% of correct-config; remaining 10% is layered. Hand-rolling = slow + subtle errors. |
| Provider stack ordering | Per-feature provider mount | Single `App.tsx` with the locked order from PROV-01 (Phase 6) — Phase 1 stubs `QueryClientProvider > BrowserRouter` only; full stack lands Phase 6 | Provider order is a v3.0 architectural lock; trickling-in providers per phase causes ordering drift. |
| 401 single-flight refresh | New fetch wrapper logic | Port `lib/api.ts` from v2.1 archive (Pitfall #10) | The single-flight pattern is subtle and the existing one is tested in production. |
| Forbidden-imports grep | New script | `scripts/check-forbidden-imports.mjs` (EXISTING + tests) | Already exists, already tested. Phase 1 wires into CI. |
| Tailwind v4 setup | PostCSS config files | `@tailwindcss/vite` plugin + `@theme` block in `globals.css` | Tailwind v4's CSS-first config kills the postcss.config.* file requirement. |
| i18n message extraction | Hand-written extractor | The chosen library's CLI (`lingui extract` or `formatjs extract`) | Extraction handles AST parsing of macros/components correctly; rolling your own = guaranteed missing-key bugs. |
| QueryClient defaults | New caching logic | Port `lib/queryClient.ts` from v2.1 archive (defaults: `staleTime: 30_000`, retry: standard) | Predecessor's defaults work for read-heavy lists; matching them avoids surprise refetch storms. |
| GitHub Actions YAML for "run a script on PR" | Hand-written from scratch | The minimal pattern in `## Code Examples → GitHub Actions workflow` (or skip and use `mise run lint:imports` if .mise.toml is the chosen surface) | Boilerplate; tested patterns reduce config errors. |
| Vite proxy config | Custom express middleware | `server.proxy` in `vite.config.ts` | One-liner; fully covers `/api → :8080` need. |

**Key insight:** Phase 1 is a **plumbing phase, not an architectural phase**. Every "should we build X" question for Phase 1 has a Yes-existing answer in the v2.1 archive, the official docs, or the project's existing scripts. The planner's job is to assemble — not to design.

## Common Pitfalls

### Pitfall 1: Lingui SWC plugin pin breaks future Vite upgrade

**What goes wrong:** Lingui v6's `@lingui/swc-plugin` (Rust-compiled WASM) is pinned to a specific SWC ABI. When Vite 8 → 9 (or `@vitejs/plugin-react-swc` 4 → 5) bumps SWC, the plugin can break silently — extraction works but transformation fails, leaving raw msgids in the bundle.

**Why it happens:** Lingui's predecessor v5 plugin had this exact dynamic. The fix is keeping the SWC plugin in lockstep with `@vitejs/plugin-react-swc`; the failure mode is a stale plugin version.

**How to avoid:**
- Pin `@lingui/swc-plugin` exact (no caret) for the spike, and confirm it still resolves a compatible SWC.
- Add an integration test in Phase 5 (when IntlProvider mounts) that asserts a known msgid renders translated, not raw — this catches a silent extraction failure.
- Document the plugin pin in CARRY-FORWARD.md so future Vite upgrades remember to revisit.

**Warning signs:** Build succeeds but runtime shows "users.greeting" (the msgid) instead of "Hello"; `bun run build` log mentions "lingui macro left untransformed".

**Source:** `[CITED: STACK.md "Risks / Watch-outs #1"]`, `[CITED: ARCHITECTURE.md Anti-Pattern 7]`

### Pitfall 2: Lingui v5 → v6 catalog migration drops keys

**What goes wrong:** Predecessor v2.0 used Lingui v5; v6 changed `.po` extraction defaults. If catalogs are imported from v2.0/v2.1 archive without the `lingui extract --convert-from=v5` migration step, message IDs silently shift — English passes, Estonian/Russian show raw keys.

**How to avoid:**
- If Lingui wins the spike AND the planner imports v2.1 catalogs, run `lingui extract --convert-from=v5` once; commit catalog files in the same commit as the conversion.
- CI extract→merge→diff manifest guard (Pitfall #9 from PITFALLS.md) catches future drops.
- Phase 1 does NOT yet have user-facing strings, so this is forward-compat — the danger materializes in Phase 15 (i18n catalog gap-fill).

**Source:** `[CITED: STACK.md "Risks / Watch-outs #7"]`, `[CITED: PITFALLS.md Pitfall #9]`

### Pitfall 3: Vite 8 + Tailwind 4 + `@theme` block parser quirks

**What goes wrong:** Tailwind v4 is recent (released 2025); the `@theme` directive parser has occasional edge cases — e.g., `--color-` prefix is required for utility-class generation, but a `--bg-base: #0a0e0a;` declaration without the `--color-` prefix silently fails to expose `bg-bg-base` as a utility.

**How to avoid:**
- In Phase 1's minimal `globals.css`, write only the `@import "tailwindcss";` line. Do NOT add `@theme` content yet — Phase 2 ports the locked tokens.
- When Phase 2 lands tokens, verify each token shows up in DevTools "Computed" panel for a test element.
- Pin `tailwindcss` and `@tailwindcss/vite` to identical versions (both `^4.2.4`) — they ship together and version skew breaks parsing.

**Warning signs:** Tailwind class works in editor IntelliSense but does nothing at runtime; DevTools shows the class is generated but the CSS variable evaluates to an empty string.

**Source:** `[CITED: STACK.md "Risks / Watch-outs #1"]`, `[CITED: ARCHITECTURE.md "tertiary sources flagged for validation"]`

### Pitfall 4: TanStack Query devtools shipped to production

**What goes wrong:** Forgetting to gate `<ReactQueryDevtools />` behind `import.meta.env.DEV` ships ~30KB of devtools UI to every production user.

**How to avoid:**
- In `App.tsx`: `{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}`. The dead-code branch is tree-shaken by Rolldown.
- Verify in `vite build` output: search the bundle for `__react-query-devtools` strings — should not appear.

**Source:** `[CITED: STACK.md "Risks / Watch-outs #5"]`

### Pitfall 5: `frontend2` is currently EMPTY but `bun create` may complain about non-empty directory

**What goes wrong:** `bun create vite <dir>` may refuse to scaffold into a non-empty directory. The current state of `frontend2/` was verified empty on 2026-05-01 (`ls frontend2/` returned no entries), but if any artifacts (e.g., `.gitkeep`) get added between research and execution, scaffolding fails.

**How to avoid:**
- The planner's first task includes a pre-condition check: `[ -z "$(ls -A frontend2/)" ]` (or equivalent). If non-empty, escalate to the user before scaffolding.
- Alternative: scaffold into a tmp dir and `mv` contents into `frontend2/`. Slightly slower; immune to non-emptiness.

**Source:** `[VERIFIED: ls /home/antti/Repos/Misc/home-warehouse-system/frontend2/ on 2026-05-01 returned empty]`

### Pitfall 6: Vite proxy not respecting cookies on cross-port (5173 → 8080)

**What goes wrong:** A misconfigured proxy strips Set-Cookie headers from the backend response. Login appears to succeed but subsequent `credentials: "include"` requests fail with 401. Pitfall #10 from PITFALLS.md is auth-flow specific; this is the dev-server-config corollary.

**How to avoid:**
- In `vite.config.ts`, set `server.proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true, secure: false } }`. `changeOrigin` rewrites the Host header so backend cookie domain matches.
- Add a smoke E2E test (Phase 5, but reserve the path now) that performs login → navigate → reload → still authenticated.
- Phase 1 does not exercise auth, but mis-configuring the proxy here causes a downstream Phase 5 debugging session.

**Source:** `[CITED: project-root CLAUDE.md "auth contract: useful for future specs"]`, `[CITED: https://vite.dev/config/server-options.html#server-proxy]`

### Pitfall 7: Grep-guard scan path resolves wrong on fresh checkout

**What goes wrong:** `scripts/check-forbidden-imports.mjs` resolves `SCAN_ROOT` from `__dirname` to `<repo>/frontend2/src`. On a fresh checkout where Phase 1 hasn't created `frontend2/src/` yet, `statSync` throws and the script exits 1 with "scan root not found" — a false positive that could block CI on Phase 1's own scaffold PR.

**How to avoid:**
- Order Phase 1 task list so the `frontend2/src/` directory exists (with at least `main.tsx`) BEFORE the CI workflow runs the lint script.
- Alternatively, modify the script to exit 0 if scan root does not yet exist (additive change; document in CARRY-FORWARD.md). Recommendation: keep the script unchanged; sequence the tasks correctly. The "fail loudly" comment in the script is intentional.

**Source:** `[VERIFIED: read scripts/check-forbidden-imports.mjs source line 14-18 on 2026-05-01]`

### Pitfall 8: Spike branch leaks Lingui's `@lingui/swc-plugin` Rust binary into Bun's lockfile

**What goes wrong:** `@lingui/swc-plugin` is a native binary and Bun's lockfile records the platform-specific resolved binary. If the spike happens on the developer's macOS but the main scaffold builds on Linux CI, the lockfile carries macOS metadata that fails on Linux.

**How to avoid:**
- The spike uses a **separate `bun install` directory** (the throwaway branch), so the spike's `bun.lockb` never lands in the main scaffold's lockfile.
- After the spike, when installing Lingui in the main branch, do a fresh `bun install` from clean to regenerate the lockfile with the active platform's binary listed.
- Bun supports `optionalDependencies` per-platform — confirm Lingui's swc-plugin uses this convention; if not, treat the lockfile as platform-portable and accept the rebuild.

**Source:** `[ASSUMED]` — Bun's behavior with native binary deps in optionalDependencies is documented but I have not empirically verified the Lingui-specific failure mode in this project.

## Code Examples

### Vite config (`frontend2/vite.config.ts`)

```typescript
// Source: https://vite.dev/config/ + project-root CLAUDE.md proxy contract
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
// import lingui from "@lingui/vite-plugin";  // ← uncomment if Lingui wins spike

export default defineConfig({
  plugins: [
    react(/* { plugins: [["@lingui/swc-plugin", {}]] } */ ),  // ← swc-plugin slot if Lingui wins
    tailwindcss(),
    // lingui(),  // ← uncomment if Lingui wins spike
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Forward-compat: scanner WASM manual chunk lands in Phase 11
        // manualChunks: { scanner: [/* @yudiel deps */] },
      },
    },
  },
});
```

### `package.json` scripts (Phase 1 minimum)

```jsonc
{
  "name": "frontend2",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "lint:imports": "node ../scripts/check-forbidden-imports.mjs",
    "lint:tsc": "tsc -b --noEmit"
  }
}
```

### Provider stack skeleton (`frontend2/src/App.tsx`)

```tsx
// Source: ARCHITECTURE.md Pattern 3 (auth + RR7 library mode) + STACK.md
// Phase 1 stubs only QueryClientProvider + BrowserRouter; full provider stack (PROV-01) lands Phase 6.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route } from "react-router";

import { queryClient } from "./lib/queryClient";

function PlaceholderShell() {
  return (
    <main style={{ padding: 16, fontFamily: "monospace" }}>
      <h1>frontend2 — v3.0 placeholder shell</h1>
      <p>Phase 1 scaffold OK. Tokens (Phase 2), chrome (Phase 3), atoms (Phase 4) follow.</p>
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route index element={<PlaceholderShell />} />
        </Routes>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

### `frontend2/src/lib/queryClient.ts` (port shape from v2.1)

```typescript
// Source: .planning/milestones/v2.1-phases/56-foundation-api-client-and-react-query/56-01-PLAN.md
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Lingui v6 + SWC config (only if spike picks Lingui)

```typescript
// Source: https://lingui.dev/ref/conf + STACK.md
// Add to vite.config.ts plugins array:
import lingui from "@lingui/vite-plugin";

export default defineConfig({
  plugins: [
    react({
      plugins: [["@lingui/swc-plugin", {}]],
    }),
    tailwindcss(),
    lingui(),
  ],
  // ...
});
```

```jsonc
// frontend2/lingui.config.json
{
  "locales": ["en", "et", "ru"],
  "sourceLocale": "en",
  "catalogs": [
    { "path": "src/locales/{locale}/messages", "include": ["src"] }
  ],
  "format": "po"
}
```

### react-intl + Babel config (only if spike picks react-intl)

```typescript
// Source: https://formatjs.io/docs/getting-started/installation
// react-intl runtime needs no compile plugin; babel-plugin-formatjs is for compile-time
// extraction/optimization — but the runtime path WORKS without it. Spike validates whether
// extraction-only-via-CLI is sufficient (avoiding Babel injection into the Vite/SWC pipeline).
//
// Minimal happy path (no Babel plugin in dev pipeline):
//   1. Use <FormattedMessage id="..." defaultMessage="..." /> components inline
//   2. Run `formatjs extract 'src/**/*.{ts,tsx}' --out-file en.json` via CLI as a build step
//   3. Translations: en.json → et.json + ru.json by translator
//   4. Runtime: <IntlProvider locale={locale} messages={messages[locale]}> wraps app
//
// If the spike concludes the SWC pipeline needs Babel for inline message-id-only optimization,
// add vite-plugin-babel + babel-plugin-formatjs ONLY behind a build-flag and document trade-offs
// in I18N-DECISION.md.
```

### GitHub Actions workflow (`.github/workflows/lint-frontend2.yml`)

```yaml
# Source: project-root CLAUDE.md + STACK.md ## scripts/check-forbidden-imports.mjs
# Phase 1 wires the existing grep guard into a PR gate.
name: lint-frontend2

on:
  pull_request:
    paths:
      - "frontend2/**"
      - "scripts/check-forbidden-imports.mjs"
  push:
    branches: [master]
    paths:
      - "frontend2/**"
      - "scripts/check-forbidden-imports.mjs"

jobs:
  forbidden-imports:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.13
      - name: Run forbidden-imports grep guard
        run: node scripts/check-forbidden-imports.mjs
      - name: Run grep-guard self-tests
        run: node --test scripts/__tests__/check-forbidden-imports.test.mjs

  typecheck-frontend2:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.13
      - run: cd frontend2 && bun install --frozen-lockfile
      - run: cd frontend2 && bun run lint:tsc
```

### Tailwind v4 entry (`frontend2/src/styles/globals.css` — Phase 1 minimal)

```css
/* Phase 1: minimal scaffold only. Phase 2 ports premium-terminal tokens into @theme. */
@import "tailwindcss";

/* Body resets only — DO NOT add tokens or scanlines yet (Phase 2 territory). */
html, body, #root { height: 100%; margin: 0; }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@vitejs/plugin-react` (Babel) | `@vitejs/plugin-react-swc` 4.x | Vite 8 era (2025) | ~30% faster cold start; required for Lingui SWC plugin path |
| Tailwind v3 + `tailwind.config.ts` + `postcss.config.js` | Tailwind v4 + `@theme` block in CSS + `@tailwindcss/vite` | 2025 | Kills two config files; CSS-variable-first; perfect fit for design-token system |
| RR7 framework mode (file-based routes + loaders) | RR7 library mode (declarative `<Routes>`) | 2024-2025 (RR7 GA) | Library mode is a thin shell over what was RR6; framework mode is a separate opinion. v3.0 chooses library mode. |
| Lingui v5 (predecessor) | Lingui v6 OR react-intl (spike-decided per D-04) | 2025-2026 | v6's `@lingui/swc-plugin` decouples from Babel; react-intl runtime API is the lower-friction alternative if SWC compat fails. |
| `idb` / Serwist / service-worker offline | NONE — online-only | v2.1 (locked); v3.0 reaffirmed | CI grep guard enforces. ~30-40% reduction in test surface vs v2.0 PWA spec. |

**Deprecated/outdated:**
- `@vitejs/plugin-react` (Babel variant) — still maintained but slower for our needs.
- `@tailwindcss/postcss` — replaced by `@tailwindcss/vite` for Vite projects.
- Lingui v5 — replaceable by v6 (assuming SWC compat) or react-intl.
- TS 5.x — current latest is 6.0.3 as of 2026-05-01; v3.0 pins 5.9.5 for Phase 1 to avoid debuting a brand-new TS major.

## Existing Code Insights

### Reusable Assets (Phase 1 scope: only those that scaffold-time uses)

- **`scripts/check-forbidden-imports.mjs`** — EXISTING + tested (`scripts/__tests__/check-forbidden-imports.test.mjs`). Phase 1 wires into CI; no rewrite. `[VERIFIED: read source 2026-05-01]`
- **`lib/api.ts` shape** — port from `.planning/milestones/v2.1-phases/56-foundation-api-client-and-react-query/56-01-PLAN.md`'s artifact spec (cookie-JWT + 401 single-flight refresh + HttpError + postMultipart). `[VERIFIED: read 56-01-PLAN.md on 2026-05-01]`
- **`lib/queryClient.ts` shape** — port from same v2.1 plan (staleTime: 30_000, retry: 1, refetchOnWindowFocus: false). `[VERIFIED]`
- **Vite proxy contract** — `/api` → `:8080`, `changeOrigin: true`. `[CITED: project-root CLAUDE.md]`
- **Playwright auth contract** — `^LOG IN$` exact button match, cookie inheritance. Reserved by CARRY-FORWARD.md; Phase 1 does NOT write E2E specs. `[CITED: project-root CLAUDE.md]`

### Established Patterns

- **Bun is the package manager.** All install/run commands use `bun`. Vite still drives dev/build; Bun's bundler is not used.
- **`mise run <task>` is the project's task surface.** `.mise.toml` defines `fe-dev`, `fe-build`, `fe-install`, `fe-lint` for the legacy `frontend/`. Phase 1 may add `fe2-dev` / `fe2-lint:imports` / `fe2-test:e2e` etc. for `frontend2/` symmetry. `[VERIFIED: read .mise.toml 2026-05-01]`
- **`frontend2/` is currently EMPTY.** Verified on 2026-05-01 via `ls`. Confirms green-field per CONTEXT.md.
- **`.github/` does not yet exist at repo root.** GitHub Actions workflows are NEW infrastructure for v3.0. `[VERIFIED: ls -la repo-root on 2026-05-01]`
- **Mise tasks reference `frontend/` (singular).** Phase 1 adding `frontend2/` tasks does not collide.

### Integration Points

- **Backend Go server: `:8080`.** Vite dev proxies `/api` here. Backend itself UNCHANGED in Phase 1 — no new endpoints, no Go code edits.
- **Postgres: `localhost:5432`, db `warehouse_dev`.** Phase 1 does NOT touch the database.
- **CI surface: TBD.** No `.github/` directory exists; the planner picks GH Actions OR `.mise.toml` task OR Husky-style hook. Recommendation: GH Actions for the merge gate (works for any future contributor regardless of local tooling).

## Runtime State Inventory

> Phase 1 is **NOT a rename/refactor/migration phase** — it is a green-field scaffold of an empty directory. This section is INCLUDED for completeness but most categories return "None — verified by X" because there is no pre-existing runtime state in the `frontend2/` namespace.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `frontend2/` is empty (`[VERIFIED: ls 2026-05-01]`); no Postgres tables created or modified by Phase 1; no localStorage / IndexedDB writes (online-only constraint). | None |
| Live service config | None — backend Go server unchanged; no Datadog/Tailscale/Cloudflare config in v3.0 yet. | None |
| OS-registered state | None — no Task Scheduler / launchd / systemd unit / pm2 process for `frontend2/`. Vite dev server runs interactively via `bun run dev`. | None |
| Secrets/env vars | `E2E_USER` and `E2E_PASS` exist for Playwright (CLAUDE.md). Phase 1 does not yet run E2E specs but reserves these in CARRY-FORWARD.md. | Reserve names; do not redefine. |
| Build artifacts / installed packages | `frontend/node_modules/` exists (legacy frontend1, untouched). Phase 1 creates `frontend2/node_modules/` + `frontend2/bun.lockb`. No stale `.egg-info`-equivalents. | None — fresh install creates new lockfile and node_modules. |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* — **Answer: None.** Phase 1 introduces a new namespace (`frontend2/`); it does not rename or refactor existing namespaces. The only "carry-forward" items are scripts and patterns explicitly enumerated in CARRY-FORWARD.md (FOUND-03), all referenced by name not contents.

## Environment Availability

> Phase 1 dev-time environment audit. Skip-condition does NOT apply (Phase 1 has external dependencies: Bun, Node, Vite-via-Bun, Postgres-via-Docker for downstream verification, Go-via-mise for proxy target).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Package install + scripts | (verify per dev) | 1.3.13+ | None — Bun is project's package manager (mise installs it) |
| Node.js | `scripts/check-forbidden-imports.mjs` execution | (verify per dev) | 18+ | None |
| Go 1.25 | Backend `:8080` (proxy target — for end-to-end verification of `/api` proxy) | (verify per dev) | 1.25 | None for Phase 1 verification, but the scaffold itself doesn't depend on Go running |
| Docker | Postgres (`docker compose up -d postgres`) | (verify per dev) | 24+ | None for Phase 1 (no DB calls); Phase 4+ requires |
| dbmate | Apply migrations (transitive — only relevant when verifying `/api` proxy works end-to-end) | (verify per dev) | latest | None for Phase 1 (no DB calls) |
| GitHub Actions runner (CI) | `.github/workflows/lint-frontend2.yml` | (provided by GitHub) | ubuntu-latest | `.mise.toml` local task as developer-side guard |

**Missing dependencies with no fallback:**
- None for Phase 1 itself. If a developer runs without Go/Postgres, `bun run dev` still serves the placeholder shell; only `/api/*` requests fail (acceptable for Phase 1 — there are none in the placeholder).

**Missing dependencies with fallback:**
- Docker absent → cannot run `bun run test:e2e` against real backend, but Phase 1 doesn't yet have E2E specs.

## Validation Architecture

> Phase 1 is the FIRST phase of v3.0; the test infrastructure does not yet exist. Wave 0 of the Phase 1 plan installs it.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (unit/component) + Playwright 1.59.1 (E2E) |
| Config file | `frontend2/vitest.config.ts` (NEW, Wave 0) + `frontend2/playwright.config.ts` (NEW, Wave 0) |
| Quick run command | `cd frontend2 && bun run test` (Vitest run, all unit tests) |
| Full suite command | `cd frontend2 && bun run test && bun run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | Scaffold serves placeholder at `localhost:5173` with `/api` proxy | smoke (manual + scripted curl) | `bun run dev &; sleep 3; curl -sf http://localhost:5173/ && curl -sf -o /dev/null http://localhost:5173/api/health -w '%{http_code}\n'` (200 from `/`, 502/proxied from `/api/*` if backend down — both prove proxy is wired) | NO — Wave 0 creates a verification script `scripts/verify-phase-01-scaffold.sh` |
| FOUND-02 | Grep guard rejects forbidden imports | unit (existing) + CI integration (NEW) | `node scripts/check-forbidden-imports.mjs` (already exists) + `node --test scripts/__tests__/check-forbidden-imports.test.mjs` (already exists) | YES — `scripts/__tests__/check-forbidden-imports.test.mjs` |
| FOUND-03 | CARRY-FORWARD.md exists with required items | manual review | `grep -E "auth flow\|OAuth callback\|format hooks\|Playwright auth helper\|grep guard" .planning/research/CARRY-FORWARD.md` returns 5 matches | NO — Wave 0 creates a presence-check script |
| FOUND-04 | I18N-DECISION.md exists with empirical evidence | manual review | `test -f .planning/research/I18N-DECISION.md && grep -E "Lingui v6\|react-intl" .planning/research/I18N-DECISION.md` | NO — Wave 0 reserves the file path |
| FOUND-05 | Mobile FAB scope locked in milestone scope | doc check | `grep -E "FAB-only.*<768.*Bottombar.*≥768" .planning/STATE.md \|\| grep -E "FAB" .planning/REQUIREMENTS.md` (or wherever the milestone scope lives) | YES (will be) — STATE.md or REQUIREMENTS.md updated as part of Phase 1 |
| FOUND-06 | Dashboard rollups decision recorded; endpoint specs documented | doc check | `grep -E "/stats/capacity\|/stats/activity" .planning/research/CARRY-FORWARD.md` returns 2 matches | NO — Wave 0 reserves CARRY-FORWARD.md path |

### Sampling Rate

- **Per task commit:** `bun run lint:tsc && bun run lint:imports` (typecheck + grep guard, ~5s combined)
- **Per wave merge:** `bun run lint:tsc && bun run lint:imports && bun run test` (add Vitest run, ~10s for empty suite)
- **Phase gate:** Full suite green + manual scaffold smoke (`bun run dev` → visual check) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend2/vitest.config.ts` — Vitest v4 config; reads from vite.config.ts plugins
- [ ] `frontend2/playwright.config.ts` — Playwright config (port from CLAUDE.md spec: chromium + firefox projects, no `webServer`, baseURL `http://localhost:5173`)
- [ ] `frontend2/.gitignore` — node_modules, dist, test-results, playwright-report, .env*
- [ ] `frontend2/tsconfig.json` — strict, verbatimModuleSyntax, target ES2022
- [ ] `frontend2/tsconfig.node.json` — for vite.config.ts
- [ ] `scripts/verify-phase-01-scaffold.sh` — smoke script for FOUND-01 verification
- [ ] `.github/workflows/lint-frontend2.yml` — CI surface for FOUND-02 (or `.mise.toml` task; see Pattern 4)
- [ ] Framework install: `bun add -d vitest@^4.1.5 @playwright/test@^1.59.1` (per Standard Stack)

## Security Domain

> `security_enforcement` not explicitly set in init context for this phase, treating as enabled by default.

### Applicable ASVS Categories

Phase 1 is plumbing; the auth-touching code is deferred to Phase 5. Most ASVS categories are reserved (carried forward as locked patterns) rather than implemented in Phase 1.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | reserved (Phase 5) | Cookie-JWT (HttpOnly, Secure, SameSite=Lax) — pattern locked, port from v2.1 |
| V3 Session Management | reserved (Phase 5) | Server-issued access_token cookie; refresh via single-flight 401 retry |
| V4 Access Control | reserved (Phase 5+) | RequireAuth wrapper; workspace-scoped REST `/api/workspaces/{wsId}/*` |
| V5 Input Validation | reserved (Phase 5+) | zod 4 schemas at every form + API client |
| V6 Cryptography | n/a (Phase 1) | Backend Go owns crypto; frontend never hand-rolls |
| V14 Configuration | yes | `.gitignore` excludes `.env*`; CI grep guard rejects offline-state libs (online-only is a security-adjacent simplification — fewer attack surfaces) |

### Known Threat Patterns for Vite + React 19 SPA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cookie auth bypassed by localStorage Bearer regression | Spoofing | Cookie-JWT pattern locked in CARRY-FORWARD.md; PR review challenges any `localStorage.setItem("token"`/`Authorization: Bearer ` (Pitfall #10) |
| `idb` import sneaks in stale auth/session cache | Information disclosure | CI grep guard rejects `idb`/`serwist`/`offline`/`sync*` |
| Vite dev proxy strips Set-Cookie (config error) | Spoofing (auth bypass) | `changeOrigin: true` + smoke E2E test in Phase 5; documented in Pitfall 6 |
| TanStack Query devtools shipped to prod | Information disclosure | `import.meta.env.DEV` gate; bundle-grep verification |
| Lingui SWC plugin executes untrusted code at build time | Tampering (build-supply-chain) | Pin exact version; review `@lingui/swc-plugin` package source on first install; Bun's lockfile records integrity hash |
| `frontend2/.env*` committed by accident | Information disclosure | `.gitignore` (`.env*`) + git pre-commit hook (out of v3.0 scope; reserve in CARRY-FORWARD.md as "should consider") |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Lingui v6 + `@lingui/swc-plugin@^6.0.0` will compile cleanly under Vite 8.0.10 + `@vitejs/plugin-react-swc@^4.3.0` | Pattern 2 (i18n spike), Pitfall 1 | If the spike fails, react-intl wins by D-03 fallback. Spike is the empirical answer; this assumption only matters for the planner's expected outcome. |
| A2 | Bun's lockfile handles `@lingui/swc-plugin`'s native binary across platforms via optionalDependencies | Pitfall 8 | If wrong, the spike's Linux CI build differs from the developer's local OS build. Workaround: regenerate lockfile from clean install. |
| A3 | Tailwind v4.2.4's `@theme` block parser stably handles dual-hue (amber + green) tokens with the `--color-` prefix convention | Pitfall 3 | Phase 2 risk, not Phase 1 (Phase 1 ships only `@import "tailwindcss";`). |
| A4 | TS 5.9.5 will compile React 19 + RR7 7.14 + TanStack Query 5.100 cleanly | Standard Stack | All three packages declare TS 5+ types; risk is near-zero, but pinning is conservative. |
| A5 | The repo currently has no `.github/` directory and creating one in Phase 1 is acceptable | Pattern 4, Code Examples | Verified absent on 2026-05-01. If the user prefers `.mise.toml` over GH Actions, planner picks the alternative. |

**No empty assumption table:** Phase 1 has 5 assumptions worth flagging. The biggest is A1 (Lingui SWC compat) — the spike is the explicit mitigation per D-01..D-04.

## Open Questions (RESOLVED)

1. **Where exactly is the v2.1 `lib/api.ts` source the planner ports from?**
   - **RESOLVED** by Plan 01-01 Task 2 — uses `git show 3826d24:frontend2/src/lib/api.ts` (and `4d4c233` as the secondary candidate SHA) to extract the verbatim source from pre-wipe history; SHA recorded in CARRY-FORWARD.md per Plan 01-04.
   - What we know: `.planning/milestones/v2.1-phases/56-foundation-api-client-and-react-query/56-01-PLAN.md` describes the artifact (request() + 401 single-flight + postMultipart + HttpError) and references `frontend2/src/lib/api.ts` as its destination — but `frontend2/` is now empty (the wipe removed the implementation file).
   - What's unclear: whether the actual implementation lives in (a) the v2.1 plan summary file, (b) git history (a `git show` against a pre-wipe commit), or (c) the legacy `frontend/lib/api.ts` Next.js-flavored equivalent.
   - Recommendation: planner's Wave 0 task includes `git log --oneline -- frontend2/src/lib/api.ts` to find the last pre-wipe commit, then `git show <SHA>:frontend2/src/lib/api.ts` to extract the verbatim source. Document the source SHA in CARRY-FORWARD.md.

2. **Should the GitHub Actions workflow OR the `.mise.toml` task be the canonical CI surface?**
   - **RESOLVED** by Plan 01-02 — GitHub Actions chosen as the canonical CI/merge-gate surface (`.github/workflows/lint-frontend2.yml`); local `.mise.toml` / `bun run` paths kept for fast developer feedback but the merge gate runs in GH Actions.
   - What we know: `.mise.toml` is the project's task runner; no `.github/workflows/` exists. CONTEXT.md leaves this to Claude's discretion.
   - What's unclear: project-wide intent — does the user want PR merge gates enforced by GitHub OR is local discipline sufficient?
   - Recommendation: planner adds BOTH (mise task for fast local feedback + GH Actions workflow for merge gate). If the user objects to GH Actions during plan-checking, drop the workflow file; mise task remains.

3. **Does the Phase 1 spike branch get merged, deleted, or kept as a reference?**
   - **RESOLVED** by Plan 01-03 Task 1 steps 6–7 — the spike branch is **kept** in git (never merged, never deleted), and tagged `spike/i18n-decision-evidence` at HEAD; the tag SHA is referenced in `.planning/research/I18N-DECISION.md` for archaeology.
   - What we know: D-04 says "throwaway branch or temp directory."
   - What's unclear: whether the I18N-DECISION.md commit references the spike branch SHA (good for archaeology) or the spike branch is force-deleted post-decision (clean history).
   - Recommendation: keep the spike branch in git (do not delete) but never merge; tag the head SHA as `spike/i18n-decision-evidence` and reference it in I18N-DECISION.md. Cost: zero. Benefit: audit trail.

4. **What is the exact Vite 8 + Tailwind v4 minimum-viable globals.css?**
   - **RESOLVED** by Plan 01-01 Task 1 step 11 — single line `@import "tailwindcss";` plus body resets only; Tailwind v4.2.4's single import covers preflight, no separate `tailwindcss/preflight.css` import is needed. Phase 2 layers `@theme` tokens on top.
   - What we know: `@import "tailwindcss";` is the v4 pattern; predecessor v2.1 used v4 already.
   - What's unclear: whether v4.2.4 still ships a `tailwindcss/preflight.css` separate import or whether the single `@import "tailwindcss";` covers preflight.
   - Recommendation: confirm during scaffold; if extra import needed, document in Pitfall 3.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/01-foundation-conflict-spikes/01-CONTEXT.md` — locked decisions D-01..D-11
- `.planning/REQUIREMENTS.md` — FOUND-01..06
- `.planning/research/STACK.md` — version pins + alternatives + risks
- `.planning/research/ARCHITECTURE.md` — provider stack, RR7 library mode rationale, build order
- `.planning/research/PITFALLS.md` — Pitfalls #2 (input keystrokes), #9 (i18n drop), #10 (auth regression), #17 (online-only regression), #24 (wipe psychology)
- `.planning/research/SUMMARY.md` — executive synthesis + Phase 0/1 conflict-resolution recommendations
- `.planning/STATE.md` — v3.0 milestone status, predecessor decision log
- `.claude/skills/sketch-findings-home-warehouse-system/SKILL.md` — design direction (informs Phase 2; Phase 1 references for forward-compat)
- Project-root `CLAUDE.md` — Playwright auth contract + dev-server proxy ports
- `scripts/check-forbidden-imports.mjs` — read source on 2026-05-01 (HIGH; verified working)
- `.planning/milestones/v2.1-phases/56-foundation-api-client-and-react-query/56-01-PLAN.md` — reference artifact spec for `lib/api.ts` + `lib/queryClient.ts`
- npm registry `npm view <pkg> version` for vite, react, react-router, @tanstack/react-query, react-hook-form, @hookform/resolvers, zod, typescript, tailwindcss, @tailwindcss/vite, @vitejs/plugin-react-swc, @lingui/core, @lingui/swc-plugin, @lingui/vite-plugin, react-intl, sonner, cmdk, tinykeys, vitest, @playwright/test (executed 2026-05-01)

### Secondary (MEDIUM confidence)
- https://vite.dev/config/server-options.html#server-proxy — proxy config docs (referenced via training; not webfetched fresh in this session)
- https://lingui.dev/ref/conf — Lingui config reference
- https://formatjs.io/docs/getting-started/installation — react-intl runtime API
- https://reactrouter.com/start/modes — RR7 library vs framework mode
- https://tailwindcss.com/docs/installation/using-vite — Tailwind v4 + Vite plugin docs

### Tertiary (LOW confidence — flagged for validation in plan/execute)
- A1: Lingui v6 + `@lingui/swc-plugin@^6.0.0` empirical Vite 8 compatibility — the Phase 1 spike IS the verification step for this claim
- A2: Bun lockfile cross-platform behavior with `@lingui/swc-plugin`'s native binary — empirically test if Lingui wins
- Whether `mise run` or GH Actions is the right CI surface for this project — discretionary; user feedback during plan-checking resolves

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version registry-verified 2026-05-01
- Architecture (provider stack + RR7 + proxy config): HIGH — predecessor v2.1 baseline + ARCHITECTURE.md + project-root CLAUDE.md all converge
- i18n decision: MEDIUM-pending — empirical spike per D-01..D-04 is the resolution; tiebreaker D-03 covers the ambiguity
- CARRY-FORWARD enumeration: HIGH on the contract (FOUND-03 lists items explicitly); MEDIUM on exact source-file SHAs (Open Question 1)
- CI grep guard: HIGH — script exists and is tested
- Pitfalls: HIGH — grounded in PITFALLS.md (~32 catalogued pitfalls) + STACK.md "Risks/Watch-outs" + ARCHITECTURE.md anti-patterns

**Research date:** 2026-05-01
**Valid until:** 2026-05-31 (30 days for stable scaffold-mechanic claims; 7 days for fast-moving items like npm registry version pins — re-verify versions before plan execution if delay > 7 days)

---
*Phase 1 research complete. Planner can now create plan files. The i18n spike (D-01..D-04) and the CARRY-FORWARD.md authoring are the two largest plan tasks; everything else is mechanical scaffold assembly.*
