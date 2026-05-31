---
slug: tenant-mutation-scope
status: resolved
trigger: "Tenant isolation gap: warehouse mutation SQL (UpdateLocation, ArchiveLocation, RestoreLocation, DeleteLocation, and equivalents in categories, containers, borrowers, companies, labels, repair_logs) uses WHERE id = $1 with no workspace_id scoping. Safe today only via service-layer read-before-write. Fix: add AND workspace_id = $N to all affected mutation SQL, regenerate sqlc, update repo signatures + callers to pass workspaceID, matching reads which already do WHERE id=$1 AND workspace_id=$2."
created: 2026-05-31
updated: 2026-05-31
---

# Debug Session: tenant-mutation-scope

## Symptoms

- **Expected behavior:** Warehouse mutation queries (UPDATE/ARCHIVE/RESTORE/DELETE) should be scoped by `workspace_id` at the SQL layer, providing defense-in-depth identical to read queries (which use `WHERE id = $1 AND workspace_id = $2`). A mutation targeting a row in another tenant's workspace must affect zero rows.
- **Actual behavior:** Mutation SQL uses `WHERE id = $1` only — no `workspace_id` predicate. Cross-tenant protection relies solely on the service layer performing a workspace-scoped `GetByID` read-before-write. If any handler calls the repo mutation directly, or a future service method omits the `GetByID` guard, a cross-tenant write/delete succeeds. No Postgres RLS backstop.
- **Error messages:** None — silent correctness/security gap, not a crash.
- **Timeline:** Pre-existing architectural pattern surfaced via graphify knowledge-graph trace (NewFieldError/tenant-isolation analysis).
- **Reproduction:** Inspect `backend/db/queries/{locations,categories,containers,borrowers,companies,labels,repair_logs}.sql` — Update/Archive/Restore/Delete named queries lack `AND workspace_id`. Compare to the same files' SELECT queries which do scope by workspace.

## Known root cause (pre-diagnosed)

Diagnosis already complete via code trace. Reference:
`graphify-out/memory/query_20260531_185823_how_is_multi_tenant__workspace__isolation_enforced.md`

Mutation SQL in 7 domains omits `workspace_id` from the `WHERE` clause. The generated sqlc code lives in `backend/internal/infra/queries/*.sql.go`. Repo method signatures and their callers (domain service layers) must thread `workspaceID` into these mutations.

## Fix scope (user-approved: all affected domains)

1. Add `AND workspace_id = $N` to every Update/Archive/Restore/Delete (and similar mutating) named query in:
   `locations.sql, categories.sql, containers.sql, borrowers.sql, companies.sql, labels.sql, repair_logs.sql`
   (audit each file for the full set of mutating queries — also check `HasChildren`, status-update, complete, reminder-sent variants flagged in the trace).
2. Regenerate sqlc (`backend/internal/infra/queries/*.sql.go`) using the project's sqlc config/command.
3. Update repo method signatures to accept `workspaceID uuid.UUID` and pass it as the new bind parameter.
4. Update all callers (domain `service.go` mutation methods) to pass `workspaceID`.
5. Preserve the existing service-layer `GetByID` read-before-write guard — this fix adds a second layer, does not replace the first.

## Current Focus

- hypothesis: Mutation SQL lacks workspace_id scoping; adding it + threading workspaceID through repo/sqlc/callers closes the gap without behavior change for legitimate same-tenant operations.
- next_action: resolved — fix applied and verified.

## Evidence

- timestamp: 2026-05-31 — Diagnosis verified directly against the 7 query files. Confirmed every Update/Archive/Restore/Delete named query in locations, categories, containers, borrowers, companies, labels uses bare `WHERE id = $1`. repair_logs: UpdateRepairLog, UpdateRepairLogStatus, CompleteRepairLog, DeleteRepairLog, MarkRepairReminderSent all unscoped; HOWEVER UpdateRepairLogWarrantyClaim and UpdateRepairLogReminderDate already correctly scope `AND workspace_id = $3` (left unchanged). categories.HasChildren scoped only by `parent_category_id` (no workspace_id) — added.
- timestamp: 2026-05-31 — Caller analysis: every entity (Location/Category/Container/Borrower/Company/Label/RepairLog) exposes `WorkspaceID()`. Service-layer mutation methods (Archive/Restore/Delete) already receive `id, workspaceID` from handlers and already perform the `GetByID(ctx, id, workspaceID)` read-before-write guard. `workspaceID` (or `entity.WorkspaceID()` / `change.WorkspaceID()`) is available at all repo call sites including pendingchange apply-handlers.
- timestamp: 2026-05-31 — Interface signature changes required: `Delete` (all 7 domains), `Archive`/`Restore` (borrower only — others soft-archive via Save upsert), `HasChildren` (category), `MarkReminderSent` (repairlog). Save-driven mutations (UpdateCategory, UpdateBorrower, UpdateRepairLog/Status/Complete) pass `entity.WorkspaceID()` internally — no interface change.

## Eliminated

- Postgres RLS backstop: not present; confirmed the only cross-tenant protection was the service-layer read-before-write. This fix adds the SQL-layer predicate as a second, independent defense.

## Resolution

- root_cause: Warehouse mutation SQL across 7 domains (locations, categories, containers, borrowers, companies, labels, repair_logs) scoped only by `WHERE id = $1`, with no `workspace_id` predicate — leaving cross-tenant write/delete protection dependent solely on a service-layer read-before-write guard with no SQL-layer or RLS backstop.
- fix: Added `AND workspace_id = $N` to every mutating named query in the 7 query files (Update/Archive/Restore/Delete plus categories.HasChildren and repair_logs status/complete/reminder variants), regenerated sqlc, threaded `workspaceID` through the repo method signatures (Delete×7, borrower Archive/Restore, category HasChildren, repairlog MarkReminderSent) and their domain Repository interfaces, and updated all service-layer + pendingchange callers to pass `workspaceID` (via `entity.WorkspaceID()` / `change.WorkspaceID()`). Save-driven updates pass the entity's WorkspaceID internally. The existing service-layer GetByID read-before-write guard is preserved as the first defense layer. Verified with `go build ./...` and `go vet`/tests.
