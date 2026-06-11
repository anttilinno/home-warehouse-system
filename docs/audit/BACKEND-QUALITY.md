# Code Quality & Architecture Audit — Go Backend

Date: 2026-06-11. Scope: `backend/` — Go 1.25 / chi + huma v2 / sqlc + pgx v5 / Postgres / Redis (custom queue + asynq). Security findings live in [BACKEND-SECURITY.md](BACKEND-SECURITY.md); this report covers correctness, robustness, maintainability, performance.

## Top 10 by priority

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| 1 | HIGH | PATCH /items wipes omitted fields | `item/handler.go:326` + `entity.go:161` |
| 2 | HIGH | Restore silently drops inventory/loans/attachments | `workspace_restore.go:751-765` |
| 3 | HIGH | Pagination clamp mismatch → import caches capped at 100 rows | `shared/pagination.go:28` + `import_worker.go:276+` |
| 4 | HIGH | `Config.Validate()` never called | `config.go:114`, all `cmd/*/main.go` |
| 5 | HIGH | Loan create/return lacks tx (known WR-01) | `loan/service.go:96,134` |
| 6 | HIGH | Committed 16MB+14MB binaries | `backend/main`, `backend/photo-admin` |
| 7 | HIGH | Batch conflict `server_data` is always `{}` | `batch/service.go:442` |
| 8 | MED | Custom Redis queue: job loss on crash, no DLQ, non-idempotent retries | `infra/queue/redis_queue.go:67,137` |
| 9 | MED | Empty `if err != nil {}` block swallows movement errors | `inventory/service.go:233` |
| 10 | MED | 500 handlers never log the cause | `middleware/errors.go:39` (central fix point) |

---

## 1. Error Handling

### HIGH — Workspace restore silently drops inventory, loans, and attachments

`internal/domain/importexport/workspace_restore.go:751-765`

```go
func (s *WorkspaceBackupService) importInventory(...) []ImportError {
	// TODO: Implement inventory import
	return []ImportError{}
}
// importLoans, importAttachments: same — stub + empty error slice
```

`ImportWorkspace` (line 77-85) calls these and reports **zero errors**, so a user restoring a backup believes it succeeded while all inventory rows, loans, and attachments are discarded. Silent data loss. Fix: implement, or return a per-entity `ImportError{Message: "inventory restore not supported"}` so the result surfaces the gap.

### HIGH — Swallowed error with empty block (no logging at all)

`internal/domain/warehouse/inventory/service.go:233-236`

```go
if err != nil {
	// Log error but don't fail the move operation
	// Movement tracking is supplementary
}
```

The comment claims logging; the block is empty. Movement audit records vanish with no trace. Fix: inject a logger and log at WARN, or return a partial-success indicator.

### MEDIUM — Handlers discard root causes when returning 500

Pattern repeated across handlers, e.g. `internal/domain/warehouse/item/handler.go:95`:

```go
if err != nil {
	return nil, huma.Error500InternalServerError("failed to list items")
}
```

`err` is never logged anywhere (the structured logger middleware logs status/latency only). Production 500s are undiagnosable. Fix: log `err` in the `ErrorTransformer` fallback path (`internal/api/middleware/errors.go:39`) — one change covers every handler.

### MEDIUM — `inventory/handler.go` private error mapper contradicts the global one and leaks internals

`internal/domain/warehouse/inventory/handler.go:395-411`

```go
var apiErr *apierror.APIError
if errors.As(err, &apiErr) {
	return huma.Error400BadRequest(apiErr.Error())   // ignores apiErr.HTTPStatus
}
fmt.Printf("[inventory] %s: %v\n", fallbackMsg, err)
return huma.Error500InternalServerError(fmt.Sprintf("%s: %v", fallbackMsg, err)) // raw err → client
```

Three problems: APIError status downgraded to 400, raw error text (incl. pgx messages) in the 500 body, `fmt.Printf` logging. Fix: delete this mapper, use `appMiddleware.MapDomainError` like the other 20 domains.

### MEDIUM — `==` vs `errors.Is` inconsistency on sentinels

`internal/domain/warehouse/item/handler.go:203, 290-296, 337, 373, 423, 457, 520, 540, 558` use `if err == ErrItemNotFound`, while lines 170 and 490 in the same file use `errors.Is`. Any future wrapping silently breaks the `==` sites into 500s. Fix: mechanical sweep to `errors.Is`.

### MEDIUM — Import worker ignores persistence errors throughout

`internal/worker/import_worker.go:150, 185, 219, 231, 291, 338, 429, 513, 581, 750` — `w.importRepo.SaveJob(ctx, job)` / `SaveError(...)` return values dropped. Also `existingLocations, _, _ := locationRepo.FindByWorkspace(...)` (lines 276, 364, 611, 621, 628): a failed cache load proceeds with an empty cache, so every row referencing a location/item fails with misleading "not found" errors.

### LOW — Three logging systems coexist

`slog` (middleware only, 13 refs), stdlib `log` (18 files: jobs, worker, router, item handler), `fmt.Printf` (`importexport/workspace_backup.go:135`, `inventory/handler.go:410`, `infra/events/broadcaster.go:105`). Fix: standardize on the existing slog logger via injection.

### LOW — `apierror.APIError` cannot carry a cause

`internal/shared/apierror/error.go` has no wrapped-error field / `Unwrap`, so converting a repo error into an APIError destroys the chain. Combined with three parallel error vocabularies (APIError, `shared.DomainError`+sentinels, raw huma errors), handlers pick conventions ad hoc.

**Clean:** `ErrorTransformer`/`MapDomainError` design is good (sentinel→status table, field locations preserved); repos consistently wrap with `%w` and lowercase context; `postgres.HandleNotFound`/`WrapNotFound` give uniform `pgx.ErrNoRows` translation; no `panic()` in request paths (the one in `item/service.go:22` for `crypto/rand` failure is justified and documented).

---

## 2. Transactions

`postgres.TxManager` (`internal/infra/postgres/tx.go`) is well built — context-carried tx, nested-call detection, rollback on error, panic-safe re-panic, `GetDBTX` for repos. **The problem is it's used almost nowhere:** only 2 call sites in the entire codebase (`pendingchange/service.go:231`, `itemphoto_repository.go:166`).

### HIGH — Loan create/return: two writes, no transaction (known, unfixed)

`internal/domain/warehouse/loan/service.go:96-109` and `:134-155`

```go
// TODO(WR-01): inventoryRepo.Save and repo.Save are not wrapped in a
// transaction. A crash between the two leaves inventory stuck ON_LOAN with
// no loan record. Wire TxManager (see router.go) to make this atomic.
if err := s.inventoryRepo.Save(ctx, inv); err != nil { ... }
if err := s.repo.Save(ctx, loan); err != nil { ... }
```

If `repo.Save` fails (not just a crash — any error), the inventory stays `ON_LOAN` permanently with no compensating rollback. The TxManager is already constructed in `router.go:131`; `loan.NewService` just doesn't receive it. Same shape in `Return`.

### MEDIUM — TOCTOU check-then-act without locks or constraint mapping

No `SELECT ... FOR UPDATE` exists anywhere (`grep "FOR UPDATE" db/queries/` → empty):

- `item/service.go:80-116`: `SKUExists` / `ShortCodeExists` then `Save` — concurrent creates race; if a DB unique constraint exists the loser gets a raw 500 instead of `ErrSKUTaken`.
- `loan/service.go:73-79`: `FindActiveLoanForInventory` check then save — two concurrent loans for the same inventory can both pass.
- `pendingchange/service.go:232-241`: the in-tx idempotency re-check reads without a row lock, so two concurrent approvals can both observe `StatusPending` and double-apply. The tx makes each apply atomic, not mutually exclusive.

Fix: `SELECT ... FOR UPDATE` on the pending change row, or `UPDATE ... WHERE status='pending' RETURNING` as the guard.

### MEDIUM — Inventory `Move` writes inventory then movement record outside any tx

`inventory/service.go:216-237` — combined with the swallowed error above, the movement trail is best-effort by accident rather than by decision.

### MEDIUM — `ImportWorkspace` restore is non-transactional with no resume

`workspace_restore.go:17-99` runs 10 sequential import phases on the pool connection. Per-row error tolerance is fine, but a mid-run crash leaves a half-restored workspace with no marker, and re-running duplicates categories/items (no upsert).

**Clean:** `TRANSACTIONS.md` documents the intended pattern; `pendingchange.ApproveChange` (approve + apply + save in one tx, idempotency short-circuit, side effects after commit) is the model the rest of the codebase should copy.

---

## 3. Concurrency / Workers / Jobs

### Architecture smell — Two parallel queue systems

Custom Redis list queue (`internal/infra/queue/redis_queue.go`, used by import worker) **and** asynq (`internal/jobs/`, used by thumbnails/reminders/cleanup). Asynq already provides retries, archive, timeouts, graceful shutdown — the custom queue reimplements a worse subset. Recommend: migrate imports to asynq, delete `infra/queue`.

### MEDIUM — Custom queue loses jobs on crash and silently discards after retries

`internal/infra/queue/redis_queue.go`:

- `Dequeue` (line 67): `BLPop` removes the job ID before processing — a worker crash mid-import loses the job (at-most-once, contradicting the retry design).
- `Fail` (line 137-138): "Max retries exceeded, **delete** job" — no dead-letter list, no terminal status write.
- Job payload TTL is 24h (line 53); a job sitting in queue longer than that dequeues into "job data not found".

Fix: `BLMOVE` to a per-worker in-flight list + ack, or just use asynq.

### MEDIUM — Import retries are not idempotent

`ImportWorker.processItemImport` etc. create entities row by row; `queue.Fail` re-enqueues up to 3 times. A failure at row 500 re-runs rows 1-499 → duplicate locations/borrowers/inventory (items partially protected by the SKU check). Either checkpoint `processedRows` and skip, or make creates upsert-by-natural-key.

### MEDIUM — Worker shutdown is sleep-based, not drain-based

`cmd/worker/main.go:113-123`:

```go
cancel()
...
time.Sleep(5 * time.Second)
```

A large CSV import in flight is killed mid-write after 5s with no completion signal (no `WaitGroup`/done channel from `w.Start`). Combined with non-idempotent retries above, a deploy during an import corrupts the result.

### LOW

- `ImportWorker.isRunning` is a plain bool field (`import_worker.go:34,53-59`) — dead weight pretending to be a control flag; ctx already does this job.
- `RateLimiter` cleanup goroutine never stops (`ratelimit.go:36`) — every test constructing one leaks.
- On ctx cancel, `Dequeue` returns a context error → "Error dequeuing job…" log + 1s sleep before exiting (`import_worker.go:64-69`). Cosmetic but misleading.

**Clean:** SSE plumbing is correct — `broadcaster.go` closes channels only under the exclusive lock while sends hold RLock; `events/handler.go` unregisters on `r.Context().Done()` with keepalives; non-blocking buffered sends drop rather than block. asynq tasks set `MaxRetry`/`Timeout`/queue priorities; `Scheduler.Stop()` shuts down in the right order. `cmd/server/main.go` does proper signal → `srv.Shutdown(30s)`; `WriteTimeout: 0` is intentional and documented for SSE with per-route timeout middleware (`TimeoutWithSkip(60s, "/sse")`) compensating.

---

## 4. API Layer

### HIGH — PATCH /items/{id} silently wipes omitted fields

`internal/domain/warehouse/item/handler.go:326-410` + `entity.go:161-190`. The handler comment says "use defaults for fields not provided", but only `Name`, `MinStockLevel` (and `NeedsReview` inside the entity) are defaulted from `currentItem`. Every other pointer field is passed straight through:

```go
updateInput := UpdateInput{
	Name:        currentItem.Name(),
	Description: input.Body.Description,   // nil when omitted…
	Barcode:     input.Body.Barcode,
	...
}
// entity.go:170
i.description = input.Description          // …and nil is *assigned*
```

`PATCH {"name":"New name"}` clears description, brand, model, barcode, serial number, category, warranty details, purchase source, and Obsidian paths. This violates PATCH semantics and is one accidental partial-body client away from data loss. Fix: either treat nil as "unchanged" in `Item.Update` (matching `NeedsReview`'s handling), or default every field from `currentItem` in the handler.

### HIGH — Pagination Offset/Limit clamp mismatch corrupts internal callers

`internal/shared/pagination.go:28-44`: `Offset()` uses **raw** `PageSize`; `Limit()` clamps to `MaxPageSize=100`. Two consequences:

1. Any caller with `PageSize > 100` reads window `[(page-1)*PageSize, +100)` — page 2 skips rows.
2. **Concrete bug:** `import_worker.go:276, 364, 611, 621, 628` build lookup caches with `shared.Pagination{Page: 1, PageSize: 10000}` — `Limit()` silently caps this at **100 rows**. In any workspace with >100 locations/items/containers, CSV imports resolve references against a truncated cache, producing spurious "location 'X' not found" errors / wrong skips.

Fix: clamp consistently in both methods, and give the worker a real `FindAll` (or iterate pages).

### MEDIUM — N+1 + unbounded list in pending changes

`internal/domain/warehouse/pendingchange/handler.go:56-69` + `:296-314`: `FindByWorkspace` (no LIMIT in `db/queries/pending_changes.sql`) then per-change `userRepo.FindByID` for requester **and** reviewer → up to 2N+1 queries. The codebase already has the fix pattern: `postgres/loan_decoration_lookup.go` batches loan decoration into 3 round trips, and `ListPrimaryByItemIDs` batches item photos. Apply the same here.

### MEDIUM — OpenAPI spec fragmentation

`internal/api/router.go` creates **five** separate huma instances (lines 121, 299, 319, 363, 407) and only the first publishes `/openapi.json`. The published spec contains health + barcode + docs only — none of the auth, user, or workspace-scoped endpoints. Fix: register all operations on one `huma.API` (chi groups can share it), or merge specs.

### MEDIUM — Delta sync `HasMore` has no cursor

`internal/domain/sync/service.go:74-81`: `HasMore` is set when `len == limit`, but the response carries no per-entity next-cursor; clients must re-request with `modified_since = max(updated_at)`. With >limit rows sharing one timestamp (bulk import!) the client either loops forever or skips records. Fix: keyset cursor `(updated_at, id)`. (See DATABASE-SCHEMA.md B4 for the schema-level redesign.)

### LOW

- Inconsistent list envelopes: `/items/by-category` returns `ItemListResponse` with zero `Total/Page/TotalPages` (`item/handler.go:246-250`), `/items/search` likewise, while `/items` fills them.
- 13 query files contain no `LIMIT` at all (`categories.sql`, `labels.sql`, `favorites.sql`, `workspace_members.sql`, `pending_changes.sql`, `attachments.sql`, …). Defensible at home scale, but `pending_changes` and `attachments` grow unboundedly.

**Clean:** huma input validation is consistently used; items list/loan list N+1s were explicitly engineered away; auth endpoints are rate-limited with proper `Retry-After`; middleware layering (RequestID → RealIP → logger → Recoverer → timeout → CORS) is in the right order.

---

## 5. Domain Layer

Structure is consistent and decent: `entity.go` (invariants) / `service.go` (orchestration) / `handler.go` (HTTP) / `repository.go` (interface) per domain — not anemic, entities own validation.

### HIGH — Batch conflict responses serialize to `{}`

`internal/domain/batch/service.go:442-449`:

```go
func marshalEntity(entity interface{}) *json.RawMessage {
	data, err := json.Marshal(entity)
	...
}
```

`entity` is `*item.Item` / `*location.Location` etc. — domain entities with **only unexported fields** (`item/entity.go:13-38`) and no `MarshalJSON`. `json.Marshal` yields `{}`. Every 409 conflict result returned to the PWA ships `server_data: {}` — the client cannot render the server version to resolve the conflict. The conflict-resolution feature is effectively non-functional. Fix: marshal the existing `*Response` DTOs (e.g. `toItemResponse`) instead of entities.

### MEDIUM — Copy-paste duplication

- `batch/service.go:129-411`: six `processXOperation` functions differing only in types (~280 lines) — one generic helper `processEntityOp[T updatable]` would do.
- `worker/import_worker.go:142-753`: six `processXImport` functions repeating the same parse/count/start/progress/finish scaffold (~600 lines). Extract the lifecycle once with a per-entity row callback.
- The conflict check `op.UpdatedAt != nil && existing.UpdatedAt().After(*op.UpdatedAt)` then update is itself a TOCTOU (no version column / optimistic-lock in the UPDATE).

### LOW — TODO density is low and honest

10 TODO/FIXME in non-test code; the loan-tx and restore stubs above are the only load-bearing ones.

**Clean:** workspace-scoping discipline is strong — virtually every service method takes `(id, workspaceID)` and cross-entity refs are validated against the workspace (`inventory/service.go:71-94`, `item/service.go:119-126`); sentinel errors per domain with sensible mapping.

---

## 6. Config

### HIGH — `Config.Validate()` is never called

`internal/config/config.go:114-130` defines good checks (JWT secret must change outside debug, Authelia secret required, port range) — but grep finds **zero call sites**. `cmd/server/main.go:24` does `cfg := config.Load()` and proceeds. The "JWT_SECRET must be changed in production" guard is dead code; a prod deploy with the default `change-me-in-production` secret boots silently. Fix: `if err := cfg.Validate(); err != nil { log.Fatal(err) }` in every cmd.

### MEDIUM — Config bypassed by ad-hoc env reads; divergent variable names

- `cmd/server/main.go:27`: `GO_DATABASE_URL` overrides `cfg.DatabaseURL` (`DATABASE_URL`).
- `cmd/worker/main.go:31`: requires `GO_DATABASE_URL`, ignores the config package entirely.
- `internal/api/router.go:90`: reads `REDIS_URL` from env even though `cfg.RedisURL` exists (now unused).
- `cmd/server/main.go:43`: listens on `PORT`, while `cfg.ServerPort`/`ServerHost`/`ServerTimeout` are never used.

Four sources of truth for the same deployment knobs. Also verify `DatabaseMaxConn`/`MinConn` actually reach `postgres.NewPool`.

### LOW — Silent fallback on malformed values

`getEnvInt`/`getEnvBool` (`config.go:141-157`) ignore parse errors — `DATABASE_MAX_CONN=tewnty-five` silently becomes 25. Log a warning or fail.

---

## 7. Testing

**Strong:** 145 test files; 41 behind `go:build integration`; `tests/integration` covers the right risks: `multitenant_test.go`, `permission_test.go`, `auth_test.go`, `concurrent_updates_test.go`, `cross_workspace_fk_test.go`, `approval_pipeline_test.go`, `import_test.go`, `batch_test.go`, `large_file_upload_test.go`. `testutil/factory` + `tests/testdb` harness is a real investment. Repos have unit tests nearly across the board.

**Gaps (src/test files per package):**

- `domain/auth/oauth` — **6 src / 0 tests** (token exchange, account linking: critical path).
- `domain/auth/session` — 4 src / 0 tests.
- `domain/auth/pushsubscription` — 5 src / 0 tests.
- `domain/warehouse/repairattachment` — 4 src / 0 tests.
- `internal/worker/import_worker.go` — **793 lines, 0 tests** (contains the cache-truncation bug; a test with 101 locations would have caught it).
- `internal/jobs` self-reports 27.9% coverage (committed `test_output.txt`).
- The batch-conflict `{}` bug survives because `batch` tests never assert `ServerData` content.

---

## 8. Repo Hygiene

- **HIGH — Committed binaries:** `backend/main` (16 MB) and `backend/photo-admin` (14 MB) are tracked in git. `backend/server` (42 MB) is ignored but on disk. Fix: `git rm --cached backend/main backend/photo-admin`; ignore `main`, `photo-admin`, or better build into `/backend/bin/`.
- **MEDIUM — Committed test artifacts:** `coverage_current.out`, `coverage_new.out`, `coverage_phase2.out`, `domain_coverage.out` (~1.7 MB, all tracked) plus `internal/jobs/test_output.txt`. `.gitignore` only covers `coverage.out` exactly — broaden to `coverage*.out`.
- **Clean:** `uploads/` ignored, nothing tracked; `sqlc diff` exits clean — generated code matches queries + migrations; `.env` ignored with `.env.example` present.

---

## 9. Performance

- Covered above as correctness: import cache truncation (HIGH), pendingchange N+1 + no LIMIT (MEDIUM).
- **Good:** thumbnail generation moved off the request path to asynq (`itemphoto/service.go:243-255`); perceptual hash kept sync deliberately with a measured cost note; item list photo decoration batched; loan decoration batched into 3 round trips; `FindByWorkspaceFiltered` uses a real `COUNT(*)`.
- **LOW:** CSV files are read twice per import (`parser.CountRows()` then `ParseStream`) — double I/O just for a progress denominator.
- **LOW:** `UploadPhoto` calls `GetByItem` (full photo rows) only to compute `displayOrder = len(existingPhotos)` (`itemphoto/service.go:186-193`) — `COUNT(*)` would do; also racy under concurrent uploads (duplicate display order / two primaries).
- **LOW:** `ImportWorkspace` takes the whole backup as `[]byte`, Excel parsing fully in-memory — fine at home scale.

---

## Cleanest areas

TxManager + `pendingchange.ApproveChange` (the reference implementation others should copy), SSE broadcaster locking, huma input validation, workspace scoping discipline, integration test breadth, sqlc freshness, error-mapping middleware design.
