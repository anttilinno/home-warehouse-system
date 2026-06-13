# Phase 17 — Polish & Quality — CONTEXT

**Orchestrator-verified ground truth, 2026-06-14.** Final v3.0 phase. This is a
parity-VERIFICATION + hardening gate, NOT a feature build. Requirements
**POL-01..06**. After this passes, v3.0 is feature+quality complete.

## Goal (from ROADMAP §Phase 17)
Every cross-HTTP flow has ≥1 real-backend test (Playwright E2E + tagged Go
integration, the Phase-65-11 pattern); axe-playwright a11y sweep passes;
tab/keyboard navigation audit passes; bundle-size CI guard enforced; mobile
breakpoint matrix re-tested at 320/360/768/1024/1440 px; visual diff vs sketch
006; parity verification gate (route checklist + endpoint coverage diff).

## Requirements
- **POL-01** — every HTTP-crossing flow has ≥1 real-backend test (E2E + tagged Go integration).
- **POL-02** — `axe-playwright` sweep across every route: no contrast/focus-visible/touch-target/aria-label violations.
- **POL-03** — tab/keyboard nav audit: every page keyboard-navigable, focus-visible (not focus), no traps.
- **POL-04** — bundle-size CI guard: per-chunk budgets, regression fails CI with delta report.
- **POL-05** — mobile breakpoint matrix at 320/360/768/1024/1440 px + visual diff vs sketch 006.
- **POL-06** — parity verification gate: route checklist + endpoint coverage diff + E2E flow list + i18n + a11y/bundle across new pages.

## Verified current surface

### Build / bundle (baseline gzip, `bun run build` 2026-06-14)
| logical chunk | dist file prefix | gzip bytes | note |
|---|---|---|---|
| **main** | `index-*.js` | 197071 (~192 KB) | entry; react/router/query/all-eager-pages folded in (NO separate vendor chunk) |
| **charts** | `charts-*.js` | 106326 (~104 KB) | recharts+d3, lazy `/analytics` only |
| **scanner** | `scanner-*.js` | 54912 (~54 KB) | zxing/barcode-detector, lazy `/scan` only |
| **palette** | `palette-*.js` | 15127 (~15 KB) | cmdk + radix-dialog, lazy on first ⌘K |
| **messages** | `messages-*.js` ×3 | ~15-19 KB each | lingui locale catalogs (en/et/ru), code-split per-locale |
| (per-page) | `*Page-*.js` | <4 KB each | lazy settings/scan/analytics pages |

manualChunks rules live in `frontend2/vite.config.ts` (greppable data
structures: scannerModules/chartModules/paletteModules). There is **no `vendor`
chunk today** — react/router/query live in `index-*.js` (main). The POL-04
budget manifest must reflect this: budget keys = main / charts / scanner /
palette / messages (treat "vendor" SC wording as folded into main).

The per-phase bundle gates (11 scanner, 13b charts, 16 palette) were **ad-hoc
shell greps the orchestrator ran by hand** — NOT committed checks. POL-04
formalizes them into ONE committed manifest + node script + CI job. Model:
the repo-root `scripts/check-*.mjs` pattern (FOUND-02 forbidden-imports,
Phase-15 i18n guards) — pure node, `node --test` self-tests, wired into
`.github/workflows/lint-frontend2.yml`.

### CI (`.github/workflows/lint-frontend2.yml`)
Jobs today: forbidden-imports, i18n-format-guard, i18n-catalog-guard,
typecheck-frontend2, test-frontend2. **No E2E/browser job exists** — all 15
Playwright specs run LOCALLY against the dev stack (playwright.config.ts has
no webServer auto-launch). Bundle budget (POL-04) is cheaply CI-able (just
`vite build` + node, no backend). Browser E2E in CI (axe/responsive) needs
postgres+go-backend+vite service orchestration — a NEW capability; see OQ-1.

### E2E specs (`frontend2/e2e/`, 15 files, chromium+firefox projects)
analytics, attachments-paperless, auth, borrowers, command-palette, inventory,
items, loans-lifecycle, login-dashboard, repairs-maintenance, scan-lookup,
settings, sse-online, system-group, taxonomy. Auth contract per CLAUDE.md:
`/login` → fill Email+Password → submit `/^log in$/i`; cookie inherited by
`page.request`. `ControlOrMeta+k` for palette (tinykeys $mod = Ctrl on Linux CI).

### Go integration tests (48 `_test.go`, `//go:build integration`)
Broad coverage already: item/handler, attachment/handler+storage, loan, maintenance,
pendingchange, wishlist, import, auth, warehouse, permission, multitenant,
cross_workspace_fk, approval_pipeline, all postgres repos, etc. Run:
`TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test go test -tags=integration ./... `.

### Focus / a11y current state
- No global `:focus-visible` / outline rule in `styles/{globals,tokens}.css`.
- Components carry explicit `focus-visible:outline-2 outline-border-ink outline-offset-2` (12 component files; atoms RetroButton/Tabs/Input, Fab, skip-link in AppShell).
- AppShell has an `sr-only` skip-link (good). `@axe-core/playwright` is NOT yet a dep.
- POL-03 may add a single global `:focus-visible` fallback to `globals.css` as a safety net (surgical).

### Routes to sweep (POL-02/03/05) — public + app-shell
Public: `/login`, `/register`, `/auth/callback`.
App (under shell, need login): `/` (dashboard), `/items`, `/items/new`, `/items/:id`,
`/inventory`, `/inventory/new`, `/inventory/expiring`, `/maintenance/due`,
`/loans`, `/loans/new`, `/borrowers`, `/borrowers/new`, `/borrowers/:id`,
`/taxonomy`, `/scan`, `/analytics`, `/approvals`, `/my-changes`, `/sync-history`,
`/imports`, `/wishlist`, `/declutter`, `/settings` (+ /security /accounts /profile
/appearance /language /formats /notifications /data /members /paperless).
(`/demo` is DEV-only; `/claim/:code` needs a code; `:id` routes need seeded data —
sweep the static-path subset, plus one detail route with a seeded id.)

## Endpoint coverage diff (POL-06) — VERIFIED by orchestrator grep

Legacy `frontend/lib/api/*` vs `frontend2/src/lib/api/*` (excluding `/sync/*`+`/push/*`).
**Conclusion: parity essentially complete.** The investigator's first-pass "33
gaps" were almost all FALSE POSITIVES (auth/oauth/sessions/password/can-delete/
workspaces/analytics/labels/inventory-by-*/notifications-pagination all confirmed
present in frontend2). Genuine residual deltas, all non-feature-gaps:

| legacy endpoint | frontend2 status |
|---|---|
| `/analytics/{borrowers,categories,locations,conditions,statuses,loans}` (per-metric) | **superseded** — AnalyticsPage sources `/analytics/dashboard` + `/analytics/summary` aggregates + `/analytics/loans/monthly` + `/analytics/out-of-stock`; per-metric endpoints not needed |
| `/locations/{id}/breadcrumb` | **superseded** — taxonomy builds tree client-side (Phase 10), breadcrumb computed client-side |
| `/inventory/{id}/loans`, `/inventory/available/{itemId}`, `/inventory/total-quantity/{itemId}` | niche legacy queries; not used by any v3.0 screen — log as deferred, not a parity blocker |
| `/items/search?query=` | covered by command-palette `useEntitySearch` generic `/{domain}/search` (Phase 16) — confirm during plan |
| `/paperless/settings` DELETE | minor — PaperlessPage has settings GET/PATCH; delete optional |

Legacy files with no 1:1 frontend2 file but functionality ported elsewhere:
auth.ts→features/auth + settings.ts; item-photos.ts→photos.ts; repair-logs.ts→
repairs+repairPhotos+repairAttachments; search.ts→command-palette; workspace-backup→
settings export/import; importexport.ts→importJobs.ts + settings.

→ POL-06 deliverable is a COMMITTED diff doc recording the above (no feature code
to port). The handful of superseded endpoints are documented as "covered
differently"; the 3 niche inventory queries logged as deferred backlog.

## Open Questions (RESOLVED)

**OQ-1 — Does the axe/responsive sweep get wired into CI, or run locally only?**
RESOLVED: Bundle budget (POL-04) → committed CI job (cheap, backend-free,
orchestrator-verifiable by running the script locally). Browser sweeps
(POL-02/03/05) → Playwright specs that are the LOCAL phase gate (consistent with
all 15 existing specs, run against the live dev stack). A new `e2e-frontend2.yml`
workflow (postgres service + go backend + vite preview + playwright) is provided
as **best-effort** scaffolding but flagged a residue needing first-real-PR
validation (orchestrator cannot execute GitHub Actions, so per the "verification
is REAL" rule it is NOT claimed green). The HARD, verified gate for POL-02/03/05
is local spec execution against :5173/:8080.

**OQ-2 — Budget ceilings?** RESOLVED: baseline + ~10-15% headroom, rounded:
main 215000, charts 120000, scanner 65000, palette 20000, messages 22000 (gz
bytes, per chunk). Manifest is `frontend2/bundle-budget.json`. Script sums
`messages-*.js` to the largest single locale (they are alternates, not additive)
— budget each ≤22 KB. Delta report prints `chunk: cur/budget (Δ vs budget)`.

**OQ-3 — Coverage matrix gap-fill: write new tests or just document?**
RESOLVED: Document the matrix; only WRITE a test where a genuine HTTP-crossing
flow has ZERO real-backend coverage (E2E or Go). Given 15 E2E + 48 Go
integration tests, expect ≤1-2 genuine gaps; log over-build risk — do not
re-test already-covered flows.

**OQ-4 — POL-03 global focus fallback?** RESOLVED: add ONE surgical global
`*:focus-visible { outline }` fallback to `globals.css` (matches the existing
component token: 2px `--border-ink`, 2px offset) so any element missing an
explicit rule still shows a visible ring. Do not rip out the per-component
rules. Keyboard-nav spec asserts focus-visible reachability + ESC-closes-modal +
no-trap on a representative route set.

**OQ-5 — Visual diff vs sketch 006 (POL-05)?** RESOLVED: the responsive spec
captures dashboard screenshots at the 5 breakpoints as Playwright artifacts +
asserts the structural responsive contract (Bottombar↔Sidebar swap at 768,
no horizontal overflow). The pixel diff vs `006-retro-os-dashboard` PNG is a
human-eye residue (logged to FINAL-REVIEW-CHECKLIST) — automated structural
assertions are the hard gate.

## Plan decomposition (4 plans, 3 waves — config files single-writer)
- **17-01 (POL-04)** — bundle budget manifest + `scripts/check-bundle-budget.mjs` + self-tests + `lint:bundle` package.json script + CI job in lint-frontend2.yml. Owns: scripts/, frontend2/bundle-budget.json, frontend2/package.json, lint-frontend2.yml.
- **17-02 (POL-02+POL-03)** — `@axe-core/playwright` dep + `e2e/a11y-sweep.spec.ts` + `e2e/keyboard-nav.spec.ts` + global focus-visible fallback in globals.css + best-effort `e2e-frontend2.yml` CI workflow. Owns: frontend2/package.json (deps), e2e/a11y-sweep + keyboard-nav, styles/globals.css, NEW .github/workflows/e2e-frontend2.yml.
- **17-03 (POL-05)** — `e2e/responsive.spec.ts` (5-breakpoint matrix + dashboard screenshots). Owns: e2e/responsive.spec.ts.
- **17-04 (POL-01+POL-06)** — `COVERAGE-MATRIX.md` + `ENDPOINT-DIFF.md` (in phase dir) + gap-fill test(s) only where ZERO coverage. Owns: phase-dir docs + any new test file (disjoint name).

**Waves (config-file contention forces serialization):**
- Wave 1: 17-01 (sole writer of package.json + lint-frontend2.yml).
- Wave 2: 17-02 (writes package.json deps + NEW e2e-frontend2.yml — branch off post-17-01 HEAD to avoid package.json conflict).
- Wave 3: 17-03 ∥ 17-04 (disjoint new files; branch off post-17-02 HEAD).
