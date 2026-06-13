# Phase 9 — Borrowers — CONTEXT

**Goal:** Flat paginated borrower list + search, create/edit/delete (delete blocked while
any loan active), and a borrower detail page mounting the Phase-8 `BorrowerLoanPanels`.

**Requirements:** BORR-01..05. **Depends on:** Phase 8 (merged).
**Plans (roadmap):** 2. **UI phase:** yes (UI hint).

## What already exists (REUSE, do not rebuild)
- `frontend2/src/features/loans/components/BorrowerLoanPanels.tsx` + `hooks/useBorrowerLoans.ts`
  (Phase 8) — the Active + History loan panels for a borrowerId. BORR-03 = mount this on the
  detail page. It already reuses Plan-04 Return/Extend dialogs + mutations.
- `frontend2/src/features/loans/loanStatus.ts`, `loanCsv.ts` (available if a borrower export is wanted).
- Mirror patterns: `InventoryListPage.tsx` (FilterBar + RetroTable + RetroPagination +
  useShortcuts render-loop guard), `InventoryFormPage.tsx` / `LoanFormPage.tsx`
  (blue Window RHF+zod form, Controller fields, dirty-guard), item/loan detail page layout.
- `loansApi.byBorrower` already exists in `lib/api/loans.ts`.

## Backend surface (verified 2026-06-13, `backend/internal/domain/warehouse/borrower/handler.go`)
All under `/workspaces/{wsId}`:
- `GET /borrowers?page=&limit=&archived=` → **bare `{ items: BorrowerResponse[] }`** —
  **NO `total`/`total_pages`** (same pitfall as loans list). `limit` max **100** (422 over).
  `page` default 1, `limit` default 50, `archived` default false. **NO `q`/search param on list.**
- `GET /borrowers/search?q=&limit=` → SEPARATE search endpoint (used by Phase-8 pickers).
- `GET /borrowers/{id}` → `BorrowerResponse`.
- `POST /borrowers` → body `{ name (req, 1..255), email? (format email), phone?, notes? }`.
- `PATCH /borrowers/{id}` → body all-optional `{ name?, email?, phone?, notes? }`.
- `DELETE /borrowers/{id}` → **400 "cannot delete borrower with active loans"** when blocked
  (NOT 409). Frontend BORR-05 must catch this exact 400 and render the red badge + "View
  active loans" link. (There is also a soft `POST /borrowers/{id}/archive` per D-02 that always
  succeeds — but BORR-05 is a HARD delete with the active-loan guard; archive is out of scope
  unless the parity legacy used it.)
- `BorrowerResponse`: `{ id, workspace_id, name, email?, phone?, notes?, is_archived, created_at, updated_at }`.

## Binding constraints / carry-forward
1. **List has no `total`** → RetroPagination cannot show a page count. Resolve in research:
   either (a) clamp `limit=100` + client-paginate the single page (simplest, matches the
   ≤100 cap), or (b) page/limit with "Next disabled when fewer than `limit` rows returned"
   heuristic. Pick ONE; document. (Loans phase chose bare-list no-pagination; borrowers
   roadmap explicitly wants RetroPagination, so likely (a) fetch≤100 + client paginate.)
2. **Search is a separate endpoint** — when the search box is non-empty, query
   `/borrowers/search?q=` (debounced), else the list endpoint. Mirror how InventoryListPage
   does search (confirm whether it is client-filter or server) and stay consistent.
3. **Delete guard is a 400 string**, not a status flag — the UI must either pre-check active
   loans (via `loansApi.byBorrower` / a count) to show the badge proactively, OR attempt
   delete and map the 400 to the badge + link. Prefer proactive: the detail/list row knows
   active-loan count from `byBorrower` → disable DELETE + show badge when active>0; still
   catch the 400 as a backstop.
4. `limit` caps 100 (422 over) — clamp every borrower list/search read ≤100.
5. **RENDER-LOOP landmine** (4× prior): useShortcuts/useMemo/useEffect deps — `t` via ref,
   destructure `.mutate`. Mirror InventoryListPage exactly.
6. Query keys: `["borrowers", wsId, ...]` prefix (SSE invalidation convention).
7. **BORR-03 mounts BorrowerLoanPanels** — the detail page is the new surface; the panels
   component is done. Detail page also shows borrower profile (name/email/phone/notes) +
   EDIT + DELETE actions + the "View active loans" guard.

## Likely plan split (planner decides)
- **Plan 09-01**: borrowersApi module + zod schema + list/search hooks + `/borrowers` list page
  (FilterBar search, RetroTable, pagination, NEW BORROWER CTA, sidebar/route) + MSW handlers.
- **Plan 09-02**: create/edit form (`/borrowers/new`, `/borrowers/:id/edit`) + detail page
  (`/borrowers/:id` mounting BorrowerLoanPanels) + delete-with-guard + mutations + E2E.
  (Routes/index.tsx is a shared file — single-writer or serialize, per Phase-8 lesson.)

## Open Questions (RESOLVED — phase-researcher + ui-researcher converged, 2026-06-13)
- **OQ1 pagination → fetch `limit=100` + CLIENT-paginate** (PER_PAGE=25), `pageCount =
  ceil(filtered.length/25)`, `?page=` in URL. RetroPagination needs a known pageCount and the
  borrower list returns NO total (handler.go:286-288) — inventory's server-pager cannot be
  copied (inventory list returns a full envelope; borrowers' does not).
- **OQ2 search → CLIENT-filter the loaded ≤100 array** (no debounce, no /search call). Both
  shipped list pages do this (InventoryListPage.tsx:120-132, LoansListPage.tsx:66-78). The
  `/borrowers/search` endpoint stays picker/forward-compat only. (UI-researcher flagged this vs
  the prompt's "wire /search"; phase-researcher independently confirmed client-filter is the
  repo convention — SETTLED: client-filter.)
- **OQ3 delete guard → proactive + reactive backstop.** Proactive: read
  `useBorrowerLoans(...).data.active.length` (already on the detail page via BorrowerLoanPanels)
  → when >0 disable DELETE + show red `RetroBadge variant="danger"` + "View active loans" link.
  Reactive backstop: `DELETE` returns 400 `"cannot delete borrower with active loans"`
  (handler.go:154); `lib/api.ts` surfaces it as `HttpError` with `.status` (:44-57); map via
  `err instanceof HttpError && err.status === 400` (pattern from useItemMutations.ts:56-64).
- **OQ4 archive → NOT ported.** BORR-05 is hard-delete (REQUIREMENTS.md:112). Soft-archive
  endpoint exists (D-02) but legacy used it only as a bulk action; v3.0 parity has no archive UI.
- **OQ5 form fields → name(req 1..255) + email(format-when-supplied)/phone/notes(optional)**,
  mirroring LoanFormPage default-`""` + omit-empty-on-submit + only-when-supplied email refine.
- **OQ6 delete confirm (UI) → plain pink confirm dialog** (not item-style type-to-confirm).
- Detail layout → **stacked** (profile header → BorrowerLoanPanels), not two-column.
