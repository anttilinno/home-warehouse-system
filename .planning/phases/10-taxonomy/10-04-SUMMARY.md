---
phase: 10-taxonomy
plan: 04
subsystem: frontend2/taxonomy
tags: [labels, TAX-07, crud, color-picker, react-query]
requires:
  - "10-01: labelsApi CRUD surface + Label type + labelSchema + MSW label handlers"
  - "10-02: TaxonomyPage shell + LabelsTab STUB (filled in-place here)"
provides:
  - "LabelsTab: flat CRUD list of workspace labels (TAX-07)"
  - "LabelFormDialog: inline RetroDialog create/edit (name + color + description)"
  - "ColorSwatchPicker: 8 on-palette swatches + none, storing hex"
  - "useLabelsQuery / useLabelMutations: BARE {items} list + PREFIX-invalidate hooks"
affects:
  - "Phase 7 item label-attach now has a manager to create/edit labels"
tech-stack:
  added: []
  patterns:
    - "BARE {items} list query (never read .total) — keyed [labels, wsId]"
    - "PREFIX invalidate (no exact:true) covering list + any detail key"
    - "render-loop guard: destructure stable .mutate / .mutateAsync; tRef for t"
    - "inline RetroDialog form (vs routed forms for the heavier taxonomy domains)"
    - "three-cue swatch discipline: color + 1px ink border + name text"
key-files:
  created:
    - frontend2/src/features/taxonomy/hooks/useLabelsQuery.ts
    - frontend2/src/features/taxonomy/hooks/useLabelMutations.ts
    - frontend2/src/features/taxonomy/hooks/useLabelMutations.test.tsx
    - frontend2/src/features/taxonomy/components/ColorSwatchPicker.tsx
    - frontend2/src/features/taxonomy/components/LabelFormDialog.tsx
    - frontend2/src/features/taxonomy/components/LabelsTab.test.tsx
  modified:
    - frontend2/src/features/taxonomy/components/LabelsTab.tsx
decisions:
  - "Delete button uses BevelButton variant=danger (no `pink` BevelButton variant exists; the pink is the confirm DIALOG titlebar)"
  - "Archive is the soft default action; delete is the destructive secondary (pink confirm)"
  - "Delete copy uses the no-count form (labels have no client attached-count fetch this phase, per UI-SPEC)"
metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 10 Plan 04: Labels Manager Tab Summary

TAX-07 label manager: a flat CRUD list of workspace labels with an 8-swatch
on-palette color picker (hex stored), archive-soft + delete, PREFIX query
invalidation, and three-cue swatch discipline. The W2 `LabelsTab` STUB was
replaced in-place; its `export function LabelsTab` name is unchanged so
`TaxonomyPage` needs no edit. Fully disjoint from the parallel 10-03
(Locations/Containers) — different files, same wave (Lock #7).

## What shipped

- **useLabelsQuery** — `["labels", wsId]` keyed query over
  `labelsApi.listWorkspaceLabels` (BARE `{items}`, never `.total`); `enabled
  !!wsId`, `retry false`, returns `{ rows, isLoading, isError, refetch }`.
- **useLabelMutations** — create / update / archive / restore / del, each
  PREFIX-invalidating `["labels", wsId]` (no `exact:true`). Toasts per the
  UI-SPEC §Toasts set (`{name} created.` / `Changes saved.` / `{name} archived.`
  / `{name} restored.` / `{name} deleted.` + generic per-verb error copy).
- **ColorSwatchPicker** — 8 fixed on-palette swatches (the UI-SPEC token set,
  resolved to hex) + a neutral "no color" option. Each swatch is a focusable
  `<button>` with a MANDATORY 1px ink border (cue #3), `aria-label`,
  `aria-pressed`; selected → 2px ink ring + ✓. Controlled `value`/`onChange`,
  stores the HEX (matching the backend `^#[0-9A-Fa-f]{6}$` pattern), drops into
  an RHF `Controller`.
- **LabelFormDialog** — inline `RetroDialog` (no route). RHF + zod
  (`labelSchema`). Name (RetroInput) + ColorSwatchPicker + optional description.
  OMIT-EMPTY body build; butter `DISCARD CHANGES?` dirty-guard.
- **LabelsTab** — flat row list: `[16×16 swatch, 1px ink border][name semibold]
  [muted description?] … [EDIT][⊟ archive][⌫ delete]`. Archived rows muted +
  `ARCHIVED` badge + `RESTORE`. Empty → `NO LABELS YET`; error → `COULDN'T LOAD
  LABELS` + `RETRY`. Delete = pink `RetroConfirmDialog` (no-count copy).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Delete action button variant**
- **Found during:** Task 3 (tsc gate)
- **Issue:** Plan/UI-SPEC describe the delete as "pink". `BevelButton` has no
  `pink` variant (only `neutral | primary | mint | danger`); the pink is the
  confirm DIALOG titlebar.
- **Fix:** Delete action button uses `variant="danger"`; the confirm dialog uses
  `titlebarVariant="pink"` + `confirmVariant="danger"` (matches the UI-SPEC
  "plain pink RetroConfirmDialog" for delete).
- **Files modified:** `LabelsTab.tsx`

Everything else executed as written.

## Threat surface

No new trust-boundary surface beyond the plan's `<threat_model>`. T-10-08
(name/color rendering) is mitigated: React escapes the name; color flows into
`style={{ backgroundColor }}` only after `labelSchema` hex validation on submit
(and the list color is the server value, never `dangerouslySetInnerHTML`).
T-10-09 (cross-tenant) is mitigated: `wsId` from `useWorkspace()` on every
query/mutation. Zero new package installs (T-10-SC).

## Verification

- `bun run test -- src/features/taxonomy/hooks/useLabelMutations.test.tsx` → 7 passed.
- `bun run test -- src/features/taxonomy/components/LabelsTab.test.tsx` → 9 passed.
- `bun run test src/features/taxonomy/` → 7 files, **59 passed**.
- `bun run lint:tsc` (`tsc -b --noEmit`) → clean.
- `bun run lint:imports` → OK.
- No edits to routes/index.tsx, Sidebar.tsx, TaxonomyPage.tsx, RetroTree.tsx,
  handlers.ts, api.ts/api/*, vite.config.ts, backend, or any 10-03-owned file.
  Changed set = exactly the 7 plan `files_modified`.

## Known Stubs

None — the W2 STUB (`<div data-testid="tab-labels-pending" />`) was fully
replaced with the real CRUD list.

## Self-Check: PASSED
