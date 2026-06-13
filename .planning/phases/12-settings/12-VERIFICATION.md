---
phase: 12-settings
verified: 2026-06-13T00:00:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 12: Settings Hub Verification Report

**Phase Goal:** Deliver SETT-01..11 — the complete Settings hub (landing, profile,
security verify-only, appearance light-only, language, regional formats,
notifications, connected accounts verify-only, data storage, members + backend
enrichment).
**Verified:** 2026-06-13
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/settings` landing shows iOS-grouped rows linking to all subpages + Members + Paperless pointer | VERIFIED | `SettingsLandingPage.tsx:92-136` — three Window groups (ACCOUNT, PREFERENCES, WORKSPACE) with `<LinkRow>` for all 8 subpages; `<PaperlessRow>` renders a disabled COMING SOON badge. E2E test (`settings.spec.ts:108-132`) asserts Profile/Language/Members/Data links visible at `/settings`. |
| 2 | `SettingsLayout` is a landing+subroutes shell (no sub-nav tabs) | VERIFIED | `SettingsLayout.tsx:11-17` — single `mx-auto max-w-[720px]` column with `<Outlet />`. Route table `routes/index.tsx:180-240` wires index → `SettingsLandingPage` + 9 subroutes under `path="settings"`. |
| 3 | Profile subpage: edit name/email + avatar 150×150 (multipart field `avatar`) | VERIFIED | `ProfilePage.tsx:54-131` — partial PATCH via `dirtyFields` (only touched fields sent); `AvatarUploader.tsx:39,96-106` — `form.append("avatar", file)` to `/users/me/avatar`; 150×150 preview at `AvatarUploader.tsx:80-93`. E2E test (`settings.spec.ts:138-162`) — real name-save persists across reload. |
| 4 | Security subpage EXISTS and its tests remain green | VERIFIED | `SecurityPage.tsx` — full implementation (sessions list, revoke-one, revoke-all-others, password change/set, type-DELETE account deletion). Confirmed green by gate: 931/931 unit tests pass. Carries no TBD/FIXME markers. |
| 5 | Appearance subpage is LIGHT-ONLY — no dark option, no theme mutation, explicit backlog note | VERIFIED | `AppearancePage.tsx:5-51` — purely presentational; one locked "Light / Retro OS Pastel" card; butter note band ("Light only — a dark theme is on the backlog."); zero `useMutation` / `PATCH` calls in file. SETT-11 supersedes SETT-04 per plan comment (`AppearancePage.tsx:3`). |
| 6 | Language: en/et/ru picker — PATCH `/users/me/preferences`, then `loadCatalog`; NO format read-hooks | VERIFIED | `LanguagePage.tsx:32-47` — `settingsApi.updatePreferences({ language })` then `await loadCatalog(language)` in `onSuccess` event handler (Pitfall 4 guard). No format read-hooks present. E2E test (`settings.spec.ts:167-189`) — en→et switch persists across reload. |
| 7 | Regional Formats: four selects, partial PATCH dirty-fields-only, live preview, separator-conflict guard | VERIFIED | `RegionalFormatsPage.tsx:155-166` — only dirty fields PATCHed; `RegionalFormatsPage.tsx:144` — conflict check `thousand === decimal`; `RegionalFormatsPage.tsx:232-261` — live preview block (`data-testid="formats-preview"`). `Preferences` type (`types.ts:42-49`) carries `thousand_separator`/`decimal_separator`. |
| 8 | Notifications: five-key RetroCheckbox grid, wholesale map PATCH (not partial) | VERIFIED | `NotificationsPage.tsx:61-68` — `settingsApi.updatePreferences({ notification_preferences: fullMap })` sends the complete 5-key map. `NOTIFICATION_KEYS` array at `:23-29` mirrors backend SSE enum. Opt-out default (absent key → `true`) at `:36`. |
| 9 | Connected Accounts EXISTS and its tests remain green | VERIFIED | `AccountsPage.tsx` — full implementation (linked/unlink Google+GitHub, lockout guard). Confirmed green by gate: 931/931 unit tests pass. No TBD/FIXME markers. |
| 10 | Data Storage: `queryClient.clear()` + real `GET /export/workspace` blob + import pointer; NO idb/serwist/sync | VERIFIED | `DataStoragePage.tsx:124-127` — `queryClient.clear()` in confirm handler (no backend call). `:38-48` — `settingsApi.exportWorkspace(currentWorkspaceId, "xlsx")` calls `downloadBlob`. `:100-113` — import section is a COMING SOON badge (Phase-14 pointer). DataStoragePage.test.tsx `:178-183` — static source-text test confirms no idb/serwist/sync imports. |
| 11 | Members: list (name/email/role) + role-change + remove (confirm) + add-by-email; backend MemberResponse carries email+full_name; POST /members accepts email→resolve (404 if absent); own-role/last-owner guards | VERIFIED | **Backend:** `workspace_members.sql.go:167-169` — `SELECT ... u.email, u.full_name FROM ... JOIN auth.users u`. `member/entity.go:88-105` — `ReconstructWithIdentity` sets `email`/`FullName`. `member/handler.go:147-155,212-213` — `toMemberResponse` maps both fields. `member/service.go:59-72` — email→user-id resolve, `ErrUserNotRegistered` (404) when absent. **Frontend:** `MembersPage.tsx:127-205` — table with NAME/EMAIL/ROLE columns; role `RetroSelect` disabled for self (`:175`); `Remove` absent for self (`:192`). `MembersPage.tsx:241-334` — `AddMemberStrip` with email+role form, 404 surfaces "No registered user with that email." E2E test (`settings.spec.ts:199-218`) — live list + YOU badge + add-by-email 404 proven against real backend. |

**Score:** 11/11 truths verified

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/src/features/settings/SettingsLandingPage.tsx` | SETT-01 grouped-row landing | VERIFIED | 139 lines, three Window groups, 8 LinkRow subpages, PaperlessRow |
| `frontend2/src/features/settings/SettingsLayout.tsx` | Thin Outlet shell | VERIFIED | 17 lines, `mx-auto max-w-[720px]` + `<Outlet />` |
| `frontend2/src/features/settings/ProfilePage.tsx` | SETT-02 name/email form | VERIFIED | 132 lines, RHF+zod, partial PATCH via `dirtyFields`, inline 409 band |
| `frontend2/src/features/settings/AvatarUploader.tsx` | SETT-02 multipart avatar | VERIFIED | 144 lines, `form.append("avatar", file)`, 150×150 preview, remove flow |
| `frontend2/src/features/settings/SecurityPage.tsx` | SETT-03 verify-only | VERIFIED | 428 lines, sessions/password/danger-zone, pre-existing Phase-5 page |
| `frontend2/src/features/settings/AppearancePage.tsx` | SETT-04/SETT-11 light-only | VERIFIED | 52 lines, no mutation, locked Light card, butter backlog note |
| `frontend2/src/features/settings/LanguagePage.tsx` | SETT-05 en/et/ru | VERIFIED | 68 lines, `updatePreferences({language})` + `loadCatalog` in event handler |
| `frontend2/src/features/settings/RegionalFormatsPage.tsx` | SETT-06 formats | VERIFIED | 276 lines, four selects, dirty-field partial PATCH, live preview, conflict guard |
| `frontend2/src/features/settings/NotificationsPage.tsx` | SETT-07 notifications | VERIFIED | 164 lines, 5-key checkbox grid, wholesale map PATCH |
| `frontend2/src/features/settings/AccountsPage.tsx` | SETT-08 verify-only | VERIFIED | 210 lines, Google+GitHub link/unlink, lockout guard, pre-existing Phase-5 page |
| `frontend2/src/features/settings/DataStoragePage.tsx` | SETT-09 data/storage | VERIFIED | 137 lines, queryClient.clear, downloadBlob export, import pointer, no offline imports |
| `frontend2/src/features/settings/MembersPage.tsx` | SETT-10 members | VERIFIED | 335 lines, list+role+remove+add-by-email, own-row guards |
| `frontend2/src/lib/api/settings.ts` | Settings API module | VERIFIED | All endpoints: getMe, updateMe, updatePreferences, uploadAvatar, deleteAvatar, listMembers, addMemberByEmail, updateMemberRole, removeMember, exportWorkspace |
| `backend/internal/domain/auth/member/handler.go` | MemberResponse email+full_name | VERIFIED | `:206-215` — `Email`/`FullName` fields; `:75-76` — 404 on unregistered email |
| `backend/internal/domain/auth/member/service.go` | Email→resolve logic | VERIFIED | `:59-72` — `FindUserIDByEmail`, `ErrUserNotRegistered` on not-found |
| `backend/internal/infra/queries/workspace_members.sql.go` | JOIN query for enrichment | VERIFIED | `:167-169` — `JOIN auth.users u ON wm.user_id = u.id` returning `u.email, u.full_name` |
| `frontend2/e2e/settings.spec.ts` | Live Playwright E2E spec | VERIFIED | 4/4 tests pass chromium (confirmed by gate): landing, profile-save, language-switch, members-list+add-404 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SettingsLayout.tsx` | `routes/index.tsx` | `<Route path="settings">` | WIRED | `routes/index.tsx:180-240` — SettingsLayout is the route element; index child = SettingsLandingPage |
| `SettingsLandingPage.tsx` | all subpage routes | `<Link to="profile"/"security"/...>` | WIRED | 8 LinkRows + PaperlessRow covering all subpages |
| `ProfilePage.tsx` | `settingsApi.updateMe` | `useMutation` → PATCH `/users/me` | WIRED | `:55-62` |
| `AvatarUploader.tsx` | `settingsApi.uploadAvatar` | `form.append("avatar", file)` → POST `/users/me/avatar` | WIRED | `:44-47`; field name `"avatar"` matches `handler.go:694 r.FormFile("avatar")` |
| `LanguagePage.tsx` | `settingsApi.updatePreferences` + `loadCatalog` | `useMutation.onSuccess` event handler | WIRED | `:32-47`; loadCatalog called after PATCH resolves, not during render |
| `RegionalFormatsPage.tsx` | `settingsApi.updatePreferences` | partial PATCH, dirty fields only | WIRED | `:155-166` |
| `NotificationsPage.tsx` | `settingsApi.updatePreferences` | wholesale PrefMap | WIRED | `:61-68`; sends `{ notification_preferences: fullMap }` |
| `DataStoragePage.tsx` | `settingsApi.exportWorkspace` | `downloadBlob` → GET `/workspaces/{wsId}/export/workspace` | WIRED | `:38-48` |
| `MembersPage.tsx` | `settingsApi.listMembers` / `addMemberByEmail` / `updateMemberRole` / `removeMember` | `useQuery` / `useMutation` | WIRED | `:57-61`, `:66-98`, `:83-98`, `:263-283` |
| `backend member/service.go` | `member/repository.go` (email resolve) | `users.FindUserIDByEmail` | WIRED | `:59-72` |
| `backend infra/postgres/member_repository.go` | `ListMembersByWorkspace` SQL | `ReconstructWithIdentity(email, fullName)` | WIRED | `:96-105` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SettingsLandingPage.tsx` | `memberCount` / `linkedCount` | TanStack cache read (no fetch, render-only if cached) | Yes — intentional cache-peek design (no spinner, no layout shift) | FLOWING |
| `ProfilePage.tsx` | `me.data.full_name` / `me.data.email` | `GET /users/me` → backend DB query | Yes — `handler.go:796` returns real DB row | FLOWING |
| `AvatarUploader.tsx` | `me.data.avatar_url` | `GET /users/me` → real DB row | Yes | FLOWING |
| `LanguagePage.tsx` | `me.data.language` | `GET /users/me` → real DB row | Yes | FLOWING |
| `RegionalFormatsPage.tsx` | `me.data.date_format` etc. | `GET /users/me` → real DB row | Yes | FLOWING |
| `NotificationsPage.tsx` | `me.data.notification_preferences` | `GET /users/me` → real DB row | Yes | FLOWING |
| `MembersPage.tsx` | `members.data.items` | `GET /workspaces/{wsId}/members` → SQL JOIN query returning email+full_name | Yes — confirmed by `workspace_members.sql.go:166-169` | FLOWING |
| `DataStoragePage.tsx` | `exportMutation` | `GET /workspaces/{wsId}/export/workspace?format=xlsx` → real blob download | Yes | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without starting the dev stack; the live Playwright suite (settings.spec.ts 4/4 chromium pass, confirmed by gate) substitutes as the behavioral proof for all four covered flows.

---

### Probe Execution

Step 7c: No conventional `scripts/*/tests/probe-*.sh` probes declared or discovered for Phase 12.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SETT-01 | 12-01, 12-02 | Settings landing grouped rows | SATISFIED | `SettingsLandingPage.tsx`, `SettingsLayout.tsx`, `routes/index.tsx` |
| SETT-02 | 12-03 | Profile name/email/avatar | SATISFIED | `ProfilePage.tsx`, `AvatarUploader.tsx`, `settingsApi.updateMe/uploadAvatar` |
| SETT-03 | 12-02 (verify-only) | Security subpage exists | SATISFIED | `SecurityPage.tsx` pre-existing, tests green (931/931) |
| SETT-04 | 12-03 | Appearance — superseded by SETT-11 | SATISFIED (via SETT-11) | `AppearancePage.tsx:3` explicitly notes SETT-11 supersedes SETT-04 |
| SETT-05 | 12-04 | Language en/et/ru | SATISFIED | `LanguagePage.tsx`, `loadCatalog` wired in event handler |
| SETT-06 | 12-04 | Regional Formats | SATISFIED | `RegionalFormatsPage.tsx`, partial PATCH, live preview |
| SETT-07 | 12-04 | Notifications | SATISFIED | `NotificationsPage.tsx`, wholesale map PATCH |
| SETT-08 | 12-02 (verify-only) | Connected Accounts exists | SATISFIED | `AccountsPage.tsx` pre-existing, tests green (931/931) |
| SETT-09 | 12-05 | Data Storage online-only | SATISFIED | `DataStoragePage.tsx`, queryClient.clear, blob export, import pointer, no offline imports |
| SETT-10 | 12-01 (backend) + 12-06 (frontend) | Members page + backend enrichment | SATISFIED | SQL JOIN, MemberResponse email+full_name, add-by-email resolve, E2E live proof |
| SETT-11 | 12-03 | Appearance light-only note | SATISFIED | `AppearancePage.tsx:47` — "Light only — a dark theme is on the backlog." |

---

### Anti-Patterns Found

No TBD/FIXME/XXX debt markers found in any Phase-12-modified file. The two
matches from the grep sweep were:
- `MembersPage.tsx:306` — `placeholder={t\`user@email…\`}` — legitimate UI input placeholder text, not a debt marker.
- `AvatarUploader.tsx:77` — comment describing a UI element as "placeholder", not a code debt marker.

No `return null | return {} | return []` stubs. No empty handlers. No hardcoded static returns in API routes. No idb/serwist/sync imports in any settings file.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | — |

---

### Human Verification Required

None. All observable behaviors are either directly code-verifiable or covered by the confirmed-green Playwright E2E suite (settings.spec.ts 4/4 chromium pass) and 931/931 unit tests.

---

### Gaps Summary

No gaps. All 11 SETT requirements are satisfied by substantive, wired, data-flowing implementation verified at all four levels.

---

## Residues and Notes

1. **SETT-04 superseded by SETT-11.** The original SETT-04 text ("theme picker; under v3.0 the only theme is premium-terminal") is stale — the retro-os direction adopted SETT-11 ("Appearance subpage ships light-only under v3.0 with an explicit note"). `AppearancePage.tsx` implements SETT-11. Both IDs are satisfied by the single `AppearancePage`.

2. **Pre-existing backend test failures (D-12-01-A + D-12-01-B).** Two integration test failures documented in `deferred-items.md` were present on the base SHA before any Phase-12 work and are unrelated to the member domain changes:
   - `TestMultiUserWorkflow` — `/auth/me` route not mounted in the integration test server.
   - `TestApprovalPipeline_*` — approval-pipeline `needs_review` gating not implemented (paused 2026-05-31 per MEMORY).
   Neither failure is a Phase-12 regression. The backend `go build` and member-domain tests pass.

3. **Firefox E2E skipped by design.** The settings.spec.ts suite uses `test.skip(browserName !== "chromium")` per `test.beforeEach` to avoid the shared-singleton-seeder mutation race when chromium and firefox run concurrently. This is intentional per the 12-07 SUMMARY; the chromium 4/4 pass fully exercises the contract.

4. **Import pointer pattern (Data Storage + Paperless).** `DataStoragePage.tsx` Import section and `SettingsLandingPage.tsx` PaperlessRow both render COMING SOON badges pointing to Phase 14b work. These are correct scope-boundary decisions, not stubs — the Phase-12 contract explicitly excludes import restore and Paperless DMS.

---

_Verified: 2026-06-13_
_Verifier: Claude (gsd-verifier)_
