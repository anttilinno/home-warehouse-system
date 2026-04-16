# Phase 60: Items CRUD — Research

**Researched:** 2026-04-16
**Domain:** React 19 + TanStack Query v5 + react-hook-form + zod over Go/huma backend — paginated list + slide-over CRUD + detail page for inventory items, with backend list-filter and DELETE wiring extensions
**Confidence:** HIGH (frontend patterns + types) / MEDIUM-HIGH (backend changes — gaps identified, mitigation patterns proven by Phase 58/59)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Deferred fields:** v2 `Item` entity does NOT have `location_id`, `container_id`, `status`, or `notes` fields (these were on v1 Inventory entity, never ported to v2). Phase 60 defers these entirely. The detail page shows only what v2 Item has today: name, SKU, barcode, description, category, is_archived, created_at, updated_at. ITEM-03 is partially satisfied for v2.1 — location/container/status/notes are a future phase.
- **D-02 List endpoint extension (ITEM-01, ITEM-02):** Extend `ListItemsInput` handler with:
  - `search` — full-text over name, SKU, barcode
  - `category_id` — filter by category UUID
  - `archived` — boolean, default false; true to include archived items
  - `sort` — enum `name | sku | created_at | updated_at` (default `name`)
  - `sort_dir` — `asc | desc` (default `asc`)
  - Page size 25 (ITEM-01). Update `ItemListParams` types in `frontend2/src/lib/api/items.ts` to match final shape.
- **D-03 DELETE handler:** Register `huma.Delete(api, "/items/{id}", ...)` on the Go side. `Delete` already exists in service interface but currently soft-archives on the postgres side (must be fixed — see Pitfall 3). No FK guard required (items have no blocking constraint like borrowers' active loans). Add `itemsApi.delete()` to `frontend2/src/lib/api/items.ts`.
- **D-04 Archive-first dialog:** Identical to Phase 58/59 pattern. Primary `ARCHIVE` (amber), secondary `delete permanently` text link → second `RetroConfirmDialog` with hazard stripes. No backend guard needed. Archived rows show muted text + ARCHIVED badge + Restore action; archived rows in detail page show the same.
- **D-05 Create/Edit form fields (slide-over panel):** Same field set for create and edit modes:
  - **Name** — required (min 1, max 200)
  - **SKU** — auto-generated on open (planner finalises generator; suggested `ITEM-${Date.now().toString(36).toUpperCase()}-${4-base36}`); required, fully editable; pattern `[A-Za-z0-9_-]+`, max 64
  - **Barcode** — optional, max 64, pattern `[A-Za-z0-9]+`
  - **Description** — optional, max 2000
  - **Category** — optional, `RetroCombobox` async over `categoriesApi.list()`
  - All other backend fields (brand, model, serial number, manufacturer, warranty, insurance, short_code, min_stock_level, purchased_from, image_url, obsidian_*, needs_review) are NOT in the Phase 60 form — they are NOT touched by create/edit and retain their backend defaults / pre-existing values respectively.
- **D-06 Detail page sections:** Header (name + ARCHIVED badge if applicable + EDIT/ARCHIVE/RESTORE/DELETE actions), `DETAILS` card (SKU, barcode, description, category name, created/updated timestamps), `PHOTOS` placeholder via `RetroEmptyState` (Phase 61 wires), `LOANS` placeholder via `RetroEmptyState` (Phase 62 wires).
- **D-07 List columns:** Name (link to detail), SKU (font-mono), Category (resolved name), Actions (Edit, Archive/Restore, Delete). Barcode is searchable but NOT a list column.
- **D-08 Archived visibility:** Filter **chip** above the table (NEW UI pattern — not the Phase 59 `RetroCheckbox`); toggles `archived` query param. Off-state hides archived; on-state interleaves archived rows in the active sort order, muted with line-through name + ARCHIVED badge. (Phase 60 deviates from Phase 59's "always at bottom" behaviour — items honour the active sort.)
- **D-09 Filter bar:** Compact bar above `RetroTable` containing: search input (debounced), category dropdown, sort dropdown, "Show archived" chip. Search input is debounced.

### Claude's Discretion

- **Filter bar state management:** URL query params vs. component state. Recommendation: URL params (deep-linking matters even in v2.1 because it's the natural way to share filtered views; minor cost; consistent with the chip's URL state in UI-SPEC §Interaction Contracts).
- **Debounce delay:** UI-SPEC suggests 300ms (planner may tune). Recommendation: 300ms.
- **RetroSelect vs RetroCombobox for category filter:** UI-SPEC pre-decides RetroCombobox (async over `categoriesApi.list()`). Use RetroCombobox.
- **Query invalidation:** Invalidate `itemKeys.all` after create/update/archive/restore/delete mutations (mirror Phase 58/59 baseline).
- **Route structure:** `/items` (list) + `/items/:id` (detail) under the existing `AppShell` `<Outlet>` — replaces the placeholder `<ItemsPage>` currently registered at `/items`.

### Deferred Ideas (OUT OF SCOPE)

- `location_id`, `container_id`, `status`, `notes` fields on Item — future Inventory/Item-Details phase (D-01)
- Brand, model, serial number, manufacturer, warranty fields in the form — future "Item Details expansion" phase (D-05)
- Barcode scanning from the items list — v2.2 (per STATE.md)
- Item labels (attach/detach label) — backend endpoints exist; not surfaced in Phase 60 UI

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITEM-01 | Paginated items list (25/page) with search by name, SKU, and barcode | Backend: extend `ListItemsInput` with `search` param + add `total` count to `FindByWorkspace` (currently returns `len(items)` instead of true total — see Pitfall 1). Frontend: `useItemsList({page, search, ...})` via `useQuery`; `RetroPagination` (already shipped) wired to `?page=N`. SQL: `search_vector` already exists for tsquery (verified in `items.sql` lines 60-65); extend a new `ListItemsFiltered` SQL query. |
| ITEM-02 | Filter by category and location, sort by name/SKU/created/updated | Backend: extend `ListItemsInput` with `category_id`, `sort`, `sort_dir`. **Location filter is omitted in Phase 60** because v2 Item entity has no `location_id` field (D-01) — UI must render only the category filter, and ITEM-02 is **partially satisfied for v2.1** (sort + category satisfied; location deferred with the same rationale as ITEM-03). |
| ITEM-03 | Item detail with name, SKU, barcode, description, category, location, container, status, notes | **Partially satisfied per D-01.** Detail page renders name, SKU, barcode, description, category (resolved name), created/updated. location/container/status/notes are deferred. PHOTOS and LOANS sections render `RetroEmptyState` placeholders (Phase 61/62 seam). |
| ITEM-04 | Create with name required + optional SKU/barcode/description/category/...notes | Form per D-05 (5 fields: name, SKU auto-gen, barcode, description, category). `itemsApi.create()` already exists; backend `CreateItemInput` already accepts the 5 fields the form sends; other backend fields default to nil/zero on create. |
| ITEM-05 | Edit existing item's fields | Same form as Create (per D-05); pre-populated via `defaultValues` in edit mode. `itemsApi.update()` already exists. **Note:** backend PATCH currently overwrites `MinStockLevel` from `currentItem.MinStockLevel()` when the request body lacks it (handler.go:234) — safe for the 5-field form but verify in tests. |
| ITEM-06 | Delete with confirmation dialog | `RetroConfirmDialog` archive-first then hazard-stripe hard-delete (D-04). Backend: register `DELETE /items/{id}` (D-03) AND fix the postgres `Repository.Delete()` to truly DELETE rather than soft-archive (Pitfall 3). |
| ITEM-07 | Archive/unarchive item | Both endpoints already exist (`POST /items/{id}/archive` and `/restore`); add mutation hooks `useArchiveItem`, `useRestoreItem`. |
| ITEM-08 | Toggle archived items visibility in list | Filter chip per D-08 + `archived` query param per D-02. |

</phase_requirements>

## Summary

Phase 60 is the v2.1 inventory-section build. It is conceptually a **flat-list + detail + slide-over CRUD** — the same shape Phase 58/59 shipped — but with three notable additions:

1. **Server-side search/filter/sort** (vs. Phase 59's "fetch all") because items can realistically exceed 25 entries even in a home inventory; pagination + search are first-class.
2. **A new "filter chip" UI primitive composition** (not a global primitive — composed from `<button>` + retro tokens; UI-SPEC §Interaction Contracts) for "Show archived". This is the only net-new UI pattern in the phase.
3. **Three backend changes:** (a) extend `ListItemsInput` + service `List` + repository `FindByWorkspace` + a new `ListItemsFiltered` SQL query supporting `search`/`category_id`/`archived`/`sort`/`sort_dir` and returning a true `COUNT(*)` total; (b) register `huma.Delete(api, "/items/{id}", ...)`; (c) fix `postgres.ItemRepository.Delete` which currently calls `ArchiveItem` SQL instead of a real `DELETE` (Pitfall 3 — inherited gap, exact same shape as the borrower bug Phase 59 fixed).

There are **zero new frontend runtime dependencies**. Every primitive needed by D-04..D-09 already exists in `@/components/retro` and was used in Phase 58/59. The slide-over panel from `@/features/taxonomy/panel/SlideOverPanel.tsx` is reused as-is. The archive-first dialog flow is a near-copy of `BorrowerArchiveDeleteFlow.tsx` minus the 400-on-active-loans branch (items have no equivalent guard).

**Primary recommendation:** Four-plan structure that mirrors Phase 59-style sequencing —
- **(60-01) Backend foundation:** SQL query additions (`ListItemsFiltered`, `CountItems`, `DeleteItem`), repo method updates (`FindByWorkspace` accepts filter params + returns true total; new `Delete` method semantics), service `List` signature extension, handler `ListItemsInput` extension + new `huma.Delete` route + event broadcast for `item.deleted`. ~120 lines of Go + 3 new sqlc queries + 3 modified queries.
- **(60-02) Frontend API + hooks:** Update `frontend2/src/lib/api/items.ts` (`ItemListParams` shape, `delete` method, `archive`/`restore` already exist), zod schemas in `forms/schemas.ts`, mutation hooks (`useCreateItem`/`useUpdateItem`/`useArchiveItem`/`useRestoreItem`/`useDeleteItem`), list/detail query hooks (`useItemsList(params)`, `useItem(id)`).
- **(60-03) Components — form + panel + actions + filter bar:** `ItemForm`, `ItemPanel`, `ItemArchiveDeleteFlow`, `ItemsFilterBar`, `ShowArchivedChip` (or inline). Includes SKU auto-generation logic + `useItemsListQueryParams` URL-state hook.
- **(60-04) Pages + routes + integration tests:** `ItemsListPage`, `ItemDetailPage`, route registration (replacing the existing placeholder `ItemsPage`), `useCategoryNameMap` resolver hook for the Category column. Integration tests across all flows.

Plan 60-01 must ship first (ATOMIC backend change); 60-02..60-04 can pipeline once API contract is stable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| List rendering, row actions, filter bar | Browser (`ItemsListPage`, `ItemsFilterBar`) | — | Pure composition over cached query; URL is the only persistent state |
| Pagination + filter + sort + archived params | API (`GET /items?...`) | Browser (params in query key + URL) | Server is source of truth; SQL filters cannot be bypassed client-side |
| Search (FTS by name/SKU/barcode) | API (`search_vector` tsquery) | Browser (debounced input → URL → query) | Postgres `search_vector` GIN index already exists per `items.sql:60-65`; client only debounces |
| Category name resolution for list rows | Browser (`useCategoryNameMap`) | API (`GET /categories?limit=100`) | Categories are workspace-scoped, small, cacheable; client builds a Map<id,name>; no per-row request |
| Create/edit form state + validation | Browser (RHF + zod) | API (huma re-validates input body) | Phase 57 D-03 locked pattern; server is authoritative on `name maxLength=255`, `sku maxLength=255`, `barcode maxLength=255` (currently — UX caps tighter) |
| Archive / Restore mutations | API (`svc.Archive`, `svc.Restore`) | Browser (TanStack mutation + invalidation + toast) | Endpoints already exist + tested |
| Hard-delete mutation | API (NEW `huma.Delete` route + REWIRED `repo.Delete`) | Browser (`useDeleteItem` + dialog flow) | Backend wiring gap — see Pitfall 3 |
| SKU auto-generation | Browser (form `defaultValues.sku` at panel-open time) | API (uniqueness check on Create — `ErrSKUTaken` returned 400) | Client generates display value; server enforces uniqueness; collision → 400 → form-level error toast |
| Detail page (sections, empty placeholders) | Browser (`ItemDetailPage`) | API (single `GET /items/{id}` for the item; categories cache for name resolution) | Phase 61 wires PHOTOS section; Phase 62 wires LOANS section |
| Route registration | Browser (`routes/index.tsx`) | — | SPA routing; replace existing placeholder `<ItemsPage>` |
| URL state ↔ filter bar | Browser (`useSearchParams` or custom `useItemsListQueryParams` hook) | — | Bookmarkable filtered views; honors browser back/forward |

## Standard Stack

### Core (already installed — verified in `frontend2/package.json`)

| Library | Version (installed) | Purpose | Verified |
|---------|---------|---------|----------|
| `@tanstack/react-query` | ^5 | List & detail queries; mutation hooks | [VERIFIED: package.json:44] |
| `@tanstack/react-query-devtools` | ^5 | Devtools (existing) | [VERIFIED: package.json:45] |
| `react-hook-form` | ^7.72.1 | Form state + `isDirty` for unsaved-changes guard | [VERIFIED: package.json:48] |
| `zod` | ^4.3.6 | Item create/update schemas | [VERIFIED: package.json:50] |
| `@hookform/resolvers` | ^5.2.2 | `zodResolver` bridge | [VERIFIED: package.json:41] |
| `@floating-ui/react` | ^0.27.19 | Used by `SlideOverPanel`, `RetroCombobox`, `RetroSelect` | [VERIFIED: package.json:40] |
| `react-router` | ^7.14.0 | `/items` + `/items/:id` under `AppShell <Outlet>`; `useSearchParams` for URL state | [VERIFIED: package.json:49] |
| `@lingui/react` + `@lingui/core` | ^5.9.5 | `t` macro on every visible string (mandatory) | [VERIFIED: package.json:42-43] |

### Backend (Go) — already installed

| Module | Purpose | Verified |
|--------|---------|----------|
| `github.com/danielgtaylor/huma/v2` | HTTP routes (existing) | [VERIFIED: handler.go:7] |
| Service layer (`item.Service`) | Already has `Create`, `Update`, `GetByID`, `List`, `Search`, `Archive`, `Restore`. **`Delete` is in `Repository` interface but NOT exposed on `ServiceInterface` — must be added (Pitfall 4)** | [VERIFIED: service.go:23-36, repository.go:21] |
| sqlc-generated `queries` | Existing `ListItems`, `SearchItems`, `ArchiveItem` (used wrongly as Delete). New: `ListItemsFiltered`, `CountItemsFiltered`, `DeleteItem` | [VERIFIED: items.sql] |

### No new dependencies

Phase 60 ships **zero** new runtime packages. Every primitive needed already exists in `@/components/retro` (verified by reading `index.ts`).

### Alternatives Considered

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Server-side search/filter/sort + pagination | Client-side fetch-all + filter (Phase 58/59 approach) | Items realistically exceed 25 even in home inventories; ITEM-01 explicitly mandates 25/page pagination + search; FTS is already wired in Postgres (`search_vector`); use it. |
| `RetroSelect` for category filter | `RetroCombobox` (UI-SPEC pre-decided) | UI-SPEC §Interaction Contracts mandates async combobox; categories may exceed reasonable RetroSelect size; consistency with category picker in form. |
| Component-state filter bar | URL-state filter bar (`useSearchParams`) | URL state enables shareable bookmarks, browser back/forward; consistent with UI-SPEC §Interaction Contracts; minor cost. |
| One `useItemMutations` file | 5 separate hooks in one file (Phase 58/59 idiom) | Phase 58/59 standard — each hook owns its toast copy; no duplication penalty. |
| Offset pagination | Cursor pagination | Pending todo in STATE.md mentions "Resolve pagination envelope per endpoint (cursor vs page/pageSize)" — ASSUMED page/pageSize for v2.1 because (a) the existing `ListItemsInput` already uses `Page`/`Limit`, (b) `RetroPagination` accepts `page/pageSize/totalCount`, (c) all sibling endpoints use offset. |
| Two SQL queries (one for active, one for all) | Single query with conditional `WHERE` (`sqlc.narg('archived')::bool IS NULL OR ...`) | Borrowers (Phase 59) shipped the second pattern — use it for consistency: one `ListItemsFiltered` query with optional sqlc.narg params for search, category_id, archived. |
| Per-cell font override (Pitfall 5 from Phase 59) | Wrap cell children in `<span className="font-sans">` | Same approach Phase 59 uses; do not modify `RetroTable` (blast radius). |
| Backend tri-state `archived` | Boolean `archived` (default false) | UI only needs two states (hide / include); boolean is simplest; matches `borrowerListInput` shape from Phase 59. |

## Architecture Patterns

### System Architecture Diagram

```
 User
  |
  v                                                    /items/:id (detail)
 /items?q=...&category=...&sort=...&dir=...           |
 &archived=...&page=...                                v
  |                                                    <ItemDetailPage>
  v                                                     | - useItem(id)
 <ItemsListPage>                                        | - useCategoryNameMap()  (cache)
  | - useItemsListQueryParams() <-> useSearchParams()  |
  | - useItemsList(params)         (react-query)       |    [Header: name, EDIT, ARCHIVE]
  | - useCategoryNameMap()         (react-query)       |    [DETAILS card: SKU, barcode, ...]
  |                                                    |    [PHOTOS placeholder] <- Phase 61 seam
  +--> <ItemsFilterBar>                                |    [LOANS placeholder]  <- Phase 62 seam
  |     - search input (debounced 300ms)               |
  |     - <RetroCombobox> category over categoriesApi  +--> open <ItemPanel ref> in edit mode
  |     - <RetroSelect>   sort                         +--> open <ItemArchiveDeleteFlow ref>
  |     - <ShowArchivedChip>  filter chip              |
  |                                                    +--> back link -> /items
  +--> <RetroTable>  Name | SKU | Category | Actions
  |     - row click on Name -> <Link to="/items/:id">
  |     - row Edit  -> ItemPanel.open("edit", item)
  |     - row Archive  -> ItemArchiveDeleteFlow.open()
  |     - row Restore  -> useRestoreItem mutation
  |
  +--> <RetroPagination> page=1..N  (only when total > 25)
  |
  +--> <ItemPanel ref>
  |     - <SlideOverPanel> (existing in features/taxonomy/panel/)
  |     - <ItemForm>
  |         - useForm(zodResolver(itemCreateSchema))
  |         - RetroFormField x { name, sku, barcode, description, category }
  |         - SKU prefilled from generator (create) or item.sku (edit)
  |         - Category: RetroCombobox over categoriesApi.list()
  |     - Submit -> useCreateItem | useUpdateItem
  |
  +--> <ItemArchiveDeleteFlow ref>
        - <RetroConfirmDialog variant="soft">  ARCHIVE primary, "delete permanently" link
        - <RetroConfirmDialog variant="destructive">  hazard-stripe hard-delete
        - on success: invalidate itemKeys.all + toast

 TanStack Query cache
  - itemKeys.list({page, search, category_id, archived, sort, sort_dir}) -> invalidated on every mutation via itemKeys.all
  - itemKeys.detail(id) -> invalidated on update/archive/restore; removed on delete (then navigate to /items)
  - categoryKeys.list({limit:100}) -> shared, used by name-map resolver and Combobox

 HTTP layer (frontend2/src/lib/api.ts)
  - get / post / patch / del -> HttpError on non-2xx

 Backend (Go/huma)
  - GET    /workspaces/{wsId}/items?page&limit&search&category_id&archived&sort&sort_dir   <-- EXTEND
  - GET    /workspaces/{wsId}/items/{id}
  - POST   /workspaces/{wsId}/items
  - PATCH  /workspaces/{wsId}/items/{id}
  - POST   /workspaces/{wsId}/items/{id}/archive       (existing)
  - POST   /workspaces/{wsId}/items/{id}/restore       (existing)
  - DELETE /workspaces/{wsId}/items/{id}                <-- ADD (huma.Delete + svc.Delete + REWIRED repo.Delete)
```

### Recommended Project Structure

```
frontend2/src/features/items/
├── ItemsListPage.tsx            # replaces existing placeholder ItemsPage.tsx
├── ItemDetailPage.tsx
├── icons.tsx                     # local icons (no lucide; mirror borrowers/icons.tsx)
├── forms/
│   ├── ItemForm.tsx
│   └── schemas.ts                # zod itemCreateSchema + itemUpdateSchema + sku generator helper
├── panel/
│   └── ItemPanel.tsx             # mirrors BorrowerPanel + uses SlideOverPanel from features/taxonomy/panel/
├── actions/
│   └── ItemArchiveDeleteFlow.tsx # mirrors BorrowerArchiveDeleteFlow (no 400 short-circuit)
├── filters/
│   ├── ItemsFilterBar.tsx        # search input + RetroCombobox(category) + RetroSelect(sort) + ShowArchivedChip
│   ├── ShowArchivedChip.tsx      # local chip component (off / on amber)
│   └── useItemsListQueryParams.ts# URL state read/write (or inline useSearchParams in ItemsListPage)
├── hooks/
│   ├── useItemsList.ts           # react-query list hook
│   ├── useItem.ts                # react-query detail hook
│   ├── useCategoryNameMap.ts     # Map<categoryId, name> resolver from categoriesApi.list()
│   └── useItemMutations.ts       # 5 hooks: create/update/archive/restore/remove
└── __tests__/
    ├── ItemForm.test.tsx
    ├── ItemPanel.test.tsx
    ├── ItemArchiveDeleteFlow.test.tsx
    ├── ItemsFilterBar.test.tsx
    ├── ShowArchivedChip.test.tsx
    ├── ItemsListPage.test.tsx
    ├── ItemDetailPage.test.tsx
    └── fixtures.ts               # makeItem, renderWithProviders

frontend2/src/lib/api/items.ts    # EXTEND: list params shape, delete method
frontend2/src/lib/api/__tests__/queryKeys.test.ts  # extend itemKeys param-shape test
frontend2/src/routes/index.tsx    # REPLACE: <ItemsPage> placeholder with <ItemsListPage>; add /items/:id

backend/internal/domain/warehouse/item/handler.go            # EXTEND list input + ADD huma.Delete + add svc.Delete to interface
backend/internal/domain/warehouse/item/service.go            # ADD Delete method to ServiceInterface + extend List signature
backend/internal/domain/warehouse/item/repository.go         # extend FindByWorkspace signature OR add new FindByWorkspaceFiltered method (planner choice)
backend/internal/infra/postgres/item_repository.go           # REWIRE Delete to call DeleteItem (true DELETE), implement filtered list
backend/db/queries/items.sql                                 # ADD ListItemsFiltered, CountItemsFiltered, DeleteItem queries
backend/internal/infra/queries/items.sql.go                  # regenerated by sqlc
backend/internal/domain/warehouse/item/handler_test.go       # extend with delete + filter cases
backend/internal/infra/postgres/item_repository_test.go      # extend with true Delete + filter tests
```

### Pattern 1: API client extension

```ts
// frontend2/src/lib/api/items.ts  -- UPDATE in place
// Source: mirrors borrowers.ts (VERIFIED) and current items.ts

import { get, post, patch, del } from "@/lib/api";
//                                ^^^^ del already exported per api.ts:130

export interface ItemListParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  archived?: boolean;
  sort?: "name" | "sku" | "created_at" | "updated_at";
  sort_dir?: "asc" | "desc";
  // REMOVE: needs_review (not used by Phase 60), location_id (Item entity has no location_id per D-01)
}

export const itemsApi = {
  // ...existing list/get/create/update/archive/restore...
  delete: (wsId: string, id: string) => del<void>(`${base(wsId)}/${id}`),  // ADD per D-03
};

// itemKeys factory unchanged — existing definition already discriminates by params.
```

### Pattern 2: SKU auto-generator (browser, deterministic but unique-enough)

```ts
// frontend2/src/features/items/forms/schemas.ts
// Generator suggested in CONTEXT.md "Specifics" — planner finalises if a different shape preferred.

export function generateSku(): string {
  const ts = Date.now().toString(36).toUpperCase();   // ~8 chars at current epoch
  const rand = Math.floor(Math.random() * 1679616)    // 36^4 = 1,679,616
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");
  return `ITEM-${ts}-${rand}`;
}
```

The server enforces SKU uniqueness via `Repository.SKUExists()` and returns `ErrSKUTaken → 400 BadRequest` (handler.go:167). On collision, the form should surface a field-level error toast and let the user retry (regenerate or edit). Probability of collision in normal use is negligible (1 in 1.68M per ms), but the server check is the authoritative guard.

### Pattern 3: Item zod schemas

```ts
// frontend2/src/features/items/forms/schemas.ts
import { z } from "zod";

export const itemCreateSchema = z.object({
  name: z.string().min(1, "Name is required.").max(200, "Must be 200 characters or fewer."),
  sku: z
    .string()
    .min(1, "SKU is required.")
    .max(64, "Must be 64 characters or fewer.")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores only."),
  barcode: z
    .string()
    .max(64, "Must be 64 characters or fewer.")
    .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only.")
    .optional()
    .or(z.literal("")),
  description: z.string().max(2000, "Must be 2000 characters or fewer.").optional().or(z.literal("")),
  category_id: z.string().uuid("Pick a category from the list.").optional().or(z.literal("")),
});

export const itemUpdateSchema = itemCreateSchema.partial();

export type ItemCreateValues = z.infer<typeof itemCreateSchema>;
export type ItemUpdateValues = z.infer<typeof itemUpdateSchema>;
```

UX caps (200/64/64/2000) are tighter than backend caps (255/255/255/unbounded — see handler.go:475-484). UI-SPEC §Form schema dictates these UX bounds; planner can adjust to match backend exactly if preferred. Coerce `""` → `undefined` before submit (mirrors BorrowerForm).

### Pattern 4: List hook with URL params

```ts
// frontend2/src/features/items/hooks/useItemsList.ts
import { useQuery } from "@tanstack/react-query";
import { itemsApi, itemKeys, type ItemListParams } from "@/lib/api/items";
import { useAuth } from "@/features/auth/AuthContext";

export function useItemsList(params: ItemListParams) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: itemKeys.list(params),
    queryFn: () => itemsApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    placeholderData: (prev) => prev,   // smooth pagination — keeps prev page visible during fetch
  });
}
```

The `placeholderData: (prev) => prev` keeps the table populated during pagination/filter changes (TanStack Query v5 idiom; replaces the deprecated `keepPreviousData` flag). [VERIFIED: TanStack Query v5 docs accessible via Context7 / tanstack.com — `placeholderData` accepts a function from previous data].

### Pattern 5: Category name resolver

```ts
// frontend2/src/features/items/hooks/useCategoryNameMap.ts
import { useQuery } from "@tanstack/react-query";
import { categoriesApi, categoryKeys } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";
import { useMemo } from "react";

export function useCategoryNameMap() {
  const { workspaceId } = useAuth();
  const params = { page: 1, limit: 100, archived: true } as const;  // include archived so archived-row category names still resolve
  const query = useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    staleTime: 60_000,  // categories change rarely; avoid refetch storm
  });
  const map = useMemo(() => {
    const m = new Map<string, string>();
    (query.data?.items ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [query.data]);
  return { map, isPending: query.isPending, isError: query.isError };
}
```

Each list row reads `nameMap.get(item.category_id) ?? "—"` — no per-row fetch, no N+1.

### Pattern 6: Filter bar URL state

```ts
// frontend2/src/features/items/filters/useItemsListQueryParams.ts
import { useSearchParams } from "react-router";
import { useCallback } from "react";

export interface ItemsListUiState {
  q: string;
  category: string | null;
  sort: "name" | "sku" | "created_at" | "updated_at";
  sortDir: "asc" | "desc";
  archived: boolean;
  page: number;
}

export function useItemsListQueryParams(): [
  ItemsListUiState,
  (patch: Partial<ItemsListUiState>) => void,
  () => void,        // clearFilters
] {
  const [sp, setSp] = useSearchParams();
  const state: ItemsListUiState = {
    q: sp.get("q") ?? "",
    category: sp.get("category"),
    sort: (sp.get("sort") as ItemsListUiState["sort"]) ?? "name",
    sortDir: (sp.get("dir") as "asc" | "desc") ?? "asc",
    archived: sp.get("archived") === "1",
    page: Math.max(1, Number(sp.get("page") ?? 1)),
  };
  const update = useCallback((patch: Partial<ItemsListUiState>) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      if (patch.q !== undefined)        patch.q ? next.set("q", patch.q) : next.delete("q");
      if (patch.category !== undefined) patch.category ? next.set("category", patch.category) : next.delete("category");
      if (patch.sort !== undefined)     next.set("sort", patch.sort);
      if (patch.sortDir !== undefined)  next.set("dir", patch.sortDir);
      if (patch.archived !== undefined) patch.archived ? next.set("archived", "1") : next.delete("archived");
      if (patch.page !== undefined)     patch.page > 1 ? next.set("page", String(patch.page)) : next.delete("page");
      // Reset page to 1 when any non-page filter changes
      if (patch.q !== undefined || patch.category !== undefined || patch.archived !== undefined || patch.sort !== undefined || patch.sortDir !== undefined) {
        if (patch.page === undefined) next.delete("page");
      }
      return next;
    });
  }, [setSp]);
  const clearFilters = useCallback(() => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      ["q", "category", "archived"].forEach((k) => next.delete(k));
      next.delete("page");
      return next;
    });
  }, [setSp]);
  return [state, update, clearFilters];
}
```

### Pattern 7: Filter chip (composed primitive — not new global)

```tsx
// frontend2/src/features/items/filters/ShowArchivedChip.tsx
import { useLingui } from "@lingui/react/macro";

export function ShowArchivedChip({
  active, count, onToggle,
}: { active: boolean; count: number; onToggle: () => void }) {
  const { t } = useLingui();
  const cls = active
    ? "border-retro-thick border-retro-amber text-retro-amber"
    : "border-retro-thick border-retro-ink text-retro-ink";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`min-h-[44px] lg:min-h-[32px] inline-flex items-center gap-xs px-sm font-sans text-[14px] font-semibold uppercase tracking-wider bg-retro-cream cursor-pointer outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber ${cls}`}
    >
      {active ? t`SHOWING ARCHIVED` : t`SHOW ARCHIVED`}
      <span className="font-mono text-retro-charcoal">·</span>
      <span className={`font-mono ${active ? "text-retro-amber" : "text-retro-charcoal"}`}>{count}</span>
    </button>
  );
}
```

### Pattern 8: Mutation hooks (5 in one file — Phase 58/59 idiom)

```ts
// frontend2/src/features/items/hooks/useItemMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  itemsApi, itemKeys,
  type Item, type CreateItemInput, type UpdateItemInput,
} from "@/lib/api/items";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/components/retro";
import { useLingui } from "@lingui/react/macro";

export function useCreateItem() {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<Item, unknown, CreateItemInput>({
    mutationFn: (input) => itemsApi.create(workspaceId!, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item created.`, "success");
    },
    onError: () => addToast(t`Could not save item. Check your connection and try again.`, "error"),
  });
}

// useUpdateItem, useArchiveItem, useRestoreItem — mirror useCreateItem pattern verbatim with toasts:
//   "Item saved.", "Item archived.", "Item restored.", "Could not update item. Try again."

export function useDeleteItem(opts?: { onAfterDelete?: () => void }) {
  const { workspaceId } = useAuth();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { t } = useLingui();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => itemsApi.delete(workspaceId!, id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: itemKeys.detail(id) });
      qc.invalidateQueries({ queryKey: itemKeys.all });
      addToast(t`Item deleted.`, "success");
      opts?.onAfterDelete?.();
    },
    onError: () => addToast(t`Could not delete item. Try again.`, "error"),
  });
}
```

When invoked from `ItemDetailPage`, pass `onAfterDelete: () => navigate("/items")` per UI-SPEC §Interaction Contracts.

### Pattern 9: ItemPanel (create/edit dual-mode)

Mirror `BorrowerPanel.tsx` verbatim with item-specific bits:

```tsx
// frontend2/src/features/items/panel/ItemPanel.tsx
// Source: BorrowerPanel.tsx (VERIFIED pattern). Changes:
//  - useCreateItem / useUpdateItem instead of borrower mutations
//  - title: "NEW ITEM" / "EDIT ITEM" ; submit: "CREATE ITEM" / "SAVE ITEM"
//  - ItemForm with 5 fields; SKU prefilled via generateSku() when mode === "create"

interface ItemPanelHandle { open: (mode: "create" | "edit", item?: Item) => void; close: () => void; }
```

### Pattern 10: ItemArchiveDeleteFlow (no 400 short-circuit)

Mirror `BorrowerArchiveDeleteFlow.tsx`. Item flow has no equivalent of `ErrHasActiveLoans` (D-04 confirms — no FK guard required). Therefore:
- `handleDelete` does NOT check `HttpError.status === 400` short-circuit; just `await onDelete(); deleteRef.current?.close();` with a generic error caught by the mutation's `onError` toast.
- Body copy: `"This will hide '{Name}' from the items list. You can restore it later."` (UI-SPEC) and `"Permanently delete '{Name}'? This cannot be undone."` (UI-SPEC)
- `headerBadge`: `"HIDES FROM DEFAULT VIEW"` on archive dialog; hard-delete dialog uses hazard-stripe via `RetroDialog`'s built-in destructive variant.

### Pattern 11: Backend handler — list extension

```go
// handler.go -- REPLACE existing ListItemsInput
type ListItemsInput struct {
    Page       int    `query:"page" default:"1" minimum:"1"`
    Limit      int    `query:"limit" default:"25" minimum:"1" maximum:"100"`
    Search     string `query:"search,omitempty" doc:"FTS over name, SKU, barcode"`
    CategoryID string `query:"category_id,omitempty" doc:"Filter by category UUID"`
    Archived   bool   `query:"archived" default:"false" doc:"true to include archived items"`
    Sort       string `query:"sort" default:"name" enum:"name,sku,created_at,updated_at"`
    SortDir    string `query:"sort_dir" default:"asc" enum:"asc,desc"`
}

// REPLACE the GET /items handler body:
huma.Get(api, "/items", func(ctx context.Context, input *ListItemsInput) (*ListItemsOutput, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }

    pagination := shared.Pagination{Page: input.Page, PageSize: input.Limit}
    var categoryID *uuid.UUID
    if input.CategoryID != "" {
        if id, err := uuid.Parse(input.CategoryID); err == nil { categoryID = &id }
    }

    items, total, err := svc.ListFiltered(ctx, workspaceID, item.ListFilters{
        Search: input.Search, CategoryID: categoryID, IncludeArchived: input.Archived,
        Sort: input.Sort, SortDir: input.SortDir,
    }, pagination)
    if err != nil { return nil, huma.Error500InternalServerError("failed to list items") }

    responses := make([]ItemResponse, len(items))
    for i, it := range items { responses[i] = toItemResponse(it) }

    totalPages := 1
    if total > 0 { totalPages = (total + input.Limit - 1) / input.Limit }

    return &ListItemsOutput{
        Body: ItemListResponse{Items: responses, Total: total, Page: input.Page, TotalPages: totalPages},
    }, nil
})
```

The current handler computes `total_pages` from a stale `total` (returned `len(items)` — see Pitfall 1); the new path uses a true `COUNT(*)` returned from the new SQL query.

### Pattern 12: Backend SQL additions

```sql
-- ADD to backend/db/queries/items.sql

-- name: ListItemsFiltered :many
SELECT * FROM warehouse.items
WHERE workspace_id = $1
  AND (sqlc.narg('archived')::bool IS NULL
       OR sqlc.narg('archived')::bool = true
       OR is_archived = false)
  AND (sqlc.narg('search')::text IS NULL
       OR search_vector @@ plainto_tsquery('english', sqlc.narg('search')::text))
  AND (sqlc.narg('category_id')::uuid IS NULL
       OR category_id = sqlc.narg('category_id')::uuid)
ORDER BY
  CASE WHEN sqlc.arg('sort_field')::text = 'name'        AND sqlc.arg('sort_dir')::text = 'asc'  THEN name        END ASC NULLS LAST,
  CASE WHEN sqlc.arg('sort_field')::text = 'name'        AND sqlc.arg('sort_dir')::text = 'desc' THEN name        END DESC NULLS LAST,
  CASE WHEN sqlc.arg('sort_field')::text = 'sku'         AND sqlc.arg('sort_dir')::text = 'asc'  THEN sku         END ASC NULLS LAST,
  CASE WHEN sqlc.arg('sort_field')::text = 'sku'         AND sqlc.arg('sort_dir')::text = 'desc' THEN sku         END DESC NULLS LAST,
  CASE WHEN sqlc.arg('sort_field')::text = 'created_at'  AND sqlc.arg('sort_dir')::text = 'asc'  THEN created_at  END ASC NULLS LAST,
  CASE WHEN sqlc.arg('sort_field')::text = 'created_at'  AND sqlc.arg('sort_dir')::text = 'desc' THEN created_at  END DESC NULLS LAST,
  CASE WHEN sqlc.arg('sort_field')::text = 'updated_at'  AND sqlc.arg('sort_dir')::text = 'asc'  THEN updated_at  END ASC NULLS LAST,
  CASE WHEN sqlc.arg('sort_field')::text = 'updated_at'  AND sqlc.arg('sort_dir')::text = 'desc' THEN updated_at  END DESC NULLS LAST
LIMIT $2 OFFSET $3;

-- name: CountItemsFiltered :one
SELECT COUNT(*) FROM warehouse.items
WHERE workspace_id = $1
  AND (sqlc.narg('archived')::bool IS NULL
       OR sqlc.narg('archived')::bool = true
       OR is_archived = false)
  AND (sqlc.narg('search')::text IS NULL
       OR search_vector @@ plainto_tsquery('english', sqlc.narg('search')::text))
  AND (sqlc.narg('category_id')::uuid IS NULL
       OR category_id = sqlc.narg('category_id')::uuid);

-- name: DeleteItem :exec
DELETE FROM warehouse.items WHERE id = $1;
```

The CASE-in-ORDER-BY trick handles dynamic sort safely (no string concat → no SQL injection). [CITED: standard sqlc pattern for whitelisted dynamic ORDER BY — sqlc docs `https://docs.sqlc.dev/en/latest/howto/named_parameters.html`]. Alternative: planner may switch to `pgx`-direct for the list query if sqlc's `sqlc.narg` + `sqlc.arg` typing becomes unwieldy.

### Pattern 13: Backend repository + service updates

```go
// repository.go -- EXTEND interface
type Repository interface {
    // ... existing ...
    FindByWorkspaceFiltered(ctx context.Context, workspaceID uuid.UUID, filters ListFilters, p shared.Pagination) ([]*Item, int, error)
    DeleteHard(ctx context.Context, id uuid.UUID) error  // RENAME existing Delete to DeleteHard, OR fix the existing Delete in postgres impl
}

// service.go -- ADD to ServiceInterface
type ServiceInterface interface {
    // ... existing ...
    ListFiltered(ctx context.Context, workspaceID uuid.UUID, filters ListFilters, p shared.Pagination) ([]*Item, int, error)
    Delete(ctx context.Context, id, workspaceID uuid.UUID) error
}

type ListFilters struct {
    Search          string
    CategoryID      *uuid.UUID
    IncludeArchived bool
    Sort            string  // name|sku|created_at|updated_at — validated
    SortDir         string  // asc|desc — validated
}
```

`Service.Delete` should verify the item exists in the workspace (via `GetByID`) before calling `repo.DeleteHard`, returning `ErrItemNotFound` for cross-workspace attempts.

### Pattern 14: SlideOverPanel reuse + relocation note

The CONTEXT.md "Component Inventory" notes: *"`SlideOverPanel` from `@/features/taxonomy/panel/SlideOverPanel.tsx` (reused from Phase 58/59) — planning may relocate to a shared `@/components/retro` location during Phase 60 if reuse warrants it"*. **Recommendation: do NOT relocate in Phase 60.** Three reasons:
1. The component is already imported by Phase 58 (taxonomy), Phase 59 (borrowers), and now Phase 60 (items). Three consumers ≠ "shared global" — borderline.
2. Moving it triggers an import-path change in two existing call sites + the retro barrel; a separate refactor PR is cleaner.
3. The retro barrel currently has zero feature-coupled components; relocating would set a precedent. Better to extract to `@/components/layout/SlideOverPanel.tsx` in a Phase 60 polish task or a dedicated phase if needed.

### Anti-Patterns to Avoid

- **Calling `loansApi.listForBorrower` or any loans endpoint in Phase 60.** D-06 explicitly defers loan data to Phase 62. The detail page LOANS section is `RetroEmptyState` ONLY.
- **Calling `itemPhotosApi.*` for the PHOTOS section.** Phase 61 wires photos; Phase 60 ships an empty-state placeholder ONLY.
- **Surfacing brand/model/serial number/warranty fields in the form.** D-05 defers them. Even though the backend accepts them, the form must NOT include them.
- **Adding `location_id` filter to the filter bar.** D-01 defers location fields entirely; ITEM-02's location-filter clause is partially-met for v2.1 (sort + category satisfied; location deferred).
- **Storing `workspaceId` in component props.** Read via `useAuth().workspaceId` only.
- **New retro primitives.** Every UI element in scope already has a primitive in `@/components/retro`. The chip is a local composition, not a new global.
- **Bypassing the retro barrel.** All retro imports MUST come from `@/components/retro/index.ts` (v2.0 locked).
- **Generic `CANCEL` / `SAVE` / `OK` / `YES` button labels.** UI-SPEC §Tone rules forbids these — every button is verb+noun (`CREATE ITEM`, `SAVE ITEM`, `ARCHIVE ITEM`, `KEEP ITEM`, `DELETE ITEM`, `← BACK`).
- **Lingui interpolation over a non-static template shape.** E.g. `t`Edit ${entityKind}`` won't extract. Use entity-specific labels (`t`EDIT ITEM``).
- **`window.confirm` / `alert`.** Use `RetroConfirmDialog` / toasts.
- **Raw `fetch`.** Use `@/lib/api` helpers.
- **String concat for SQL ORDER BY.** Use the CASE-whitelist pattern in Pattern 12.
- **Skipping the SKU uniqueness retry path.** If `ErrSKUTaken` returns 400, surface a clear error and let the user regenerate; don't silently swallow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-over panel | Custom right-docked dialog | Reuse `@/features/taxonomy/panel/SlideOverPanel.tsx` | Focus mgmt, dirty guard, backdrop, ESC, portal — all non-trivial; tested in Phase 58/59. |
| Archive-first two-stage dialog | Custom state machine | Mirror `@/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx` (drop 400 short-circuit) | Dialog handoff timing (`setTimeout(..., 0)`) and ref management is error-prone; tested. |
| Combobox / Select / focus trap / floating UI | Hand-roll dropdown | `@/components/retro/RetroCombobox`, `RetroSelect` | Already wired with `@floating-ui/react`; ARIA-compliant; tested. |
| Pagination control | Custom page buttons | `@/components/retro/RetroPagination` | Hides itself when `totalCount <= pageSize`; ellipsis logic; mono styling. |
| Form state machine | Custom `useState` plumbing | `react-hook-form` + `RetroFormField` `Controller`-for-all | Phase 57 D-03 locked. |
| Schema validation | Hand-rolled validators | `zod` + `@hookform/resolvers` | Phase 57 D-04 locked; type inference. |
| Toasts | `alert()` | `useToast` from `@/components/retro` | Retro styling, auto-dismiss, ARIA polite. |
| Query key factory | Hand-roll cache invalidation | `itemKeys` (already exported in `@/lib/api/items.ts`) | Tested in `__tests__/queryKeys.test.ts`. |
| Postgres FTS | Custom name/SKU/barcode `LIKE %q%` | `search_vector` with `plainto_tsquery` | Already wired in `items.sql:60-65`; index-backed; multi-language ready. |
| Dynamic ORDER BY safety | String concat with sort field | sqlc CASE whitelist (Pattern 12) | SQL injection defense + pgcache-friendly query plan. |
| Category name resolution per row | N+1 `categoriesApi.get(id)` per row | `useCategoryNameMap` (Pattern 5) | One workspace-wide fetch, cached 60s, no refetch storm. |
| URL query state | Custom serializer | `useSearchParams` from react-router-v7 + small wrapper hook (Pattern 6) | Browser back/forward + bookmarkable; tested by react-router. |
| SKU uniqueness retry on collision | Client-only retry loop | Server-side `ErrSKUTaken` → 400 → form-level error toast | Server is authoritative; client only generates display value. |

**Key insight:** Phase 60 is ~75% composition of Phase 58/59 patterns + ~15% backend SQL/handler extension + ~10% novel local code (ItemsFilterBar, ShowArchivedChip, useItemsListQueryParams, useCategoryNameMap, generateSku). Net new lines outside tests are estimated at ~600 frontend + ~250 backend.

## Runtime State Inventory

> Phase 60 is greenfield feature work — no rename, refactor, or migration. The categories below are checked explicitly for completeness.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — items are user-created records. New fields are not added; existing rows are unaffected. The new `archived` filter and DELETE wiring affect *behaviour* on existing rows but no data migration is needed. | None. |
| Live service config | None — no n8n / Datadog / Tailscale integration touches in this phase. | None. |
| OS-registered state | None — no Windows Task Scheduler / pm2 / launchd / systemd registrations in this phase. | None. |
| Secrets/env vars | None — no new secrets; existing workspace auth context is reused. | None. |
| Build artifacts | sqlc must regenerate `backend/internal/infra/queries/items.sql.go` after adding `ListItemsFiltered`, `CountItemsFiltered`, `DeleteItem` queries. This is a build step, not a stale-artifact cleanup. | Run `sqlc generate` (or project-equivalent) as part of Plan 60-01. |

## Common Pitfalls

### Pitfall 1: `FindByWorkspace` returns wrong total count

**What goes wrong:** Pagination breaks. `RetroPagination` computes `Math.ceil(totalCount / pageSize)` — if `totalCount` is the count of *rows on the current page* (≤ limit), the control will hide itself even when more pages exist, OR display the wrong total.

**Why it happens:** `postgres.ItemRepository.FindByWorkspace` (item_repository.go:168-184) returns `len(items), nil` instead of a true `COUNT(*)`. Compare to `FindNeedingReview` (line 196) which DOES call a separate `CountItemsNeedingReview` query.

**How to avoid:** The new `ListItemsFiltered` SQL query must be paired with `CountItemsFiltered` (Pattern 12). The repo method must call BOTH and return `(items, totalCount, nil)`.

**Warning signs:** Pagination buttons disappear when `len(items) === limit`; `totalPages` computed in handler is always 1.

### Pitfall 2: Search parameter swallowing on empty value

**What goes wrong:** Search box clears, list still filtered. URL has `?q=` empty string but backend treats `""` differently from missing param.

**Why it happens:** sqlc.narg-based queries treat `""` as a non-NULL string and pass it to `plainto_tsquery('english', '')`, which returns no rows.

**How to avoid:** In handler, normalize: `if input.Search == "" { /* don't pass to repo */ }`. Or in SQL, also accept `"" → NULL`: `AND (sqlc.narg('search')::text IS NULL OR sqlc.narg('search')::text = '' OR ...)`. Frontend `useItemsListQueryParams` should also delete the `q` URL param when empty (already in Pattern 6).

**Warning signs:** Clearing the search input shows zero results; URL shows `?q=` with empty value.

### Pitfall 3: `ItemRepository.Delete` is not a hard delete

**What goes wrong:** "Delete permanently" doesn't actually delete. Item row still exists in DB with `is_archived=true`; the user can "create" what they think is a fresh item with the same SKU and get a 400 because the soft-archived row owns it.

**Why it happens:** `postgres/item_repository.go:246-248`:
```go
func (r *ItemRepository) Delete(ctx context.Context, id uuid.UUID) error {
    return r.queries.ArchiveItem(ctx, id)
}
```
This is the IDENTICAL bug Phase 59 fixed for borrowers (Pitfall 3 in `59-RESEARCH.md`). Inherited from the same legacy stub.

**How to avoid:** Add `DeleteItem` SQL query (Pattern 12). Update repo to call it. Add a service-layer `Delete(ctx, id, workspaceID)` that verifies workspace ownership first (mirror `service/borrower.Delete` shape — but without the `HasActiveLoans` check since items have no equivalent guard per D-04). Add `Delete` to `ServiceInterface`. Wire `huma.Delete` in handler.

**Warning signs:** After "delete permanently", `psql -c "SELECT id, is_archived FROM warehouse.items WHERE id=...;"` still returns the row; "Show archived" toggle still shows it; SKU re-creation fails with `ErrSKUTaken`.

### Pitfall 4: `Service.Delete` exists but `ServiceInterface` doesn't expose it

**What goes wrong:** Handler can't call `svc.Delete` — the interface doesn't list it. Compile error or runtime nil panic.

**Why it happens:** `service.go:23-36` defines `ServiceInterface` without a `Delete` method. The repository interface has `Delete` (repository.go:21) but the service layer has no `Delete` method on `*Service` either — the handler currently has no DELETE route, so the gap was invisible.

**How to avoid:** Plan 60-01 must add BOTH (a) `Delete` to `ServiceInterface`, and (b) implement `(s *Service) Delete(ctx context.Context, id, workspaceID uuid.UUID) error` that calls `s.GetByID` first (workspace ownership check) then `s.repo.DeleteHard` (or whatever the renamed method is called).

**Warning signs:** Compile error `svc.Delete undefined`; or `ItemHandler` test for DELETE returns 500 with nil pointer.

### Pitfall 5: `RetroTable` forces `font-mono` on all cells

**What goes wrong:** Item names render in monospace, looking like a code listing. Phase 60 UI-SPEC §Typography mandates `font-sans` for the Name column.

**Why it happens:** `RetroTable.tsx:40` applies `font-mono text-[14px] text-retro-ink py-sm px-md ...` to every `<td>` unconditionally. Same issue Phase 59 documented (Pitfall 5 in `59-RESEARCH.md`).

**How to avoid:** Wrap cell children in `<span className="font-sans">` for Name and Category cells. Keep `font-mono` (default) for SKU. Do NOT modify `RetroTable` — blast radius across phases 56-59. Reference: `BorrowersListPage.tsx:75-103` shows the exact font-override pattern.

**Warning signs:** Name and Category columns render in monospace; UI-SPEC §Typography contract violated; visual regression on the items list compared to borrowers list.

### Pitfall 6: SKU collision UX is non-obvious

**What goes wrong:** User submits the form, gets a generic toast "Could not save item", form stays open with the same SKU, retry produces the same error. User doesn't realize the SKU is the problem.

**Why it happens:** Backend returns `ErrSKUTaken → huma.Error400BadRequest("SKU already exists in workspace")` (handler.go:167-168). Frontend `useCreateItem.onError` (Pattern 8) shows a generic error toast — the message detail is lost.

**How to avoid:** In `useCreateItem.onError`, inspect `HttpError.message` for "SKU already exists" → surface specific toast `"That SKU is already in use. Please regenerate or choose another."` and trigger an SKU regeneration in the form. OR: catch in the form layer — `onSubmit` `try { await createMutation.mutateAsync(...) } catch (e) { if (e is HttpError 400 && msg includes 'SKU') { setSkuError(...); regenerateSku() } }`.

**Warning signs:** Manual test of duplicate SKU shows generic error; user is confused about how to recover.

### Pitfall 7: Category name resolution misses archived categories

**What goes wrong:** An item assigned to a category that was later archived shows `—` (no category) on the list and detail page. User thinks the item lost its category.

**Why it happens:** `useCategoryNameMap` (Pattern 5) loads `categoriesApi.list({archived: true})` to include archived categories, but the default `categoriesApi.list({})` would exclude them. If the planner copies the form's combobox-loading params (which exclude archived for picker UX), the resolver loses archived names.

**How to avoid:** The category-NAME-RESOLVER hook MUST request `archived: true` (include archived). The category PICKER combobox in the form may exclude archived (so users can't assign new items to archived categories). Two distinct queries; two distinct cache keys; both safe.

**Warning signs:** Items with archived category render `—` instead of the category name; bug only appears after a category is archived.

### Pitfall 8: Page reset on filter change

**What goes wrong:** User is on page 5, changes the search filter, list shows page 5 of new results which may have only 2 pages → empty "no items on this page" state.

**Why it happens:** Filter changes update `?q=` etc. in URL but don't reset `?page=`.

**How to avoid:** `useItemsListQueryParams` (Pattern 6) — when ANY filter param changes (q, category, archived, sort, sortDir) WITHOUT an explicit page, reset page to 1 (delete the `page` URL key). Pattern 6 sample code does this.

**Warning signs:** Filter changes leave page index stale; "no items match your filters" appears even though backend has matches.

### Pitfall 9: Optimistic delete from detail page navigates before query settles

**What goes wrong:** User on `/items/abc-123` clicks "delete permanently" → confirms → `useDeleteItem` mutation succeeds → handler navigates to `/items` → but `useItem(abc-123)` still has the row cached, and a re-mount of the detail page (e.g., browser back) flashes the deleted item before showing 404.

**Why it happens:** `qc.invalidateQueries({queryKey: itemKeys.all})` triggers a refetch, but does not REMOVE the detail query.

**How to avoid:** Use `qc.removeQueries({queryKey: itemKeys.detail(id)})` BEFORE invalidating the list (Pattern 8 sample code does this).

**Warning signs:** Browser back from `/items` after delete briefly renders the deleted item before 404 state; manual testing shows a flash.

### Pitfall 10: Backend `Page * Limit` overflow on huge `?page=` value

**What goes wrong:** User crafts `?page=999999`, backend computes `(999999 - 1) * 25 = 24,999,950` offset, query is slow or returns nothing, pagination control still shows links to invalid pages.

**Why it happens:** No upper bound on `page` query param.

**How to avoid:** huma's `query:"page" minimum:"1"` enforces min only. Either add a manual cap in the handler (`if input.Page > 10000 { return huma.Error400BadRequest(...) }`) or rely on `total` returned from the count to clamp `total_pages` and let the frontend not render invalid page links (already the case via `RetroPagination`'s `if totalCount <= pageSize return null`). Acceptable risk for v2.1.

**Warning signs:** Performance regression on crafted URLs; not user-reachable via the UI.

## Code Examples

Verified patterns; copy-paste with item renaming. All patterns above are the substantive examples; this section adds two more idioms specific to the items pages.

### Example 1: ItemsListPage skeleton

```tsx
import { useMemo, useRef } from "react";
import { Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { Pencil, Archive, Undo2, Trash2 } from "./icons";
import {
  RetroPanel, RetroButton, RetroEmptyState, RetroBadge, RetroTable, RetroPagination,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { useItemsList } from "./hooks/useItemsList";
import { useCategoryNameMap } from "./hooks/useCategoryNameMap";
import { useArchiveItem, useRestoreItem, useDeleteItem } from "./hooks/useItemMutations";
import { ItemPanel, type ItemPanelHandle } from "./panel/ItemPanel";
import { ItemArchiveDeleteFlow, type ItemArchiveDeleteFlowHandle } from "./actions/ItemArchiveDeleteFlow";
import { ItemsFilterBar } from "./filters/ItemsFilterBar";
import { useItemsListQueryParams } from "./filters/useItemsListQueryParams";
import type { Item } from "@/lib/api/items";

export function ItemsListPage() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();
  const [ui, updateUi, clearFilters] = useItemsListQueryParams();
  const panelRef = useRef<ItemPanelHandle>(null);
  const archiveFlowRef = useRef<ItemArchiveDeleteFlowHandle>(null);
  const archiveTargetRef = useRef<Item | null>(null);

  const itemsQuery = useItemsList({
    page: ui.page, limit: 25,
    search: ui.q || undefined,
    category_id: ui.category ?? undefined,
    archived: ui.archived || undefined,
    sort: ui.sort, sort_dir: ui.sortDir,
  });
  const { map: categoryNameMap } = useCategoryNameMap();
  const archiveMutation = useArchiveItem();
  const restoreMutation = useRestoreItem();
  const deleteMutation = useDeleteItem();

  if (authLoading) return null;
  const items = itemsQuery.data?.items ?? [];
  const total = itemsQuery.data?.total ?? 0;

  // ... render header, ItemsFilterBar, RetroTable, RetroPagination, ItemPanel, ItemArchiveDeleteFlow
}
```

### Example 2: Backend handler — DELETE registration

```go
// backend/internal/domain/warehouse/item/handler.go -- ADD inside RegisterRoutes
huma.Delete(api, "/items/{id}", func(ctx context.Context, input *GetItemInput) (*struct{}, error) {
    workspaceID, ok := appMiddleware.GetWorkspaceID(ctx)
    if !ok { return nil, huma.Error401Unauthorized("workspace context required") }
    authUser, _ := appMiddleware.GetAuthUser(ctx)

    if err := svc.Delete(ctx, input.ID, workspaceID); err != nil {
        if errors.Is(err, ErrItemNotFound) { return nil, huma.Error404NotFound("item not found") }
        return nil, huma.Error400BadRequest(err.Error())
    }
    if broadcaster != nil && authUser != nil {
        userName := appMiddleware.GetUserDisplayName(ctx)
        broadcaster.Publish(workspaceID, events.Event{
            Type: "item.deleted", EntityID: input.ID.String(), EntityType: "item",
            UserID: authUser.ID, Data: map[string]any{"user_name": userName},
        })
    }
    return nil, nil
})
```

Note: `errors.Is(...)` import needed at top of handler.go.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-managed `is_archived` client filter | Server `?archived=` query param | Phase 58 (categories), Phase 59 (borrowers) | Phase 60 adopts same — URL-shareable, cacheable. |
| Single combined DELETE that soft-archives | Separate `/archive`, `/restore`, `DELETE` (true hard-delete) | Phase 58 (categories) → Phase 59 (borrowers) | Phase 60 fixes the same legacy bug (Pitfall 3) and adopts the same separation. |
| One fat mutation hook per entity | Five small mutation hooks per entity | Phase 58 idiom | Each hook owns its toast copy; matches TanStack Query v5 idiom. |
| Toast via `alert()` | `useToast` retro provider | v2.0 | Consistent retro styling + auto-dismiss. |
| `keepPreviousData` flag (TanStack Query v4) | `placeholderData: (prev) => prev` (TanStack Query v5) | v5 release | Smooth pagination without flicker; v4 flag is removed. |
| Client-side `LIKE %q%` search | Server-side `tsquery` over `search_vector` | Phase 60 first FE consumer | Index-backed; multilingual; relevance ranking via `ts_rank`. |
| Page-level `useState` for filters | URL-state via `useSearchParams` | Phase 60 first | Bookmarkable, browser back/forward, link sharing. |

**Deprecated / should NOT be used in this phase:**
- Raw `fetch` — all HTTP via `@/lib/api`.
- `window.confirm()` / `alert()` — must use `RetroConfirmDialog` / toasts.
- `<dialog>` element directly — wrap via `RetroDialog`/`RetroConfirmDialog`.
- `keepPreviousData: true` — use `placeholderData: (prev) => prev`.
- TanStack Query `cacheTime` — renamed to `gcTime` in v5.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backend changes (list filter extension, DELETE wiring, true `repo.Delete`, sqlc regen) are in scope for Phase 60. | Summary, Pattern 11-13, Pitfall 1, 3, 4 | HIGH — if the user wants a frontend-only phase, D-02/D-03 cannot be implemented and the phase must descope to client-side filtering of the existing 50-item page (which is not really pagination). User should confirm before Plan 60-01 is generated. |
| A2 | Page size 25 is the intended pageSize at the BACKEND level (default `Limit=25`), not just a frontend `?limit=25` send. | Pattern 11 | LOW — UI-SPEC says `?limit=25`; backend default change to 25 (vs current 50) is a one-line edit. If user prefers backend default 50 + frontend explicit `limit=25` send, equivalent behaviour. |
| A3 | Sort safety via SQL `CASE` whitelist is acceptable; sqlc supports `sqlc.arg` enum values. | Pattern 12 | LOW — alternative is `pgx`-direct query construction (planner choice); both safe against injection. |
| A4 | Category-name resolver should request `archived: true` to include archived categories so historical items still show their category name. | Pattern 5, Pitfall 7 | LOW — alternative is "show ARCHIVED CATEGORY badge" or just `—`; LOW user-visible impact. |
| A5 | `placeholderData: (prev) => prev` is the v5 idiom for smooth pagination. | Pattern 4 | LOW — VERIFIED via `tanstack.com/query/v5/docs/framework/react/guides/paginated-queries` (HIGH confidence). |
| A6 | `useSearchParams` from `react-router` is available in v7 library mode. | Pattern 6 | LOW — VERIFIED in `react-router` v7 docs; `useSearchParams` is exported; same API as v6. |
| A7 | The form's category combobox may exclude archived categories (UX choice — don't let users assign new items to archived categories) while the list resolver includes them. | Pitfall 7 | LOW — small UX preference; planner may decide to include archived in both for consistency. |
| A8 | SKU pattern `[A-Za-z0-9_-]+` is acceptable; backend currently has no character constraint (only maxLength=255). | Pattern 3 | LOW — UX cap is stricter than backend; safe to relax later. |
| A9 | UI-SPEC bound `Description` to 2000 chars; backend has no enforced cap. | Pattern 3 | LOW — UX cap; planner may add backend `maxLength:"2000"` to `Description` field for defense-in-depth. |
| A10 | The CONTEXT D-05 SKU pattern `ITEM-{base36-timestamp}-{4-base36}` (Pattern 2) is acceptable; collision risk negligible because the server-side uniqueness check is authoritative. | Pattern 2 | LOW — alternative client patterns work; server check is the real guard. |
| A11 | Items have no FK constraint that would block hard-delete (no equivalent of borrowers' `HasActiveLoans`). Confirmed by reading `service.go` — `Service` has no `Delete` impl currently and there's no `HasActiveLoans` analog in `Repository`. | D-04, Pitfall 3 | LOW — but worth confirming: does deleting an item with an existing loan record cause an FK constraint violation in Postgres? **Recommend the planner audit `warehouse.loans` schema for `item_id` FK constraint and decide policy** — likely either (a) cascade delete loans (risky), (b) block delete with HTTP 400 (mirrors borrower flow), or (c) allow delete and orphan the loans (current default if FK is `ON DELETE NO ACTION`). |
| A12 | The placeholder `ItemsPage.tsx` at `frontend2/src/features/items/ItemsPage.tsx` will be replaced (deleted, or repurposed) by `ItemsListPage.tsx`. The route registration in `routes/index.tsx:80` updates accordingly. | Recommended Project Structure | LOW — safe rename. |
| A13 | The existing `itemsApi` (frontend) export does not need a deprecation pass for removed params (`needs_review`, `location_id`); nothing in `frontend2` imports them today. | Pattern 1 | LOW — VERIFIED by grep; only `itemsApi` is imported in tests/__tests__/queryKeys.test.ts and not via `ItemListParams`. |

If A1 or A11 are wrong, the planner MUST escalate to CONTEXT-discuss before producing plans.

## Open Questions

1. **Does the `warehouse.loans.item_id` FK constraint have `ON DELETE` policy that needs explicit handling?**
   - What we know: Borrowers had a `HasActiveLoans` guard for the same reason; CONTEXT D-04 says items have no analogous guard.
   - What's unclear: Whether deleting an item with loans causes `pgxerror.ForeignKeyViolation` or silently orphans / cascades.
   - Recommendation: Plan 60-01 includes a quick `psql \d+ warehouse.loans` audit; if FK is `ON DELETE RESTRICT/NO ACTION`, mirror borrower flow with `HasActiveLoansForItem` guard + 400. If `ON DELETE CASCADE`, document the implicit behaviour and consider whether it's the desired UX. If NULL on delete, items can be deleted freely and loans show "—" for item.
   - **Action for planner:** confirm before Plan 60-01 SQL changes.

2. **Should backend `/items/search` endpoint be deprecated in favour of `?search=` on `/items`?**
   - What we know: `GET /items/search` exists (handler.go:62-83) and uses the same `Service.Search` method as the new filtered list will. Two endpoints doing similar work.
   - What's unclear: Is `/items/search` consumed by any other client (Obsidian sync? scripts? mobile?)
   - Recommendation: Leave `/items/search` as-is (preserve API contract); the filtered list is the primary path. A future cleanup phase can deprecate.

3. **Should Wave 0 add a backend integration test for the full item filter matrix (search × category × archived × sort × dir × pagination)?**
   - What we know: Existing tests cover individual handlers; no combined filter matrix test exists.
   - What's unclear: Cost vs. coverage trade-off.
   - Recommendation: Plan 60-01 adds a single handler-level test with 4-6 representative combinations (active+search, archived-included, category-filter+sort-by-created-desc, page-2-of-3, search-with-no-matches). Don't aim for exhaustive matrix.

4. **Should the form's Category combobox allow "no category" via a clear-button, vs. requiring the user to pick one of N options?**
   - What we know: Category is optional per D-05.
   - What's unclear: UX for clearing a once-selected category.
   - Recommendation: `RetroCombobox` doesn't have a built-in clear button today; planner may add a small "× Clear" button next to the Combobox if needed. Otherwise users must reload the form to clear a once-selected category — minor UX nit. Surface as Plan 60-03 detail.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | package install, test runner | ✓ | existing toolchain | npm |
| Node | build | ✓ | existing | — |
| React 19 | all components | ✓ | 19.2.5 | — |
| TypeScript ~6 | typing | ✓ | ~6.0.2 | — |
| Tailwind 4 | styling | ✓ | ^4.2.2 | — |
| Vitest 4 + Testing Library 16 | tests | ✓ | 4.1.3 / 16.3.2 / user-event 14.6.1 | — |
| Go + huma/v2 | backend changes | ✓ | existing Go backend compiles today | — |
| sqlc | regenerate `items.sql.go` after new queries | ✓ | existing infra (queries already sqlc-generated) | Hand-rolled `pgx` if sqlc unavailable |
| PostgreSQL | backend test DB + tsquery FTS | ✓ | existing integration test setup (`item_repository_test.go`); `search_vector` column already exists | — |
| Phase 56 `@/lib/api` helpers | API client additions | ✓ | shipped | — |
| Phase 57 `@/components/retro` primitives | All UI | ✓ | shipped | — |
| Phase 58 `SlideOverPanel` (`features/taxonomy/panel/`) | ItemPanel slide-over | ✓ | shipped | — |
| Phase 59 `BorrowerArchiveDeleteFlow` pattern | ItemArchiveDeleteFlow mirror | ✓ | shipped | — |

**Missing with no fallback:** None.
**Missing with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (frontend) | vitest 4.1.3 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 |
| Framework (backend) | `go test` + testify + sqlc-generated + dockertest for repo tests |
| Config file (frontend) | `frontend2/vitest.config.*` (existing) |
| Quick run command (frontend) | `cd frontend2 && bun run test -- --run src/features/items/__tests__/<file>` |
| Quick run command (backend) | `go test ./internal/domain/warehouse/item/...` |
| Full suite command (frontend) | `cd frontend2 && bun run test` |
| Full suite command (backend) | `go test ./...` |
| Lint | `cd frontend2 && bun run lint && bun run lint:imports` |
| Build | `cd frontend2 && bun run build` |
| i18n extract | `cd frontend2 && bun run i18n:extract` (must add no orphan keys; both `en` and `et` must compile) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ITEM-01 | List renders 25 items per page; pagination control appears when `total > 25`; navigates between pages | integration | `bun run test -- --run src/features/items/__tests__/ItemsListPage.test.tsx` | ❌ Wave 0 |
| ITEM-01 | Search input debounces (300ms) and updates URL `?q=`, refetches | integration | `ItemsFilterBar.test.tsx` | ❌ Wave 0 |
| ITEM-01 | Backend: `GET /items?search=foo` returns FTS-matched items | Go handler | `go test ./internal/domain/warehouse/item/... -run TestItemHandler_List_Search` | ❌ Wave 0 |
| ITEM-02 | Filter by category: select category in combobox → URL `?category=<uuid>` → list refetches | integration | `ItemsFilterBar.test.tsx` + `ItemsListPage.test.tsx` | ❌ Wave 0 |
| ITEM-02 | Sort by name/sku/created/updated × asc/desc | integration | `ItemsFilterBar.test.tsx` + `ItemsListPage.test.tsx` | ❌ Wave 0 |
| ITEM-02 | Backend: `?sort=created_at&sort_dir=desc` returns rows in correct order | Go handler | `go test ./internal/domain/warehouse/item/... -run TestItemHandler_List_Sort` | ❌ Wave 0 |
| ITEM-03 | Detail page renders SKU, barcode, description, category-name, created/updated; absent fields show `—` | integration | `ItemDetailPage.test.tsx` | ❌ Wave 0 |
| ITEM-03 | Detail page Photos & Loans sections render `RetroEmptyState` placeholders | unit | `ItemDetailPage.test.tsx` | ❌ Wave 0 |
| ITEM-04 | Create: open panel → fill name (only required) + auto-SKU → submit → row appears at top | integration | `ItemForm.test.tsx` + `ItemPanel.test.tsx` | ❌ Wave 0 |
| ITEM-04 | Required validation: clearing name shows "Name is required."; clearing SKU shows "SKU is required." | unit | `ItemForm.test.tsx` | ❌ Wave 0 |
| ITEM-04 | SKU collision: backend returns 400 → form shows specific error toast (Pitfall 6) | integration | `ItemPanel.test.tsx` (mock 400 with "SKU already exists" message) | ❌ Wave 0 |
| ITEM-05 | Edit: open panel on row → fields pre-populated → submit → row updates | integration | `ItemPanel.test.tsx` | ❌ Wave 0 |
| ITEM-06 | Delete (archived row): "delete permanently" link → danger dialog → DELETE → row removed; success toast | integration | `ItemArchiveDeleteFlow.test.tsx` + `ItemsListPage.test.tsx` | ❌ Wave 0 |
| ITEM-06 | Detail page delete navigates to `/items` after success (Pitfall 9) | integration | `ItemDetailPage.test.tsx` | ❌ Wave 0 |
| ITEM-06 | Backend: `DELETE /items/{id}` returns 204; row is GONE (not soft-archived) — verify via repo test | Go integration | `go test ./internal/infra/postgres/... -run TestItemRepository_Delete_Hard` | ❌ Wave 0 |
| ITEM-06 | Backend: `DELETE /items/{id}` for cross-workspace id returns 404 | Go handler | `TestItemHandler_Delete_NotFound` | ❌ Wave 0 |
| ITEM-07 | Archive: confirm dialog → ARCHIVE → row muted with badge, Restore action visible | integration | `ItemsListPage.test.tsx` + `ItemArchiveDeleteFlow.test.tsx` | ❌ Wave 0 |
| ITEM-07 | Restore from list: row Restore button → row returns to active state | integration | `ItemsListPage.test.tsx` | ❌ Wave 0 |
| ITEM-08 | Filter chip toggles `?archived=1` URL param; chip shows OFF/ON visual state; archived rows interleave in sort order | integration | `ShowArchivedChip.test.tsx` + `ItemsListPage.test.tsx` | ❌ Wave 0 |
| ITEM-08 | Backend: `?archived=true` returns active+archived; default returns active only | Go handler | `TestItemHandler_List_Archived` | ❌ Wave 0 |
| (cross) | Pagination + filter combo: searching while on page 5 resets to page 1 (Pitfall 8) | unit | `useItemsListQueryParams.test.ts` | ❌ Wave 0 |
| (cross) | Category-name resolver includes archived categories (Pitfall 7) | unit | `useCategoryNameMap.test.ts` | ❌ Wave 0 |
| (cross) | Lingui catalog: `bun run i18n:extract` adds no unextracted keys; `et` catalog compiles | command | `cd frontend2 && bun run i18n:extract && bun run i18n:compile` | ✓ existing tooling |
| (cross) | Forbidden-imports lint passes (no `idb|serwist|offline|sync` introduced) | command | `cd frontend2 && bun run lint:imports` | ✓ existing tooling |

### Sampling Rate

- **Per task commit:** `cd frontend2 && bun run test -- --run src/features/items` + `go test ./internal/domain/warehouse/item/...` + `go test ./internal/infra/postgres/... -run TestItemRepository` (when backend touched)
- **Per plan merge:** `cd frontend2 && bun run test && bun run lint && bun run lint:imports && bun run build` + `go test ./...`
- **Phase gate:** Full suite green; lingui catalogs compile; retro barrel unchanged; forbidden-imports lint passes; manual UAT against `60-UAT.md` (see `60-VALIDATION.md` for the complete checklist).

### Wave 0 Gaps

- [ ] `frontend2/src/features/items/__tests__/ItemForm.test.tsx` — schema validation (name required, SKU required + pattern, barcode pattern, description max), empty-string→undefined coercion, submit payload shape
- [ ] `frontend2/src/features/items/__tests__/ItemPanel.test.tsx` — create vs edit mode, dirty-guard, successful mutation closes panel, SKU collision error path
- [ ] `frontend2/src/features/items/__tests__/ItemArchiveDeleteFlow.test.tsx` — primary ARCHIVE, secondary-link → hard-delete, success closes both dialogs, error keeps dialog open
- [ ] `frontend2/src/features/items/__tests__/ItemsFilterBar.test.tsx` — search debounce, category combobox selection, sort dropdown, chip toggle
- [ ] `frontend2/src/features/items/__tests__/ShowArchivedChip.test.tsx` — off/on visual states, aria-pressed, count display
- [ ] `frontend2/src/features/items/__tests__/ItemsListPage.test.tsx` — loading, error, empty, populated, archived toggle, row actions, pagination, filter combinations
- [ ] `frontend2/src/features/items/__tests__/ItemDetailPage.test.tsx` — loading, 404, populated, archived state, delete-then-navigate
- [ ] `frontend2/src/features/items/__tests__/useItemsListQueryParams.test.ts` — URL state read/write, page-reset on filter change, clearFilters behaviour
- [ ] `frontend2/src/features/items/__tests__/useCategoryNameMap.test.ts` — map-builder, includes archived
- [ ] `frontend2/src/features/items/__tests__/fixtures.ts` — `makeItem`, `renderWithProviders` (mirror borrowers' fixtures)
- [ ] `frontend2/src/lib/api/__tests__/queryKeys.test.ts` — extend with new `ItemListParams` shape (search/category_id/archived/sort/sort_dir)
- [ ] `backend/internal/domain/warehouse/item/handler_test.go` — extend with: list filtered by search/category/archived/sort, delete success, delete cross-workspace 404
- [ ] `backend/internal/infra/postgres/item_repository_test.go` — extend with: `FindByWorkspaceFiltered` matrix, true `Delete` (verify row gone, not soft-archived), `CountItemsFiltered`
- [ ] `backend/db/queries/items.sql` — add `ListItemsFiltered`, `CountItemsFiltered`, `DeleteItem` queries; regen via sqlc
- [ ] Framework install: none — all Wave 0 tooling already shipped

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | inherited | `RequireAuth` wrapper in `routes/index.tsx`; workspace + user threaded via `AuthContext` |
| V3 Session Management | inherited | Phase 56 foundation; no changes |
| V4 Access Control | **yes** | Every endpoint asserts `workspaceID` via `appMiddleware.GetWorkspaceID(ctx)`; new DELETE handler MUST do the same; service `Delete` MUST verify workspace ownership before issuing the SQL DELETE |
| V5 Input Validation | **yes** | Frontend zod schema (UX); backend huma validation (authoritative — `minLength`/`maxLength`/`enum` on input struct tags); SQL `sqlc.narg` parameterization for filter params; CASE-whitelist for sort field |
| V6 Cryptography | no | No crypto in scope |
| V7 Error Handling | **yes** | `HttpError` class maps server errors to user-safe toasts; `ErrSKUTaken` and `ErrItemNotFound` are mapped to specific user messages; no server stack traces leaked client-side |
| V8 Data Protection | partial | Item PII (name, description, barcode) stays workspace-scoped; no broadcast across workspaces; events broadcast within workspace only |
| V13 API & Web Services | **yes** | Every new/extended backend endpoint under `/workspaces/{wsId}/items/...`; copy auth + workspace pattern from existing endpoints |

### Known Threat Patterns for {React + Go/huma + Postgres}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Item name/description rendered in dialog body or detail page (reflected user content) | Tampering / XSS | React auto-escapes `{item.name}` and Lingui interpolations; never use `dangerouslySetInnerHTML`; markdown rendering NOT used in Phase 60. |
| SQL injection via list filter (search, category_id, sort, sort_dir) | Tampering | sqlc parameterized queries via `sqlc.narg`/`sqlc.arg`; CASE-whitelist for sort field (Pattern 12); huma `enum` constraint on sort/sort_dir struct tags rejects unknown values before reaching SQL. |
| Cross-workspace item access (read or delete) | Info Disclosure / Authorization | Every endpoint extracts `workspaceID` from session middleware (NOT URL); `Service.Delete` MUST call `GetByID(id, workspaceID)` first to verify ownership before issuing SQL DELETE; pattern verified in existing handlers. |
| Cross-workspace category assignment via crafted `category_id` | Authorization | `Service.Create` already calls `s.categoryRepo.FindByID(*input.CategoryID, input.WorkspaceID)` (service.go:111-118); `Service.Update` should do the same — verify in test. |
| Hard-delete bypasses soft-archive UX | Authorization | Two distinct endpoints (`POST /archive` vs `DELETE`); UI surfaces the archive-first dialog as the primary path; only the explicit "delete permanently" secondary link reaches the hard-delete endpoint. |
| Search query DoS via huge query string | DoS | `plainto_tsquery` is lexer-bounded (no regex backtracking); huma limits query string length implicitly via HTTP server limits; consider adding `maxLength:"200"` on `Search` struct tag for defense-in-depth. |
| Pagination DoS via `?page=999999` | DoS / Performance | huma `minimum:"1"` enforces lower bound; consider `maximum:"10000"` for upper bound (Pitfall 10). |
| Workspace ID tampering via route param | Authorization | `workspaceID` comes from session middleware (`appMiddleware.GetWorkspaceID(ctx)`), NOT the URL `/workspaces/{wsId}/items/...` segment — that wsId is decorative. [VERIFIED: handler.go:27-29 pattern] |
| Unauthorized DELETE via missing auth | AuthN/AuthZ | New `huma.Delete` handler MUST call `appMiddleware.GetWorkspaceID(ctx)` + `GetAuthUser(ctx)` in first lines; copy pattern from `huma.Post(.../archive)` handler verbatim. |
| Event payload PII leak | Info Disclosure | `item.deleted` event publishes only `user_name` and entity ID, not item name/description (matches `borrower.deleted` pattern); broadcaster is scoped to workspace subscribers. |
| Long description / barcode field DoS | DoS | Frontend zod `max(2000)` on description, `max(64)` on barcode; backend currently has no enforced max on description (handler.go:477) — recommend adding `maxLength:"2000"` on `Description` struct tag. |
| Concurrent SKU collision (race) | Data integrity | Postgres UNIQUE constraint on `(workspace_id, sku)` is the authoritative guard (verify migration); `Service.Create`'s pre-check is best-effort but cannot prevent races; on race, INSERT fails with unique-violation → service maps to `ErrSKUTaken` → 400. **Planner action:** verify the UNIQUE constraint exists in the schema; if not, add a migration. |

## Project Constraints (from CLAUDE.md / STATE.md)

No `CLAUDE.md` exists at repo root or in `frontend2/`. Applicable directives extracted from STATE.md (v2.0/v2.1 decisions), `frontend2/package.json`, and the forbidden-imports script:

- **No shadcn / Radix / headless UI libraries.** Hand-roll via `@/components/retro`. [v2.0 locked]
- **All retro imports MUST come from `@/components/retro` barrel.** [v2.0 locked — verified by reading `components/retro/index.ts`]
- **Lingui `t` macro on every user-visible string.** Both `en` and `et` catalogs must compile before checkpoint. [v2.0 project rule]
- **TanStack Query v5 for server state.** No raw `fetch` in components; all API calls through `@/lib/api` + `useQuery`/`useMutation`. [v2.1 locked]
- **react-hook-form + zod via `RetroFormField`.** Standard form substrate — `Controller`-for-all, no `register()`. [v2.1 locked via Phase 57 D-03]
- **Pre-build lint guard:** `bun run lint:imports` blocks `idb|serwist|offline|sync` imports under `frontend2/src/**`. Phase 60 must not introduce any. [v2.1 CI decision; verified by reading `scripts/check-forbidden-imports.mjs`]
- **Online-only for v2.1.** No offline/PWA. [v2.1 locked]
- **`forwardRef` + proper `ref` forwarding on every primitive.** Existing pattern; ItemPanel must follow.
- **All interactive controls: `min-height: 44px` (mobile hit target).** Row action buttons must comply (`min-h-[44px] lg:min-h-[36px]` responsive); chip must comply.
- **`font-mono` for SKU/barcode/IDs/badges; `font-sans` for names/labels.** Per-cell font override (Pitfall 5).
- **`workspaceId` read via `useAuth()` in hooks, never passed as prop.** Verified across all existing mutation hooks.
- **Events published on mutations (backend).** Existing handlers publish `item.created`, `item.updated`, `item.deleted` (currently for archive). New `huma.Delete` handler SHOULD publish `item.deleted` for true delete; existing archive handler will continue publishing `item.deleted` for soft-archive (acceptable — event semantics are loose; alternative is to introduce `item.archived` and `item.restored` events for symmetry with category handler).
- **No new runtime dependencies in Phase 60.** All needed libraries are installed.
- **Imperative panel ref pattern:** `panelRef.current?.open("create")` / `panelRef.current?.open("edit", item)`. Mirrors `BorrowerPanel`.

## Sources

### Primary (HIGH confidence — read in this session)

**Frontend:**
- `frontend2/src/lib/api/items.ts` — current Item type, `itemsApi`, `itemKeys`
- `frontend2/src/lib/api/borrowers.ts` — mirror pattern for `delete` method, archive/restore, list params
- `frontend2/src/lib/api/categories.ts` — pattern for `categoriesApi.list({archived})` + `categoryKeys`
- `frontend2/src/lib/api/index.ts` — barrel exports
- `frontend2/src/lib/api.ts` — `HttpError`, `get`/`post`/`patch`/`del` helpers
- `frontend2/src/features/borrowers/BorrowersListPage.tsx` — reference for list page structure (font-override, action buttons, archive dialog wiring)
- `frontend2/src/features/borrowers/BorrowerDetailPage.tsx` — reference for detail page structure
- `frontend2/src/features/borrowers/panel/BorrowerPanel.tsx` — slide-over create/edit dual-mode pattern
- `frontend2/src/features/borrowers/actions/BorrowerArchiveDeleteFlow.tsx` — two-stage dialog (drop 400 short-circuit for items)
- `frontend2/src/features/borrowers/forms/BorrowerForm.tsx` — RHF + zod + `RetroFormField` pattern, empty-string coercion
- `frontend2/src/features/borrowers/forms/schemas.ts` — zod schema shape
- `frontend2/src/features/borrowers/hooks/useBorrowerMutations.ts` — 5-hook mutation file shape with `useToast` + `useLingui`
- `frontend2/src/features/borrowers/hooks/useBorrowersList.ts` — list hook shape
- `frontend2/src/features/borrowers/hooks/useBorrower.ts` — detail hook shape
- `frontend2/src/features/borrowers/icons.tsx` — local icon module pattern (no lucide imports)
- `frontend2/src/features/items/ItemsPage.tsx` — current placeholder (to be replaced)
- `frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx` — slide-over reference (focus mgmt, dirty guard, portal)
- `frontend2/src/components/retro/index.ts` — barrel (verified exports include all needed primitives)
- `frontend2/src/components/retro/RetroTable.tsx` — default `font-mono` behaviour (Pitfall 5)
- `frontend2/src/components/retro/RetroEmptyState.tsx` — empty-state API
- `frontend2/src/components/retro/RetroConfirmDialog.tsx` — `secondaryLink` + `variant` props
- `frontend2/src/components/retro/RetroPagination.tsx` — `page/pageSize/totalCount/onChange` API; auto-hides when `<= pageSize`
- `frontend2/src/components/retro/RetroCombobox.tsx` — async picker API; `onSearch` debounced 250ms internally
- `frontend2/src/components/retro/RetroSelect.tsx` — sync picker API
- `frontend2/src/routes/index.tsx` — current route registration (replace placeholder ItemsPage)
- `frontend2/package.json` — dependency versions (all VERIFIED installed)
- `scripts/check-forbidden-imports.mjs` — lint:imports forbidden patterns

**Backend:**
- `backend/internal/domain/warehouse/item/handler.go` — current handler; confirms ListItemsInput has only Page/Limit/NeedsReview today; no DELETE registered; archive/restore exist
- `backend/internal/domain/warehouse/item/service.go` — `ServiceInterface` lacks `Delete`; `List` has 3 params today
- `backend/internal/domain/warehouse/item/repository.go` — `Repository` interface has `Delete`
- `backend/internal/domain/warehouse/item/errors.go` — `ErrItemNotFound`, `ErrSKUTaken`, `ErrShortCodeTaken`, `ErrInvalidMinStock` (read filename only — error names from handler usage)
- `backend/internal/infra/postgres/item_repository.go` — `FindByWorkspace` returns `len(items)` not COUNT (Pitfall 1); `Delete` calls `ArchiveItem` SQL (Pitfall 3)
- `backend/db/queries/items.sql` — current SQL: ListItems, SearchItems, ArchiveItem, RestoreItem; `search_vector` already wired for tsquery; no DeleteItem; no count query for non-needs-review list
- `backend/internal/domain/warehouse/borrower/handler.go` — canonical pattern for `huma.Delete` registration with workspace check + event broadcast
- `backend/internal/domain/warehouse/borrower/service.go` — pattern for `Delete(ctx, id, workspaceID)` with workspace ownership verification
- `backend/internal/infra/postgres/borrower_repository.go` — pattern for separate `Archive`/`Restore`/`Delete` methods + sqlc.narg in `FindByWorkspace` for archived filter
- `backend/db/queries/borrowers.sql` — pattern for `sqlc.narg('archived')::bool` conditional filter, separate `DeleteBorrower :exec` query

**Planning:**
- `.planning/phases/60-items-crud/60-CONTEXT.md` — D-01..D-09 (verbatim copied to user_constraints section)
- `.planning/phases/60-items-crud/60-UI-SPEC.md` — visual + interaction contracts (referenced extensively)
- `.planning/phases/59-borrowers-crud/59-RESEARCH.md` — adjacent-phase research; pattern reuse, pitfall-shape parallels
- `.planning/REQUIREMENTS.md` — ITEM-01..08 verbatim
- `.planning/STATE.md` — v2.0/v2.1 locked decisions

### Secondary (MEDIUM confidence)

- TanStack Query v5 docs — `placeholderData` function form for paginated queries; `gcTime` rename — recalled from training, consistent with existing v5 usage in repo
- React Router v7 docs — `useSearchParams` available in library mode; same API as v6
- W3C ARIA Authoring Practices — combobox + dialog patterns (already encoded in `RetroCombobox` / `RetroDialog`)
- sqlc docs `https://docs.sqlc.dev/en/latest/howto/named_parameters.html` — `sqlc.narg` for nullable params; CASE-in-ORDER-BY pattern is community-standard

### Tertiary (LOW confidence)

- None. Every claim is either verified in-repo or marked `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Frontend patterns + stack: HIGH — three adjacent phases (56, 58, 59) shipped with verified parallel code; every primitive read this session
- Frontend stack versions: HIGH — verified against `frontend2/package.json` (installed)
- Backend API surface: HIGH — read all handler/service/repository/query files for items + borrower-equivalent for the Phase 59 pattern reference
- Backend gaps (Pitfalls 1, 3, 4): HIGH — gaps verified by reading exact lines; same shape as Phase 59's borrower bug fixes
- CONTEXT feasibility: HIGH — every D-01..D-09 maps to a concrete pattern; only A1 and A11 are user-confirmable assumptions
- New filter chip primitive: MEDIUM-HIGH — UI-SPEC pre-decided shape; composition is novel but uses only existing tokens/primitives
- SQL CASE-in-ORDER-BY pattern: MEDIUM-HIGH — community-standard but planner should verify sqlc generated code is acceptable; alternative `pgx`-direct is a fallback
- Test strategy: HIGH — Wave 0 gaps enumerated against adjacent-phase test files

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days; everything cited is shipped code or stable v5/v7 library decisions)
