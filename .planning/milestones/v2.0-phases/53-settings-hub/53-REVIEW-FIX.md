---
phase: 53-settings-hub
fixed_at: 2026-04-11T00:00:00Z
review_path: .planning/phases/53-settings-hub/53-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 53: Code Review Fix Report

**Fixed at:** 2026-04-11
**Source review:** .planning/phases/53-settings-hub/53-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Avatar upload does not check `response.ok` — success toast fires on server errors

**Files modified:** `frontend2/src/features/settings/ProfilePage.tsx`
**Commit:** e2795d2
**Applied fix:** Captured the `fetch` return value into `response` and added `if (!response.ok) throw new Error(\`HTTP ${response.status}\`)` before calling `refreshUser()` and showing the success toast.

---

### WR-02: Optimistic state update in `FormatsPage` with no rollback on API failure

**Files modified:** `frontend2/src/features/settings/FormatsPage.tsx`
**Commit:** 59125a5
**Applied fix:** In all three handlers (`handleDateFormatChange`, `handleTimeFormatChange`, `handleNumberFormatChange`), captured the previous value into `prev` before calling the setter, then called the setter with `prev` inside the `catch` block to rollback on API failure.

---

### WR-03: Optimistic state update in `NotificationsPage` with no rollback on API failure

**Files modified:** `frontend2/src/features/settings/NotificationsPage.tsx`
**Commit:** 548bfbe
**Applied fix:** Refactored `savePreferences` to throw on failure (removed its internal try/catch). Both `handleMasterChange` and `handleCategoryChange` now capture `prev`, apply optimistic update, call `savePreferences` inside a try/catch, and rollback to `prev` with an error toast on failure.

---

### WR-04: OAuth unlink guard is incorrect when `fetchAccounts` fails

**Files modified:** `frontend2/src/features/settings/SecurityPage.tsx`
**Commit:** aba61b2
**Applied fix:** Changed `accounts.length === 1` to `accounts.length <= 1` in `isUnlinkDisabled`, so the guard stays `true` when `accounts` is empty due to a failed fetch.

---

### WR-05: New password field has no error display; complexity rejections are invisible

**Files modified:** `frontend2/src/features/settings/SecurityPage.tsx`
**Commit:** 8427185
**Applied fix:** Added `newPasswordError` state (initialized to `undefined`). In `handlePasswordUpdate`, added `setNewPasswordError(undefined)` on entry and an `else if` branch in the catch block that sets `newPasswordError` when the error message indicates complexity/length/requirement issues. The new-password `RetroInput` now receives `error={newPasswordError}` and clears it on `onChange`.

---

_Fixed: 2026-04-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
