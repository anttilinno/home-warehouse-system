---
phase: 07-items-photos
plan: 05
subsystem: ui
tags: [react-hook-form, zod, react-query, react-router, forms, retro-os]

# Dependency graph
requires:
  - phase: 07-items-photos (Plan 01)
    provides: itemsApi (create/update/get), lib/types Item, MSW item handlers
  - phase: 07-items-photos (Plan 03)
    provides: useItemMutations invalidation pattern (prefix keys, no exact:true)
  - phase: 04 (atoms)
    provides: Window, RetroInput, RetroFormField, RetroCombobox, RetroTextarea, RetroConfirmDialog, RetroBadge, BevelButton, retroToast
provides:
  - ItemFormPage (/items/new + /items/:id/edit) — RHF+zod create/edit form
  - itemFormSchema (zod) + ItemFormValues/ItemFormInput types
  - useItemFormMutations (create + update, dirty-fields PATCH builder)
  - ?barcode= prefill with FROM SCAN affordance (ITEM-03)
  - PATCH clear-semantics handling (""=clear, omit=unchanged, uuid never cleared)
  - optimistic invalidation of ["items", wsId] prefix + ["items", wsId, "detail", id]
  - dirty-form discard guard (DISCARD CHANGES? butter confirm)
affects: [07-06 (route registration wires these pages), 11 (scan→prefill flow)]

# Tech tracking
tech-stack:
  added: []  # RHF 7.74 / zod 4.4.1 / @hookform/resolvers 5.2.2 already installed (no installs)
  patterns:
    - "RHF dirtyFields → PATCH builder enforces Pitfall 4 (omit=unchanged, ''=clear)"
    - "Discard guard without useBlocker (declarative router has no data router)"
    - "FROM SCAN badge in RetroFormField label row + raw mono input for the barcode field"

key-files:
  created:
    - frontend2/src/features/items/schema.ts
    - frontend2/src/features/items/hooks/useItemFormMutations.ts
    - frontend2/src/features/items/hooks/useItemFormMutations.test.tsx
    - frontend2/src/features/items/ItemFormPage.tsx
    - frontend2/src/features/items/ItemFormPage.test.tsx
  modified: []

key-decisions:
  - "Numeric form field wires to the real backend min_stock_level (no `quantity` on the item entity — that is inventory/7b); labelled Quantity per UI-SPEC"
  - "Category/Location comboboxes are free-text display-only and NOT submitted (no taxonomy API exists; category_id is a backend uuid a free string can't resolve) — documented stub"
  - "Discard guard implemented WITHOUT react-router useBlocker because the app is declarative-mode (<Routes>, AP-1); useBlocker requires a data router and throws otherwise"

patterns-established:
  - "buildPatchBody(values, dirtyFields): the canonical Pitfall-4-safe PATCH constructor for item edits"
  - "attemptLeave(to) + beforeunload: data-router-free dirty-form navigation guard"

requirements-completed: [ITEM-03, ITEM-04]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 7 Plan 05: Create/Edit Item Forms Summary

**RHF+zod single-window create/edit item form (`/items/new` + `/items/:id/edit`) with `?barcode=` prefill, a Pitfall-4-safe dirty-fields PATCH builder, prefix+detail-key optimistic invalidation, and a data-router-free discard guard.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 (both TDD)
- **Files created:** 5
- **Files modified:** 0

## Accomplishments
- `itemFormSchema` (zod): name required, optional description/barcode/minStock; coerced numeric minStock ≥0; inferred input/output types.
- `useItemFormMutations`: create + update mutations; `buildPatchBody` builds the PATCH from RHF `dirtyFields` so a cleared string field sends `""` (clear) while an untouched field is omitted (unchanged), and uuid `category_id` is never sent — the threat T-07-15 mitigation, test-proven.
- Create invalidates the `["items", wsId]` prefix; edit invalidates the prefix **and** the explicit `["items", wsId, "detail", id]` key. No `exact:true`.
- `ItemFormPage`: one blue `Window` (`ADD ITEM` / `EDIT ITEM`, `max-w-[560px]`), grouped fields (Identity / Quantity & code / Notes), per-field `aria-invalid` + `✕` danger treatment, form-level error banner, `retroToast` on success/failure.
- `/items/new?barcode=XXXX` prefills the Barcode field (controlled RHF input — React-escaped, T-07-14 safe) + shows the `FROM SCAN` info badge in the field label row and the "Prefilled from scan — edit if needed." hint.
- Edit mode loads via `itemsApi.get`, resets the form, and a cleared description submits `""`.
- Dirty-form `DISCARD CHANGES?` butter confirm (DISCARD / KEEP EDITING) gating Cancel/leave + a `beforeunload` guard for tab-close.

## Task Commits

1. **Task 1: zod schema + useItemFormMutations** — `792782be` (feat, TDD)
2. **Task 2: ItemFormPage (create + edit, ?barcode prefill, discard guard)** — `44e457e5` (feat, TDD)

## Files Created/Modified
- `frontend2/src/features/items/schema.ts` — zod item create/edit schema + inferred types.
- `frontend2/src/features/items/hooks/useItemFormMutations.ts` — create/update mutations + `buildCreateBody`/`buildPatchBody` (Pitfall 4).
- `frontend2/src/features/items/hooks/useItemFormMutations.test.tsx` — schema + PATCH-builder + invalidation tests (9).
- `frontend2/src/features/items/ItemFormPage.tsx` — the create/edit form page.
- `frontend2/src/features/items/ItemFormPage.test.tsx` — page tests: empty create, ?barcode prefill + FROM SCAN, submit→navigate, empty-name block, discard confirm, edit load/reset, cleared-description PATCH `""` (7).

## Decisions Made
- **Numeric field → `min_stock_level`.** The backend item entity has no `quantity` field (quantity is inventory, arriving in 7b). The UI-SPEC's "Quantity" field is wired to the real `min_stock_level` `*int` so the form writes a real backend column instead of a phantom field.
- **Category/Location are display-only.** No categories/locations API or hook exists in `frontend2` yet, and `category_id` is a backend uuid that a free-typed string cannot resolve. The comboboxes render for UX continuity (UI-SPEC §3) but their values are NOT submitted (see Known Stubs).
- **No `useBlocker`.** See Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Discard guard wired without react-router `useBlocker`**
- **Found during:** Task 2 (ItemFormPage)
- **Issue:** The plan/UI-SPEC name react-router `useBlocker` for the dirty-form guard. `useBlocker` calls `useDataRouterContext` and throws `"useBlocker must be used within a data router"` unless mounted under a data router (`createBrowserRouter`/`RouterProvider`). The app is declarative-mode (`<Routes>`, AP-1 — `routes/index.tsx`), so `useBlocker` would crash both the page at runtime and every test that renders it under `<MemoryRouter>`.
- **Fix:** Implemented the guard without `useBlocker`: in-app leave attempts (Cancel and any leave) route through `attemptLeave(to)`, which stages the destination and opens the butter `DISCARD CHANGES?` confirm when the form is dirty (proceeding on DISCARD, staying on KEEP EDITING); a `beforeunload` listener covers reload/tab-close. Documented inline so 07-06 can re-add the cross-route blocker if it migrates the router to a data router.
- **Files modified:** `frontend2/src/features/items/ItemFormPage.tsx`
- **Verification:** `ItemFormPage.test.tsx` "opens the DISCARD CHANGES? confirm when cancelling a dirty form" passes (confirm appears, navigation intercepted, DISCARD proceeds to the list).
- **Committed in:** `44e457e5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The guard delivers the exact UX the UI-SPEC specifies (butter DISCARD CHANGES? on dirty leave) via a mechanism compatible with the shipped declarative router. No scope creep; the cross-route interception that a data router would add is noted for 07-06.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Category combobox value not submitted | `ItemFormPage.tsx` (Group 1) | No taxonomy API/hook; `category_id` is a backend uuid a free-typed string can't resolve. Resolves when a categories API + hook land (a later plan). |
| Location combobox value not submitted | `ItemFormPage.tsx` (Group 1) | No location list/filter on the item contract (07-RESEARCH Open Q1 — backend gap, deferred post-parity). |

Both stubs are intentional and do not block ITEM-03/ITEM-04: the form fully creates/edits items via the real `name`/`description`/`barcode`/`min_stock_level` fields. The comboboxes are UX placeholders per UI-SPEC §3 pending a taxonomy contract.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. T-07-14 (XSS via ?barcode) and T-07-15 (malformed PATCH) are both mitigated and test-proven; T-07-16 stays backend-authoritative (every path carries wsId).

## Issues Encountered
- `useBlocker` data-router requirement (resolved — see Deviations).
- `getByText(/from scan/i)` matched both the badge and the hint; tightened to `/^from scan$/i` (test-only).

## Self-Check: PASSED
- All 5 created files present on disk (verified).
- Both task commits present (`792782be`, `44e457e5`) — verified in git log.
- Full Vitest suite green (65 files / 450 tests); `tsc -b --noEmit` clean.

## Next Phase Readiness
- `ItemFormPage` exports the create/edit pages; **07-06 wires the `/items/new` and `/items/:id/edit` routes** (this plan deliberately did NOT touch `routes/index.tsx`).
- `itemsApi.lookupByBarcode` (re-added in 07-01) + the `?barcode=` prefill path are ready for the Phase 11 scan flow.

---
*Phase: 07-items-photos*
*Completed: 2026-06-13*
