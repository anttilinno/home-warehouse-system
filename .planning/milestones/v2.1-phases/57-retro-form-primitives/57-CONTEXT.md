# Phase 57: Retro Form Primitives — Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Build 9 retro-styled form and list primitives — RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox, RetroFileInput, RetroPagination, RetroConfirmDialog, RetroEmptyState, and RetroFormField — so every CRUD phase (58–62) can compose forms, pickers, pagination, and confirmations without ad-hoc components. No user-facing features. All components ship in the `@/components/retro` barrel and are demoed on the existing `/demo` route.

</domain>

<decisions>
## Implementation Decisions

### RetroSelect Implementation
- **D-01:** RetroSelect is a fully custom div-based dropdown — `<button>` trigger + `<ul role="listbox">` with `<li role="option">` children. No native `<select>` element. This is required to match the thick-border retro aesthetic (monospace text, amber focus ring, retro option rows) consistently across macOS/Windows/iOS. Native `<select>` cannot be styled to match.

### Combobox Dropdown Positioning
- **D-02:** RetroCombobox uses `@floating-ui/react` for dropdown positioning. Handles viewport edge flip, scroll parent clipping, and dynamic width matching. The ~3kB bundle cost is accepted over the clipping risk of pure CSS absolute positioning. This is the only new runtime dependency added in phase 57 beyond react-hook-form and zod.

### RetroFormField Composition Pattern
- **D-03:** RetroFormField uses `Controller`-for-all. Every child primitive is wrapped via react-hook-form `Controller` — whether it wraps RetroTextarea, RetroSelect, RetroCombobox, RetroCheckbox, or RetroFileInput. Downstream CRUD phases (58–62) always use the same pattern:
  ```tsx
  <RetroFormField name="field" label="LABEL" control={control}>
    <RetroSelect options={opts} />
  </RetroFormField>
  ```
  No `register`-forwarding variant. One mental model for all fields.

### New Dependencies
- **D-04:** Phase 57 installs: `react-hook-form`, `zod`, `@hookform/resolvers`, `@floating-ui/react`. These are the only new runtime deps. No UI component libraries (no Radix, no shadcn — v2.0 decision locked).

### Plan Batching
- **D-05:** Three plans by complexity tier:
  - **Plan 57-01:** Simple inputs — RetroTextarea, RetroCheckbox, RetroFileInput
  - **Plan 57-02:** Pickers + form integration — RetroSelect, RetroCombobox, RetroFormField
  - **Plan 57-03:** Structural + demo — RetroPagination, RetroConfirmDialog, RetroEmptyState, `/demo` page wiring, barrel exports, tests

### Claude's Discretion
- Internal floating-ui middleware configuration (flip, shift, size strategies)
- Exact `RetroCombobox` debounce timing for async search (suggested: 250ms)
- RetroFormField TypeScript generic design (infer field values from `control`)
- Test strategy per component (prefer integration tests that render inside a form; unit tests for pure state logic)
- Whether RetroConfirmDialog extends the existing `RetroDialog` component or is standalone
- `/demo` page section ordering (UI-SPEC focal hierarchy already defined: form showcase first, then pagination/confirm/empty)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Component Library
- `frontend2/src/components/retro/RetroInput.tsx` — Reference implementation for bevel border style (`border-retro-thick`, `shadow-retro-raised`, amber focus ring via `outline-retro-amber`). All new primitives MUST match this visual pattern.
- `frontend2/src/components/retro/RetroDialog.tsx` — Existing `<dialog>` element + `forwardRef` + `useImperativeHandle` pattern for modal. RetroConfirmDialog should follow or extend this.
- `frontend2/src/components/retro/index.ts` — Barrel file; all new primitives MUST be exported from here.
- `frontend2/src/components/retro/__tests__/` — Existing test files showing Vitest + Testing Library patterns used by the retro component suite.

### UI Design Contract
- `.planning/phases/57-retro-form-primitives/57-UI-SPEC.md` — **Primary reference.** Covers spacing, typography, color, touch targets, interaction contracts, copywriting, ARIA, and component-by-component constraints. Planner and executor MUST follow this.

### Demo Route
- `frontend2/src/features/demo/` (or equivalent demo page file) — The existing `/demo` route that Phase 50 built. Phase 57 ADDS sections to this page; it does not replace it.
- `frontend2/src/routes/index.tsx` — Router to confirm demo route registration.

### Retro Design Tokens
- `frontend2/src/styles/globals.css` — All CSS custom properties (`--color-retro-*`, `--shadow-retro-*`, `border-retro-thick`, etc.). Phase 57 introduces NO new tokens.

### Backend Context (for realistic demo/test data)
- `frontend2/src/lib/api/` — Phase 56 entity API modules. RetroCombobox async demo can use categories or locations endpoint as a realistic async data source.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RetroDialog.tsx` — `<dialog>` native element with `showModal()`/`close()`. RetroConfirmDialog can wrap or extend this. The `HazardStripe` header and thick-border styling already exist.
- `HazardStripe.tsx` — Used inside RetroDialog header. The UI-SPEC requires a hazard-stripe band on the RetroConfirmDialog destructive variant header.
- `RetroButton.tsx` — Already has `variant="primary"` (amber), `variant="danger"` (red), and `variant="neutral"`. RetroConfirmDialog action buttons use these directly — no new button variants needed.
- `RetroPanel.tsx` — Wrapper panel; primitives can render standalone or inside a RetroPanel on the demo page.

### Established Patterns
- `forwardRef` used on all existing retro primitives — maintain this pattern for the new ones
- Tailwind CSS 4 utility classes with retro token names (e.g. `border-retro-thick`, `bg-retro-cream`, `text-retro-ink`)
- `font-mono` for input values, barcodes, pagination counters; `font-sans` for labels
- Vitest + Testing Library — all existing tests in `__tests__/` subdirectory alongside components
- Lingui `t` macro for all user-visible strings (mandatory for Lingui catalog extraction)

### Packages to Install (Plan 57-01 first step)
- `react-hook-form` — form state management
- `zod` — schema validation
- `@hookform/resolvers` — zod resolver bridge
- `@floating-ui/react` — dropdown positioning for RetroCombobox

### Integration Points
- `frontend2/src/components/retro/index.ts` — Barrel export; each plan's components are added here as they ship
- `/demo` route — Phase 57-03 adds form primitive sections following the focal hierarchy from UI-SPEC

</code_context>

<specifics>
## Specific References

- UI-SPEC copywriting contract (cancel-button convention, tone rules, copy per component) must be followed verbatim — see `57-UI-SPEC.md` Copywriting Contract section
- Touch target enforcement: `min-height: 44px` on all interactive controls (triggers, buttons, checkbox hit areas, file input button); `min-height: 36px` for RetroPagination at `≥768px`
- The amber accent is reserved for exactly 5 use cases listed in UI-SPEC — do not use amber on non-interactive elements

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 57-retro-form-primitives*
*Context gathered: 2026-04-15*
