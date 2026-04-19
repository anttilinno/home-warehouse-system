# Home Warehouse System — Contributor Notes

Short runbook for automated tests that cross the real HTTP boundary. For
planning, architecture, and requirements see `.planning/`.

## E2E Tests (Playwright)

The first browser-level regression test landed in Phase 65 Plan 65-11 (gap
closure for G-65-01). It exercises `/scan → manual entry → MATCHED banner`
against the real backend + real Postgres. Any revert of Plan 65-09 (the
`GET /items/by-barcode/{code}` route) or Plan 65-10 (the
`itemsApi.lookupByBarcode` swap) will fail this test.

### Run locally

1. Start Postgres if it is not already up:
   `docker compose up -d postgres` (service name may vary — check
   `docker-compose.yml`). The dev DB is `warehouse_dev` and the server expects
   a connection on `localhost:5432`.
2. Start the backend:
   `cd backend && go run ./cmd/server/main.go` (or whichever command your
   local workflow uses — the API listens on port **8080**).
3. Start the frontend dev server:
   `cd frontend2 && bun run dev` (Vite serves on **5173** and proxies `/api`
   to `:8080`).
4. Ensure a seeder user exists in the dev DB. Defaults:
   `E2E_USER=seeder@test.local`, `E2E_PASS=password123` (override either via
   env var).
5. Run the suite:
   `cd frontend2 && E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e`

For debugging with a visible browser window:
`bun run test:e2e:headed`.

### Add a new spec

Drop new files in `frontend2/e2e/*.spec.ts`. The config (`playwright.config.ts`)
has two projects (`chromium` + `firefox`) — specs run in both by default.
`baseURL` defaults to `http://localhost:5173`; override with
`E2E_BASE_URL=...` if you need to point at a deployed environment.

Auth contract (useful for future specs):

- `/login` → fill `email` + `password` labels → click the submit-type button
  matching `^LOG IN$` (exact match — the page also has an OAuth "Sign in with
  Google" button and a page-toggle "LOGIN" button).
- After login the browser holds the `access_token` as an HTTP cookie. Both
  the page context AND `page.request` inherit that cookie, so additional API
  calls in the spec do not need manual token plumbing.
- For API-only seeding use `page.request.post("/api/workspaces/{wsId}/...")`.
