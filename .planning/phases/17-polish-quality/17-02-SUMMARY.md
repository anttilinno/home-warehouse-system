---
phase: 17-polish-quality
plan: 02
subsystem: frontend2-quality
tags: [a11y, axe, keyboard-nav, focus-visible, e2e, ci, POL-02, POL-03]
requires:
  - "17-01 (POL-04) — branched off post-17-01 HEAD so the package.json devDep append merges over lint:bundle"
provides:
  - "@axe-core/playwright devDependency (axe sweep capability)"
  - "frontend2/e2e/a11y-sweep.spec.ts — axe wcag2a/aa + target-size across swept routes"
  - "frontend2/e2e/keyboard-nav.spec.ts — focus-visible reachability + ESC-closes-modal + no-trap"
  - "global *:focus-visible fallback ring in globals.css"
  - "best-effort .github/workflows/e2e-frontend2.yml browser-E2E CI scaffold"
affects:
  - "frontend2/package.json + bun.lock (devDependencies)"
  - "frontend2/src/styles/globals.css (one appended rule, per-component rules untouched)"
tech-stack:
  added:
    - "@axe-core/playwright@4.11.3 (official Deque axe-core Playwright integration)"
  patterns:
    - "AxeBuilder({page}).withTags([wcag2a,wcag2aa]).options({rules:{target-size:{enabled:true}}}).analyze()"
    - "collect-all-then-assert: aggregate violations across routes, filter impact serious/critical, per-route+rule failure report"
    - "one-login-per-test (20/min auth limiter) + page.request seeding via /api/users/me/workspaces"
key-files:
  created:
    - "frontend2/e2e/a11y-sweep.spec.ts"
    - "frontend2/e2e/keyboard-nav.spec.ts"
    - ".github/workflows/e2e-frontend2.yml"
  modified:
    - "frontend2/package.json"
    - "frontend2/bun.lock"
    - "frontend2/src/styles/globals.css"
decisions:
  - "color-mix wrapper on --border-ink for the global focus ring degrades to solid --border-ink (always-visible ring, matches per-component token)"
  - "axe collect-all-then-assert (not bail-on-first) so a single run reports every failing route+rule"
  - "e2e-frontend2.yml spec step is continue-on-error: true — best-effort CI; LOCAL chromium run is the hard gate (OQ-1)"
metrics:
  duration: "~4 min (executor wall-clock)"
  completed: "2026-06-13"
  tasks: 3
  files: 6
---

# Phase 17 Plan 02: POL-02 axe a11y sweep + POL-03 keyboard nav Summary

Added repeatable accessibility + keyboard-navigation gates to frontend2: the
official Deque `@axe-core/playwright@4.11.3` devDependency, an axe WCAG 2.0/2.1
A+AA sweep (plus WCAG 2.2 `target-size`) across the static-path route surface and
one seeded item-detail route, a keyboard-nav spec proving focus-visible
reachability + ESC-closes-modal + no-trap, a single global `*:focus-visible`
safety-net ring in globals.css, and a best-effort `e2e-frontend2.yml` browser-E2E
CI scaffold flagged as needing first-real-PR validation.

## What shipped

### Task 1 — dep + global focus-visible fallback (commit 619310c7)
- `bun add -d @axe-core/playwright@^4` → resolved **4.11.3**; both `package.json`
  and `bun.lock` committed; `bun install --frozen-lockfile` stays green.
- Appended ONE `*:focus-visible` rule at the end of `globals.css`
  (`outline: 2px solid color-mix(in srgb, var(--border-ink) 100%, transparent);
  outline-offset: 2px;`), tagged `POL-03 / OQ-4 global focus-visible fallback`.
  The 20 per-component `outline-border-ink` files are untouched and win by
  specificity — this is a safety net only (threat T-17-02-02 mitigated).

### Task 2 — a11y-sweep.spec.ts (commit e2f55755)
- Two tests: public routes (no login) + app routes (one login).
- `AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).options({rules:{'target-size':{enabled:true}}}).analyze()`.
  The four POL-02 concerns are all covered: contrast + focus-visible + aria/label
  via the tag band, touch-target via the explicit `target-size` enable.
- Collects violations across ALL routes, asserts ZERO with impact
  serious/critical, and builds a per-route `route — rule [impact] (N nodes)`
  failure report.
- Seeds one item via `page.request.post("/api/workspaces/{wsId}/items", …)` (wsId
  discovered via `GET /api/users/me/workspaces`, unique `sku` per the contract)
  and sweeps `/items/{id}` (threat T-17-02-01: dev/test DB only, unique throwaway name).

### Task 3 — keyboard-nav.spec.ts + e2e-frontend2.yml (commit 26ed21a6)
- `keyboard-nav.spec.ts` (chromium-stable): (1) Tab moves focus AND a focused
  element shows a visible outline ring (`getComputedStyle(document.activeElement)`
  outlineStyle≠none, outlineWidth>0); (2) `ControlOrMeta+k` opens the palette,
  `Escape` hides it with no route change (no logout/nav); (3) repeated Tab outside
  any modal reaches >1 distinct element (no single-widget trap).
- `.github/workflows/e2e-frontend2.yml` — NEW best-effort workflow: postgres:18
  service (wh/wh), dbmate migrations, `cmd/seed all`, `go build ./cmd/server` on
  :8080 (health-polled at `/health`), `bun run build` + `vite preview` on :4173,
  `bunx playwright install --with-deps chromium`, then the a11y+keyboard specs with
  `continue-on-error: true`. Header comment states plainly it is BEST-EFFORT and
  not yet proven green. `lint-frontend2.yml` is untouched (17-01 owns it).

## Routes the a11y spec sweeps

Public (no login): `/login`, `/register`, `/auth/callback`.

App (one login):
`/`, `/items`, `/items/new`, `/inventory`, `/inventory/new`,
`/inventory/expiring`, `/maintenance/due`, `/loans`, `/loans/new`, `/borrowers`,
`/borrowers/new`, `/taxonomy`, `/scan`, `/analytics`, `/approvals`, `/my-changes`,
`/sync-history`, `/imports`, `/wishlist`, `/declutter`, `/settings`,
`/settings/security`, `/settings/accounts`, `/settings/profile`,
`/settings/appearance`, `/settings/language`, `/settings/formats`,
`/settings/notifications`, `/settings/data`, `/settings/members`,
`/settings/paperless`, PLUS one seeded `/items/{id}` detail route.

## Package legitimacy

`@axe-core/playwright` — official Deque Systems integration (scope `@axe-core`,
same org as `axe-core`). Resolved 4.11.3 via `bun add`. Status **[LEGIT]** per the
plan's package_legitimacy block (publisher dequelabs, hundreds-of-thousands weekly
downloads). No blocking human checkpoint required.

## Verification performed (local, by executor)

- `cd frontend2 && bun install --frozen-lockfile` → clean (lockfile in sync).
- `cd frontend2 && bun run lint:tsc` → green (all three spec/style edits typecheck).
- `cd frontend2 && bun run build` → green; built CSS contains `focus-visible`.
- `lint:imports` (D-05 forbidden-imports guard) → OK; no `sync`/`idb`/`offline`
  filenames or imports introduced.
- `lint-frontend2.yml` confirmed UNCHANGED by this branch; 6 intended files
  changed; 20 per-component `outline-border-ink` focus rules intact.
- NOT run locally (per orchestrator instruction): live chromium a11y/keyboard
  specs — the dev stack on :5173 serves the MAIN checkout, not this worktree. The
  orchestrator runs them post-merge against the merged tree (17-VALIDATION).

## Deviations from Plan

None — plan executed exactly as written. (Verb-style task commits + one final docs
commit; all three task commits are atomic per the protocol.)

## Self-Check: PASSED

- FOUND: frontend2/e2e/a11y-sweep.spec.ts
- FOUND: frontend2/e2e/keyboard-nav.spec.ts
- FOUND: .github/workflows/e2e-frontend2.yml
- FOUND: globals.css global :focus-visible rule
- FOUND commit 619310c7 (Task 1)
- FOUND commit e2f55755 (Task 2)
- FOUND commit 26ed21a6 (Task 3)
