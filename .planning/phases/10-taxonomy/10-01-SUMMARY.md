---
phase: 10-taxonomy
plan: 01
subsystem: ui
tags: [react, taxonomy, tree, sessionstorage, zod, msw, tanstack-query, api-modules]

# Dependency graph
requires:
  - phase: 09-borrowers
    provides: borrowers.ts api-module idiom (MAX_LIMIT clamp, BARE-vs-paginated typed returns) mirrored verbatim
  - phase: 07-labels
    provides: labels.ts read/attach/detach helpers (extended, not rewritten) + Label type
provides:
  - categoryApi (BARE {items} list) / locationApi / containerApi (paginated list + BARE /search) net-new api modules
  - labelsApi extended with get/create/update/archive/restore/del (TAX-07 manager surface)
  - Label type gains is_archived/created_at/updated_at
  - buildTree generic flat→nested util (parent_category_id AND parent_location accessors, orphan-at-root)
  - safeSessionStorage getSet/saveSet try/catch helper (canonical — no prior precedent)
  - RetroTree net-new recursive tree atom (sessionStorage expand persistence, W3C tree a11y, row actions)
  - category/location/container/label zod schemas (color + short_code regex, container location_id required)
  - MSW taxonomy handlers for all four domains + /search + items?category_id= / inventory?container_id= usage reads
affects: [10-02, 10-03, 10-04, 10-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-endpoint envelope split typed precisely (BARE {items} categories/labels/search vs paginated locations/containers — reading .total where absent is a compile error)"
    - "sessionStorage expand persistence via a try/catch-wrapped helper (first sessionStorage use in frontend2)"
    - "Generic buildTree over a parentIdOf accessor to bridge the parent_category_id / parent_location field-name divergence"

key-files:
  created:
    - frontend2/src/lib/api/category.ts
    - frontend2/src/lib/api/location.ts
    - frontend2/src/lib/api/container.ts
    - frontend2/src/features/taxonomy/lib/buildTree.ts
    - frontend2/src/features/taxonomy/lib/buildTree.test.ts
    - frontend2/src/features/taxonomy/lib/safeSessionStorage.ts
    - frontend2/src/features/taxonomy/schema.ts
    - frontend2/src/features/taxonomy/schema.test.ts
    - frontend2/src/components/retro/data/RetroTree.tsx
    - frontend2/src/components/retro/data/RetroTree.test.tsx
  modified:
    - frontend2/src/lib/api/labels.ts
    - frontend2/src/lib/types.ts
    - frontend2/src/components/retro/data/index.ts
    - frontend2/src/test/msw/handlers.ts
    - frontend2/src/features/items/components/ItemLabels.test.tsx

key-decisions:
  - "RetroTree onAddChild receives the full node (superset of UI-SPEC's parentId) so consumers can read name/depth without a lookup"
  - "RetroTree caret/action buttons use tabIndex=-1 with a roving treeitem (W3C APG); arrow keys move row focus"
  - "Label's three new fields are REQUIRED (not optional), matching borrowers.ts precedent; the one breaking test fixture (ItemLabels.test) was updated"
  - "MSW items?category_id= / inventory?container_id= default to total:0 so archive/delete-warning paths default to 'nothing assigned'; tests override per-case"

patterns-established:
  - "Taxonomy api modules: MAX_LIMIT=100 clamp, encodeURIComponent on search q, .then(r=>r.items) only on BARE /search"
  - "RetroTree flattens visible rows for roving keyboard nav; collapsed subtrees are absent from the DOM"

requirements-completed: [TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, TAX-06, TAX-07]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 10 Plan 01: Taxonomy Foundation Summary

**The Wave-1 foundation for the Taxonomy phase: four typed api modules with a load-bearing per-endpoint envelope split, a generic buildTree util, a net-new recursive RetroTree atom with sessionStorage-persisted expand state + W3C tree a11y, four zod schemas, and the single-writer MSW taxonomy handlers every downstream tab depends on.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 4/4
- **Files created:** 10
- **Files modified:** 5

## Accomplishments

### Task 1 — api modules + types
- `category.ts` (BARE `{items}` list — `.total` is a type error), `location.ts` + `container.ts` (paginated list + BARE `/search`), all clamped to `limit≤100`.
- `Location.parent_location` (NOT `_id`, Pitfall 6); `Container` flat `location_id` + `capacity`/`short_code`.
- `labels.ts` extended with `get/create/update/archive/restore/del` (existing read/attach/detach untouched); `Label` type gains `is_archived/created_at/updated_at`.

### Task 2 — buildTree + safeSessionStorage + schemas
- `buildTree(rows, parentIdOf)` — two-pass Map build, depth + alpha sort per level, orphan→root (Pitfall 7). 7 tests including both parent-field accessors.
- `safeSessionStorage.getSet/saveSet` try/catch wrapper.
- `categorySchema/locationSchema/containerSchema/labelSchema` — color `^#[0-9A-Fa-f]{6}$`, short_code `^[A-Za-z0-9]{4,8}$`, container `location_id` required. 17 tests.

### Task 3 — RetroTree atom
- Recursive, depth indent (`INDENT_PX=20`) + sand guides, `▾`/`▸` caret + `·` leaf.
- Expand set persists per `storageKey` (two keys independent); `role=tree/treeitem`, `aria-expanded`/`aria-level`, roving tabIndex, `↑↓→←/Enter/Space`.
- Count badge (hidden at 0), archived → muted + `ARCHIVED` + `RESTORE`-only; row actions `EDIT/⊕/⌫` via callbacks; cluster `stopPropagation`. Exported through the data barrel. 14 tests.

### Task 4 — MSW handlers (single-writer)
- All four domains CRUD with the correct per-endpoint envelope split; usage-count reads for `items?category_id=` and `inventory?container_id=` (default `total:0`).

## Exported symbols (for downstream plans)

- `lib/api/category.ts`: `categoryApi`, `Category`, `CreateCategoryBody`, `UpdateCategoryBody`
- `lib/api/location.ts`: `locationApi`, `Location`, `CreateLocationBody`, `UpdateLocationBody`
- `lib/api/container.ts`: `containerApi`, `Container`, `CreateContainerBody`, `UpdateContainerBody`
- `lib/api/labels.ts`: `labelsApi` (now incl. `get/create/update/archive/restore/del`), `CreateLabelBody`, `UpdateLabelBody`
- `features/taxonomy/lib/buildTree.ts`: `buildTree`, `TreeNode<T>`
- `features/taxonomy/lib/safeSessionStorage.ts`: `getSet`, `saveSet`, `safeSessionStorage`
- `features/taxonomy/schema.ts`: `categorySchema/locationSchema/containerSchema/labelSchema` + `*FormInput`/`*FormValues` types
- `@/components/retro` (via data barrel): `RetroTree`, `RetroTreeProps`, `RetroTreeNode`

## MSW fixture shapes

- `CATEGORIES` (3 rows, `cat-electronics` > `cat-phones`, `cat-tools` leaf) → BARE `{items}`.
- `LOCATIONS` (2 rows, `loc-1` Garage > `loc-2` Shelf A via `parent_location`) → paginated list, BARE `/search`.
- `CONTAINERS` (2 rows, `cont-1`/`cont-2` flat `location_id`) → paginated list, BARE `/search`.
- `LABEL` extended with `is_archived/created_at/updated_at`; label CRUD added.
- `items?category_id=` and `inventory?container_id=` → `{items:[], total:0}` by default (override per-test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated ItemLabels.test fixture for the new Label fields**
- **Found during:** Task 1
- **Issue:** Adding required `is_archived/created_at/updated_at` to the shared `Label` type broke the one existing literal-construction site, `ItemLabels.test.tsx` `label()` helper (TS2739) — a foreseeable callsite, not in `files_modified`.
- **Fix:** Added the three fields to the test fixture with fixed values; the attach/detach popover ignores them.
- **Files modified:** frontend2/src/features/items/components/ItemLabels.test.tsx
- **Commit:** 9fa25c7d
- **Rationale:** The plan + borrowers.ts precedent mandate REQUIRED fields; making them optional would weaken the manager's typing. Fixing the single direct callsite is the minimal, scope-respecting blocking-fix.

**2. [Spec reconciliation] RetroTree `variant="ok"` → `variant="mint"` for RESTORE**
- **Found during:** Task 3
- **Issue:** UI-SPEC calls the RESTORE action "mint"; BevelButton has no `ok` variant (`neutral/primary/mint/danger`).
- **Fix:** Used `variant="mint"` (matches UI-SPEC copy).

### Note: RetroTree.onAddChild signature
- UI-SPEC types `onAddChild: (parentId: string)`; the plan body says "onAddChild fires with the right node". Implemented as `(node: RetroTreeNode)` — a superset that satisfies both (consumers can read `node.id` for the parent id). Documented in the component.

## Known Stubs

None — every artifact is fully wired and tested. Downstream plans (10-02..05) consume these as stable dependencies.

## Threat Flags

None — no new security surface introduced. All api calls carry `wsId` (T-10-01 mitigated by design); names are React-escaped (T-10-02); zero new installs (T-10-SC).

## Verification

- `bun run lint:tsc` — clean (exit 0).
- `bun run test src/features/taxonomy/ src/components/retro/data/RetroTree.test.tsx src/lib/api/` — 96 tests, 9 files green.
- `bun run test` (full suite) — 680 tests, 95 files green (no regression).

## Self-Check: PASSED

All 7 spot-checked created files exist on disk; all 4 per-task commit hashes present in git history.
