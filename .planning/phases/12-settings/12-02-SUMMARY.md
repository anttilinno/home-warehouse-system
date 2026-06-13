---
phase: 12-settings
plan: 02
subsystem: frontend2/settings
tags: [settings, routing, api, msw, parity, single-writer]
requires:
  - "backend: /users/me, /users/me/preferences, /users/me/avatar (existing)"
  - "backend: /workspaces/{wsId}/members CRUD (12-01, enriched email/full_name)"
  - "backend: /workspaces/{wsId}/export/workspace (admin-gated, existing)"
provides:
  - "settingsApi (src/lib/api/settings.ts) — the typed contract surface for all Settings subpages"
  - "Preferences + Member types; User extended with 7 preference fields (src/lib/types.ts)"
  - "SettingsLayout rewritten to a thin <Outlet/> wrapper (single-writer)"
  - "SettingsLandingPage — iOS/System-7 grouped-row landing (SETT-01)"
  - "Full /settings route table: 10 subpage routes wired (single-writer routes/index.tsx)"
  - "7 NEW subpage stubs (final export names) for Wave-2/3 in-place overwrite"
  - "MSW base mocks: ME prefs + prefs/avatar/members/export handlers"
affects:
  - "Wave-2 plans 12-03/04/05 (Profile/Appearance, Preferences, Data Storage) — import settingsApi, overwrite their stub bodies"
  - "Wave-3 plan 12-07 (Members) — imports settingsApi.listMembers/addMemberByEmail/updateMemberRole/removeMember, overwrites MembersPage stub"
tech-stack:
  added: []   # parity — ZERO new packages
  patterns:
    - "typed api module mirrors photos.ts (settingsApi)"
    - "lazy-imported subpage routes; single-writer route table"
    - "stub-handoff: 1-line stubs with FINAL export names, downstream overwrites in-place"
key-files:
  created:
    - frontend2/src/lib/api/settings.ts
    - frontend2/src/features/settings/SettingsLandingPage.tsx
    - frontend2/src/features/settings/SettingsLandingPage.test.tsx
    - frontend2/src/features/settings/ProfilePage.tsx (stub)
    - frontend2/src/features/settings/AppearancePage.tsx (stub)
    - frontend2/src/features/settings/LanguagePage.tsx (stub)
    - frontend2/src/features/settings/RegionalFormatsPage.tsx (stub)
    - frontend2/src/features/settings/NotificationsPage.tsx (stub)
    - frontend2/src/features/settings/DataStoragePage.tsx (stub)
    - frontend2/src/features/settings/MembersPage.tsx (stub)
  modified:
    - frontend2/src/lib/types.ts
    - frontend2/src/features/settings/SettingsLayout.tsx
    - frontend2/src/routes/index.tsx
    - frontend2/src/test/msw/handlers.ts
decisions:
  - "Landing reads optional counts from the EXISTING query CACHE (getQueryData / getQueryCache.findAll(['members'])) instead of useWorkspace() — avoids forcing a fetch and keeps the landing free of a WorkspaceProvider dependency (no layout shift, no spinner)."
  - "Paperless row = aria-disabled <div> with a butter 'COMING SOON' RetroBadge + 'Set up in DMS' — pointer to Phase 14b, does NOT build DMS."
  - "Verify gate uses `lint:tsc` (tsc -b --noEmit), NOT `tsc` — there is no `tsc` npm script (every prior phase hit this). Test runner is `bun run test <path>` (vitest run)."
metrics:
  duration: ~10m
  completed: 2026-06-13
---

# Phase 12 Plan 02: Settings landing + layout rewrite + api + subpage stubs Summary

Single-writer foundation for the Settings hub: typed `settingsApi`, the `Preferences`/`Member`
types, the rewritten thin-Outlet `SettingsLayout`, the iOS/System-7 grouped-row
`SettingsLandingPage` (SETT-01), the full 10-route `/settings` table, 7 final-named subpage stubs
for Wave-2/3 in-place overwrite, and the extended MSW base mocks — all with ZERO new packages.

## What was built

- **settingsApi** (`src/lib/api/settings.ts`) wrapping me / preferences / avatar / members / export.
- **Types** (`src/lib/types.ts`): `User` gained the 7 preference fields; new `Preferences` and
  `Member` interfaces (`email`/`full_name` optional — tolerate pre/post 12-01 enrichment).
- **SettingsLayout** rewritten from the 2-tab RetroTabs sub-nav to a thin
  `<div className="mx-auto max-w-[720px]"><Outlet/></div>`.
- **SettingsLandingPage**: three group `Window`s (ACCOUNT / PREFERENCES / WORKSPACE) of `<Link>`
  rows with trailing `›` chevron, no leading icons; Paperless = disabled COMING SOON pointer;
  optional counts render only when their cache is already populated.
- **routes/index.tsx**: `/settings` index = landing (no more Navigate-to-security); security +
  accounts kept; 7 new lazy subpage routes added under a Suspense boundary.
- **7 stubs** (`export function XPage() { return null }`) with FINAL export names.
- **MSW**: `ME` carries prefs; added `PATCH /users/me`, `PATCH /users/me/preferences`,
  `POST|DELETE /users/me/avatar`, members CRUD, `GET /export/workspace`.

## settingsApi exports (method signatures)

```
settingsApi.getMe(): Promise<User>
settingsApi.updateMe({ full_name?, email? }): Promise<User>
settingsApi.updatePreferences(Partial<Preferences>): Promise<User>   // notification_preferences replaces wholesale — send full map
settingsApi.uploadAvatar(file: File): Promise<User>                  // multipart, field name "avatar"
settingsApi.deleteAvatar(): Promise<void>
settingsApi.listMembers(wsId): Promise<{ items: Member[] }>
settingsApi.addMemberByEmail(wsId, { email, role }): Promise<Member>
settingsApi.updateMemberRole(wsId, userId, role): Promise<Member>
settingsApi.removeMember(wsId, userId): Promise<void>
settingsApi.exportWorkspace(wsId, format: "xlsx"|"json" = "xlsx"): Promise<void>   // /workspaces/{wsId}/export/workspace
```

## Type shapes

```
interface Preferences { date_format; time_format; thousand_separator; decimal_separator; language; theme: string; notification_preferences: Record<string,boolean> }
interface Member { id; workspace_id; user_id; role: string; email?; full_name?; invited_by?: string; created_at; updated_at: string }
User += date_format?, time_format?, thousand_separator?, decimal_separator?, language?, theme? (string), notification_preferences?: Record<string,boolean>
```

## Subpage route paths (all under /settings)

| Path | Component | Status |
|------|-----------|--------|
| `/settings` (index) | `SettingsLandingPage` | NEW (this plan) |
| `/settings/profile` | `ProfilePage` | STUB → 12-03 |
| `/settings/security` | `SecurityPage` | EXISTS (verify-only, SETT-03) |
| `/settings/appearance` | `AppearancePage` | STUB → 12-03 |
| `/settings/language` | `LanguagePage` | STUB → 12-04 |
| `/settings/formats` | `RegionalFormatsPage` | STUB → 12-04 |
| `/settings/notifications` | `NotificationsPage` | STUB → 12-04 |
| `/settings/accounts` | `AccountsPage` | EXISTS (verify-only, SETT-08) |
| `/settings/data` | `DataStoragePage` | STUB → 12-05 |
| `/settings/members` | `MembersPage` | STUB → 12-07 |

## Stub files downstream plans MUST OVERWRITE (same path + export name → no route re-edit)

`ProfilePage`, `AppearancePage`, `LanguagePage`, `RegionalFormatsPage`, `NotificationsPage`,
`DataStoragePage`, `MembersPage` — each currently `export function XPage() { return null }`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Created SettingsLandingPage during Task 2 (not waiting for Task 3)**
- **Found during:** Task 2 — `routes/index.tsx` imports `SettingsLandingPage` normally (per plan),
  so the Task-2 tsc gate could not pass until the module existed.
- **Fix:** Wrote the full `SettingsLandingPage.tsx` (a Task-3 deliverable) before running the Task-2
  gate, then wrote its test and ran the Task-3 gate. Net deliverables are identical to the plan.
- **Files:** SettingsLandingPage.tsx (created in Task 2 order rather than Task 3).

**2. [Rule 1 - Test correctness] Landing test nests the component under a `/settings` route**
- **Issue:** Relative `<Link to="profile">` resolves against the route match, not the URL; rendering
  the component bare under MemoryRouter produced `/profile`, not `/settings/profile`.
- **Fix:** Wrapped the render in `<Routes><Route path="settings" element={<SettingsLandingPage/>}/>`
  so relative links resolve under `/settings` exactly as in the real route tree.

**Note on verify-command form:** the plan's `<verify>` blocks say `bun run tsc --noEmit` and
`bun run test -- <path>`. Used `bun run lint:tsc` (no `tsc` script exists — the standing note) and
`bun run test <path>` (vitest run; the `--` separator is unnecessary with bun and the path is passed
through). There is no test file under `src/test/msw/`, so the MSW handler changes are covered by the
tsc gate + the settings-suite run that exercises them.

## Verification

- `bun run lint:tsc` — clean.
- `bun run test src/features/settings/` — 21 passed (Landing 7 + Security + Accounts regression).
- `bun run lint:imports` — OK (no offline/sync/idb imports introduced).

## Known Stubs

The 7 subpage files are INTENTIONAL stubs (`return null`) — the stub-handoff pattern. Each is owned
by a downstream Wave-2/3 plan (see table above) that overwrites the body in-place. The route table
and export names are final, so no route re-edit is needed. This is the documented design of plan
12-02 (the single-writer foundation), not an incomplete deliverable.

## Self-Check: PASSED
