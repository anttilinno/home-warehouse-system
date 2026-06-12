---
phase: 05-auth
plan: 05
subsystem: frontend2/auth-settings
tags: [auth, settings, logout, sessions, password, account-delete, oauth-accounts]
requires:
  - "Plan 05-01: CurrentSession middleware (is_current works server-side)"
  - "Plan 05-02: MSW auth-endpoint substrate (src/test/msw)"
  - "Plan 05-03: WorkspaceProvider/useWorkspace (D-12 SSOT, workspace_id key)"
  - "Plan 05-04: retro atoms (RetroTabs, RetroConfirmDialog, RetroTable, etc.)"
provides:
  - "useLogout (AUTH-12 frontend half) — revoke + clear client state"
  - "/settings/security (AUTH-07/08/09) — sessions, password, danger zone"
  - "/settings/accounts (AUTH-10) — connected accounts link/unlink + lockout"
  - "SettingsLayout (stable /settings/* hub shell; Phase 12 fills the hub)"
  - "User.has_password + SessionResponse/CanDeleteResponse/OAuthAccount types"
  - "RetroConfirmDialog confirmDisabled prop (type-DELETE gate support)"
affects:
  - "frontend2/src/components/layout/AppShell.tsx (logout now real)"
  - "frontend2/src/routes/index.tsx (settings routes)"
  - "frontend2/src/lib/types.ts (User + auth surface types)"
  - "frontend2/src/components/retro/overlay/RetroConfirmDialog.tsx (confirmDisabled)"
tech-stack:
  added: []
  patterns:
    - "TanStack useMutation for revoke/password/delete/unlink with query invalidation"
    - "react-hook-form + zod (v4) for the password form (min 8 + confirm match)"
    - "best-effort logout: POST in try, unconditional client cleanup in finally"
    - "client lockout guard mirrors authoritative backend 409 (defense in depth)"
key-files:
  created:
    - frontend2/src/features/auth/useLogout.ts
    - frontend2/src/features/auth/useLogout.test.ts
    - frontend2/src/features/settings/SettingsLayout.tsx
    - frontend2/src/features/settings/SecurityPage.tsx
    - frontend2/src/features/settings/SecurityPage.test.tsx
    - frontend2/src/features/settings/AccountsPage.tsx
    - frontend2/src/features/settings/AccountsPage.test.tsx
  modified:
    - frontend2/src/components/layout/AppShell.tsx
    - frontend2/src/routes/index.tsx
    - frontend2/src/lib/types.ts
    - frontend2/src/components/retro/overlay/RetroConfirmDialog.tsx
decisions:
  - "Settings routes nest under SettingsLayout (a sub-layout) inside the authenticated AppShell layout route; /settings → /settings/security redirect"
  - "useLogout swallows the /auth/logout POST error (best-effort revoke) so the logout promise never rejects and client cleanup is unconditional"
  - "Added confirmDisabled to RetroConfirmDialog (vs a new bespoke dialog) so the type-DELETE gate composes the existing atom; body wrapper changed p→div to host the confirm input"
  - "NOT LINKED pill uses RetroBadge variant=neutral (StatusPill has no neutral variant; matches UI-SPEC §5b neutral fill)"
metrics:
  duration_min: 11
  tasks_completed: 3
  commits: 4
  files_created: 7
  files_modified: 4
  tests_added: 20
  completed: 2026-06-13
---

# Phase 5 Plan 05: Settings Skeleton + Real Logout Summary

Wired the AUTH-12 client-side logout (revoke + full client-state clear) and built
the stable `/settings/*` skeleton carrying the four account-management surfaces —
sessions, password, account deletion, connected accounts — each a thin form over
an already-complete backend endpoint.

## What Shipped

**Task 1 — useLogout + AppShell (AUTH-12 frontend half), commit `fe6ab8c3`**
- `useLogout` POSTs `/auth/logout` (server-side revoke, guarded by Plan 01) then in
  a `finally` UNCONDITIONALLY clears the in-memory refresh token, removes
  `localStorage["workspace_id"]`, calls `queryClient.clear()`, and navigates to
  `/login` — even when the POST throws (best-effort revoke; the POST error is
  swallowed so the logout promise resolves).
- AppShell replaced the navigate-only `handleLogout` stub with `useLogout()`,
  passed to TopBar behind the existing BAR-05 confirm dialog.
- `useLogout.test` proves BOTH the success and POST-500 (finally) paths.

**Task 2 — SettingsLayout + SecurityPage (AUTH-07/08/09), commits `7e598043` (A) + `f12c4ed1` (B)**
- `SettingsLayout`: RetroTabs (Security / Connected Accounts) bound to routes,
  route-driven active tab, content via nested `<Outlet/>`; `/settings` redirects to
  `/settings/security`. Settings routes nest under the authenticated AppShell.
- SecurityPage Card A (Sessions): `GET /users/me/sessions` in a RetroTable; the
  `is_current` row carries a `THIS DEVICE` RetroBadge and NO revoke; other rows get
  per-row Revoke (DELETE one); revoke-all-others behind a pink RetroConfirmDialog
  (DELETE all), disabled when only the current session exists; mint success toasts.
- Card B (Password): `has_password` (from `GET /users/me`) drives change-vs-set.
  `has_password=true` → current+new+confirm → PATCH with `current_password`;
  `has_password=false` → butter explainer + new+confirm only → PATCH WITHOUT
  `current_password`; 400 → inline "Current password is incorrect." band.
- Card C (Danger Zone, pink): `GET /users/me/can-delete` on mount; `can_delete=true`
  → type-DELETE RetroConfirmDialog (confirm disabled until input==="DELETE",
  case-insensitive) → `DELETE /users/me` → clear cache+workspace+token → `/login`;
  `can_delete=false` → disabled trigger + blocking-workspaces danger band.

**Task 3 — AccountsPage (AUTH-10), commit `3256b867`**
- One row per supported provider (Google, GitHub), reconciling
  `GET /auth/oauth/accounts` against the supported set: linked → LINKED pill +
  Unlink; not linked → NOT LINKED pill + Link.
- Link → full-page `window.location` nav to `/api/auth/oauth/{provider}`.
- Unlink → pink RetroConfirmDialog → `DELETE /auth/oauth/accounts/{provider}` →
  mint toast + refetch.
- Lockout guard: `canUnlink = !(linkedCount===1 && !has_password)` mirrors the
  backend `ErrCannotUnlinkLastAuth`; disabled Unlink + butter note via
  `aria-describedby`; a backend 409 still surfaces a danger toast (defense in depth,
  T-05-21).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `User` type lacked `has_password`; missing auth surface types**
- **Found during:** Task 2 (password card branch + Task 3 unlink guard both read `has_password`)
- **Issue:** The Phase 1 trim of `lib/types.ts` reduced `User` to a 4-field subset
  with no `has_password`, and there were no `SessionResponse`/`CanDeleteResponse`/
  `OAuthAccount` types — all required by the verified contract.
- **Fix:** Added `has_password: boolean` to `User` and the auth-surface interfaces
  (`SessionResponse`, `BlockingWorkspace`, `CanDeleteResponse`, `OAuthAccount`,
  `OAuthAccountsResponse`) to `lib/types.ts`.
- **Files modified:** frontend2/src/lib/types.ts
- **Commit:** 7e598043

**2. [Rule 2 - Missing critical functionality] RetroConfirmDialog had no disabled-confirm**
- **Found during:** Task 2 (Danger Zone type-DELETE gate)
- **Issue:** The type-DELETE gate requires the confirm button to stay disabled until
  the input matches "DELETE"; RetroConfirmDialog hard-enabled its confirm button and
  wrapped children in a `<p>` (can't host an `<input>`).
- **Fix:** Added a `confirmDisabled` prop (disables + `aria-disabled`s the confirm,
  cancel stays focusable) and changed the body wrapper `p`→`div` so confirm dialogs
  may host controls. Composing the existing atom beat a bespoke dialog (no new atom).
- **Files modified:** frontend2/src/components/retro/overlay/RetroConfirmDialog.tsx
- **Commit:** f12c4ed1

### Minor presentation choice
- NOT LINKED pill uses `RetroBadge variant="neutral"` (StatusPill exposes only
  ok/warn/info/danger; UI-SPEC §5b specifies a neutral fill for NOT LINKED).

## Authentication Gates
None — all surfaces are mocked via MSW in unit tests; no live-auth step required.

## Verification
- `bun run test src/` → **313 passed (50 files)**.
- `bun run lint:tsc` → clean. `bun run lint:imports` → OK. `bun run build` → built.
- New tests: useLogout (2), SecurityPage (9: 4 sessions + 3 password + 2 danger),
  AccountsPage (5).
- Did NOT touch `vite.config.ts` or `api.ts` locked invariants; did NOT modify
  STATE.md or ROADMAP.md (orchestrator owns those).

## Notes for Downstream
- The shared MSW `SESSIONS` fixture (`src/test/msw/handlers.ts`) still uses the OLD
  `device`/`ip` field names (not `device_info`/`ip_address`). SecurityPage tests
  override per-case with the correct contract shape; a future plan touching the
  shared fixture should align it to `SessionResponse`.
- Settings hub is intentionally minimal (only Security + Connected Accounts tabs) —
  Profile/Members/Preferences land in Phase 12.
- E2E logout-revocation + register specs (Wave 0 gaps in 05-RESEARCH) are out of
  this plan's scope (unit-tested here; live E2E is a separate deliverable).

## Self-Check: PASSED
All 7 created files exist; all 4 task commits (fe6ab8c3, 7e598043, f12c4ed1,
3256b867) are present in the git log.
