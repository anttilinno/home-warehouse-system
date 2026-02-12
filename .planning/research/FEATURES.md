# Feature Landscape

**Domain:** Modular settings page with theming, notification preferences, and storage management for a multi-tenant home inventory PWA
**Researched:** 2026-02-12

## Current State Assessment

The existing settings page is a single flat page at `/dashboard/settings/page.tsx` containing four sections separated by `<Separator />` dividers: Account Settings, Personalization (date/time/number formats), Security (active sessions), and Data Management (backup/restore dialog). Several components that should be in settings exist elsewhere (SecuritySettings with PasswordChange and DeleteAccountDialog, NotificationSettings for push). The backend User entity already stores `theme` (default "system"), `language`, `dateFormat`, `timeFormat`, `thousandSeparator`, `decimalSeparator` with a PATCH `/users/me/preferences` endpoint.

| Existing Asset | Location | Reuse Strategy |
|----------------|----------|----------------|
| ThemeProvider (next-themes) | `components/providers/theme-provider.tsx` | Keep as-is, wire to settings UI |
| ThemeToggle (icon button) | `components/shared/theme-toggle.tsx` | Replace with 3-way selector in settings; keep header toggle |
| User.theme field + PATCH | `backend/.../user/entity.go` | Already persists; just call from new UI |
| Date/Time/Number format settings | `components/settings/date-format-settings.tsx` etc. | Relocate into Appearance subpage |
| NotificationSettings (push toggle) | `components/settings/notification-settings.tsx` | Relocate into Notifications subpage |
| SecuritySettings (password + sessions + delete) | `components/settings/security-settings.tsx` | Relocate into Security subpage |
| BackupRestoreDialog | `components/shared/backup-restore-dialog.tsx` | Inline into Data & Storage subpage |
| OfflineContext (storage/sync state) | `lib/contexts/offline-context.tsx` | Read dbReady, persistentStorage, lastSyncTimestamp, triggerSync |
| deleteDB() + clearStore() | `lib/db/offline-db.ts` | Use for cache clear functionality |
| NotificationsDropdown (SSE events) | `components/dashboard/notifications-dropdown.tsx` | Reference for notification type mapping |
| 8 NotificationTypes on backend | `backend/.../notification/entity.go` | Map to preference categories |
| 30+ SSE event types | `lib/contexts/sse-context.tsx` | Reference for understanding event scope |
| 3 i18n locales (en, et, ru) | `frontend/messages/` | All new UI strings need translation keys |

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

### Settings Hub (Landing Page)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Grouped rows with section headers | iOS/Android settings convention users have internalized; flat lists feel disorganized | Low | Group into: Account, Appearance, Notifications, Data & Storage, Security. Each group = visual card or section |
| Row-level navigation with chevrons | Universal affordance signaling "tap to drill down"; ChevronRight icon per row | Low | Each row = Next.js Link to `/dashboard/settings/[subpage]`. Use `ChevronRight` from lucide-react |
| Icon + label + subtitle per row | Scannability. Users identify sections by icon before reading text | Low | Reuse existing icon set: User, Palette, Bell, Database, Shield |
| Summary/preview text on rows | Shows current state without navigating (e.g., "Dark", "English", "3 active sessions") | Med | Pull current values from auth context and offline context into hub. Strong UX signal that justifies the extra data fetching |
| Mobile-first touch targets | PWA on phone is the primary use case; minimum 44px tap targets | Low | Already enforced elsewhere in codebase (`min-h-[44px]` pattern on inputs/buttons) |
| Back navigation from subpages | Users must return to hub without relying on browser back button | Low | Next.js App Router layout nesting handles this. Add explicit back arrow + "Settings" in subpage headers |
| Route-based subpages (not tabs/accordion) | Each settings section gets its own URL for deep linking, browser history, and shareability | Low | Convert `settings/page.tsx` to `settings/layout.tsx` + `settings/page.tsx` (hub) + `settings/account/page.tsx`, `settings/appearance/page.tsx`, etc. |

### Appearance / Theme Settings

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Three-way selector: Light / Dark / System | Industry standard since macOS Mojave. Every major web app offers this | Low | **90% built.** next-themes provider has `enableSystem` + `defaultTheme="system"`. User entity stores `theme`. Just need explicit 3-option UI (radio group or segmented control) instead of current toggle button |
| Server-persisted theme preference | User logs in on different device, expects same theme | Low | **Already built.** PATCH `/users/me/preferences` accepts `theme`. Wire settings UI to call this on change |
| No flash of wrong theme on load | Flash of incorrect theme on page load destroys perceived quality | Low | **Already handled.** next-themes with `disableTransitionOnChange` and `attribute="class"` on `<html>` prevents FOUC |
| Immediate application on change | Theme should apply instantly without page reload | Low | **Already works.** `setTheme()` from next-themes triggers immediate CSS class swap |
| Format preferences relocated here | Date, time, and number format settings belong under "Appearance" or "Personalization" | Low | Move existing DateFormatSettings, TimeFormatSettings, NumberFormatSettings components into this subpage |
| Language selector | Language preference belongs in Appearance alongside other display settings | Low | Already stored on User entity. Build a simple RadioGroup or Select with en/et/ru options, call PATCH preferences |

### Notification Preferences

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Master notification toggle | Users must be able to silence all in-app notifications in one action | Low | Single Switch at top of notifications subpage. Disables all category toggles below it |
| Per-category toggles for in-app notifications | Users want loan reminders but not member-joined alerts | Med | Categories derived from backend NotificationType enum: LOAN_DUE_SOON, LOAN_OVERDUE, LOAN_RETURNED, REPAIR_REMINDER, LOW_STOCK, WORKSPACE_INVITE, MEMBER_JOINED, SYSTEM |
| Grouped by domain | Toggles organized by logical grouping, not flat list | Low | **Loans**: due soon, overdue, returned. **Inventory**: low stock, repair reminder. **Workspace**: invite, member joined. **System**: system notifications |
| Push notification toggle (relocated) | Existing NotificationSettings component with usePushNotifications hook belongs here | Low | Move from wherever it currently floats into this subpage as a dedicated section |
| Auto-save on toggle change | Toggles should take effect immediately (iOS convention), no "Save" button | Med | Each toggle change fires PATCH to server. Use optimistic UI: flip toggle immediately, revert on error with toast |
| Clear visual on/off state | Each toggle must clearly show enabled vs disabled with accessible contrast | Low | shadcn Switch component handles this. Disabled master toggle should grey out all child toggles |

### Data & Storage Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Storage usage display | PWA users need to know how much local data exists. Opaque storage creates anxiety | Med | `navigator.storage.estimate()` returns `{usage, quota}`. Display as progress bar + human-readable sizes (e.g., "12.4 MB of 200 MB used") |
| Clear offline cache button | Users must be able to reclaim storage; PWA equivalent of "Clear Cache" | Med | Call `deleteDB()` from offline-db.ts + `caches.keys()` then `caches.delete()` for service worker caches. Require confirmation dialog. Show "This will remove offline data. You'll need to be online to re-sync." |
| Persistent storage status indicator | Users should know if browser might auto-evict their data | Low | `navigator.storage.persisted()` already tracked in OfflineContext as `persistentStorage`. Show green/amber badge |
| Request persistent storage button | If not already granted, let users request it | Low | `navigator.storage.persist()` already implemented in offline-db.ts. Show button only when `!persistentStorage` |
| Import/export section | Centralize data import and export in settings rather than hiding in a dialog | Low | Inline the content from existing BackupRestoreDialog into this subpage. Keep dialog accessible from other places via the existing trigger pattern |
| Last sync timestamp | Users want to know when offline data was last synchronized | Low | Already in OfflineContext as `lastSyncTimestamp`. Format with useDateFormat hook and show prominently |
| Manual sync trigger button | Let users force-sync from settings instead of hoping auto-sync works | Low | Already in OfflineContext as `triggerSync()`. "Sync Now" button with loading state from `isSyncing` |
| Offline database status | Show whether IndexedDB is initialized and healthy | Low | OfflineContext provides `dbReady`. Simple status indicator |

### Security Subpage (Relocation)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Password change | **Already built** as PasswordChange component | Low | Relocate into Security subpage |
| Active sessions list with revocation | **Already built** as ActiveSessions component | Low | Relocate into Security subpage |
| Account deletion with safeguards | **Already built** as DeleteAccountDialog component | Low | Relocate into Security subpage as "Danger Zone" section |

---

## Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual theme preview cards | Small mock-up cards showing light/dark/system appearance before selecting | Med | Tiny preview rectangles with representative colors. Polish feature that communicates quality |
| Animated theme transition | Smooth cross-fade when switching themes instead of instant class swap | Low | Remove `disableTransitionOnChange` from ThemeProvider, add CSS transitions on `background-color` and `color`. 200ms transition. Subtle but premium feel |
| Notification history page | Full paginated view of all past notifications (not just unread dropdown) | Low | Backend `notificationsApi.getAll(page, limit)` already exists. Add as "View History" link within notifications subpage |
| Storage quota warning banner | Proactively warn when IndexedDB usage approaches browser limits | Med | Calculate `usage/quota` ratio from Storage API estimate. Show warning when > 80%. Good PWA hygiene that prevents data loss |
| Per-store record counts | Show "Items: 847, Inventory: 1,203, Locations: 24" etc. | Low | Call `getAll(store).length` for each store. Cheap operation, provides useful transparency |
| Notification sound preference | Let users toggle whether in-app toast notifications play a sound | Low | Web Audio API for a subtle notification chime. Single on/off toggle. Adds polish |
| Settings search (cmd+k integration) | Search within settings to jump to specific options | Med | Not needed at current scale (<20 settings). Valuable if settings grow. Could hook into existing command palette |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Per-workspace notification preferences | Requires junction table (user x workspace x notification_type). Most users have 1-2 workspaces. Disproportionate complexity | Store preferences at user level. Preferences apply across all workspaces |
| Custom CSS / theme injection | Security risk (XSS vector), maintenance burden, breaks on updates | Predefined themes only (light/dark/system). Accent colors are a future consideration |
| Email notification preferences | Backend does not currently send emails. UI for non-existent functionality confuses users and creates support tickets | Only add when email delivery is implemented |
| Auto-delete old offline data | Silently deleting cached warehouse data destroys trust. Users need historical data | Manual cache management only. Warn on high usage, never auto-purge |
| Granular SSE event filtering | SSE events drive real-time UI updates (list refresh, toast notifications). Letting users disable specific SSE event types would break data synchronization | SSE always flows fully. Notification preferences control what gets *surfaced as alerts*, not what data syncs |
| Export/import user settings | Exporting a JSON of 15 preference values is pointless when they sync via the server automatically | Settings are per-user on the server. Multi-device sync is automatic |
| Notification badge counts per category | Separate unread counts for loans vs inventory vs workspace adds visual noise to the hub | Single aggregate unread count is sufficient. Per-category is noise |
| Tabbed settings layout | Tabs hide content behind clicks and don't work well on mobile with many sections | Route-based subpages with a hub landing page. Each section is a full page, not a tab |
| Per-store cache clear | Letting users selectively clear only "items" or only "locations" from IndexedDB | All-or-nothing clear is safer and simpler. Partial clears leave inconsistent state |

---

## Feature Dependencies

```
Settings Hub (landing page route: /settings)
  |
  +-- Account subpage (/settings/account)
  |     +-- Profile editing (existing: ProfileEditSheet -> convert to inline form)
  |     +-- Password change (existing: PasswordChange component)
  |     +-- Avatar upload (existing: AvatarUpload component)
  |     Dependencies: auth-context (user data), authApi (update calls)
  |
  +-- Appearance subpage (/settings/appearance)
  |     +-- Theme 3-way selector (depends on: next-themes provider, User.theme field)
  |     +-- Date format settings (existing: DateFormatSettings)
  |     +-- Time format settings (existing: TimeFormatSettings)
  |     +-- Number format settings (existing: NumberFormatSettings)
  |     +-- Language selector (depends on: next-intl, User.language field)
  |     Dependencies: next-themes useTheme(), PATCH /users/me/preferences
  |
  +-- Notifications subpage (/settings/notifications)
  |     +-- Master notification toggle
  |     +-- Per-category toggles grouped by domain
  |     +-- Push notification toggle (existing: NotificationSettings)
  |     Dependencies: NEW backend endpoint + migration for notification_preferences
  |
  +-- Data & Storage subpage (/settings/data-storage)
  |     +-- Storage usage display (depends on: navigator.storage.estimate())
  |     +-- Persistent storage status (depends on: OfflineContext.persistentStorage)
  |     +-- Cache clear (depends on: deleteDB(), caches API)
  |     +-- Import/export hub (existing: BackupRestoreDialog content, inlined)
  |     +-- Sync status & manual trigger (depends on: OfflineContext)
  |     Dependencies: OfflineContext, offline-db.ts, importExportApi
  |
  +-- Security subpage (/settings/security)
        +-- Password change (existing: PasswordChange)
        +-- Active sessions (existing: ActiveSessions)
        +-- Delete account (existing: DeleteAccountDialog)
        Dependencies: authApi, auth-context
```

### Critical Dependency Chain

```
1. Route restructure MUST happen first:
   settings/page.tsx -> settings/layout.tsx + settings/page.tsx (hub) + settings/*/page.tsx

2. Hub layout MUST exist before subpages render
   (layout provides back navigation, breadcrumb context, mobile shell)

3. Appearance subpage has ZERO new backend work (theme field exists, preferences endpoint exists)

4. Data & Storage subpage has ZERO new backend work (all APIs exist in frontend contexts)

5. Security subpage has ZERO new backend work (all components exist, just relocation)

6. Notification preferences subpage REQUIRES new backend work:
   - Migration: notification_preferences JSONB column on auth.users (or separate table)
   - Endpoint: GET/PATCH /users/me/notification-preferences
   - Frontend must NOT ship toggles without backend persistence
```

---

## MVP Recommendation

Prioritize in this order based on dependency chain and effort/impact ratio:

1. **Settings Hub + Route Restructure** -- Foundation everything else depends on. Convert flat settings page into Next.js layout with hub landing page. All existing settings components continue working, just reorganized into subpages. **Zero backend work.**

2. **Appearance Subpage** -- Lowest new complexity because next-themes + server persistence are already built. Three-way theme selector + relocate format settings + add language selector. **Zero backend work.**

3. **Security Subpage** -- Pure relocation of existing PasswordChange, ActiveSessions, DeleteAccountDialog. No new features, just better organization. **Zero backend work.**

4. **Data & Storage Subpage** -- All building blocks exist (OfflineContext, Storage API, deleteDB, BackupRestoreDialog). Pure frontend assembly. **Zero backend work.**

5. **Notifications Subpage** -- Requires new backend migration + endpoint for notification preferences. Relocate existing push toggle. Build per-category toggle UI. **Backend work required.**

### What Ships Without Backend Changes

Everything except notification per-category preferences. The hub, appearance, security, and data & storage subpages are entirely frontend work using existing APIs and components.

### Backend Work Required (Notifications Only)

| Change | Type | Complexity |
|--------|------|------------|
| `notification_preferences` JSONB column on `auth.users` | Migration | Low |
| `GET /users/me/notification-preferences` | Endpoint | Low |
| `PATCH /users/me/notification-preferences` | Endpoint | Low |
| Filter notification creation based on preferences | Service logic | Med |
| Filter SSE toast display based on preferences | Frontend logic | Low |

### Defer to Post-MVP

- Visual theme preview cards
- Animated theme transitions
- Notification history page
- Storage quota warning banner
- Notification sound preferences
- Settings search
- Per-store record counts display

---

## Sources

### Codebase (Primary)
- Settings page: `frontend/app/[locale]/(dashboard)/dashboard/settings/page.tsx`
- Theme provider: `frontend/components/providers/theme-provider.tsx` (next-themes)
- Theme toggle: `frontend/components/shared/theme-toggle.tsx`
- User entity: `backend/internal/domain/auth/user/entity.go` (theme, language, format fields)
- Offline DB: `frontend/lib/db/offline-db.ts` (idb library, 10+ stores, deleteDB)
- Offline context: `frontend/lib/contexts/offline-context.tsx` (dbReady, persistentStorage, sync state)
- SSE context: `frontend/lib/contexts/sse-context.tsx` (30+ event types)
- Notification types: `backend/internal/domain/auth/notification/entity.go` (8 types)
- Notification API: `frontend/lib/api/notifications.ts`
- Push notifications: `frontend/components/settings/notification-settings.tsx`
- Backup/restore: `frontend/components/shared/backup-restore-dialog.tsx`
- Security settings: `frontend/components/settings/security-settings.tsx`
- Format preferences migration: `backend/db/migrations/010_format_preferences.sql`
- CSS theme variables: `frontend/app/globals.css` (oklch light + dark tokens)

### External
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- Theme provider capabilities and API
- [shadcn/ui dark mode](https://ui.shadcn.com/docs/dark-mode/next) -- Official integration guide
- [MDN StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) -- Storage API for usage/quota display
- [MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- Browser limits and persistent storage
- [Material Design Settings Patterns](https://m1.material.io/patterns/settings.html) -- Settings page UI organization
- [Material Design Notification Patterns](https://m1.material.io/patterns/notifications.html) -- Notification preference best practices
- [Android Settings Design Guide](https://developer.android.com/design/ui/mobile/guides/patterns/settings) -- Grouped settings with navigation pattern
- [SetProduct Settings UI Design](https://www.setproduct.com/blog/settings-ui-design) -- Settings page usability tips
- [Toggle list design patterns](https://cieden.com/book/atoms/toggle-switch/how-to-design-a-toggle-list) -- Toggle switch best practices for preference panels
- [Notification settings examples](https://nicelydone.club/pages/notification-settings) -- Real-world notification settings from web apps
