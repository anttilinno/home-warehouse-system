# Phase 62: Loans — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 62-loans
**Areas discussed:** Edit endpoint (O-01), Loan row decoration (O-02), Per-item loans fetch, Plan chunking

---

## Edit Endpoint (O-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Unified PATCH /loans/{id} | One new backend endpoint accepting `{ due_date?, notes? }`. One `loansApi.update()` method. UI-SPEC Option A. | ✓ |
| Split: extend + updateNotes | Keep existing `/extend` for date, add separate endpoint for notes only. More REST-pure but more moving parts. | |
| Drop notes editing | Notes editing out of scope. Breaks LOAN-04. | |

**User's choice:** Unified PATCH /loans/{id}
**Notes:** Strongly preferred by UI-SPEC; user confirmed Option A.

---

## Loan Row Decoration (O-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Backend embeds item + borrower | Backend extends loan list response to include `item: { id, name, primary_photo_thumbnail_url }` and `borrower: { id, name }`. Zero extra round-trips. UI-SPEC Option A. | ✓ |
| Client-side join | Frontend loads full item + borrower lists once (cached), builds ID→name maps, enriches rows client-side. No backend change. UI-SPEC Option C. | |
| Per-row fetches | N×2 GET requests per page. UI-SPEC explicitly rejects this. | |

**User's choice:** Backend embeds
**Notes:** Matches Phase 61's `primary_photo_thumbnail_url` decoration pattern.

---

## Per-Item Loans Fetch

| Option | Description | Selected |
|--------|-------------|----------|
| Add loansApi.listForItem() | New method calling `GET /workspaces/{wsId}/inventory/{inventoryId}/loans`. Mirrors existing `listForBorrower()`. | ✓ |
| Reuse loansApi.list() with filter | Pass `inventory_id` as query param to existing list endpoint — requires backend change to list route and isn't the dedicated path. | |

**User's choice:** Add loansApi.listForItem()
**Notes:** Symmetric with listForBorrower(); uses the dedicated backend route.

---

## Plan Chunking

| Option | Description | Selected |
|--------|-------------|----------|
| 4 plans (like Phase 59-60) | Backend → API client + hooks → LoansListPage composition → Detail page wiring + i18n + checkpoint. | ✓ |
| 5 plans (split backend larger) | Separate backend PATCH from backend decoration. More granular. | |

**User's choice:** 4 plans
**Notes:** Follows the established Phase 59/60 pattern.

---

## Claude's Discretion

- Whether PATCH /loans/{id} reuses the existing extend handler or is a new handler
- Whether useHashTab is imported from Phase 58 or inlined
- loanKeys.forItem() key shape details
- Exact query invalidation key set after mutations (planner follows UI-SPEC table)

## Deferred Ideas

None.
