---
phase: 04-retro-atoms
plan: 04
subsystem: frontend-form-atoms
tags: [ui, form, combobox, select, checkbox, fileinput, aria-activedescendant, a11y, rhf, tdd]

requires:
  - phase: 04-retro-atoms (Plan 04-01)
    provides: "Popover (anchored chromeless-utility panel, ESC via useModalStack) + retro barrel ./overlay re-export convention"
  - phase: 01 (retro chrome)
    provides: "RetroInput field chrome, BevelButton, bevel-sunken/raised tokens"
provides:
  - "RetroFormField — label/hint/✕-error wrapper (render-prop wires control id + aria-describedby/aria-invalid)"
  - "RetroSelect — skinned NATIVE <select> + ▾ glyph (bulletproof a11y, RHF-compatible)"
  - "RetroTextarea — sunken multi-line field (min-h-[88px] resize-y, mono prop)"
  - "RetroCheckbox — 16x16 System-7 box on sr-only native checkbox + indeterminate dash"
  - "RetroFileInput — click + drag-drop File[] emitter (no content read)"
  - "RetroCombobox — hand-rolled editable combobox (aria-activedescendant virtual focus) on RetroInput + Popover, ESC via useModalStack"
  - "@/components/retro barrel re-exports ./form"
affects:
  - "Plan 04-06 filter atoms (FilterPopover uses checkbox rows; combobox/select patterns)"
  - "Feature phases 5-16 (every form page wires these atoms with RHF register())"

tech-stack:
  added: []
  patterns:
    - "aria-activedescendant virtual focus: DOM focus STAYS on the combobox input; arrow keys move only the active-descendant id (W3C APG list-autocomplete, Pitfall 2)"
    - "Single ESC authority preserved: the combobox listbox renders through Plan 04-01 Popover, so ESC routes via useModalStack — zero document-level ESC listeners in form source (TUI-02 LOCKED)"
    - "RetroFormField render-prop ((id, describedBy) => control) lets each control own its id + aria-describedby/aria-invalid wiring, keeping atoms RHF-compatible"
    - "Skinned-native pattern for Select (orchestrator arbitration): wrap a real <select> for free keyboard/mobile/AT, skin only the closed field + ▾ affordance"

key-files:
  created:
    - "frontend2/src/components/retro/form/RetroFormField.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/form/RetroSelect.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/form/RetroTextarea.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/form/RetroCheckbox.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/form/RetroFileInput.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/form/RetroCombobox.tsx (+ .test.tsx)"
    - "frontend2/src/components/retro/form/index.ts"
  modified:
    - "frontend2/src/components/retro/index.ts (appended ./form re-export)"

key-decisions:
  - "RetroSelect = skinned NATIVE <select> per orchestrator arbitration (not a custom listbox); the styled popup list lives only in RetroCombobox."
  - "Combobox activeIndex starts at -1 (no active descendant) so the first ArrowDown lands on option 0 per APG, instead of pre-highlighting and skipping it."
  - "The Popover panel carries role='listbox'; the inner <ul> is a plain container so exactly one listbox exists in the tree (avoids RTL getByRole ambiguity + duplicate ARIA)."
  - "RetroCheckbox mirrors the native checked state internally so the visual box stays correct whether controlled (checked prop) or uncontrolled (RHF/native)."

patterns-established:
  - "aria-activedescendant virtual focus (combobox) — re-used by any future editable-listbox atom"
  - "Skinned-native-select pattern — the a11y-safe default for non-filterable choosers"
  - "RetroFormField render-prop wiring — the composition wrapper for all non-self-labeling controls"

requirements-completed: [ATOM-FB-02]

duration: ~22min
completed: 2026-06-13
---

# Phase 4 Plan 04: Form Family Atoms Summary

**Six RHF-compatible retro-os form atoms — a label/hint/✕-error FormField wrapper, a skinned native Select, a sunken Textarea, a System-7 Checkbox (with indeterminate dash), a File[]-emitting FileInput (no content read), and a hand-rolled aria-activedescendant Combobox whose listbox routes ESC through the Plan 04-01 Popover/useModalStack arbiter.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files created:** 13 (6 atoms + 6 specs + form barrel)
- **Files modified:** 1 (retro barrel)
- **Tests:** 24 form-family specs (5 files Task 1: 17; Combobox Task 2: 7); full suite 210 passed (31 files)

## Accomplishments

- **RetroFormField** — vertical label/control/hint stack; a render-prop hands the control its `id` + `aria-describedby` so each control wires `aria-invalid`/`aria-describedby` itself. ✕-prefixed `text-danger` error replaces the hint (sketch-007 in-window idiom); ink `*` required marker (color reserved for actual errors).
- **RetroSelect** — a skinned **native `<select>`** (`appearance-none` + shared sunken chrome) with a `pointer-events-none` ink `▾` glyph; danger flip + `aria-invalid` on error; forwardRef + name/onChange pass-through.
- **RetroTextarea** — `min-h-[88px] resize-y` sunken field, `mono` prop, danger flip, RHF props.
- **RetroCheckbox** — 16×16 System-7 box driven by an `sr-only` native checkbox (visual box `aria-hidden`); checked = `bg-titlebar-blue bevel-pressed` + ink ✓; `indeterminate` = ink `–` dash on panel-2; whole label is a ≥24px click target.
- **RetroFileInput** — sunken dashed drop zone + `BROWSE…` BevelButton (both trigger one hidden native input); dragover highlight (`border-titlebar-blue bg-info-bg`); selected-files list with mono filename + tabular-nums size + ✕ remove; emits `File[]` only — **never reads file contents** (no content-reading APIs); optional `maxSize` rejects oversized files into a danger error.
- **RetroCombobox** — hand-rolled editable combobox on a `role="combobox"` input + the Plan 04-01 `Popover` listbox. **DOM focus stays on the input**; arrows move only `aria-activedescendant`; Enter/Tab commit the active option; ESC closes via `useModalStack` (no own listener); empty filter → one muted `No matches.` row; selected option carries ✓; active row = `bg-titlebar-blue`.
- **Barrel** — `retro/form/index.ts` exports all six atoms + prop types; `retro/index.ts` appends `export * from "./form"` per the locked single-barrel v2.0 convention.

## Task Commits

1. **Task 1 RED** — `d6acd51` (test) — failing specs for FormField/Select/Textarea/Checkbox/FileInput
2. **Task 1 GREEN** — `48c50ce` (feat) — the five atoms
3. **Task 2 RED** — `e169691` (test) — failing RetroCombobox spec
4. **Task 2 GREEN** — `b2de013` (feat) — RetroCombobox + form barrel + retro barrel ./form line

_TDD: each task is a test→feat pair. No refactor commits were needed (GREEN was clean after the in-task fixes below)._

## Decisions Made

See `key-decisions` frontmatter. Summary: native-select skin (a11y-safe, orchestrator-arbitrated); combobox `activeIndex=-1` initial (APG first-ArrowDown lands on option 0); single listbox role on the Popover panel; checkbox internal checked-mirror for controlled+uncontrolled parity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `scrollIntoView` undefined under jsdom**
- **Found during:** Task 2 (Combobox GREEN).
- **Issue:** `element.scrollIntoView(...)` (Pitfall-2 active-option scroll) is not implemented in jsdom; the effect threw, failing 3 specs.
- **Fix:** Guarded the call (`el?.scrollIntoView?.({ block: "nearest" })`) so it runs in a real browser but no-ops under jsdom. Behavior preserved in production.
- **Files:** `RetroCombobox.tsx`. **Committed in:** b2de013.

**2. [Rule 3 - Blocking] Duplicate `role="listbox"` (Popover panel + inner `<ul>`)**
- **Found during:** Task 2 (Combobox GREEN).
- **Issue:** The Plan 04-01 Popover renders its panel with the passed `role="listbox"`; my inner `<ul role="listbox">` produced two listboxes, so `getByRole("listbox")` matched ambiguously and the ARIA was malformed.
- **Fix:** Dropped the role from the `<ul>` (now a plain container); the Popover panel is the single listbox, options nest inside it. `aria-controls` still points at the `<ul>` id.
- **Files:** `RetroCombobox.tsx`. **Committed in:** b2de013.

**3. [Rule 1 - Bug] Combobox first ArrowDown skipped option 0**
- **Found during:** Task 2 (Combobox GREEN).
- **Issue:** `activeIndex` initialized to 0 pre-highlighted Apple, so the first ArrowDown advanced to index 1 — Enter then committed the wrong option.
- **Fix:** Initialize `activeIndex=-1` (no active descendant); first ArrowDown lands on 0 (APG). Updated `aria-activedescendant`, wrap math, and reset-on-close accordingly.
- **Files:** `RetroCombobox.tsx`. **Committed in:** b2de013.

**4. [Rule 1 - Bug] Uncontrolled checkbox visual box stuck unchecked**
- **Found during:** Task 1 (Checkbox GREEN).
- **Issue:** The visual box read `checked ?? false`; an uncontrolled checkbox (only `onChange`) toggled the native input but the box never showed ✓.
- **Fix:** Added an internal `internalChecked` mirror updated in `onChange`, so the box reflects state whether controlled or uncontrolled. `checked ?? internalChecked`.
- **Files:** `RetroCheckbox.tsx`. **Committed in:** 48c50ce.

**5. [Rule 3 - Blocking] tsc: `Array.prototype.at` unavailable; unused `t`; grep false-positive**
- **Found during:** Both tasks.
- **Issue:** (a) The FileInput spec used `.at(-1)` — not in the project's TS lib target (TS2550). (b) RetroCombobox imported `useLingui`/`t` but used only `<Trans>` (TS6133). (c) The FileInput doc-comment literally contained `FileReader/.text`, tripping the `=0` content-read grep gate.
- **Fix:** (a) replaced `.at(-1)` with index arithmetic; (b) removed the unused `useLingui`/`t`; (c) reworded the comment to "no content-reading APIs". All three gates now pass.
- **Files:** `RetroFileInput.test.tsx`, `RetroFileInput.tsx`, `RetroCombobox.tsx`. **Committed in:** 48c50ce / b2de013.

---

**Total deviations:** 5 auto-fixed (3 blocking, 2 bug). All necessary for correctness/a11y/build. No scope creep — every fix kept the atom within its planned contract.

## Issues Encountered

`node_modules/` was absent on the fresh worktree; ran `bun install --frozen-lockfile` (sonner already in the lockfile from Plan 04-01 — no packages added). All bun commands used the explicit worktree `frontend2` cwd (#3097 guard).

## Threat Model Compliance

- **T-04-04-FILE (Tampering/Info disclosure):** mitigated — RetroFileInput emits `File[]` handles only; grep gate `FileReader|.text()|readAsText|readAsArrayBuffer` = **0** in source.
- **T-04-04-ESC (Elevation/DoS):** mitigated — combobox ESC routes through Popover→useModalStack; grep for an own `addEventListener("keydown" … Escape/document)` returns nothing. Preserves TUI-02.
- **T-04-04-A11Y (a11y/safety):** mitigated — `aria-activedescendant` per W3C APG, DOM focus stays on input (RTL asserts `document.activeElement === input` across arrow moves), `scrollIntoView` guarded for the active option.
- **T-04-04-XSS (accept):** React JSX auto-escapes all labels; no `dangerouslySetInnerHTML`.

## Verification

- `bun run test src/components/retro/form/` → 24 passed (6 files).
- Full suite `bun run test` → 210 passed (31 files).
- `bun run lint:tsc` → exit 0. `bun run lint:imports` → OK.
- Gates: `grep -c "<select" RetroSelect.tsx` = 2 (≥1); FileInput content-read grep = 0; `grep -c aria-activedescendant RetroCombobox.tsx` = 3 (≥1); combobox own-ESC grep = empty.

## Next Phase Readiness

- All six form atoms ship RHF-compatible and barrel-exported via `@/components/retro`.
- Plan 04-06 (filter atoms) can build FilterPopover on RetroCheckbox rows and reuse the combobox/select patterns.
- Worktree clean; **STATE.md / ROADMAP.md NOT touched** (orchestrator owns those).

## Self-Check: PASSED

- Files: all 6 atom `.tsx` + 6 specs + `form/index.ts` FOUND; `retro/index.ts` modified (appended `./form`).
- Commits: d6acd51, 48c50ce, e169691, b2de013 all in `git log`.
- No file deletions across the 4 commits; working tree clean.

---
*Phase: 04-retro-atoms*
*Completed: 2026-06-13*
