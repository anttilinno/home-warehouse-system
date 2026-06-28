# Backend Security & Performance Audit — 2026-06-28

Static + dynamic audit of the Go backend (`backend/`, ~140k LOC, ~759 huma
endpoints, chi router, pgx+sqlc, JWT + workspace multi-tenancy, Redis/asynq).
Security and performance weighted equally. Scope and method:
`.claude/plans/create-plan-to-run-snoopy-turing.md`.

## TL;DR

- **One real High, now fixed + verified:** 11 reachable dependency CVEs (incl. a
  pgx SQL-injection and an x/net HTTP/2 DoS). Closed by dep bumps + Go toolchain
  bump; `govulncheck ./...` now reports **0 reachable**. All 52 unit packages and
  the full integration suite pass on the new versions.
- **Both prior known issues are CLOSED in current code:** the cross-tenant
  attachment IDOR (workspace-scoped queries + a 404-on-cross-tenant guard) and the
  broken logout revocation (session row deleted; replayed refresh → 401). A new
  25-subtest IDOR guard locks the regression down.
- **One new Medium found by the dynamic IDOR test:** `GET /items/{id}` and
  `GET /inventory/{id}` return **HTTP 500 instead of 404** for any not-found id.
  Not a data leak (scoping works), but an error-mapping bug.
- **One process gap:** `mise run test-integration` never actually ran the
  integration suite (missing `-tags=integration`). Fixed.
- **Performance is healthy at the seeded scale** (p95 2.2ms, p99 3.5ms, 0% errors
  at 233 rps / 50 VUs) — but the dev DB has only 64 items, so volume-dependent
  issues (seq scans, index gaps) are out of view. Needs a volume-seeded re-run.
- Scanner scare-flags (path traversal, open redirect, insecure cookies) are
  **false positives** against the real code — see the dispositions below.

---

## Tooling installed

All one-shot installs; pinned versions used in this run.

| Tool | Version | Use |
|------|---------|-----|
| govulncheck | v1.5.0 | Go CVE scan w/ reachability |
| osv-scanner | 2.4.0 | lockfile vs OSV |
| gosec | (dev/master) | Go SAST |
| semgrep | 1.168.0 | rule-based SAST |
| gitleaks | 8.30.1 | secret scan (tree + history) |
| trivy | 0.71.2 | fs/config/secret scan |
| schemathesis | 4.21.10 | OpenAPI fuzzing |
| k6 | 2.0.0 | load test |
| benchstat | (latest) | benchmark compare |
| OWASP ZAP | stable (docker) | passive DAST |

Install commands and CI wiring are in `.mise.toml` (`audit-sec`, `loadtest`) and
`.github/workflows/security-backend.yml`.

---

## Security findings

### S1 — HIGH (FIXED): 11 reachable dependency CVEs

`govulncheck` found 11 vulnerabilities reachable from called code:

| CVE | Module | Fixed in | Note |
|-----|--------|----------|------|
| GO-2026-5004 | jackc/pgx/v5 v5.8.0 | **v5.9.2** | **SQL injection** via dollar-quoted placeholder confusion (reached via `ImportJobRepository.FindErrorsByJobID`) |
| GO-2026-4918 | golang.org/x/net v0.47.0 | **v0.53.0** | HTTP/2 transport infinite loop (DoS) |
| GO-2026-5066/5062/5061/4961 | golang.org/x/image v0.41.0 | **v0.43.0** | TIFF/WebP decode panics (reached via image hasher/validator) |
| GO-2026-5039/5037/4986/4977/4971 | Go stdlib go1.25.9 | **go1.25.11** | net/textproto, crypto/x509, net/mail (quadratic), net |

**Fix applied & verified.** `go get` bumped pgx→v5.9.2, x/net→v0.53.0,
x/image→v0.43.0; `go.mod` toolchain → go1.25.11. `go build ./...` OK,
`govulncheck ./...` → **0 reachable**, 52 unit packages + full integration suite
green. (govulncheck still lists ~6 import-only / ~15 require-only vulns that are
*not* reachable from this code — informational, no action.)

### S2 — MEDIUM (open): not-found returns 500 instead of 404

`GET /workspaces/{ws}/items/{id}` and `…/inventory/{id}` return **HTTP 500** for
any id not present in the caller's workspace (own-workspace not-found and
cross-tenant id alike). Locations/categories/borrowers correctly return 404.

- **Not an IDOR** — the handler is workspace-scoped (`getItem` passes
  `workspaceID` to `svc.GetByID`); no cross-tenant data is returned. The new IDOR
  guard confirms no 2xx leak.
- **Root cause:** the repo returns `shared.ErrNotFound` on no rows
  (`internal/infra/postgres/item_repository.go:FindByID`), but the handler maps
  only the domain sentinel `item.ErrItemNotFound` → 404
  (`internal/domain/warehouse/item/handler.go:260` `getItem`), so the mismatch
  falls through to `huma.Error500InternalServerError`. Same shape for inventory.
  A regression from the "repository now returns shared.ErrNotFound" refactor.
- **Impact:** broken client error handling, 500s polluting logs/metrics, masking
  of real server errors. Low security weight, real correctness cost.
- **Fix:** map `shared.ErrNotFound` → 404 — either in the item/inventory handlers
  (`errors.Is(err, shared.ErrNotFound)`) or, better (covers every handler at
  once), translate `shared.ErrNotFound` centrally where domain errors become huma
  errors. Add the strict `==404` assertion back to the IDOR test once fixed.

### S3 — LOW: item-photo tenant isolation depends on a compensating check

`itemphoto.Repository.GetByID` uses the unscoped query
(`item_photos.sql:GetByID WHERE id=$1`); every handler currently compensates with
an explicit `photo.WorkspaceID != workspaceID → 404/ErrUnauthorized` check, so it
is **not exploitable today**. It is fragile — a future caller that forgets the
check leaks cross-tenant. A scoped query `GetByIDInWorkspace`
(`item_photos.sql:WHERE id=$1 AND workspace_id=$2`) already exists; point the repo
at it.

### S4 — LOW: scheduler/worker internal servers lack ReadHeaderTimeout

gosec G112 on `cmd/scheduler/main.go` and `cmd/worker/main.go` — the internal
HTTP servers (metrics/health) have no `ReadHeaderTimeout` (slowloris). The main
API server is unaffected (it sets `ReadTimeout: 15s`). One-line fix each.

### S5 — LOW: Dockerfile has no HEALTHCHECK

trivy DS-0026. Add a `HEALTHCHECK` to `backend/Dockerfile`.

### Scanner flags dispositioned as FALSE POSITIVES

Verified against the real code (read-only review):

- **Path traversal (gosec G703 ×19)** — all FP. Upload paths are UUID-renamed via
  `os.CreateTemp`; `local_storage` whitelist-sanitizes filenames and enforces
  base-dir containment via `filepath.Rel` (`internal/infra/storage/local_storage.go`).
  Original upload filenames are stored as display metadata only, never path-joined.
- **Open redirect (gosec G710 / semgrep ×3)** — all FP. OAuth/Authelia redirect
  targets are built from server config (`cfg.AppURL`) + opaque server codes;
  shortlink redirects are server-built **internal relative paths** with a
  hard-sanitized `[a-z]{1,8}` locale. No user-controlled redirect host.
- **Insecure cookies (gosec G124 / semgrep ×4)** — FP. `access_token` and
  `refresh_token` are `HttpOnly; SameSite=Lax`; `Secure` is conditional on prod
  (`config.SecureCookies`, on for `APP_ENV=production` or https AppURL). Confirmed
  live: dev omits `Secure` (correct), prod adds it. (One cosmetic nit: the OAuth
  logout *clear* cookie at `oauth/handler.go:163` omits Secure/SameSite — harmless,
  it only clears.)
- **JWT alg confusion** — FP. Keyfunc asserts `*jwt.SigningMethodHMAC`; rejects
  RSA/EC/`none` (`internal/shared/jwt/jwt.go`).
- **`?token=` query-param log leak** — FP. The request logger records `r.URL.Path`
  only, never the raw query, so the SSE fallback token can't hit access logs.
- **gitleaks (748 hits)** — FP. 740 are SonarQube JSON exports
  (`docs/sonarqube/*.json`, hash IDs); the rest are test fixtures / planning-doc
  strings. No live production secret. (The dev `JWT_SECRET` in `.mise.toml` is
  dev-only and config refuses it without `DEBUG=true`.)

### Prior known issues — re-verified CLOSED

- **Cross-tenant attachment IDOR** → CLOSED. `GetFile`/`GetAttachment` queries are
  `WHERE id=$1 AND workspace_id=$2`; serve handler 404s on cross-tenant. New guard
  `TestCrossTenantIDOR_DirectObjectAccess` (25 subtests over items/inventory/
  locations/categories/borrowers, two attack vectors) is green.
- **Broken logout revocation** → CLOSED. Logout hashes the refresh cookie, deletes
  the session row (`DELETE … WHERE id=$1 AND user_id=$2`), clears cookies; a
  replayed refresh JWT then misses `FindByTokenHash` → 401. No re-create fallback.
  (Residual, by-design: a stateless access JWT stays valid until its 24h exp after
  logout — standard JWT tradeoff; add a jti denylist only if instant kill is
  required.)

### Dynamic security notes

- **ZAP baseline:** 0 FAIL, 66 PASS, 1 informational (cacheable content). The
  `SecurityHeaders` middleware is effective.
- **schemathesis:** only **2 of ~759 operations** are testable — the base huma
  instance publishes `/openapi.json`, but the rate-limited / oauth / authelia /
  protected / workspace instances all set `OpenAPIPath=""`
  (`internal/api/router.go`). The protected + workspace API has no published
  contract for external schema testing/fuzzing. The 2 public ops accept undeclared
  HTTP methods without 405 (informational). Consider publishing a combined spec
  (even gated) so the real surface is fuzzable.

---

## Performance findings

Method: pg_stat_statements (dev), k6 ramp to 50 VUs over 55s, EXPLAIN ANALYZE.

- **Load result:** p95 **2.17ms**, p99 **3.46ms**, **0% errors** at 233 rps; all
  thresholds (p95<500ms, err<1%) pass. No 5xx under load.
- **No true N+1.** List endpoints batch-load photos once per request, not per row.
- **P1 — membership check is an uncached per-request DB hit.** The `Workspace`
  middleware runs `SELECT … FROM workspace_members WHERE workspace_id AND user_id`
  on **every** authed request (12,930 calls in the run = 5×iterations). Cheap now
  (0.011ms, composite-indexed) but a caching candidate (membership rarely changes)
  if request volume grows. Low priority.
- **Heaviest query** is the categories-analytics `COUNT(DISTINCT)` aggregate
  (0.237ms mean, 37% of total time); index-scans the category side, seq-scans the
  64-row items table (planner-correct at this size). Watch at scale.
- **Index review is inconclusive by design.** 165 indexes exist; 97 showed
  `idx_scan=0` — but Postgres was freshly restarted, so the stats window is just
  the 1-minute load test. **Do not drop indexes on this basis.** A real unused-index
  analysis needs days of production `pg_stat_user_indexes` accumulation.
- **Scale caveat (important):** the dev DB holds ~64 items. Latency/correctness are
  validated; seq-scan-vs-index behaviour at 10k–100k rows is **not**. Re-run
  `mise run loadtest` against a volume-seeded workspace before any production
  scaling claim.
- **pprof** is now wired (debug-gated, see below) but a meaningful CPU/heap profile
  needs a volume load — the app is not CPU-bound at this scale.

---

## Changes applied in this audit

Code/infra (verified: build OK, govulncheck 0, unit + integration suites green):

- **Dep bumps** (`backend/go.mod`, `go.sum`): pgx v5.9.2, x/net v0.53.0,
  x/image v0.43.0, toolchain go1.25.11. *(Closes S1.)*
- **New IDOR guard** `backend/tests/integration/cross_tenant_idor_test.go` —
  25 subtests, two attack vectors, asserts no 2xx cross-tenant leak.
- **pprof, debug-gated** `backend/cmd/server/main.go` — `net/http/pprof` on a
  separate server, served only when `PPROF_ADDR` is set (never exposed in prod by
  default).
- **pg_stat_statements** on `docker-compose.yml` `postgres-dev` (dev-only).
- **`mise run test-integration` fixed** — added `-tags=integration` so the suite
  actually runs (it silently ran nothing before). *(Process gap.)*
- **New mise tasks** `audit-sec` (govulncheck + gosec + gitleaks) and `loadtest`
  (k6); k6 script at `backend/tests/load/dashboard.js`.
- **CI** `.github/workflows/security-backend.yml` — govulncheck, osv-scanner,
  gosec, gitleaks, trivy-fs on backend changes.
- **pre-push** `.githooks/pre-push` — `govulncheck ./...` added to the backend
  block (skips with a notice if not installed).

## Recommended follow-ups (not applied)

1. **S2** — map `shared.ErrNotFound` → 404 (central error translator preferred);
   then restore the strict `==404` assertion in the IDOR test.
2. **S3** — point `itemphoto.Repository.GetByID` at `GetByIDInWorkspace`.
3. **S4/S5** — `ReadHeaderTimeout` on scheduler/worker servers; Dockerfile HEALTHCHECK.
4. Publish a combined OpenAPI spec (even auth-gated) so schemathesis can fuzz the
   real surface.
5. Re-run the load test against a volume-seeded workspace (10k+ items); only then
   draw seq-scan / unused-index conclusions.

## Reproduce

```
# Static
cd backend && govulncheck ./... && gosec -severity medium ./...
gitleaks detect --source . --no-banner

# Dynamic (stack up: docker compose up -d postgres-dev redis; mise run migrate; mise run seed all; mise run run)
GO_TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test?sslmode=disable \
  go test -tags=integration -count=1 -run TestCrossTenantIDOR ./tests/integration/ -v
mise run loadtest   # set WS=<workspace-uuid>
```
