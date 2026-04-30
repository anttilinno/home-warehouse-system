---
phase: 65-item-lookup-and-not-found-flow
plan: 05
subsystem: ui
tags: [form, react-hook-form, form-provider, page, dirty-guard, enrichment, banner, brand-field, tanstack-query, lingui, retro-atoms]

requires:
  - phase: 65-item-lookup-and-not-found-flow
    provides: "Plan 65-01 Wave 0 scaffolds (12 + 18 it.todo) + Plan 65-02 D-23 brand field on itemCreateSchema + D-24 barcode regex loosening + Plan 65-03 useBarcodeEnrichment hook + BarcodeProduct shape"
provides:
  - "ItemForm now FormProvider-wrapped + renders a BRAND RetroFormField between BARCODE and DESCRIPTION (D-23) + optional beforeForm slot so sibling components (UpcSuggestionBanner) can read useFormContext"
  - "UpcSuggestionBanner: LOOK-03 opt-in enrichment banner with per-field [USE] + USE ALL + DISMISS; BRAND [USE] writes setValue(\"brand\", ..., { shouldDirty: true }) directly (D-23 — no description concatenation workaround); never writes category_id (D-15)"
  - "ItemFormPage: LOOK-02 /items/new page orchestrator — ?barcode= URL prefill, generateSku once per mount, opt-in banner on top, dirty-guard RetroConfirmDialog, scanKeys.lookup(barcode) + itemKeys.all dual invalidation on create success (D-04 Pitfall #7 closure), navigate(\"/items/{id}\")"
  - "13 real it() green in UpcSuggestionBanner.test.tsx (12 scaffold todos + 1 bonus edge case)"
  - "19 real it() green in ItemFormPage.test.tsx (18 scaffold todos + 1 bonus D-15 helper assertion)"
  - "3 new BRAND-field tests in ItemForm.test.tsx (label + default-value + submit coercion)"
affects: ["65-06", "65-07", "65-08"]

tech-stack:
  added: []
  patterns:
    - "FormProvider at child-component level (not at page level): ItemForm owns useForm AND wraps its own return in FormProvider, then exposes an optional `beforeForm?: ReactNode` slot that renders INSIDE FormProvider but ABOVE the <form>. This lets a sibling banner (UpcSuggestionBanner) call useFormContext().setValue without the caller needing to own the form instance."
    - "Spy-on-methods test harness: monkey-patch methods.setValue on a real useForm() instance to assert exact setValue(field, value, options) arguments while preserving the real form state mutation path (so form-field-value assertions also work)."
    - "Dual query invalidation after mutation: mutation hook invalidates its own domain (itemKeys.all); page-level onSubmit invalidates ADJACENT domains (scanKeys.lookup(code)) that would otherwise serve stale data — D-04 / Pitfall #7."

key-files:
  created:
    - "frontend2/src/features/items/UpcSuggestionBanner.tsx"
    - "frontend2/src/features/items/ItemFormPage.tsx"
  modified:
    - "frontend2/src/features/items/forms/ItemForm.tsx — FormProvider wrap + BRAND RetroFormField + beforeForm?: ReactNode slot"
    - "frontend2/src/features/items/__tests__/ItemForm.test.tsx — 3 new tests covering D-23 BRAND field (+1 describe block)"
    - "frontend2/src/features/items/__tests__/UpcSuggestionBanner.test.tsx — 12 it.todo → 13 real it() (1 bonus edge case)"
    - "frontend2/src/features/items/__tests__/ItemFormPage.test.tsx — 18 it.todo → 19 real it() (1 bonus D-15 helper)"

key-decisions:
  - "Extended ItemForm with an optional `beforeForm?: ReactNode` prop rather than hoisting useForm() up to ItemFormPage. Preserves ItemPanel's existing usage (beforeForm is optional, defaults to null) and keeps the form instance colocated with the form's field definitions. Plan placed FormProvider INSIDE ItemForm; the plan as written did not reconcile that the UpcSuggestionBanner is a sibling of <form>, so this deviation (Rule 3 - Blocking) is a direct architectural reconciliation, not scope creep."
  - "Added 1 bonus it() per converted file (13 instead of 12 for banner; 19 instead of 18 for page). The scaffold's 12/18 counts are minima; the bonus cases exercise adjacent edge cases already implied by the plan's D-15 / data-shape semantics (category-helper-no-USE in page integration; only-NAME row when brand is null)."
  - "beforeForm slot renders INSIDE FormProvider but OUTSIDE <form>. The alternative (render the banner INSIDE <form>) would have put buttons with type=\"submit\" default inside a form — every [USE] click would have submitted the form. Keeping the banner outside <form> avoids needing explicit type=\"button\" on every RetroButton in the banner."

patterns-established:
  - "beforeForm slot on form components: when a sibling needs useFormContext access, expose a ReactNode slot in the form component that renders inside FormProvider but outside <form>. Keeps form ownership colocated + avoids prop-drilling setValue."
  - "D-23 direct setValue writes: feature-local enrichment banners write to first-class form fields (e.g. `setValue(\"brand\", ...)`) rather than concatenating into description. Grep-assertable by the test file: `setValue\\(\"description\"` count MUST be 0."
  - "Dual invalidation guardrails: page-level submit handlers explicitly invalidate adjacent-domain caches (scanKeys.lookup(barcode)) even when the mutation hook already handles the primary domain (itemKeys.all). D-04 Pitfall #7 closure requires BOTH."

requirements-completed: [LOOK-02, LOOK-03]

# Metrics
duration: 10min
completed: 2026-04-19
---

# Phase 65 Plan 05: LOOK-02 + LOOK-03 Render Surface Summary

**ItemFormPage (/items/new) + UpcSuggestionBanner + ItemForm FormProvider wrap land together — banner writes setValue("brand", ..., { shouldDirty: true }) directly to the first-class brand field (D-23, no description concatenation workaround), page invalidates BOTH itemKeys.all (via useCreateItem) AND scanKeys.lookup(barcode) on create success (D-04 Pitfall #7 closure), dirty-guard RetroConfirmDialog reuses existing copy verbatim; 32 new real assertions green (3 ItemForm BRAND tests + 13 UpcSuggestionBanner + 19 ItemFormPage — Plan 65-01's 12 + 18 scaffold todos converted, +3 bonus cases).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-19T09:41:31Z
- **Completed:** 2026-04-19T09:51:08Z (approx)
- **Tasks:** 3 / 3 (each TDD with RED + GREEN commits)
- **Files created:** 2 (UpcSuggestionBanner.tsx + ItemFormPage.tsx)
- **Files modified:** 3 (ItemForm.tsx + ItemForm.test.tsx + two test scaffolds)

## Accomplishments

- **Task 1: ItemForm FormProvider wrap + BRAND field (D-23).** Switched the useForm destructure to `const methods = useForm...` so the shared form instance can be spread into `<FormProvider>`. Added a new BRAND RetroFormField between BARCODE and DESCRIPTION, matched the optional-field shape (helper="Optional", free-text placeholder). Extended the resolver wrapper + submit coercion to strip `brand: ""` → `undefined`. Added 3 new ItemForm tests covering the BRAND field. Added an optional `beforeForm?: ReactNode` slot on ItemFormProps so Plan 65-05 Task 3 can render sibling components inside the form-context (UpcSuggestionBanner) without needing its own form instance.
- **Task 2: UpcSuggestionBanner (D-13..D-16 + D-23).** 100-line component composed from the retro barrel (RetroPanel + HazardStripe variant="yellow" + RetroButton). Reads setValue via useFormContext; NAME + BRAND each get a [USE] chip that calls `setValue("name"|"brand", ..., { shouldDirty: true })`. USE ALL applies both non-empty suggestions in one click. DISMISS collapses via local `useState`. Category rendered as helper text only (D-15 — NEVER calls `setValue("category_id")`). D-23 compliance grep-enforced: `setValue("description", ...)` count is 0; `applyBrandToDescription` + `Brand: ` string absent from the module. 13/13 tests green (RED→GREEN TDD).
- **Task 3: ItemFormPage.** /items/new page orchestrator wiring the not-found-flow. Reads `?barcode=` via `useSearchParams`, generates one SKU per mount via `useState(() => generateSku())`, renders the banner in ItemForm's `beforeForm` slot when `enrichment.data?.found === true`, wires a dirty-guard `RetroConfirmDialog` on CANCEL (verbatim copy from the SlideOverPanel precedent), submits via `useCreateItem.mutateAsync`, and explicitly invalidates `scanKeys.lookup(barcode)` after success alongside `useCreateItem.onSuccess`'s existing `itemKeys.all` invalidation (D-04 Pitfall #7 closure). 19/19 tests green.
- **Cumulative Wave-0 scaffold progress after Plan 65-05:** 60/78 converted (+32 this plan); remaining 20 todos all in ScanResultBanner.states.test.tsx — Plan 65-06's responsibility. Items test suite: 179 passed / 0 todos (was 147 passed / 30 todos before). Full frontend suite: 686 passed / 20 todos / 0 failed.

## Task Commits

Each task followed the TDD cycle:

1. **Task 1: Wrap ItemForm in FormProvider + render BRAND field** — `a7286b1` (refactor; single atomic commit — BRAND tests authored alongside the production change since they extend existing ItemForm.test.tsx cases, not a fresh RED file)
2. **Task 2 RED: Convert UpcSuggestionBanner it.todo → real failing tests** — `ab27f26` (test)
3. **Task 2 GREEN: Add UpcSuggestionBanner with direct setValue("brand", ...)** — `9641346` (feat)
4. **Task 3 RED: Convert ItemFormPage it.todo → real failing tests** — `25b0750` (test)
5. **Task 3 GREEN: Add ItemFormPage (/items/new — LOOK-02 + LOOK-03 integration)** — `4698cc3` (feat)

_Plan 65-04 ran in parallel during this plan; its 2 commits (`664b19b`, `7998937`) interleave with this plan's history. No file overlap._

## Files Created/Modified

### Created (2)

- `frontend2/src/features/items/UpcSuggestionBanner.tsx` — 100 lines. Retro-composed banner (RetroPanel + HazardStripe yellow + RetroButton) reading setValue via useFormContext. NAME + BRAND rows with per-field [USE]; USE ALL applies both; DISMISS via local state. Category as helper text (no [USE]). Self-guards on `data.found === false` + dismissed.
- `frontend2/src/features/items/ItemFormPage.tsx` — 102 lines. Page component. Reads `?barcode=` via `useSearchParams`. `useState(() => generateSku())` lazy initializer for SKU. `useMemo(..., [generatedSku, barcode])` for stable defaultValues (Pitfall #5). Renders `<UpcSuggestionBanner>` inside ItemForm's `beforeForm` slot when `enrichment.data?.found`. On submit: `createMutation.mutateAsync(values)` → `qc.invalidateQueries({ queryKey: scanKeys.lookup(barcode) })` → `navigate("/items/{created.id}")`. Dirty-guard `RetroConfirmDialog` with verbatim SlideOverPanel copy.

### Modified (4)

- `frontend2/src/features/items/forms/ItemForm.tsx` — Added `import { FormProvider }` + `type { ReactNode }`. Refactored `useForm` destructure into `const methods = useForm(...); const { control, handleSubmit, formState } = methods;` Added `brand: defaultValues?.brand ?? ""` to defaultValues. Extended resolver wrapper + submit coercion with `brand`. Added new `RetroFormField name="brand"` between BARCODE and DESCRIPTION. Added `beforeForm?: ReactNode` optional prop — renders INSIDE `<FormProvider>` but BEFORE `<form>` so sibling components can read useFormContext. Wrapped entire return in `<FormProvider {...methods}>`. Net diff: +~25 lines.
- `frontend2/src/features/items/__tests__/ItemForm.test.tsx` — Added one new describe block ("ItemForm — D-23 BRAND field") with 3 tests (renders BRAND input, pre-populates from defaultValues.brand, empty brand coerces to undefined). Net diff: +58 lines.
- `frontend2/src/features/items/__tests__/UpcSuggestionBanner.test.tsx` — 12 it.todo → 13 real it(). Monkey-patch `methods.setValue` on a real `useForm()` instance inside a thin `BannerHarness` component to assert exact `setValue(field, value, options)` arguments. Asserts D-23 (setValue("brand", ...) literal), D-15 (never setValue("category_id", ...)), D-23 anti-workaround (never setValue("description", ...)). Net diff: +275 lines / -16.
- `frontend2/src/features/items/__tests__/ItemFormPage.test.tsx` — 18 it.todo → 19 real it() across 4 groups. Uses `MemoryRouter` + `QueryClientProvider` + `I18nProvider` + `ToastProvider`. Mocks `useCreateItem`, `useBarcodeEnrichment`, `generateSku`, `useAuth`, and the `react-router.useNavigate` return value (shared navigate spy). Group C Test 11 uses `vi.spyOn(client, "invalidateQueries")` to find the scanKeys.lookup invocation among multiple invalidation calls. Net diff: +397 lines / -35.

## Decisions Made

- **Added optional `beforeForm?: ReactNode` slot to ItemFormProps** (Rule 3 - Blocking). Plan Task 1 locked FormProvider INSIDE ItemForm; Plan Task 3 renders UpcSuggestionBanner as a SIBLING of ItemForm. That combination has no useFormContext surface for the banner — banner throws `Cannot destructure property 'setValue' of 'useFormContext(...)' as it is null`. Hoisting useForm up to the page was rejected because it breaks colocation (form fields live in ItemForm; the useForm config, resolver, and defaultValues coercion logic all belong with the fields). The cleaner fix: ItemForm's `<FormProvider>` wraps BOTH an optional `beforeForm` slot AND the `<form>`, so the banner renders in the FormProvider context without being inside `<form>`. Preserves ItemPanel's existing usage verbatim (it never passes `beforeForm`; default is `null`).
- **Added 1 bonus it() per converted test file** (13 banner, 19 page — vs plan's scaffold-accepted 12 + 18). The scaffold counts are minima; every D-13..D-16 acceptance criterion from the plan body is covered. Bonus cases exercise adjacent edges already implied by the plan semantics (only-NAME row when brand is null; D-15 helper assertion inside the page integration group). Grep-asserted: `it.todo(` count in both files is 0.
- **Kept `beforeForm` rendering OUTSIDE `<form>`**. Rendering the banner inside `<form>` would have made every RetroButton inherit the default `type="submit"` unless each had an explicit `type="button"`. Banner's [USE] / USE ALL / DISMISS buttons omit `type`, so they'd submit the form on click. Keeping `beforeForm` a sibling of `<form>` avoids the footgun.
- **Resolved 3 READ-BEFORE-EDIT harness false-positive reminders** during ItemForm.tsx + ItemForm.test.tsx + ItemFormPage.test.tsx edits — files were actually Read earlier in the session; the harness tracks state differently than expected. All edits succeeded per tool confirmations; tests green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `beforeForm?: ReactNode` slot to ItemForm so the sibling UpcSuggestionBanner can access useFormContext**
- **Found during:** Task 3 Step C first vitest run — 3 Group D tests failed with `Cannot destructure property 'setValue' of 'useFormContext(...)' as it is null` because the banner rendered as a sibling of ItemForm, OUTSIDE FormProvider's scope.
- **Issue:** Plan Task 1 placed FormProvider INSIDE ItemForm's return. Plan Task 3 (and 65-RESEARCH.md Example 5) rendered UpcSuggestionBanner as a sibling of ItemForm in the page. Those two statements are mutually incompatible — a sibling of ItemForm has no FormProvider context.
- **Fix:** Extended ItemFormProps with an optional `beforeForm?: ReactNode` prop. ItemForm renders `{beforeForm}` INSIDE `<FormProvider>` but BEFORE `<form>`. ItemFormPage now passes the banner via `beforeForm={enrichment.data?.found ? <UpcSuggestionBanner data={enrichment.data} /> : null}` instead of rendering it as a sibling.
- **Files modified:** `frontend2/src/features/items/forms/ItemForm.tsx` (+4 lines: type import, prop, JSX slot), `frontend2/src/features/items/ItemFormPage.tsx` (banner moved from sibling to `beforeForm` prop).
- **Verification:** All 19 ItemFormPage tests + 13 UpcSuggestionBanner tests + 179 items tests green. Typecheck clean. No regression in ItemPanel's existing ItemForm usage (beforeForm defaults to null when unspecified).
- **Committed in:** `4698cc3` (Task 3 GREEN commit — the fix is inseparable from making the page work end-to-end).

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking, architectural reconciliation between Plan Task 1 and Plan Task 3 assumptions).
**Impact on plan:** Zero scope creep. ItemForm's public API gains ONE optional prop with a safe default. The plan body's intent (FormProvider wraps ItemForm; banner uses useFormContext) is fully preserved — the deviation is a mechanical contract adjustment, not a behavioral change.

## Issues Encountered

- **Plan Task 1 + Task 3 architectural mismatch** — see Deviation #1 above. Caught at first GREEN run of Group D tests; 3 tests failed identically on `useFormContext(...) is null`.
- **Test 15 DOM ambiguity** — screen.getByText("NAME") matched both the banner's `<span>NAME</span>` and the form's `<label for="name">NAME</label>`, throwing "found multiple elements". Fixed by filtering `getAllByText("NAME")` for tagName === "SPAN" (the banner row). Same pattern would work via `within(...)` but the tagName filter is tighter.
- **READ-BEFORE-EDIT harness reminders fired 9 times** during Task 1 + Task 3 edits. Files were Read earlier in the session but the harness re-reminded on each Edit/Write. All operations succeeded per tool confirmations — no actual state drift.
- **Parallel 65-04 executor commits interleaved mid-plan** (`664b19b` + `7998937`). No file overlap — 65-04 modifies `frontend2/src/features/scan/*`; this plan modifies `frontend2/src/features/items/*`. Full-suite vitest run post-merge shows 686 passing / 20 todos / 0 failed — both plans' changes coexist cleanly on master.

## D-23 Compliance Evidence (grep proof)

```bash
$ rg -c 'setValue\("brand"' frontend2/src/features/items/UpcSuggestionBanner.tsx
1                                                    # DIRECT first-class write
$ rg -c 'setValue\("description"' frontend2/src/features/items/UpcSuggestionBanner.tsx
0                                                    # NO concatenation workaround
$ rg -c 'applyBrandToDescription|Brand: ' frontend2/src/features/items/UpcSuggestionBanner.tsx
0                                                    # workaround fully removed
```

## D-04 Dual-Invalidation Evidence (grep proof)

```bash
$ rg -c 'invalidateQueries.*itemKeys\.all' frontend2/src/features/items/hooks/useItemMutations.ts
5                                                    # useCreateItem + useUpdate/Archive/Restore/Delete
$ rg -c 'invalidateQueries.*scanKeys\.lookup' frontend2/src/features/items/ItemFormPage.tsx
1                                                    # page-level Pitfall #7 closure
```

## Mocks Introduced (for Plan 65-07 ScanPage match-effect integration test to mirror)

- `vi.mock("@/features/auth/AuthContext")` with a fixed workspaceId UUID
- `vi.mock("@/lib/api/categories")` returning empty items list
- `vi.mock("../hooks/useItemMutations")` with `vi.mocked(useCreateItem).mockReturnValue(...)` per-test
- `vi.mock("../hooks/useBarcodeEnrichment")` with `vi.mocked(useBarcodeEnrichment).mockReturnValue({ data, isError, ... })` per-test
- `vi.mock("../forms/schemas")` spreading actual exports + overriding `generateSku` with a stable `"ITEM-TEST-0001"` spy
- `vi.mock("react-router")` preserving actual exports + replacing `useNavigate` with a shared top-level `navigateSpy` so Group B assertions survive across tests via `navigateSpy.mockClear()` in `beforeEach`

Plan 65-07's ScanPage match-effect integration test should reuse this mock suite — particularly the navigateSpy pattern for asserting scan-side navigation.

## Deviation from 65-RESEARCH.md Example 5 Skeleton

- Moved UpcSuggestionBanner from a sibling of ItemForm into ItemForm's `beforeForm` slot (see Deviation #1). Example 5 rendered the banner as a sibling, which left it outside FormProvider — functionally incompatible with the plan's useFormContext design.
- Pivoted `useState<string>(() => generateSku())` back to `useState(() => generateSku())` to match the plan's exact acceptance-criterion grep (`useState\(\(\) => generateSku\(\)\)`). TypeScript infers the generic from the return type so no behavior changes.
- Page uses a 6-field defaultValues object (name, sku, barcode, brand, description, category_id) rather than Example 5's shorter `{ sku, barcode }` — full key set is required because ItemForm's own useForm seeds every field explicitly; skipping them produces undefined values inside RHF instead of `""`, which messes with isDirty detection.

## User Setup Required

None — no external service configuration changes.

## Next Phase Readiness

- **Plan 65-06 ready (ScanResultBanner four-state widen):** 20 Wave-0 scaffold todos remain in `ScanResultBanner.states.test.tsx` — all other Wave 0 scaffolds are now converted (60/78 cumulative). Plan 65-06 is next-in-queue after Plan 65-04 (wave 2 sibling — running in parallel).
- **Plan 65-07 ready (route registration + ScanPage match-effect):** Can now register `<Route path="items/new" element={<ItemFormPage />} />` in `routes/index.tsx`. ScanPage match-effect integration test can mirror the mock suite documented above.
- **Plan 65-08 ready (bundle gate):** ItemFormPage chunk impact is additive-only. Bundle baseline at `b04ae7c` (main 135754 B / scanner 58057 B gzip) — Plan 65-08 will re-measure post-Plan-07 routes wiring.

## Cumulative Wave-0 Scaffold Progress

| File | it.todo at plan start | Converted this plan | Real it() now |
|------|----------------------|---------------------|---------------|
| items.lookupByBarcode.test.ts | 0 (done in 65-02) | 0 | 6 |
| barcode.test.ts | 0 (done in 65-03) | 0 | 5 |
| useBarcodeEnrichment.test.ts | 0 (done in 65-03) | 0 | 13 |
| schemas.test.ts (scaffold) | 0 (done in 65-02) | 0 | 7 |
| UpcSuggestionBanner.test.tsx | 12 | 12 (→13 w/ bonus) | 13 |
| ItemFormPage.test.tsx | 18 | 18 (→19 w/ bonus) | 19 |
| ScanResultBanner.states.test.tsx | 20 | 0 (Plan 65-06) | 0 |
| **Cumulative** | **50** → **20** | **+32** (incl. +3 bonus) | **63** |

60 of Plan 65-01's 78 original scaffold todos are now real green tests; 2026 of the 20 remaining belong exclusively to Plan 65-06's ScanResultBanner four-state widen. Extra 3 bonus cases brought the total green it() across Wave-0 scaffolds to 63.

## Self-Check: PASSED

Verified all claims:

- [x] `frontend2/src/features/items/UpcSuggestionBanner.tsx` exists — 100 lines, exports `UpcSuggestionBanner` + `UpcSuggestionBannerProps`.
- [x] `frontend2/src/features/items/ItemFormPage.tsx` exists — 102 lines, exports `ItemFormPage`.
- [x] `frontend2/src/features/items/forms/ItemForm.tsx` contains `FormProvider` (exactly 1 wrap), `name="brand"` RetroFormField (exactly 1), `brand:` defaultValues + resolver coercion + submit coercion.
- [x] All 5 plan commits exist in `git log --oneline`: `a7286b1`, `ab27f26`, `9641346`, `25b0750`, `4698cc3`.
- [x] `bunx tsc -b --noEmit` exits 0.
- [x] `bun run lint:imports` exits 0 (no forbidden idb/serwist/offline/sync substrings).
- [x] `bunx vitest run` full suite — 686 passed / 20 todos / 0 failed.
- [x] `bunx vitest run src/features/items` — 179 passed / 0 todos.
- [x] `bunx vitest run src/features/items/__tests__/UpcSuggestionBanner.test.tsx` — 13/13 green.
- [x] `bunx vitest run src/features/items/__tests__/ItemFormPage.test.tsx` — 19/19 green.
- [x] D-04 dual invalidation grep proof: `itemKeys.all` in useItemMutations.ts (5 hits), `scanKeys.lookup` in ItemFormPage.tsx (1 hit).
- [x] D-23 direct brand write: `setValue("brand"` in UpcSuggestionBanner.tsx (1 hit).
- [x] D-23 anti-workaround: `setValue("description"` in UpcSuggestionBanner.tsx (0 hits); `applyBrandToDescription` / `Brand: ` literal in UpcSuggestionBanner.tsx (0 hits).
- [x] D-15 anti-feature: `setValue("category_id"` in UpcSuggestionBanner.tsx (0 hits).
- [x] `it.todo(` count across converted files (ItemFormPage.test.tsx, UpcSuggestionBanner.test.tsx) = 0.
- [x] `^\s*it(` count: UpcSuggestionBanner.test.tsx = 13, ItemFormPage.test.tsx = 19.

---

*Phase: 65-item-lookup-and-not-found-flow*
*Plan: 05*
*Completed: 2026-04-19*
