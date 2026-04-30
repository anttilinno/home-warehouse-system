# Phase 58: Taxonomy — Categories, Locations, Containers — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Taxonomy management section: a single `/taxonomy` page with three tabs (Categories, Locations, Containers). Categories and Locations render as hierarchical trees with full CRUD. Containers render as a flat list grouped by location. All create/edit flows use a slide-over panel. Delete/archive uses an archive-first confirm dialog with hard-delete as a secondary action. No user-facing features outside the Taxonomy page — no sidebar wiring (Phase 63).

</domain>

<decisions>
## Implementation Decisions

### Page Structure
- **D-01:** Single `/taxonomy` route with `RetroTabs` — three tabs: **Categories**, **Locations**, **Containers**. Active tab persists in the URL hash (`#categories`, `#locations`, `#containers`). Phase 63 sidebar links to `/taxonomy` and the URL hash preserves context. No separate routes for each entity type.

### Tree Data Fetching
- **D-02:** Fetch-all-and-build strategy for categories and locations. Use the flat `/categories` and `/locations` list endpoints (all nodes, not paginated) and build the tree client-side. Home inventory taxonomy is small (<100 nodes realistically), so lazy per-node child fetching adds complexity with no benefit. The `/categories/root` and `/categories/{id}/children` endpoints exist but are NOT used for the initial tree render.

### Create/Edit Interaction
- **D-03:** Slide-over panel for all create and edit operations. The tree stays visible in the background while the panel is open on the right. One panel component reused for create (empty form) and edit (pre-filled form). The panel is dismissed on successful save or explicit cancel. The parent picker (RetroCombobox, async) searches existing nodes inline within the panel.

### Archive/Delete Flow
- **D-04:** **Archive-first** confirm dialog:
  - Primary action: **ARCHIVE** (amber `RetroButton variant="primary"`) — soft-archives the node, reversible via a Restore action on archived nodes
  - Secondary action: small `delete permanently` text link below the buttons — triggers a second, danger-styled confirm dialog before hard-delete
  - **409 on category with children:** Surfaces as an error toast ("Move or delete child nodes first") — no confirm dialog is shown in this case
  - **Archived nodes:** Shown in the tree with a visual indicator (muted/strikethrough style, retro badge "ARCHIVED"). A **Restore** action is available on archived nodes.
  - The backend's `/archive`, `/restore`, and `DELETE` endpoints map to these three actions respectively.
  - No item-count display — the backend does not expose item assignment counts on taxonomy nodes. The dialog copy explains what archiving does ("hides from item pickers") without a count.

### Container & Location short_code
- **D-05:** `short_code` is shown as an **optional, user-editable field** in the create/edit form for both containers and locations. It is auto-populated from the name (first 3 chars uppercase + auto-suffix) when the user types the name, but the user can override it. This supports QR/label printing workflows where the short code gets printed on physical storage containers. The `short_code` field is omitted from the category form (categories don't have a short code).

### Claude's Discretion
- Tree node expand/collapse state management (local component state is fine)
- Slide-over panel implementation (custom div with CSS transition or RetroDialog extended — whichever fits the retro aesthetic)
- Auto-population logic for short_code (e.g., debounced derivation from name input)
- Whether archived nodes appear inline in the tree (collapsed by default) or in a separate "Archived" section at the bottom of the tree
- Query invalidation strategy after mutations (invalidate the entity's `all` key)
- Plan batching strategy (researcher/planner decide)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing API Modules (Phase 56)
- `frontend2/src/lib/api/categories.ts` — Category types, CRUD functions, `/archive`, `/restore`, `/root`, `/children`, `breadcrumb` endpoints already typed
- `frontend2/src/lib/api/locations.ts` — Location types, CRUD functions, `breadcrumb`, `search` endpoints
- `frontend2/src/lib/api/containers.ts` — Container types, CRUD functions (paginated list with `location_id` filter param)
- `frontend2/src/lib/api/index.ts` — Barrel re-exports; query key factories must be confirmed or added here

### Retro Component Library (Phase 57)
- `frontend2/src/components/retro/RetroTabs.tsx` — Tab component; use for the 3-tab page structure
- `frontend2/src/components/retro/RetroFormField.tsx` — `Controller`-for-all form field wrapper; use for every field in the slide-over forms
- `frontend2/src/components/retro/RetroCombobox.tsx` — Async combobox for parent category/location picker and container location picker
- `frontend2/src/components/retro/RetroConfirmDialog.tsx` — Use for archive confirm and hard-delete confirm dialogs
- `frontend2/src/components/retro/RetroEmptyState.tsx` — Use when a tree/list has no nodes
- `frontend2/src/components/retro/index.ts` — Barrel; all retro imports must come from here

### Auth & Data Fetching Foundation (Phase 56)
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth().workspaceId` for building API URLs in hooks
- `frontend2/src/lib/api.ts` — `get`, `post`, `patch`, `del` helpers used by entity API modules

### Backend Handlers (for verifying API shapes)
- `backend/internal/domain/warehouse/category/handler.go` — Category endpoints incl. 409 on delete-with-children
- `backend/internal/domain/warehouse/location/handler.go` — Location endpoints
- `backend/internal/domain/warehouse/container/handler.go` — Container endpoints (paginated list, location_id filter)

### Router
- `frontend2/src/routes/index.tsx` — Add `/taxonomy` route here

### Project Context
- `.planning/REQUIREMENTS.md` — TAX-01 through TAX-12 acceptance criteria
- `.planning/phases/56-foundation-api-client-and-react-query/56-CONTEXT.md` — Query key factory pattern (D-03), workspace ID threading (D-01)
- `.planning/phases/57-retro-form-primitives/57-CONTEXT.md` — RetroFormField Controller-for-all pattern (D-03), retro component constraints

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RetroTabs.tsx` — Direct reuse for Categories/Locations/Containers tab switcher; has overflow-x scroll for mobile (fixed in Phase 57)
- `RetroCombobox.tsx` — Async parent picker; can use `categoriesApi.list()` / `locationsApi.list()` as data source
- `RetroConfirmDialog.tsx` — Extend or reuse for the archive-first dialog; has `HazardStripe` header for destructive variant
- `RetroEmptyState.tsx` — Empty tree state ("No categories yet. Add your first one.")
- `RetroFormField.tsx` — `Controller` wrapping for all form fields

### Established Patterns
- All hooks read `workspaceId` from `useAuth()` — do not pass as prop
- TanStack Query per-entity mutation hooks invalidate `entityKeys.all` after mutations
- Lingui `t` macro for all user-visible strings (mandatory)
- `font-mono` for short codes, tree node names; `font-sans` for labels
- All interactive controls: `min-height: 44px` touch targets

### Backend API Shape Notes
- Categories: flat list via `/categories` (all), tree must be built client-side. No `item_count` in `CategoryResponse`.
- Containers: paginated (`page`, `limit`), filterable by `location_id`. Has `short_code` and `capacity` fields.
- Locations: paginated, has `short_code`. `parent_location` field (string, not UUID — verify in handler before typing).
- Delete semantics: Category 409 on children; location/container delete has no blocking.

### Integration Points
- `frontend2/src/routes/index.tsx` — Add `/taxonomy` route
- `frontend2/src/components/retro/index.ts` — No new primitives added; consume existing barrel
- Query key factories in `lib/api/` — Ensure `categoryKeys`, `locationKeys`, `containerKeys` are exported

</code_context>

<specifics>
## Specific Details

- URL hash for tab persistence: `/taxonomy#categories`, `/taxonomy#locations`, `/taxonomy#containers` — default to `#categories` if no hash
- Archive-first dialog copy: "This will hide '[Name]' from item pickers. You can restore it later." — no item count
- Category hard-delete secondary link copy: "delete permanently" (lowercase, small text below primary button)
- 409 toast copy: "Move or delete child nodes first." (for categories with children)
- short_code auto-fill rule: uppercase first 3 chars of name + generated suffix (e.g., "Garage Shelf 1" → "GAR-{auto}"); user can fully override
- Location `parent_location` field: verify whether API accepts a UUID or string — check `locations.ts` `CreateLocationInput.parent_location?: string` vs handler

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 58-taxonomy-categories-locations-containers*
*Context gathered: 2026-04-16*
