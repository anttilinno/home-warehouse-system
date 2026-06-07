# Quick Task 260607-vsu — Fix Postgres Integration Test Lane (Stale Signatures)

**Date:** 2026-06-07
**Branch:** master (no worktree)
**Commit:** 97e0fa0 — `test(postgres): fix stale repo call signatures in integration lane`

## Objective

Make `go test -tags=integration ./internal/infra/postgres/...` compile again.
The lane had ~17 stale `repo.Delete(ctx, id)` calls plus hidden drift behind
the compiler's "too many errors" cap.

## What Changed

Updated **14 call sites** across **6** `*_repository_test.go` files to match the
current repository method signatures (drift from the Phase 59-01 tenant-scoping
refactor). Only compiler-flagged calls were touched; each new arg reuses the
workspace/user the test already seeds in its fixture.

| File | Call sites | Fix |
|------|-----------|-----|
| `borrower_repository_test.go` | 6 | `Delete`(x2), `Archive`(x3), `Restore`(x1): `(ctx,id)` → `(ctx, id, workspaceID)`. Used `testfixtures.TestWorkspaceID` for fixture-seeded rows; local `workspace` var for the `CreateTestWorkspace`-seeded archived-exclusion test. |
| `category_repository_test.go` | 4 | `Delete`(x2): `(ctx,id)` → `(ctx, id, testfixtures.TestWorkspaceID)`. `HasChildren`(x2): `(ctx, parentID)` → `(ctx, workspaceID, parentID)` — **workspaceID is the first arg** in this repo. Reused the test's local `workspaceID`. |
| `company_repository_test.go` | 1 | `Delete`: `(ctx, id, testfixtures.TestWorkspaceID)` |
| `container_repository_test.go` | 1 | `Delete`: `(ctx, id, testfixtures.TestWorkspaceID)` |
| `label_repository_test.go` | 1 | `Delete`: `(ctx, id, testfixtures.TestWorkspaceID)` |
| `location_repository_test.go` | 1 | `Delete`: `(ctx, id, testfixtures.TestWorkspaceID)` |

No assertions were weakened, skipped (`t.Skip`), or removed.

## Non-Delete Drift Found

Beyond `Delete`, the lane also had stale calls to:
- `BorrowerRepository.Archive` / `Restore` — both now `(ctx, id, workspaceID)`.
- `CategoryRepository.HasChildren` — now `(ctx, workspaceID, parentID)` (workspace-first ordering).

All resolved against the real current signatures in the corresponding `*_repository.go`.

No renamed fields or changed constructors surfaced once the signature drift was
fixed — `go vet` came back clean with no further errors.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| a. build | `go build ./...` | **rc=0** (clean) |
| b. vet (PRIMARY) | `go vet -tags=integration ./internal/infra/postgres/...` | **rc=0** (compiles clean) |
| c. default test | `go test ./...` (no integration tag) | **rc=0** (green, no regression) |
| d. live run | see below | **partial — see notes** |

(The `go: warning: ignoring go.mod in $GOPATH` line on every go invocation is
pre-existing GOPATH noise, not an error.)

### Live Run

Docker was available. Brought up `postgres-dev` (compose service name; port 5432,
user/pass `wh/wh`), created `warehouse_test`, and applied the `-- migrate:up`
section of `backend/db/migrations/001_initial_schema.sql` (the file is a
dbmate-style migration — piping the whole file runs the `migrate:down` section
too and drops the schema, so only lines 1–1185 were applied).

Raised Postgres `max_connections` to 500 to avoid the default-pool
"too many clients already" exhaustion when many tests each open a `pgxpool`.

**Shortlink subtests — the required target — PASS (6/6):**

```
--- PASS: TestShortlinkRepository_Resolve_Integration (0.20s)
    --- PASS: .../item_match
    --- PASS: .../container_match
    --- PASS: .../location_match
    --- PASS: .../item-first_priority
    --- PASS: .../cross-workspace_scoping
    --- PASS: .../not-found_sentinel
ok  github.com/antti/home-warehouse/go-backend/internal/infra/postgres  0.200s
```

**Other tests in the lane fail at RUNTIME (pre-existing, out of scope):**
Many `*_repository_test.go` tests fail with `no rows in result set` on
`repo.Save(ctx, ...)`. Root cause is **not** the signature drift this task fixed:
commit `86b74bd` ("fix(59-01): split repo.Save into Create (INSERT) + Save
(UPDATE)") changed `Save` to an UPDATE-only operation, but these tests still call
`repo.Save` expecting an INSERT (they never call the new `Create`). So the UPDATE's
`RETURNING` matches zero rows. This is a separate behavioral regression in the test
suite, not a call-site signature fix, and the task scope is explicitly "a call-site
signature fix only" / "Do NOT weaken assertions." Fixing it means changing test
*behavior* (insert via `Create` first) across ~19 files — recommend a follow-up
stabilization task.

The full `-p 1` lane run therefore returns rc=1, but the failures are entirely the
pre-existing Save/Create split, and the shortlink target passes in isolation. The
compile/vet gate (the deliverable of this task) is fully green.

## Files Touched

- `backend/internal/infra/postgres/borrower_repository_test.go`
- `backend/internal/infra/postgres/category_repository_test.go`
- `backend/internal/infra/postgres/company_repository_test.go`
- `backend/internal/infra/postgres/container_repository_test.go`
- `backend/internal/infra/postgres/label_repository_test.go`
- `backend/internal/infra/postgres/location_repository_test.go`

## Follow-up Recommended

Stabilization task: update the integration tests that call `repo.Save` to insert
new rows to call `repo.Create` first (or `Create` then `Save`), matching the 59-01
Create/Save split. This unblocks the rest of the postgres integration lane at runtime.
