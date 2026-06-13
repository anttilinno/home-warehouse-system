---
phase: 10-taxonomy
plan: 02
subsystem: ui
tags: [react, taxonomy, tree, retrotabs, react-router, tanstack-query, zod, msw]

# Dependency graph
requires:
  - phase: 10-taxonomy
    plan: 01
    provides: categoryApi (BARE {items}), buildTree, RetroTree atom, categorySchema, MSW taxonomy handlers
  - phase: 09-borrowers
    provides: useBorrowerMutations shape (PREFIX invalidate, no exact) + BorrowerFormPage form idiom (mirrored)
  - phase: 08-loans
    provides: LoansListPage ?tab= setSearchParams(prev=>…) round-trip (mirrored)
provides:
  - TaxonomyPage shell (one /taxonomy route, ?tab= RetroTabs over categories/locations/containers/labels)
  - CategoriesTab (RetroTree + CRUD + TAX-02 client usage-warning archive)
  - CategoryFormDialog (routed blue Window form, RetroCombobox parent excluding self+descendants)
  - useCategoriesQuery (key [categories, wsId] + buildTree memo)
  - useCategoryMutations (create/update/archive/restore PREFIX-invalidate, no exact)
  - useUsageCount (SHARED imperative fetchCount(kind, id) reading paginated .total)
  - LocationsTab/ContainersTab/LabelsTab STUBS (final export names — filled in-place by 10-03/10-04)
  - routes/index.tsx taxonomy routes (single-writer); Sidebar taxonomy nav (single-writer)
affects: [10-03, 10-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Imperative usage-count fetcher (fetchCount(kind,id)) — no per-row fan-out; fetched only when a destructive dialog opens"
    - "RetroTabs ?tab= page shell mirrors LoansListPage; unknown/absent tab → default"
    - "Cross-WAVE stub handoff: W2 creates tab stubs with FINAL export names; W3/W4 fill bodies in-place with zero page re-edit"

key-files:
  created:
    - frontend2/src/features/taxonomy/TaxonomyPage.tsx
    - frontend2/src/features/taxonomy/TaxonomyPage.test.tsx
    - frontend2/src/features/taxonomy/components/CategoriesTab.tsx
    - frontend2/src/features/taxonomy/components/CategoriesTab.test.tsx
    - frontend2/src/features/taxonomy/components/CategoryFormDialog.tsx
    - frontend2/src/features/taxonomy/components/LocationsTab.tsx
    - frontend2/src/features/taxonomy/components/ContainersTab.tsx
    - frontend2/src/features/taxonomy/components/LabelsTab.tsx
    - frontend2/src/features/taxonomy/hooks/useCategoriesQuery.ts
    - frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts
    - frontend2/src/features/taxonomy/hooks/useCategoryMutations.test.tsx
    - frontend2/src/features/taxonomy/hooks/useUsageCount.ts
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/components/layout/Sidebar.tsx

key-decisions:
  - "useCategoryMutations.archive/restore take {id, name} so the success toast can read '{name} archived.' (UI-SPEC §Toasts)"
  - "Archive count is fetched on dialog OPEN (count=null while loading → plain copy; resolves to count-aware copy when >0); archive is UNCONDITIONAL after confirm (advisory, NO ?force=)"
  - "CategoryFormDialog is a ROUTED blue Window (not an inline dialog) per UI-SPEC; only category forms are routed — location/container/label forms are inline dialogs (W3/W4)"
  - "RetroTreeNode.itemCount left 0 in the tree (no per-row fan-out); the real count is fetched only on archive via useUsageCount"

patterns-established:
  - "useUsageCount imperative fetchCount(kind:'category'|'container', id):Promise<number> — the W3 Containers tab consumes the SAME signature with kind='container' (GET /inventory?container_id=&limit=1 .total)"

requirements-completed: [TAX-01, TAX-02]

# Metrics
duration: ~12min
completed: 2026-06-13
---

# Phase 10 Plan 02: Taxonomy Page Shell + Categories Tab Summary

**The Taxonomy page shell (one `/taxonomy` route, `?tab=` RetroTabs over categories/locations/containers/labels) plus the fully-wired Categories tab — tree + create/edit + the TAX-02 client-computed usage-warning archive — proving the hardest tab end to end while leaving three named stubs for the parallel W3/W4 tabs.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3/3
- **Files created:** 12
- **Files modified:** 2

## Accomplishments

### Task 1 — category hooks + shared useUsageCount
- `useCategoriesQuery`: key `["categories", wsId]`, `categoryApi.list().then(r=>r.items)`, `enabled !!wsId`, `retry false`; exposes `{ rows, tree, isLoading, isError, refetch }` with the tree memoized via `buildTree(parent_category_id)`.
- `useCategoryMutations`: create/update/archive/restore each PREFIX-invalidate `["categories", wsId]` (NO `exact:true` — T-10-03). UI-SPEC toast copy throughout. Returns mutations whole; consumers destructure `.mutate`.
- `useUsageCount`: imperative `fetchCount(kind, id)` reading the paginated `.total` from `GET /items?category_id=&limit=1` (category) or `GET /inventory?container_id=&limit=1` (container) — domain-generic, no fan-out.
- 7 hook tests green (PREFIX invalidation proven; archive/restore call the api; both fetchCount kinds read `.total` with `limit=1`).

### Task 2 — TaxonomyPage shell + W3 stubs + route + Sidebar
- `TaxonomyPage`: mint Window `TAXONOMY — ${workspaceName}`, controlled `RetroTabs` (4 tabs), tab in `?tab=` via the `setSearchParams(prev=>…)` round-trip, default + unknown → categories, render-loop guard (tRef). RetroTabs owns panel padding (no double-pad).
- Three W3/W4 tab STUBS created with their FINAL export names (`LocationsTab`/`ContainersTab`/`LabelsTab`).
- `routes/index.tsx` (single-writer): `taxonomy` + `taxonomy/categories/new` (literal) + `taxonomy/categories/:id/edit` (param) — literal-before-param.
- `Sidebar.tsx` (single-writer): Categories/Locations/Containers nav wired to `/taxonomy?tab=…`; Labels has no nav entry.
- 4 page tests green (4-tab list, categories default, `?tab=locations` selects the stub, click round-trips the URL, unknown tab falls back).

### Task 3 — CategoriesTab + CategoryFormDialog
- `CategoriesTab`: `RetroTree` (storageKey `taxonomy:tree:categories`) from `useCategoriesQuery().tree`; toolbar `⊕ ADD ROOT CATEGORY`; onAddChild/onEdit navigate to the routed forms; onArchive opens the TAX-02 warning; onRestore fires restore. Empty (`NO CATEGORIES YET`) + error (`COULDN'T LOAD CATEGORIES` + RETRY) states.
- TAX-02 archive: on open, `fetchCount("category", id)` → `total>0` renders `⚠ "{name}" has {n} item(s) assigned…` (butter "Archive anyway"); `total=0` renders the plain butter confirm; archive proceeds unconditionally on confirm.
- `CategoryFormDialog`: routed blue Window, RHF + zod (`categorySchema`), name / description / parent (`RetroCombobox` of flattened categories EXCLUDING self + descendants via `flattenExcluding`, empty = root); `?parent=` seeds the parent on add-child; dirty-guard butter DISCARD; navigates to `/taxonomy?tab=categories` on success.
- 8 component tests green (tree nests, expand reveals child, ⊕ ADD navigates, archive-with-items count copy then archive, archive-with-0 plain copy, restore, empty, error).

## Output notes (per plan <output>)

1. **Stub handoff:** `LocationsTab` + `ContainersTab` are filled by 10-03 (Locations/Containers), `LabelsTab` by 10-04 — all IN-PLACE at their existing paths with their existing export names. `TaxonomyPage.tsx` imports them by stable path and renders each as a panel; the page needs NO re-edit when the stubs are filled.
2. **Form-routing decision:** category forms ARE routed (`/taxonomy/categories/new` + `/:id/edit`, registered in `routes/index.tsx` here). location/container/label forms are INLINE `RetroDialog`s (no route) per UI-SPEC — so `routes/index.tsx` is edited ONLY in this plan for taxonomy.
3. **useUsageCount signature for the W3 container consumer:** `const { fetchCount } = useUsageCount();` then `await fetchCount("container", containerId)` → `Promise<number>` (the paginated `.total` of `GET /inventory?container_id={id}&limit=1`). Same hook, `kind="container"`.

## Deviations from Plan

None — plan executed as written. (One test-only adjustment: the plain-archive confirm assertion scopes the "Archive" button to the dialog via `getByRole("dialog")` because the RetroTree row's `⌫` action carries `aria-label="Archive"` — a test-locator precision fix, not a behavior change.)

## Known Stubs

`LocationsTab` / `ContainersTab` / `LabelsTab` are intentional STUBS rendering pending testids. This is the planned cross-wave handoff (10-03 fills Locations/Containers, 10-04 fills Labels). They do NOT block the 10-02 goal (the page shell + Categories tab are fully functional); each is documented in-file with its owning plan.

## Threat Flags

None — no new security surface. All category reads/writes + the usage-count read carry `wsId` from `useWorkspace()` (T-10-04 mitigated by design); every mutation PREFIX-invalidates `["categories", wsId]` (T-10-03 mitigated); zero new installs (T-10-SC).

## Verification

- `bun run lint:tsc` — clean (exit 0).
- `bun run test src/features/taxonomy/` — 43 tests, 5 files green.
- `bun run test` (full suite) — 699 tests, 98 files green (no regression; +19 over the 10-01 baseline of 680/95).

## Self-Check: PASSED

All 6 spot-checked created files exist on disk; all 3 per-task commit hashes (8468773d, 26924b60, 0f58a5d5) present in git history.
