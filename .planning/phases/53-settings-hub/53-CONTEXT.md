# Phase 53: Settings Hub - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the `/settings` stub with a fully functional settings hub: a hub-and-spoke navigation pattern with a landing page showing 8 grouped rows, each routing to a dedicated subpage. Subpages: Profile (name, email, avatar), Security (password, sessions, connected accounts), Appearance (theme toggle), Language (EN/ET switch), Formats (date/time/number), Notifications (global + 4 categories), Data (import/export).

</domain>

<decisions>
## Implementation Decisions

### Navigation Layout
- **D-01:** Hub-and-spoke pattern. `/settings` is the landing page with 8 clickable rows. Each row routes to a subpage (`/settings/profile`, `/settings/security`, etc.) via React Router v7 nested routes. Each subpage has a `◄ BACK` RetroButton that navigates to `/settings`. No persistent sidebar — works cleanly on mobile and desktop.
- **D-02:** Hub landing page shows current value previews inline on each row: e.g. APPEARANCE shows "Dark", LANGUAGE shows "EN", PROFILE shows the user's name. Values come from the `user` object in `useAuth()`. Each row uses a `>` chevron indicator on the right.

### Profile Subpage
- **D-03:** Profile subpage: name field, email field, avatar upload/delete. All three are in scope. Avatar upload uses `POST /users/me/avatar` (multipart) and delete uses `DELETE /users/me/avatar`. Name/email update uses `PATCH /users/me`.
- **D-04:** Avatar display: show current avatar image if `avatar_url` is set, otherwise show initials in a retro-styled square (not circle — retro aesthetic). Below the avatar: "UPLOAD" and "REMOVE" RetroButtons (REMOVE only shown when avatar exists).

### Security Subpage
- **D-05:** Security subpage has three sections: (1) Change Password (`PATCH /users/me/password`), (2) Active Sessions (list from session API + revoke individual sessions), (3) Connected Accounts (OAuth link/unlink: `GET /auth/oauth/accounts`, `DELETE /auth/oauth/accounts/{provider}`). Link flow initiates the OAuth provider redirect (same as login OAuth flow).
- **D-06:** Account deletion stays in Security subpage (matching frontend1's structure). Uses `DELETE /users/me`. Show a confirmation RetroDialog before proceeding.

### Appearance Subpage
- **D-07:** Three-option theme toggle: Light / Dark / System. Saves to `PATCH /users/me/preferences` with `theme` field. Theme application follows the existing pattern from Phase 48 design tokens — toggling `data-theme` attribute on `<html>` element.

### Language Subpage
- **D-08:** Two-option toggle: English / Estonian. Saves to `PATCH /users/me/preferences` with `language` field. Changing language switches the active Lingui locale immediately (same session, no reload needed if Lingui supports dynamic switching; otherwise reload).

### Regional Formats Subpage
- **D-09:** Three settings: date format (YYYY-MM-DD / DD/MM/YYYY / MM/DD/YYYY), time format (24h / 12h), number format (thousand/decimal separator pairs). Saves to `PATCH /users/me/preferences`. Show a live preview of the current date/time/number using the selected format.

### Notifications Subpage
- **D-10:** Global enabled/disabled master toggle at the top. Below: four category toggles — Loans, Inventory, Workspace, System. All map to `notification_preferences` keys in `PATCH /users/me/preferences`. When master toggle is off, category toggles are visually disabled (but not hidden). Matches frontend1's model exactly.

### Data Subpage
- **D-11:** Two operations only: Export workspace (downloads JSON via `GET /workspaces/{id}/export/workspace`) and Import workspace (file upload via `POST /workspaces/{id}/import/workspace`). No offline storage management (v2.0 is online-only). Show import progress feedback (success/error toast).

### Claude's Discretion
- Exact route nesting approach in `routes/index.tsx` (flat routes vs nested layout route for settings)
- Whether the hub landing page groups rows into retro panels by category (e.g., "ACCOUNT" panel for profile/security, "PREFERENCES" panel for appearance/language/formats) or shows all 8 in a single panel
- RetroButton or plain styled row for each hub row (can use a custom SettingsRow pattern)
- i18n string keys for all new UI strings (follow Lingui t macro pattern)
- Whether theme change requires page reload or can switch live
- Active sessions display format (created_at timestamp, device/browser info if available)
- OAuth link flow: whether clicking "LINK GITHUB" opens in same tab or new tab

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual Design Reference (BAM aesthetic)
- `.planning/references/retro-ui/6.png` — BAM settings panels: tabbed navigation, sliders, dropdowns, checkboxes, key binding display — primary settings aesthetic reference
- `.planning/references/retro-ui/2.png` — BAM UI components: buttons, toggles, hazard stripes

### Existing Retro Components (Phase 50 — all available)
- `frontend2/src/components/retro/index.ts` — Barrel export for all 10 retro components
- `frontend2/src/components/retro/RetroPanel.tsx` — Panel with optional HazardStripe header
- `frontend2/src/components/retro/RetroButton.tsx` — Button with neutral/primary/danger variants
- `frontend2/src/components/retro/RetroInput.tsx` — Input field with retro styling
- `frontend2/src/components/retro/RetroDialog.tsx` — Dialog for confirmation flows (e.g., account deletion)
- `frontend2/src/components/retro/RetroToast.tsx` — Toast system for save confirmations

### Existing Settings Stub
- `frontend2/src/features/settings/SettingsPage.tsx` — Current stub (replace entirely)

### Existing Auth & API
- `frontend2/src/features/auth/AuthContext.tsx` — `useAuth()` provides `user`, `workspaceId`, `logout()`; extend with `refreshUser()` if not already present
- `frontend2/src/lib/api.ts` — `get<T>()`, `patch<T>()`, `del<T>()` helpers; avatar upload needs raw `fetch()` for multipart
- `frontend2/src/lib/types.ts` — Extend with session, connected account, and import/export types
- `frontend2/src/routes/index.tsx` — Add `/settings/*` nested routes here

### Frontend1 Reference (backend API contracts)
- `frontend/components/settings/notification-preference-settings.tsx` — 4-category notification prefs model
- `frontend/components/settings/security-settings.tsx` — Password change + account deletion UX
- `frontend/components/settings/connected-accounts.tsx` — OAuth link/unlink flow
- `frontend/components/settings/active-sessions.tsx` — Sessions list + revoke pattern
- `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` — Hub landing page with preview values

### Backend APIs
- `backend/internal/domain/auth/user/handler.go` — `PATCH /users/me`, `PATCH /users/me/password`, `PATCH /users/me/preferences`, `POST /users/me/avatar`, `DELETE /users/me/avatar`, `DELETE /users/me`
- `backend/internal/domain/auth/session/handler.go` — Sessions list + revoke routes
- `backend/internal/api/router.go` — `GET /auth/oauth/accounts`, `DELETE /auth/oauth/accounts/{provider}`, import/export routes

### Project Context
- `.planning/ROADMAP.md` — Phase 53 success criteria (SET-01 through SET-08)
- `.planning/phases/48-project-scaffold/48-CONTEXT.md` — D-08 directory layout
- `.planning/phases/50-design-system/50-CONTEXT.md` — Component patterns (forwardRef, Tailwind-only, no CSS-in-JS)
- `.planning/phases/51-app-layout/51-CONTEXT.md` — D-11 route structure, AppShell nesting pattern
- `.planning/phases/52-dashboard/52-CONTEXT.md` — D-01 workspaceId in AuthContext (needed for import/export workspace routes)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- All 10 retro components ready — no new primitives needed for settings
- `useAuth()` — provides `user` object with all preference fields (`theme`, `language`, `date_format`, `time_format`, `thousand_separator`, `decimal_separator`)
- `api.ts` `patch<T>()` — handles auth + refresh for all PATCH calls
- `globals.css` tokens — all retro design tokens available

### Established Patterns
- Tailwind CSS 4 utility classes only — no CSS-in-JS
- React Router v7 library mode — nested routes under AppShell
- Lingui v5 `t` macro for all user-visible strings
- `forwardRef` + `className` merge for composable components
- Feature-based directory: `features/settings/` (subpage components go here)

</code_context>
