---
phase: 10-taxonomy
plan: 03
subsystem: ui
tags: [react, taxonomy, tree, locations, containers, search-picker, tanstack-query, zod, msw]

# Dependency graph
requires:
  - phase: 10-taxonomy
    plan: 01
    provides: locationApi/containerApi (paginated list + BARE /search), buildTree, RetroTree atom, location/container schemas, MSW location/container fixtures
  - phase: 10-taxonomy
    plan: 02
    provides: TaxonomyPage shell + LocationsTab/ContainersTab stubs (filled here), useUsageCount fetchCount("container",id), CategoriesTab/useCategoryMutations idiom (mirrored)
provides:
  - LocationsTab (RetroTree via parent_location, ARCHIVE-only — no delete) filled in-place over the W2 stub
  - LocationFormDialog (inline RetroDialog, RHF+zod, RetroCombobox parent picker excluding self+descendants)
  - useLocationsQuery (key [locations, wsId] + buildTree(parent_location) memo)
  - useLocationMutations (create/update/archive/restore PREFIX-invalidate; NO del — TAX-04)
  - ContainersTab (client group-by location_id, (No location) last; bare-DELETE-with-cascade) filled in-place over the W2 stub
  - ContainerFormDialog (inline RetroDialog, SearchPicker location field + empty-source hint)
  - useContainersQuery (key [containers, wsId])
  - useContainerMutations (create/update PREFIX-invalidate; del double-invalidates [containers,ws] AND [inventory,ws]; 409→conflict toast)
  - SearchPicker (RetroCombobox + /search, Taxonomy-ONLY) + useTaxonomySearch (debounced, key [domain,wsId,"search",q])
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline RetroDialog forms (no route) for location/container create+edit — W2 form-routing decision (only category forms are routed)"
    - "Client group-by with unresolved bucket sorted LAST ((No location)) — mirrors InventoryListPage unresolved-name discipline"
    - "Double PREFIX-invalidate on FK SET NULL cascade: container del → [containers,ws] AND [inventory,ws] (T-10-05/OQ2)"
    - "SearchPicker = RetroCombobox + debounced /search, layered over a fallbackOptions baseline (taxonomy-only; never the shipped native-select picker path)"

key-files:
  created:
    - frontend2/src/features/taxonomy/hooks/useLocationsQuery.ts
    - frontend2/src/features/taxonomy/hooks/useLocationMutations.ts
    - frontend2/src/features/taxonomy/hooks/useLocationMutations.test.tsx
    - frontend2/src/features/taxonomy/components/LocationFormDialog.tsx
    - frontend2/src/features/taxonomy/components/LocationsTab.test.tsx
    - frontend2/src/features/taxonomy/hooks/useTaxonomySearch.ts
    - frontend2/src/features/taxonomy/components/SearchPicker.tsx
    - frontend2/src/features/taxonomy/hooks/useContainersQuery.ts
    - frontend2/src/features/taxonomy/hooks/useContainerMutations.ts
    - frontend2/src/features/taxonomy/hooks/useContainerMutations.test.tsx
    - frontend2/src/features/taxonomy/components/ContainerFormDialog.tsx
    - frontend2/src/features/taxonomy/components/ContainersTab.test.tsx
  modified:
    - frontend2/src/features/taxonomy/components/LocationsTab.tsx
    - frontend2/src/features/taxonomy/components/ContainersTab.tsx
    - frontend2/src/features/taxonomy/TaxonomyPage.test.tsx

key-decisions:
  - "Locations are ARCHIVE-ONLY: useLocationMutations deliberately does NOT expose del (TAX-04/OQ6/T-10-07 — location hard-delete is dangerous: CASCADE/RESTRICT). A test asserts del is absent."
  - "Location archive confirm uses the PLAIN butter copy (no usage-count fetch) — locations carry no client usage-count requirement, unlike the category TAX-02 warning."
  - "Container delete = single bare DELETE /containers/{id} (NO ?force, NO second call). The count is fetched via useUsageCount(container,id) only to drive the cascade-warning copy; the server FK SET NULLs inventory.container_id."
  - "Container form capacity field DROPPED: schema.ts (10-01, not in my files_modified) has no capacity in containerSchema, so the inline form ships name/location/description/short_code only — adding capacity would require editing a single-writer file. Container.capacity remains supported by the api type; a future plan can add it to the schema+form."
  - "SearchPicker composes RetroCombobox (which lacks an onInputChange hook) by capturing typed text via a wrapping div onInput, debouncing it through useTaxonomySearch, and merging live /search results onto a fallbackOptions baseline so the picker is usable before typing and the selected value always resolves to a label."
  - "useContainerMutations.del.onError maps HttpError 409 → a conflict toast (defensive backstop; the current service cascades and cannot 409)."

patterns-established:
  - "Cross-wave stub fill: LocationsTab/ContainersTab filled IN-PLACE with their W2 export names unchanged; TaxonomyPage.tsx (single-writer) never re-edited."

requirements-completed: [TAX-03, TAX-04, TAX-05, TAX-06]

# Metrics
duration: ~18min
completed: 2026-06-13
---

# Phase 10 Plan 03: Locations + Containers Tabs Summary

**The Locations tab (RetroTree nesting via `parent_location`, ARCHIVE-only — no delete affordance anywhere) and the Containers tab (client group-by `location_id` with `(No location)` last, bare-DELETE-with-unassign that double-invalidates the inventory cache), plus the net-new Taxonomy-only SearchPicker (RetroCombobox + debounced `/search`) wired into the container form's required Location field — all slotting into the W2 TaxonomyPage shell by filling its two stubs in-place.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3/3
- **Files created:** 12
- **Files modified:** 3 (2 stubs filled + 1 W2 test retargeted)

## Accomplishments

### Task 1 — Locations tab + LocationFormDialog + hooks
- `useLocationsQuery`: key `["locations", wsId]`, paginated `locationApi.list(ws,1,100).then(r=>r.items)`, tree memoized via `buildTree(l => l.parent_location)` (NOT `_id` — Pitfall 6).
- `useLocationMutations`: create/update/archive/restore each PREFIX-invalidate `["locations", wsId]` (no `exact`). **No `del` exposed** (TAX-04 archive-only; T-10-07). A test asserts `del` is `undefined`.
- `LocationsTab` (fills the W2 stub in-place, export name unchanged): RetroTree storageKey `taxonomy:tree:locations`, `⊕ ADD ROOT LOCATION` toolbar, add-child/edit/archive/restore. No delete affordance. Archive confirm = plain butter `ARCHIVE LOCATION?` copy (no usage-count fetch). Empty (`NO LOCATIONS YET`) + error (`COULDN'T LOAD LOCATIONS` + RETRY).
- `LocationFormDialog`: inline RetroDialog (no route), RHF + zod `locationSchema`, fields name / parent (RetroCombobox flattened, excludes self+descendants) / description / short_code; dirty-guard butter DISCARD.
- 14 tests green (tree nests via parent_location, no-delete assertion, plain-archive, restore, empty, error + 6 mutation tests including the del-absent guard).

### Task 2 — useTaxonomySearch + SearchPicker
- `useTaxonomySearch(domain, query)`: debounces ~250ms, `useQuery` keyed `[domain, wsId, "search", q]` (PREFIXED by domain — Lock #4), enabled only when `wsId && q.length>0`, calls `locationApi.search`/`containerApi.search` (BARE `.items`), maps → `RetroComboboxOption[]`.
- `SearchPicker`: composes RetroCombobox with the hook; captures typed text via a wrapping `onInput`, merges live `/search` results onto a `fallbackOptions` baseline. Header comment flags it Taxonomy-only (OQ4 RISK).
- Verify gate: tsc clean for both files; `grep` confirms SearchPicker absent from `InventoryFormPage.tsx` and from ALL non-taxonomy source.

### Task 3 — Containers tab + ContainerFormDialog + delete-with-unassign
- `useContainersQuery`: key `["containers", wsId]`, paginated `.items`.
- `useContainerMutations`: create/update PREFIX-invalidate `["containers", wsId]`; **`del` double PREFIX-invalidates `["containers", wsId]` AND `["inventory", wsId]`** (FK SET NULL cascade — T-10-05/OQ2). `del.onError` maps `HttpError` 409 → a conflict toast.
- `ContainersTab` (fills the W2 stub in-place, export name unchanged): client group-by `location_id`, group headers resolved from `useLocationsQuery` rows (no fan-out), groups alpha-sorted, `(No location)` bucket LAST. Each group = a `bg-bg-panel-2` header strip + a RetroTable of its rows (name + EDIT + `⌫` DELETE). Empty (`NO CONTAINERS YET`) + error (`COULDN'T LOAD CONTAINERS` + RETRY).
- TAX-06 delete: pink `DELETE CONTAINER?`; on open `fetchCount("container", id)`; `total>0` → cascade copy `⚠ "{name}" holds {n} item(s)… they stay in their location…`; `total=0` → plain pink; confirm → a single bare `del.mutate(id)` (no `?force`, no second call). No type-to-confirm gate.
- `ContainerFormDialog`: inline RetroDialog, RHF + zod `containerSchema`, Location field = `SearchPicker(domain="locations")` REQUIRED with `fallbackOptions` from the loaded locations list; empty-source disabled state + verbatim `No locations yet — add one first.` hint.
- 11 tests green (grouped rendering, `(No location)` last, add opens dialog, cascade-count delete then bare del-once, 0-item plain delete, empty, error + 4 mutation tests incl. the dual-invalidate + 409-conflict-toast).

## Output notes (per plan <output>)

1. **Stub swap:** `LocationsTab` and `ContainersTab` were filled IN-PLACE at their existing paths with their existing export names (`export function LocationsTab` / `ContainersTab`). `TaxonomyPage.tsx` (W2 single-writer) imports them by stable path and was **NOT** edited.
2. **No single-writer source files edited.** Confirmed via `git diff --name-only 020c3877 HEAD` + working tree: only the 14 declared files plus `TaxonomyPage.test.tsx` (see Deviations). None of `routes/index.tsx`, `Sidebar.tsx`, `handlers.ts`, `TaxonomyPage.tsx`, `RetroTree.tsx`, `buildTree.ts`, `useUsageCount.ts`, `schema.ts`, `lib/api/*`, `vite.config.ts`, or any 10-04-owned file were touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retargeted two W2 TaxonomyPage.test.tsx assertions away from the removed stub testid**
- **Found during:** full-suite gate after Task 3.
- **Issue:** `TaxonomyPage.test.tsx` (W2) asserted `getByTestId("tab-locations-pending")` in two tests. Filling the LocationsTab stub (the planned cross-wave handoff) removes that pending testid, so those two assertions failed.
- **Fix:** Both assertions now prove the live `LocationsTab` mounted via its `⊕ ADD ROOT LOCATION` toolbar button (the same idiom the existing test uses for the live CategoriesTab). Behavior-equivalent retarget; no source change.
- **Files modified:** `frontend2/src/features/taxonomy/TaxonomyPage.test.tsx` (NOT in the declared files_modified — a test-only follow-on of the mandated stub fill; no single-writer *source* file touched).

**2. [Scope] Container form capacity field dropped**
- The plan's Task 3 action lists a `capacity` form field, but `containerSchema` in `schema.ts` (a 10-01 file, not in my files_modified) has no `capacity` member. Adding capacity to the form would require editing a single-writer schema file, which the hard rules forbid. The form therefore ships name / location / description / short_code. `Container.capacity` remains in the api type; a future plan can extend `containerSchema` + the form together.

## Known Stubs

None. Both `LocationsTab` and `ContainersTab` are now fully implemented (the W2 pending testids are removed). The `LabelsTab` stub remains — it is owned by 10-04, not this plan.

## Threat Flags

None new. T-10-05 (stale inventory after container delete) mitigated by the dual `[containers,ws]`+`[inventory,ws]` invalidate. T-10-06 (cross-tenant search) mitigated: every `/search` carries `wsId` from `useWorkspace()`. T-10-07 (location hard-delete) mitigated by design: no delete affordance — archive-only. Zero new installs (T-10-SC).

## Verification

- `bun run lint:tsc` — clean (exit 0).
- `bun run test src/features/taxonomy/` — 68 tests, 9 files green.
- `bun run test` (full suite) — 724 tests, 102 files green (+25 over the 10-02 baseline of 699/98; no regression).
- SearchPicker import audit — present ONLY under `features/taxonomy`; absent from `InventoryFormPage.tsx` and all shipped item/inventory/loan forms.

## Self-Check: PASSED

All 14 declared files exist on disk; the three per-task commits (ac8b7217, 1f4f828f, cb40ef2c) are present on `exec/10-03`.
