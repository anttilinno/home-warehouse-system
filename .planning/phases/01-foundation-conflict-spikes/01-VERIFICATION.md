---
phase: 01-foundation-conflict-spikes
verified: 2026-05-01T20:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `bun run dev` in frontend2/ and open http://localhost:5173/ in a browser. Confirm the placeholder shell renders visibly with the text 'frontend2 — v3.0 placeholder shell'."
    expected: "Browser renders the React component — text is visible in the page body."
    why_human: "This is a CSR SPA — curl only returns the index.html shell; the React-rendered text requires a real browser. The text is confirmed present in the production bundle and the dev server returns HTTP 200, but end-to-end DOM rendering requires a headed browser."
  - test: "Push a throwaway branch with `frontend2/src/_smoketest.ts` containing `import 'idb';` as a PR. Confirm the `forbidden-imports` CI job fails red."
    expected: "GitHub Actions shows the `forbidden-imports` job failing with an error indicating `idb` is a forbidden specifier."
    why_human: "The negative merge-gate test requires a real GitHub Actions run against the live repo. Cannot be verified programmatically from the CLI."
---

# Phase 1: Foundation + Conflict Spikes Verification Report

**Phase Goal:** Foundation scaffold + conflict resolution spikes. Establish the Vite 8 + React 19 + TypeScript + Tailwind 4 + React Router v7 + TanStack Query + react-hook-form + zod SPA scaffold. Wire CI import guards. Resolve i18n library choice empirically. Write carry-forward audit for v2.1 to v3.0 porting.
**Verified:** 2026-05-01T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Vite 8 + React 19 + TS 5.9.x + Tailwind 4 + RR7 + TanStack Query + RHF + zod SPA boots from `frontend2/` | ✓ VERIFIED | `bun run build` exits 0 (dist/index-BD9RvfEc.js 256 kB / 81 kB gzip); `bun run lint:tsc` exits 0; all deps present in package.json |
| 2 | `bun run lint:tsc` exits 0 with strict + verbatimModuleSyntax | ✓ VERIFIED | Confirmed: `tsc -b --noEmit` exit code 0; tsconfig.app.json has `verbatimModuleSyntax: true` and `"@/*": ["./src/*"]` |
| 3 | CI-enforced online-only constraint — `check-forbidden-imports.mjs` blocks idb/serwist/offline/sync in a PR merge gate | ✓ VERIFIED | `.github/workflows/lint-frontend2.yml` exists (YAML valid); has `forbidden-imports` and `typecheck-frontend2` jobs; `paths: frontend2/**`; `bun-version: 1.3.13`; `bun run lint:imports` exits 0 against current src/ |
| 4 | i18n library decision resolved empirically — Lingui v6 wins, documented in I18N-DECISION.md; installed in scaffold | ✓ VERIFIED | I18N-DECISION.md exists with Verdict, evidence table (PASS/FAIL), Bundle Size, spike SHA. Lingui installed: `@lingui/swc-plugin@6.0.0` exact pin in package.json, `lingui()` in vite.config.ts, SWC plugin slot in both vite.config.ts and vitest.config.ts. Locale catalogs at en/et/ru/messages.po. `src/lib/i18n.ts` has `defaultLocale = "en"` |
| 5 | Mobile FAB scope (Conflict 2) explicitly resolved — D-05..D-08 recorded in STATE.md | ✓ VERIFIED | STATE.md lines 129-132 contain D-05, D-06, D-07, D-08 decisions verbatim |
| 6 | Dashboard backend rollups (Conflict 3) decision recorded — D-09..D-11 in STATE.md and endpoint specs in CARRY-FORWARD.md | ✓ VERIFIED | STATE.md lines 133-135 contain D-09, D-10, D-11; CARRY-FORWARD.md has both `/stats/capacity` and `/stats/activity?days=14` with response shapes |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/package.json` | Pinned deps + scripts (dev/build/test/lint:imports/lint:tsc/prebuild) | ✓ VERIFIED | react ^19, typescript ^5.9.3, lint:imports, lint:tsc, prebuild scripts present; @lingui/swc-plugin exact pin "6.0.0" |
| `frontend2/vite.config.ts` | SWC + Tailwind v4 + /api proxy + @/ alias + Lingui plugin | ✓ VERIFIED | changeOrigin: true, target: "http://localhost:8080", "@": path.resolve, lingui(), @lingui/swc-plugin slot |
| `frontend2/src/lib/api.ts` | Cookie-JWT fetch wrapper with single-flight 401 refresh | ✓ VERIFIED | credentials:"include", refreshPromise, exports: get, post, patch, del, postMultipart, isFormData |
| `frontend2/src/lib/queryClient.ts` | Singleton QueryClient with v2.1 defaults | ✓ VERIFIED | staleTime: 30_000, retry: 1, refetchOnWindowFocus: false |
| `frontend2/src/App.tsx` | QueryClientProvider + BrowserRouter + lazy Devtools (DEV-gated) | ✓ VERIFIED | BrowserRouter, QueryClientProvider, import.meta.env.DEV, lazy() |
| `frontend2/src/routes/index.tsx` | Library-mode RR7 AppRoutes with placeholder shell | ✓ VERIFIED | export function AppRoutes, Routes from "react-router" (not "react-router/dom") |
| `frontend2/vitest.config.ts` | e2e/ excluded; @/ alias; @lingui/swc-plugin slot | ✓ VERIFIED | exclude includes "**/e2e/**"; @lingui/swc-plugin in react() plugins; "@" alias present |
| `frontend2/playwright.config.ts` | chromium + firefox, no webServer, baseURL :5173 | ✓ VERIFIED | baseURL, chromium, firefox present; webServer absent |
| `frontend2/tsconfig.app.json` | verbatimModuleSyntax + @/* paths | ✓ VERIFIED | Both present |
| `frontend2/src/styles/globals.css` | @import "tailwindcss" only (no @theme — Phase 2 owns) | ✓ VERIFIED | @import "tailwindcss" present; no @theme block |
| `frontend2/.gitignore` | .env* + playwright-report | ✓ VERIFIED | Both present |
| `frontend2/bun.lock` | Lockfile (text format — Bun 1.3 default) | ✓ VERIFIED | bun.lock exists (note: plan specified bun.lockb but Bun 1.3 generates text-format bun.lock; documented deviation) |
| `frontend2/lingui.config.ts` | Lingui config with locales [en, et, ru], format po | ✓ VERIFIED | locales ["en", "et", "ru"] present; formatter() from @lingui/format-po |
| `frontend2/src/lib/i18n.ts` | i18n singleton with defaultLocale="en" + loadCatalog | ✓ VERIFIED | defaultLocale = "en", locales = ["en","et","ru"], loadCatalog async function |
| `frontend2/src/locales/en/messages.po` | Empty EN catalog scaffold | ✓ VERIFIED | File exists |
| `frontend2/src/locales/et/messages.po` | Empty ET catalog scaffold | ✓ VERIFIED | File exists |
| `frontend2/src/locales/ru/messages.po` | Empty RU catalog scaffold | ✓ VERIFIED | File exists |
| `.github/workflows/lint-frontend2.yml` | Two-job CI workflow (forbidden-imports + typecheck-frontend2) | ✓ VERIFIED | Both jobs present; paths filter; YAML structurally valid; bun-version: 1.3.13 |
| `scripts/verify-phase-01-scaffold.sh` | Executable local smoke script for FOUND-01+02 | ✓ VERIFIED | File exists, mode +x, contains check-forbidden-imports and __react-query-devtools assertions |
| `.planning/research/I18N-DECISION.md` | Locked empirical i18n decision with evidence | ✓ VERIFIED | Verdict (Lingui v6), evidence table, bundle size, spike branch SHA, tag spike/i18n-decision-evidence |
| `.planning/research/CARRY-FORWARD.md` | Audit document with 5 port-verbatim + 4 rebuild rows + endpoint specs | ✓ VERIFIED | 92 lines, 9 numbered table rows, all required sections present |
| `.planning/STATE.md` | D-05..D-11 decisions appended | ✓ VERIFIED | All 7 decisions present (lines 129-135); minor: status frontmatter still says "executing" vs "Phase 1 plans created; ready for execution" — D-05..D-11 content is substantively complete |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend2/vite.config.ts` | `http://localhost:8080` | `server.proxy["/api"]` target | ✓ WIRED | `target: "http://localhost:8080"` + `changeOrigin: true` present |
| `frontend2/src/main.tsx` | `frontend2/src/App.tsx` | ReactDOM.createRoot render | ✓ WIRED | `createRoot(...)render(<App/>)` confirmed in file |
| `frontend2/src/App.tsx` | `frontend2/src/routes/index.tsx` | AppRoutes named import from "@/routes" | ✓ WIRED | `import { AppRoutes } from "@/routes"` present |
| `.github/workflows/lint-frontend2.yml` | `scripts/check-forbidden-imports.mjs` | node scripts/check-forbidden-imports.mjs step | ✓ WIRED | Confirmed in workflow jobs.forbidden-imports.steps |
| `.github/workflows/lint-frontend2.yml` | `frontend2/package.json` lint:tsc script | `cd frontend2 && bun run lint:tsc` step | ✓ WIRED | Confirmed in workflow jobs.typecheck-frontend2.steps |
| `.planning/research/CARRY-FORWARD.md` | `frontend2/src/lib/api.ts` | Port Verbatim row 1 references SHA 3826d24 | ✓ WIRED | SHA 3826d24 cited in Port Verbatim row 1 |
| `.planning/research/CARRY-FORWARD.md` | Phase 13 dashboard rollups | Backend Endpoint Specs section | ✓ WIRED | /stats/capacity and /stats/activity with response shapes present |

### Data-Flow Trace (Level 4)

Not applicable — no dynamic data-rendering components in Phase 1. The placeholder shell renders static text only. The lib/api.ts and lib/queryClient.ts files are utility/config, not rendering components.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `bun run lint:tsc` exits 0 | `cd frontend2 && bun run lint:tsc` | Exit code 0 | ✓ PASS |
| `bun run build` exits 0 | `cd frontend2 && bun run build` | Exit code 0; dist/index-BD9RvfEc.js 256 kB / 81 kB gzip | ✓ PASS |
| `bun run lint:imports` exits 0 | `cd frontend2 && bun run lint:imports` | Exit code 0; "check-forbidden-imports: OK" | ✓ PASS |
| No devtools strings in dist/ | `! grep -rq '__react-query-devtools' dist/` | No matches found | ✓ PASS |
| Placeholder text in bundle | `grep -o 'frontend2.*placeholder shell' dist/assets/*.js` | "frontend2 — v3.0 placeholder shell" found | ✓ PASS |
| i18n spike tag exists | `git tag -l spike/i18n-decision-evidence` | Tag exists | ✓ PASS |
| Spike branch not merged | `git rev-parse --abbrev-ref HEAD` | master (spike branch separate) | ✓ PASS |
| Dev server DOM render | Headed browser needed | N/A | ? SKIP (human needed) |
| CI negative gate test | Real GitHub PR needed | N/A | ? SKIP (human needed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOUND-01 | 01-01 | Vite + React 19 + TS + Tailwind 4 + RR7 + TanStack Query + RHF + zod SPA scaffold boots at localhost:5173 | ✓ SATISFIED | Scaffold built and verified; build exits 0; lint:tsc clean; all stack deps in package.json |
| FOUND-02 | 01-02 | CI-enforced online-only constraint via check-forbidden-imports.mjs in merge gate | ✓ SATISFIED | .github/workflows/lint-frontend2.yml with two jobs; paths filter; local smoke script exits 0 |
| FOUND-03 | 01-04 | Carry-forward audit at .planning/research/CARRY-FORWARD.md with port-verbatim vs rebuild enumeration | ✓ SATISFIED | CARRY-FORWARD.md exists, 92 lines, 9 numbered table rows, 5 port items with SHAs, 4 rebuild concepts |
| FOUND-04 | 01-03 | i18n library decision resolved empirically — Lingui v6 vs react-intl spike, decision locked in I18N-DECISION.md | ✓ SATISFIED | I18N-DECISION.md with evidence; Lingui v6 installed; SWC plugin exact-pinned; locale scaffolds created |
| FOUND-05 | 01-04 | Mobile FAB scope explicitly resolved, recorded in v3.0 milestone scope | ✓ SATISFIED | D-05..D-08 in STATE.md Decisions section |
| FOUND-06 | 01-04 | Dashboard backend rollups decision recorded, backend coordination kicked off if shipping | ✓ SATISFIED | D-09..D-11 in STATE.md; endpoint specs in CARRY-FORWARD.md; decision: ship without feature flag (no prod env) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend2/src/routes/index.tsx` | 10 | `<h1>frontend2 — v3.0 placeholder shell</h1>` — intentional placeholder text | ℹ Info | Expected — Phase 1 ships a placeholder shell by design; downstream phases (5+) replace routes with real components |

No blocking anti-patterns found. The placeholder in routes/index.tsx is intentional by Phase 1 design.

### Human Verification Required

#### 1. Placeholder shell renders in browser

**Test:** Run `cd frontend2 && bun run dev`, then open `http://localhost:5173/` in a browser.
**Expected:** The page body shows the text "frontend2 — v3.0 placeholder shell" rendered by React.
**Why human:** CSR SPA — curl against the dev server returns only `<div id="root"></div>`. React renders the content client-side. The text IS confirmed in the production bundle (grep found it in dist/assets/index-BD9RvfEc.js), but end-to-end DOM rendering requires a headed browser.

#### 2. CI forbidden-imports merge gate fails on regression

**Test:** Create a throwaway branch, add `import "idb";` to any file under `frontend2/src/`, push as a PR to the repository.
**Expected:** The `forbidden-imports` job on the `lint-frontend2` GitHub Actions workflow fails red, blocking the PR merge.
**Why human:** Requires a real GitHub Actions runner with push permissions to the repo. Cannot simulate from CLI.

### Gaps Summary

No blocking gaps. All 6 must-have truths are VERIFIED against the actual codebase. The two human verification items above are behavioral/environmental checks that cannot be automated from the CLI — they do not indicate missing implementation.

One minor administrative observation: STATE.md frontmatter `status:` says "executing" (current Wave 2 state) rather than "Phase 1 plans created; ready for execution" as specified by Plan 01-04 Task 2. The substantive content (D-05..D-11 decisions) is present and correct. The Session Continuity block (line 172) records Wave 2 execution state. This is a cosmetic discrepancy only — the orchestrator updated decisions but preserved the execution-state status. Not a blocker.

---

_Verified: 2026-05-01T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
