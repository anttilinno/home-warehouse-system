# Phase 59: Borrowers CRUD — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Borrowers management section: a `/borrowers` list page and a `/borrowers/:id` detail page. The list is flat (not hierarchical) — shows all borrowers with name and contact info. Create/edit via slide-over panel. Delete follows the archive-first pattern from Phase 58. The borrower detail page renders section headers for active and historical loans as placeholders only — loan data is wired in Phase 62. No sidebar navigation wiring (Phase 63).

</domain>

<decisions>
## Implementation Decisions

### Active Loan Count (BORR-01)
- **D-01:** Do NOT show active loan count in the borrower list. The backend `BorrowerResponse` does not include a count field, and fetching loans per-borrower creates N+1 queries. The list shows **name** and available contact info (email, phone where present). This is accepted scope adjustment — the requirement is met by showing the borrower list; the count is deferred until the API exposes it.

### Archive/Delete Flow (BORR-04)
- **D-02:** **Archive-first** confirm dialog, identical to Phase 58 taxonomy pattern:
  - Primary action: **ARCHIVE** (amber `RetroButton variant="primary"`) — soft-archives the borrower, reversible via Restore
  - Secondary action: small `delete permanently` text link below buttons — triggers a second danger-styled `RetroConfirmDialog` before hard-delete
  - If backend returns 400 (active loans), surface as an error toast: "Cannot delete: this borrower has active loans." — the archive action is always available regardless
  - Archived borrowers can be Restored from the same archive-first dialog on archived rows

### Archived Borrower Visibility (BORR-01 extension)
- **D-03:** Archived borrowers are **hidden by default**. A "Show archived" filter chip or toggle in the list header reveals them. Archived rows render with muted text style and an ARCHIVED badge. Each archived row has a Restore action.

### Borrower Detail — Loan Sections (BORR-05)
- **D-04:** The borrower detail page (`/borrowers/:id`) renders two section headers: "Active Loans" and "Loan History". Both sections show a `RetroEmptyState` placeholder ("Loan data will be available soon"). Real loan data is wired by Phase 62 via `loansApi.listForBorrower`. Phase 59 does NOT call the loans API.

### Claude's Discretion
- List layout: `RetroTable` with columns for name, email (if present), phone (if present), and action buttons — preferred given the tabular contact-info nature of borrower data
- SlideOverPanel reuse pattern: follow `EntityPanel.tsx` from Phase 58 (single panel with create/edit modes)
- Route structure: `/borrowers` (list) and `/borrowers/:id` (detail) as child routes under the app layout
- Query invalidation: invalidate `borrowerKeys.all` after create/update/archive/restore/delete mutations
- Form schema: name (required, min 1 char), email (optional, email format), phone (optional, string), notes (optional, string)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Borrower API (Phase 56)
- `frontend2/src/lib/api/borrowers.ts` — Borrower types (`Borrower`, `CreateBorrowerInput`, `UpdateBorrowerInput`), `borrowersApi` CRUD functions, `borrowerKeys` query key factory. Note: no active_loan_count in BorrowerResponse; archive/restore endpoints are NOT yet typed here — must be added.
- `frontend2/src/lib/api/loans.ts` — `loansApi.listForBorrower` exists (for Phase 62); do NOT call in Phase 59.

### Archive-First Pattern Reference (Phase 58)
- `.planning/phases/58-taxonomy-categories-locations-containers/58-CONTEXT.md` — D-04 archive-first dialog spec: primary ARCHIVE action, secondary "delete permanently" link, 400 guard → error toast, Restore on archived nodes.
- `frontend2/src/features/taxonomy/panel/EntityPanel.tsx` — Slide-over panel with create/edit modes; adapt for borrower entity.
- `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` — SlideOverPanel component; direct reuse.

### Retro Component Library (Phase 57)
- `frontend2/src/components/retro/RetroFormField.tsx` — Controller-for-all wrapper; use for every borrower form field.
- `frontend2/src/components/retro/RetroConfirmDialog.tsx` — Archive-first and hard-delete confirmation dialogs.
- `frontend2/src/components/retro/RetroEmptyState.tsx` — Empty borrower list and loan section placeholders.
- `frontend2/src/components/retro/RetroTable.tsx` — Borrower list table.
- `frontend2/src/components/retro/index.ts` — Barrel; all retro imports come from here.

### Backend Handler (for verifying API shapes)
- `backend/internal/domain/warehouse/borrower/handler.go` — List, get, create, update, archive, delete endpoints. Delete returns 400 with "cannot delete borrower with active loans" when guard fires. Archive endpoint exists. Verify archive/restore URL patterns here.

### Auth & Routing
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth().workspaceId` for API calls.
- `frontend2/src/routes/index.tsx` — Add `/borrowers` and `/borrowers/:id` routes here.

### Project Requirements
- `.planning/REQUIREMENTS.md` — BORR-01 through BORR-05 acceptance criteria (active scope for this phase).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SlideOverPanel.tsx` — Direct reuse for create/edit borrower panel; already handles dirty-state guard and focus management via `@floating-ui/react`.
- `EntityPanel.tsx` — Pattern reference for wiring SlideOverPanel to form + mutation hooks; Phase 59 creates a `BorrowerPanel` following the same structure.
- `RetroConfirmDialog.tsx` — Reuse for archive-first dialog (primary: ARCHIVE, secondary: delete permanently link) and hard-delete confirmation.
- `RetroEmptyState.tsx` — Use for empty borrower list and loan section placeholders on detail page.
- `RetroTable.tsx` — Use for the borrower list table.

### Established Patterns
- All hooks read `workspaceId` from `useAuth()` — do not pass as prop.
- TanStack Query mutation hooks: invalidate `borrowerKeys.all` after each mutation.
- Lingui `t` macro for all user-visible strings — mandatory.
- `font-mono` for IDs/badges; `font-sans` for labels and names.
- All interactive controls: `min-height: 44px` touch targets.
- Archive/restore endpoints need to be added to `borrowers.ts` (not yet typed in Phase 56 output).

### Backend API Shape Notes
- `BorrowerResponse`: `id`, `name`, `email?`, `phone?`, `notes?`, `is_archived`, `created_at`, `updated_at`. No loan count.
- Delete guard: returns HTTP 400 "cannot delete borrower with active loans".
- Archive endpoint exists in backend — verify URL pattern in `handler.go` before typing in frontend.
- List supports `page` and `limit` query params (default limit 50).

### Integration Points
- `frontend2/src/routes/index.tsx` — Add `/borrowers` (list) and `/borrowers/:id` (detail) routes.
- `frontend2/src/lib/api/borrowers.ts` — Add archive/restore functions alongside existing CRUD.
- `frontend2/src/lib/api/index.ts` — Verify `borrowersApi` and `borrowerKeys` are re-exported.

</code_context>

<specifics>
## Specific Details

- Borrower list columns: Name (primary), Email (secondary, dimmed if absent), Phone (secondary, dimmed if absent), action buttons (Edit, Archive/Restore, Delete)
- Archive-first dialog copy (borrowers): "This will hide '[Name]' from loan pickers. You can restore them later." — no loan count shown (D-01)
- Hard-delete danger dialog copy: "Permanently delete '[Name]'? This cannot be undone."
- 400 error toast copy: "Cannot delete: [Name] has active loans."
- Loan section placeholder copy on detail page: "Loan history will appear here once loans are wired." (or `RetroEmptyState` with appropriate label)
- "Show archived" chip: follows ITEM-08 pattern (archived items toggle) for consistency with future Items phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 59-borrowers-crud*
*Context gathered: 2026-04-16*
