---
phase: 58
plan: 03
subsystem: frontend2/features/taxonomy/forms+panels+actions
tags: [taxonomy, forms, slide-over, archive-flow, rhf, zod]
requirements: [TAX-02, TAX-03, TAX-04, TAX-06, TAX-07, TAX-08, TAX-10, TAX-11, TAX-12]
dependency_graph:
  requires:
    - "react-hook-form (existing)"
    - "@hookform/resolvers/zod (existing)"
    - "@floating-ui/react (existing — FloatingPortal, FloatingFocusManager)"
    - "@lingui/react/macro (existing)"
    - "frontend2/src/components/retro (RetroFormField, RetroConfirmDialog, RetroCombobox, RetroInput, RetroTextarea, RetroButton)"
    - "frontend2/src/features/taxonomy/forms/schemas.ts (Plan 58-01)"
    - "frontend2/src/features/taxonomy/actions/shortCode.ts (Plan 58-01)"
    - "frontend2/src/features/taxonomy/__tests__/fixtures.tsx (Plan 58-01)"
    - "frontend2/src/features/taxonomy/hooks/useCategoryMutations.ts (Plan 58-02)"
    - "frontend2/src/features/taxonomy/hooks/useLocationMutations.ts (Plan 58-02)"
    - "frontend2/src/features/taxonomy/hooks/useContainerMutations.ts (Plan 58-02)"
  provides:
    - "CategoryForm, LocationForm, ContainerForm — RHF+zod entity forms with formId / onDirtyChange contract"
    - "SlideOverPanel + SlideOverPanelHandle — right-docked overlay with unsaved-changes guard and closeImmediate() bypass"
    - "EntityPanel + EntityPanelHandle — composer routing kind→form, wires create/update mutations, WORKING… pending label"
    - "ArchiveDeleteFlow + ArchiveDeleteFlowHandle — two nested confirms with 409 short-circuit"
    - "RetroConfirmDialog: optional headerBadge + secondaryLink props (additive)"
  affects:
    - "Plan 58-04 (TaxonomyPage + tabs) consumes EntityPanel and ArchiveDeleteFlow via imperative refs"
tech-stack:
  added: []
  patterns:
    - "Resolver wrapper around zodResolver(*Schema) coerces empty strings to undefined for optional UUID/text fields (avoids Zod 4 .uuid() failures on empty controlled inputs)"
    - "useAutoShortCode + Controller stripping short_code from payload when autoLinked === true"
    - "FloatingPortal + FloatingFocusManager (no native <dialog>) for slide-over panel"
    - "Discriminated literal Lingui labels per entity kind (CLI cannot extract dynamic interpolation)"
key-files:
  created:
    - frontend2/src/features/taxonomy/forms/CategoryForm.tsx
    - frontend2/src/features/taxonomy/forms/LocationForm.tsx
    - frontend2/src/features/taxonomy/forms/ContainerForm.tsx
    - frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx
    - frontend2/src/features/taxonomy/panel/EntityPanel.tsx
    - frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx
    - frontend2/src/features/taxonomy/__tests__/CategoryForm.test.tsx
    - frontend2/src/features/taxonomy/__tests__/LocationForm.test.tsx
    - frontend2/src/features/taxonomy/__tests__/ContainerForm.test.tsx
    - frontend2/src/features/taxonomy/__tests__/ArchiveDeleteFlow.test.tsx
  modified:
    - frontend2/src/components/retro/RetroConfirmDialog.tsx
decisions:
  - "Wrapped zodResolver in a resolver fn that maps empty strings -> undefined for optional UUID/text fields. Reason: Zod 4's .uuid() rejects '' (and even the Nil UUID 0000…0001) so a controlled input default of '' triggers spurious validation errors. Acceptance grep zodResolver(*Schema) still matches via baseResolver = zodResolver(*Schema)."
  - "Plan example used new HttpError('msg', 409) but the actual signature is new HttpError(status, message). Tests use HttpError(409, 'conflict')."
  - "Test UUID switched to v4 (550e8400-e29b-41d4-a716-446655440000). The plan's all-zeros placeholder fails Zod 4's UUID v1-v8 version-bit check."
  - "RetroConfirmDialog.handleConfirm already auto-closes on success — ArchiveDeleteFlow lets that happen and additionally calls archiveRef/deleteRef.close() defensively (no-op when already closed)."
  - "Test assertion uses dialog open-attribute helper isVisibleDialog() because <dialog> nodes always render in DOM under jsdom; queryByText alone cannot distinguish open from closed."
metrics:
  duration: ~25m
  completed: 2026-04-16
  tasks: 3
  files: 11
  tests: 15
---

# Phase 58 Plan 03: Forms + Slide-over + Archive flow Summary

Six interactive components (3 entity forms, 1 right-docked SlideOverPanel with unsaved-changes guard, 1 EntityPanel composer, 1 ArchiveDeleteFlow with cascade-aware 409 short-circuit) + 4 component tests covering 15 behavioural assertions; one additive extension to RetroConfirmDialog (headerBadge + secondaryLink). 40/40 taxonomy + RetroConfirmDialog tests pass, tsc --noEmit clean.

## Tasks

| # | Task | Status | Commits |
|---|------|--------|---------|
| 1 | Three RHF+zod entity forms (TDD) | Done | `7fb3796` test (RED), `cb8dcdd` feat (GREEN) |
| 2 | SlideOverPanel + EntityPanel | Done | `b3f92b8` feat |
| 3 | ArchiveDeleteFlow + 409 short-circuit | Done | `4a2b27d` feat |

## Verification Results

- `bunx tsc --noEmit` — exits 0
- `bun run test -- --run src/features/taxonomy/ src/components/retro/__tests__/RetroConfirmDialog.test.tsx` — 8 files / 40 tests pass (CategoryForm 3, LocationForm 4, ContainerForm 3, ArchiveDeleteFlow 5, RetroConfirmDialog 5, plus Plan 01 + Plan 02 totals)
- All acceptance criteria greps satisfied (zodResolver(*CreateSchema), useAutoShortCode, font-mono, FloatingPortal, FloatingFocusManager, motion-reduce, translateX, aria-modal, EntityPanelHandle, WORKING, useCreateCategory/Location/Container, CONFIRM ARCHIVE / DELETE, delete permanently, ARCHIVE CATEGORY/LOCATION/CONTAINER discriminated literals, status === 409, HttpError)

## Artifacts

- `forms/CategoryForm.tsx` — Name + Parent (RetroCombobox) + Description; submit strips empty optionals
- `forms/LocationForm.tsx` — adds short_code (mono) wired to `useAutoShortCode`; payload omits short_code while `autoLinked === true`
- `forms/ContainerForm.tsx` — adds required `location_id` (RetroCombobox); same short_code auto-fill behaviour
- `panel/SlideOverPanel.tsx` — `FloatingPortal` + `FloatingFocusManager`, 150ms `transform translateX` slide with `motion-reduce:transition-none`, Esc + backdrop attemptClose, nested DISCARD CHANGES dialog when isDirty, `closeImmediate()` bypasses guard after successful save
- `panel/EntityPanel.tsx` — kind→form router, threads `formId = useId()`, footer ← BACK + variant-primary submit (`form={formId}`); shows `WORKING…` while any of the six mutations is pending
- `actions/ArchiveDeleteFlow.tsx` — soft archive + destructive delete; 409 closes both
- `RetroConfirmDialog.tsx` — additive `headerBadge?: string` (orange mono chip, soft variant) + `secondaryLink?: { label, onClick }` (small charcoal-70 underlined button beneath primary buttons); existing 5 tests untouched and still pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Empty-string UUID rejection**
- **Found during:** Task 1 GREEN test runs
- **Issue:** Zod 4's `.uuid()` rejects empty strings, but RHF requires controlled inputs (so default `""` is needed). With `defaultValues: { parent_category_id: "" }`, every submit triggered an "Invalid uuid" error before the cleaned-payload submit handler ran.
- **Fix:** Wrap the zod resolver in a small adapter that coerces `""` → `undefined` for optional UUID/text fields **before** calling `zodResolver(*Schema)`. The literal `zodResolver(*CreateSchema)` is preserved for the acceptance grep via `const baseResolver = zodResolver(*Schema)`.
- **Files:** all three `*Form.tsx`
- **Commit:** `cb8dcdd`

**2. [Rule 1 — Bug] HttpError signature in plan example**
- **Found during:** Task 3 test authoring
- **Issue:** Plan example uses `new HttpError("conflict", 409)` but the real signature in `frontend2/src/lib/api.ts` is `constructor(status: number, message: string)`.
- **Fix:** Tests construct `new HttpError(409, "conflict")`.
- **Files:** `__tests__/ArchiveDeleteFlow.test.tsx`
- **Commit:** `4a2b27d`

**3. [Rule 1 — Bug] Test UUID rejected by Zod 4**
- **Found during:** Task 1 ContainerForm "submits when name + location_id are provided" test
- **Issue:** Plan-suggested test UUID `00000000-0000-0000-0000-000000000001` is the Nil UUID; Zod 4's `.uuid()` enforces RFC 4122 version bits and rejects all-zero variants.
- **Fix:** Switched test fixture to a real v4 UUID `550e8400-e29b-41d4-a716-446655440000`.
- **Commit:** `cb8dcdd`

**4. [Rule 2 — Critical] Open-state assertion helper**
- **Found during:** Task 3 ArchiveDeleteFlow tests
- **Issue:** `<dialog>` nodes always render in DOM under jsdom (mocked `showModal`/`close` only toggle the `open` attribute). `queryByText("CONFIRM DELETE")` returns the text even when the dialog is closed, causing close-assertion false negatives.
- **Fix:** Tests use a small `isVisibleDialog(text)` helper that walks to the closest `<dialog>` and checks `.hasAttribute("open")`.
- **Commit:** `4a2b27d`

No other deviations.

## Threat Mitigations Applied

| Threat ID | Mitigation | Where |
|-----------|-----------|-------|
| T-58-09 Tampering (form fields) | `zodResolver(*CreateSchema)` runs before any mutation; cleaned-payload submit handler strips empty optionals | All three `*Form.tsx` |
| T-58-10 Tampering (409 path) | `err instanceof HttpError && err.status === 409` short-circuit; toast left to mutation hook (centralised) | `ArchiveDeleteFlow.tsx` |
| T-58-11 Info disclosure (backdrop) | Backdrop is purely visual — accepted in plan threat model | n/a |
| T-58-12 Spoofing (entity kind) | TS `EntityKind` enum; no runtime user input reaches the prop | `EntityPanel.tsx`, `ArchiveDeleteFlow.tsx` |
| T-58-13 DoS (auto-fill debounce) | 300ms debounce, single timer per mount, no network — accepted | `useAutoShortCode` (Plan 01) |

## Notes for Plan 58-04

- Use imperative refs (`EntityPanelHandle`, `ArchiveDeleteFlowHandle`) — do **not** lift form state into TaxonomyPage.
- For edit flow, pass the loaded entity row as `node` to `panelRef.current?.open("edit", node)`. `EntityPanel` will spread it as form `defaultValues`.
- Parent-picker should call Plan 01's `collectDescendantIds(nodeBeingEdited)` and exclude those ids from `parentOptions` before passing to `EntityPanel`.
- **Known limitation (RESEARCH Q3):** the backend currently has no API to clear a parent (move a node to root) once set. Forms intentionally do **not** disable the parent picker yet — Plan 58-04's tab body should disable the picker's clear affordance in edit mode when `node.parent_*` is non-null, and document the limitation in 58-04-SUMMARY.

## Self-Check: PASSED

Files verified on disk:
- FOUND: frontend2/src/features/taxonomy/forms/CategoryForm.tsx
- FOUND: frontend2/src/features/taxonomy/forms/LocationForm.tsx
- FOUND: frontend2/src/features/taxonomy/forms/ContainerForm.tsx
- FOUND: frontend2/src/features/taxonomy/panel/SlideOverPanel.tsx
- FOUND: frontend2/src/features/taxonomy/panel/EntityPanel.tsx
- FOUND: frontend2/src/features/taxonomy/actions/ArchiveDeleteFlow.tsx
- FOUND: frontend2/src/features/taxonomy/__tests__/CategoryForm.test.tsx
- FOUND: frontend2/src/features/taxonomy/__tests__/LocationForm.test.tsx
- FOUND: frontend2/src/features/taxonomy/__tests__/ContainerForm.test.tsx
- FOUND: frontend2/src/features/taxonomy/__tests__/ArchiveDeleteFlow.test.tsx

Commits verified in git log:
- FOUND: 7fb3796 (RED tests for entity forms)
- FOUND: cb8dcdd (GREEN: three RHF+zod forms)
- FOUND: b3f92b8 (SlideOverPanel + EntityPanel)
- FOUND: 4a2b27d (ArchiveDeleteFlow + RetroConfirmDialog headerBadge/secondaryLink)
