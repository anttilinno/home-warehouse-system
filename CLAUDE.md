# Home Warehouse System — Contributor Notes

Short runbook for automated tests that cross the real HTTP boundary. For
planning, architecture, and requirements see `.planning/`.

## E2E Tests (Playwright)

19 specs live in `frontend/e2e/*.spec.ts`: a11y-sweep, analytics,
attachments-paperless, auth, borrowers, command-palette, inventory, items,
keyboard-nav, loans-lifecycle, login-dashboard, offline-replay,
repairs-maintenance, responsive, scan-lookup, settings, sse-online,
system-group, taxonomy. `.github/workflows/e2e-frontend.yml` runs all of
them against a real backend + Postgres + vite preview build on every
push/PR touching `frontend/**`; every spec is a hard merge gate except
`a11y-sweep.spec.ts`, which stays `continue-on-error: true` (flaky against
third-party component internals).

`login-dashboard.spec.ts` (2026-06-11, retro-os sample screens) is the
foundational one: real `/login → / dashboard` flow against the real
backend + Postgres. It guards the cookie-JWT login contract, the Vite
`/api` → root proxy **rewrite** (backend routes live at root, e.g.
`/auth/login` — the rewrite in `vite.config.ts` is load-bearing), and the
dashboard's binding to `/analytics/dashboard` + `/analytics/activity`.

### Run locally

1. Start Postgres if it is not already up:
   `docker compose up -d postgres` (service name may vary — check
   `docker-compose.yml`). The dev DB is `warehouse_dev` and the server expects
   a connection on `localhost:5432`.
2. Start the backend:
   `cd backend && go run ./cmd/server/main.go` (or whichever command your
   local workflow uses — the API listens on port **8080**).
3. Start the frontend dev server:
   `cd frontend && bun run dev` (Vite serves on **5173** and proxies `/api`
   to `:8080`).
4. Ensure a seeder user exists in the dev DB. Defaults:
   `E2E_USER=seeder@test.local`, `E2E_PASS=password123` (override either via
   env var).
5. Run the suite:
   `cd frontend && E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e`

For debugging with a visible browser window:
`bun run test:e2e:headed`.

### Add a new spec

Drop new files in `frontend/e2e/*.spec.ts`. The config (`playwright.config.ts`)
has one project (`chromium`) — Playwright drives its own bundled browser, never
system Firefox/Zen, so a second project only adds a download for no coverage.
`baseURL` defaults to `http://localhost:5173`; override with
`E2E_BASE_URL=...` if you need to point at a deployed environment.

Auth contract (useful for future specs):

- `/login` → fill `Email` + `Password` labels → click the submit button
  matching `/^log in$/i` (DOM text is "Log in"; uppercase comes from CSS).
  The v3.0 page has a single submit button — OAuth buttons return in
  Phase 5; when they land, switch back to exact-match discipline.
- After login the browser holds the `access_token` as an HTTP cookie. Both
  the page context AND `page.request` inherit that cookie, so additional API
  calls in the spec do not need manual token plumbing.
- For API-only seeding use `page.request.post("/api/workspaces/{wsId}/...")`.

## Backend Integration Tests (Go)

The first backend integration test landed in Phase 65 Plan 65-11 (G-65-01
gap closure, Branch B of Option C). It exercises the real
`GET /api/workspaces/{wsId}/items/by-barcode/{code}` handler against a real
Postgres via the `tests/testdb` harness. Any revert of Plan 65-09 breaks it;
the cross-tenant 404 subtest also guards the
`WHERE barcode = $2 AND workspace_id = $1` repo clause (Pitfall #5).

Many more tests now sit behind the same `//go:build integration` tag (repo
tests, `tests/integration/`). **They are NOT parallel-safe across
packages** — they share the single `warehouse_test` DB and
truncate/seed each other's rows, so a plain `go test -tags=integration
./...` fails en masse. Always add `-p 1` to force serial package
execution; that's the correctness requirement, not a perf knob.

### Run locally

1. Start a Postgres instance with a `warehouse_test` database (override the
   URL if yours differs):
   `docker compose up -d postgres`
2. Apply migrations against the test DB (the existing migrate command —
   check `backend/cmd/` for the exact binary name).
3. Run the tagged suite from the backend directory:
   ```
   cd backend
   TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
     go test -tags=integration -count=1 -p 1 ./...
   ```
   (swap `./...` for a single package path, e.g.
   `./internal/domain/warehouse/item/...`, to scope a run — `-p 1` still
   applies even to a single-package run since it shares the DB with CI).

Without the `-tags=integration` flag these tests are invisible to
`go test ./...`, so the default local/CI path stays fast. Frontend-side
barcode-lookup coverage now exists: `frontend/e2e/scan-lookup.spec.ts`
(browser-level) plus unit coverage in `ScanPage.test.tsx`,
`ClaimPage.test.tsx`, `useScanResolve.test.ts`, and `lib/api/items.test.ts`.

## CI (GitHub Actions)

`.github/workflows/`:

- `test-backend.yml` — job `unit`: `go test ./...` (no tag, fast, no DB).
  Job `integration`: postgres:18 service, dbmate migrate `warehouse_test`,
  then `go test -tags=integration -count=1 -p 1 ./...`. Runs on PRs/pushes
  touching `backend/**`.
- `e2e-frontend.yml` — full Playwright suite (see above) against a real
  backend + Postgres + vite preview build.
- `lint-frontend.yml`, `security-backend.yml` — unchanged, lint/SAST only.

Before this landed, no CI workflow ran `go test` at all and e2e ran only
2/19 specs with `continue-on-error: true`; the 156 backend test files and
17 other e2e specs were ungated. See `PLAN-test-gaps.md` for the gap
analysis this closed.

## Pre-push quality gate

A git `pre-push` hook (`.githooks/pre-push`) gates new-code quality before it
reaches master. `mise run setup` enables it; otherwise run once:
`git config core.hooksPath .githooks`.

- **Backend:** `golangci-lint run --new-from-merge-base=origin/master`
  (config `backend/.golangci.yml`: goconst/gocognit/dupl/gosec + standard) plus
  `go build`. Only NEW regressions vs. master block; legacy findings don't. A
  bare `golangci-lint run` audits the whole tree on demand.
- **Frontend:** `format:check` (read-only `biome format src`, no `--write` —
  mirrors the build's `prebuild`/CI so format drift can't sit uncommitted and
  dirty a deploy tag), `biome lint --diagnostic-level=error` (blocks correctness
  errors; pre-existing style warnings don't), `tsc`, a **complexity gate**
  (`bun run lint:complexity` — ESLint + sonarjs, cyclomatic AND cognitive
  threshold 15; config `frontend/eslint.complexity.config.mjs`, the
  gocognit/gocyclo analog), and a **duplication ceiling** (`jscpd` over `src`,
  `--threshold 4`, the dupl analog). The tree is at zero functions over 15 and
  ~3% duplication, so legacy never trips either gate; a regression does.
  a **dead-code gate** (`bun run lint:dead` — knip, scoped to unused FILES +
  dependency drift; the barrel-export reporting is off, see `knip.json` rules).
  The tree is at zero functions over 15, ~3% duplication, and clean knip, so
  legacy never trips any gate; a regression does. Inspect on demand with
  `bun run lint:complexity` / `bun run lint:dup`.
- jscpd can't gate per-file (it globs within given paths), so the dup gate is a
  whole-tree ceiling rather than a strict new-from-base diff; complexity + knip
  gate the whole tree (safe — clean baseline).
- knip caveat: vite/CSS-only deps (`@fontsource/*`, `tailwindcss`,
  `@lingui/swc-plugin`, `rollup-plugin-visualizer`) are in `ignoreDependencies`
  (knip can't see CSS/vite usage).
- Runs only for the changed side of the tree. Bypass: `git push --no-verify`.

## Skills auto-loaded for this project

- **Sketch findings** → `Skill("sketch-findings-home-warehouse-system")`. Direction under revision (2026-06-11): Premium Terminal scrapped, replaced by Retro OS pastel — see `.planning/sketches/MANIFEST.md` for the current canonical direction.
