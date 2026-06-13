# Phase 12: Settings hub — Research

**Researched:** 2026-06-13
**Domain:** React 19 settings UI (parity) over an existing partial scaffold + verified Go backend
**Confidence:** HIGH (every claim below is backed by a frontend file:line and/or a backend Go file:line read this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **SETT-04 vs SETT-11 → light-only (SETT-11 wins).** Appearance subpage ships a theme
  picker with ONLY the current light retro-os theme + an explicit "light only — dark theme
  is on the backlog" note. SETT-04's "premium-terminal only theme" prose is STALE
  (premium-terminal was scrapped for retro-os). Do NOT build a dark theme or a multi-theme switcher.
- Paperless settings slot (G-7) = a POINTER row to Phase 14b (not built here).
- Members page (G-9 / SETT-10) IS in scope (approval workflow implies multi-user).
- **SettingsLayout.tsx + routes/index.tsx are single-writer files** — the ONE plan that adds
  the new subpage routes owns them.
- Declare EVERY edited file; same-wave plans touch disjoint files.
- Preferences PATCH is partial (omitempty) — send only changed fields; GET from /users/me.
- RHF+zod forms (mirror InventoryFormPage / the shipped Security/Accounts pages).
- Online-only: NO `idb`/`serwist`/`sync*` imports. Clear-cache = `queryClient.clear()` only.
- Query keys `["me"|"sessions"|"members"|"oauth-accounts", ...]`; render-loop guard.
- Avatar upload is multipart (real storage) — reuse the photo-upload mechanics if applicable.

### Claude's Discretion
- Resolve the SETT-09 export/import scope (real workspace export endpoint vs Phase-14 pointer vs minimal).
- The iOS-grouped-row landing component shape.
- The plan/wave split for the 8-9 subpages.

### Deferred Ideas (OUT OF SCOPE)
- Dark theme / multi-theme switcher.
- Paperless settings (built in Phase 14b — only a pointer row here).
- Offline-storage management surface.
- Format READ hooks (`useDateFormat`/`useTimeFormat`/`useNumberFormat`) — Phase 15 owns these
  (see OQ3 resolution; Phase 12 only WRITES preferences).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETT-01 | Settings landing (grouped rows) | New `SettingsHome` landing page (does NOT exist — OQ1). Build iOS-grouped-row list. |
| SETT-02 | Profile (name/email + avatar) | `PATCH /users/me` (name/email) + multipart `POST /users/me/avatar` + `DELETE /users/me/avatar` (OQ2 — fully verified). |
| SETT-03 | Security (sessions/password/delete) | **DONE** in SecurityPage.tsx (sessions + password + danger zone). Verify, no rebuild. |
| SETT-04 | Appearance | Light-only theme picker + backlog note (locked decision). |
| SETT-05 | Language | `PATCH /users/me/preferences {language}` + `loadCatalog(locale)` lingui activate (OQ3). |
| SETT-06 | Regional formats | `PATCH /users/me/preferences {date_format,time_format,thousand_separator,decimal_separator}` (OQ3). |
| SETT-07 | Notifications | `PATCH /users/me/preferences {notification_preferences: map[string]bool}` (OQ3). |
| SETT-08 | Connected Accounts | **MOSTLY DONE** in AccountsPage.tsx (list/link-redirect/unlink). Verify, no rebuild (OQ4). |
| SETT-09 | Data Storage | clear-cache (`queryClient.clear()`) + REAL `GET /export/workspace` + import pointer (OQ5). |
| SETT-10 | Members | `GET/POST/PATCH/DELETE /workspaces/{wsId}/members` — server-enforced guards (OQ6). **Identity gap.** |
| SETT-11 | Light-only (wins over SETT-04) | Appearance note (locked). |
</phase_requirements>

## Summary

Phase 12 EXTENDS a partial Phase-5 scaffold. The existing `SettingsLayout.tsx` renders a
**two-tab RetroTabs sub-nav** (Security | Connected Accounts) bound to routes — it is NOT the
iOS grouped-row landing the goal describes, and **there is no `/settings` index page** (the index
route `Navigate`s straight to `/settings/security`). SecurityPage (sessions + password + danger
zone) and AccountsPage (OAuth list/link/unlink) are **complete and tested**; Phase 12 should
verify them, not rebuild them. The phase's real work is: (1) a new grouped-row landing, (2) Profile,
(3) Appearance (light-only note), (4) Preferences subpages (Language / Regional Formats /
Notifications — all writing the single `PATCH /users/me/preferences`), (5) Data Storage, and (6)
Members.

The backend is strong: avatar upload is real multipart with a server-generated 150×150 thumbnail
(`POST /users/me/avatar`, field `avatar`), preferences are a single partial-PATCH endpoint, and a
full workspace export/import domain exists (`GET /export/workspace`, `POST /import/workspace`). Two
backend constraints reshape the plan: **(a) `POST /members` takes a `user_id` UUID, NOT an email** —
there is no invite-by-email flow server-side; and **(b) `MemberResponse` exposes only `user_id`
(no email/full_name)** even though the underlying SQL already joins them. The Members page therefore
either ships with user_id display (ugly but honest) or requires a small backend DTO change — flag
as the phase's primary open decision.

**Primary recommendation:** Mirror the shipped SecurityPage/AccountsPage patterns verbatim (RHF+zod,
`["me"]` query, `Window` cards, `retroToast`, RetroConfirmDialog). Build a `settingsApi` module under
`src/lib/api/` (like `photos.ts`) wrapping `/users/me`, `/users/me/preferences`, sessions, oauth,
members, and the workspace export. Put the single-writer `SettingsLayout.tsx` rewrite + all new
`routes/index.tsx` route additions in ONE plan; group disjoint subpages into parallel plans.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Grouped-row landing | Browser/Client | — | Pure presentation + react-router `Link`s; no data. |
| Profile name/email edit | API/Backend | Browser (RHF form) | `PATCH /users/me` is authoritative; client validates UX-only. |
| Avatar upload + thumbnail | API/Backend | Browser (multipart POST) | Server generates the 150×150 thumbnail; client only sends the file. |
| Preferences (lang/format/notif) | API/Backend | Browser (RHF form) | `PATCH /users/me/preferences` is the SSOT; GET via `/users/me`. |
| Language activation | Browser/Client | API (persist) | `loadCatalog()` runs in-browser; the preference is persisted server-side. |
| Sessions / password / delete | API/Backend | Browser | Already shipped (SecurityPage). |
| OAuth link/unlink | API/Backend | Browser (full-page redirect for link) | Link is a top-level nav (OAuth flow); unlink is an XHR DELETE. |
| Workspace export/import | API/Backend | Browser (blob download / base64 upload) | Real backend domain; admin-gated. |
| Members | API/Backend | Browser | Role guards server-enforced; client mirrors for UX. |
| Clear cache | Browser/Client | — | `queryClient.clear()` — purely client. |

## Standard Stack

This is a PARITY phase — no new dependencies. Everything below is already in `frontend2`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.x | UI | project baseline |
| @tanstack/react-query | (installed) | server state (`["me"]`, `["sessions"]`, `["members"]`, `["oauth-accounts"]`) | every shipped feature uses it |
| react-hook-form + @hookform/resolvers/zod | (installed) | forms | mirrors SecurityPage/InventoryFormPage |
| zod | (installed) | schema validation | shipped pattern |
| @lingui/react/macro + @lingui/core | (installed) | i18n; `loadCatalog()` for language switch | `src/lib/i18n.ts:15` |
| react-router | 7 (library mode) | routing | `src/routes/index.tsx` |
| vitest 4 + @testing-library/react + msw | (installed) | tests | `SecurityPage.test.tsx` |

### Supporting (retro component barrel — `@/components/retro`)
`Window`, `BevelButton`, `RetroBadge`, `RetroInput`, `RetroTable`, `RetroFormField`,
`RetroConfirmDialog`, `RetroEmptyState`, `RetroFileInput`, `StatusPill`, `retroToast`,
`RetroTabs` (sub-nav), plus `form`/`feedback`/`overlay` subdir barrels (RetroSelect, RetroCheckbox,
RetroToggle live under `form` — verify exact names against `src/components/retro/form/index.ts`
when planning the preferences/notifications toggles). Source: `src/components/retro/index.ts:1-29`.

### api.ts helpers (already present — `src/lib/api.ts`)
| Helper | Line | Use in Phase 12 |
|--------|------|-----------------|
| `get<T>` | 143 | GET /users/me, sessions, members, oauth accounts |
| `patch<T>` | 158 | PATCH /users/me, /users/me/preferences, /members/{id} |
| `post<T>` | 147 | POST /members |
| `del<T>` | 165 | DELETE avatar, members, sessions, oauth |
| `postMultipart<T>` | 154 | avatar upload (field `avatar`) |
| `downloadBlob` | 189 | workspace export blob |
| `HttpError` | 22 | branch on 400/409 (wrong password, last-auth, own-role, last-owner) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `PhotoUpload.tsx` for avatar | Dedicated `AvatarUploader` | PhotoUpload is item-photo-specific (queue, dup-check, gallery). Avatar is single-file, no dup-check, instant. A small dedicated uploader is cleaner — see OQ2. |
| `["me"]` shared query | per-page refetch | Reuse `["me"]` everywhere (SecurityPage/AccountsPage already do) and `invalidateQueries(["me"])` on any profile/prefs/avatar mutation. |

**Installation:** none (parity).

## Package Legitimacy Audit

No external packages are installed in Phase 12 — it composes existing dependencies only.
Audit not applicable. (slopcheck not run: zero new packages.)

## Open Questions (RESOLVED)

### OQ1 — Inventory the existing settings scaffold ✅

**Resolution:** The scaffold is a **two-tab sub-nav, NOT a grouped-row landing**, and **there is
no `/settings` index page**.

- `SettingsLayout.tsx:14-53` — renders `RetroTabs` with exactly two tabs: `security` →
  `/settings/security` and `accounts` → `/settings/accounts` (`TAB_ROUTES`, line 14-17). Active
  tab derived from `location.pathname` (line 21-23). The routed child renders through `<Outlet/>`.
  The header comment (line 5-12) explicitly says "Phase 12 fills the full hub" and "Future hub tabs
  (Profile, Members, Preferences — Phase 12) are intentionally NOT rendered here."
- `routes/index.tsx:133-137` — `<Route path="settings" element={<SettingsLayout/>}>` with
  `<Route index element={<Navigate to="security" replace/>}/>` + `security` + `accounts`. **The index
  redirects away** — no landing component exists.
- `SecurityPage.tsx:43-427` — **COMPLETE**: Card A Sessions (`["sessions"]`, revoke-one + revoke-all,
  relative timestamps, `is_current` badge), Card B Password (change-vs-set driven by `has_password`,
  400 → "current password incorrect" band), Card C Danger Zone (`can-delete` gate +
  type-DELETE confirm + client auth cleanup). Tested in `SecurityPage.test.tsx` (9.8 KB).
- `AccountsPage.tsx:55-209` — **COMPLETE**: Google + GitHub rows reconciled against
  `GET /auth/oauth/accounts`; LINKED→Unlink (pink confirm→DELETE), NOT LINKED→Link (full-page nav
  to `/api/auth/oauth/{provider}`); last-auth lockout guard (`canUnlink`, line 95) mirroring the
  backend 409. Tested in `AccountsPage.test.tsx` (7.3 KB).

**What remains for Phase 12 (does NOT duplicate existing work):**
1. A new **grouped-row landing** at `/settings` (index) — the iOS-style list (SETT-01).
2. **Profile** subpage (SETT-02) — name/email + avatar.
3. **Appearance** subpage (SETT-04/11) — light-only note.
4. **Language / Regional Formats / Notifications** subpages (SETT-05/06/07) — preferences PATCH.
5. **Data Storage** subpage (SETT-09).
6. **Members** subpage (SETT-10).
7. **Rewrite `SettingsLayout.tsx`** — the two-tab RetroTabs is the wrong shell for a 9-row hub.
   Options: (a) keep `SettingsLayout` as a thin `<Outlet/>` wrapper and make the **landing** the
   index page, or (b) keep tabs but expand to ~9 tabs. **Recommend (a)**: a grouped-row landing as
   the index + subpages each rendering full-width through the Outlet. The header comment already
   anticipates this. SecurityPage/AccountsPage routes stay; their tab affordance is replaced by the
   landing's rows + a back-to-settings breadcrumb.

**Single-writer note:** `SettingsLayout.tsx` and `routes/index.tsx` are BOTH edited by exactly one
plan (the routing plan). All subpage component files are disjoint and parallelizable.

### OQ2 — Avatar upload ✅

**Resolution:** Real multipart, server-side thumbnail. Use a **dedicated `AvatarUploader`**, not
`PhotoUpload.tsx`.

Backend (`backend/internal/domain/auth/user/handler.go`):
- `RegisterAvatarRoutes` (line 159-164): `POST /users/me/avatar` (`uploadAvatar`) +
  `GET /users/me/avatar` (`serveAvatar`). Registered on a **Chi router** (multipart needs Chi, not
  huma) — under the same `/api` prefix, so the frontend path is `/api/users/me/avatar`.
- `DELETE /users/me/avatar` (`deleteAvatar`) is huma-registered (line 155).
- `uploadAvatar` (line 672-797): `ParseMultipartForm`; **form field name is `avatar`**
  (line 694: `r.FormFile("avatar")`); max **2 MB** (`MaxAvatarSize = 2*1024*1024`, line 659);
  allowed MIME = jpeg/png/webp (`allowedAvatarMimeTypes`, line 665); **server generates a 150×150
  square thumbnail** (`AvatarThumbnailSize = 150`, line 661; `GenerateThumbnail`, line 757); old
  avatar auto-deleted (line 779-780). Returns the **full user JSON** including
  `"avatar_url":"/api/users/me/avatar"` (line 796-797).
- `GetMe` / `UpdateMe` / `UpdatePrefs` set `AvatarURL = generateAvatarURL(user.AvatarPath())`
  (handler.go:370/454/508/1050) → `*string` = `/api/users/me/avatar` when an avatar exists, else
  `nil`/omitted (`avatar_url,omitempty`, line 1047). **Already `/api`-relative — no `toProxyUrl`
  needed** (unlike Photo URLs).

**Frontend pattern:** add to `settingsApi`:
```typescript
uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append("avatar", file);             // field name MUST be "avatar"
  return postMultipart<User>("/users/me/avatar", form);
}
deleteAvatar(): Promise<void> { return del("/users/me/avatar"); }
```
The `AvatarUploader` UI: a 150×150 preview (the `avatar_url` or a placeholder), a `RetroFileInput`
(`accept="image/jpeg,image/png,image/webp"`, `maxSize={2*1024*1024}`, `multiple={false}`), and a
Remove button (DELETE → `invalidateQueries(["me"])`). On upload success, `invalidateQueries(["me"])`
so the avatar refreshes everywhere. **Do not reuse `PhotoUpload.tsx`** — it carries item-photo
queue/dup-check/gallery machinery (`PhotoUpload.tsx:33-313`) that is dead weight for a single avatar.
Cache-bust the `<img>` on re-upload (the URL is stable `/api/users/me/avatar`): append `?v=Date.now()`
after a successful upload, or key the `<img>` on `me.dataUpdatedAt`.

### OQ3 — Preferences plumbing ✅

**Resolution:** Format READ hooks do **NOT** exist. Phase 12 only **WRITES** preferences; Phase 15
owns the read/format hooks.

- `grep -rn "useDateFormat|useTimeFormat|useNumberFormat" src/` → **zero hooks** (matches were
  inline `formatDate()` helpers in `LoanPanels.tsx:192`, `BorrowerLoanPanels.tsx`, etc., none of which
  read `/users/me` preferences — each re-implements `new Date(iso)` locally).
- `grep -rn "preferences|notification_preferences|thousand_separator|date_format" src/` → **zero hits**
  in `src/` (the field names appear only in the backend). So nothing currently reads stored prefs.

The single backend endpoint covers SETT-05/06/07 (`backend/.../user/handler.go`):
- `PATCH /users/me/preferences` → `updatePreferences` (line 476-511). Input `UpdatePrefsRequestBody`
  (line 1108-1116): all fields `omitempty` —
  `date_format, time_format, thousand_separator, decimal_separator, language, theme,
  notification_preferences (map[string]bool)`. **Partial PATCH** — send only changed fields.
- Current values are read from `GET /users/me` → `UserResponse` (line 1035-1048) which carries all
  seven preference fields. So the GET source for every preferences subpage is `["me"]`.

**Write path per subpage:**
```typescript
// settingsApi
updatePreferences(body: Partial<Preferences>): Promise<User> {
  return patch<User>("/users/me/preferences", body);   // omit unchanged fields
}
```
On success: `invalidateQueries(["me"])`.

- **Language (SETT-05):** RHF select (en/et/ru — `src/lib/i18n.ts:12`). On submit:
  `await settingsApi.updatePreferences({ language })` THEN `await loadCatalog(language as Locale)`
  (`src/lib/i18n.ts:15-19` — `loadCatalog` does `i18n.load` + `i18n.activate`). Persist first, then
  activate so a failed PATCH doesn't desync the UI from the server. `loadCatalog` failure is
  non-fatal (mirror `main.tsx:14-18`).
- **Regional Formats (SETT-06):** RHF form for `date_format`, `time_format`, `thousand_separator`,
  `decimal_separator`. (The exact allowed values aren't enum-constrained server-side — they're plain
  strings; offer a small fixed option set, e.g. date `YYYY-MM-DD`/`MM/DD/YYYY`/`DD.MM.YYYY`, time
  `24h`/`12h`, separators `,`/`.`/` `. **[ASSUMED]** — these option *values* are a UX choice; confirm
  the canonical strings the backend/Phase-15 read hooks expect.)
- **Notifications (SETT-07):** `notification_preferences` is a free-form `map[string]bool`. Render a
  list of toggle rows; PATCH the whole map (or a partial map — backend merges via `omitempty` at the
  field level, but the map itself replaces wholesale, so **send the full map**). **[ASSUMED]** the set
  of notification keys (e.g. `loan_due`, `low_stock`, `expiry`) is not enumerated server-side — define
  the key set from the requirements / existing alert features; confirm with the user.

### OQ4 — Connected Accounts completeness ✅

**Resolution:** **Substantially complete** in `AccountsPage.tsx`; link is a **full-page redirect**
(OAuth flow), unlink is an XHR DELETE. Verify, do not rebuild.

Backend (`backend/internal/domain/auth/oauth/handler.go`):
- `Initiate` (line 90) — `GET /auth/oauth/{provider}` (the link redirect target).
- `Callback` (line 130) — `GET /auth/oauth/{provider}/callback`; redirects to
  `{AppURL}/auth/callback?code=...` (line 249) — the existing `CallbackPage` exchanges the code.
- `ListAccounts` (line 341-372) — `GET /auth/oauth/accounts` → `{ accounts: AccountResponse[] }`.
  `AccountResponse` (line 331-339): `provider, provider_user_id, email, display_name, avatar_url,
  created_at`. (Frontend `OAuthAccount` type in `lib/types.ts:67-71` only models `provider`,
  `display_name?`, `email?` — sufficient; the extra fields are ignored, which is fine.)
- `UnlinkAccount` (line 380-401) — `DELETE /auth/oauth/accounts/{provider}`; returns **409**
  (`ErrCannotUnlinkLastAuth`, line 394-395) when it's the sole auth method with no password, **404**
  if not linked.

Frontend (`AccountsPage.tsx`):
- list via `["oauth-accounts"]` (line 60-63); link via `navigateTo("/api/auth/oauth/{provider}")`
  full-page nav (line 39-42, 145-147) — **redirect, not XHR** (a top-level navigation is required for
  OAuth); unlink via `del("/auth/oauth/accounts/{provider}")` (line 70-71) with 409 → danger toast
  (line 80-85); client lockout guard `canUnlink` mirrors the backend (line 95).

**Remaining for Phase 12:** none functional. Optional polish only: surface the account `email`/
`created_at` if desired. SETT-08 is effectively done — the plan should just route it into the new hub
landing and confirm tests pass.

### OQ5 — SETT-09 Data Storage ✅

**Resolution:** There IS a real workspace export AND import — CONTEXT.md's "no dedicated endpoint
found" is superseded. Scope = **clear-cache (client) + real workspace export (download) + workspace
import (admin) and/or a pointer to the Phase-14 import-job system.**

Backend `importexport` domain (`backend/internal/domain/importexport/handler.go`), registered on the
**workspace-scoped** router (`internal/api/router.go:446` `r.Route("/workspaces/{workspace_id}")` →
:552 `importExportHandler.RegisterRoutes(wsAPI)`), so all paths are under
`/api/workspaces/{wsId}/...`:
- `GET /export/{entity_type}` (line 75-82, `Export`) — csv/json per entity (item, location,
  container, category, label, company, borrower). Returns a blob (`Content-Disposition: attachment`).
- `GET /export/workspace` (line 94-101, `ExportWorkspaceFull`) — **full backup**, `?format=xlsx|json`
  (default xlsx), `?include_archived`. **Requires admin role** (`requireAdminRole`, line 227). Returns
  a blob (line 243-247).
- `POST /import/{entity_type}` (line 84-92, `Import`) — base64 body, admin-gated (line 168).
- `POST /import/workspace` (line 103-111, `ImportWorkspaceFull`) — base64 xlsx/json, admin-gated.
- Separate import-JOB system (`importjob.RegisterRoutes`, router.go:556 + `RegisterUploadRoutes`,
  :560) is **Phase 14** — large async uploads with progress. Distinct from the synchronous
  export/import above.

Existing frontend precedent: `photosApi.exportCsv` already hits
`/workspaces/${wsId}/export/item?format=csv` via `downloadBlob` (`src/lib/api/photos.ts:128-133`) —
proof the export route works end-to-end from the client.

**Recommended SETT-09 scope (minimal-but-real):**
1. **Clear cache** — `queryClient.clear()` button + confirm. Pure client (binding constraint #5).
2. **Export** — a "Download workspace backup" button calling
   `downloadBlob("/workspaces/{wsId}/export/workspace?format=xlsx", "workspace-backup.xlsx")`. Use
   `useWorkspace().currentWorkspaceId` for `wsId` (`src/features/workspace/useWorkspace.ts`, consumed
   at `ItemsListPage.tsx:54`). Optionally also a JSON option. **Gate the button on admin role** (the
   backend 403s non-admins via `requireAdminRole`; mirror client-side using the workspace `role` from
   `useWorkspace`/`Workspace.role` — `lib/types.ts:35`).
3. **Import** — a **pointer row to Phase 14** (the import-job system is the proper home for uploads
   with validation/progress). A synchronous `POST /import/workspace` exists but wiring a full
   restore-with-confirmation flow is out of scope for a settings hub; link to `/imports` (Phase 14)
   instead. **[ASSUMED]** — confirm whether the user wants a real inline import here or just the
   pointer; recommend the pointer to keep Phase 12 bounded.

### OQ6 — Members ✅ (two backend constraints reshape the page)

**Resolution:** Routes verified, guards server-enforced. **TWO constraints the planner MUST honor:**

Backend (`backend/internal/domain/auth/member/handler.go`, registered at
`/api/workspaces/{wsId}/members` — router.go:468 on `wsAPI`):
- `GET /members` (line 17) → `{ items: MemberResponse[] }`.
- `GET /members/{user_id}` (line 39).
- `POST /members` (line 56) → `AddMemberRequest` (line 173-178): body = **`user_id` (uuid) + `role`**.
  Returns 400 if already a member (line 75).
- `PATCH /members/{user_id}` (line 86) → `{ role }` (line 184-189). **400 `ErrCannotChangeOwnRole`**
  (line 104-105) — server blocks self-role-change.
- `DELETE /members/{user_id}` (line 119). **400 "cannot remove the last owner from workspace"**
  (line 131) — server blocks last-owner removal.
- Role enum (server-enforced, `entity.go:14-19` + huma `enum:"owner,admin,member,viewer"` on the
  DTOs, line 176/187/199): **`owner` | `admin` | `member` | `viewer`** (4 values).

**Constraint A — add-by-email is NOT supported.** `AddMemberRequest.Body.UserID` is a `uuid.UUID`
(handler.go:175), and `AddMemberInput`/`AddMember` take a `UserID` (service.go:30-32, 38). There is
**no invite-by-email endpoint and no user-lookup-by-email endpoint** found. CONTEXT.md's "POST /members
(add by email)" is INCORRECT. The page can only add an existing user by their UUID.

**Constraint B — `MemberResponse` carries NO human identity.** `MemberResponse` (handler.go:195-203)
exposes `id, workspace_id, user_id, role, invited_by, created_at, updated_at` — **no email/full_name**.
The underlying SQL `ListMembersByWorkspace` (workspace_members.sql.go:166-184) DOES `JOIN auth.users`
and selects `u.email, u.full_name`, but the `Member` domain entity (entity.go:22-30) has no email field
and the service returns `[]*Member` (service.go:13) — the join columns are dropped before the handler.
So the list renders user_ids only.

**Recommended Members page UX given the constraints:**
- List: `GET /members` → rows showing `role` badge + `user_id` (mono) + (your own row tagged "YOU").
  Per-row role select (PATCH) and Remove (DELETE, pink confirm). Disable the role-select + remove on
  the current user's own row (mirror `ErrCannotChangeOwnRole`); disable remove on the last owner
  (mirror the last-owner guard) — but treat the **server as authoritative**, surfacing the 400 as a
  toast if the client guard misses (defense in depth, exactly like AccountsPage's 409 handling).
- Add member: a "user_id + role" form (honest to the backend). **This is a poor UX** — flag as the
  phase's primary open decision: either (1) ship user_id-only Members (functional, ugly), or (2) make
  a **small backend change** to expose `email`+`full_name` on `MemberResponse` (the SQL already
  fetches them; this is a thin DTO/entity addition) and add a user-lookup-by-email endpoint for the
  add flow. **Recommend (2)** if the parity bar requires email display, but that pulls backend work
  into a frontend parity phase — get explicit user sign-off. **[ASSUMED]** the parity target shows
  member emails; confirm.
- Query key: `["members", wsId]`.

### OQ7 — Plan split + single-writer ✅

**Resolution:** Recommend 5 plans across 3 waves with disjoint files.

| Plan | Files (writers) | Wave | Notes |
|------|-----------------|------|-------|
| **P1 — api + types + routing shell** | `src/lib/api/settings.ts` (new), `src/lib/types.ts` (add `Preferences`, `Member`, `User` prefs fields), `src/features/settings/SettingsLayout.tsx` (rewrite to Outlet wrapper), `src/features/settings/SettingsHome.tsx` (new landing), `src/routes/index.tsx` (add ALL new subpage routes), `src/test/msw/handlers.ts` (extend `ME` + add members/preferences/export handlers) | **Wave 1** | **SINGLE-WRITER hub.** Owns `SettingsLayout.tsx`, `routes/index.tsx`, the landing, the api module, the shared types, and the MSW base mocks. Everything downstream imports from here. Must land first. |
| **P2 — Profile + Appearance** | `src/features/settings/ProfilePage.tsx` (+test), `src/features/settings/AvatarUploader.tsx` (+test), `src/features/settings/AppearancePage.tsx` (+test) | **Wave 2** | SETT-02 + SETT-04/11. Disjoint from P3/P4. |
| **P3 — Preferences (Language/Regional/Notifications)** | `src/features/settings/LanguagePage.tsx` (+test), `src/features/settings/RegionalFormatsPage.tsx` (+test), `src/features/settings/NotificationsPage.tsx` (+test) | **Wave 2** | SETT-05/06/07. All three write `PATCH /users/me/preferences` via the P1 api module. |
| **P4 — Data Storage** | `src/features/settings/DataStoragePage.tsx` (+test) | **Wave 2** | SETT-09. clear-cache + export download + import pointer. |
| **P5 — Members** | `src/features/settings/MembersPage.tsx` (+test) | **Wave 3** (or Wave 2 if backend identity decision is settled) | SETT-10. If the backend DTO change (OQ6 option 2) is approved, that backend edit is its OWN plan/checkpoint before P5. |

SecurityPage/AccountsPage need NO plan (already shipped) — P1's route additions simply keep them
mounted. Wave 2 plans (P2/P3/P4) are fully parallel (disjoint files; all only READ the P1 api module).
P5 lands last because of the backend-identity open decision.

## Architecture Patterns

### System Architecture Diagram
```
                          /settings (index)
                                │
                    ┌───────────▼────────────┐
                    │  SettingsHome (landing) │  iOS grouped rows → <Link> per subpage
                    └───────────┬────────────┘
                                │ react-router <Outlet/> (SettingsLayout = thin wrapper)
   ┌──────────┬──────────┬──────┴─────┬───────────┬──────────┬──────────┬─────────┐
   ▼          ▼          ▼            ▼           ▼          ▼          ▼         ▼
 Profile   Appearance Language    Regional   Notifications Security  Accounts  Members  DataStorage
 (avatar)  (light note) (lingui)  Formats    (notif map)   (DONE)    (DONE)             (export/cache)
   │          │          │            │           │          │          │         │         │
   └────┬─────┴────┬─────┴─────┬──────┴────┬──────┘          │          │         │         │
        ▼          ▼           ▼           ▼                 ▼          ▼         ▼         ▼
  PATCH /users/me  PATCH /users/me/preferences        sessions/    oauth/   members/  export/
  + POST/DELETE    (partial, omitempty)               password/    accounts (ws-      workspace
  /users/me/avatar      │                              delete       link/    scoped)  + clear
  (multipart)           │                                           unlink)           cache(client)
        │               ▼
        ▼        loadCatalog(locale) → i18n.activate  (Language only, client-side)
   invalidateQueries(["me"])  ← every profile/prefs/avatar mutation refreshes the shared ["me"] query
```
All server reads of current values come from the shared `["me"]` query (`GET /users/me`).

### Recommended Project Structure
```
src/features/settings/
├── SettingsLayout.tsx     # REWRITE: thin <Outlet/> wrapper (P1, single-writer)
├── SettingsHome.tsx       # NEW: iOS grouped-row landing (P1)
├── ProfilePage.tsx        # NEW (P2)  — name/email + avatar
├── AvatarUploader.tsx     # NEW (P2)  — dedicated single-file multipart uploader
├── AppearancePage.tsx     # NEW (P2)  — light-only note + theme picker stub
├── LanguagePage.tsx       # NEW (P3)  — select + loadCatalog
├── RegionalFormatsPage.tsx# NEW (P3)
├── NotificationsPage.tsx  # NEW (P3)
├── DataStoragePage.tsx    # NEW (P4)
├── MembersPage.tsx        # NEW (P5)
├── SecurityPage.tsx       # EXISTS — unchanged
└── AccountsPage.tsx       # EXISTS — unchanged
src/lib/api/settings.ts    # NEW (P1) — typed wrapper (mirror photos.ts)
```

### Pattern 1: Mutation over an existing endpoint (the shipped idiom)
```typescript
// Source: SecurityPage.tsx:71-77 (revokeOne) — the canonical pattern
const mutation = useMutation({
  mutationFn: (body: Partial<Preferences>) => settingsApi.updatePreferences(body),
  onSuccess: () => {
    retroToast.success(t`Saved.`);
    queryClient.invalidateQueries({ queryKey: ["me"] });
  },
  onError: (err) => {
    if (err instanceof HttpError && err.status === 400) { /* inline band */ return; }
    retroToast.error(t`Couldn't save. Try again.`);
  },
});
```

### Pattern 2: RHF + zod form (shipped)
```typescript
// Source: SecurityPage.tsx:203-249 (passwordSchema + handleSubmit)
const schema = z.object({ full_name: z.string().min(1), email: z.string().email() });
const { register, handleSubmit, formState: { errors, isSubmitting } } =
  useForm({ resolver: zodResolver(schema) });
const submit = handleSubmit(async (v) => { await settingsApi.updateMe(v); /* toast */ });
```

### Pattern 3: typed api module (mirror photos.ts)
```typescript
// Source: src/lib/api/photos.ts:31-134 (photosApi shape)
export const settingsApi = {
  getMe: () => get<User>("/users/me"),
  updateMe: (b: { full_name?: string; email?: string }) => patch<User>("/users/me", b),
  updatePreferences: (b: Partial<Preferences>) => patch<User>("/users/me/preferences", b),
  uploadAvatar: (file: File) => { const f = new FormData(); f.append("avatar", file);
    return postMultipart<User>("/users/me/avatar", f); },
  deleteAvatar: () => del("/users/me/avatar"),
  listMembers: (wsId: string) => get<{ items: Member[] }>(`/workspaces/${wsId}/members`),
  addMember: (wsId: string, b: { user_id: string; role: string }) =>
    post<Member>(`/workspaces/${wsId}/members`, b),
  updateMemberRole: (wsId: string, userId: string, role: string) =>
    patch<Member>(`/workspaces/${wsId}/members/${userId}`, { role }),
  removeMember: (wsId: string, userId: string) =>
    del(`/workspaces/${wsId}/members/${userId}`),
  exportWorkspace: (wsId: string, format: "xlsx" | "json" = "xlsx") =>
    downloadBlob(`/workspaces/${wsId}/export/workspace?format=${format}`, `workspace-backup.${format}`),
};
```

### Anti-Patterns to Avoid
- **Rebuilding SecurityPage/AccountsPage.** They are complete and tested. Only route them into the hub.
- **Reusing PhotoUpload for avatar.** Dead-weight queue/dup-check; build `AvatarUploader`.
- **Sending the whole preferences object on every PATCH.** Send only changed fields (omitempty);
  EXCEPT `notification_preferences` which replaces wholesale — send the full map for that one field.
- **Two plans editing SettingsLayout.tsx or routes/index.tsx.** Single-writer (P1) only.
- **Computing date/format from preferences in Phase 12.** That's Phase 15. Phase 12 only WRITES prefs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar thumbnail | client-side canvas resize | server's 150×150 generation (`uploadAvatar`) | backend already does it (handler.go:757); client just POSTs the file |
| Workspace backup export | per-entity stitching | `GET /export/workspace` | one admin-gated endpoint produces the full xlsx/json (handler.go:214-248) |
| Last-owner / own-role guards | client-only enforcement | server 400s + client mirror | server is authoritative (handler.go:104,131); mirror for UX only |
| Last-auth unlink guard | new logic | shipped `canUnlink` (AccountsPage.tsx:95) | already mirrors backend 409 |
| Blob download plumbing | manual anchor/objectURL | `downloadBlob` (api.ts:189) | already handles credentials + revoke |
| i18n catalog load+activate | manual `i18n.load`/`activate` | `loadCatalog(locale)` (i18n.ts:15) | one call does both, with the project's chunk convention |

**Key insight:** Almost every Phase-12 surface is a thin form over an already-complete backend
endpoint. The risk is NOT the backend — it's duplicating the shipped scaffold and mis-scoping Members.

## Runtime State Inventory

Greenfield UI work over existing endpoints — no rename/refactor/migration. Section omitted by rule.

## Common Pitfalls

### Pitfall 1: Settings single-writer collision
**What goes wrong:** Two parallel plans both edit `SettingsLayout.tsx` or `routes/index.tsx`,
producing merge conflicts in the executor worktrees.
**How to avoid:** P1 is the ONLY writer of those two files (and `settings.ts`, `types.ts`, the MSW
base mocks). Every other plan adds a NEW file and imports from P1.
**Warning signs:** A Wave-2/3 plan declares `routes/index.tsx` as an edited file.

### Pitfall 2: Partial-prefs PATCH sends stale/zero values
**What goes wrong:** Spreading the whole prefs object into the PATCH overwrites fields the user
didn't touch with empty strings (the backend `omitempty` means empty strings are dropped, but an
explicit `""` from a controlled input is sent and may clobber).
**How to avoid:** Build the PATCH body from only the dirty fields (RHF `formState.dirtyFields`), or
one subpage = one field group. For `notification_preferences`, send the FULL map (it replaces
wholesale, not field-merged).
**Warning signs:** A regional-format change resets the language, or a notification toggle wipes other
toggles.

### Pitfall 3: Online-only — no idb/serwist/sync
**What goes wrong:** Reaching for IndexedDB to "cache settings offline" or an offline-storage panel.
**How to avoid:** Clear-cache = `queryClient.clear()` ONLY (binding constraint #5). No `idb`,
`serwist`, `workbox`, or `sync*` imports anywhere in the new files.
**Warning signs:** Any new dependency; any import containing `idb`/`serwist`/`sync`.

### Pitfall 4: Render-loop from preference activation
**What goes wrong:** Calling `loadCatalog`/`i18n.activate` inside render or an unguarded `useEffect`
re-triggers on every render → infinite loop / FOUC flicker.
**How to avoid:** Activate inside the mutation `onSuccess` (an event handler), not in render. The
Language subpage's submit handler awaits the PATCH then awaits `loadCatalog(locale)` exactly once.
**Warning signs:** Repeated network calls; the language select flickering.

### Pitfall 5: Query-key prefix drift
**What goes wrong:** A new subpage queries `/users/me` under a fresh key (e.g. `["profile"]`),
desyncing from the shared `["me"]` that SecurityPage/AccountsPage already populate — avatar/name
changes don't propagate.
**How to avoid:** Use the EXACT shipped keys: `["me"]`, `["sessions"]`, `["oauth-accounts"]`,
`["can-delete"]`; new keys: `["members", wsId]`. Invalidate `["me"]` after any profile/prefs/avatar
mutation.
**Warning signs:** The header avatar doesn't update after upload; the language select shows the old
value after save.

### Pitfall 6: Members page assumes email-based invite / email display
**What goes wrong:** Building an "invite by email" form or rendering `member.email` — neither exists in
the API (`AddMemberRequest` takes `user_id`; `MemberResponse` has no email — handler.go:175, 195-203).
**How to avoid:** Either ship user_id-based Members, or get sign-off for the small backend DTO change
(expose the already-joined `email`/`full_name`). Decide BEFORE planning P5.
**Warning signs:** `member.email` in a `.tsx` file with no corresponding backend field.

### Pitfall 7: Avatar `<img>` stale after re-upload
**What goes wrong:** The avatar URL is stable (`/api/users/me/avatar`), so the browser serves the
cached old image after a new upload.
**How to avoid:** Cache-bust on success (`?v=${me.dataUpdatedAt}` or `?v=${Date.now()}`) and
`invalidateQueries(["me"])`.
**Warning signs:** New avatar uploads "succeed" (toast) but the preview shows the old image.

### Pitfall 8: Export button shown to non-admins
**What goes wrong:** `GET /export/workspace` 403s non-admins (`requireAdminRole`, handler.go:227);
showing the button to everyone produces a confusing error toast.
**How to avoid:** Gate the export button on the workspace `role` from `useWorkspace`/`Workspace.role`
(admin/owner). Still handle the 403 defensively.
**Warning signs:** A viewer/member sees "Download backup" and gets a 403 toast.

## Code Examples

### Language switch (persist then activate)
```typescript
// Source pattern: src/lib/i18n.ts:15-19 (loadCatalog) + SecurityPage.tsx mutation idiom
const save = useMutation({
  mutationFn: (language: Locale) => settingsApi.updatePreferences({ language }),
  onSuccess: async (_data, language) => {
    await loadCatalog(language);            // i18n.load + i18n.activate, once
    queryClient.invalidateQueries({ queryKey: ["me"] });
    retroToast.success(t`Language updated.`);
  },
});
```

### Workspace export download
```typescript
// Source: src/lib/api/photos.ts:128-133 (downloadBlob precedent) + handler.go:94-101
const { currentWorkspaceId: wsId } = useWorkspace();   // ItemsListPage.tsx:54
const onExport = () => { if (wsId) settingsApi.exportWorkspace(wsId, "xlsx"); };
```

### Clear cache (client-only)
```typescript
const queryClient = useQueryClient();
const clearCache = () => { queryClient.clear(); retroToast.success(t`Cache cleared.`); };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CONTEXT.md: "no workspace export endpoint found" | `GET /export/workspace` + `POST /import/workspace` EXIST | verified 2026-06-13 | SETT-09 gets a real export; import = pointer to Phase 14 |
| CONTEXT.md: "POST /members (add by email)" | `POST /members` takes `user_id` UUID | verified 2026-06-13 | Members add flow cannot use email without a backend change |
| Goal: "SettingsLayout renders grouped rows" | It renders a 2-tab RetroTabs sub-nav; no index page | verified 2026-06-13 | landing must be NEW; SettingsLayout rewritten |

**Deprecated/outdated:**
- SETT-04 "premium-terminal only theme" prose — premium-terminal was scrapped for retro-os; light-only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Regional-format option *values* (date `YYYY-MM-DD` etc., time `24h/12h`, separators) are a UX choice; backend stores free strings | OQ3 | If Phase-15 read hooks expect specific tokens, mismatched values won't format correctly. Confirm canonical strings. |
| A2 | The `notification_preferences` key set (e.g. `loan_due`, `low_stock`, `expiry`) is defined by requirements, not server enum | OQ3 | Wrong keys = toggles that silently do nothing. Confirm the key list. |
| A3 | SETT-09 import = pointer to Phase 14 (not an inline `POST /import/workspace` restore) | OQ5 | If the user wants inline restore, scope grows (file picker + base64 + confirm + result UI). |
| A4 | The parity target displays member email/name (motivating the OQ6 backend DTO change) | OQ6 | If user_id-only is acceptable, no backend change needed and P5 simplifies. |
| A5 | A CI grep guard forbids `idb`/`serwist`/`sync*` (stated in CONTEXT.md) — not found as a literal script in `.github/` this session | Pitfalls | If the guard is real and named differently, ensure new files comply (they will — no offline imports planned). |

**These five assumptions need user/planner confirmation before becoming locked decisions.** A1/A2/A4
are the most consequential.

## Open Questions

1. **Members identity (the phase's primary decision).**
   - What we know: `MemberResponse` exposes only `user_id`; `POST /members` needs a `user_id`; the SQL
     already joins `email`/`full_name` but the DTO drops them; no user-lookup-by-email endpoint.
   - What's unclear: does parity require showing member emails + invite-by-email?
   - Recommendation: get sign-off. If yes → a small backend plan (expose email/full_name on
     `MemberResponse` + add a lookup-by-email route) precedes P5. If no → ship user_id-based Members.

2. **Regional-format token values + notification key set** (A1/A2) — confirm before P3.

3. **Data Storage import scope** (A3) — inline restore vs Phase-14 pointer.

## Environment Availability

Frontend-only parity over already-running services. No new external tools. Section minimal:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vite dev + backend :8080 + Postgres | E2E only (not unit) | ✓ (per CLAUDE.md runbook) | — | unit tests use MSW, no backend |
| bun (test runner via vitest) | unit tests | ✓ | vitest ^4.1.5 | — |

No blocking dependencies — all Phase-12 work is testable via MSW unit tests.

## Validation Architecture

`nyquist_validation` is not set in `.planning/config.json` → treat as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4 + @testing-library/react + msw |
| Config file | `frontend2/vitest.config.*` (existing) |
| Quick run command | `cd frontend2 && bun run test -- src/features/settings/` |
| Full suite command | `cd frontend2 && bun run test` (`"test": "vitest run"`) |

### Test conventions (from `SecurityPage.test.tsx:1-12`)
Render with explicit providers: `<I18nProvider i18n={i18n}>` + `<MemoryRouter>` +
`<QueryClientProvider>` (fresh `QueryClient` per test) + `<ModalStackProvider>` + `<RetroToaster>`.
Mock contracts via `server.use(http.get/patch/...)` overriding `src/test/msw/handlers.ts`. The shared
`ME` mock (`handlers.ts:38-44`) currently LACKS preference fields — **P1 must extend `ME`** with
`date_format/time_format/thousand_separator/decimal_separator/language/theme/notification_preferences`
and add MSW handlers for `PATCH /users/me/preferences`, `POST /users/me/avatar`, members, and
`GET /export/workspace`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETT-01 | landing renders all rows, links navigate | unit | `bun run test -- src/features/settings/SettingsHome.test.tsx` | ❌ Wave 0 (P1) |
| SETT-02 | name/email PATCH; avatar upload (field `avatar`) + delete; `["me"]` invalidated | unit | `... ProfilePage.test.tsx` | ❌ Wave 0 (P2) |
| SETT-04/11 | light-only note shown; no dark toggle | unit | `... AppearancePage.test.tsx` | ❌ Wave 0 (P2) |
| SETT-05 | language PATCH then `loadCatalog` called once | unit | `... LanguagePage.test.tsx` | ❌ Wave 0 (P3) |
| SETT-06 | regional fields PATCH (only changed) | unit | `... RegionalFormatsPage.test.tsx` | ❌ Wave 0 (P3) |
| SETT-07 | notification map PATCH (full map) | unit | `... NotificationsPage.test.tsx` | ❌ Wave 0 (P3) |
| SETT-08 | (regression) accounts list/link/unlink | unit | `... AccountsPage.test.tsx` | ✅ exists |
| SETT-03 | (regression) sessions/password/delete | unit | `... SecurityPage.test.tsx` | ✅ exists |
| SETT-09 | clear-cache calls `queryClient.clear`; export hits `/export/workspace` | unit | `... DataStoragePage.test.tsx` | ❌ Wave 0 (P4) |
| SETT-10 | list/role-change/remove; own-row + last-owner disabled; 400 surfaced | unit | `... MembersPage.test.tsx` | ❌ Wave 0 (P5) |

### Sampling Rate
- **Per task commit:** `bun run test -- src/features/settings/<file>`
- **Per wave merge:** `bun run test -- src/features/settings/`
- **Phase gate:** full `bun run test` green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Extend `src/test/msw/handlers.ts` `ME` mock with preference fields + add prefs/avatar/members/
      export handlers (owned by P1).
- [ ] One `*.test.tsx` per new subpage (P1-P5 each ship their own).
- [ ] No framework install needed (vitest present).

## Security Domain

`security_enforcement` not set → enabled. Frontend parity phase; the relevant controls are
backend-enforced and the client mirrors them.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | password change (`PATCH /users/me/password`), OAuth link/unlink — all backend; client surfaces 400/409 |
| V3 Session Management | yes | sessions list/revoke (shipped SecurityPage); cookie-JWT via `credentials:"include"` (api.ts) |
| V4 Access Control | yes | workspace export + member mutations are role-gated server-side (`requireAdminRole`, `ErrCannotChangeOwnRole`, last-owner guard); client mirrors for UX, server authoritative |
| V5 Input Validation | yes | zod on every form; backend re-validates (email format, role enum, min password 8) |
| V6 Cryptography | no | none in this phase (no hand-rolled crypto) |

### Known Threat Patterns for React-over-Go
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via member role change | Elevation | server `ErrCannotChangeOwnRole` (400) + admin gating; client mirror only |
| Removing last owner (workspace lockout) | Denial of Service | server "cannot remove last owner" (400) |
| Unlinking sole auth method (account lockout) | Denial of Service | server `ErrCannotUnlinkLastAuth` (409) + client `canUnlink` guard |
| Non-admin data exfiltration via export | Information Disclosure | server `requireAdminRole` 403 + client role gate |
| Self-account-delete while sole workspace owner | Denial of Service | server `can-delete` block + type-DELETE UX gate (shipped) |
| Avatar upload abuse (oversized/wrong-type) | Tampering/DoS | server 2 MB cap + MIME allowlist (jpeg/png/webp) (handler.go:659-665); client `maxSize`+`accept` mirror |

## Sources

### Primary (HIGH confidence — read this session)
- `frontend2/src/features/settings/SettingsLayout.tsx` (1-53) — 2-tab sub-nav, no landing
- `frontend2/src/features/settings/SecurityPage.tsx` (1-427) — sessions/password/danger COMPLETE
- `frontend2/src/features/settings/AccountsPage.tsx` (1-209) — oauth list/link/unlink COMPLETE
- `frontend2/src/routes/index.tsx` (133-137) — settings route block, index → security redirect
- `frontend2/src/lib/api.ts` (143-206) — get/post/patch/del/postMultipart/downloadBlob/HttpError
- `frontend2/src/lib/api/photos.ts` (31-134) — typed-api-module + multipart + export precedent
- `frontend2/src/lib/types.ts` (17-75) — User/Session/OAuth/Workspace types (no prefs/member yet)
- `frontend2/src/lib/i18n.ts` (11-21) — `loadCatalog` (load+activate), locales en/et/ru
- `frontend2/src/components/retro/index.ts` (1-29) — component barrel
- `frontend2/src/components/retro/form/RetroFileInput.tsx` (1-157) — file input primitive
- `frontend2/src/features/items/components/PhotoUpload.tsx` (33-313) — why NOT to reuse for avatar
- `frontend2/src/test/msw/handlers.ts` (306-330, 38-44) — MSW conventions + ME mock (no prefs)
- `frontend2/src/features/settings/SecurityPage.test.tsx` (1-30) — render/provider/MSW conventions
- `backend/internal/domain/auth/user/handler.go` (148-164, 346-511, 655-797, 1035-1124) — me/prefs/avatar
- `backend/internal/domain/auth/oauth/handler.go` (90-130, 249, 324-401) — oauth routes + DTOs
- `backend/internal/domain/auth/member/handler.go` (14-204) — member routes, DTOs, guards
- `backend/internal/domain/auth/member/service.go` (9-60) + `entity.go` (11-54) — entity lacks email
- `backend/internal/infra/queries/workspace_members.sql.go` (166-184) — SQL joins email/full_name
- `backend/internal/domain/importexport/handler.go` (71-256) — export/import routes + admin gating
- `backend/internal/api/router.go` (446-568) — workspace-scoped mounting (members, export, importjob)

### Secondary / Tertiary
- None — every claim is sourced from a file read above. No WebSearch needed (parity over local code).

## Metadata

**Confidence breakdown:**
- Existing scaffold inventory (OQ1): HIGH — all three files + routes read in full.
- Avatar (OQ2): HIGH — route registration + handler + sizes/MIME read.
- Preferences (OQ3): HIGH — DTOs + handler read; format-hook absence confirmed by grep.
- Connected Accounts (OQ4): HIGH — handler + frontend read.
- Data Storage (OQ5): HIGH — full importexport handler + router mounting read; export precedent in photos.ts.
- Members (OQ6): HIGH — handler/service/entity/SQL all read; the two constraints are verified facts.
- Plan split (OQ7): MEDIUM-HIGH — file boundaries are concrete; wave timing depends on the OQ6 decision.
- Open assumptions (A1-A5): MEDIUM — UX/value choices the user must confirm.

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable local codebase; re-verify if backend auth/member/importexport handlers change)
