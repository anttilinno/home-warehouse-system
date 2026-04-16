---
phase: 59-borrowers-crud
plan: 01
subsystem: backend
tags: [backend, borrower, sqlc, huma, archive-restore-delete, events]

# Dependency graph
requires:
  - phase: 58-taxonomy-categories-locations-containers
    provides: archive-first + hard-delete guard pattern mirrored from category handler
provides:
  - DeleteBorrower :exec SQL (true hard-delete by id)
  - ListBorrowers archived filter via sqlc.narg
  - Repository.Archive / Restore / Delete split (Delete = hard)
  - Repository.FindByWorkspace(..., includeArchived bool) signature
  - POST /borrowers/{id}/archive with borrower.archived event
  - POST /borrowers/{id}/restore with borrower.restored event
  - DELETE /borrowers/{id} hard-delete with errors.Is(ErrHasActiveLoans) → 400
  - GET /borrowers?archived=true query param surfaced through handler → service → repo
  - Service + repository test coverage for every new path (unit + integration)
affects: [phase 59-02 frontend borrower list archived toggle, phase 59-03 archive-first panel, phase 59-04 hard-delete with active-loan 400 toast]

# Tech tracking
tech-stack:
  added:
    - sqlc@v1.30.0 installed via `go install` (Go toolchain) to run codegen
  patterns:
    - "sqlc.narg(...) nullable param pattern for archived filter"
    - "errors.Is(...) over err == ... for wrapped domain errors in handler"
    - "Archive/Restore as direct repo SQL calls instead of entity+Save dance"
    - "Service mediates workspace scoping via GetByID; repo Archive/Restore/Delete take only id"

key-files:
  created: []
  modified:
    - backend/db/queries/borrowers.sql
    - backend/internal/infra/queries/borrowers.sql.go
    - backend/internal/domain/warehouse/borrower/repository.go
    - backend/internal/domain/warehouse/borrower/service.go
    - backend/internal/domain/warehouse/borrower/service_test.go
    - backend/internal/domain/warehouse/borrower/handler.go
    - backend/internal/domain/warehouse/borrower/handler_test.go
    - backend/internal/infra/postgres/borrower_repository.go
    - backend/internal/infra/postgres/borrower_repository_test.go
    - backend/internal/domain/warehouse/pendingchange/service_test.go

key-decisions:
  - "Delete is now hard-delete (DELETE FROM ...) — reversibility lives on Archive/Restore"
  - "ErrHasActiveLoans guard moved off DELETE's dead branch to the place it actually fires (svc.Delete → 400 via errors.Is)"
  - "ListBorrowers filter is nullable (sqlc.narg) so callers can pass nil (all) or bool (active-only vs all)"
  - "Archive/Restore repo methods take only id — service mediates workspace scoping via GetByID first"
  - "handler list default archived=false matches prior behaviour (active-only); opt-in via ?archived=true"

patterns-established:
  - "Nullable sqlc param via sqlc.narg('archived')::bool IS NULL OR ... — reusable for other soft-archive lists"
  - "Three-endpoint CRUD close-out (POST /archive + POST /restore + DELETE) mirroring category/handler.go as the project reference"
  - "errors.Is for domain-error branching in huma handlers (replacing bare err == pattern)"

requirements-completed: [BORR-01, BORR-04]

# Metrics
duration: ~35 min
completed: 2026-04-16
---

# Phase 59 Plan 01: Backend Archive/Restore/Delete + Archived List Filter Summary

**Three clean borrower endpoints wired (archive/restore/delete), archived list filter pushed through handler+service+repo, ErrHasActiveLoans guard now lives where it actually fires, and every new path has unit+integration test coverage.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-16T08:57:00Z (approx)
- **Completed:** 2026-04-16T09:32:25Z
- **Tasks:** 4 / 4
- **Files modified:** 10

## Accomplishments

**Task 1 — SQL layer (commit `0ece11a`)**
- Appended `DeleteBorrower :exec` — `DELETE FROM warehouse.borrowers WHERE id = $1`
- Rewrote `ListBorrowers` to accept `sqlc.narg('archived')::bool`:
  - `archived=nil` → include all (not exercised today, available for future callers)
  - `archived=true` → include all
  - `archived=false` → active only (is_archived=false)
- `sqlc generate` produced `(q *Queries) DeleteBorrower(ctx, id) error` and added a `*bool Archived` field to `ListBorrowersParams`. Verified build + vet clean.

**Task 2 — Repository + service split (commit `41d40ad`)**
- `Repository` interface: added `Archive(ctx, id)`, `Restore(ctx, id)`; Delete is now a real hard-delete; `FindByWorkspace(..., includeArchived bool)` adds the new flag
- Postgres impl: `Archive` → ArchiveBorrower SQL, `Restore` → RestoreBorrower SQL, `Delete` → new DeleteBorrower SQL. `FindByWorkspace` passes `&includeArchived` into `ListBorrowersParams.Archived`
- Service: `Archive`/`Restore` now do existence-check + `repo.Archive`/`repo.Restore` (no entity.Archive/Save dance); `List` signature gains `includeArchived bool` and forwards to repo
- Updated all interface implementors: `borrower.MockRepository` (service_test), `handler_test.MockService`, `pendingchange.MockBorrowerRepository` — otherwise the whole `go vet ./...` would have broken
- Existing `Service.Archive` / `Service.Restore` unit tests rewritten to match the new repo method expectations; build + unit tests green

**Task 3 — Handler wiring (commit `a171ed7`)**
- Rewrote `DELETE /borrowers/{id}` to call `svc.Delete` and branch on `errors.Is(err, ErrHasActiveLoans)` → 400 `"cannot delete borrower with active loans"`. Publishes `borrower.deleted` as before
- Added `POST /borrowers/{id}/archive` → `svc.Archive` → publishes `borrower.archived` event
- Added `POST /borrowers/{id}/restore` → `svc.Restore` → publishes `borrower.restored` event
- Added `Archived bool \`query:"archived" default:"false"\`` to `ListBorrowersInput`; list handler now forwards `input.Archived` to `svc.List`
- Handler tests cover every new path: `TestBorrowerHandler_Archive`, `TestBorrowerHandler_Restore`, `TestBorrowerHandler_Delete` (now mocks `svc.Delete`, asserts 400 body contains the guard message), `TestBorrowerHandler_List_Archived{False,True}_*`, plus event-publish tests for archive + restore. All passing
- Imported `errors` stdlib — the pre-existing bare `err == ErrHasActiveLoans` dead branch on the archive-as-delete handler is now gone (grep confirmed)

**Task 4 — Test coverage for the split (commit `17ae6d9`)**
- Service unit tests: `TestService_Delete_WithActiveLoans_ReturnsErrAndSkipsRepoDelete` (ErrorIs + AssertNotCalled on Delete), `TestService_Delete_NoActiveLoans_CallsRepoDelete`, `TestService_Archive_DoesNotCheckActiveLoans` (AssertNotCalled on HasActiveLoans+Delete), `TestService_List_ForwardsIncludeArchived` (both true and false subtests)
- Integration tests in `borrower_repository_test.go`: `TestBorrowerRepository_Archive_SetsFlagButKeepsRow`, `TestBorrowerRepository_Restore_ClearsFlag`, `TestBorrowerRepository_Delete_RemovesRow` (asserts shared.ErrNotFound after delete), `TestBorrowerRepository_FindByWorkspace_ExcludesArchivedByDefault` (1 active + 1 archived seeded, includeArchived=false → 1 row, includeArchived=true → 2 rows)
- All 4 new integration tests pass against `warehouse_test` DB. All new service unit tests pass.

## Decisions Made

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Delete = hard-delete (row removed) | Archive/Restore is the reversible path; Delete is the terminal action — matches D-02 and the category reference | Row gone; UI hard-delete from archive confirm dialog is now real |
| `errors.Is(err, ErrHasActiveLoans)` | `errors.Is` handles wrapped errors, future-proofs the branch | Handler no longer breaks when service chains errors |
| Nullable sqlc.narg for archived param | Preserves the option of passing nil (all rows) from internal callers, keeps the public API a simple bool | One query supports three semantics — no duplication |
| Repo `Archive`/`Restore`/`Delete` take only `id` | Service layer already enforces workspace scoping via `GetByID`; adding workspaceID to repo would be redundant + inconsistent with category repo | Matches existing project pattern |
| `Archived bool` query param default false | Keeps prior behaviour for unaware callers; archived toggle is opt-in | Zero behaviour change for clients not using the new flag |
| Service.Archive/Restore simplification | Replaced GetByID+entity.Archive()+repo.Save trio with GetByID+repo.Archive — one fewer DB round-trip, fewer moving parts | Faster, simpler, single SQL statement |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed sqlc to run codegen**
- **Found during:** Task 1
- **Issue:** `sqlc` was not installed anywhere on PATH (not at `~/go/bin/sqlc`, not in mise tools)
- **Fix:** `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest` — sqlc v1.30.0 installed at `/home/antti/.local/share/mise/installs/go/1.25.9/bin/sqlc`
- **Files modified:** none (tool install)
- **Commit:** rolled into Task 1 commit `0ece11a`

**2. [Rule 3 - Blocking] Created warehouse_test DB + ran migrations**
- **Found during:** Task 4 (integration tests)
- **Issue:** `warehouse_test` database did not exist; integration tests skipped with connection error
- **Fix:** `docker exec warehouse-postgres-dev psql -U wh -d warehouse_dev -c "CREATE DATABASE warehouse_test;"` then `dbmate -d backend/db/migrations up` with `DATABASE_URL` pointing at warehouse_test
- **Files modified:** none (infrastructure)

**3. [Rule 1 - Bug] Fixed integration test expectation for hard-delete**
- **Found during:** Task 2
- **Issue:** Pre-existing `TestBorrowerRepository_Delete.archives_borrower_(soft_delete)` asserted soft-delete semantics — but Task 2 changed Delete to hard-delete
- **Fix:** Renamed the subtest to `hard-deletes_borrower` and added assertion that FindByID returns `shared.ErrNotFound` after Delete
- **Commit:** Task 2 commit `41d40ad`

**4. [Rule 3 - Blocking] Updated handler.go list endpoint during Task 2**
- **Found during:** Task 2
- **Issue:** Service.List signature change broke handler.go compile — plan had this fix assigned to Task 3 but build must pass at Task 2 commit boundary
- **Fix:** Temporarily forwarded `false` from handler to svc.List in Task 2; Task 3 replaced with `input.Archived`
- **Commit:** Task 2 commit `41d40ad` (interim), Task 3 commit `a171ed7` (final)

### Deferred Issues

**Pre-existing test bug in `TestBorrowerRepository_FindByID/respects_workspace_isolation`** — the test expects `FindByID` with a mismatched workspaceID to return `(nil, nil)`, but the pre-existing implementation (unchanged by this plan) returns `shared.ErrNotFound`. Failure predates this plan; unrelated to the Archive/Restore/Delete split. Scope boundary: not a fix for Phase 59-01. Recommend opening a follow-up to update the test expectation (or the repo semantics if the test intent was correct).

## Acceptance Criteria Results

All 4 tasks' grep-verifiable acceptance criteria met:

- `backend/db/queries/borrowers.sql` contains `-- name: DeleteBorrower :exec` ✓
- `backend/db/queries/borrowers.sql` contains `sqlc.narg('archived')` ✓
- Generated `borrowers.sql.go` contains `func (q *Queries) DeleteBorrower(` ✓
- Generated `borrowers.sql.go` contains `Archived` field in `ListBorrowersParams` ✓
- `repository.go` contains `Archive(...) error`, `Restore(...) error`, new `FindByWorkspace(..., includeArchived bool)` ✓
- `borrower_repository.go` contains `r.queries.DeleteBorrower`, `r.queries.ArchiveBorrower` in Archive method, `r.queries.RestoreBorrower` in Restore method ✓
- `service.go` `List` signature includes `includeArchived bool` ✓
- `handler.go` contains `huma.Post(..., "/borrowers/{id}/archive"`, `.../restore`, `svc.Delete(ctx, input.ID, workspaceID)`, `errors.Is(err, ErrHasActiveLoans)`, `Type: "borrower.archived"`, `Type: "borrower.restored"`, `Archived bool \`query:"archived"`, `svc.List(ctx, workspaceID, pagination, input.Archived)` ✓
- `if err == ErrHasActiveLoans` is gone from handler.go ✓
- `go build ./...` from `backend/` exits 0 ✓
- `go vet ./...` exits 0 ✓
- `go test ./internal/domain/warehouse/borrower/...` passes ✓
- `go test -tags integration ./internal/infra/postgres/... -run 'TestBorrowerRepository_(Archive_SetsFlagButKeepsRow|Restore_ClearsFlag|Delete_RemovesRow|FindByWorkspace_ExcludesArchivedByDefault)'` passes ✓
- `service_test.go` contains `TestService_Delete_WithActiveLoans_ReturnsErrAndSkipsRepoDelete`, `TestService_Archive_DoesNotCheckActiveLoans`, `TestService_List_ForwardsIncludeArchived` ✓
- `borrower_repository_test.go` contains `TestBorrowerRepository_Delete_RemovesRow`, `TestBorrowerRepository_FindByWorkspace_ExcludesArchivedByDefault` ✓

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `0ece11a` | feat(59-01): add DeleteBorrower SQL + archived filter on ListBorrowers |
| 2 | `41d40ad` | refactor(59-01): split borrower repo Archive/Restore/Delete; add includeArchived to List |
| 3 | `a171ed7` | feat(59-01): wire /archive, /restore, rewire DELETE to hard-delete; add archived list filter |
| 4 | `17ae6d9` | test(59-01): add service+repo tests for split Archive/Restore/Delete |

## TDD Gate Compliance

Plan frontmatter declares `type: execute` (not `type: tdd`), so plan-level RED/GREEN/REFACTOR gating does not apply. Individual task-level TDD was applied where practical:
- Tasks 1, 2, 3 involve signature/schema changes; verification is via build + grep + existing tests staying green.
- Task 4 is explicitly test-only (RED phase style): tests were written to prove behaviour the implementation already delivered in Tasks 2-3, making them safety-nets against future regression.

No feature-scoped RED test was left failing before Task 2/3 implementation because the "feature" is interface-level refactoring + endpoint wiring — the existing test suite (and freshly added mocks) is the behavioural harness.

## Threat Flags

None. All new surface (archive/restore/delete endpoints, archived query param) was scoped and mitigated per the plan's `<threat_model>`:
- T-59-01 (tampering on archived filter) — parameterised via sqlc.narg, no string concat
- T-59-02/03/04 (cross-workspace archive/restore/delete) — svc.GetByID(workspaceID) runs first in every service method before touching the repo
- T-59-05 (event info disclosure) — events carry id, workspace, user_id, display name only; no PII
- T-59-06 (unauthenticated access) — every handler opens with `appMiddleware.GetWorkspaceID(ctx)` → 401 on absence
- T-59-08 (cross-workspace archived=true) — ListBorrowers SQL is pinned to `workspace_id = $1`, session-scoped

No additional surface introduced beyond the plan's threat model.

## Known Stubs

None. All endpoints are fully wired.

## Self-Check: PASSED

All 10 modified/created source+test files present on disk. All 4 commit hashes (0ece11a, 41d40ad, a171ed7, 17ae6d9) reachable in git log. SUMMARY.md written to the correct path.
