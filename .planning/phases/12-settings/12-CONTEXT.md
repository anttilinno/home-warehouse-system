# Phase 12 — Settings hub — CONTEXT

**Goal:** A `/settings` landing with iOS-style grouped rows linking to subpages: Profile,
Security, Appearance (light-only), Language, Regional Formats, Notifications, Connected
Accounts, Data Storage, + a Members page. EXTENDS the existing settings scaffold.

**Requirements:** SETT-01..11. **Depends on:** Phase 5, Phase 6. **UI phase:** yes.
**Plans (roadmap):** TBD — large (8-9 subpages); expect 4-6 plans.

## What ALREADY exists (EXTEND, do not rebuild)
- `frontend2/src/features/settings/`: **SettingsLayout.tsx**, **SecurityPage.tsx** (+test),
  **AccountsPage.tsx** (+test) — shipped in Phase 5. routes/index.tsx already mounts
  `<Route path="settings" element={<SettingsLayout/>}>` with `/settings → /settings/security`
  and the two built subpages. Phase 12 ADDS the landing-grouped-rows + the remaining subpages
  + Members, and completes any gaps in Security/Accounts. **SettingsLayout + routes/index.tsx
  are single-writer files** — the plan adding the new subpage routes owns them.
- Auth/format hooks likely exist (Phase 6 providers) — `useWorkspace`, possibly format hooks
  (useDateFormat etc.) — research inventories them (Phase 15 also touches format hooks).
- Avatar upload is REAL multipart (Chi route in auth/user, unlike the attachment byte-stub) —
  SETT-02 avatar works end-to-end. Confirm the exact upload route in research.

## Backend surface (verified 2026-06-13, under /api unless noted)
- Profile: `GET /users/me`, `PATCH /users/me` (name/email), `DELETE /users/me/avatar`,
  avatar UPLOAD via a Chi multipart route (confirm path), `GET /users/me/can-delete`,
  `DELETE /users/me` (account delete).
- Password: `PATCH /users/me/password`.
- Preferences (ONE endpoint covers SETT-05/06/07): `PATCH /users/me/preferences` — fields
  `date_format, time_format, thousand_separator, decimal_separator, language, theme,
  notification_preferences (map[string]bool)`. GET via `/users/me` (the GetMe response carries them).
- Sessions (SETT-03): `GET /users/me/sessions`, `DELETE /users/me/sessions/{id}` (revoke one),
  `DELETE /users/me/sessions` (revoke all others).
- Connected Accounts (SETT-08): oauth domain — list linked accounts + link/unlink (AccountsPage
  already consumes; confirm exact routes + whether unlink/link is complete).
- Members (SETT-10): `GET /members`, `GET /members/{user_id}`, `POST /members` (add by email),
  `PATCH /members/{user_id}` (role change), `DELETE /members/{user_id}` (remove). Workspace-scoped.
- Data Storage (SETT-09): clear-cache is CLIENT-only (queryClient.clear()). **Workspace
  export/import has NO dedicated endpoint found** — only the import-JOB system
  (`/imports/jobs`, Phase 14). Resolve in research: does SETT-09 export/import map to a real
  workspace export endpoint, to the Phase-14 import system (link/pointer), or is it minimal
  (clear-cache + per-entity export links + a pointer to Phase 14 import)? Online-only — NO
  offline-storage management surface (CI grep guard forbids idb/serwist/sync*).

## DECISIONS baked in
- **SETT-04 vs SETT-11 → light-only (SETT-11 wins).** The Appearance subpage ships a theme
  picker with ONLY the current light retro-os theme + an explicit "light only — dark theme is
  on the backlog" note. SETT-04's "premium-terminal only theme" prose is STALE (premium-terminal
  was scrapped for retro-os). Do NOT build a dark theme or a multi-theme switcher.
- Paperless settings slot (G-7) = a POINTER row to Phase 14b (not built here).
- Members page (G-9 / SETT-10) IS in scope (approval workflow implies multi-user).

## Binding constraints / carry-forward
1. SettingsLayout.tsx + routes/index.tsx single-writer (one plan adds all new subpage routes).
2. Declare EVERY edited file; same-wave plans disjoint files.
3. Preferences PATCH is partial (omitempty) — send only changed fields; GET from /users/me.
4. RHF+zod forms (mirror InventoryFormPage / the shipped Security/Accounts pages).
5. Online-only: NO idb/serwist/sync* imports (CI grep). Clear-cache = queryClient.clear() only.
6. Query keys ["me"|"sessions"|"members"|"oauth-accounts", ...]; render-loop guard.
7. Avatar upload is multipart (real storage) — reuse the photo-upload mechanics if applicable.

## Open Questions (RESOLVED — researchers + orchestrator, 2026-06-13)
- **OQ1 scaffold:** SettingsLayout is a 2-tab RetroTabs sub-nav (Security|Accounts); `/settings`
  index Navigates to `/settings/security` — NO landing exists. SecurityPage (password/sessions/
  delete) + AccountsPage (oauth list/link/unlink) are COMPLETE + tested → VERIFY, don't rebuild.
  Phase 12 NEW: landing (grouped rows), Profile, Appearance(light-only), Language/Regional/
  Notifications, Data Storage, Members + a SettingsLayout rewrite (sub-nav → landing+subroutes).
- **OQ2 avatar:** `POST /users/me/avatar` (Chi multipart, field `avatar`, 2MB, jpeg/png/webp,
  server 150×150 thumb) + `DELETE /users/me/avatar`; returns `avatar_url:"/api/users/me/avatar"`
  (already /api-relative). Build a dedicated AvatarUploader (NOT PhotoUpload).
- **OQ3 prefs:** NO format hooks exist → Phase 12 WRITES only via `PATCH /users/me/preferences`
  (partial omitempty) + local preview; Phase 15 owns read hooks. Language: persist → `loadCatalog(locale)`.
- **OQ4 accounts:** DONE (link = redirect to `/api/auth/oauth/{provider}`; unlink = DELETE with
  409 last-auth guard). No functional work — verify only.
- **OQ5 Data Storage:** real export EXISTS — `GET /export/workspace` (xlsx/json, admin-gated) +
  `POST /import/workspace`. SETT-09 = `queryClient.clear()` (clear cache) + real export download +
  import = pointer to Phase 14 (inline restore deferred). (CONTEXT's "no endpoint" was wrong.)
- **OQ6 members → ORCHESTRATOR DECISION: small backend enrich + email-add (parity-true).**
  Backend gaps: `MemberResponse` drops email/full_name (the SQL ALREADY joins them at
  workspace_members.sql.go:167 — re-expose on the entity/DTO = trivial) and `POST /members`
  takes a `user_id` UUID (no email). FIX (a dedicated backend plan, like the Phase-10 fixes):
  (1) add `email` + `full_name` to MemberResponse (surface the already-joined columns);
  (2) extend `POST /members` to accept `email` → resolve to an EXISTING user's id (404
  "no registered user with that email" if absent) — no pending-invite/email-send system (no
  email infra; out of scope). Role enum owner/admin/member/viewer; own-role-change + last-owner
  removal already 400-guarded server-side. Members page: list (name/email/role) + role select +
  remove (confirm) + add-by-email.
- **OQ7 plan split:** P1 frontend foundation (SettingsLayout rewrite + landing + routes + api +
  types + MSW — single-writer) ‖ a small BACKEND plan (members enrich + email-add) in Wave 1
  (disjoint: Go vs TS) → Wave 2 parallel P2 Profile/Appearance, P3 Language/Regional/Notifications,
  P4 Data Storage → Wave 3 P5 Members (consumes the backend plan) + P6 E2E.

## Original Open Questions (now resolved above)
- OQ1 **Inventory the existing settings scaffold**: what SettingsLayout/SecurityPage/AccountsPage
  already do (grouped-row landing? sub-nav?), so Phase 12 EXTENDS without duplicating. Does
  SettingsLayout already render the 8-row landing or just a sub-nav? Is /settings index built?
- OQ2 **Avatar upload**: the exact multipart route + how the frontend uploads (reuse PhotoUpload
  mechanics or a dedicated avatar uploader); 150×150 thumbnail handling.
- OQ3 **Preferences plumbing**: do format hooks (useDateFormat/useTimeFormat/useNumberFormat)
  already exist (Phase 6) reading /users/me preferences, or does Phase 12 only WRITE prefs and
  Phase 15 wires the format hooks? Define the Regional Formats + Language + Notifications subpage
  write path (PATCH /users/me/preferences) + the language switch effect (lingui activate).
- OQ4 **Connected Accounts completeness**: what AccountsPage already does; the exact oauth
  list/link/unlink routes; is link a redirect (OAuth flow) or an API call?
- OQ5 **SETT-09 Data Storage**: resolve the export/import scope (real workspace export endpoint
  vs pointer to Phase 14 imports vs minimal). clear-cache = queryClient.clear().
- OQ6 **Members**: the member DTO (role enum, email-invite shape), self-demotion/last-admin
  guards (server-enforced?), the Members page UX (list + role select + remove confirm + add-by-email).
- OQ7 **Plan split + single-writer** for SettingsLayout/routes; landing page + which subpages
  group into which plans (disjoint for parallelism).
