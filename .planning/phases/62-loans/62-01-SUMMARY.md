---
phase: 62-loans
plan: 01
subsystem: api
tags: [backend, loan, huma, sqlc, decoration, api, postgres]

# Dependency graph
requires:
  - phase: 61-item-photos
    provides: itemphoto.ListPrimaryByItemIDs batch-read + shared photoURLGenerator (reused by LoanDecorationLookup)
  - phase: 59-borrowers-crud
    provides: warehouse.borrowers table + borrower.Service (borrower name lookup)
  - phase: 60-items-crud
    provides: warehouse.items + inventory join surface (inventory_id -> item_id -> item name)
provides:
  - PATCH /workspaces/{wsId}/loans/{id} — unified edit endpoint (due_date and/or notes)
  - LoanResponse shape with embedded item + borrower on every list/detail/mutation endpoint
  - DecorationLookup interface + postgres LoanDecorationLookup adapter (3 SQL round-trips per list)
  - Domain Loan.Update mutator + loan.Service.Update + loan.Repository.Update
  - sqlc: UpdateLoan (partial update, workspace-scoped), ListItemNamesByInventoryIDs, ListBorrowerNamesByIDs
  - Notes maxLength:"1000" on CreateLoanInput and UpdateLoanInput (Huma tag)
affects: [62-02, 62-03, 62-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DecorationLookup inversion: handler declares minimal interface; postgres adapter satisfies it without importing item/itemphoto/borrower into the loan package"
    - "Partial update via CASE + set_* flags: distinguishes 'unchanged' (false) from 'explicitly clear' (true + NULL) without COALESCE ambiguity"
    - "Service.Update: GetByID for workspace scope, entity mutator for invariants, repo.Update for workspace-scoped persistence (belt + suspenders)"

key-files:
  created:
    - backend/internal/infra/postgres/loan_decoration_lookup.go
  modified:
    - backend/db/queries/loans.sql
    - backend/internal/infra/queries/loans.sql.go
    - backend/internal/domain/warehouse/loan/entity.go
    - backend/internal/domain/warehouse/loan/repository.go
    - backend/internal/domain/warehouse/loan/service.go
    - backend/internal/domain/warehouse/loan/handler.go
    - backend/internal/domain/warehouse/loan/handler_test.go
    - backend/internal/domain/warehouse/loan/service_test.go
    - backend/internal/infra/postgres/loan_repository.go
    - backend/internal/api/router.go

key-decisions:
  - "Partial-update SQL uses CASE with set_* boolean flags (not COALESCE), so pointer-to-empty-string clears notes explicitly and nil leaves it untouched"
  - "DecorationLookup interface lives in the loan package; the postgres adapter lives in infra/postgres — avoids loan -> item/itemphoto/borrower import chains"
  - "Decoration fallback on missing item/borrower rows uses zero-name embedding (id only) rather than erroring the whole list — preserves list availability under FK/cascade races"
  - "LoanEmbeddedItem.ID is the canonical item_id (from inventory.item_id), NOT the inventory_id; frontend consumers can deep-link to /items/{id}"
  - "/loans/{id}/extend retained as a back-compat endpoint; /loans/{id} PATCH is the new unified edit path (D-01)"
  - "Service.Update remaps shared.ErrNotFound -> loan.ErrLoanNotFound so the handler's error-mapping code keeps its clean switch on loan-package errors"

patterns-established:
  - "Loan response decoration: every LoanResponse-producing handler calls decorateLoans (list) or decorateOneLoan (single); toLoanResponse takes maps instead of pulling from a lookup directly"
  - "Per-request decoration cost = 3 SQL round-trips regardless of list size (T-62-08)"
  - "New handler signatures should default to accepting a lookup-style interface for decoration even if the initial implementation passes nil in tests"

requirements-completed: [LOAN-04, LOAN-05, LOAN-06]

# Metrics
duration: ~15min
completed: 2026-04-17
---

# Phase 62 Plan 01: Backend Loan Update + Decoration Summary

**Unified PATCH /loans/{id} endpoint plus item + borrower embedding on every LoanResponse, decorated via a 3-round-trip batch lookup adapter that reuses the Phase 61 primary-photo infrastructure.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17T08:37:00Z
- **Completed:** 2026-04-17T08:48:10Z
- **Tasks:** 2 (both auto + TDD-flagged)
- **Files modified:** 10 (+ 1 created)

## Accomplishments

- PATCH /loans/{id} live with full error-path coverage (404 for not-found, 400 for returned/invalid-due-date, proper workspace scoping via GetByID + sqlc WHERE id AND workspace_id)
- Every loan-returning endpoint now embeds `{item:{id,name,primary_photo_thumbnail_url},borrower:{id,name}}` — zero N+1, 3 batch SQL round-trips per call
- `CreateLoanInput.Notes` + `UpdateLoanInput.Notes` now carry server-side `maxLength:"1000"` (RESEARCH §Security gap closed)
- New postgres adapter `LoanDecorationLookup` wires into router without introducing import cycles between loan and item/itemphoto/borrower
- Full backend loan test suite green (41 tests); full backend regression green except one pre-existing unrelated cleanup-test flake (deferred-items.md)

## Task Commits

Tasks 1 and 2 were committed atomically as a single logical unit because both touch
`handler.go` (Task 1 introduces the new handler, Task 2 changes every handler's response
shape). Committing them separately would require a transient build state with a TODO
placeholder. Per the plan's guidance ("land both tasks atomically before running
tests") this was the cleaner path.

1. **Task 1 + Task 2: PATCH handler + LoanResponse decoration** — `63f8fce` (feat)
2. **Plan artifacts seeded into worktree** — `1c82e91` (docs)

## Files Created/Modified

### Created
- `backend/internal/infra/postgres/loan_decoration_lookup.go` — `LoanDecorationLookup` satisfies `loan.DecorationLookup`; 3 batch methods (items-by-inventory-ids, primary-photo-thumbnails-by-item-ids, borrowers-by-ids) all workspace-scoped.

### Modified
- `backend/db/queries/loans.sql` — UpdateLoan (CASE-based partial update with set_* flags, workspace-scoped), ListItemNamesByInventoryIDs (joins inventory + items), ListBorrowerNamesByIDs.
- `backend/internal/infra/queries/loans.sql.go` — sqlc-regenerated (UpdateLoanParams with SetDueDate/SetNotes, ListItemNamesByInventoryIDsParams, ListBorrowerNamesByIDsParams).
- `backend/internal/domain/warehouse/loan/entity.go` — `(*Loan).Update(dueDate *time.Time, notes *string) error` (rejects returned, validates due-date-after-loaned).
- `backend/internal/domain/warehouse/loan/repository.go` — Repository interface gains Update(ctx, loanID, workspaceID, setDueDate, dueDate, setNotes, notes) (*Loan, error).
- `backend/internal/domain/warehouse/loan/service.go` — ServiceInterface + Service.Update; maps shared.ErrNotFound -> ErrLoanNotFound.
- `backend/internal/domain/warehouse/loan/handler.go` — rewritten: LoanEmbeddedItem/Borrower types, DecorationLookup interface + ItemLookupRow, lookupLoanDecorations/decorateOneLoan/decorateLoans helpers, PATCH /loans/{id} handler, UpdateLoanInput/UpdateLoanOutput types, 4th lookup arg in RegisterRoutes, LoanResponse now includes Item + Borrower fields, Notes maxLength:"1000" on both create and update inputs.
- `backend/internal/domain/warehouse/loan/handler_test.go` — MockService.Update, stubDecorationLookup, 5 TestHandler_UpdateLoan_* cases, TestHandler_ListResponseIncludesEmbeds, TestHandler_GetLoanByID_IncludesEmbeds; all existing RegisterRoutes calls updated for 4-arg signature.
- `backend/internal/domain/warehouse/loan/service_test.go` — MockRepository.Update, 4 TestService_Update_* cases (Success / AlreadyReturned / InvalidDueDate / NotFound).
- `backend/internal/infra/postgres/loan_repository.go` — LoanRepository.Update (uses UpdateLoanParams; maps pgx.ErrNoRows -> loan.ErrLoanNotFound; reuses rowToLoan).
- `backend/internal/api/router.go` — constructs `postgres.NewLoanDecorationLookup(pool, itemPhotoSvc, photoURLGenerator)` inside the workspace-scoped router block and passes it as the 4th argument of `loan.RegisterRoutes`.

## Decisions Made

See `key-decisions` frontmatter above. Highlights:
- Chose CASE + set_* boolean flags over COALESCE in UpdateLoan so pointer-to-empty-string can clear notes explicitly without ambiguity.
- DecorationLookup interface lives in the loan package (not item/itemphoto/borrower) to prevent any import cycle and keep the test surface tiny (a ~10-line stub).
- Atomic commit covering both tasks — see reasoning in Task Commits.

## Deviations from Plan

None — plan executed as written. The one intentional judgment call (atomic commit of Task 1 + Task 2 vs. two commits with a TODO bridge) was explicitly permitted by the plan's action guidance ("either land both tasks atomically before running tests, OR ...").

## Issues Encountered

- **Pre-existing test flake (out of scope, deferred):** `internal/jobs/TestCleanupConfig_RetentionPeriodUsage/{30,90}_days` fail with off-by-one (expected: 30, actual: 29) on today's run date. Unrelated to this plan — appears to be DST-boundary arithmetic in cleanup config. Logged in `deferred-items.md`; not re-attempted.

## User Setup Required

None — pure backend; no new env vars, no new external services.

## Next Phase Readiness

**Unblocked:**
- Plan 62-02 (frontend loansApi.update hook) can now target PATCH /loans/{id} with a `{due_date?, notes?}` body.
- Plans 62-03 and 62-04 (item/borrower detail loan rows, /loans list page) can render item name + thumbnail + borrower name without additional client-side joins.

**API surface changes consumers must mirror:**
- LoanResponse schema adds required fields `item: LoanEmbeddedItem` and `borrower: LoanEmbeddedBorrower` on every loan endpoint. Any frontend or external consumer that parsed LoanResponse must accept the new fields (additive — safe for Zod `.strict(false)` schemas, breaking for `.strict()` schemas).
- New endpoint: `PATCH /workspaces/{wsId}/loans/{id}` accepting `{ due_date?: string, notes?: string }`, returns full LoanResponse. Legacy `PATCH /loans/{id}/extend` remains available.
- Notes field is now server-enforced at 1000 chars; frontend forms SHOULD mirror this limit in their Zod schemas (Plan 62-03 threat model T-62-06).

## Self-Check: PASSED

- [x] `backend/internal/domain/warehouse/loan/handler.go` contains `huma.Patch(api, "/loans/{id}",` — FOUND (handler.go:415)
- [x] `backend/internal/domain/warehouse/loan/handler.go` contains `type UpdateLoanInput struct` — FOUND (handler.go:598)
- [x] `backend/internal/domain/warehouse/loan/handler.go` contains `type UpdateLoanOutput struct` — FOUND (handler.go:606)
- [x] `CreateLoanInput.Notes` + `UpdateLoanInput.Notes` carry `maxLength:"1000"` — FOUND (lines 571, 602)
- [x] `service.go` ServiceInterface contains `Update(ctx context.Context` — FOUND (service.go:23)
- [x] `service.go` contains `func (s *Service) Update(` — FOUND (service.go:170)
- [x] `repository.go` Repository interface contains `Update(ctx context.Context` — FOUND (repository.go:26)
- [x] `loan_repository.go` contains `func (r *LoanRepository) Update(` — FOUND (loan_repository.go:207)
- [x] `backend/db/queries/loans.sql` contains `-- name: UpdateLoan :one` — FOUND
- [x] `backend/internal/infra/queries/loans.sql.go` contains `func (q *Queries) UpdateLoan(` — FOUND
- [x] `entity.go` contains `func (l *Loan) Update(` — FOUND (entity.go:131)
- [x] `LoanEmbeddedItem` / `LoanEmbeddedBorrower` / `DecorationLookup` / `lookupLoanDecorations` / `decorateOneLoan` / `decorateLoans` — all present in handler.go
- [x] RegisterRoutes has `lookup DecorationLookup` parameter — FOUND (handler.go:169)
- [x] router.go wires `postgres.NewLoanDecorationLookup(...)` into `loan.RegisterRoutes` — FOUND (router.go:423-424)
- [x] All 5 TestHandler_UpdateLoan_* + both decoration tests present — FOUND (handler_test.go)
- [x] All 4 TestService_Update_* tests present — FOUND (service_test.go)
- [x] `cd backend && go build ./...` exits 0 — VERIFIED
- [x] `cd backend && go test ./internal/domain/warehouse/loan/... -count=1` exits 0 — VERIFIED (0.088s, all pass)
- [x] Commits exist:
  - `63f8fce` (feat: Task 1 + Task 2 atomic) — FOUND
  - `1c82e91` (docs: plan artifacts seed) — FOUND

---
*Phase: 62-loans*
*Completed: 2026-04-17*
