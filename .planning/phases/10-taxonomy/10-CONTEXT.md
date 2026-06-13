# Phase 10 — Taxonomy — CONTEXT

**Goal:** A Taxonomy page with tabs for hierarchical **categories** (tree, expand/collapse →
sessionStorage), hierarchical **locations** (tree), **containers** (grouped by location), plus
a **label manager** (TAX-07 parity add) and the location/container **type-ahead pickers**
(parity add). CRUD + archive (categories/locations) / delete-with-unassign-cascade (containers).

**Requirements:** TAX-01..07. **Depends on:** Phase 4, Phase 6 (both done). **UI phase:** yes.
**Plans (roadmap):** TBD — biggest phase so far; expect 4-5 plans across 3-4 waves.

## What already exists (REUSE)
- `frontend2/src/lib/api/labels.ts` — labels API already shipped (Phase 7 label-attach). TAX-07
  manager EXTENDS/consumes it; check its current surface (list/get/create/update/del/archive).
- `frontend2/src/components/retro/data/RetroTabs.tsx` — the 3/4-tab shell (ItemDetailPage uses it).
- `frontend2/src/features/inventory/hooks/usePickerOptions.ts` — already reads
  `/workspaces/{ws}/locations?limit=100` and `/containers?limit=100` via generic `get`
  (NamedRow). Item/inventory forms consume it. The type-ahead picker parity-add must NOT
  destabilize these shipped forms (see OQ4).
- `RetroBadge`, `Window`, `RetroInput`, `BevelButton`, `RetroConfirmDialog`, FilterBar,
  `retroToast`, `HttpError` mapping (`lib/api.ts`), the form RHF+zod pattern (InventoryFormPage).
- Mirror list/detail/form patterns from items/inventory/borrowers phases.

## What must be BUILT
- `lib/api/category.ts`, `lib/api/location.ts`, `lib/api/container.ts` (label.ts exists).
- A **recursive Tree atom** — NONE exists in `components/retro/`. Needs: expand/collapse,
  sessionStorage persistence of expanded-set (per tab), row actions (add-child/edit/archive),
  indentation, keyboard a11y. This is the central net-new component.
- A flat-list → tree builder util (parent_id → nested), shared by categories + locations.
- The **Taxonomy page** with tabs: Categories / Locations / Containers (+ Labels? — OQ3).
- Label manager (CRUD list + color picker — TAX-07).
- Type-ahead picker component backed by `/locations/search` + `/containers/search` (parity add).

## Backend surface (verified 2026-06-13, all under `/workspaces/{wsId}`)
- **categories**: `GET /categories` (full list), `GET /categories/root`, `GET /categories/{id}`,
  `GET /categories/{id}/children`, `GET /categories/{id}/breadcrumb`, `POST /categories`,
  `PATCH /categories/{id}`, `POST /categories/{id}/archive`, `POST /{id}/restore`,
  `DELETE /categories/{id}`. (Tree built client-side from the flat `GET /categories` list +
  parent_id, OR via root+children lazy — resolve in research.)
- **locations**: `GET /locations`, `GET /{id}`, `GET /{id}/breadcrumb`, `GET /locations/search`,
  `POST`, `PATCH /{id}`, `POST /{id}/archive`, `POST /{id}/restore`, `DELETE /{id}`.
- **containers**: `GET /containers`, `GET /{id}`, `GET /containers/search`, `POST`,
  `PATCH /{id}`, `POST /{id}/archive`, `POST /{id}/restore`, `DELETE /{id}`. Containers are
  flat with a `location_id` → "grouped by location" is a client group-by (TAX-05).
- **labels**: `GET /labels`, `GET /{id}`, `POST`, `PATCH /{id}`, `POST /{id}/archive`,
  `POST /{id}/restore`, `DELETE /{id}`.
- Archive/delete logic (usage warnings, cascade) lives in the Go SERVICE layer
  (`svc.Archive`/`svc.Delete` → `MapDomainError`). The HTTP status/message for
  "archive category with assigned items" and "delete container with assigned items" must be
  read from the service + error mapping — RESEARCH must determine the exact contract.

## Binding constraints / carry-forward (from prior phases)
1. `limit` caps 100 (422 over) — clamp every list read ≤100.
2. List envelopes are bare `{items}` (no total) on most domains — confirm per endpoint; client-paginate/group, never read `total` unless the endpoint returns it.
3. RENDER-LOOP landmine — `t` via tRef, destructure `.mutate`; mirror shipped pages.
4. Query-key prefixes `["categories"|"locations"|"containers"|"labels", wsId, ...]` (SSE).
5. routes/index.tsx single-writer/serialize across plans (Phase-8/9 lesson); literal-before-param.
6. Declare EVERY edited file in files_modified (no hidden callsite edits — Phase-8 lesson).
7. Same-wave plans MUST have disjoint files_modified.

## Open Questions (RESOLVED — phase-researcher + ui-researcher, 2026-06-13)
- **OQ1 tree → CLIENT buildTree from flat `GET /categories` / `GET /locations`** (legacy
  parity `buildCategoryTree`). Generic `buildTree(rows, parentIdOf)` util. **FIELD-NAME PITFALL:**
  categories use `parent_category_id`, locations use `parent_location` — different keys.
  Net-new `RetroTree` atom (no tree precedent) + per-tab sessionStorage key `taxonomy:tree:<tab>`.
- **OQ2 → NO server usage-warning/cascade logic exists** (read category/service.go:163-201,
  container/service.go:176-183, FK migration). **Archive ALWAYS succeeds** server-side (no item
  check). The TAX-02 usage-warning is **CLIENT-computed**: before archiving a category, read
  `GET /items?category_id={id}&limit=1` → `total`; if >0 show the warning-count confirm. No
  `?force=`, no second call.
- **OQ2 (container) / TAX-06 → plain `DELETE /containers/{id}`** does the unassign: Postgres
  `inventory_container_fk` is `ON DELETE SET NULL` (auto-unassign). Confirm dialog warns
  "will unassign from N items" (N client-counted via `GET /inventory?container_id={id}&limit=1`
  total, or items) — but the call is a bare DELETE, NO flag/force/second call. `ErrHasInventory`
  is dead code.
- **OQ6 / TAX-04 → locations use ARCHIVE, never DELETE.** `containers.location_id` is
  `ON DELETE CASCADE` (delete nukes child containers) and `inventory.location_id` is
  `ON DELETE RESTRICT` (→ 500). So TAX-02/04 = archive (soft+restore); TAX-06 (containers) = delete.
- **Envelope split is PER-ENDPOINT** (refines constraint 2): categories + labels + ALL `/search`
  = bare `{items}`; locations + containers + items LIST = paginated `{items,total,page,total_pages}`.
  Read `total` ONLY where present.
- **OQ4 → `RetroCombobox` already shipped** (W3C list-autocomplete). Build a `/search`-backed
  data hook (`useTaxonomySearch`) used in Taxonomy ONLY; shipped item/inventory/loan forms
  (usePickerOptions native selects, limit=100) stay UNTOUCHED.
- **OQ3 → labels = 4th `?tab=labels`** (not a separate route); color = fixed 8-swatch
  on-palette set (store hex), not a free color input.
- **OQ5 → single `/taxonomy` route + `?tab=`** (LoansListPage pattern); create/edit forms =
  dedicated literal-before-param routes; label form = inline RetroDialog.

## Original Open Questions (now resolved above)
- OQ1 **Tree build**: client-build from flat `GET /categories` (+parent_id) vs lazy root+children.
  Which scales + matches legacy? Specify the Tree atom API + sessionStorage key scheme.
- OQ2 **Category archive usage-warning** + **Container delete cascade**: what exact HTTP
  response does the backend give when archiving a category with assigned items / deleting a
  container with assigned items? Is "unassign-and-delete" a server flag/param, a second call,
  or a client-confirm-then-force? Define the UX + the exact API calls (TAX-02, TAX-06).
- OQ3 **Label manager placement**: a 4th Taxonomy tab vs a separate `/labels` route. And the
  color-picker approach (the labels API color field shape).
- OQ4 **Type-ahead pickers scope**: ship the picker COMPONENT (backed by /search) and wire it
  into the Taxonomy forms only, OR also retrofit the already-shipped item/inventory/loan forms
  (RISK — they use usePickerOptions limit=100 dropdowns). Recommend: ship the component +
  use it in Taxonomy; leave shipped forms untouched unless trivial. Confirm against legacy.
- OQ5 **Page structure / routes**: `/taxonomy?tab=` single route with RetroTabs vs nested
  routes per tab. Expand/collapse state per-tab in sessionStorage.
- OQ6 **archive vs delete semantics**: categories/locations use ARCHIVE (soft, restore exists);
  containers use DELETE (with cascade). Confirm TAX-02/04 are archive (not hard-delete) and
  TAX-06 is delete. Is there a hard-delete for categories/locations too (DELETE endpoints exist)?
