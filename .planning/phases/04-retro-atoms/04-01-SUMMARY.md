---
phase: 04-retro-atoms
plan: 01
subsystem: frontend-overlay-atoms
tags: [overlay, modal, dialog, popover, a11y, focus-trap, esc-discipline, sonner]
requires:
  - "@/components/modal useModalStack (Phase 3 capture-phase ESC arbiter)"
  - "@/components/retro Window + BevelButton (Phase 1 chrome)"
provides:
  - "RetroDialog — centered-modal overlay primitive (scrim + Window + focus-trap + restore + useModalStack ESC)"
  - "RetroConfirmDialog — pink-titlebar destructive/decision confirm preset (Cancel-default focus)"
  - "Popover — anchored chromeless-utility floating panel (menu/listbox), tap-outside + ESC close"
  - "sonner@2.0.7 exact-pinned toast engine (consumed by Plan 04-05)"
  - "@/components/retro barrel re-exports ./overlay"
affects:
  - "frontend2/src/components/layout/F1HelpDialog.tsx (refactored onto RetroDialog)"
  - "downstream Plans 04-04 (RetroCombobox), 04-05 (RetroToast), 04-06 (filter atoms) build on these primitives"
tech-stack:
  added:
    - "sonner@2.0.7 (exact pin, no caret) — toast engine for Plan 04-05"
  patterns:
    - "Single ESC authority: every overlay routes ESC through Phase 3 useModalStack; zero document-level ESC listeners in overlay source (TUI-02 LOCKED)"
    - "Focus-trap + invoker-restore generalized from the proven F1HelpDialog recipe"
    - "Popover = portal-free fixed-position floating panel with top/bottom flip + tap-outside backdrop sentinel"
key-files:
  created:
    - "frontend2/src/components/retro/overlay/RetroDialog.tsx"
    - "frontend2/src/components/retro/overlay/RetroDialog.test.tsx"
    - "frontend2/src/components/retro/overlay/RetroConfirmDialog.tsx"
    - "frontend2/src/components/retro/overlay/RetroConfirmDialog.test.tsx"
    - "frontend2/src/components/retro/overlay/Popover.tsx"
    - "frontend2/src/components/retro/overlay/Popover.test.tsx"
    - "frontend2/src/components/retro/overlay/index.ts"
  modified:
    - "frontend2/src/components/layout/F1HelpDialog.tsx"
    - "frontend2/src/components/retro/index.ts"
    - "frontend2/package.json"
    - "frontend2/bun.lock"
decisions:
  - "sonner installed per plan mandate despite UI-SPEC 'declined' note (plan is the binding execution artifact; orchestrator pre-approved). Tension documented below."
  - "Root barrel re-exports ONLY ./overlay this plan; form/feedback/data/filters deferred to their owning plans (dirs absent on this branch — re-export now breaks tsc for this + parallel plans)."
metrics:
  duration: "~20 min"
  completed: "2026-06-13"
  tasks: 3
  files_created: 7
  files_modified: 4
  tests: "22 overlay+F1 (16 new overlay + 6 F1 unchanged); 150 full suite"
---

# Phase 4 Plan 01: Overlay Foundation Summary

Established the Phase 4 overlay foundation — a `RetroDialog` primitive (generalized from the proven Phase 3 F1HelpDialog recipe), a `RetroConfirmDialog` danger preset, and an anchored `Popover` primitive — all routing ESC exclusively through the Phase 3 capture-phase `useModalStack` (TUI-02 LOCKED, never logout). sonner@2.0.7 exact-pinned after a pre-approved legitimacy gate; F1HelpDialog refactored to consume RetroDialog with its existing test passing unedited.

## What Was Built

- **RetroDialog** (`overlay/RetroDialog.tsx`): centered-modal retro-os `Window` over a `bg-fg-ink/40` scrim. Scrim click + interactive titlebar close box (`✕`, `aria-label="Close"`) + ESC all route to `onClose`. ESC flows exclusively through `useModalStack`; the only keydown listener on the dialog node handles **Tab** (focus-trap wrap). Focus moves into the dialog on open and restores to the invoker on close. Props: `{ open, onClose, title, titlebarVariant?, actions?, footer?, width?, children }`; width default `min(520px,92vw)`; optional right-aligned footer action row (`border-t-2 border-border-ink pt-sp-3`).
- **RetroConfirmDialog** (`overlay/RetroConfirmDialog.tsx`): thin preset of RetroDialog. `titlebarVariant="pink"` + `confirmVariant="danger"` by default; width `min(420px,92vw)`; **focus defaults to Cancel** (safe default via a ref effect). `titlebarVariant` + `confirmVariant` props expose the non-destructive butter/neutral "Discard changes?" idiom.
- **Popover** (`overlay/Popover.tsx`): anchored chromeless-utility floating panel (`role="menu"|"listbox"`), `bg-bg-panel border-2 border-border-ink bevel-raised min-w-[160px] z-40`, no pinstriped titlebar. Top/bottom viewport flip, tap-outside backdrop sentinel + ESC via `useModalStack` close, focus-in on open / restore-to-anchor on close.
- **sonner@2.0.7** exact-pinned (no caret).
- **F1HelpDialog** refactored: inline scrim/dialog/focus-trap/useModalStack block replaced with `<RetroDialog>`; only the F1/"?" toggle keydown owner remains (the F1 owner, NOT an ESC listener). Existing `F1HelpDialog.test.tsx` passes with zero edits.
- **Root barrel** `@/components/retro/index.ts` re-exports `./overlay`.

## Task 1 — sonner Legitimacy Gate (checkpoint:human-verify, pre-approved)

The checkpoint was pre-resolved by the orchestrator under its standing autonomous mandate. Pre-approval evidence recorded: `npm view sonner@2.0.7` → zero runtime dependencies, peerDeps `react`/`react-dom` 18/19 only, maintainer `emilkowalski <e@emilkowal.ski>`, package created 2023-02-05, unpacked 162 KB. Install ran as `bun add sonner@2.0.7` (exact pin). No pause taken.

**sonner bundle delta (orchestrator install acceptance):** dist `index.mjs` raw 65,887 B → **gzip ~13.45 KB** (`index.js` CJS gzip ~13.6 KB), plus a standalone `styles.css` of 17,464 B (raw). The CSS ships only if the toast is imported with sonner's stylesheet; Plan 04-05 will skin it to UI-SPEC visuals.

## Deviations from Plan

### Auto-fixed / scope adjustments (no architectural change)

**1. [Rule 3 — Blocking] Errant install landed in the MAIN repo, not the worktree (#3097 cwd-drift)**
- **Found during:** Task 1.
- **Issue:** A `cd .../frontend2` (without the worktree prefix) resolved to the **main repo's** frontend2 because cwd resets between Bash calls. The first `bun add sonner@2.0.7` wrote sonner into the main repo's `package.json`/`bun.lock` (and node_modules), leaving the worktree untouched (`git status` clean, no node_modules).
- **Fix:** Reverted the two tracked files in the main repo (`git checkout -- frontend2/package.json frontend2/bun.lock`), then re-ran `bun install --cwd <worktree>/frontend2 --frozen-lockfile` and `bun add --cwd <worktree>/frontend2 sonner@2.0.7` with explicit absolute worktree paths. All subsequent commands target absolute worktree paths.
- **Files:** `frontend2/package.json`, `frontend2/bun.lock` (worktree).
- **Commit:** 2ef0095.

**2. [Rule 3 — Blocking] Root barrel: only `./overlay` re-exported; the other four subdirs deferred**
- **Found during:** Task 3.
- **Issue:** The plan's Task 3 action lists adding `export * from "./form"/"./feedback"/"./data"/"./filters"` now. Those directories do not exist on this branch (owned by parallel/Wave 2-3 plans), so re-exporting them immediately breaks `tsc -b` for THIS plan and for the parallel plans (04-02/03) that import the barrel.
- **Fix:** Added only `export * from "./overlay"` (my deliverable, exists, green). Left a comment instructing each owning plan to append its own subdir line as it lands. Preserves the single-barrel v2.0 convention without breaking the build.
- **Files:** `frontend2/src/components/retro/index.ts`.
- **Commit:** 77f4543.

## Known Tension (not a stub)

**UI-SPEC says sonner is "DECLINED — hand-roll" (lines 41/59); the plan mandates installing it.** The plan (frontmatter `contains: "sonner": "2.0.7"`, must_haves, Task 1 checkpoint, threat register T-04-01-SC) is the binding execution artifact and the orchestrator pre-approved the install, so sonner was installed. Plan 04-05 owns the toast implementation decision (skin sonner vs. hand-roll); if 04-05 elects to hand-roll per UI-SPEC, the dependency should be removed there. Flagging for the verifier / Plan 04-05 owner — not resolving it in this plan.

## Threat Model Compliance

- **T-04-01-SC (Tampering / npm install):** mitigated — legitimacy gate evidence recorded; sonner exact-pinned 2.0.7 (no caret).
- **T-04-01-ESC (Elevation/DoS / ESC handling):** mitigated — grep gate confirms **zero** document-level ESC listeners in overlay source; ESC routed exclusively through `useModalStack` (count ≥1 in RetroDialog.tsx and Popover.tsx). The only overlay-source keydown listener handles Tab. The two `.test.tsx` `addEventListener("keydown")` matches are deliberate `LogoutOnEscape` negative-control fixtures proving ESC never escapes the stack.
- **T-04-01-FOCUS (a11y/safety / focus trap):** mitigated — focus-trap + invoker-restore inherited from the F1HelpDialog recipe; covered by RTL specs (Tab/Shift+Tab wrap, open-focus-in, close-restore).

## Verification

- `bun run test src/components/retro/overlay/` → 16 passed (3 files).
- `bun run test src/components/layout/F1HelpDialog.test.tsx` → 6 passed, test file unedited (`git diff --stat` empty).
- Full suite: `bun run test` → 150 passed (19 files).
- `bun run lint:tsc` → exit 0. `bun run lint:imports` → OK.
- `grep '"sonner": "2.0.7"' frontend2/package.json` → matches (exact pin).
- ESC gate: `grep -rn 'addEventListener("keydown"' overlay/*.tsx | grep -v '\.test\.'` → only the Tab focus-trap listener in RetroDialog.tsx; zero `Escape` strings in overlay source.

## Self-Check: PASSED

- Files: all 7 overlay files FOUND; F1HelpDialog.tsx + retro/index.ts modified; package.json has exact sonner pin.
- Commits: 2ef0095 (sonner), 928538d (RED tests), b153e93 (GREEN impl), 77f4543 (refactor) all in `git log`.
- F1HelpDialog.test.tsx unedited (git diff --stat empty).
- Working tree clean; STATE.md / ROADMAP.md NOT touched (orchestrator owns those).
