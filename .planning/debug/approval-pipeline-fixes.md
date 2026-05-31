---
slug: approval-pipeline-fixes
status: resolved
trigger: "Pending-change approval pipeline: (A) ApproveChange does approve+apply+save as three non-transactional writes with no idempotency -> duplicate-apply on retry; (B) apply*Change create handlers unmarshal only a narrow field subset, silently dropping submitted fields; (C) approval middleware gates only 8 entity types, rest bypass approval. Fix all three."
created: 2026-05-31
updated: 2026-05-31
---

# Debug Session: approval-pipeline-fixes

## Symptoms

Three distinct defects in the pending-change approval pipeline.

- **Expected behavior:**
  (A) Approving a pending change applies the entity mutation and marks the change approved atomically — all-or-nothing — and a duplicate/retried approval is a no-op.
  (B) An approved change reproduces exactly what the member submitted — no field loss.
  (C) Either every member-mutable entity type is routed through approval, or any intentional exclusion is documented.
- **Actual behavior:**
  (A) `ApproveChange` (service.go ~L165) runs `change.Approve` (L193), `applyChange` (L198, mutates real entity), and `repo.Save(change)` (L203) as three separate writes with no transaction. If apply succeeds but Save fails, entity is mutated while change still reads "pending" -> retry re-applies (duplicate create / re-update). No idempotency guard. `infra/postgres` `TransactionManager` exists but is unused here.
  (B) `applyItemChange` ActionCreate (and sibling `apply*Change`) unmarshals only a narrow subset (e.g. `{Name, SKU, MinStockLevel}`) then calls `item.NewItem` with 3 fields — drops description/category/location/barcode/etc the member submitted.
  (C) `approval_middleware.go` `extractEntityType` intercepts only 8 types (item, category, location, container, inventory, borrower, loan, label). photos, attachments, repair logs, etc. are not gated — members mutate them directly, bypassing approval.
- **Error messages:** None — silent correctness/consistency defects.
- **Timeline:** Pre-existing; surfaced via graphify trace.
- **Reproduction:** Code inspection of `backend/internal/domain/warehouse/pendingchange/service.go` (ApproveChange, apply*Change) and `backend/internal/api/middleware/approval_middleware.go` (extractEntityType).

## Known root cause (pre-diagnosed)

Diagnosis complete via code trace. Reference:
`graphify-out/memory/query_20260531_190938_how_does_the_pending_change_approval_pipeline_work.md`

Verified against current code before fixing: confirmed all three (A: L193/198/203 sequential non-tx writes, no idempotency; B: applyItemChange create unmarshals only 3 fields; C: extractEntityType + isValidEntityType both gate exactly 8 types).

## Fix scope (user-approved)

- **(A) Transactional + idempotent approve.**
- **(B) Full payload fidelity for each apply\*Change create/update handler.**
- **(C) Entity-gating coverage — extend OR document deliberate exclusions.**

## Current Focus

- hypothesis: confirmed — all three localized to pendingchange/service.go + approval_middleware.go; TxManager and per-domain create-input structs already exist.
- next_action: (done) all three fixes applied and verified by build + tests.

## Evidence

- timestamp: 2026-05-31 — `infra/postgres/tx.go` exposes `TxManager.WithTx(ctx, fn)` which is context-propagating: repos pick up the active tx from context via `GetDBTX`. No domain imports `infra/postgres` (loan/service.go even leaves TODO comments to "wire TxManager in router.go") — confirming the convention is a domain-side port, not a direct infra import. Drove the `Transactor` interface defined in the pendingchange package.
- timestamp: 2026-05-31 — Item's optional fields (description, category, brand, barcode, ...) are UNEXPORTED and set only inside the `item` package (e.g. `item.Service.Create`). External packages cannot replicate the full create via entity primitives; the only faithful full-field create path is the domain `Service`. Same for inventory (no entity-level `Update`; optional fields set only in `inventory.Service.Create`). This forced fix B to route through the domain `ServiceInterface`s rather than re-marshalling against repos.
- timestamp: 2026-05-31 — All 8 domains expose a `ServiceInterface` with uniform Create/Update. `Delete(ctx, id, workspaceID)` exists on item/category/location/container/borrower/label services, but inventory and loan have NO service-level Delete (they expose archive/return). Their delete path therefore stays on the repo (`Delete(ctx, id)`); delete carries no payload so fidelity is unaffected.
- timestamp: 2026-05-31 — Many warehouse domains beyond the gated 8 are member-mutable sub-resources (itemphoto/`/photos`, attachment/`/attachments`, repairlog+repairphoto+repairattachment/`/repairs`, movement/`/movements`, favorite/`/favorites`, activity/`/activity`). These are sub-resources/audit/view-state applied atomically with or derived from a gated parent — deliberate exclusions, documented rather than gated (conservative call per scope).
- timestamp: 2026-05-31 — Pre-existing, UNRELATED test failures present in the working tree (uncommitted workspace_id-scoping work the note warned about): `loan.TestService_Return_InventoryDeleted` and `internal/jobs.TestCleanupConfig_RetentionPeriodUsage`. Verified pre-existing by stashing my changes (loan still failed) and confirming `jobs` does not reference pendingchange. Not caused by this fix.
- timestamp: 2026-05-31 — `pendingchange/handler_integration_test.go` (build tag `integration`, `package pendingchange`) imports `infra/postgres`, which imports back into the `pendingchange` package via `pendingchange_repository.go` => structural import cycle. This file never compiled under `-tags=integration` even before this change (its `NewService` call also predated the current signature). Updated the `NewService` call to the new signature so it is no worse; the cycle itself is pre-existing and out of scope (would require relocating the test to an external `_test` package).

## Eliminated

- Re-implementing full-field create against repositories (rejected): item/inventory optional fields are unexported, so this is impossible without duplicating each domain's validation/uniqueness/short-code logic — would reintroduce a second class of bugs.
- Wrapping repo mocks in real domain services in the existing test suite (rejected): domain `Create` runs validation side-effects (e.g. inventory validates item/location via repo `FindByID`) that would break the existing repo-level assertions. Mocking the service interfaces directly is the correct isolation boundary.

## Resolution

- **root_cause:** Three independent defects in the approval pipeline: ApproveChange wrote approve/apply/save non-transactionally with no idempotency guard; apply\*Change create handlers dropped submitted fields by bypassing the domain create path; and only 8 entity types were gated with no documented rationale for the rest.
- **fix:**
  - **(A)** `ApproveChange` now wraps re-fetch + `Approve` + `applyChange` + `repo.Save` in a single `Transactor.WithTx` transaction. A new `Transactor` port (in the pendingchange package, satisfied by `infra/postgres.TxManager`, wired in `router.go`) keeps the domain infra-free. The change is re-fetched inside the tx and its persisted status re-checked; a non-pending change short-circuits as a no-op (idempotent retry). On nil Transactor the service falls back to a `noopTransactor` (used by unit tests). SSE/push side effects are skipped on the idempotent no-op path.
  - **(B)** All 8 `apply*Change` handlers now unmarshal the complete submitted field set and apply it through the canonical domain `ServiceInterface` (`Create`/`Update`), reusing each domain's validation, uniqueness checks, and short-code generation. The pendingchange `Service` now depends on the 8 domain services (plus inventory/loan repos for their delete paths) instead of raw repos. `router.go` wiring updated accordingly.
  - **(C)** Kept the gated set at the 8 first-class entities (conservative call) and documented the deliberate exclusions: new `docs/APPROVAL_PIPELINE.md` ("Entity coverage and deliberate exclusions") plus code comments on `extractEntityType`/`isValidEntityType` noting the two lists must stay in sync and that photos/attachments/repairs/movements/favorites/activity are intentionally excluded as sub-resources/audit/view-state. A follow-up path for promoting any of them to gated is documented.
- **files:**
  - `backend/internal/domain/warehouse/pendingchange/service.go` (A + B)
  - `backend/internal/domain/warehouse/pendingchange/service_test.go` (rewritten to service-interface mocks; covers approve/reject/permissions/idempotency/rollback + per-entity create/update/delete)
  - `backend/internal/api/middleware/approval_middleware.go` (C docs/comments)
  - `backend/internal/api/router.go` (wiring: domain services + TxManager into pendingchange.NewService)
  - `backend/internal/domain/warehouse/pendingchange/handler_integration_test.go` (NewService signature update; pre-existing import cycle noted)
  - `docs/APPROVAL_PIPELINE.md` (new)
- **verification:** `go build ./...` clean; `go vet ./...` clean; `go test ./internal/domain/warehouse/pendingchange/... ./internal/api/middleware/...` pass. Full `go test ./...` shows only two pre-existing, unrelated failures (`loan.TestService_Return_InventoryDeleted`, `internal/jobs.TestCleanupConfig_RetentionPeriodUsage`) confirmed present with this change stashed.
- **design decisions / deviations from a literal reading of scope:**
  - Fix B routes through domain **services** (not repo re-marshalling) — required because item/inventory optional fields are unexported.
  - Fix C **documents** exclusions rather than extending gating (the conservative call the scope explicitly authorizes when extend-vs-document is ambiguous).
  - Test suite migrated to service-interface mocks (full rewrite of `service_test.go`) since the architecture moved from repos to services.
