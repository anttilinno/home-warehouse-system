# Phase 10: Taxonomy — Research

**Researched:** 2026-06-13
**Domain:** React 19 + TS + Vite + TanStack Query + RHF + zod + lingui frontend2 parity (categories/locations/containers/labels CRUD + hierarchical tree + type-ahead pickers)
**Confidence:** HIGH (every claim backed by codebase file:line; backend contract read from Go service/handler/migration source)

## Summary

Phase 10 builds the Taxonomy page: a single `/taxonomy?tab=` route with `RetroTabs` switching between **Categories** (tree), **Locations** (tree), **Containers** (grouped-by-location), and **Labels** (CRUD list). All four domains already have a complete, verified backend surface under `/workspaces/{wsId}`; the work is purely frontend: 4 api modules (one exists — `labels.ts` — but only covers list+attach/detach), a net-new recursive **Tree atom** with sessionStorage-persisted expand state, a flat→nested **tree builder** util, per-tab CRUD forms, and a search-backed **type-ahead picker** component (the picker primitive `RetroCombobox` already exists; what's net-new is a `/search`-backed data hook around it).

**The single most important finding** overturns a CONTEXT assumption: the backend does **NOT** implement service-level usage warnings or cascade logic for archive/delete. Archive always succeeds (no item check). Delete behavior is governed entirely by **Postgres FK `ON DELETE` actions** read from the migration: category delete `SET NULL`s assigned items (`items_category_fk`), container delete `SET NULL`s assigned inventory (`inventory_container_fk`) — i.e. the "unassign-and-delete cascade" is automatic at the DB layer, no flag/param/second call needed. Location delete is asymmetric and dangerous: `containers.location_id` is `ON DELETE CASCADE` (deletes child containers) while `inventory.location_id` is `ON DELETE RESTRICT` (DB rejects the delete → 500). This shapes the entire archive-vs-delete UX (see OQ2/OQ6).

**Primary recommendation:** Mirror the borrowers/loans/inventory shipped stack verbatim (api module → query hook with prefix key → mutations hook with PREFIX-invalidate + HttpError mapping → page). Build the tree client-side from the flat `GET /categories` list (legacy `buildCategoryTree` is the parity reference). Use **archive** (soft + restore) as the primary destructive action for categories/locations (TAX-02/04), **delete** for containers (TAX-06). Source the TAX-02 "usage warning" count from a cheap `GET /items?category_id={id}&limit=1` read of the paginated `total`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hierarchical tree assembly | Browser/Client | — | Backend ships flat lists; nesting is a client transform (legacy `buildCategoryTree`, OQ1) |
| Expand/collapse persistence | Browser/Client (sessionStorage) | — | UI-only state, no server model; net-new (no sessionStorage precedent in frontend2) |
| Category/location/container/label CRUD | API/Backend | Client (forms) | All endpoints verified live; client owns RHF+zod forms + optimistic invalidation |
| Archive/restore (soft delete) | API/Backend (service) | Client (confirm UX) | `svc.Archive/Restore` flip `is_archived`; never check usage (service.go evidence) |
| Delete cascade / unassign | Database (FK ON DELETE) | API passthrough | NOT in Go service — pure Postgres FK actions (migration 001 evidence) |
| TAX-02 usage count | API/Backend (`/items?category_id=`) | Client (warning copy) | No service usage-count endpoint; derive from items list `total` |
| Type-ahead search | API/Backend (`/{domain}/search?q=`) | Client (RetroCombobox) | `/locations/search` + `/containers/search` exist; combobox already shipped |
| Container "grouped by location" | Browser/Client | — | Containers are flat with `location_id` (TAX-05 is a client group-by) |

## Standard Stack

### Core (all already in frontend2 — no installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19 | UI | shipped |
| @tanstack/react-query | (shipped) | server state, query keys, invalidation | every feature uses it |
| react-hook-form + zod | (shipped) | form state + validation | InventoryFormPage / BorrowerFormPage pattern |
| @lingui/react/macro | (shipped) | i18n (`t`, `<Trans>`) | every page; **render-loop landmine** (see Pitfalls) |
| react-router | (shipped, library mode) | routing, `useSearchParams` | `routes/index.tsx` is single-writer |
| vitest 4.1.5 + msw | (shipped) | unit tests | `src/test/msw/handlers.ts` |
| @playwright/test 1.59.1 | (shipped) | E2E | `frontend2/e2e/*.spec.ts` |

### Supporting (reused components — all via `@/components/retro` barrel)
| Component | Path | Use |
|-----------|------|-----|
| `RetroTabs` | `components/retro/data/RetroTabs.tsx:36` | Controlled (`value`+`onChange`) tab shell — drive from `?tab=` |
| `RetroCombobox` | `components/retro/form/RetroCombobox.tsx:38` | W3C list-autocomplete; client-filters a static `options[]` — **the type-ahead picker primitive** |
| `RetroConfirmDialog` | `components/retro/overlay/RetroConfirmDialog.tsx` | archive/delete confirm |
| `RetroDialog` | `components/retro/overlay/RetroDialog.tsx` | create/edit modal form host |
| `RetroFormField` / `RetroInput` / `RetroTextarea` / `RetroSelect` | `components/retro/form/*` | form fields |
| `Window`, `BevelButton`, `RetroTable`, `RetroEmptyState`, `RetroPagination`, `FilterBar`, `retroToast` | `components/retro/*` | page chrome |
| `HttpError` | `lib/api.ts:24` | `err instanceof HttpError && err.status === N` mapping |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client tree from flat `GET /categories` | Lazy `GET /categories/root` + `/{id}/children` | Lazy = N round-trips, breaks whole-tree search/sort, no parity precedent. Flat is what legacy ships and what `usePickerOptions` already does (≤100 single fetch). **Reject lazy** (OQ1). |
| `RetroCombobox` + `/search` hook | Retrofit `usePickerOptions` (limit=100 native selects) into shipped forms | Retrofit risks destabilizing 3 shipped forms (inventory/move/item). **Ship the picker component, use it ONLY in Taxonomy** (OQ4). |
| `sessionStorage` for expand state | URL `?expanded=` / TanStack Query cache | URL would bloat; cache is wiped on refetch. sessionStorage matches CONTEXT spec. |

**Installation:** None — zero new dependencies. All primitives ship in frontend2.

## Package Legitimacy Audit

> No external packages are installed in this phase. All dependencies (react-query, RHF, zod, lingui, react-router, vitest, msw, playwright, and every `@/components/retro` primitive) are already present in `frontend2/package.json`. **Package Legitimacy Gate: N/A — zero new installs.**

---

## User Constraints (from CONTEXT.md)

> Phase 10 has no `## Decisions` / `## Claude's Discretion` / `## Deferred Ideas` sections — CONTEXT.md is a researcher brief with Open Questions, not a discuss-phase output. The binding constraints below are carry-forward locks from prior phases and ARE authoritative.

### Locked Decisions (carry-forward binding constraints, CONTEXT.md §"Binding constraints" lines 51-58)
1. `limit` caps at **100** — clamp every list read `≤100` (422 over cap).
2. List envelopes are **bare `{items}`** on SOME domains (categories, labels, all `/search`) and **paginated `{items,total,page,total_pages}`** on others (locations, containers, items, inventory). **Confirm per endpoint** (see Backend Contract table) — never read `.total` unless the endpoint returns it.
3. **RENDER-LOOP landmine** — `t` from `useLingui()` is NOT referentially stable; read it via `tRef` in memo'd closures; destructure mutation `.mutate`. Mirror shipped pages exactly.
4. Query-key prefixes `["categories"|"locations"|"containers"|"labels", wsId, ...]` (so SSE + mutation PREFIX-invalidate cover them without `exact:true`).
5. `routes/index.tsx` is a **single-writer/serialized** file across plans (Phase-8/9 lesson); literal routes BEFORE param routes (AP-1 library mode).
6. Declare EVERY edited file in `files_modified` (no hidden callsite edits — Phase-8 lesson).
7. Same-wave plans MUST have **disjoint** `files_modified`.

### Claude's Discretion
- Tree atom internal API shape, sessionStorage key scheme, per-tab form component layout (within the borrowers/inventory parity idiom).
- Whether Labels is a 4th tab vs `/labels` route (recommendation: **4th tab** — OQ3).

### Deferred Ideas (OUT OF SCOPE)
- Drag-and-drop tree reordering (legacy had `arrayMove`/dnd — NOT a v3.0 parity requirement; TAX-02/04 say "create/edit/archive", not reorder).
- Retrofitting shipped item/inventory/loan forms with the type-ahead picker (OQ4 — leave shipped forms untouched).
- Hard-delete UI for categories/locations (backend `DELETE` endpoints exist but parity uses archive — OQ6).
- Per-row live item/container counts beyond the single archive-warning fetch (mirrors borrowers OQ7 "no fan-out").

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAX-01 | Categories tree, expand/collapse → sessionStorage | OQ1 (client tree build + Tree atom + sessionStorage key scheme) |
| TAX-02 | Create/edit/**archive** categories; usage warning when archiving with assigned items | OQ2 (archive always succeeds; warning count from `GET /items?category_id=&limit=1` total) |
| TAX-03 | Locations tree | OQ1 (same Tree atom; `parent_location` field — note name diff) |
| TAX-04 | Create/edit/**archive** locations | OQ6 (archive, not delete; location delete is dangerous — RESTRICT/CASCADE) |
| TAX-05 | Containers grouped by location | Client group-by on `location_id`; containers list is paginated `{items,total,...}` |
| TAX-06 | Create/edit/**delete** containers; unassign-and-delete when assigned | OQ2 (delete = DB `ON DELETE SET NULL` auto-unassign; no flag/2nd call) |
| TAX-07 | Label manager — CRUD list + color picker | OQ3 (extend `labels.ts`; color is `*string` hex `#RRGGBB`; 4th tab) |

---

## Backend Contract (verified from Go source 2026-06-13)

All routes under `/workspaces/{wsId}`. Envelope column is load-bearing for Pitfall 2.

| Domain | List route | List envelope | Search | Create body | Parent field | Color/extra |
|--------|-----------|---------------|--------|-------------|--------------|-------------|
| **categories** | `GET /categories` | **BARE `{items}`** (`category/handler.go:34-36,324-326`) | none | `{name, parent_category_id?, description?}` (`handler.go:332-338`) | `parent_category_id` | — |
| **locations** | `GET /locations?page&limit` | **paginated `{items,total,page,total_pages}`** (`location/handler.go:333-338`) | `GET /locations/search?q=&limit` → BARE `{items}` (`handler.go:400-407`) | `{name, parent_location?, description?, short_code?}` (`handler.go:348-355`) | **`parent_location`** ⚠ (NOT `_id`) | `short_code` (auto-gen) |
| **containers** | `GET /containers?page&limit` | **paginated `{items,total,page,total_pages}`** (`container/handler.go:312-317`) | `GET /containers/search?q=&limit` → BARE `{items}` (`handler.go:373-375`) | `{name, location_id, description?, capacity?, short_code?}` (`handler.go:327-335`) | `location_id` (flat — TAX-05 is client group-by) | `short_code`, `capacity` |
| **labels** | `GET /labels` | **BARE `{items}`** (`label/handler.go:34-36,269-271`) | none | `{name, color?, description?}` (`handler.go:277-283`) | — | `color` `*string` hex `^#[0-9A-Fa-f]{6}$` (`handler.go:280`) |

**Lifecycle routes (all four domains, except categories has children-check on delete):**
`POST /{domain}` (201 categories / 200 others), `GET /{id}`, `PATCH /{id}` (all-optional body), `POST /{id}/archive` (→ `204`/empty), `POST /{id}/restore`, `DELETE /{id}` (→ `204`/empty). Categories also: `GET /categories/root`, `/{id}/children`, `/{id}/breadcrumb`. Locations: `/{id}/breadcrumb`.

**Response shapes** (TS interfaces to add to `lib/types.ts` or inline in api modules):
- `Category`: `{id, workspace_id, name, parent_category_id?, description?, is_archived, created_at, updated_at}` (`category/handler.go:362-371`). **No `item_count`** — usage count must be derived (OQ2).
- `Location`: `{id, workspace_id, name, parent_location?, description?, short_code, is_archived, created_at, updated_at}` (`location/handler.go:374-384`).
- `Container`: `{id, workspace_id, name, location_id, description?, capacity?, short_code, is_archived, created_at, updated_at}` (`container/handler.go:355-366`).
- `Label`: already in `lib/types.ts:182-189` `{id, workspace_id, name, color?, description?}` — **add `is_archived, created_at, updated_at`** for the manager.

**MapDomainError → HTTP status map** (`internal/api/middleware/errors.go:103-122`): `ErrNotFound→404`, `ErrInvalidInput→400`, `ErrAlreadyExists→409`, `ErrConflict→409`, `ErrForbidden→403`, `ErrInternal→500`, unknown→400.

---

## Open Questions (RESOLVED)

### OQ1 — Tree build: **client-build from flat `GET /categories`** ✅

**Evidence:**
- Backend ships a flat list endpoint with no nesting: `category/handler.go:18-37` returns `{items: CategoryResponse[]}` where each carries `parent_category_id` (`handler.go:366`).
- **Legacy parity reference** does exactly this: `frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx:84-110` `buildCategoryTree(categories)` — a Map-based flat→nested builder keyed on `parent_category_id`, sorted alphabetically per level.
- The lazy alternative (`/categories/root` + `/{id}/children`) exists (`handler.go:40,79`) but is rejected: N round-trips, no whole-tree client search/sort, and no parity precedent. `usePickerOptions.ts:55-62` already proves the single ≤100 fetch idiom for these domains.

**Decision:** Client-build. One `GET /categories` (categories) / one `GET /locations?limit=100` (locations) fetch per tab, transformed by a shared builder.

**Shared tree builder util** (`features/taxonomy/lib/buildTree.ts` — net-new):
```typescript
// Generic flat→nested builder. Parity port of legacy buildCategoryTree
// (frontend/.../categories/page.tsx:84-110), generalized over the parent-id
// field name because categories use `parent_category_id` but locations use
// `parent_location` (Backend Contract table — field-name divergence is a Pitfall).
export interface TreeNode<T> {
  node: T;
  children: TreeNode<T>[];
  depth: number;
}

export function buildTree<T extends { id: string; name: string }>(
  rows: T[],
  parentIdOf: (row: T) => string | null | undefined,
): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  rows.forEach((r) => byId.set(r.id, { node: r, children: [], depth: 0 }));

  const roots: TreeNode<T>[] = [];
  rows.forEach((r) => {
    const self = byId.get(r.id)!;
    const pid = parentIdOf(r);
    const parent = pid ? byId.get(pid) : undefined;
    if (parent) parent.children.push(self);
    else roots.push(self); // orphan (parent archived/missing) → surfaces at root
  });

  // depth + alphabetical sort per level (legacy sortTree)
  const walk = (nodes: TreeNode<T>[], depth: number) => {
    nodes.sort((a, b) => a.node.name.localeCompare(b.node.name));
    nodes.forEach((n) => {
      n.depth = depth;
      walk(n.children, depth + 1);
    });
  };
  walk(roots, 0);
  return roots;
}
// Call sites:
//   buildTree(categories, (c) => c.parent_category_id)
//   buildTree(locations,  (l) => l.parent_location)   // ⚠ NOT parent_location_id
```

**Recursive Tree atom** (`features/taxonomy/components/TaxonomyTree.tsx` — the central net-new component; lives in feature, NOT `components/retro/`, since CONTEXT says no retro tree exists and it is taxonomy-specific):
```typescript
export interface TaxonomyTreeProps<T extends { id: string; name: string }> {
  roots: TreeNode<T>[];
  /** sessionStorage namespace, e.g. "tax:categories" — keeps each tab's expand
   *  set independent (OQ5). */
  storageKey: string;
  /** Row action handlers — the page owns the dialogs; the tree only emits. */
  onAddChild: (parent: T) => void;
  onEdit: (node: T) => void;
  onArchive: (node: T) => void;     // categories/locations (TAX-02/04)
  renderMeta?: (node: T) => ReactNode; // e.g. archived badge
}
```
Internal state: `const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(storageKey));` where `loadExpanded`/`saveExpanded` read/write `sessionStorage.getItem(storageKey)` as a JSON string[]; persist in a `useEffect([expanded])`. A11y: mirror legacy `role="tree"` / `role="treeitem"` / `aria-expanded` / roving `tabIndex` (`frontend/.../categories/page.tsx:188-220`). Indentation by `node.depth`. **No sessionStorage precedent exists in frontend2** (verified `grep -rln sessionStorage src/` → none) so this util is genuinely new — write a tiny `safeSessionStorage` wrapper (try/catch for private-mode / quota).

**sessionStorage key scheme:** `tax:categories`, `tax:locations` (containers tab has no tree — it's a group-by accordion; if it gets collapse state use `tax:containers`). One key per tab so switching tabs preserves each independently.

---

### OQ2 — Archive usage-warning + Container delete cascade: **DB-level, not service-level** ✅

**THE KEY FINDING.** I read the Go service layer AND the FK migration. The backend does NOT implement cascade/usage logic in code — it relies on Postgres FK `ON DELETE` actions.

**Category archive (TAX-02 warning):**
- `category/service.go:163-171` `Archive()` calls `category.Archive()` (just sets `is_archived=true`, `entity.go:103-106`) then `repo.Save()`. **No item check, no error path. Archiving a category with assigned items ALWAYS succeeds (204).**
- There is **no usage-count field** on `CategoryResponse` (`handler.go:362-371`) and **no usage-count endpoint**.
- **To honor TAX-02's "usage warning,"** source the count client-side from the items list `total`: `GET /workspaces/{ws}/items?category_id={id}&limit=1` returns a paginated `{items,total,...}` (`item/handler.go:80,683-688` — `category_id` query filter exists; envelope confirmed by MSW fixture `handlers.ts:226`). Read `.total`. Show the warning in the archive confirm dialog **before** calling archive; archive proceeds regardless (the warning is advisory, matching the backend's permissive contract).

**Container delete (TAX-06 cascade):**
- `container/service.go:176-183` `Delete()` calls `repo.Delete()` directly. **No inventory check** (the `ErrHasInventory` sentinel in `container/errors.go:8` is DEAD CODE — referenced only in `errors.go` + `handler_test.go`, never in `service.go`).
- The "unassign-and-delete" is **automatic at the DB layer**: `inventory_container_fk FOREIGN KEY (workspace_id, container_id) REFERENCES warehouse.containers ... ON DELETE SET NULL (container_id)` (`db/migrations/001_initial_schema.sql:3048`). Deleting a container NULLs the `container_id` of any inventory pointing at it.
- **Therefore TAX-06 needs NO server flag, NO `?force=`, NO separate unassign call, NO confirm-then-retry.** A single `DELETE /containers/{id}` does it. The "unassign behavior (matches v2.2 cascade decision)" is satisfied by the FK.

**Category delete (for completeness, OQ6):** `items_category_fk ... ON DELETE SET NULL (category_id)` (`migration:3184`) — deleting a category NULLs assigned items' category. But `category/service.go:185-201` Delete() blocks if `HasChildren` → `ErrHasChildren` (`ErrConflict`) → handler maps to explicit **`409` "cannot delete category with child categories"** (`category/handler.go:260-262`). Parity uses archive, not delete, so this is informational.

**UX for TAX-02 (archive category):**
1. User clicks Archive on a tree row.
2. Open `RetroConfirmDialog`. On open, fire `GET /items?category_id={id}&limit=1`; if `total > 0` render: *"This category is assigned to {total} item(s). Archiving it will leave those items uncategorized. Continue?"* — else generic copy.
3. Confirm → `categoryApi.archive(ws, id)` → PREFIX-invalidate `["categories", ws]` → success toast.

**UX for TAX-06 (delete container):**
1. User clicks Delete on a container row.
2. `RetroConfirmDialog`: *"Delete '{name}'? Any inventory in this container will be unassigned (not deleted)."* (advisory — matches the FK SET NULL behavior).
3. Confirm → `containerApi.del(ws, id)` → PREFIX-invalidate `["containers", ws]` **and** `["inventory", ws]` (the cascade NULLs inventory.container_id, so stale inventory caches must refetch) → success toast.
4. Reactive backstop in `onError`: map any 409 to a conflict toast (defensive — current service can't 409 on container delete, but future-proofs).

**Citations:** `category/service.go:163-201`, `container/service.go:176-183`, `container/errors.go:8` (dead), `db/migrations/001_initial_schema.sql:3048,3064,3184`, `internal/api/middleware/errors.go:113-116` (`ErrConflict→409`).

---

### OQ3 — Label manager: **4th Taxonomy tab; HTML5 `<input type="color">` + hex text** ✅

**Evidence:**
- `lib/api/labels.ts:7-33` already ships `getItemLabelIds / attach / detach / listWorkspaceLabels` — but **NO create/update/archive/delete**. TAX-07 must **extend** it.
- Backend full CRUD exists: `label/handler.go` Create(57)/Update(100)/Archive(153)/Restore(184)/Delete(215). Color field is `*string` validated `pattern:"^#[0-9A-Fa-f]{6}$"` (`handler.go:280,293`), nullable.
- `Label` TS type (`lib/types.ts:182-189`) needs `is_archived`/`created_at`/`updated_at` added for the manager list.

**Decision:** Labels is the **4th `RetroTabs` tab** (not a separate `/labels` route) — keeps all taxonomy management in one surface, simpler routing, and TAX-07 is explicitly a Taxonomy-page deliverable (ROADMAP.md:693). Labels has no hierarchy → it's a flat `RetroTable` list (mirror BorrowersListPage) with create/edit via `RetroDialog`.

**Color picker:** Use native `<input type="color">` (zero-dep, always available) paired with a `RetroInput` text field for the hex value (so users can paste `#b73348` — the project's danger color, MEMORY). Validate with zod `.regex(/^#[0-9A-Fa-f]{6}$/)` to mirror the server pattern exactly. Render the color as a swatch in the list via `RetroBadge` or an inline `<span style={{background: color}}>`.

**Extend `labels.ts`** (append to the existing `labelsApi` object):
```typescript
// TAX-07 manager surface. Existing list/attach/detach (lines 7-33) unchanged.
export interface CreateLabelBody { name: string; color?: string; description?: string }
export type UpdateLabelBody = Partial<CreateLabelBody>;
// add to labelsApi:
  get: (ws, id) => get<Label>(`/workspaces/${ws}/labels/${id}`),
  create: (ws, body: CreateLabelBody) => post<Label>(`/workspaces/${ws}/labels`, body),
  update: (ws, id, body: UpdateLabelBody) => patch<Label>(`/workspaces/${ws}/labels/${id}`, body),
  archive: (ws, id) => post<void>(`/workspaces/${ws}/labels/${id}/archive`),
  restore: (ws, id) => post<void>(`/workspaces/${ws}/labels/${id}/restore`),
  del: (ws, id) => del<void>(`/workspaces/${ws}/labels/${id}`),
```

---

### OQ4 — Type-ahead pickers: **ship the component, use it ONLY in Taxonomy; leave shipped forms untouched** ✅

**Evidence:**
- `RetroCombobox` (`components/retro/form/RetroCombobox.tsx:38`) is a fully-shipped, a11y-correct (W3C list-autocomplete) editable combobox that client-filters a static `options: {value,label}[]` array. **The picker primitive already exists.**
- What's net-new is a **data hook** that backs it with `/search` instead of a static array.
- Shipped forms use `usePickerOptions.ts:42-98` — three `limit=100` reads mapped to **native `RetroSelect`** dropdowns (comment line 9-11: "NATIVE RetroSelects (CONTEXT locked): no type-ahead"). Retrofitting these is explicitly out of scope and risky.

**Decision:** Build a thin `useTaxonomySearch` hook + a `SearchPicker` wrapper that composes `RetroCombobox` with debounced `/search` results. Wire it into the **Taxonomy forms only** (the location-picker in the container create/edit form, and parent-location/parent-category pickers if the parent set could exceed 100). Do **NOT** touch InventoryFormPage / MoveDialog / ItemFormPage / `usePickerOptions`.

**Component API** (`features/taxonomy/components/SearchPicker.tsx`):
```typescript
export interface SearchPickerProps {
  label: ReactNode;
  value: string;                 // selected id (controlled, for RHF)
  onChange: (id: string) => void;
  /** "locations" | "containers" — selects the /search endpoint + query key. */
  domain: "locations" | "containers";
  error?: ReactNode;
  disabled?: boolean;
}
// Internally: useTaxonomySearch(domain, query) → debounced (250ms) useQuery keyed
// ["locations"|"containers", wsId, "search", query] calling
//   locationApi.search(ws, q) / containerApi.search(ws, q)   (limit clamped ≤100)
// mapped to RetroComboboxOption[] {value:id,label:name}; passed to <RetroCombobox/>.
// The /search routes return BARE { items } (Backend Contract) — .then(r=>r.items).
```
Low-risk: net-new files only, composes an already-tested primitive, never imports into shipped forms.

---

### OQ5 — Page/routes: **single `/taxonomy?tab=` route + RetroTabs + per-tab sessionStorage** ✅

**Evidence:**
- `RetroTabs` is **controlled** (`value`+`onChange`, `RetroTabs.tsx:36-49`) — ideal for binding to a URL search param.
- `useSearchParams` is the established tab/state round-trip idiom (10 shipped usages, e.g. `useBorrowersQuery.ts:40`, `BorrowersListPage.tsx:42`).
- `routes/index.tsx` is single-writer with literal-before-param discipline (lines 60-83).
- ItemDetailPage uses local `useState` for tabs (`ItemDetailPage.tsx:103`) — for Taxonomy prefer `?tab=` so tabs are deep-linkable/back-button-friendly (matches the "deep-link surface" convention in `useBorrowersQuery.ts:34`).

**Decision:** One route `<Route path="taxonomy" element={<TaxonomyPage />} />`. Inside, derive `const tab = params.get("tab") ?? "categories"` and `onChange={(id) => setSearchParams(prev => { const n = new URLSearchParams(prev); n.set("tab", id); return n; })}`. Four `RetroTab` panels: categories / locations / containers / labels. Expand state per-tab via the Tree atom's `storageKey` (OQ1).

**routes/index.tsx single-writer note:** Phase 10 adds exactly one literal route line. Because `taxonomy` has no `:id` param child, ordering is trivial — but per Lock #5, whichever plan owns `routes/index.tsx` must be the **only** plan in its wave that edits it, and the route stays a literal above the `*` wildcard. Add the import and the `<Route>` in the same single-writer plan.

---

### OQ6 — Archive vs delete: **categories/locations = archive (TAX-02/04); containers = delete (TAX-06); hard-delete for categories/locations is OUT of scope** ✅

**Evidence + decision:**
- Requirements text is explicit: TAX-02 "create/edit/**archive** categories" (REQUIREMENTS.md:117), TAX-04 "create/edit/**archive** locations" (line 120), TAX-06 "create/edit/**delete** containers" (line 121). → Archive for cat/loc, delete for containers. **Confirmed.**
- Backend supports both archive (`POST /{id}/archive` + `/restore`) and hard delete (`DELETE /{id}`) for all three. Archive is soft (`is_archived` flag, restorable); the entity getters expose `IsArchived()` (`category/entity.go:82`, `location/entity.go:80`, `container/entity.go:64`).
- **Location delete is dangerous and a reason to prefer archive:** `containers_location_fk ... ON DELETE CASCADE` (`migration:2936`) deletes child containers, while `inventory_location_fk ... ON DELETE RESTRICT` (`migration:3064`) makes Postgres **reject** the delete (→ unhandled DB error → 500) if any inventory references the location. So a location DELETE either silently nukes containers or 500s — **archive is the correct, safe parity action.** Do NOT expose hard-delete for locations.
- **Hard-delete for categories/locations is OUT of scope** for v3.0 parity (legacy `frontend/.../categories/page.tsx:554-560` used delete, but v3.0 requirements switched to archive, and the backend's archive/restore is the safer model). Containers correctly use delete (FK SET NULL handles inventory cleanly — OQ2).

**Restore:** Both cat/loc archive flows should pair with a restore affordance. Minimal parity: show archived rows muted with a RESTORE action (mirror items archive/restore in `handlers.ts:248-249`), OR a "show archived" toggle. Recommend a simple archived-badge + RESTORE button on archived tree rows (the tree already fetches the full list including archived, since `GET /categories` returns all).

---

## Architecture Patterns

### System Architecture Diagram (data flow)
```
                       ┌────────────────────────── TaxonomyPage (/taxonomy?tab=) ──────────────────────────┐
  URL ?tab=  ─────────▶│  useSearchParams → tab  ──▶  RetroTabs (controlled value/onChange)                 │
                       │     │                                                                              │
                       │     ├─ tab=categories ─▶ useCategoriesQuery ─▶ GET /categories (BARE {items})      │
                       │     │                         │                                                    │
                       │     │                    buildTree(rows, c=>c.parent_category_id) ─▶ TaxonomyTree  │
                       │     │                         │            (sessionStorage "tax:categories")       │
                       │     │                    row actions ─▶ create/edit RetroDialog (RHF+zod)          │
                       │     │                                 ─▶ archive RetroConfirmDialog                │
                       │     │                                       └─▶ GET /items?category_id=&limit=1    │
                       │     │                                            (warning count — OQ2)             │
                       │     ├─ tab=locations ──▶ useLocationsQuery ─▶ GET /locations?limit=100 (paginated) │
                       │     │                    buildTree(rows, l=>l.parent_location) ─▶ TaxonomyTree     │
                       │     ├─ tab=containers ─▶ useContainersQuery ─▶ GET /containers?limit=100           │
                       │     │                    group-by location_id ─▶ accordion list (TAX-05)           │
                       │     │                    form: SearchPicker(domain="locations") ─▶ /locations/search│
                       │     └─ tab=labels ─────▶ useLabelsQuery ─▶ GET /labels (BARE {items})              │
                       │                          RetroTable + RetroDialog (name + <input type=color>)      │
                       │                                                                                    │
                       │  All mutations ─▶ use{Domain}Mutations ─▶ {domain}Api ─▶ lib/api request()         │
                       │                    onSuccess: qc.invalidateQueries(["<domain>", ws]) PREFIX        │
                       │                    onError:  retroToast + HttpError status mapping                 │
                       └────────────────────────────────────────────────────────────────────────────────────┘
                                                          │ /api proxy (vite rewrite) → :8080
                                                          ▼  Huma handlers ─▶ svc ─▶ repo ─▶ Postgres
                                                             (delete cascade = FK ON DELETE, not Go code)
```

### Recommended Project Structure
```
frontend2/src/
├── lib/api/
│   ├── category.ts          # net-new (mirror borrowers.ts)
│   ├── location.ts          # net-new
│   ├── container.ts         # net-new
│   └── labels.ts            # EXTEND (add get/create/update/archive/restore/del)
├── features/taxonomy/       # net-new feature dir
│   ├── TaxonomyPage.tsx     # ?tab= + RetroTabs shell (single owner of the route)
│   ├── lib/buildTree.ts     # flat→nested builder (shared cat+loc)
│   ├── components/
│   │   ├── TaxonomyTree.tsx # recursive Tree atom (sessionStorage expand)
│   │   ├── SearchPicker.tsx # RetroCombobox + /search hook (OQ4)
│   │   ├── CategoriesTab.tsx / LocationsTab.tsx / ContainersTab.tsx / LabelsTab.tsx
│   │   └── *FormDialog.tsx  # per-domain create/edit RetroDialog forms
│   ├── hooks/
│   │   ├── useCategoriesQuery.ts / useLocationsQuery.ts / useContainersQuery.ts / useLabelsQuery.ts
│   │   ├── use{Domain}Mutations.ts (×4)
│   │   └── useTaxonomySearch.ts
│   └── schema.ts            # zod schemas (mirror borrowers/schema.ts)
└── test/msw/handlers.ts     # ADD taxonomy handlers (single-writer)
```

### Pattern 1: api module (mirror `lib/api/borrowers.ts`)
```typescript
// lib/api/category.ts — BARE {items} list (Pitfall 2). No item_count on Category.
import { get, post, patch, del } from "@/lib/api";
const MAX_LIMIT = 100;
export interface Category {
  id: string; workspace_id: string; name: string;
  parent_category_id?: string; description?: string;
  is_archived: boolean; created_at: string; updated_at: string;
}
export interface CreateCategoryBody { name: string; parent_category_id?: string; description?: string }
export type UpdateCategoryBody = Partial<CreateCategoryBody>;
export const categoryApi = {
  list: (ws: string) => get<{ items: Category[] }>(`/workspaces/${ws}/categories`),
  get: (ws: string, id: string) => get<Category>(`/workspaces/${ws}/categories/${id}`),
  create: (ws: string, b: CreateCategoryBody) => post<Category>(`/workspaces/${ws}/categories`, b),
  update: (ws: string, id: string, b: UpdateCategoryBody) => patch<Category>(`/workspaces/${ws}/categories/${id}`, b),
  archive: (ws: string, id: string) => post<void>(`/workspaces/${ws}/categories/${id}/archive`),
  restore: (ws: string, id: string) => post<void>(`/workspaces/${ws}/categories/${id}/restore`),
  del: (ws: string, id: string) => del<void>(`/workspaces/${ws}/categories/${id}`),
};
// location.ts: list is PAGINATED → list returns {items,total,page,total_pages};
//   for the tree, fetch ?limit=100 and read .items. parent field = `parent_location`.
//   add search: (ws,q,limit=100) => get<{items:Location[]}>(`/workspaces/${ws}/locations/search?q=${encodeURIComponent(q)}&limit=${Math.min(limit,MAX_LIMIT)}`).then(r=>r.items)
// container.ts: same as location (paginated list + search), body has location_id.
```

### Pattern 2: query hook with prefix key (mirror `useBorrowersQuery.ts`)
```typescript
// useCategoriesQuery.ts
export function useCategoriesQuery() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const query = useQuery({
    queryKey: ["categories", wsId],            // PREFIX (Lock #4) — no extra keys needed
    queryFn: () => categoryApi.list(wsId as string).then((r) => r.items),
    enabled: !!wsId,
    retry: false,
  });
  const tree = useMemo(
    () => buildTree(query.data ?? [], (c) => c.parent_category_id),
    [query.data],
  );
  return { rows: query.data ?? [], tree, isLoading: query.isLoading, isError: query.isError };
}
```

### Pattern 3: mutations hook (mirror `useBorrowerMutations.ts` — render-loop safe)
```typescript
export function useCategoryMutations() {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const qc = useQueryClient();
  const { t } = useLingui();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories", wsId as string] }); // PREFIX, no exact
  const create  = useMutation({ mutationFn: (b: CreateCategoryBody) => categoryApi.create(wsId as string, b),
    onSuccess: () => { invalidate(); retroToast.success(t`Category created.`); },
    onError: () => retroToast.error(t`Couldn't save this category.`) });
  // update / archive / restore identical shape. Consuming page destructures `.mutate`.
  return { create, /* update, archive, restore */ };
}
// Container del additionally invalidates ["inventory", ws] (FK SET NULL cascade — OQ2).
```

### Anti-Patterns to Avoid
- **Reading `.total` from categories/labels/search responses** — they're BARE `{items}` (Pitfall 2). Only locations/containers/items LIST routes carry `total`.
- **Using `parent_location_id` for locations** — the field is `parent_location` (Backend Contract ⚠).
- **Putting the Tree atom in `components/retro/`** — it's taxonomy-specific; keep it in `features/taxonomy/components/`.
- **Adding a `?force` param or second unassign call for container delete** — the DB FK already SET NULLs inventory (OQ2).
- **Hard-deleting locations** — `ON DELETE CASCADE`/`RESTRICT` asymmetry; use archive (OQ6).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-ahead combobox | Custom autocomplete | `RetroCombobox` (`form/RetroCombobox.tsx:38`) | a11y W3C pattern + ESC stack already solved |
| Tab shell | Custom tabs | `RetroTabs` (`data/RetroTabs.tsx:36`) | roving tabindex + ARIA done; controlled |
| Confirm dialog | Custom modal | `RetroConfirmDialog` / `RetroDialog` (`overlay/*`) | escStack integration |
| HTTP + 401 refresh + cookie | New fetch wrapper | `get/post/patch/del/put` (`lib/api.ts`) | single-flight refresh, credentials locked |
| Error→toast status mapping | Parse strings | `err instanceof HttpError && err.status === N` (`lib/api.ts:24`) | typed status from backend |
| Color picker | Custom HSL wheel | `<input type="color">` + hex `RetroInput` | native, zero-dep, matches `^#[0-9A-Fa-f]{6}$` |
| Flat→tree | Recursive fetch | client `buildTree` util | legacy parity, one fetch, sortable/searchable |

**Key insight:** Phase 10 is ~95% composition of shipped primitives. The only genuinely net-new logic is `buildTree` (a 30-line port of legacy) and the sessionStorage expand persistence (no precedent in frontend2 — needs a try/catch-wrapped helper).

## Common Pitfalls

### Pitfall 1: Render loop from non-stable `t` (CONTEXT Lock #3 — hit 4× in prior phases)
**What goes wrong:** `useLingui()`'s `t` is recreated each render; using it in a `useMemo`/`useCallback`/`useEffect` dep array re-fires forever.
**How to avoid:** `const tRef = useRef(t); tRef.current = t;` then use `tRef.current` inside memo'd closures (e.g. shortcut bindings). Destructure mutation `.mutate` (stable), never pass the whole mutation object into deps. Mirror `BorrowersListPage.tsx:36-66` exactly.
**Warning signs:** "Maximum update depth exceeded"; test timeouts.

### Pitfall 2: Envelope mismatch (CONTEXT Lock #2)
**What goes wrong:** Reading `.total` from a BARE `{items}` response (categories/labels/search) → `undefined` → NaN pagination.
**How to avoid:** Type list returns precisely per the Backend Contract table. Categories/labels/all-`/search` = `{items}`; locations/containers LIST = `{items,total,page,total_pages}`. Make `.total` a **type error** where it shouldn't exist (borrowers.ts comment line 5-7 is the model).

### Pitfall 3: `limit` > 100 → 422 (CONTEXT Lock #1)
**How to avoid:** `Math.min(limit, 100)` on every list/search read (borrowers.ts `MAX_LIMIT`). Tree fetches use exactly `limit=100` for locations/containers; categories list has no limit param (returns all).

### Pitfall 4: Query-key prefix discipline (CONTEXT Lock #4)
**What goes wrong:** Keys like `["categoriesTree", ws]` won't be covered by `["categories", ws]` PREFIX invalidation → stale tree after mutation.
**How to avoid:** Every key starts `["categories"|"locations"|"containers"|"labels", wsId, ...]`. Mutations invalidate the bare prefix (no `exact:true`). Container delete ALSO invalidates `["inventory", ws]` (cascade).

### Pitfall 5: `routes/index.tsx` concurrent edits (CONTEXT Lock #5/#7)
**What goes wrong:** Two same-wave plans both edit `routes/index.tsx` → merge conflict (Phase-8/9 lesson).
**How to avoid:** Exactly one plan owns the route addition; it's in a wave where no sibling touches that file. Literal route, above `*`.

### Pitfall 6: location parent field name
**What goes wrong:** `parent_location_id` (categories' convention) used for locations → silent no-op nesting (all rows become roots).
**How to avoid:** `buildTree(locations, (l) => l.parent_location)`. Add a TS interface that has `parent_location` (no `_id`) so a typo is a compile error.

### Pitfall 7: orphan rows when parents are archived
**What goes wrong:** `GET /categories` returns all (incl. archived); a child whose parent is archived still has a `parent_category_id`. If the tree hides archived parents, the child vanishes.
**How to avoid:** `buildTree` pushes a node whose parent isn't in the map to `roots` (the builder above already does this) — orphans surface at root level rather than disappearing.

## Runtime State Inventory

Greenfield frontend feature (net-new files + one route + MSW additions). No rename/refactor/migration. **N/A — omitted per spec.**

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 (unit, jsdom + msw) + @playwright/test 1.59.1 (E2E) |
| Config | `frontend2/vitest` (via `package.json` `"test": "vitest run"`), `playwright.config.ts` |
| Quick run | `cd frontend2 && bun run test -- src/features/taxonomy` |
| Full suite | `cd frontend2 && bun run test` |
| E2E | `cd frontend2 && bun run test:e2e` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|-------------|
| TAX-01 | tree builds + expand persists | unit | `vitest run src/features/taxonomy/lib/buildTree.test.ts` + `TaxonomyTree.test.tsx` | ❌ Wave 0 |
| TAX-02 | archive category fires warning fetch when items assigned | unit | `vitest run src/features/taxonomy/hooks/useCategoryMutations.test.tsx` | ❌ Wave 0 |
| TAX-03 | locations tree (`parent_location`) | unit | buildTree.test.ts (location case) | ❌ Wave 0 |
| TAX-04 | archive location | unit | `useLocationMutations.test.tsx` | ❌ Wave 0 |
| TAX-05 | containers group-by-location | unit | `ContainersTab.test.tsx` | ❌ Wave 0 |
| TAX-06 | delete container invalidates inventory | unit | `useContainerMutations.test.tsx` | ❌ Wave 0 |
| TAX-07 | label CRUD + color validation | unit | `LabelsTab.test.tsx` + `schema.test.ts` | ❌ Wave 0 |
| TAX-01/03/05 | tab switch via ?tab= renders right panel | unit | `TaxonomyPage.test.tsx` | ❌ Wave 0 |
| TAX-01..07 | smoke: page loads all tabs against real backend | E2E | `e2e/taxonomy.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run src/features/taxonomy` (+ `src/lib/api/category.test.ts` etc.)
- **Per wave merge:** `bun run test` (full unit suite green)
- **Phase gate:** full unit suite + `taxonomy.spec.ts` E2E green before `/gsd:verify-work`. (Note CLAUDE.md: E2E full-suite has an auth rate-limit constraint — run the taxonomy spec in isolation.)

### Wave 0 Gaps
- [ ] MSW handlers for `/categories*`, `/locations*`, `/containers*`, label CRUD, `/items?category_id=` (single-writer addition to `src/test/msw/handlers.ts`) — fixtures must use BARE `{items}` for categories/labels/search and `{items,total,page,total_pages}` for locations/containers (Pitfall 2).
- [ ] `buildTree.test.ts` (nesting, orphan-at-root, sort, both parent-field variants).
- [ ] Test files per the map above.
- *(No framework install needed — vitest/msw/playwright all present.)*

## Security Domain

> `security_enforcement` not set in config → treated as enabled. Frontend-only phase against an already-authenticated, workspace-scoped API; no new auth/crypto surface.

### Applicable ASVS Categories
| ASVS | Applies | Standard Control |
|------|---------|-----------------|
| V2 Authentication | no (reuses cookie-JWT) | `lib/api.ts` credentials:"include" + 401 refresh (locked) |
| V4 Access Control | yes (tenant scope) | every call is `/workspaces/{wsId}/…`; backend enforces workspace_id in repo WHERE clauses (cross-tenant 404 guard, CLAUDE.md Pitfall #5) |
| V5 Input Validation | yes | zod schemas mirror server constraints (name 1..255; color `^#[0-9A-Fa-f]{6}$`; short_code `^[A-Za-z0-9]{4,8}$`) |
| V6 Cryptography | no | none introduced |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Cross-tenant taxonomy read/write | Information Disclosure / Tampering | All requests carry `wsId` from `useWorkspace()`; backend repos scope by workspace_id (verified in prior phases) |
| Stale cache after FK cascade (container delete NULLs inventory) | Tampering (data integrity in UI) | Invalidate BOTH `["containers",ws]` and `["inventory",ws]` on container delete (OQ2) |
| XSS via label/category name | Tampering | React escapes by default; never `dangerouslySetInnerHTML`; color is pattern-validated before use in `style` |

## Likely Plan Split (disjoint files for parallelism)

| Wave | Plan | Owns (disjoint files) | Notes |
|------|------|------------------------|-------|
| **W1 (foundation)** | 10-01 | `lib/api/category.ts`, `location.ts`, `container.ts`, extend `labels.ts`; `features/taxonomy/lib/buildTree.ts` + test; **`src/test/msw/handlers.ts`** (single-writer); `features/taxonomy/schema.ts` | api modules + tree util + MSW. The Tree atom (`TaxonomyTree.tsx`) can also land here as a leaf component with its own tests. |
| **W2 (page+categories)** | 10-02 | `TaxonomyPage.tsx`, `components/CategoriesTab.tsx`, `hooks/useCategoriesQuery.ts`, `useCategoryMutations.ts`, `CategoryFormDialog.tsx`; **`routes/index.tsx`** (single-writer this wave) | Page shell + first tab proves the tree + archive-warning flow end to end. |
| **W3 (locations+containers)** | 10-03 | `components/LocationsTab.tsx`, `ContainersTab.tsx`, `SearchPicker.tsx`, `hooks/useLocationsQuery.ts`, `useLocationMutations.ts`, `useContainersQuery.ts`, `useContainerMutations.ts`, `useTaxonomySearch.ts`, `Location/ContainerFormDialog.tsx` | Reuses Tree atom + buildTree. Container delete→inventory invalidation. Type-ahead picker. **Must NOT touch routes/index.tsx or handlers.ts** (W2/W1 owned). |
| **W3 (labels)** | 10-04 | `components/LabelsTab.tsx`, `hooks/useLabelsQuery.ts`, `useLabelMutations.ts`, `LabelFormDialog.tsx` | Disjoint from 10-03 (different files, same wave OK per Lock #7). Color picker. |
| **W4 (E2E)** | 10-05 | `frontend2/e2e/taxonomy.spec.ts` | Real backend smoke across all 4 tabs. |

**Single-writer files:** `src/test/msw/handlers.ts` (W1 only), `routes/index.tsx` (W2 only). No other wave edits them.

## Sources

### Primary (HIGH confidence — read this session)
- Backend services: `backend/internal/domain/warehouse/{category,location,container,label}/service.go`, `entity.go`, `errors.go`, `handler.go`
- FK cascade truth: `backend/db/migrations/001_initial_schema.sql:2936,3048,3064,3184`
- Error mapping: `backend/internal/api/middleware/errors.go:69-122`
- Items category filter: `backend/internal/domain/warehouse/item/handler.go:80,683-688`
- Frontend primitives: `frontend2/src/components/retro/{data/RetroTabs.tsx,form/RetroCombobox.tsx,overlay/*}`, `lib/api.ts`
- Parity patterns: `frontend2/src/lib/api/{borrowers,loans,labels}.ts`, `features/borrowers/{BorrowersListPage.tsx,hooks/*}`, `features/inventory/hooks/usePickerOptions.ts`
- MSW conventions: `frontend2/src/test/msw/handlers.ts`
- Legacy parity reference: `frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx:78-110` (`buildCategoryTree`)
- Requirements: `.planning/REQUIREMENTS.md:116-121,266`; `.planning/phases/10-taxonomy/10-CONTEXT.md`

### Secondary / Tertiary
- None — all claims sourced from primary codebase reads.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all primitives verified present in repo.
- Backend contract / cascade (OQ2): HIGH — read from Go source + migration FK definitions directly (overturned a CONTEXT assumption).
- Architecture / OQ resolutions: HIGH — every decision backed by shipped parity code or backend source with file:line.
- Pitfalls: HIGH — carried from prior-phase locks, each cross-checked against shipped pages.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable internal codebase; re-verify backend contract only if migrations/services change)
