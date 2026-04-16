# Phase 60: Items CRUD — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Items management section: a `/items` list page with search/filter/sort/pagination, and a `/items/:id` detail page. Create/edit via slide-over panel (core fields only). Archive/restore toggle on detail page and list. Hard-delete via archive-first confirm dialog. Phase 60 includes backend work to extend the list endpoint with search/filter/sort/archived params and to register the DELETE handler. Photo and loan sections are placeholder-only on the detail page — wired in Phase 61 and 62 respectively. No sidebar navigation wiring (Phase 63).

</domain>

<decisions>
## Implementation Decisions

### Backend: location/container/status/notes fields (ITEM-03 partial scope)
- **D-01:** The v2 Item entity does NOT have `location_id`, `container_id`, `status`, or `notes` fields. These were on a separate Inventory entity in v1 and were never ported to v2. Phase 60 defers these fields entirely — the detail page shows only what v2 Item currently has (name, SKU, barcode, description, category, is_archived, created_at, updated_at). ITEM-03 is partially satisfied for v2.1; location/container/status/notes are a future phase.

### Backend: List endpoint extension (ITEM-01, ITEM-02)
- **D-02:** Phase 60 extends the `ListItemsInput` handler to support the following query params:
  - `search` — text search by name, SKU, or barcode
  - `category_id` — filter by category UUID
  - `archived` — boolean, default false; true to include archived items
  - `sort` — enum: `name`, `sku`, `created_at`, `updated_at` (default: `name`)
  - `sort_dir` — `asc` / `desc` (default: `asc`)
  - Page size: 25/page (ITEM-01 specifies 25/page)
  The `itemsApi.list()` in `frontend2/src/lib/api/items.ts` already anticipates these params — update its types to match the final backend shape.

### Backend: DELETE /items/{id} handler
- **D-03:** Phase 60 registers `huma.Delete(api, "/items/{id}", ...)` in the handler. The `Delete` method already exists in the repo interface and service. No FK guard needed — items have no blocking constraints. Add `itemsApi.delete()` to `frontend2/src/lib/api/items.ts`.

### Archive/Delete Flow
- **D-04:** Archive-first confirm dialog, identical to Phase 58/59 pattern:
  - Primary action: **ARCHIVE** (amber `RetroButton variant="primary"`)
  - Secondary action: small `delete permanently` text link below buttons — triggers a second danger `RetroConfirmDialog`
  - No backend guard (items have no active-loan constraint like borrowers)
  - Archived items show with muted text + ARCHIVED badge; Restore action available on archived rows in list and detail page

### Create/Edit Form (slide-over panel)
- **D-05:** Core fields only in the create/edit form — same field set for both modes (follows `BorrowerPanel` pattern):
  - **Name** — required, text input
  - **SKU** — auto-generated on open (pattern TBD by planner, e.g. `ITEM-{timestamp}-{random}`), shown pre-filled, user can override
  - **Barcode** — optional, text input
  - **Description** — optional, textarea
  - **Category** — optional, `RetroCombobox` async-searching `categoriesApi.list()`
- Extra fields (brand, model, serial number, warranty, insurance, short_code, min_stock_level) are NOT in the Phase 60 form. They are deferred to a future "Item Details expansion" phase.

### Detail Page Structure
- **D-06:** `/items/:id` detail page sections:
  1. Header: item name, ARCHIVED badge if applicable, action buttons (Edit, Archive/Restore, Delete)
  2. Core fields card: SKU, barcode, description, category name, created/updated timestamps
  3. **Photos** section — `RetroEmptyState` placeholder ("Photo gallery coming soon") — wired Phase 61
  4. **Loans** section — `RetroEmptyState` placeholder ("Loan history coming soon") — wired Phase 62

### List Display
- **D-07:** Items list columns: **Name** (link to detail), **SKU** (font-mono), **Category** (name resolved), **Actions** (Edit, Archive/Restore, Delete buttons)
- **D-08:** Archived items visibility: **filter chip** above the table (not a checkbox) — a retro-styled chip that toggles the `archived` query param. When inactive, archived items are hidden. When active, archived rows render with muted text + ARCHIVED badge.

### Filter Bar
- **D-09:** A compact filter bar above the `RetroTable` contains:
  - Search input (text field, searches name/SKU/barcode via `search` param)
  - Category dropdown (`RetroSelect` or `RetroCombobox` over `categoriesApi.list()`)
  - Sort dropdown (`RetroSelect`: Name, SKU, Created, Updated)
  - "Show archived" filter chip
  All controls are URL-state or component-state (planner decides) — debounced search input.

### Claude's Discretion
- Filter bar state management: URL query params vs. component state (planner decides based on whether deep-linking matters for v2.1)
- Debounce delay for search input
- RetroSelect vs RetroCombobox for category filter (RetroSelect if list is short enough, RetroCombobox if it needs search)
- Query invalidation: invalidate `itemKeys.all` after create/update/archive/restore/delete mutations
- Route structure: `/items` (list) and `/items/:id` (detail) as child routes under the app layout

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Item API (Phase 56)
- `frontend2/src/lib/api/items.ts` — Item type, `itemsApi` CRUD functions, `itemKeys` query key factory. NOTE: `itemsApi.list()` params need updating to match D-02. `itemsApi.delete()` needs adding (D-03). Item type lacks location_id/container_id/status/notes (D-01 — intentional, deferred).

### Backend Handler (extend in Phase 60)
- `backend/internal/domain/warehouse/item/handler.go` — Register `huma.Delete` for `/items/{id}` (D-03). Extend `ListItemsInput` with search/category_id/archived/sort/sort_dir params (D-02). `Delete` method exists in service interface already.
- `backend/internal/domain/warehouse/item/repository.go` — `Delete` method exists; extend `List` repo method with new filter params.
- `backend/internal/domain/warehouse/item/service.go` — `Archive`, `Restore`, `Search`, `List` methods exist. Extend `List` with filter/sort params.

### Archive-First Pattern Reference (Phase 58/59)
- `.planning/phases/59-borrowers-crud/59-CONTEXT.md` — D-02 archive-first dialog spec (primary ARCHIVE, secondary "delete permanently" link, no guard needed for items).
- `frontend2/src/features/borrowers/BorrowersListPage.tsx` — Reference for list page structure, filter checkbox → adapt to filter chip for items.
- `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` — Reference for detail page structure (header, back link, action buttons, section layout).
- `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx` (or `BorrowerPanel` in actions/) — Slide-over panel pattern; adapt for `ItemPanel`.
- `frontend2/src/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx` — Archive-first dialog flow; adapt for `ItemArchiveDeleteFlow`.

### Retro Component Library (Phase 57)
- `frontend2/src/components/retro/RetroFormField.tsx` — Controller-for-all wrapper; use for every item form field.
- `frontend2/src/components/retro/RetroConfirmDialog.tsx` — Archive-first and hard-delete confirmation dialogs.
- `frontend2/src/components/retro/RetroEmptyState.tsx` — Empty items list, photos placeholder, loans placeholder.
- `frontend2/src/components/retro/RetroTable.tsx` — Items list table.
- `frontend2/src/components/retro/RetroCombobox.tsx` — Category picker in create/edit form.
- `frontend2/src/components/retro/index.ts` — Barrel; all retro imports come from here.

### Taxonomy API (for category name resolution)
- `frontend2/src/lib/api/categories.ts` — `categoriesApi.list()` for category combobox in form; also needed to resolve `category_id` → category name in list rows and detail page.

### Auth & Routing
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth().workspaceId` for API calls.
- `frontend2/src/routes/index.tsx` — Add `/items` and `/items/:id` routes here.

### Project Requirements
- `.planning/REQUIREMENTS.md` — ITEM-01 through ITEM-08 acceptance criteria (active scope).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BorrowerPanel` / `BorrowerArchiveDeleteFlow` — Direct structural reference; `ItemPanel` and `ItemArchiveDeleteFlow` follow the same imperative-ref pattern.
- `RetroTable.tsx` — Reuse for items list; already used in BorrowersListPage.
- `RetroCombobox.tsx` — Async category picker in item form; same pattern as taxonomy's parent picker.
- `RetroConfirmDialog.tsx` — Archive confirm + hard-delete confirm; same as Phase 59.
- `RetroEmptyState.tsx` — Empty state for list, photos section, loans section.

### Established Patterns
- All hooks read `workspaceId` from `useAuth()` — do not pass as prop.
- TanStack Query mutation hooks: invalidate `itemKeys.all` after each mutation.
- Lingui `t` macro for all user-visible strings — mandatory.
- `font-mono` for SKU/codes/IDs; `font-sans` for names and labels.
- All interactive controls: `min-height: 44px` touch targets.
- Imperative panel ref pattern: `panelRef.current?.open("create")` / `panelRef.current?.open("edit", item)`.

### Backend API Shape (current + Phase 60 additions)
- `ItemResponse`: id, workspace_id, sku, name, description?, category_id?, barcode?, is_archived?, is_insured?, needs_review?, short_code, min_stock_level, created_at, updated_at. No location/container/status/notes (deferred).
- Archive: `POST /items/{id}/archive` — no body, no guard. Restore: `POST /items/{id}/restore`.
- Delete: `DELETE /items/{id}` — needs to be registered in Phase 60.
- List: `GET /items` — needs search/category_id/archived/sort/sort_dir params added in Phase 60.

### Integration Points
- `frontend2/src/routes/index.tsx` — Add `/items` (list) and `/items/:id` (detail) routes.
- `frontend2/src/lib/api/items.ts` — Update `ItemListParams`, add `delete` function, update `itemsApi.list()`.
- `frontend2/src/lib/api/index.ts` — Verify `itemsApi` and `itemKeys` are re-exported.

</code_context>

<specifics>
## Specific Details

- SKU auto-generation pattern: planner decides (suggest `ITEM-{timestamp}-{random}` or similar), shown pre-filled in create form, fully editable
- Filter chip for "Show archived" — new UI pattern for items (not used in borrowers)
- List category column: resolve category_id to name client-side (fetch category list once, build a lookup map); show "-" if no category
- Detail page back link: "← ITEMS" to `/items` (same style as BorrowerDetailPage)
- Archive-first dialog copy: "This will hide '[Name]' from the items list. You can restore it later."
- Hard-delete danger dialog copy: "Permanently delete '[Name]'? This cannot be undone."
- Photos placeholder copy: "Photos will appear here after Phase 61." (or generic RetroEmptyState)
- Loans placeholder copy: "Loan history will appear here once loans are wired." (same as borrower loan placeholder)
- Page size: 25/page (ITEM-01) — backend default is currently 50; Phase 60 frontend should send `limit=25`

</specifics>

<deferred>
## Deferred Ideas

- `location_id`, `container_id`, `status`, `notes` fields on Item — deferred to a future Inventory/Item-Details phase (D-01)
- Brand, model, serial number, manufacturer, warranty fields in the form — deferred to future "Item Details expansion" phase (D-05)
- Barcode scanning from the items list — deferred to v2.2 per STATE.md decision
- Item labels (attach/detach label) — backend endpoints exist but not surfaced in Phase 60 UI

</deferred>

---

*Phase: 60-items-crud*
*Context gathered: 2026-04-16*
