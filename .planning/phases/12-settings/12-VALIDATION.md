---
phase: 12-settings
nyquist_compliant: false
wave_0_complete: false
---

# Phase 12 — Settings hub — VALIDATION

Pre-execution contract. Flags flip true only after execution. Orchestrator verifies at the gate.

## Requirement → evidence map
| Req | Deliverable | Verifiable by |
|-----|-------------|---------------|
| SETT-01 | /settings landing grouped rows → 8 subpages + Members + Paperless pointer | landing test (rows link to each subroute) |
| SETT-02 | Profile: name/email + avatar upload (150×150) + remove | ProfilePage test (PATCH /users/me; avatar POST/DELETE) |
| SETT-03 | Security (EXISTS) password/sessions/delete | verify shipped SecurityPage still green |
| SETT-04→SETT-11 | Appearance: light-only theme + explicit note (NO dark) | AppearancePage test (single light theme + note) |
| SETT-05 | Language en/et/ru (lingui activate) | LanguagePage test (PATCH preferences.language + loadCatalog) |
| SETT-06 | Regional Formats: date/time/thousand/decimal + preview | RegionalPage test (PATCH preferences; separator-conflict guard) |
| SETT-07 | Notifications: SSE event toggles (notification_preferences map) | NotificationsPage test (RetroCheckbox → PATCH map) |
| SETT-08 | Connected Accounts (EXISTS) link/unlink | verify shipped AccountsPage still green |
| SETT-09 | Data Storage: clear cache + export workspace + import pointer | DataStoragePage test (queryClient.clear; GET /export/workspace; import→Phase 14) |
| SETT-10 | Members: list(name/email/role) + role change + remove + add-by-email | backend(enrich+email-add) + Members page test |
| SETT-11 | Appearance light-only note | (see SETT-04 row) |

## Binding overrides (must hold in shipped code)
1. SettingsLayout.tsx + routes/index.tsx single-writer (P1 owns the rewrite + all new subpage routes).
2. Security + Accounts pages are DONE — verify, do not rebuild.
3. Appearance LIGHT-ONLY (SETT-11 wins over SETT-04); no dark theme/switcher; explicit note.
4. Preferences PATCH partial (omitempty); GET from /users/me; Language → loadCatalog. NO format read-hooks (Phase 15).
5. Avatar: dedicated AvatarUploader, multipart field `avatar`, /api-relative url, DELETE to remove.
6. Data Storage online-only: clear-cache = queryClient.clear() (NO idb/serwist/sync* — CI grep); real GET /export/workspace download; import = Phase-14 pointer.
7. Members backend plan: enrich MemberResponse (email+full_name from the existing SQL join) + POST /members accepts email→existing-user resolve (404 if absent); NO pending-invite system. Server already guards own-role-change + last-owner removal.
8. Query keys ["me"|"sessions"|"members"|"oauth-accounts", ...]; render-loop guard; RHF+zod forms mirror shipped pages.

## Phase gate (orchestrator)
- backend: go build + vet + member tests; frontend: tsc clean, full bun run test, build, lint:imports OK.
- Live Playwright settings spec (landing → Profile save; Language switch; Members list/add-by-email/remove) isolated (auth limiter).
- gsd-verifier PASS; flip SETT-01..11 + traceability; log residues.

## Nyquist sign-off (flip after execution)
- [ ] backend members enrich+email-add merged + tested.
- [ ] landing + all new subpages + Members shipped + tests green.
- [ ] E2E spec discovered + green.
