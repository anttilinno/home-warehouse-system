---
phase: 53-settings-hub
plan: "02"
subsystem: frontend2/settings
tags: [settings, profile, security, api-integration, avatar, sessions, oauth]
dependency_graph:
  requires:
    - frontend2/src/features/settings/ProfilePage.tsx (stub from 53-01)
    - frontend2/src/features/settings/SecurityPage.tsx (stub from 53-01)
    - frontend2/src/lib/types.ts (Session, OAuthAccount from 53-01)
    - frontend2/src/components/retro (RetroDialog, RetroInput, RetroBadge, HazardStripe, useToast)
    - frontend2/src/features/auth/AuthContext.tsx (user, refreshUser, logout)
  provides:
    - frontend2/src/features/settings/ProfilePage.tsx
    - frontend2/src/features/settings/SecurityPage.tsx
  affects:
    - frontend2/src/features/settings/__tests__/ProfilePage.test.tsx
    - frontend2/src/features/settings/__tests__/SecurityPage.test.tsx
tech_stack:
  added: []
  patterns:
    - raw fetch with FormData for multipart avatar upload (no Content-Type header)
    - RetroDialog ref pattern for imperative open/close
    - useEffect data fetch with error toast fallback
    - OAuth lockout guard (accounts.length === 1 && !has_password)
key_files:
  created: []
  modified:
    - frontend2/src/features/settings/ProfilePage.tsx
    - frontend2/src/features/settings/SecurityPage.tsx
    - frontend2/src/features/settings/__tests__/ProfilePage.test.tsx
    - frontend2/src/features/settings/__tests__/SecurityPage.test.tsx
decisions:
  - "Avatar upload uses raw fetch (not api.ts helpers) to avoid injecting Content-Type: application/json over FormData"
  - "OAuth lockout guard checks accounts.length === 1 && !user.has_password at render time, disabling the UNLINK button"
  - "SecurityPage fetches sessions and OAuth accounts in parallel useEffect hooks on mount"
  - "Password 400 error detection matches on error message text (HTTP 400 from parseError)"
metrics:
  duration: ~2 min
  completed: 2026-04-11
  tasks_completed: 2
  files_created: 0
  files_modified: 4
---

# Phase 53 Plan 02: Profile and Security Settings Summary

**One-liner:** Full Profile subpage (name/email edit, avatar upload/remove with initials fallback, 409 conflict handling) and Security subpage (password change/set, active sessions with revoke, OAuth account link/unlink with lockout guard, account deletion via RetroDialog confirmation).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Profile subpage — name, email, avatar | 0755293 | ProfilePage.tsx, ProfilePage.test.tsx |
| 2 | Security subpage — password, sessions, OAuth, account deletion | e22248e | SecurityPage.tsx, SecurityPage.test.tsx |

## What Was Built

**ProfilePage (`frontend2/src/features/settings/ProfilePage.tsx`):**
- 80x80 square avatar container (`w-[80px] h-[80px] border-retro-thick`) with `img` or initials fallback (`aria-label="User avatar"`)
- Hidden `<input type="file" accept="image/*" aria-label="Upload avatar image">` triggered by UPLOAD button ref
- Avatar upload via raw `fetch("/api/users/me/avatar", { method: "POST", credentials: "include", body: formData })` — no Content-Type header (browser sets boundary)
- Avatar remove via `del("/users/me/avatar")` followed by `refreshUser()`
- REMOVE button conditionally rendered only when `user.avatar_url` exists
- NAME and EMAIL `RetroInput` fields with `<label>` elements; email field shows inline error via `error` prop on 409
- SAVE CHANGES button calls `patch<User>("/users/me", { full_name, email })` then `refreshUser()`
- 409 email conflict detected from error message and shown as `emailError` state on the email input
- Loading state on both save and avatar buttons prevents double-submit
- All strings via Lingui `t` macro

**SecurityPage (`frontend2/src/features/settings/SecurityPage.tsx`):**
- **Password section:** Branches on `user.has_password` — shows CURRENT PASSWORD field only when true; both fields use `autoComplete="current-password"` / `autoComplete="new-password"`; 400 error shown inline on current password input
- **Sessions section:** `get<Session[]>("/users/me/sessions")` on mount; each row shows device_info + IP + last_active_at; `is_current` sessions get `<RetroBadge variant="success">CURRENT</RetroBadge>`, others get REVOKE button calling `del("/users/me/sessions/{id}")`; REVOKE ALL OTHERS calls `del("/users/me/sessions")` then re-fetches
- **Connected accounts section:** `get<OAuthAccount[]>("/auth/oauth/accounts")` on mount; iterates `["google", "github"]`; linked accounts show UNLINK button (disabled when `accounts.length === 1 && !user.has_password` to prevent lockout); unlinked providers show LINK button redirecting to `/api/auth/oauth/{provider}?action=link`
- **Account deletion section:** `<RetroButton variant="danger">DELETE ACCOUNT</RetroButton>` opens `RetroDialog` via ref; dialog has CONFIRM DELETE (calls `del("/users/me")` then `logout()`) and KEEP ACCOUNT (closes dialog) buttons
- `HazardStripe` dividers separate all 4 sections

**Test updates:**
- Both `ProfilePage.test.tsx` and `SecurityPage.test.tsx` mock `useToast` via `vi.mock("@/components/retro", ...)` partial override
- `SecurityPage.test.tsx` also sets `get: vi.fn().mockResolvedValue([])` to prevent unhandled promise rejections from useEffect fetches

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. ProfilePage and SecurityPage are now fully implemented. DataPage stub remains (tracked in 53-01-SUMMARY.md, resolved by Plan 53-03).

## Threat Flags

None — all mitigations from the plan's threat model were applied:
- T-53-03: Avatar upload uses raw fetch with `credentials: "include"` (HttpOnly cookie auth)
- T-53-04: UNLINK disabled when `accounts.length === 1 && !user.has_password`
- T-53-05: REVOKE button hidden for `is_current === true` sessions
- T-53-06: Account deletion requires RetroDialog confirmation
- T-53-08: Password change requires `current_password` sent to backend

## Self-Check: PASSED

Files exist:
- `frontend2/src/features/settings/ProfilePage.tsx` — FOUND (contains FormData, credentials: include, del('/users/me/avatar'), patch, refreshUser, w-[80px] h-[80px], aria-label, type="file", accept="image/*", useToast, 409)
- `frontend2/src/features/settings/SecurityPage.tsx` — FOUND (contains has_password, autocomplete="current-password", autocomplete="new-password", patch /users/me/password, get /users/me/sessions, del /users/me/sessions, is_current, RetroBadge, get /auth/oauth/accounts, action=link, RetroDialog, del /users/me, logout, HazardStripe)

Commits exist:
- 0755293 — ProfilePage implementation — FOUND
- e22248e — SecurityPage implementation — FOUND

All 119 vitest tests passing.
