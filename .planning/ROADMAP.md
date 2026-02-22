# Roadmap: Home Warehouse System

## Milestones

- v1 **PWA Offline Completion** — Phases 1-5 (shipped 2026-01-24)
- v1.1 **Offline Entity Extension** — Phases 6-11 (shipped 2026-01-25)
- v1.2 **Phase 2 Completion** — Phases 12-17 (shipped 2026-01-25)
- v1.3 **Mobile UX Overhaul** — Phases 18-21 (shipped 2026-01-31)
- v1.4 **Test Overhaul** — Phases 22-26 (shipped 2026-01-31)
- v1.5 **Settings Enhancement** — Phases 27-29 (shipped 2026-02-03)
- v1.6 **Format Personalization** — Phases 30-34 (shipped 2026-02-08)
- v1.7 **Modular Settings** — Phases 35-39 (shipped 2026-02-13)
- v1.8 **Social Login** — Phases 40-42 (in progress)

## Phases

<details>
<summary>v1 PWA Offline Completion (Phases 1-5) — SHIPPED 2026-01-24</summary>

See `.planning/MILESTONES.md` for full details.

**Delivered:** Complete offline capabilities for PWA - view workspace data and create/update items while offline with automatic sync.

- Phase 1: IndexedDB Setup (3 plans)
- Phase 2: Mutation Queue Infrastructure (3 plans)
- Phase 3: Conflict Resolution (2 plans)
- Phase 4: Sync Manager & iOS Fallback (3 plans)
- Phase 5: Item Form Migration (3 plans)

</details>

<details>
<summary>v1.1 Offline Entity Extension (Phases 6-11) — SHIPPED 2026-01-25</summary>

See `.planning/milestones/v1.1-ROADMAP.md` for full details.

**Delivered:** Offline mutations for all core entities with dependency-aware sync ordering and conflict history UI.

- Phase 6: Infrastructure & Borrowers (2 plans)
- Phase 7: Categories (2 plans)
- Phase 8: Locations (2 plans)
- Phase 9: Containers (2 plans)
- Phase 10: Inventory (3 plans)
- Phase 11: Conflict History (1 plan)

</details>

<details>
<summary>v1.2 Phase 2 Completion (Phases 12-17) — SHIPPED 2026-01-25</summary>

See `.planning/milestones/v1.2-ROADMAP.md` for full details.

**Delivered:** Enhanced item lifecycle management with repair tracking, declutter assistance, photo processing improvements, and SSE test coverage.

- Phase 12: Repair Log Foundation (3 plans)
- Phase 13: Repair Log Extensions (4 plans)
- Phase 14: Declutter Assistant (3 plans)
- Phase 15: Background Thumbnail Processing (3 plans)
- Phase 16: Bulk Photo Operations (2 plans)
- Phase 17: Testing & Polish (4 plans)

</details>

<details>
<summary>v1.3 Mobile UX Overhaul (Phases 18-21) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.3-ROADMAP.md` for full details.

**Delivered:** Warehouse-grade mobile experience with barcode scanning, offline fuzzy search, floating action buttons with radial menus, and mobile-optimized multi-step forms.

- Phase 18: Fuzzy Search Infrastructure (4 plans)
- Phase 19: Barcode Scanning (6 plans)
- Phase 20: Mobile Navigation - FAB and Gestures (5 plans)
- Phase 21: Mobile Form Improvements (7 plans)

</details>

<details>
<summary>v1.4 Test Overhaul (Phases 22-26) — SHIPPED 2026-01-31</summary>

See `.planning/milestones/v1.4-ROADMAP.md` for full details.

**Delivered:** Comprehensive test infrastructure and coverage with 82% requirements satisfied (14/17). Go test factories, backend coverage to 80%+ for 4 packages, 130 frontend unit tests, E2E auth stability, and CI parallelization with Codecov.

- Phase 22: Test Infrastructure Setup (3 plans)
- Phase 23: Backend Business Logic Tests (6 plans executed, 2 gap plans deferred)
- Phase 24: Backend API Testing (2 plans executed, 1 plan deferred)
- Phase 25: Frontend Unit Testing (5 plans)
- Phase 26: E2E Stability and Coverage (4 plans)

**Tech debt:** pendingchange handler.go at 57.3%, jobs at 20.1% (architectural constraint), 56 E2E waitForTimeout calls in lower-priority files.

</details>

<details>
<summary>v1.5 Settings Enhancement (Phases 27-29) — SHIPPED 2026-02-03</summary>

See `.planning/milestones/v1.5-ROADMAP.md` for full details.

**Delivered:** Complete user settings experience with profile management (avatar, email, name), security controls (password change, session management), and account lifecycle (deletion with safeguards).

- Phase 27: Account Settings (3 plans)
- Phase 28: Security Settings (4 plans)
- Phase 29: Account Deletion (2 plans)

</details>

<details>
<summary>v1.6 Format Personalization (Phases 30-34) — SHIPPED 2026-02-08</summary>

**Delivered:** Complete format personalization system with user preferences for date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD), time format (12-hour with AM/PM, 24-hour), and number format (thousand/decimal separator choices). All 107 display sites, 6 CSV exports, and 1 decimal input field respect user's chosen formats with immediate reactivity.

- Phase 30: Format Infrastructure (2 plans)
- Phase 31: Format Settings UI (2 plans)
- Phase 32: Date Format Rollout (2 plans)
- Phase 33: Time Format Rollout (1 plan)
- Phase 34: Number Format Rollout (2 plans)

</details>

<details>
<summary>v1.7 Modular Settings (Phases 35-39) — SHIPPED 2026-02-13</summary>

See `.planning/milestones/v1.7-ROADMAP.md` for full details.

**Delivered:** Modular iOS-style settings architecture with hub-and-subpage navigation, three-way theme toggle, per-category notification preferences, and offline storage management. 32/32 requirements satisfied.

- Phase 35: Settings Shell and Route Structure (2 plans)
- Phase 36: Profile, Security, and Regional Formats (1 plan)
- Phase 37: Appearance and Language (1 plan)
- Phase 38: Data and Storage Management (1 plan)
- Phase 39: Notification Preferences (2 plans)

</details>

### v1.8 Social Login (In Progress)

**Milestone Goal:** Add Google and GitHub OAuth login alongside existing email/password authentication, with auto-linking by verified email and connected accounts management in settings.

- [x] **Phase 40: Database Migration and Backend OAuth Core** - Schema changes, OAuth endpoints, CSRF/PKCE security, auto-link logic, rate limiting (completed 2026-02-22)
- [ ] **Phase 41: Frontend OAuth Flow and Connected Accounts** - Callback page, social login buttons, connected accounts settings UI, password UX for OAuth-only users
- [x] **Phase 42: Error Handling, Internationalization, and Offline Polish** - User-facing error messages, i18n for all OAuth strings, offline-aware social login buttons (completed 2026-02-22)

## Phase Details

### Phase 40: Database Migration and Backend OAuth Core
**Goal**: Backend delivers fully functional OAuth login/signup API for Google and GitHub with all critical security protections built in from day one
**Depends on**: Nothing (first phase of v1.8)
**Requirements**: SCHM-01, SCHM-02, OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04, OAUTH-05, OAUTH-06, SEC-01, SEC-03
**Success Criteria** (what must be TRUE):
  1. OAuth initiate endpoint redirects browser to Google or GitHub with correct scopes, CSRF state cookie, and PKCE challenge
  2. OAuth callback endpoint exchanges authorization code for user profile, finds or creates the user, issues JWT tokens, and redirects to frontend callback URL with a one-time code
  3. New user signing up via Google or GitHub OAuth gets an account (no password) and a personal workspace automatically
  4. Existing user with a verified email matching the OAuth provider email is auto-linked to the same account; unverified provider emails are rejected
  5. Callback endpoint is rate-limited and validates CSRF state parameter before processing
**Plans**: 3 plans

Plans:
- [ ] 40-01-PLAN.md — Database migration (nullable password, has_password) and sqlc queries for oauth_accounts, user entity extension
- [ ] 40-02-PLAN.md — OAuth domain package: entity, providers (Google/GitHub), FindOrCreateUser service with email verification gate
- [ ] 40-03-PLAN.md — OAuth HTTP handlers (initiate, callback, exchange, accounts), router wiring with rate limiting

### Phase 41: Frontend OAuth Flow and Connected Accounts
**Goal**: Users can complete the full OAuth login/signup flow in the browser and manage their connected providers from Security settings
**Depends on**: Phase 40
**Requirements**: OAUTH-07, OAUTH-08, SEC-02, ACCT-01, ACCT-02, ACCT-03, ACCT-04, ACCT-05, ACCT-06
**Success Criteria** (what must be TRUE):
  1. User clicks "Continue with Google" or "Continue with GitHub" on the login page and completes the full OAuth flow, landing on the dashboard (or their original intended page)
  2. User who signs up via OAuth sees their name pre-filled from the provider profile
  3. OAuth login sessions appear in the active sessions list in Security settings and can be revoked
  4. User can view connected OAuth providers, link a new provider, and unlink an existing provider from Security settings -- with a lockout guard preventing unlinking the last auth method when no password is set
  5. OAuth-only user can set a password from Security settings without being asked for a current password
**Plans**: TBD

Plans:
- [ ] 41-01: TBD
- [ ] 41-02: TBD
- [ ] 41-03: TBD

### Phase 42: Error Handling, Internationalization, and Offline Polish
**Goal**: OAuth feature is production-ready with clear error messages, full i18n support, and graceful offline behavior
**Depends on**: Phase 41
**Requirements**: ERR-01, ERR-02, ERR-03, ERR-04, I18N-01, OFFL-01
**Success Criteria** (what must be TRUE):
  1. User sees a specific, helpful error message when OAuth fails -- whether from cancelling authorization, unverified provider email, expired/invalid state, or provider unavailability
  2. All OAuth-related UI text (buttons, error messages, connected accounts labels, set-password form) has translation keys and translations for all 3 supported languages (English, Estonian, Russian)
  3. Social login buttons show a disabled state with an "internet required" message when the app is offline

**Plans**: 2 plans

Plans:
- [ ] 42-01-PLAN.md — OAuth translation keys (all 3 locales) and error code-to-message mapping with OAuthErrorHandler component
- [ ] 42-02-PLAN.md — Offline-aware social login buttons with disabled state and translated message

## Progress

**Execution Order:**
Phases execute in numeric order: 40 -> 41 -> 42

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1 | 14 | Complete | 2026-01-24 |
| 6-11 | v1.1 | 12 | Complete | 2026-01-25 |
| 12-17 | v1.2 | 19 | Complete | 2026-01-25 |
| 18-21 | v1.3 | 22 | Complete | 2026-01-31 |
| 22-26 | v1.4 | 20 | Complete | 2026-01-31 |
| 27-29 | v1.5 | 9 | Complete | 2026-02-03 |
| 30-34 | v1.6 | 9 | Complete | 2026-02-08 |
| 35-39 | v1.7 | 7 | Complete | 2026-02-13 |
| 40. Backend OAuth Core | 3/3 | Complete    | 2026-02-22 | - |
| 41. Frontend OAuth Flow | v1.8 | 0/? | Not started | - |
| 42. Error/i18n/Offline | 2/2 | Complete    | 2026-02-22 | - |

**Total:** 39 phases complete (112 plans executed) across 8 milestones + 3 phases planned for v1.8

---
*Roadmap created: 2026-01-24*
*Last updated: 2026-02-22 after v1.8 roadmap creation*
