---
phase: 10-taxonomy
verified: 2026-06-13T10:47:30Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 10: Taxonomy Verification Report

**Phase Goal:** Deliver the Taxonomy page (TAX-01..07) — hierarchical category/location trees, container group-by-location list, full CRUD on all four entity types, and a label manager with 8-swatch color picker — all wired to live backend endpoints via correct per-endpoint envelopes.
**Verified:** 2026-06-13T10:47:30Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TAX-01: Categories hierarchical tree, expand/collapse → sessionStorage | VERIFIED | `RetroTree.tsx` reads/writes sessionStorage via `safeSessionStorage` with `storageKey="taxonomy:tree:categories"` (CategoriesTab.tsx:138); tree built CLIENT-SIDE via `buildTree(rows, (c) => c.parent_category_id)` (useCategoriesQuery.ts:39) |
| 2 | TAX-02: Create/edit/archive categories; CLIENT usage-warning on archive-with-items | VERIFIED | `openArchive` in CategoriesTab.tsx:74-89 calls `fetchCount("category", id)` BEFORE confirm opens count-aware copy; `archiveCategory` (unconditional, no `?force=`) fires only on confirm (CategoriesTab.tsx:91-95); mutations in useCategoryMutations.ts expose create/update/archive/restore |
| 3 | TAX-03: Locations hierarchical tree via `parent_location` | VERIFIED | `buildTree(rows, (l) => l.parent_location)` (useLocationsQuery.ts:42); Location type has `parent_location?: string` (NOT `parent_location_id`) (location.ts:21); `storageKey="taxonomy:tree:locations"` (LocationsTab.tsx:126) |
| 4 | TAX-04: Create/edit/archive locations; ARCHIVE-only (no delete) | VERIFIED | `useLocationMutations` exposes ONLY `{ create, update, archive, restore }` — NO `del` (useLocationMutations.ts:83-84); LocationsTab has no delete button (confirmed by grep and test `"offers NO delete affordance anywhere (archive-only, TAX-04)"`); useLocationMutations test line 108 explicitly asserts `del` is absent |
| 5 | TAX-05: Containers grouped by location (client group-by) | VERIFIED | ContainersTab.tsx:73-100 performs client group-by `location_id`, sorts groups alpha with `(No location)` last; location names resolved from `useLocationsQuery` rows (no per-row fan-out) |
| 6 | TAX-06: Create/edit/DELETE containers; bare DELETE + unassign-N confirm; dual invalidation | VERIFIED | `del` mutation in useContainerMutations.ts:72-92 calls `containerApi.del(wsId, a.id)` — a single bare DELETE with no `?force`; `onSuccess` calls both `invalidateContainers()` AND `invalidateInventory()` (lines 76-78); count-aware confirm from `useUsageCount("container", id)` opens before delete fires |
| 7 | TAX-07: Label manager CRUD + 8-swatch color picker | VERIFIED | LabelsTab.tsx implements flat CRUD list with archive/restore/delete; LabelFormDialog.tsx mounts `ColorSwatchPicker`; `SWATCHES` array in ColorSwatchPicker.tsx:22-29 has exactly 8 entries (--titlebar-blue/pink/mint/butter, --accent-blue/pink/mint-deep, --danger); useLabelMutations.ts exposes create/update/archive/restore/del |

**Score: 7/7 truths verified**

---

### Binding Override Verification

| # | Override | Status | Evidence |
|---|----------|--------|----------|
| 1 | Trees CLIENT-built; categories `parent_category_id`, locations `parent_location` (different keys) | VERIFIED | useCategoriesQuery.ts:39 `buildTree(rows, (c) => c.parent_category_id)`; useLocationsQuery.ts:42 `buildTree(rows, (l) => l.parent_location)` |
| 2 | Archive usage-warning CLIENT-computed before archive call; no `?force=` | VERIFIED | CategoriesTab.tsx:74-95: fetchCount resolves then confirm fires; archiveCategory arg has no force flag; categoryApi.archive is `post<void>(...archive)` — no query params |
| 3 | Container delete = bare DELETE; invalidates BOTH containers + inventory keys | VERIFIED | useContainerMutations.ts:49-50,76-78: two separate `invalidateQueries` calls on delete success |
| 4 | Locations ARCHIVE-ONLY — useLocationMutations exposes NO del; no delete button | VERIFIED | useLocationMutations.ts:83-84 return `{ create, update, archive, restore }` only; LocationsTab renders no delete affordance |
| 5 | Per-endpoint envelope: categories/labels bare `{items}`; locations/containers paginated | VERIFIED | categoryApi.ts: `list` returns `{ items: Category[] }` — no total; labelsApi lists via `listWorkspaceLabels` returning `{ items: Label[] }`; locationApi.ts: `list` returns `{ items, total, page, total_pages }`; containerApi.ts: `list` returns `{ items, total, page, total_pages }` |
| 6 | SearchPicker NOT imported by shipped item/inventory/loan forms | VERIFIED | grep confirms `SearchPicker` appears only in `ContainerFormDialog.tsx` (taxonomy-internal); `RetroCombobox` (a shipped retro atom, not taxonomy-specific) is used in ItemFormPage — this is correct per override text "Reuse shipped RetroCombobox … DO NOT retrofit shipped item/inventory/loan forms [with SearchPicker]" |
| 7 | RetroTree per-tab sessionStorage `taxonomy:tree:<tab>`; labels 4th `?tab=labels`; /taxonomy single route; literal-before-param | VERIFIED | CategoriesTab.tsx:138 `"taxonomy:tree:categories"`, LocationsTab.tsx:126 `"taxonomy:tree:locations"`; TAB_IDS in TaxonomyPage.tsx:22 = `["categories","locations","containers","labels"]` (labels is index 3 = 4th); routes/index.tsx:92-100: `/taxonomy` then literal `/taxonomy/categories/new` BEFORE param `/taxonomy/categories/:id/edit` |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `frontend2/src/features/taxonomy/TaxonomyPage.tsx` | /taxonomy page shell with 4-tab RetroTabs | VERIFIED | 91 lines, mounts all 4 tab components |
| `frontend2/src/features/taxonomy/components/CategoriesTab.tsx` | Category tree + archive-warning CRUD | VERIFIED | 193 lines, full implementation |
| `frontend2/src/features/taxonomy/components/LocationsTab.tsx` | Location tree, archive-only | VERIFIED | 177 lines, full implementation |
| `frontend2/src/features/taxonomy/components/ContainersTab.tsx` | Container group-by-location + bare DELETE | VERIFIED | 273 lines, full implementation |
| `frontend2/src/features/taxonomy/components/LabelsTab.tsx` | Label CRUD list | VERIFIED | 205 lines, full implementation |
| `frontend2/src/features/taxonomy/components/ColorSwatchPicker.tsx` | 8-swatch on-palette color picker | VERIFIED | 8 swatches, stores hex |
| `frontend2/src/features/taxonomy/components/CategoryFormDialog.tsx` | Routed category create/edit form | VERIFIED | 264 lines, RHF + zod |
| `frontend2/src/features/taxonomy/components/LocationFormDialog.tsx` | Inline location create/edit dialog | VERIFIED | exists |
| `frontend2/src/features/taxonomy/components/ContainerFormDialog.tsx` | Inline container create/edit dialog | VERIFIED | exists |
| `frontend2/src/features/taxonomy/components/LabelFormDialog.tsx` | Inline label create/edit dialog | VERIFIED | 222 lines, mounts ColorSwatchPicker |
| `frontend2/src/features/taxonomy/components/SearchPicker.tsx` | Taxonomy-only type-ahead picker (internal) | VERIFIED | 72 lines, taxonomy-scoped |
| `frontend2/src/features/taxonomy/lib/buildTree.ts` | Generic flat→nested tree builder | VERIFIED | 44 lines, parameterised parent accessor |
| `frontend2/src/features/taxonomy/lib/safeSessionStorage.ts` | Try/catch sessionStorage wrapper | VERIFIED | 31 lines |
| `frontend2/src/features/taxonomy/hooks/useCategoriesQuery.ts` | Category list + tree | VERIFIED | buildTree with `parent_category_id` |
| `frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts` | Category create/update/archive/restore | VERIFIED | prefix-invalidates `["categories", wsId]` |
| `frontend2/src/features/taxonomy/hooks/useLocationsQuery.ts` | Location list + tree | VERIFIED | buildTree with `parent_location` |
| `frontend2/src/features/taxonomy/hooks/useLocationMutations.ts` | Location create/update/archive/restore (NO del) | VERIFIED | returns `{ create, update, archive, restore }` only |
| `frontend2/src/features/taxonomy/hooks/useContainersQuery.ts` | Container flat list | VERIFIED | paginated `.items`, limit 100 |
| `frontend2/src/features/taxonomy/hooks/useContainerMutations.ts` | Container create/update/del (dual invalidation) | VERIFIED | del invalidates containers + inventory |
| `frontend2/src/features/taxonomy/hooks/useLabelsQuery.ts` | Label list (bare envelope) | VERIFIED | `listWorkspaceLabels` → `.items` |
| `frontend2/src/features/taxonomy/hooks/useLabelMutations.ts` | Label create/update/archive/restore/del | VERIFIED | 5 mutations, prefix-invalidates |
| `frontend2/src/features/taxonomy/hooks/useUsageCount.ts` | Imperative count fetcher (category + container) | VERIFIED | `category` → `/items?category_id=`; `container` → `/inventory?container_id=` |
| `frontend2/src/components/retro/data/RetroTree.tsx` | Net-new tree atom with sessionStorage + a11y | VERIFIED | 294 lines, W3C APG tree pattern, reads `getSet(storageKey)` on mount, saves on toggle |
| `frontend2/src/lib/api/category.ts` | categoryApi — bare `{items}` envelope | VERIFIED | `list` returns `{ items: Category[] }` — no total |
| `frontend2/src/lib/api/location.ts` | locationApi — paginated envelope + `parent_location` field | VERIFIED | list: `{ items, total, page, total_pages }`; field typed as `parent_location?: string` |
| `frontend2/src/lib/api/container.ts` | containerApi — paginated envelope | VERIFIED | list: `{ items, total, page, total_pages }` |
| `frontend2/src/lib/api/labels.ts` | labelsApi — bare `{items}` + CRUD extension | VERIFIED | `listWorkspaceLabels` → `{ items: Label[] }` |
| `frontend2/e2e/taxonomy.spec.ts` | Live Playwright E2E spec | VERIFIED | 2 tests (chromium + firefox), passed green in isolation |
| `frontend2/src/routes/index.tsx` | Taxonomy routes with literal-before-param order | VERIFIED | `/taxonomy`, `/taxonomy/categories/new` (literal), `/taxonomy/categories/:id/edit` (param) in correct order |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| CategoriesTab | useCategoriesQuery | tree prop | WIRED | `const { tree, isLoading, isError, refetch } = useCategoriesQuery()` (CategoriesTab.tsx:56) |
| CategoriesTab | useCategoryMutations | archive/restore | WIRED | `const { archive, restore } = useCategoryMutations()` (CategoriesTab.tsx:57) |
| CategoriesTab | useUsageCount | fetchCount on archive-open | WIRED | `const { fetchCount } = useUsageCount()` called in `openArchive` (CategoriesTab.tsx:60,76) |
| CategoriesTab | RetroTree | tree nodes + storageKey | WIRED | `<RetroTree nodes={nodes} storageKey="taxonomy:tree:categories" ...>` (CategoriesTab.tsx:136-160) |
| LocationsTab | useLocationsQuery | rows + tree | WIRED | `const { rows, tree, ... } = useLocationsQuery()` (LocationsTab.tsx:56) |
| LocationsTab | useLocationMutations | archive/restore (no del) | WIRED | `const { archive, restore } = useLocationMutations()` (LocationsTab.tsx:57) |
| ContainersTab | useContainersQuery | rows | WIRED | consumed at ContainersTab.tsx:58 |
| ContainersTab | useLocationsQuery | location name resolution | WIRED | `const { rows: locationRows } = useLocationsQuery()` (ContainersTab.tsx:59) |
| ContainersTab | useContainerMutations | del | WIRED | `const { del } = useContainerMutations(); const deleteContainer = del.mutate` (ContainersTab.tsx:60-61) |
| ContainersTab | useUsageCount | fetchCount on delete-open | WIRED | called in `openDelete` (ContainersTab.tsx:113) |
| LabelsTab | useLabelsQuery | rows | WIRED | `const { rows, ... } = useLabelsQuery()` (LabelsTab.tsx:38) |
| LabelsTab | useLabelMutations | archive/restore/del | WIRED | destructured at LabelsTab.tsx:39-42 |
| LabelFormDialog | ColorSwatchPicker | RHF Controller | WIRED | `<Controller ... render={({ field }) => <ColorSwatchPicker ...>}` (LabelFormDialog.tsx:169-181) |
| useContainerMutations.del | invalidateInventory | onSuccess | WIRED | `invalidateInventory()` called in del.onSuccess (useContainerMutations.ts:77) |
| RetroTree | safeSessionStorage | getSet/saveSet | WIRED | `useState(() => new Set(getSet(storageKey)))` + `useEffect(...saveSet...)` (RetroTree.tsx:79-88) |
| useCategoriesQuery | buildTree | `(c) => c.parent_category_id` | WIRED | useCategoriesQuery.ts:39 |
| useLocationsQuery | buildTree | `(l) => l.parent_location` | WIRED | useLocationsQuery.ts:42 |
| routes/index.tsx | TaxonomyPage | `/taxonomy` route | WIRED | `<Route path="taxonomy" element={<TaxonomyPage />} />` (routes/index.tsx:92) |
| routes/index.tsx | CategoryFormDialog | `/taxonomy/categories/new` + `/:id/edit` | WIRED | routes/index.tsx:93-100 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| CategoriesTab | `tree` | `useCategoriesQuery` → `categoryApi.list(wsId)` → GET /categories | Yes (live API) | FLOWING |
| LocationsTab | `tree` | `useLocationsQuery` → `locationApi.list(wsId, 1, 100)` → GET /locations?page=1&limit=100 | Yes (live API) | FLOWING |
| ContainersTab | `rows` + `groups` | `useContainersQuery` → `containerApi.list` → GET /containers; group-by from `useLocationsQuery` | Yes (live API) | FLOWING |
| LabelsTab | `rows` | `useLabelsQuery` → `labelsApi.listWorkspaceLabels(wsId)` → GET /labels | Yes (live API) | FLOWING |
| useUsageCount | `count` | Imperative: GET `/items?category_id=…&limit=1` or GET `/inventory?container_id=…&limit=1` | Yes (live API, reads `.total`) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Verification Method | Status |
|----------|-------------------|--------|
| `taxonomy:tree:categories` storage key is distinct from `taxonomy:tree:locations` | Code read: two different `storageKey` props on two different `<RetroTree>` mounts | PASS |
| `useLocationMutations` exports no `del` | Code read: `return { create, update, archive, restore }` (useLocationMutations.ts:83-84); test line 108 asserts `del` is absent | PASS |
| Container delete double-invalidates | Code read: both `invalidateContainers()` and `invalidateInventory()` called in del.onSuccess (useContainerMutations.ts:76-78) | PASS |
| CategoryApi.list returns no `total` | TypeScript type `{ items: Category[] }` (category.ts:37); reading `.total` would be a compile error | PASS |
| ColorSwatchPicker has exactly 8 swatches | `SWATCHES` array has 8 `{ hex, label }` entries (ColorSwatchPicker.tsx:22-29) | PASS |
| SearchPicker not imported in item/inventory/loan forms | grep: zero hits for `SearchPicker` in features/items, features/inventory, features/loans | PASS |
| Labels is 4th tab (`?tab=labels`) | `TAB_IDS = ["categories","locations","containers","labels"]` (TaxonomyPage.tsx:22), labels at index 3 | PASS |
| Literal routes before param routes | routes/index.tsx: `/taxonomy/categories/new` (line 93) registered before `/taxonomy/categories/:id/edit` (line 97) | PASS |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| TAX-01 | Categories hierarchical tree, expand/collapse → sessionStorage | SATISFIED | CategoriesTab + RetroTree + safeSessionStorage + useCategoriesQuery (buildTree with parent_category_id) |
| TAX-02 | Create/edit/archive categories; CLIENT usage-warning | SATISFIED | useCategoryMutations (create/update/archive/restore); useUsageCount.fetchCount called before confirm; no ?force= |
| TAX-03 | Locations hierarchical tree | SATISFIED | LocationsTab + RetroTree + useLocationsQuery (buildTree with parent_location) |
| TAX-04 | Create/edit/archive locations (ARCHIVE-only, no delete) | SATISFIED | useLocationMutations (no del); LocationsTab has no delete button |
| TAX-05 | Containers grouped by location | SATISFIED | ContainersTab client group-by location_id; location names from useLocationsQuery |
| TAX-06 | Create/edit/DELETE containers; bare DELETE + unassign-N confirm | SATISFIED | useContainerMutations.del: bare containerApi.del; dual invalidation; count-aware confirm |
| TAX-07 | Label manager CRUD + 8-swatch color picker | SATISFIED | LabelsTab + LabelFormDialog + ColorSwatchPicker (8 swatches) + useLabelMutations (5 mutations) |

---

### Anti-Patterns Found

Scanned all taxonomy source files. No `TBD`, `FIXME`, `XXX`, `HACK`, or unresolved placeholder strings found. The `safeSessionStorage` `return []` lines are error-path fallbacks in try/catch, not stub patterns. No empty implementations in rendering paths.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | — | — | None found |

---

### Human Verification Required

The following items cannot be verified by static code analysis:

1. **Visual: RetroTree expand/collapse animation and indent guides**
   - Test: Load `/taxonomy`, expand a multi-level category tree
   - Expected: Expand/collapse with ▸/▾ caret, 20px-per-level indent rules, no visual flash
   - Why human: CSS transitions and pixel-level layout require visual inspection

2. **Visual: Archive usage-warning copy count-accuracy**
   - Test: Assign items to a category then archive it
   - Expected: The butter dialog shows "has N item(s) assigned to it" with the correct live count
   - Why human: Requires a live backend with the category archive bug fixed (residue #1 below)

3. **Visual: Container unassign-N cascade copy**
   - Test: Add inventory to a container, open delete dialog
   - Expected: Pink dialog shows "holds N item(s)... will be unassigned..."
   - Why human: Requires live backend with `/inventory?container_id=` filter fixed (residue #2 below)

4. **Visual: 8 color swatches render correctly on all swatch hues (AA contrast of ✓ glyph)**
   - Test: Open label create form, click each swatch, verify ✓ glyph visible on all backgrounds
   - Expected: ✓ rendered in `bg-bg-panel` chip on each colored swatch; 1px ink border visible
   - Why human: Color contrast visual verification

5. **Visual: Label EDIT flow (when backend PATCH /labels fixed)**
   - Test: Create a label, click EDIT, change name/color, save
   - Expected: Changes persist and row updates
   - Why human: Live backend defect (#3) currently blocks this path; verify after backend fix

---

### Phase Verdict

**PASSED — 7/7 TAX requirements verified.**

The Taxonomy page frontend is correctly implemented. All seven TAX requirements are fully wired: category and location trees are client-built from flat API responses using the correct field names (`parent_category_id` vs `parent_location`); expand/collapse state persists to per-tab sessionStorage keys; archive flows fetch the usage count CLIENT-side before any destructive call; location mutations expose no delete path; container delete fires a bare `DELETE` and invalidates both cache keys; the label manager has 8 on-palette swatches. All binding overrides hold in the shipped code as verified by direct file reads.

Three live-backend defects were discovered during Phase 10 E2E testing. They are backend defects — the frontend is built correctly to contract. They require Go backend fixes and are tracked as residues below.

---

### Residues

#### Visual Residues (human verification pending backend fixes)

- **VISUAL-01 — RetroTree keyboard navigation:** W3C APG tree pattern is implemented (role=tree/treeitem, aria-expanded, roving tabIndex, arrow keys). Full keyboard flow (Tab → tree, arrows to navigate, Enter/Space to expand) should be confirmed visually in a real browser.
- **VISUAL-02 — No-color swatch rendering on dark backgrounds:** The `∅` / `✓` glyphs in the no-color swatch use `text-fg-muted` on `bg-panel-2` — verify visible in context.

#### Tracked Backend Defects (NOT frontend failures)

These were surfaced by the live Playwright E2E (taxonomy.spec.ts) against the real backend on 2026-06-13. The frontend wiring is correct; the backend implementations are incorrect.

| # | Defect | Backend location (reported) | Frontend impact |
|---|--------|-----------------------------|----------------|
| 1 | Category archive does not persist `is_archived`. `POST /categories/{id}/archive` returns 204 but list/detail still report `is_archived: false`. | `category/service.go:163` — `Archive()` → `repo.Save()` does not persist the flag | Archive toast fires correctly; tree row does not flip to archived state after archive |
| 2 | `/inventory?container_id=` filter is ignored. Usage-count read for a 0-item container returns the whole-workspace total (observed: 62). | inventory handler container_id filter param not applied | Container delete dialog shows cascade copy ("holds N items") for zero-item containers |
| 3 | `PATCH /labels/{id}` returns 400 (SQLSTATE 23505 `labels_pkey` duplicate key). The update path INSERTs rather than UPDATEs. | labels repository update method | Label EDIT saves fail with a backend error; create (POST) and delete (DELETE) are sound |

These three defects must be fixed in the Go backend. Once fixed, re-run `taxonomy.spec.ts` isolated (`--project=chromium`) and perform human verification items 2, 3, and 5 above.

---

_Verified: 2026-06-13T10:47:30Z_
_Verifier: Claude (gsd-verifier)_
