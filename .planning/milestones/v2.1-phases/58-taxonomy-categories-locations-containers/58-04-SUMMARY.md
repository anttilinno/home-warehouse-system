---
phase: 58
plan: 04
subsystem: frontend2/features/taxonomy/page+tabs+tree
tags: [taxonomy, page, tabs, tree, route, i18n, human-verify]
requirements: [TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, TAX-06, TAX-07, TAX-08, TAX-09, TAX-10, TAX-11, TAX-12]
dependency_graph:
  requires:
    - "@tanstack/react-query (existing)"
    - "@lingui/react/macro (existing)"
    - "frontend2/src/components/retro (RetroTabs, RetroPanel, RetroButton, RetroCombobox, RetroCheckbox, RetroEmptyState, RetroBadge, HazardStripe)"
    - "frontend2/src/features/taxonomy/hooks/* (Plan 58-02)"
    - "frontend2/src/features/taxonomy/panel/EntityPanel (Plan 58-03)"
    - "frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow (Plan 58-03)"
    - "frontend2/src/features/taxonomy/tree/buildTree + collectDescendantIds (Plan 58-01)"
    - "frontend2/src/features/taxonomy/hooks/useHashTab (Plan 58-01)"
  provides:
    - "TreeNode<T> recursive row + TaxonomyTree wrapper with keyboard nav"
    - "CategoriesTab, LocationsTab, ContainersTab tab bodies"
    - "TaxonomyPage at /taxonomy with three-tab RetroTabs + hash sync"
    - "Local icons.tsx (SVG replacements for lucide-react)"
  affects:
    - "AppShell navigation gains a /taxonomy destination (route registered)"
    - "EN + ET Lingui catalogs extended with Phase 58 taxonomy keys"
tech-stack:
  added: []
  patterns:
    - "Flat-visible render list drives tree keyboard nav (single pass based on expandedIds)"
    - "Local icons.tsx replaces lucide-react (not a dependency; [Rule 3 blocking])"
    - "ContainersTab groups by location_id using Map<locId, Container[]> preserving location order"
    - "Always-fetch-with-archived pattern — tab toggles display, not the query"
key-files:
  created:
    - frontend2/src/features/taxonomy/tree/TreeNode.tsx
    - frontend2/src/features/taxonomy/tree/TaxonomyTree.tsx
    - frontend2/src/features/taxonomy/tabs/CategoriesTab.tsx
    - frontend2/src/features/taxonomy/tabs/LocationsTab.tsx
    - frontend2/src/features/taxonomy/tabs/ContainersTab.tsx
    - frontend2/src/features/taxonomy/TaxonomyPage.tsx
    - frontend2/src/features/taxonomy/icons.tsx
    - frontend2/src/features/taxonomy/__tests__/TaxonomyPage.test.tsx
    - frontend2/src/features/taxonomy/__tests__/ContainersTab.test.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
    - frontend2/src/features/taxonomy/forms/CategoryForm.tsx (cast fix)
    - frontend2/src/features/taxonomy/forms/LocationForm.tsx (cast fix)
    - frontend2/src/features/taxonomy/forms/ContainerForm.tsx (cast fix)
    - frontend2/src/pages/ApiDemoPage.tsx (drop invalid style prop)
decisions:
  - "Local icons.tsx instead of lucide-react — plan listed lucide-react in interfaces but the package is not in package.json and success criteria forbid new runtime deps. SVG paths copied from public Lucide sources."
  - "Always fetch all items (showArchived=true) in Categories/Locations tabs and filter client-side. Simpler cache; single query; display toggle controls which roots render."
  - "ContainersTab renders a grouped list (not a tree) since containers are one level deep per location_id."
  - "ET translations filled with [ET] <msgid> placeholder to match existing catalog convention and satisfy 'no empty msgstr' rule."
metrics:
  duration: ~35m
  completed: 2026-04-16
  tasks: 3 (task 4 = human checkpoint, pending)
  files_created: 9
  files_modified: 7
  tests_added: 7
---

# Phase 58 Plan 04: Taxonomy Page + Tabs + Tree Summary

One-liner: Six source files plus two integration tests assemble Plans 01/02/03 into the user-visible `/taxonomy` page — three-tab RetroTabs (Categories, Locations, Containers) with hash-sync, a recursive `TreeNode` + `TaxonomyTree` with full keyboard nav, and a human-verify checkpoint awaiting end-to-end UAT against the real Go backend.

## Tasks

| # | Task | Status | Commits |
|---|------|--------|---------|
| 1 | TreeNode + TaxonomyTree (recursive + keyboard nav) | Done | `636fc96` |
| 2 | Three tab bodies + TaxonomyPage + route wiring | Done | `a2d3638` |
| 3 | Integration tests + Lingui EN/ET extraction | Done | `4cc40c2` |
| 4 | Human verification — end-to-end /taxonomy flows | **Awaiting** | — |

## Verification Results

- `bunx tsc --noEmit` — exits 0
- `bunx tsc -b && bunx vite build` — exits 0 (533 kB bundle, 159 kB gzip)
- `bun run test -- --run src/features/taxonomy/` — **9 test files / 42 tests pass** (1.62s)
- `bun run i18n:compile` — exits 0
- Acceptance greps (all pass): `^export function TreeNode`, `^export function TaxonomyTree`, `role="treeitem"`, `role="tree"`, `aria-expanded`, `line-through`, `ChevronDown/Right`, `ArrowDown/Right`, `ARCHIVED`, `depth * 24`, `export default function TaxonomyPage`, `useHashTab`, `RetroTabs`, `useCategoriesTree`, `useLocationsTree`, `useContainersByLocation`, `+ NEW {CATEGORY,LOCATION,CONTAINER}`, `NO CATEGORIES YET`, `path="taxonomy"`, `TaxonomyPage`
- Lingui keys verified: `TAXONOMY`, `NO CATEGORIES YET`, `Move or delete child nodes first`, `delete permanently` in EN; taxonomy keys in ET have non-empty `[ET] ...` translations

## Artifacts

- `tree/TreeNode.tsx` — recursive row component: `role="treeitem"`, `aria-expanded`, 24px/depth indentation, chevron toggle, edit/archive/restore action buttons (icon-only mobile, icon+label ≥lg), `font-sans` name + `font-mono` short_code, strikethrough + ARCHIVED badge for archived nodes, amber left rail on `activeEditId`.
- `tree/TaxonomyTree.tsx` — `role="tree"` wrapper, flat-visible render, complete keyboard nav (ArrowDown/Up/Right/Left/Home/End/Enter), collapsible `ARCHIVED (N)` section when `showArchived === false`.
- `tabs/CategoriesTab.tsx` — `useCategoriesTree(true)`, split into active/archived roots client-side, `Show archived` toggle, `+ NEW CATEGORY` CTA, `RetroEmptyState` with heading `NO CATEGORIES YET`, loading + error + success state cascade, wires `EntityPanel` + `ArchiveDeleteFlow` via imperative refs; `parentOptions` exclude self + descendants via `collectDescendantIds`.
- `tabs/LocationsTab.tsx` — same shape as Categories but for locations; parent options include `short_code` in label; `+ NEW LOCATION` CTA.
- `tabs/ContainersTab.tsx` — grouped list (not a tree): RetroCombobox location filter, Show archived toggle, groups by `location_id` preserving location order, renders `short_code` (mono) + name (sans) + per-row archive/edit/restore, disabled CTA with `Create a location first.` helper when zero locations.
- `TaxonomyPage.tsx` — `<h1>TAXONOMY</h1>` + RetroTabs + tabpanel rendering the active tab; URL hash driven by `useHashTab<"categories"|"locations"|"containers">`.
- `icons.tsx` — local SVG replacements for `ChevronRight/Down/Pencil/Archive/Undo2/Plus` (lucide-react is not a dep).
- `routes/index.tsx` — added `<Route path="taxonomy" element={<TaxonomyPage />} />` inside the authed `AppShell` block.
- Tests: `TaxonomyPage.test.tsx` (4 tests: default tab + CATEGORIES visible, click LOCATIONS sets `#locations`, external hashchange switches to CONTAINERS, empty state CTA), `ContainersTab.test.tsx` (3 tests: grouped render with two locations and three containers, empty state + disabled CTA when no locations, click + NEW CONTAINER opens panel with `NEW CONTAINER` title).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Replaced lucide-react imports with local icons.tsx**
- **Found during:** Task 2 build
- **Issue:** Plan interfaces block lists `lucide-react: ChevronRight, ChevronDown, Pencil, Archive, Undo2, Plus, X` but the package is not a dependency of frontend2 and success criterion #4 forbids new runtime deps.
- **Fix:** Created `frontend2/src/features/taxonomy/icons.tsx` with six inline SVG icon components matching the lucide API (`size`, `className`, `aria-hidden="true"`). All Phase 58 files import from `../icons` (or `./icons` for siblings).
- **Files:** `icons.tsx` (new), `tree/TreeNode.tsx`, `tree/TaxonomyTree.tsx`, `tabs/{Categories,Locations,Containers}Tab.tsx`
- **Commits:** `a2d3638`, `4cc40c2`

**2. [Rule 1 — Bug] Fixed pre-existing type errors in Plan 58-03 form resolvers**
- **Found during:** Task 2 `bun run build` (tsc -b picks them up; `tsc --noEmit` default config hid them)
- **Issue:** `CategoryForm.tsx`, `LocationForm.tsx`, `ContainerForm.tsx` resolver wrapper returns `baseResolver(cleaned, ctx, opts)` where TS cannot infer `cleaned` matches `CategoryCreateValues`/`LocationCreateValues`/`ContainerCreateValues` because spreading an unknown record widens types.
- **Fix:** Cast `cleaned as {Form}CreateValues` before passing to `baseResolver`. Runtime behavior unchanged — zod still validates the cast value. Plan 58-03 SUMMARY's claim of clean tsc was accurate for `tsc --noEmit` but not `tsc -b`; this plan's build must pass to satisfy acceptance criterion "`bun run build` exits 0".
- **Files:** all three form files
- **Commit:** `a2d3638`

**3. [Rule 1 — Bug] Dropped invalid `style` prop on RetroPanel**
- **Found during:** Task 2 build
- **Issue:** `frontend2/src/pages/ApiDemoPage.tsx` passes `style={{ borderColor: "var(--color-retro-red)" }}` to `<RetroPanel>` but that component does not declare `style` in its props. Pre-existing from Plan 56.
- **Fix:** Removed the style prop; RetroPanel already renders a HazardStripe child and red `<p>` inside error blocks, so visual signal is preserved. My three tabs follow the same (corrected) pattern.
- **Files:** `ApiDemoPage.tsx`
- **Commit:** `a2d3638`

**4. [Rule 3 — Blocking] RetroCheckbox requires `label` prop**
- **Found during:** Task 2 build
- **Issue:** Plan pseudocode wrapped `<RetroCheckbox>` in `<label>` with children text, but `RetroCheckboxProps` requires `label: string` and does not render children.
- **Fix:** Pass `label={`${t\`Show archived\`} (${archivedCount})`}` directly to the checkbox; drop the wrapping `<label>`. Accessibility preserved (RetroCheckbox renders its own label element).
- **Files:** `CategoriesTab.tsx`, `LocationsTab.tsx`, `ContainersTab.tsx`

**5. [Rule 3 — Blocking] RetroEmptyState uses `title` not `heading`**
- **Found during:** Task 2 build
- **Issue:** Plan action pseudocode writes `<RetroEmptyState heading={...} />` but the component prop is `title`.
- **Fix:** Renamed prop to `title` in all three tab call sites.

**6. [Documentation] Lingui scripts are `i18n:extract` / `i18n:compile`, not `lingui:extract` / `lingui:compile`**
- **Found during:** Task 3 verify block (plan's verify ran `bun run lingui:compile`, which does not exist)
- **Fix:** Ran `bun run i18n:extract` and `bun run i18n:compile` (both exit 0). Catalog paths are `frontend2/locales/{en,et}/messages.po`, not `frontend2/src/locales/...`.

**7. [Rule 2 — Critical] ET msgstr placeholders**
- **Found during:** Task 3 post-extract
- **Issue:** `bun run i18n:extract` leaves `msgstr ""` for new ET keys; plan acceptance requires non-empty translations.
- **Fix:** Filled all 83 new taxonomy-source ET entries with `[ET] <msgid>` placeholder — matches the convention already used in the ET catalog (e.g., `msgstr "[ET] ← PREV"`) and signals "not yet translated" to future human translators without violating the no-empty-msgstr rule.

No other deviations.

## Threat Mitigations Applied

| Threat ID | Mitigation | Where |
|-----------|-----------|-------|
| T-58-14 Spoofing (/taxonomy route) | Route nested inside authed `AppShell` wrapped by existing `RequireAuth`; no new auth surface | `routes/index.tsx` |
| T-58-15 Tampering (URL hash) | `useHashTab` allowlist check before `history.replaceState` — invalid hashes fall back to default | `TaxonomyPage.tsx` + `useHashTab.ts` |
| T-58-16 Info disclosure (toast copy) | All toasts are Lingui-wrapped sanitized strings; mutation hooks own error copy (no raw backend messages) | mutation hooks (Plan 02) |
| T-58-17 XSS (tree node name rendering) | React default text escaping; no `dangerouslySetInnerHTML` in any Phase 58 file | grep-verified |
| T-58-18 DoS (large trees) | `useMemo(buildTree, [items])` caps cost at O(n); documented realistic cap <100 nodes | tabs + `buildTree` |
| T-58-19 Spoofing (hash injection) | Allowlist in `useHashTab.change()` and `.read()` — writes only after validating against `TAB_KEYS` | `useHashTab.ts` |

## Checkpoint Pending

**Task 4: `checkpoint:human-verify`** is blocking and awaiting human verification against a running dev server (`cd frontend2 && bun run dev`) with the Go backend up. The 18 end-to-end checks cover TAX-01..TAX-12 plus cross-cutting concerns (hash deep-link, unsaved-changes guard, i18n locale switch, reduce-motion, keyboard nav). See `.planning/phases/58-taxonomy-categories-locations-containers/58-04-PLAN.md` Task 4 `<how-to-verify>` block for the full script.

**Resume signal:** User types `approved` if all 18 checks pass; otherwise provides the failing check numbers with observed-vs-expected details.

## Self-Check: PASSED

Files verified on disk:
- FOUND: frontend2/src/features/taxonomy/tree/TreeNode.tsx
- FOUND: frontend2/src/features/taxonomy/tree/TaxonomyTree.tsx
- FOUND: frontend2/src/features/taxonomy/tabs/CategoriesTab.tsx
- FOUND: frontend2/src/features/taxonomy/tabs/LocationsTab.tsx
- FOUND: frontend2/src/features/taxonomy/tabs/ContainersTab.tsx
- FOUND: frontend2/src/features/taxonomy/TaxonomyPage.tsx
- FOUND: frontend2/src/features/taxonomy/icons.tsx
- FOUND: frontend2/src/features/taxonomy/__tests__/TaxonomyPage.test.tsx
- FOUND: frontend2/src/features/taxonomy/__tests__/ContainersTab.test.tsx
- FOUND: frontend2/src/routes/index.tsx (modified — TaxonomyPage import + taxonomy route added)
- FOUND: frontend2/locales/en/messages.po (266 entries incl. new Phase 58 keys)
- FOUND: frontend2/locales/et/messages.po (266 entries; taxonomy keys non-empty)

Commits verified in git log:
- FOUND: 636fc96 (Task 1)
- FOUND: a2d3638 (Task 2)
- FOUND: 4cc40c2 (Task 3)
