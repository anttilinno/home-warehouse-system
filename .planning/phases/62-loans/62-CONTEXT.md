# Phase 62: Loans — Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Loans section end-to-end: tabbed `/loans` list (ACTIVE / OVERDUE / HISTORY) with create-loan and edit-loan slide-overs, mark-as-returned confirm flow, and wiring loan data into the `LOANS` section on `/items/:id` and the `ACTIVE LOANS` / `LOAN HISTORY` sections on `/borrowers/:id`. No loan deletion UI (backend exposes no delete). No `/loans/:id` detail route (all actions are inline via row actions + slide-over). No SSE-driven updates.

The **UI-SPEC is already approved** (`62-UI-SPEC.md`) and defines all visual and interaction decisions. This CONTEXT.md captures the three data-shape decisions and plan structure that the UI-SPEC explicitly left open.

</domain>

<decisions>
## Implementation Decisions

### Edit Endpoint (O-01 resolved)
- **D-01:** Add a **unified `PATCH /loans/{id}`** backend endpoint that accepts `{ due_date?: string; notes?: string }`. This satisfies LOAN-04 (edit both fields in one request). The existing `PATCH /loans/{id}/extend` endpoint remains and may be kept or deprecated — the new endpoint supersedes it for the edit flow.
- **D-02:** Add `loansApi.update(wsId: string, id: string, body: { due_date?: string; notes?: string })` to `frontend2/src/lib/api/loans.ts`. The edit slide-over submits a single call to this method. The `loansApi.extend()` method remains in the API client but is no longer used by the edit flow.

### Loan Row Decoration (O-02 resolved)
- **D-03:** The backend **embeds item and borrower data** directly in loan list responses. Specifically, each loan object in the list response includes:
  - `item: { id: string; name: string; primary_photo_thumbnail_url: string | null }`
  - `borrower: { id: string; name: string }`
  This matches the decoration pattern established in Phase 61 (items list embeds `primary_photo_thumbnail_url`). Zero extra round-trips per row.
- **D-04:** The `Loan` interface in `frontend2/src/lib/api/loans.ts` must be extended to include the embedded `item` and `borrower` fields. The `LoanResponse` struct in the backend handler must likewise include these fields.

### Per-Item Loans Fetch
- **D-05:** Add `loansApi.listForItem(wsId: string, inventoryId: string)` to `frontend2/src/lib/api/loans.ts`. This calls `GET /workspaces/{wsId}/inventory/{inventoryId}/loans`. Mirrors the existing `listForItem` (note: the backend route is `GET /inventory/{inventory_id}/loans` under the workspace scope — verify exact path in `handler.go`). The item detail hooks call this once and partition the result client-side into active loan (first `is_active === true` entry) and history (all `is_active === false` entries, most recent first).
- **D-06:** Add `loanKeys.forItem(inventoryId: string)` to the `loanKeys` query key factory.

### Tab Counts (O-03 resolved per UI-SPEC)
- **D-07:** Tab counts are derived by firing all three list endpoints on page mount (`listActive`, `listOverdue`, `list` without filters for history). Count = `response.items.length`. This is Option B from the UI-SPEC — acceptable for this phase. While any count query is loading, tabs show `{LABEL} · …` (mono ellipsis). All three queries fire in parallel via `Promise.all` / React Query parallel hooks.

### Plan Structure
- **D-08:** Phase 62 splits into **4 plans** following the Phase 59/60 pattern:
  1. **62-01:** Backend — `PATCH /loans/{id}` endpoint + extend `LoanResponse` to embed item/borrower names + `primary_photo_thumbnail_url`
  2. **62-02:** Frontend API client + hooks — `loansApi.update`, `loansApi.listForItem`, `loanKeys.forItem`, query hooks (`useLoansActive`, `useLoansOverdue`, `useLoansHistory`, `useLoansForItem`, `useLoansForBorrower`, `useReturnLoan`, `useCreateLoan`, `useUpdateLoan` mutations)
  3. **62-03:** `LoansListPage` composition — `RetroTabs` integration, `LoansTable`, `LoanRow`, `LoanPanel` (create + edit), `LoanForm`, `LoanRowActions`, `LoanReturnFlow`, pagination, empty states, `useHashTab`
  4. **62-04:** Item/borrower detail wiring — `ItemActiveLoanPanel`, `ItemLoanHistoryPanel`, `BorrowerActiveLoansPanel`, `BorrowerLoanHistoryPanel` replacing Phase 60/59 placeholders + Lingui `t` macro sweep + `bun run extract` + human-verify checkpoint

### Claude's Discretion
- Whether `PATCH /loans/{id}` in the backend reuses the existing `extend` handler (plus a notes field) or is a new handler
- Whether `useHashTab` is imported from Phase 58's location or inlined in the loans feature
- Whether `loanKeys.forItem()` is stored as `forItem` or `list({ inventory_id })` — key shape details
- Whether plan 62-01 also addresses the `listActive` / `listOverdue` embed in one go or leaves the non-list endpoints for a follow-up
- Exact query invalidation key set after each mutation (planner follows UI-SPEC's invalidation table)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Design Contract (primary reference)
- `.planning/phases/62-loans/62-UI-SPEC.md` — **Full visual and interaction contract for Phase 62.** Covers layout, spacing, color, typography, component inventory, copywriting, form schemas, interaction contracts, open data-shape decisions (O-01/O-02/O-03 — all now resolved in this CONTEXT.md), empty states, error states, and ARIA. **Read this entirely before planning.**

### Frontend API
- `frontend2/src/lib/api/loans.ts` — Existing loan API client. **Action items:** add `update()`, add `listForItem()`, extend `Loan` interface with embedded `item` + `borrower` fields, add `loanKeys.forItem()`.
- `frontend2/src/lib/api/items.ts` — Item shape reference for embedded data typing.
- `frontend2/src/lib/api/borrowers.ts` — Borrower shape reference for embedded data typing.

### Backend Loan Domain
- `backend/internal/domain/warehouse/loan/handler.go` — All loan endpoints: `GET /loans`, `GET /loans/active`, `GET /loans/overdue`, `GET /loans/{id}`, `POST /loans`, `POST /loans/{id}/return`, `PATCH /loans/{id}/extend`, `GET /borrowers/{borrower_id}/loans`, `GET /inventory/{inventory_id}/loans`. **Action required:** add `PATCH /loans/{id}` + extend `toLoanResponse()` to embed item/borrower names.
- `backend/internal/domain/warehouse/loan/entity.go` — `Loan` domain entity and constructors.
- `backend/internal/domain/warehouse/loan/service.go` — Service interface. **Action required:** add `Update(ctx, wsID, loanID, dueDate, notes)` method.
- `backend/internal/domain/warehouse/loan/repository.go` — Repo interface. **Action required:** add `Update()` and a join query for embedding item/borrower data.

### Retro Primitives (Phase 62 is first production consumer of RetroTabs)
- `frontend2/src/components/retro/RetroTabs.tsx` — Tab primitive. Phase 62 is its first production use.
- `frontend2/src/components/retro/RetroConfirmDialog.tsx` — Used for mark-as-returned confirmation.
- `frontend2/src/components/retro/RetroEmptyState.tsx` — All empty states (per UI-SPEC copywriting table).
- `frontend2/src/components/retro/RetroCombobox.tsx` — Item + borrower pickers in create form.

### Seam Integration Points (placeholders being replaced)
- `frontend2/src/features/items/ItemDetailPage.tsx` — Phase 60 `LOANS` placeholder at the bottom of the detail page. **Replace** with `<ItemActiveLoanPanel>` + `<ItemLoanHistoryPanel>`.
- `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` — Phase 59 `ACTIVE LOANS` + `LOAN HISTORY` placeholder sections. **Replace** with `<BorrowerActiveLoansPanel>` + `<BorrowerLoanHistoryPanel>`.

### Phase Pattern References
- `.planning/phases/59-borrowers-crud/59-CONTEXT.md` — Archive-first flow, `SlideOverPanel` pattern, `BorrowerPanel` + `BorrowerForm` composition used as the template for `LoanPanel` + `LoanForm`.
- `.planning/phases/60-items-crud/60-CONTEXT.md` — Items list/detail pattern, unsaved-changes guard, row-action cluster conventions.
- `.planning/phases/61-item-photos/61-CONTEXT.md` — `ItemThumbnailCell` (reused in loan rows), `primary_photo_thumbnail_url` decoration pattern.

### i18n
- `frontend2/src/locales/` — Lingui catalogs (`en`, `et`). All new strings must be extracted via `bun run extract` in plan 62-04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loansApi` (`frontend2/src/lib/api/loans.ts`): `list`, `listActive`, `listOverdue`, `listForBorrower`, `get`, `create`, `extend`, `return` — all exist. Needs `update` + `listForItem`.
- `loanKeys` query key factory: `all`, `lists()`, `list(params)`, `details()`, `detail(id)` — exists. Needs `forItem(inventoryId)`.
- `SlideOverPanel` (`frontend2/src/features/taxonomy/panel/SlideOverPanel`): reused from Phase 58/59/60 for the loan create + edit slide-over.
- `useHashTab` — check if Phase 58 exported a reusable hook; if so, import it. If not, inline it in the loans feature.
- `ItemThumbnailCell` (`frontend2/src/features/items/photos/`) — 40×40 thumb cell with `<ImageOff>` fallback, reused in loan rows.
- `RetroTabs` (`frontend2/src/components/retro/RetroTabs.tsx`) — exists, Phase 62 is first production consumer.

### Established Patterns
- **Slide-over panel + form:** `BorrowerPanel` + `BorrowerForm` (Phase 59) is the direct template for `LoanPanel` + `LoanForm`. Same imperative-ref open API.
- **Archive-first confirm:** `ItemArchiveDeleteFlow` (Phase 60) is the template for `LoanReturnFlow` (single-step, non-destructive, amber button not red).
- **Mutation hooks:** `useMutation` with `onSuccess` invalidation, no optimistic updates (Phase 58/59/60/61 baseline).
- **Query keys:** `{entity}Keys` factory pattern with `all`, `lists()`, `list(params)`, `details()`, `detail(id)` — replicate for loans with the added `forItem()` key.
- **Tab hash state:** `useHashTab` from Phase 58 (if exists) maps `location.hash` to active tab. Three values: `active`, `overdue`, `history`. Default: `active`.
- **Empty states:** `RetroEmptyState` with heading + body + optional amber CTA — all copy defined in UI-SPEC copywriting table.

### Integration Points
- `/loans` route: must be registered in the React Router config (same file as `/items`, `/borrowers`). Phase 63 adds the sidebar NavLink; Phase 62 only wires the route.
- Backend: `handler.go` `RegisterRoutes(api, svc, broadcaster)` — add new `huma.Patch(api, "/loans/{id}", ...)` call.
- Backend: `toLoanResponse()` helper — extend to join item name + thumbnail + borrower name from the DB. Verify whether this requires a new repo query (e.g. `GetWithDetails()`) or can piggyback on the existing entity + additional FK lookups in the service layer.

</code_context>

<specifics>
## Specific Ideas

- The UI-SPEC explicitly notes that `RetroTabs` gets its first production use in Phase 62 — worth a quick sanity-check that the component covers the hash-URL tab state or whether that's wired externally via `useHashTab`.
- UI-SPEC says the HISTORY tab replaces the `DUE` column with `RETURNED` and drops the ACTIONS column entirely — `LoansTable` should configure columns as a prop (tab-driven) rather than conditional rendering per cell.
- For the `LOAN DETAILS (LOCKED)` read-only block in the edit panel: the UI-SPEC specifies a single helper text below the block ("This cannot be changed after creation…"), not per-field. Keep this as one `RetroPanel` + text block, not individual locked `RetroFormField`s.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 62-loans*
*Context gathered: 2026-04-17*
