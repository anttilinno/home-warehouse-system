# Deferred items — quick task 260607-vdf

## Pre-existing: integration-tagged postgres repo tests fail to compile

Discovered while running `go vet -tags=integration ./internal/infra/postgres/...`
for Task 1. The entire `postgres` package's integration test lane does not
compile due to a stale method-signature migration that was never propagated to
these `//go:build integration` test files:

- `borrower_repository_test.go` — `repo.Delete/Archive/Restore` now take an extra
  `workspace_id` arg (`Delete(ctx, wsID, id)`), tests still call `Delete(ctx, id)`.
- `category_repository_test.go` — same for `Delete` and `HasChildren`.
- `company_repository_test.go`, `container_repository_test.go`,
  `label_repository_test.go`, `location_repository_test.go` — same `Delete` drift.

These are OUT OF SCOPE for 260607-vdf (they touch borrower/category/company/
container/label/location repos, not the shortlink resolver) and PRE-EXIST this
task. Logged here per the executor scope-boundary rule; NOT fixed.

Impact on this task: the package-level `go vet -tags=integration` and the
6-subtest human-check (live Postgres) cannot run until these siblings compile.
The new `shortlink_repository_integration_test.go` was verified type-correct in
isolation (siblings removed → `go vet -tags=integration` rc=0), so the shortlink
test itself is sound; it is the shared package compile that is blocked.

Recommended follow-up: a small stabilization task to update all the drifted
`repo.Delete(ctx, id)` → `repo.Delete(ctx, workspaceID, id)` call sites in the
postgres integration tests so the whole integration lane compiles again.

## Pre-existing: frontend lint errors in locations/containers pages

`bunx eslint` reports 6 errors on the two list pages that PRE-EXIST this task
(identical count on clean HEAD, confirmed via git stash):

- containers/page.tsx 108:23 + 109:31 — `@typescript-eslint/no-explicit-any`
- containers/page.tsx 1191 (×2) — `react/no-unescaped-entities` (literal `"`)
- locations/page.tsx 970 (×2) — `react/no-unescaped-entities` (literal `"`)

Out of scope for 260607-vdf (none touch the prefill wiring). The new code
added zero lint errors. Typecheck (`tsc --noEmit`) is fully clean.
