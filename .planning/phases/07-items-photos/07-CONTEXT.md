# Phase 7: Items + Photos - Context

**Gathered:** 2026-06-13 (synthesized by orchestrator — autonomous run)
**Status:** Ready for planning
**Source:** ROADMAP Phase 7 + parity plan §4 + legacy items feature

<domain>
## Phase Boundary

Full items CRUD + photo pipeline (ITEM-01..10) plus parity additions:

1. **Items list** — paginated RetroTable (25/page), search, filter chips (category/location/archived) via FilterBar/FilterPopover atoms, sort headers, URL-driven query params (deep-linking), `useShortcuts("items", [N|/|F])` (ITEM-01, ITEM-10). PLUS: bulk selection (useTableSelection) + bulk archive/delete via BulkActionBar/Bottombar chips; SavedFilters presets; per-list CSV export hook-in point (a small export button slot calling a backend export endpoint if it exists — research verifies; otherwise stub the hook point for Phase 14).
2. **Item detail** — all fields, photo gallery, active-loan panel, loan history panel (ITEM-02). PLUS: labels attach/detach UI (read-only label list until Phase 10 manager — attach/detach endpoints exist); **inventory panel STUB** (placeholder panel; real one ships with 7b — slot must exist so 7b swaps it in).
3. **Create/edit** — /items/new (?barcode= prefill), /items/{id}/edit, RHF+zod, optimistic invalidation of itemKeys.all + detail keys (ITEM-03/04). Query keys MUST follow the Phase 6 contract: ["items", wsId, ...rest].
4. **Archive/delete lifecycle** — archive/unarchive, archived hidden by default + filter chip, delete only-when-archived with type-to-confirm (ITEM-05/06).
5. **Photo pipeline** (ITEM-07/08) — upload (JPEG/PNG/HEIC, client resize, 10MB cap, native FormData multipart — no upload lib), gallery + lightbox (arrows + ESC via modal stack), set-primary, per-photo delete with confirm. PLUS parity extras: captions (edit), reorder, bulk-delete, bulk-caption, zip download, duplicate-check warning dialog (backend /photos/check-duplicate), client-side compression + EXIF rotation before upload (port frontend/lib/utils/image.ts STRUCTURE).
6. **Barcode lookup** (ITEM-09) — `itemsApi.lookupByBarcode` already EXISTS from Phase 65 work? RESEARCH MUST CHECK: frontend2 was rebuilt; the helper may or may not have survived the wipe. The backend endpoint + Go integration test exist (G-65-01). Re-add the helper per the locked pattern (404→null, encodeURIComponent) if missing; preserve the integration-test guard.

NOT in phase: inventory entries (7b), loans CRUD (8 — detail panels read-only here; if loan endpoints needed for panels, read-only queries fine), label CRUD (10), scan page (11), CSV export full feature (14 — hook point only).

</domain>

<decisions>
## Implementation Decisions

### Locked
- Query keys: `["items", wsId, ...]` per Phase 6 contract; SSE invalidation map already routes item events to this prefix. Register nothing new in SSEProvider — keys just match.
- All UI from Phase 4 atoms (RetroTable/Pagination/Tabs/FilterBar/FilterPopover/BulkActionBar/SavedFilters/Dialog/ConfirmDialog/FormField/FileInput/Toast/EmptyState/StatusPill) + Phase 3 chrome. NO new atom inventions without UI-SPEC justification.
- Photos: native FormData via api.ts multipart support (locked invariant — api.ts already handles multipart); no upload library.
- Image processing: canvas-based resize/compression + EXIF orientation fix, ported from legacy image.ts STRUCTURE (no new deps — verify legacy used no lib; if it did, hand-roll canvas path).
- Loan panels on detail: read-only queries against loans endpoints (["loans", wsId, ...] keys); CRUD is Phase 8.
- Routes: /items, /items/new, /items/:id, /items/:id/edit under AppShell; Sidebar INVENTORY group gets Items entry enabled.
- Pagination: server-driven (25/page) — research confirms backend list contract (offset/cursor).
- Lightbox ESC through modal stack (TUI-02 discipline).

### Claude's Discretion
- Detail page layout composition, gallery grid density (sketch 008 density rules), form field grouping, photo upload UX details (progress per file vs batch), CSV hook-point shape.

</decisions>

<canonical_refs>
## Canonical References

- Phase 6 contract doc: `frontend2/docs/sse-invalidation-contract.md` (key prefix rule — BINDING)
- `frontend2/src/lib/api.ts` (multipart support — locked)
- Backend: `backend/internal/domain/warehouse/item/` + `itemphoto/` + label attach endpoints (REAL contracts — research enumerates)
- G-65-01 integration test: `backend/internal/domain/warehouse/item/` (-tags=integration) — must stay green
- Legacy STRUCTURE: `frontend/app/[locale]/(dashboard)/dashboard/items/**`, `frontend/components/items/**`, `frontend/lib/api/items.ts`, `frontend/lib/utils/image.ts`, `frontend/lib/hooks/use-bulk-selection.ts`, `use-saved-filters.ts`
- STATE.md Phase 65 history (lookupByBarcode pattern: direct by-barcode GET, 404→null, encodeURIComponent, case-sensitivity guard)
- Sketch 008 (table density) + sketch-findings SKILL (BINDING)
- CLAUDE.md (by-barcode Playwright spec is a STANDING GAP to re-add — scan flow is Phase 11, but if a cheap list-page barcode E2E fits here, note it; the full by-barcode browser spec lands with Phase 11)

</canonical_refs>

<specifics>
## Specifics

- URL params: ?q=&category=&location=&archived=&sort=&page= — single source for list state; SavedFilters presets capture this shape.
- Duplicate-check: on upload, call check-duplicate; on hit show warning dialog (proceed/cancel) before committing upload.
- HEIC: backend converts or accepts? Research verifies; client may need accept-list only.
- E2E (live stack): item create → appears in list → detail renders → archive → filtered out → unarchive. Photo upload E2E only if cheap (file fixture); else unit+MSW with manual residue.

</specifics>

<deferred>
- Inventory panel real implementation (7b — stub slot here)
- Label CRUD (10), scan page + full by-barcode browser spec (11), central exports (14)
- Form drafts/sessionStorage autosave (parity plan: nice-to-have — SKIP unless trivially cheap during forms work)
</deferred>

---

*Phase: 07-items-photos*
