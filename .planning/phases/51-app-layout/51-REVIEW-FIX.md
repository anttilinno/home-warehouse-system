---
phase: 51-app-layout
fixed_at: 2026-04-11T21:24:00Z
review_path: .planning/phases/51-app-layout/51-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 51: Code Review Fix Report

**Fixed at:** 2026-04-11T21:24:00Z
**Source review:** .planning/phases/51-app-layout/51-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Inner timeout cleanup in `useRouteLoading` is silently ignored

**Files modified:** `frontend2/src/components/layout/useRouteLoading.ts`
**Commit:** 293a8fc
**Applied fix:** Declared `t2` with `let` in the outer `useEffect` scope (before `t1`), removed the dead `return () => clearTimeout(t2)` from inside the `setTimeout` callback, and expanded the outer cleanup to call both `clearTimeout(t1)` and `clearTimeout(t2)`. This ensures React's effect cleanup system cancels both timers on unmount or re-run.

### WR-02: Hardcoded "SYSTEM ERROR" heading in `ErrorBoundaryPage` is not translated

**Files modified:** `frontend2/src/components/layout/ErrorBoundaryPage.tsx`, `frontend2/locales/en/messages.po`, `frontend2/locales/et/messages.po`
**Commit:** c7ff261
**Applied fix:** Replaced the bare `SYSTEM ERROR` string literal on line 31 of `ErrorBoundaryPage.tsx` with `` {t`SYSTEM ERROR`} `` using the already-imported `useLingui` `t` macro. Added the `msgid "SYSTEM ERROR"` / `msgstr "SYSTEM ERROR"` entry to `en/messages.po` and `msgid "SYSTEM ERROR"` / `msgstr "SÜSTEEMIVIGA"` to `et/messages.po`, both inserted in alphabetical order after the SETTINGS entry.

---

_Test suite result: 150/150 tests passed (27 test files)_

---

_Fixed: 2026-04-11T21:24:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
