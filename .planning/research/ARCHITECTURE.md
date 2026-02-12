# Architecture Patterns: Settings Restructure with Theming, Notifications, and Storage Management

**Domain:** Settings restructure for existing Next.js 16 PWA
**Researched:** 2026-02-12
**Confidence:** HIGH -- based entirely on existing codebase analysis, no external dependencies needed

## Current State Analysis

### What Exists Today

The settings page is a single monolithic file at:
```
frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx (166 lines)
```

It renders four sections inline: Account (profile display + edit sheet), Personalization (date/time/number format cards), Security (active sessions only), and Data Management (backup/restore dialog). No sub-routes exist.

**Existing components in `frontend/components/settings/`:**
- `account-settings.tsx` -- full profile form with avatar (NOT used by current page)
- `avatar-upload.tsx` -- drag-and-drop avatar upload with 2MB limit
- `date-format-settings.tsx` -- radio group with custom format option
- `time-format-settings.tsx` -- 12h/24h radio group
- `number-format-settings.tsx` -- thousand/decimal separator selects with conflict validation
- `password-change.tsx` -- 3-field password form with zod validation
- `active-sessions.tsx` -- session list with revoke actions
- `security-settings.tsx` -- composite: password + sessions + danger zone (NOT used by current page)
- `delete-account-dialog.tsx` -- type-to-confirm account deletion
- `notification-settings.tsx` -- push notification subscribe/unsubscribe (NOT used by current page)

**Key observation:** `SecuritySettings` and `AccountSettings` composites already exist but the current page does NOT use them. The page hand-assembles its own account display and only uses `ActiveSessions` directly. The `ProfileEditSheet` (a side panel with profile editing) is triggered from the settings page but duplicates AccountSettings logic. This means the refactor can adopt these existing composites and retire the ProfileEditSheet usage.

### Existing Data Flow

```
User object (auth-context.tsx)
  |
  +--> user.date_format, user.time_format, user.theme, user.language, etc.
  |
  +--> PATCH /users/me/preferences  (all 6 prefs in one endpoint)
  |      body: { date_format?, language?, theme?, time_format?, thousand_separator?, decimal_separator? }
  |
  +--> PATCH /users/me              (profile: full_name, email)
  +--> PATCH /users/me/password     (password change)
  +--> GET/DELETE /users/me/sessions (session management)
  +--> POST /push/subscribe         (push notifications)
  +--> GET /push/status             (push notification status)
```

All preferences changes call `refreshUser()` after saving, which re-fetches `/users/me` and updates the auth context. This triggers re-renders in any component using `useAuth()`.

### Existing Theme System

- `next-themes` via `ThemeProvider` wrapping the entire app
- `ThemeToggle` component (simple light/dark toggle button in header)
- Backend stores `theme` field on user entity (default: "system")
- Theme preference is part of `PATCH /users/me/preferences`
- Current ThemeToggle does NOT persist to backend -- it only calls `setTheme()` from next-themes (localStorage only)
- **Gap:** Theme set on one device does not sync to another device via backend

### Existing i18n

- `next-intl` with `[locale]` dynamic segment, `localePrefix: "as-needed"`
- 3 locales: en, et, ru
- `LanguageSwitcher` component uses `router.replace(pathname, { locale })` to change locale
- Backend stores `language` on user entity (default: "en")
- Language preference is part of `PATCH /users/me/preferences`
- Current LanguageSwitcher does NOT persist to backend -- it only changes the URL locale
- **Gap:** Language set on one device does not sync to another device via backend

### Existing Notification System

- `NotificationsDropdown` in dashboard header shows unread in-app notifications
- `NotificationSettings` component handles push notification subscription (service worker + VAPID)
- Backend notification types: LOAN_DUE_SOON, LOAN_OVERDUE, LOAN_RETURNED, LOW_STOCK, WORKSPACE_INVITE, MEMBER_JOINED, SYSTEM
- SSE events trigger notification count refreshes
- **Gap:** No per-type notification preferences. Users can only toggle push on/off globally.

### Existing Storage/Offline System

- IndexedDB v4 with 10 stores (items, inventory, locations, containers, categories, borrowers, loans, syncMeta, mutationQueue, conflictLog, formDrafts)
- `OfflineProvider` context exposes: dbReady, persistentStorage, isSyncing, lastSyncTimestamp, syncCounts, pendingMutationCount
- `PhotoUploadQueue` -- separate IndexedDB for queued photo uploads
- Backup/restore via `BackupRestoreDialog` (workspace export as xlsx/json)
- `deleteDB()` function exists in `offline-db.ts` but is not exposed in any UI
- **Gap:** No way for users to see storage usage or clear cached data

---

## Recommended Architecture

### Route Structure

Use Next.js App Router nested routes under settings. Each subpage gets its own `page.tsx` inside a shared layout.

```
frontend/app/[locale]/(dashboard)/dashboard/settings/
  layout.tsx          -- Settings shell with sidebar navigation (desktop) / grouped list (mobile)
  page.tsx            -- Landing page with grouped setting rows linking to subpages
  profile/
    page.tsx          -- Avatar + name + email editing
  appearance/
    page.tsx          -- Theme selection (light/dark/system)
  language/
    page.tsx          -- Language selector with full names
  regional-formats/
    page.tsx          -- Date format + time format + number format (combined)
  security/
    page.tsx          -- Password change + active sessions + danger zone
  notifications/
    page.tsx          -- Push notification toggle + per-type preferences
  data-storage/
    page.tsx          -- Offline storage stats + clear cache + backup/restore
```

**Rationale for this grouping:**

1. **Regional formats combined** -- date, time, and number formats are tightly related and use the same `PATCH /users/me/preferences` endpoint. Splitting into 3 separate pages creates unnecessary navigation. One page with 3 sections is cleaner.

2. **Appearance separate from language** -- theme changes are instant (CSS class toggle) while language changes cause a full page navigation (locale in URL). Different UX patterns warrant separate pages.

3. **Data/storage as one page** -- IndexedDB stats, cache clearing, and backup/restore all relate to "what data is on my device vs server." Natural grouping.

### Component Boundaries

| Component | Responsibility | File Location | Status |
|-----------|---------------|---------------|--------|
| `SettingsLayout` | Shell with sidebar nav (desktop), page content area | `app/.../settings/layout.tsx` | **NEW** |
| `SettingsLandingPage` | Grouped rows with icons linking to subpages | `app/.../settings/page.tsx` | **MODIFY** (replace current monolith) |
| `ProfilePage` | Avatar upload + profile form (name, email) | `app/.../settings/profile/page.tsx` | **NEW** (reuses `AvatarUpload` + form from `AccountSettings`) |
| `AppearancePage` | Theme picker with visual previews | `app/.../settings/appearance/page.tsx` | **NEW** |
| `LanguagePage` | Language selector | `app/.../settings/language/page.tsx` | **NEW** (wraps enhanced `LanguageSwitcher`) |
| `RegionalFormatsPage` | Date + time + number format | `app/.../settings/regional-formats/page.tsx` | **NEW** (composes existing components) |
| `SecurityPage` | Password + sessions + account deletion | `app/.../settings/security/page.tsx` | **NEW** (wraps `SecuritySettings` composite) |
| `NotificationsPage` | Push toggle + notification type toggles | `app/.../settings/notifications/page.tsx` | **NEW** (extends `NotificationSettings`) |
| `DataStoragePage` | Storage stats + cache clear + backup/restore | `app/.../settings/data-storage/page.tsx` | **NEW** |
| `SettingsNavSidebar` | Desktop sidebar for settings sub-navigation | `components/settings/settings-nav.tsx` | **NEW** |
| `SettingsRow` | Reusable row component for landing page | `components/settings/settings-row.tsx` | **NEW** |
| `ThemeSelector` | Visual theme picker (system/light/dark cards) | `components/settings/theme-selector.tsx` | **NEW** |
| `StorageStats` | IndexedDB + cache size display | `components/settings/storage-stats.tsx` | **NEW** |

### Settings Layout Architecture

```tsx
// frontend/app/[locale]/(dashboard)/dashboard/settings/layout.tsx
"use client";

import { SettingsNavSidebar } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex gap-8">
        {/* Desktop: persistent sidebar nav */}
        <aside className="hidden md:block w-56 shrink-0">
          <SettingsNavSidebar />
        </aside>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
```

**Mobile pattern:** On mobile, the landing page (settings/page.tsx) shows all settings as a grouped list of tappable rows. Tapping a row navigates to the subpage. Each subpage can include a breadcrumb or rely on browser back. The sidebar is hidden on mobile -- the landing page IS the navigation.

**Desktop pattern:** The sidebar is always visible on the left with active state highlighting. The landing page shows quick-glance summary. Clicking sidebar items or landing page rows navigates to the subpage content area.

### Data Flow for New Features

#### Theme Persistence (bridges next-themes localStorage with backend)

Currently `ThemeToggle` only sets `next-themes` localStorage. The new `ThemeSelector` must also persist to backend:

```
ThemeSelector.onSelect(theme)
  --> next-themes setTheme(theme)     // Instant visual change via CSS class
  --> PATCH /users/me/preferences     // Persist to backend (fire-and-forget)
        { theme: "light" | "dark" | "system" }
  --> refreshUser()                   // Update auth context
```

On login/page load, sync backend value to next-themes:

```
useThemeSync hook:
  watches user.theme from useAuth()
  when user.theme changes and differs from next-themes resolvedTheme:
    --> setTheme(user.theme)          // Sync backend -> client
```

**No backend changes needed** -- the `theme` field already exists on the User entity and in the preferences PATCH endpoint. Values: "system", "light", "dark".

#### Language Persistence (bridges next-intl URL locale with backend)

Currently `LanguageSwitcher` only changes the URL locale. The language page must also persist:

```
LanguagePage.onSelect(locale)
  --> PATCH /users/me/preferences     // Persist to backend
        { language: "en" | "et" | "ru" }
  --> refreshUser()                   // Update auth context
  --> router.replace(pathname, { locale })  // Change URL locale (full re-render)
```

On login, the app could redirect to the user's preferred locale if it differs from the URL. However, this is tricky with SSR and the `localePrefix: "as-needed"` config. **Recommendation:** Do NOT auto-redirect on login. The language page persists the preference, and users can manually switch. Auto-redirect creates confusing behavior when sharing URLs.

**No backend changes needed** -- the `language` field already exists.

#### Notification Preferences (Per-Type Toggles)

The existing `NotificationSettings` only handles push subscription on/off. For per-type notification preferences (e.g., mute loan reminders, mute low stock alerts):

**Backend change required:**

```sql
-- New column on auth.users
ALTER TABLE auth.users
ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
```

JSON structure:
```json
{
  "LOAN_DUE_SOON": true,
  "LOAN_OVERDUE": true,
  "LOAN_RETURNED": true,
  "LOW_STOCK": false,
  "WORKSPACE_INVITE": true,
  "MEMBER_JOINED": false,
  "SYSTEM": true
}
```

**Why JSONB on users table (not a separate table):**
- Keeps all user preferences in one place
- Queried together with other user data (no extra join)
- The number of notification types is small and fixed (7 types)
- Consistent with existing flat preferences pattern (date_format, time_format, etc.)
- Simple PATCH semantics: merge into existing JSON

**Extend preferences endpoint:**
- Add `notification_preferences` to `UpdatePrefsRequestBody` and `UpdatePrefsResponse`
- In `UpdatePreferences()`, merge incoming JSON with existing (so partial updates work)
- Backend notification sender checks `notification_preferences[type]` before sending

#### Storage Management (entirely client-side)

The data/storage page reads browser storage APIs:

```
StorageStats component
  --> navigator.storage.estimate()     // Total and used quota
  --> IndexedDB store counts           // Via getAll().length for each store
  --> Cache API caches.keys()          // Service worker cache entry count

Clear actions:
  --> deleteDB() from offline-db.ts    // Clear all IndexedDB data
  --> caches.delete(cacheName)         // Clear service worker caches
  --> BackupRestoreDialog              // Already exists, embedded here
```

**No backend changes needed** -- this is entirely client-side browser API interaction.

---

## Integration Points

### 1. Settings Layout within Dashboard Shell

The `DashboardShell` renders `{children}` inside its main content area. The new `SettingsLayout` nests inside this naturally -- no changes to `DashboardShell` needed.

```
DashboardShell
  -> DashboardHeader (with notifications dropdown, theme toggle, etc.)
  -> Sidebar (main app nav -- already links to /dashboard/settings)
  -> <main>{children}</main>
       -> SettingsLayout
            -> SettingsNavSidebar (settings-specific sub-nav, desktop only)
            -> <div>{children}</div> (subpage content)
```

### 2. Auth Context (No Changes to Interface)

All settings components already use `useAuth()` to read user preferences and `refreshUser()` to update after saves. This pattern continues unchanged. No new context or provider needed. The only possible change is adding `notification_preferences` to the `User` type in `lib/api/auth.ts`.

### 3. Theme Provider Integration

The existing `ThemeProvider` (next-themes) wraps the entire app at the root layout level. The new `ThemeSelector` component will use `useTheme()` from next-themes to read/write the theme AND persist to backend via the existing preferences endpoint.

A new `useThemeSync` hook ensures the backend theme preference is reflected in next-themes when it differs (e.g., after login on a new device):

```tsx
// lib/hooks/use-theme-sync.ts
"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/contexts/auth-context";

export function useThemeSync() {
  const { user } = useAuth();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    if (user?.theme && user.theme !== theme) {
      setTheme(user.theme);
    }
  }, [user?.theme]); // Only sync when backend value changes
}
```

Place the hook call in `DashboardShell` or similar top-level component.

### 4. SSE Context (No Changes)

No settings feature requires SSE events. The existing SSE infrastructure remains untouched.

### 5. Offline Context Integration

The `DataStoragePage` will consume the existing `useOffline()` context:
- Read `dbReady`, `persistentStorage` status for display
- Read `lastSyncTimestamp` for "last synced" display
- Read `syncCounts` for per-entity record counts
- Read `pendingMutationCount` for pending changes display
- Call `triggerSync()` for manual sync button
- Call `deleteDB()` from `offline-db.ts` and clear caches for "clear all data" action

### 6. i18n Integration

All new components use `useTranslations()` from next-intl. New translation keys needed under `settings.*` namespace across all 3 locale files (en.json, et.json, ru.json):

```
settings.nav.profile, settings.nav.appearance, settings.nav.language,
settings.nav.regionalFormats, settings.nav.security, settings.nav.notifications,
settings.nav.dataStorage

settings.appearance.title, settings.appearance.description,
settings.appearance.system, settings.appearance.light, settings.appearance.dark,
settings.appearance.systemDescription, settings.appearance.saved

settings.language.title, settings.language.description, settings.language.saved

settings.dataStorage.title, settings.dataStorage.description,
settings.dataStorage.offlineData, settings.dataStorage.records,
settings.dataStorage.storageUsage, settings.dataStorage.used,
settings.dataStorage.quota, settings.dataStorage.unavailable,
settings.dataStorage.clearOfflineData, settings.dataStorage.clearConfirm,
settings.dataStorage.clearSuccess, settings.dataStorage.lastSync,
settings.dataStorage.pendingMutations, settings.dataStorage.persistentStorage
```

---

## Patterns to Follow

### Pattern 1: Settings Row Component (Landing Page)

A reusable row for the landing page that shows icon, label, description, and current value preview. Tappable to navigate.

```tsx
// components/settings/settings-row.tsx
"use client";

import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
  preview?: string;  // Current value shown on right side
}

export function SettingsRow({ icon: Icon, label, description, href, preview }: SettingsRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      {preview && (
        <span className="text-sm text-muted-foreground hidden sm:block">{preview}</span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
```

**When:** Every row on the settings landing page.

### Pattern 2: Optimistic Preference Change (Theme, Language)

Theme and language changes must feel instant. Save to backend in background without blocking UI.

```tsx
const handleThemeChange = (newTheme: string) => {
  // 1. Instant visual change
  setTheme(newTheme);

  // 2. Background persist -- do not await, do not show loading spinner
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    },
    credentials: "include",
    body: JSON.stringify({ theme: newTheme }),
  })
    .then(() => refreshUser())
    .catch(() => {
      // Silently fail -- theme is already applied visually
      // Next login will pick up the server value
    });
};
```

**When:** Theme and language changes. Users expect instant feedback, not a loading spinner.

### Pattern 3: Thin Page, Composite Components

Each settings subpage file is thin -- it composes existing components with a page header.

```tsx
// app/[locale]/(dashboard)/dashboard/settings/security/page.tsx
"use client";

import { useTranslations } from "next-intl";
import { SecuritySettings } from "@/components/settings/security-settings";

export default function SecurityPage() {
  const t = useTranslations("settings.security");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <SecuritySettings />
    </div>
  );
}
```

**When:** Every settings subpage. Logic lives in `components/settings/*`, page files are wrappers.

### Pattern 4: Storage Estimation with Progressive Enhancement

Browser storage APIs are not universally available. Always feature-detect and show fallbacks.

```tsx
const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null);

useEffect(() => {
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then(({ usage, quota }) => {
      if (usage !== undefined && quota !== undefined) {
        setEstimate({ usage, quota });
      }
    });
  }
}, []);

// In render:
{estimate ? (
  <p>{formatBytes(estimate.usage)} / {formatBytes(estimate.quota)}</p>
) : (
  <p className="text-muted-foreground">{t("dataStorage.unavailable")}</p>
)}
```

**When:** DataStoragePage. Show graceful "unavailable" when APIs are missing.

### Pattern 5: Active Nav Highlighting in Settings Sidebar

Match the existing sidebar pattern from `components/dashboard/sidebar.tsx`:

```tsx
const pathname = usePathname();
const isActive = item.href === "/dashboard/settings"
  ? pathname === "/dashboard/settings"
  : pathname.startsWith(item.href);
```

**When:** SettingsNavSidebar component. Exact match for landing, prefix match for subpages.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New Settings Context/Provider

**What:** Creating a `SettingsContext` or `SettingsProvider` to manage settings state.
**Why bad:** All settings state already lives in the auth context (`user` object). Adding another context creates duplicate state, sync issues, and unnecessary complexity.
**Instead:** Continue using `useAuth()` to read preferences and `refreshUser()` to update after saves. Each component manages its own transient state (isSubmitting, form errors, etc.).

### Anti-Pattern 2: Client-Side Route Guard in Settings Layout

**What:** Adding auth checks or redirects in the settings layout.
**Why bad:** The `DashboardShell` already handles auth checking and redirection. Adding another check causes double redirects and flash of content.
**Instead:** Trust the parent layout. `DashboardShell` shows loading state and redirects unauthenticated users before settings layout ever renders.

### Anti-Pattern 3: Shared Form State Across Settings Pages

**What:** Lifting form state (isDirty, isSubmitting) to the settings layout to show a global "unsaved changes" banner.
**Why bad:** Each settings subpage saves independently. Format settings auto-save on selection change. Form-based pages (profile, password) have their own submit handlers. There is no cross-page form submission flow.
**Instead:** Each subpage manages its own save behavior independently.

### Anti-Pattern 4: Server Components for Settings Pages

**What:** Making settings pages Server Components.
**Why bad:** Every settings component uses `useAuth()`, `useTranslations()`, `useState`, `useTheme()`, or other client hooks. They MUST be client components. Server components would require prop drilling or wrapper components for no benefit -- settings data is all user-specific and loaded client-side.
**Instead:** All settings pages are `"use client"`. The layout can be a server component IF it only renders static structure, but since it needs `useTranslations()` and `usePathname()` for the nav sidebar, it will also be a client component.

### Anti-Pattern 5: Storing Theme in Multiple Independent Places

**What:** Having next-themes localStorage, a separate `settings.theme` localStorage key, and the backend all potentially out of sync.
**Why bad:** Three sources of truth that can conflict.
**Instead:** Two-layer source of truth: next-themes manages the active theme in localStorage (client-side), backend is the persistence layer. On change: update next-themes immediately, persist to backend async. On login: sync backend value to next-themes via `useThemeSync`. Never create a third storage location.

### Anti-Pattern 6: Auto-Redirect Based on Backend Language Preference

**What:** On login, automatically redirecting the user to `/{user.language}/dashboard` if it differs from the current URL locale.
**Why bad:** Breaks shared URLs, confusing when someone shares a `/et/dashboard/items/123` link with an English user, causes redirect loops with SSR.
**Instead:** The URL locale is the source of truth for the current session. The backend `language` field records the user's preference for new sessions. Let users explicitly change language via the settings page.

---

## New vs Modified Files Summary

### New Files (14-15)

| File | Purpose |
|------|---------|
| `app/[locale]/(dashboard)/dashboard/settings/layout.tsx` | Settings shell layout with sub-navigation |
| `app/[locale]/(dashboard)/dashboard/settings/profile/page.tsx` | Profile settings subpage |
| `app/[locale]/(dashboard)/dashboard/settings/appearance/page.tsx` | Theme settings subpage |
| `app/[locale]/(dashboard)/dashboard/settings/language/page.tsx` | Language settings subpage |
| `app/[locale]/(dashboard)/dashboard/settings/regional-formats/page.tsx` | Date/time/number format subpage |
| `app/[locale]/(dashboard)/dashboard/settings/security/page.tsx` | Security settings subpage |
| `app/[locale]/(dashboard)/dashboard/settings/notifications/page.tsx` | Notification preferences subpage |
| `app/[locale]/(dashboard)/dashboard/settings/data-storage/page.tsx` | Storage management subpage |
| `components/settings/settings-nav.tsx` | Settings sidebar navigation |
| `components/settings/settings-row.tsx` | Landing page row component |
| `components/settings/theme-selector.tsx` | Visual theme picker (system/light/dark) |
| `components/settings/storage-stats.tsx` | IndexedDB/cache storage display |
| `lib/hooks/use-theme-sync.ts` | Syncs backend theme preference to next-themes |
| `lib/hooks/use-storage-estimate.ts` | Browser storage estimation hook |
| Backend: `db/migrations/XXXX_add_notification_preferences.sql` | Add notification_preferences JSONB column |

### Modified Files (7-8)

| File | Change |
|------|--------|
| `app/[locale]/(dashboard)/dashboard/settings/page.tsx` | Replace monolithic content with landing page (grouped SettingsRow links) |
| `messages/en.json` | Add ~30 new translation keys under settings.* |
| `messages/et.json` | Same translation additions |
| `messages/ru.json` | Same translation additions |
| `lib/api/auth.ts` | Add `notification_preferences` to User type |
| `components/settings/notification-settings.tsx` | Add per-type notification toggles below push toggle |
| `backend/.../user/entity.go` | Add notificationPreferences field |
| `backend/.../user/handler.go` | Extend preferences endpoint for notification_preferences |

### Unchanged, Reused As-Is (10)

| File | Reused By |
|------|-----------|
| `components/settings/account-settings.tsx` | Profile page (finally adopted) |
| `components/settings/avatar-upload.tsx` | Profile page via AccountSettings |
| `components/settings/security-settings.tsx` | Security page (finally adopted) |
| `components/settings/password-change.tsx` | Via SecuritySettings composite |
| `components/settings/active-sessions.tsx` | Via SecuritySettings composite |
| `components/settings/delete-account-dialog.tsx` | Via SecuritySettings composite |
| `components/settings/date-format-settings.tsx` | Regional formats page |
| `components/settings/time-format-settings.tsx` | Regional formats page |
| `components/settings/number-format-settings.tsx` | Regional formats page |
| `components/shared/backup-restore-dialog.tsx` | Data/storage page |

---

## Suggested Build Order

The build order respects component dependencies and enables incremental testing at each phase.

### Phase A: Settings Layout and Navigation Shell

**Goal:** Route restructure works -- navigate between settings subpages.

1. Create `settings/layout.tsx` with desktop sidebar and responsive structure
2. Create `components/settings/settings-nav.tsx` sidebar component with active state
3. Create `components/settings/settings-row.tsx` reusable row component
4. Rewrite `settings/page.tsx` as landing page with grouped SettingsRow links to each subpage
5. Create stub pages for all 7 subpages (page header + placeholder content)
6. Add i18n keys for nav labels and page descriptions (en, et, ru)

**Dependency:** None. Pure frontend routing.
**Verifiable:** Navigate between all settings subpages. Sidebar highlights active page. Mobile shows landing page list. Back navigation works.

### Phase B: Profile and Security Pages (Adopt Existing Composites)

**Goal:** Two subpages fully functional by wiring existing components.

1. Create `settings/profile/page.tsx` composing `AccountSettings` (which includes AvatarUpload and profile form)
2. Create `settings/security/page.tsx` wrapping `SecuritySettings` (which includes PasswordChange, ActiveSessions, DeleteAccountDialog)
3. Remove ProfileEditSheet trigger from old settings page code

**Dependency:** Phase A (layout and stubs exist).
**Verifiable:** Profile editing (avatar, name, email) works on profile subpage. Password change, session management, account deletion work on security subpage.

### Phase C: Regional Formats and Language Pages

**Goal:** Format and language preferences on their dedicated subpages.

1. Create `settings/regional-formats/page.tsx` composing DateFormatSettings + TimeFormatSettings + NumberFormatSettings
2. Create `settings/language/page.tsx` with enhanced language selector that persists to backend
3. Add backend language sync: on language change, PATCH /users/me/preferences with language field

**Dependency:** Phase A (layout exists).
**Verifiable:** All format changes persist and apply app-wide. Language changes persist to backend.

### Phase D: Appearance Page (Theme System with Backend Persistence)

**Goal:** Theme selection with backend persistence and cross-device sync.

1. Create `components/settings/theme-selector.tsx` with visual preview cards (system/light/dark)
2. Create `lib/hooks/use-theme-sync.ts` to sync backend theme to next-themes on login
3. Create `settings/appearance/page.tsx` composing ThemeSelector
4. Wire ThemeSelector to save to backend via existing preferences endpoint (fire-and-forget)
5. Add useThemeSync call in DashboardShell or root dashboard layout

**Dependency:** Phase A (layout exists).
**Verifiable:** Theme changes are instant. Theme persists across sessions. Login on new device picks up saved theme.

### Phase E: Notification Preferences Page

**Goal:** Notification management with per-type toggles.

1. Backend: migration adding `notification_preferences` JSONB column to `auth.users`
2. Backend: extend User entity, preferences endpoint to accept/return notification_preferences
3. Frontend: add `notification_preferences` to User type in `lib/api/auth.ts`
4. Extend `NotificationSettings` component to show per-type toggle switches below push subscription
5. Create `settings/notifications/page.tsx` composing the extended NotificationSettings

**Dependency:** Phase A (layout exists). Backend migration needed.
**Verifiable:** Users can toggle individual notification types on/off. Preferences persist.

### Phase F: Data/Storage Management Page

**Goal:** Users can see storage usage and clear offline data.

1. Create `lib/hooks/use-storage-estimate.ts` hook wrapping navigator.storage.estimate()
2. Create `components/settings/storage-stats.tsx` showing IndexedDB store counts + total storage + quota
3. Create `settings/data-storage/page.tsx` composing StorageStats + BackupRestoreDialog + clear actions
4. Add clear IndexedDB (deleteDB()) and clear cache (caches.delete()) actions with confirmation dialogs
5. Display persistent storage grant status, last sync time, pending mutations count

**Dependency:** Phase A (layout exists). Uses existing `useOffline()` context and `offline-db.ts` functions.
**Verifiable:** Storage stats display accurately. Clear cache removes offline data. Backup/restore dialog works.

### Phase G: Landing Page Previews and Polish

**Goal:** Landing page shows current values for each setting.

1. Update landing page SettingsRow items to show live previews:
   - Profile: user's name
   - Appearance: current theme name
   - Language: current language name
   - Regional Formats: current date format sample
   - Security: number of active sessions
   - Notifications: "Enabled" / "Disabled"
   - Data/Storage: storage used (e.g., "2.4 MB")
2. Responsive polish: ensure all subpages work well on mobile
3. Complete any missing i18n translations for et and ru

**Dependency:** All previous phases (previews require each feature to be functional).
**Verifiable:** Landing page shows accurate current values. All subpages responsive.

---

## Scalability Considerations

| Concern | Current (Monolith) | After Restructure |
|---------|-------------------|-------------------|
| Route count | 1 settings page | 9 routes (1 layout + 1 landing + 7 subpages) |
| Bundle size | All settings components loaded together | Code-split per subpage (Next.js automatic route splitting) |
| API calls | Same single PATCH endpoint | Same endpoint -- no API call increase |
| Render performance | Full re-render on any pref change | Only active subpage re-renders |
| Navigation | Scroll to section | Direct URL per setting category |
| Deep linking | Cannot link to specific setting | `/settings/security` links directly |
| Future extensibility | Add more sections = longer scroll | Add new `settings/xyz/page.tsx` route |

---

## Sources

All findings derived from direct codebase analysis:

- **Backend User entity:** `backend/internal/domain/auth/user/entity.go` -- fields: theme, language, dateFormat, timeFormat, thousandSeparator, decimalSeparator
- **Backend preferences handler:** `backend/internal/domain/auth/user/handler.go` -- `PATCH /users/me/preferences` accepting 6 fields
- **Frontend auth context:** `frontend/lib/contexts/auth-context.tsx` -- User type, refreshUser() pattern
- **Frontend auth API:** `frontend/lib/api/auth.ts` -- User interface with all preference fields
- **Current settings page:** `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx` -- monolithic 166-line page
- **Existing settings components:** `frontend/components/settings/*.tsx` -- 10 components, several not used by current page
- **Theme system:** `frontend/components/providers/theme-provider.tsx` (next-themes), `frontend/components/shared/theme-toggle.tsx`
- **i18n system:** `frontend/i18n/config.ts` (3 locales), `frontend/i18n/routing.ts` (localePrefix: as-needed)
- **Offline database:** `frontend/lib/db/offline-db.ts` (IndexedDB v4, 10 stores, deleteDB function)
- **Offline context:** `frontend/lib/contexts/offline-context.tsx` (exposes sync state, pending mutations)
- **Notification API:** `frontend/lib/api/notifications.ts` (7 notification types)
- **Push notifications hook:** `frontend/lib/hooks/use-push-notifications.ts`
- **Dashboard shell:** `frontend/components/dashboard/dashboard-shell.tsx` (auth guard, providers)
- **Sidebar navigation:** `frontend/components/dashboard/sidebar.tsx` (active state pattern)
