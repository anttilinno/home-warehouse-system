# Phase 8: Loans - Context

**Gathered:** 2026-06-13 (synthesized by orchestrator — autonomous run)
**Status:** Ready for planning
**Source:** ROADMAP Phase 8 + parity plan §4 + Phase 7 LoanPanels carry-forward

<domain>
## Phase Boundary

Loans CRUD + lifecycle (LOAN-01..06) + parity additions (extend, overdue highlight, CSV, ?itemId= deep link):

1. **Loans list** (LOAN-01) — tabbed Active / Overdue / History RetroTable (item / borrower / due-date / status pill). Tabs = RetroTabs. Overdue-row highlighting (danger treatment). Per-list CSV export (blob helper from Phase 7; backend export endpoint — research confirms `/export/loan` or similar).
2. **Create loan** (LOAN-02) — /loans/new with item picker + borrower picker (simple RetroSelect, like 7b — populated from item + borrower read endpoints); `?itemId={id}` preselects item (scan-flow deep link, Phase 11 forward-compat).
3. **Return + edit** (LOAN-03/04) — mark returned via RetroConfirmDialog → moves to History; edit due-date + notes after creation; **extend** action `PATCH /loans/{id}/extend` (parity §4).
4. **Item-detail loan panels** (LOAN-05) — Phase 7 shipped read-only LoanPanels.tsx STUBS on ItemDetailPage. Make them REAL: Active Loan panel (if any) + Loan History panel for the item, with return/extend actions wired. (07-06 left them as read-only queries — this phase adds the mutations + completes them.)
5. **Borrower-detail loan panels** (LOAN-06) — Active Loans + Loan History panels for a borrower. **Dependency note:** the Borrower DETAIL PAGE is Phase 9. Build the borrower-loan-panel COMPONENT here (reusable, prop-driven by borrowerId); Phase 9 mounts it on the borrower detail page. If Phase 9's borrower detail doesn't exist yet, the component is shipped + unit-tested in isolation; no orphan route this phase. RESEARCH confirms whether a minimal borrower detail route already exists to mount it, else component-only.

NOT in phase: borrowers CRUD/list (Phase 9 — read endpoints only here for the picker + panels), scan deep-link origin (Phase 11 — just honor ?itemId=).

</domain>

<decisions>
## Locked
- Query keys `["loans", wsId, ...]` per Phase 6 contract; SSE map — research checks if loan.* events emitted (Phase 7 detail panels already use ["loans", wsId, ...] read keys — 07-01 added loansApi.byItem). Reuse loansApi; extend it with list/tabs/create/return/edit/extend/CSV.
- All UI from shipped atoms (RetroTabs, RetroTable, FilterBar, Dialog/ConfirmDialog, FormField, Select, StatusPill, Pagination) + Phase 7 patterns.
- Loan status → StatusPill: active/overdue/returned (research confirms backend enum). Overdue = computed (due_date < now AND not returned) or backend flag — research confirms; danger row highlight + pill.
- Pickers: item + borrower simple selects (limit ≤ 100 — the 7b/Phase-7 cap lesson; clamp).
- Return/extend optimistic + revert (Phase 7b inline pattern); confirm dialog for return.
- Routes: /loans, /loans/new, /loans/:id (detail or edit) under AppShell; Sidebar INVENTORY (or a Loans group) entry enabled.
- ?itemId= via useSearchParams preselect (Phase 7 form-prefill pattern).
- CSV via blob helper (Phase 7 downloadBlob).

## Claude's Discretion
- Tab implementation (URL param ?tab= vs local state — prefer URL for deep-link consistency with Phase 7 list), loan detail vs inline edit, exact columns, borrower-panel placement.

</decisions>

<canonical_refs>
- Backend REAL contracts (research enumerates + curl): loan domain (list, active/overdue, return, extend PATCH, per-item/per-borrower/per-inventory loan lists, CRUD), borrower read endpoints (for picker + panels)
- frontend2/src/lib/api/items.ts (loansApi.byItem already exists from 07-01 — extend it) + lib/api.ts (put/blob helpers from Phase 7)
- frontend2/src/features/items/components/LoanPanels.tsx (Phase 7 read-only stub — make real) + ItemDetailPage.tsx
- frontend2/docs/sse-invalidation-contract.md
- Phase 7/7b UI-SPECs (tabs, table, dialog, picker, optimistic patterns) + sketch 008 + sketch-findings SKILL
- Legacy STRUCTURE: frontend/app/.../loans/** (tabs, create pickers, return, extend), frontend/lib/api/loans.ts
- CLAUDE.md (E2E auth rate-limit constraint — batch specs)

</canonical_refs>

<specifics>
- Tabs: Active (not returned, not overdue), Overdue (not returned + past due), History (returned). Likely backend has /loans/active + /loans/overdue OR a status filter — research confirms exact endpoints.
- ?tab= URL param for deep-link; default Active.
- Extend: PATCH /loans/{id}/extend — body shape (new due date? days?) research confirms.
- E2E (live, batch-aware): create loan (item+borrower picker) → appears in Active → mark returned → moves to History. Run as its own spec; mind the 20/min auth limiter.

</specifics>

<deferred>
- Borrowers list/CRUD (Phase 9) — read-only picker + panels here.
- Scan deep-link source (Phase 11) — honor ?itemId= only.
- CSV could fold into Phase 14 central exports — but per-list export button is in scope here (parity §4); central screen is Phase 14.

</deferred>

---

*Phase: 08-loans (depends on 7b — loans reference inventory)*
