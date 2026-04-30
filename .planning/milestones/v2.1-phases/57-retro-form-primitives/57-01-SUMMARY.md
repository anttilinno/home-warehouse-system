---
phase: 57
plan: 01
subsystem: frontend-retro-forms
tags: [frontend, forms, retro, ui-primitives]
requires:
  - frontend2 retro design tokens (border-retro-*, bg-retro-*, outline-retro-amber)
  - RetroButton for file-input trigger
provides:
  - RetroTextarea multiline input primitive with auto-resize + error state
  - RetroCheckbox boolean primitive with 44px hit area + amber fill
  - RetroFileInput multi-file picker with chip list + value-reset pattern
  - Form dependencies (react-hook-form, zod, @hookform/resolvers, @floating-ui/react) for later 57 plans
affects:
  - frontend2/src/components/retro/* (barrel extended)
tech-stack:
  added:
    - react-hook-form@^7.72.1
    - zod@^4.3.6
    - "@hookform/resolvers@^5.2.2"
    - "@floating-ui/react@^0.27.19"
  patterns:
    - forwardRef + displayName on every primitive
    - Ref-merge helper for internal + forwarded refs (indeterminate, hidden file input)
    - value="" reset after file selection (Pitfall 6 — re-select same file)
    - useLingui t macro for all user-visible strings
key-files:
  created:
    - frontend2/src/components/retro/RetroTextarea.tsx
    - frontend2/src/components/retro/RetroCheckbox.tsx
    - frontend2/src/components/retro/RetroFileInput.tsx
    - frontend2/src/components/retro/__tests__/RetroTextarea.test.tsx
    - frontend2/src/components/retro/__tests__/RetroCheckbox.test.tsx
    - frontend2/src/components/retro/__tests__/RetroFileInput.test.tsx
  modified:
    - frontend2/package.json
    - frontend2/bun.lock
    - frontend2/src/components/retro/index.ts
decisions:
  - Used InputEvent<HTMLTextAreaElement> for onInput handler to match React 19 textarea event typing
  - I18nProvider wrapper in RetroFileInput tests (useLingui requires activation)
metrics:
  duration: ~5 min
  completed: 2026-04-15
  tasks_completed: 3
  files_created: 6
  files_modified: 3
---

# Phase 57 Plan 01: Retro Form Primitives Summary

Installed v2.1 form dependencies and shipped three retro form primitives (RetroTextarea, RetroCheckbox, RetroFileInput) matching the RetroInput bevel/amber-focus/error-border pattern, with 15 passing Vitest tests.

## Tasks Completed

| Task | Name                                              | Commit  |
| ---- | ------------------------------------------------- | ------- |
| 1    | Install form deps + scaffold failing test stubs   | 8f5772a |
| 2    | Implement RetroTextarea + RetroCheckbox           | da5ddf4 |
| 3    | Implement RetroFileInput                          | 3b001ef |

## Key Changes

- **Dependencies:** `react-hook-form@7.72.1`, `zod@4.3.6`, `@hookform/resolvers@5.2.2`, `@floating-ui/react@0.27.19` added to `frontend2/package.json` (shared by 57-02 and 57-03).
- **RetroTextarea:** `forwardRef<HTMLTextAreaElement>`, bevel + amber focus + error border, auto-resize up to 8 rows (192px at 24px line-height), error message below.
- **RetroCheckbox:** `forwardRef<HTMLInputElement>`, 24×24 visual box inside a 44×44 label hit area, `peer-checked` amber fill, `useEffect`-driven indeterminate, error border swap.
- **RetroFileInput:** Hidden file input + `<RetroButton variant="neutral">CHOOSE FILES</RetroButton>` trigger, per-file chip list with `aria-label="Remove {filename}"` remove button (44px hit area), `e.currentTarget.value = ""` reset after change, `maxSizeBytes` filter (default 10 MB), Lingui `t` macro on every user-visible string.
- **Barrel:** `frontend2/src/components/retro/index.ts` now re-exports all three new primitives plus their types.

## Verification

- `bun pm ls | grep -E "react-hook-form|zod|@hookform/resolvers|@floating-ui/react"` → 4 matches
- `bun run test --run src/components/retro/__tests__/` → 13 files, 89 tests passed
- Retro-form-specific tests: 6 (FileInput) + 5 (Checkbox) + 6 (Textarea) = 17 new passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RetroFileInput tests missed I18nProvider**
- **Found during:** Task 3 test run — `useLingui` threw "used without I18nProvider".
- **Fix:** Wrapped `RetroFileInput` tests in `<I18nProvider i18n={i18n}>` matching the Dashboard/Settings test pattern (`i18n.load("en", {}); i18n.activate("en");`).
- **Files modified:** `frontend2/src/components/retro/__tests__/RetroFileInput.test.tsx`
- **Commit:** 3b001ef

**2. [Rule 1 - Bug] RetroTextarea onInput type mismatch**
- **Found during:** Task 3 `tsc -b` run — `FormEvent` not assignable to `InputEvent<HTMLTextAreaElement>`.
- **Fix:** Imported `type { InputEvent as ReactInputEvent }` from `react` and typed the handler accordingly so the optional `onInput` passthrough satisfies React 19's narrowed textarea event signature.
- **Files modified:** `frontend2/src/components/retro/RetroTextarea.tsx`
- **Commit:** 3b001ef

## Deferred Issues

Pre-existing lint and TypeScript errors in files outside this plan's scope (ActivityFeed, AppShell, useRouteLoading, AuthCallbackPage, AuthContext, api.ts, ApiDemoPage, i18n.ts, RequireAuth.test, RetroDialog.test, RetroToast.test). Logged in `.planning/phases/57-retro-form-primitives/deferred-items.md`. Not introduced by 57-01 — out of scope per executor scope-boundary rule.

## TDD Gate Compliance

- RED gate: `test(57-01): install form deps and scaffold failing tests` (8f5772a) — confirmed module-not-found failure before implementation.
- GREEN gate: `feat(57-01): add RetroTextarea and RetroCheckbox primitives` (da5ddf4) and `feat(57-01): add RetroFileInput with chip list + value-reset pattern` (3b001ef) — all 17 new tests passing.

## Self-Check: PASSED

- FOUND: frontend2/src/components/retro/RetroTextarea.tsx
- FOUND: frontend2/src/components/retro/RetroCheckbox.tsx
- FOUND: frontend2/src/components/retro/RetroFileInput.tsx
- FOUND: frontend2/src/components/retro/__tests__/RetroTextarea.test.tsx
- FOUND: frontend2/src/components/retro/__tests__/RetroCheckbox.test.tsx
- FOUND: frontend2/src/components/retro/__tests__/RetroFileInput.test.tsx
- FOUND commits: 8f5772a, da5ddf4, 3b001ef
