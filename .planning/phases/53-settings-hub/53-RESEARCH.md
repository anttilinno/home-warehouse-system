# Phase 53: Settings Hub - Research

**Researched:** 2026-04-11
**Domain:** React Router v7 nested routes, settings hub-and-spoke pattern, user preferences API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hub-and-spoke pattern. `/settings` is the landing page with 8 clickable rows. Each row routes to a subpage (`/settings/profile`, `/settings/security`, etc.) via React Router v7 nested routes. Each subpage has a `◄ BACK` RetroButton that navigates to `/settings`. No persistent sidebar — works cleanly on mobile and desktop.
- **D-02:** Hub landing page shows current value previews inline on each row: e.g. APPEARANCE shows "Dark", LANGUAGE shows "EN", PROFILE shows the user's name. Values come from the `user` object in `useAuth()`. Each row uses a `>` chevron indicator on the right.
- **D-03:** Profile subpage: name field, email field, avatar upload/delete. All three are in scope. Avatar upload uses `POST /users/me/avatar` (multipart) and delete uses `DELETE /users/me/avatar`. Name/email update uses `PATCH /users/me`.
- **D-04:** Avatar display: show current avatar image if `avatar_url` is set, otherwise show initials in a retro-styled square (not circle — retro aesthetic). Below the avatar: "UPLOAD" and "REMOVE" RetroButtons (REMOVE only shown when avatar exists).
- **D-05:** Security subpage has three sections: (1) Change Password (`PATCH /users/me/password`), (2) Active Sessions (list from session API + revoke individual sessions), (3) Connected Accounts (OAuth link/unlink: `GET /auth/oauth/accounts`, `DELETE /auth/oauth/accounts/{provider}`). Link flow initiates the OAuth provider redirect (same as login OAuth flow).
- **D-06:** Account deletion stays in Security subpage. Uses `DELETE /users/me`. Show a confirmation RetroDialog before proceeding.
- **D-07:** Three-option theme toggle: Light / Dark / System. Saves to `PATCH /users/me/preferences` with `theme` field. Theme application follows the existing pattern from Phase 48 design tokens — toggling `data-theme` attribute on `<html>` element.
- **D-08:** Two-option toggle: English / Estonian. Saves to `PATCH /users/me/preferences` with `language` field. Changing language switches the active Lingui locale immediately (same session, no reload needed if Lingui supports dynamic switching; otherwise reload).
- **D-09:** Three settings: date format (YYYY-MM-DD / DD/MM/YYYY / MM/DD/YYYY), time format (24h / 12h), number format (thousand/decimal separator pairs). Saves to `PATCH /users/me/preferences`. Show a live preview of the current date/time/number using the selected format.
- **D-10:** Global enabled/disabled master toggle at the top. Below: four category toggles — Loans, Inventory, Workspace, System. All map to `notification_preferences` keys in `PATCH /users/me/preferences`. When master toggle is off, category toggles are visually disabled (but not hidden). Matches frontend1's model exactly.
- **D-11:** Two operations only: Export workspace (downloads JSON via `GET /workspaces/{id}/export/workspace`) and Import workspace (file upload via `POST /workspaces/{id}/import/workspace`). No offline storage management. Show import progress feedback (success/error toast).

### Claude's Discretion

- Exact route nesting approach in `routes/index.tsx` (flat routes vs nested layout route for settings)
- Whether the hub landing page groups rows into retro panels by category (e.g., "ACCOUNT" panel for profile/security, "PREFERENCES" panel for appearance/language/formats) or shows all 8 in a single panel
- RetroButton or plain styled row for each hub row (can use a custom SettingsRow pattern)
- i18n string keys for all new UI strings (follow Lingui t macro pattern)
- Whether theme change requires page reload or can switch live
- Active sessions display format (created_at timestamp, device/browser info if available)
- OAuth link flow: whether clicking "LINK GITHUB" opens in same tab or new tab

### Deferred Ideas (OUT OF SCOPE)

None listed in CONTEXT.md.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | Settings hub displays eight grouped navigation rows with retro panel styling | Hub-and-spoke pattern documented; SettingsRow component pattern identified from frontend1 reference |
| SET-02 | User can edit name, email, and avatar from Profile subpage, changes persist after reload | `PATCH /users/me` + `POST /users/me/avatar` (multipart raw fetch) + `DELETE /users/me/avatar` all verified in backend handler.go |
| SET-03 | User can change password and view active sessions from Security subpage | `PATCH /users/me/password` + `GET /users/me/sessions` + `DELETE /users/me/sessions/{id}` all verified in session/handler.go |
| SET-04 | Appearance toggle switches theme; Language toggle switches Lingui locale immediately | `PATCH /users/me/preferences` with `theme`/`language` fields verified; `loadCatalog()` in i18n.ts supports dynamic switching |
| SET-05 | Regional Formats subpage renders date/time/number controls and saves to API | `PATCH /users/me/preferences` with `date_format`, `time_format`, `thousand_separator`, `decimal_separator` fields verified |
| SET-06 | Notifications subpage renders master toggle + 4 category toggles | `notification_preferences` JSONB field in preferences API verified via frontend1 model |
| SET-07 | Data subpage renders export/import controls | `GET /workspaces/{id}/export/workspace` + `POST /workspaces/{id}/import/workspace` verified in importexport/handler.go |
| SET-08 | All subpages save changes to the API | `patch<T>()` from api.ts covers all PATCH calls; raw `fetch()` needed for avatar multipart only |
</phase_requirements>

---

## Summary

Phase 53 replaces the `/settings` stub with a fully-functional hub-and-spoke settings system. The existing codebase has everything needed: all 10 retro components are built and exported from `components/retro/index.ts`, the API layer (`api.ts`) exposes `get`, `patch`, `del` helpers with automatic 401 refresh, all backend endpoints for profile/security/preferences/sessions/OAuth/import-export are confirmed in Go handler files, and Lingui's `loadCatalog()` / `i18n.activate()` supports live locale switching without a page reload.

The primary complexity areas are: (1) nested route wiring in `routes/index.tsx` — the current file uses flat routes and `SettingsPage` must be refactored to a layout route with an `<Outlet>`; (2) avatar upload requiring raw `fetch()` instead of the typed `patch()` helper because of multipart form data; (3) theme application needing a `data-theme` attribute mutation on `<html>` alongside the preferences API call; (4) the Data subpage export requiring a blob download response rather than a JSON response, which `parseResponse<T>` in `api.ts` does not currently handle.

**Primary recommendation:** Implement in order of dependency — routes and hub page first (Wave 1), then profile + security subpages (Wave 2), then preferences subpages (Wave 3), then data subpage (Wave 4). Keep all subpages in `features/settings/` as sibling files.

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router | v7 (library mode) | Nested route layout | Project decision, BrowserRouter in App.tsx |
| @lingui/react + @lingui/core | v5 | i18n t macro + loadCatalog | Project decision; `loadCatalog()` supports live switching |
| Tailwind CSS | v4 | All styling | Project decision, no CSS-in-JS |

### Retro Components (all verified in `frontend2/src/components/retro/`)

[VERIFIED: codebase read]

| Component | Props | Usage in Phase 53 |
|-----------|-------|--------------------|
| `RetroPanel` | `title`, `showHazardStripe`, `className`, `children` | Hub page + each subpage wrapper |
| `RetroButton` | `variant` (neutral/primary/danger/secondary) | BACK button, SAVE, UPLOAD, REMOVE, DELETE |
| `RetroInput` | `icon`, `error`, standard input attrs | Name, email, password fields |
| `RetroDialog` | ref handle: `open()` / `close()` | Account deletion confirmation |
| `useToast` / `ToastProvider` | `addToast(message, variant)` | Save confirmations, import result |

### No New Dependencies Required

All required capabilities are present. Avatar upload uses raw `fetch()` (built-in). File download uses `URL.createObjectURL()` + `<a download>` (built-in).

---

## Architecture Patterns

### Recommended Project Structure

```
frontend2/src/features/settings/
├── SettingsPage.tsx          # Hub landing — replace stub entirely
├── SettingsRow.tsx           # Shared row component (chevron + preview)
├── ProfilePage.tsx
├── SecurityPage.tsx
├── AppearancePage.tsx
├── LanguagePage.tsx
├── FormatsPage.tsx
├── NotificationsPage.tsx
└── DataPage.tsx
```

Route wiring in `frontend2/src/routes/index.tsx` adds `/settings/*` with `<Outlet>`.

### Pattern 1: Hub-and-Spoke Route Layout

**What:** `/settings` renders a layout component with `<Outlet>`. When the path is exactly `/settings`, the hub list renders. Child paths render the subpage.

**When to use:** This is the D-01 decision. React Router v7 library mode supports this natively.

**How to wire (flat-route approach — Claude's discretion):**

```tsx
// Source: [VERIFIED: routes/index.tsx structure + React Router v7 library mode]
// Flat routes approach (no shared layout component needed):
<Route
  path="/settings"
  element={<RequireAuth><SettingsPage /></RequireAuth>}
/>
<Route
  path="/settings/profile"
  element={<RequireAuth><ProfilePage /></RequireAuth>}
/>
// ... repeat for each subpage
```

**Alternative — nested layout route (also valid):**

```tsx
<Route
  path="/settings"
  element={<RequireAuth><SettingsLayout /></RequireAuth>}
>
  <Route index element={<SettingsHubPage />} />
  <Route path="profile" element={<ProfilePage />} />
  // ...
</Route>
```

The flat approach avoids creating an extra layout component; the nested approach adds a `<SettingsLayout>` wrapper that could apply common padding/max-width. Either works — Claude's discretion.

### Pattern 2: SettingsRow Component

**What:** A clickable row component used by the hub landing page.

```tsx
// Source: [VERIFIED: frontend/app/.../settings/page.tsx pattern]
interface SettingsRowProps {
  label: string;
  preview?: string;
  onClick?: () => void;   // or use <Link> wrapping
  to: string;
}

// Row renders: [LABEL text] ... [preview value] [>]
// Uses NavLink or Link from react-router, styled as a RetroPanel row
```

### Pattern 3: PATCH Preferences — Immediate Save

**What:** Each preference toggle/selector calls `patch<User>('/users/me/preferences', {...})` immediately on change (no "Save" button for individual toggles). Name/email/password changes use explicit save buttons.

**Why:** Matches frontend1 pattern. Toggle state is lost if user navigates away without saving — avoid.

**After save:** Call `refreshUser()` from `useAuth()` to sync the `user` object context. [VERIFIED: `refreshUser` exists in AuthContext.tsx]

### Pattern 4: Avatar Upload — Raw Fetch Required

**What:** The `api.ts` `request()` function hardcodes `Content-Type: application/json` in headers, which breaks multipart uploads.

```tsx
// Source: [VERIFIED: api.ts lines 57-64, user/handler.go RegisterAvatarRoutes]
// Avatar upload MUST use raw fetch, not api.ts helpers:
const formData = new FormData();
formData.append("avatar", file);
const response = await fetch("/api/users/me/avatar", {
  method: "POST",
  credentials: "include",
  body: formData,           // DO NOT set Content-Type header — browser sets it with boundary
});
```

### Pattern 5: Workspace Export — Blob Download

**What:** `GET /workspaces/{id}/export/workspace` returns binary file content (Excel or JSON). The `api.ts` `parseResponse<T>` checks for `application/json` content-type and returns `undefined` for other content types. Export needs raw `fetch()` + `URL.createObjectURL()`.

```tsx
// Source: [VERIFIED: api.ts parseResponse lines 28-34, importexport/handler.go]
const response = await fetch(`/api/workspaces/${workspaceId}/export/workspace`, {
  credentials: "include",
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "workspace-export.json";
a.click();
URL.revokeObjectURL(url);
```

### Pattern 6: Lingui Dynamic Locale Switching

**What:** `loadCatalog(locale)` in `i18n.ts` dynamically loads and activates a locale without page reload. Lingui v5's `i18n.activate()` triggers `<I18nProvider>` re-render because `i18n` is reactive.

```tsx
// Source: [VERIFIED: frontend2/src/lib/i18n.ts]
import { loadCatalog } from "@/lib/i18n";

// In Language subpage, after PATCH /users/me/preferences:
await loadCatalog(newLocale);  // Activates immediately, no reload needed
```

### Pattern 7: Theme Application

**What:** Toggle `data-theme` attribute on `<html>` after saving theme preference. The globals.css uses CSS custom properties; theme tokens respond to `data-theme`.

```tsx
// Source: [ASSUMED — globals.css does not currently define data-theme CSS vars,
//          only flat @theme tokens. See Open Questions.]
document.documentElement.setAttribute("data-theme", theme); // "light" | "dark" | "system"
```

**Note:** See Open Questions — `globals.css` currently defines flat @theme tokens, not `data-theme`-conditional variables. Appearance subpage may need to add `prefers-color-scheme` media query handling for "System" option.

### Pattern 8: Session List — Current Session Protection

**What:** Backend `DELETE /users/me/sessions/{id}` returns 400 if the ID matches the current session (verified in session/handler.go). Frontend should hide or disable the revoke button for `session.is_current === true`.

```tsx
// Source: [VERIFIED: session/handler.go lines 83-88]
// is_current is returned in SessionResponse — use it to conditionally render REVOKE button
```

### Pattern 9: OAuth Link Flow

**What:** Linking a new OAuth provider uses `window.location.href = /api/auth/oauth/{provider}?action=link` (same as frontend1's `handleLink`). The `?action=link` query param tells the OAuth callback to link to the existing account rather than register a new one. Backend confirms this in router.go: `r.Get("/auth/oauth/{provider}", oauthHandler.Initiate)`.

### Anti-Patterns to Avoid

- **Do not set `Content-Type: multipart/form-data` manually:** Let the browser set it with the boundary. Remove Content-Type header entirely for multipart requests.
- **Do not use `patch<T>()` for avatar upload:** It injects `application/json`, breaking multipart.
- **Do not use `get<T>()` for workspace export:** The binary response is not JSON; `parseResponse<T>` returns `undefined` for non-JSON content.
- **Do not navigate back using `window.history.back()`:** Use `useNavigate()("/settings")` for predictable routing in React Router.
- **Do not import `i18n` from `@lingui/core` directly:** Use the shared `i18n` singleton from `@/lib/i18n` to avoid double-initialization.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast component | `useToast()` from RetroToast | Already built, 4s auto-dismiss + X button |
| Confirmation dialogs | Custom modal | `RetroDialog` (ref handle API) | Already built with backdrop, `open()`/`close()` |
| Form inputs | Inline styled inputs | `RetroInput` | Error state, icon slot, forwardRef — all done |
| Auth-refreshing API calls | Manual retry logic | `patch<T>()`, `get<T>()`, `del<T>()` from api.ts | Handles 401 refresh automatically |
| Locale loading | Custom locale loader | `loadCatalog()` from `@/lib/i18n` | Already handles dynamic import + i18n.activate |

---

## API Contract Reference

All endpoints verified in backend source code. [VERIFIED: backend/internal/domain/auth/user/handler.go, session/handler.go, api/router.go, importexport/handler.go]

### User Profile

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|----------|-------|
| PATCH | `/users/me` | `{ email?, full_name? }` | `UserResponse` | Updates name and/or email; 409 if email taken |
| PATCH | `/users/me/password` | `{ current_password, new_password }` | `{}` | 400 if current_password wrong |
| PATCH | `/users/me/preferences` | `{ theme?, language?, date_format?, time_format?, thousand_separator?, decimal_separator?, notification_preferences? }` | `UserResponse` | All fields optional |
| POST | `/users/me/avatar` | multipart `avatar` field | `UserResponse` (assumed) | Chi router, NOT Huma — raw fetch only |
| DELETE | `/users/me/avatar` | — | `{}` | Removes avatar_url |
| DELETE | `/users/me` | — | `{}` | Account deletion; show RetroDialog first |

### Sessions

| Method | Path | Response | Notes |
|--------|------|----------|-------|
| GET | `/users/me/sessions` | `SessionResponse[]` | Fields: `id`, `device_info`, `ip_address`, `last_active_at`, `created_at`, `is_current` |
| DELETE | `/users/me/sessions/{id}` | `{}` | 400 if id == current session |
| DELETE | `/users/me/sessions` | `{}` | Revokes all sessions except current |

### OAuth Accounts

| Method | Path | Response | Notes |
|--------|------|----------|-------|
| GET | `/auth/oauth/accounts` | `OAuthAccount[]` | Lists linked providers |
| DELETE | `/auth/oauth/accounts/{provider}` | `{}` | Unlinks; backend may reject if only account + no password |
| GET | `/auth/oauth/{provider}?action=link` | redirect | Initiates OAuth link flow (browser redirect) |

### Import / Export

| Method | Path | Response | Notes |
|--------|------|----------|-------|
| GET | `/workspaces/{id}/export/workspace` | binary blob | Download as file — raw fetch + URL.createObjectURL |
| POST | `/workspaces/{id}/import/workspace` | `ImportResult` | Workspace-scoped; use `workspaceId` from `useAuth()` |

### User Type — Missing Fields

The current `types.ts` `User` interface is missing `notification_preferences`. [VERIFIED: backend returns `NotificationPreferences` in `UserResponse` — confirmed in handler.go line 356; types.ts currently omits it.]

**Required type additions to `types.ts`:**

```typescript
export interface NotificationPreferences {
  enabled: boolean;
  loans?: boolean;
  inventory?: boolean;
  workspace?: boolean;
  system?: boolean;
}

export interface Session {
  id: string;
  device_info: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
  is_current: boolean;
}

export interface OAuthAccount {
  provider: string;          // "google" | "github"
  email?: string;
  created_at: string;
}

export interface ImportResult {
  // shape inferred from importexport handler — verify if needed
  success: boolean;
  imported?: number;
  errors?: string[];
}

// Add to User interface:
// notification_preferences?: NotificationPreferences;
```

---

## Common Pitfalls

### Pitfall 1: Routes Mismatch — `/settings` Active State in Sidebar

**What goes wrong:** `Sidebar.tsx` uses `NavLink to="/settings" end={false}` — any child route like `/settings/profile` will keep SETTINGS highlighted in the nav. This is the correct behavior, but verify `end` prop is `false` (already set correctly in Sidebar.tsx).

**Warning signs:** SETTINGS nav item does not stay highlighted when on a subpage.

### Pitfall 2: Avatar Upload Content-Type

**What goes wrong:** Using `api.ts` `post()` for avatar upload injects `Content-Type: application/json`, which the Go handler cannot parse as multipart. Response will be 400 or 422.

**How to avoid:** Use raw `fetch()` with no explicit Content-Type; browser attaches `multipart/form-data; boundary=...` automatically.

### Pitfall 3: Export Returns Empty Data

**What goes wrong:** `get<T>('/workspaces/.../export/workspace')` calls `parseResponse<T>` which returns `undefined` for non-`application/json` content-types. The download will be empty.

**How to avoid:** Always use raw `fetch()` + `response.blob()` for the export endpoint.

### Pitfall 4: `refreshUser()` Not Called After Preferences Save

**What goes wrong:** Hub landing page preview values (from `useAuth().user`) remain stale after a subpage saves preferences. The user navigates back to the hub and sees the old value.

**How to avoid:** Call `refreshUser()` from `useAuth()` after every successful `PATCH /users/me/preferences` call. `refreshUser` re-fetches `/users/me` and updates the `user` context. [VERIFIED: `refreshUser` is implemented in AuthContext.tsx]

### Pitfall 5: OAuth Unlink Last Account

**What goes wrong:** If the user has no password (`has_password === false`) and only one OAuth account, unlinking it would lock them out. Backend may return an error; frontend should also proactively disable the UNLINK button in this case.

**How to avoid:** Check `canUnlink = !(accounts.length === 1 && !user?.has_password)` before rendering UNLINK action. [VERIFIED: frontend1 uses this exact check in connected-accounts.tsx line 128.]

### Pitfall 6: Theme "System" Option Requires Media Query

**What goes wrong:** Setting `theme = "system"` on `<html data-theme="system">` does nothing unless CSS defines what `[data-theme="system"]` means. The current `globals.css` has no `data-theme` conditional rules — it defines only flat `@theme` tokens.

**How to avoid:** For the "System" option, read `window.matchMedia('(prefers-color-scheme: dark)').matches` and set `data-theme` to `"dark"` or `"light"` accordingly. Also listen for the `change` event to react to OS theme changes.

### Pitfall 7: `notification_preferences` Missing from `User` Type

**What goes wrong:** Notifications subpage accesses `user.notification_preferences` but it is not in the `User` interface in `types.ts`. TypeScript will error.

**How to avoid:** Add `notification_preferences?: NotificationPreferences` to the `User` interface in `types.ts` before writing the Notifications subpage. [VERIFIED: backend always returns this field — handler.go line 356.]

### Pitfall 8: Route Registration — Settings Pages Blocked by Existing Catch-All

**What goes wrong:** The `<Route path="*" element={<NotFoundPage />} />` in `routes/index.tsx` is last and won't interfere. However, `/settings` is currently registered as a flat route without `/*`. React Router v7 will not match `/settings/profile` against `path="/settings"` — the `/settings` route must become `path="/settings"` with child routes OR add separate `path="/settings/profile"` etc.

**How to avoid:** Either add explicit flat routes for each subpage, or convert `/settings` to a layout route with a wildcard. Flat routes are simpler given the existing pattern in this codebase.

---

## Code Examples

### Hub Row with Preview

```tsx
// Source: [VERIFIED: frontend1 frontend/app/.../settings/page.tsx pattern, adapted for retro]
interface SettingsRowProps {
  to: string;
  label: string;
  preview?: string;
}

export function SettingsRow({ to, label, preview }: SettingsRowProps) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between w-full border-retro-thick border-retro-ink bg-retro-cream px-md py-sm shadow-retro-raised hover:shadow-retro-pressed font-mono text-[14px] uppercase text-retro-ink"
    >
      <span>{label}</span>
      <span className="flex items-center gap-sm text-retro-gray">
        {preview && <span className="font-normal normal-case">{preview}</span>}
        <span>&gt;</span>
      </span>
    </Link>
  );
}
```

### BACK Button Pattern (each subpage)

```tsx
// Source: [ASSUMED — standard React Router navigation]
import { useNavigate } from "react-router";
import { RetroButton } from "@/components/retro";

const navigate = useNavigate();
<RetroButton variant="neutral" onClick={() => navigate("/settings")}>
  ◄ BACK
</RetroButton>
```

### Immediate Preference Toggle Save

```tsx
// Source: [VERIFIED: AuthContext.tsx refreshUser, api.ts patch<T>]
async function handleThemeChange(theme: string) {
  await patch<User>("/users/me/preferences", { theme });
  await refreshUser();           // syncs user context for hub preview
  document.documentElement.setAttribute("data-theme", resolveTheme(theme));
}
```

### Delete Account with RetroDialog

```tsx
// Source: [VERIFIED: RetroDialog.tsx — useImperativeHandle open()/close()]
const dialogRef = useRef<RetroDialogHandle>(null);

<RetroButton variant="danger" onClick={() => dialogRef.current?.open()}>
  DELETE ACCOUNT
</RetroButton>

<RetroDialog ref={dialogRef}>
  <p className="font-mono text-[14px]">This will permanently delete your account.</p>
  <div className="flex gap-sm mt-md">
    <RetroButton variant="danger" onClick={handleDeleteAccount}>CONFIRM DELETE</RetroButton>
    <RetroButton variant="neutral" onClick={() => dialogRef.current?.close()}>CANCEL</RetroButton>
  </div>
</RetroDialog>
```

---

## State of the Art

| Old Approach (frontend1) | Phase 53 Approach | Notes |
|--------------------------|-------------------|-------|
| Next.js `Link` from `@/i18n/navigation` | React Router `Link` from `react-router` | Library mode, no SSR |
| `useTranslations()` from next-intl | `useLingui()` from `@lingui/react/macro` | Lingui v5 compile-time |
| shadcn/ui `Switch`, `Card` | Custom retro toggle button pattern | No shadcn in v2.0 |
| `Avatar` circle component | Retro square avatar with initials fallback | Retro aesthetic requirement |
| Bearer token in Authorization header | Cookie-based auth (HttpOnly) | `credentials: "include"` in all fetches |
| `toast()` from sonner | `useToast().addToast()` from RetroToast | Project's own toast system |

---

## Open Questions (RESOLVED)

1. **Does globals.css have dark/light theme switching variables?**
   - What we know: `globals.css` defines flat `@theme` tokens with no `data-theme` conditional rules. The `theme` field exists on the `User` object and is saved to the backend.
   - What's unclear: Whether Phase 48 set up CSS `prefers-color-scheme` or `data-theme` conditional token overrides. No `data-theme` CSS rules were found in `globals.css`.
   - Recommendation: Wave 0 task in Wave 1 — read Phase 48 context/implementation to confirm. If no dark theme CSS exists, the Appearance subpage should document that the toggle saves the preference but dark theme visuals are a future concern. Alternatively, implement minimal `[data-theme="dark"]` CSS token overrides for the core variables as part of Phase 53.
   - **RESOLVED:** globals.css does NOT have dark/light theme switching variables. The Appearance toggle sets the `data-theme` attribute on `<html>`, but visual dark mode has no effect until dark theme CSS variable overrides are added in a future phase. Plan 03 documents this expected behavior.

2. **What shape does `POST /workspaces/{id}/import/workspace` expect?**
   - What we know: It's registered as `ImportWorkspaceFull` in `importexport/handler.go`. The entity-level import uses base64-encoded JSON body, but the workspace import may differ.
   - What's unclear: Whether it accepts multipart file upload or JSON with base64 data.
   - Recommendation: Read `importexport/handler.go` `ImportWorkspaceFull` implementation before implementing the Data subpage.
   - **RESOLVED:** `POST /workspaces/{id}/import/workspace` expects a JSON body with `{ format: "json", data: "<base64-encoded-file>" }` — NOT multipart. Plan 03 Task 3 implements this correctly using `post<ImportResult>()` from api.ts with base64-encoded file data.

3. **Is `has_password` check needed for the password change section?**
   - What we know: frontend1 renders `<PasswordChange />` or `<SetPassword />` based on `user?.has_password !== false`. The `User` type in `types.ts` includes `has_password: boolean`. [VERIFIED]
   - What's unclear: Whether "Set Password" (for OAuth-only accounts) is in scope for Phase 53 or just "Change Password".
   - Recommendation: Implement the same branch as frontend1 — show "SET PASSWORD" form when `has_password === false`, "CHANGE PASSWORD" otherwise. This is the correct UX and requires no additional API endpoints.
   - **RESOLVED:** Yes, the `has_password` check IS needed. Plan 02 SecurityPage implements the branch: "SET PASSWORD" form when `has_password === false` (only new password field), "CHANGE PASSWORD" form when `has_password === true` (current + new password fields).

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely frontend code changes. No new external dependencies, CLIs, or runtimes beyond those already used by the project.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (assumed — check `frontend2/package.json`) |
| Config file | `frontend2/vite.config.ts` or `frontend2/vitest.config.ts` |
| Quick run command | `cd frontend2 && npm test -- --run` |
| Full suite command | `cd frontend2 && npm test -- --run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-01 | Hub renders 8 rows with correct labels and links | unit | `npm test -- --run src/features/settings` | ❌ Wave 0 |
| SET-02 | Profile page: name/email fields, avatar upload/delete controls visible | unit | same | ❌ Wave 0 |
| SET-03 | Security page: password form + sessions list + OAuth accounts render | unit | same | ❌ Wave 0 |
| SET-04 | Appearance + Language subpages render toggles | unit | same | ❌ Wave 0 |
| SET-05 | Formats subpage renders 3 controls + live preview | unit | same | ❌ Wave 0 |
| SET-06 | Notifications: master toggle disables category toggles when off | unit | same | ❌ Wave 0 |
| SET-07 | Data subpage renders Export + Import controls | unit | same | ❌ Wave 0 |
| SET-08 | PATCH /users/me/preferences called on save | unit (mock) | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend2 && npm test -- --run src/features/settings`
- **Per wave merge:** `cd frontend2 && npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `frontend2/src/features/settings/__tests__/SettingsPage.test.tsx` — covers SET-01
- [ ] `frontend2/src/features/settings/__tests__/ProfilePage.test.tsx` — covers SET-02
- [ ] `frontend2/src/features/settings/__tests__/SecurityPage.test.tsx` — covers SET-03
- [ ] `frontend2/src/features/settings/__tests__/AppearancePage.test.tsx` — covers SET-04
- [ ] `frontend2/src/features/settings/__tests__/NotificationsPage.test.tsx` — covers SET-06

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Password change requires `current_password` verification — backend enforces this |
| V3 Session Management | yes | Session revocation via `DELETE /users/me/sessions/{id}` |
| V4 Access Control | yes | All endpoints require valid JWT cookie (handled by JWTAuth middleware in router.go) |
| V5 Input Validation | yes | RetroInput + backend validation on `PATCH /users/me` |
| V6 Cryptography | no | No crypto in frontend settings UI |

### Known Threat Patterns for Settings UX

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Account deletion without confirmation | Tampering | RetroDialog confirmation required (D-06) |
| OAuth unlink leaving no login method | Elevation of Privilege | `canUnlink` guard — disable if `!has_password && accounts.length === 1` |
| Revoking current session via UI | Denial of Service | Backend returns 400; frontend hides REVOKE on `is_current === true` |
| CSRF on preference save | Tampering | Backend uses HttpOnly cookie + SameSite=Lax; no CSRF token needed for same-origin SPA |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `POST /workspaces/{id}/import/workspace` accepts JSON body with `{ format: "json", data: "<base64>" }` | API Contract Reference | CONFIRMED — Plan 03 uses `post<ImportResult>()` with base64-encoded data |
| A2 | Theme toggling via `data-theme` on `<html>` is the intended mechanism for visual switching | Pattern 7 | Appearance subpage saves preference but has no visual effect until CSS vars are defined |
| A3 | Vitest is the test framework for frontend2 | Validation Architecture | Test commands wrong — check `frontend2/package.json` |
| A4 | `OAuthAccount` type shape (provider, email, created_at) | API Contract Reference | TypeScript errors in ConnectedAccounts UI if shape differs |

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `frontend2/src/components/retro/index.ts` — all 10 retro component exports confirmed
- [VERIFIED: codebase] `frontend2/src/features/auth/AuthContext.tsx` — `useAuth()` shape, `refreshUser()` confirmed present
- [VERIFIED: codebase] `frontend2/src/lib/api.ts` — `get`, `patch`, `del` helpers; Content-Type injection confirmed; `parseResponse<T>` non-JSON behavior confirmed
- [VERIFIED: codebase] `frontend2/src/lib/types.ts` — `User` interface; confirmed `notification_preferences` is absent
- [VERIFIED: codebase] `backend/internal/domain/auth/user/handler.go` — `PATCH /users/me`, `PATCH /users/me/password`, `PATCH /users/me/preferences`, avatar routes
- [VERIFIED: codebase] `backend/internal/domain/auth/session/handler.go` — session list, revoke, revoke-all routes + response shape
- [VERIFIED: codebase] `backend/internal/api/router.go` — OAuth account routes, import/export registration, protected route group structure
- [VERIFIED: codebase] `backend/internal/domain/importexport/handler.go` — export/import workspace routes confirmed
- [VERIFIED: codebase] `frontend2/src/lib/i18n.ts` — `loadCatalog()` dynamic switching, `i18n` singleton export
- [VERIFIED: codebase] `frontend2/src/routes/index.tsx` — current flat route structure for settings
- [VERIFIED: codebase] `frontend/components/settings/active-sessions.tsx` — session list pattern, `is_current` guard
- [VERIFIED: codebase] `frontend/components/settings/connected-accounts.tsx` — `canUnlink` guard, OAuth link flow

### Secondary (MEDIUM confidence)

- [VERIFIED: codebase] `frontend/app/.../settings/page.tsx` — hub-and-spoke layout, SettingsRow pattern with preview values and chevron

### Tertiary (LOW confidence / Assumed)

- Theme CSS variable scheme (`data-theme`) — assumed from CONTEXT.md D-07 reference; not verified in globals.css

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components and API helpers verified in codebase
- Architecture: HIGH — route structure, API contracts, component APIs all verified
- Pitfalls: HIGH — most derived from direct code inspection (api.ts Content-Type, parseResponse, types.ts gaps)
- Theme switching CSS: LOW — globals.css does not confirm data-theme support

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable stack, no fast-moving dependencies)
