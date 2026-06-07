# Quick Task 260607-wd8: Stabilize Postgres Integration Test Lane Summary

Stabilized the `-tags=integration` postgres repository test lane from many runtime
failures (plus a package-aborting nil-deref panic) to fully green. All fixes were
test/fixture bugs; no production repository code was changed.

## Final Result

- Integration lane: `go test -tags=integration -count=1 ./internal/infra/postgres/...` → **ok**
  - 143/143 top-level tests, 221/221 subtests passing, 0 failures.
  - Shortlink integration test: **6/6** subtests green.
- Default lane: `go test ./...` (no integration tag) → exit 0, 0 failures (no regression).
- `go build ./...` → clean.

Commit: `830593f` — `test(postgres): stabilize integration test lane to green`

## Root Causes and Fixes (per file)

The failures had three shared root causes plus one panic. All are test-side.

### Root cause A — `short_code` (NOT NULL, unique per workspace, VARCHAR(8))

`locations`, `containers`, and `items` all carry a `short_code` that is NOT NULL and
unique per workspace. Tests built these entities with empty/missing short codes,
producing three distinct errors:
- `short_code: short code is required` (location/container entity validation),
- `duplicate key ... uq_items_workspace_short_code` (two items with empty code),
- `null value in column "short_code" ... violates not-null` (raw-SQL fixture insert).

Fixes (give each a unique `uuid.NewString()[:8]`, which fits VARCHAR(8)):
- `tests/testfixtures/fixtures.go` — `CreateTestItem` raw INSERT now includes `short_code`.
- `container_repository_test.go` — `createTestLocation` helper + all inline `NewContainer`/`NewLocation` empty-code calls.
- `inventory_repository_test.go` — `createTestItem`/`createTestLocationForInv` helpers, inline container, and both workspace-isolation item/location builders.
- `favorite_repository_test.go` — all `item.NewItem` builders + one `NewLocation`.
- `item_repository_test.go` — all bare `item.NewItem` builders that previously left the code empty.
- `loan_repository_test.go` — `createTestInventoryForLoan` item + three inline workspace-isolation/pagination items.
- `movement_repository_test.go` — `createTestInventoryForMovement` item + one inline item.
- `location_repository_test.go` — trimmed two over-length string literals (`BLDA-R101`→`BLDA-R10`, `CHILD-001`→`CHILD-01`) that violated VARCHAR(8) (`value too long for type character varying(8)`).

### Root cause B — `borrower.Save` is UPDATE-only; `Create` is the INSERT

`BorrowerRepository.Save` calls `UpdateBorrower` (returns "no rows" when the row does
not exist). Tests inserting brand-new borrowers via `Save` failed. Switched insert-intent
calls to `Create`:
- `borrower_repository_test.go` — all 12 `repo.Save` on freshly-constructed borrowers → `repo.Create`.
- `loan_repository_test.go` — `createTestBorrower` helper + 3 inline `borrowerRepo.Save` → `Create`.

Genuine update/archive paths were left as `Save`. (Repos whose `Save` is INSERT —
location/container — or UPSERT — item/category — were NOT changed to `Create`; their
failures were short_code/contract issues, per Root cause A/C.)

### Root cause C — not-found contract: `FindByID` returns `shared.ErrNotFound`

Every repo `FindByID` returns `(nil, shared.ErrNotFound)` for a missing or
cross-workspace row (confirmed by reading borrower/container/inventory/location/item/
category/company/loan/label/user/workspace repos). Several `Delete` and
`respects workspace isolation` subtests wrongly expected `require.NoError` + `assert.Nil`.
Aligned them with the established `require.Error` + `shared.IsNotFound` + `assert.Nil`
pattern already used by the passing "returns nil for non-existent" subtests:
- borrower, container, inventory, item, location, loan, label, category, company, user, workspace test files.

### Panic — `LocationRepository.Save` nil dereference (test bug)

`TestInventoryRepository_FindByID` called `location.NewLocation(..., "")`, discarded the
returned error (empty short_code makes `NewLocation` return `(nil, err)`), then passed the
nil `*Location` to `Save`, which dereferenced it in `loc.ParentLocation()`. The panic
aborted the entire package run and masked ~half the failures. Fixed by supplying valid
short codes (Root cause A); production code untouched. The crash was reachable only via a
nil entity that the production callers (service layer) never construct.

## Production-bug suspects

None. Every failure traced to a test or fixture defect. The repository methods behave
correctly and consistently:
- not-found is uniformly `shared.ErrNotFound`,
- short_code constraints are enforced exactly as the schema declares,
- `borrower.Create`/`Save` split (INSERT vs UPDATE) is intentional and correct.

## Hard rules honored

No assertions weakened, no `t.Skip` added, no tests deleted, no production repository code
changed to paper over a test bug. Contract-alignment changes strengthened assertions
(added `IsNotFound` checks) rather than relaxing them.

## Verify command outputs

```
$ cd backend && TEST_DATABASE_URL=postgresql://wh:wh@localhost:5432/warehouse_test \
    go test -tags=integration -count=1 ./internal/infra/postgres/...
ok  	github.com/antti/home-warehouse/go-backend/internal/infra/postgres	22.791s
  (143/143 tests, 221/221 subtests; shortlink 6/6)

$ cd backend && go test ./...
exit 0 — 0 failures

$ cd backend && go build ./...
exit 0 — clean
```

## Self-Check: PASSED

- Commit `830593f` exists (verified via git log).
- 14 files changed (13 test files + 1 fixture), 96 insertions / 52 deletions.
- Integration lane re-run from clean: ok, 0 failures.
