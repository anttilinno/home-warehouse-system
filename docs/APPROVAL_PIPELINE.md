# Approval Pipeline

The approval pipeline lets workspace **members** propose changes that workspace
**owners/admins** review before they take effect. Owners and admins write
directly; viewers are read-only.

## Flow

1. A member issues a create/update/delete against a gated entity endpoint.
2. `ApprovalMiddleware`
   (`backend/internal/api/middleware/approval_middleware.go`) intercepts the
   request, buffers the JSON body, and calls
   `pendingchange.Service.CreatePendingChange`. The member receives
   `202 Accepted` with a pending-change id; the underlying handler does **not**
   run.
3. An owner/admin approves or rejects via the pending-change endpoints.
4. On approval, `pendingchange.Service.ApproveChange` applies the change through
   the **canonical domain service** for that entity (the same code path used for
   direct admin writes).

## Atomicity and idempotency (fix A)

`ApproveChange` performs *approve + apply + persist* inside a single database
transaction via the `Transactor` port (implemented by
`infra/postgres.TxManager`). The domain repositories pick up the active
transaction from the context automatically, so the entity mutation and the
pending-change status update commit or roll back together.

Before applying, the change is **re-fetched inside the transaction** and its
status is re-checked. If it is no longer `pending`, the approval short-circuits
as a no-op. This makes a retried or duplicate approval safe: a crash between the
apply and the status write rolls the whole transaction back (no partial apply),
and a concurrent second approval observes the persisted `approved` status and
does nothing.

## Payload fidelity (fix B)

Approved create/update changes are applied through each domain's
`Service.Create` / `Service.Update`, populated with the **complete field set**
the member submitted (verified against each domain's `CreateInput` /
`UpdateInput`). This fixes the earlier defect where create handlers unmarshalled
only a narrow subset (e.g. item create dropped description, category, brand,
barcode, etc.). Routing through the services also reuses their validation,
uniqueness checks (SKU, short code), and short-code auto-generation, so an
approved change reproduces exactly what a direct admin write would have done.

Inventory and loan **deletes** go through their repositories because those
domains expose archive/return semantics rather than a service-level `Delete`.
Delete carries no payload, so this does not affect payload fidelity.

## Entity coverage and deliberate exclusions (fix C)

**Gated** (routed through approval):

| Entity    | Route prefix   |
|-----------|----------------|
| item      | `/items`       |
| category  | `/categories`  |
| location  | `/locations`   |
| container | `/containers`  |
| inventory | `/inventory`   |
| borrower  | `/borrowers`   |
| loan      | `/loans`       |
| label     | `/labels`      |

This set lives in two places that **must stay in sync**:
`middleware.extractEntityType` and `pendingchange.Service.isValidEntityType`.

**Deliberately excluded** (members mutate these directly, no approval):

| Entity / endpoint                                  | Rationale |
|----------------------------------------------------|-----------|
| item photos (`/photos`)                            | Sub-resource of a (gated) item; binary upload, no meaningful "diff" to review; lifecycle is bound to its parent item. |
| attachments (`/attachments`)                       | File sub-resource attached to an already-reviewable parent entity. |
| repair logs / photos / attachments (`/repairs`)    | Maintenance records attached to inventory; reviewing the parent inventory change is the control point. |
| movements (`/movements`)                           | Audit/event records describing actions that already happened; not user-authored content to gate. |
| favorites (`/favorites`)                           | Per-user view state, not shared workspace data. |
| activity (`/activity`)                             | Read-mostly audit trail. |

These are sub-resources or audit/view-state records that are applied atomically
with — or derived from — their parent entity, which is itself gated. Gating them
would require dedicated applier logic in `pendingchange.Service` for little
control benefit. If any of these later becomes a first-class, independently
member-mutable resource, add it to **both** `extractEntityType` and
`isValidEntityType`, and implement an `apply<Entity>Change` handler routed
through that domain's service.
