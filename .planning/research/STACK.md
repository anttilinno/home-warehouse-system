# Technology Stack: Modular Settings with Theming, Notification Preferences, and Storage Management

**Project:** Home Warehouse System -- Settings Restructure
**Researched:** 2026-02-12
**Scope:** Stack additions for dark/light/system theme settings UI, in-app notification preference toggles, and IndexedDB/cache storage visibility and management
**Overall Confidence:** HIGH

## Executive Summary

**No new npm packages required.** The existing stack already contains every library needed for all three features. The only addition is one shadcn/ui component (Switch) installed via the CLI, which pulls in `@radix-ui/react-switch` automatically.

One CSS correctness fix is needed in the Tailwind v4 dark mode variant selector.

**Total new dependencies:** 1 (via shadcn CLI)
**Total new npm packages:** 0 (manually added)

---

## What Already Exists (DO NOT Add)

These are already installed and configured. Listed to prevent duplicate work.

| Capability | Library | Version | Location |
|------------|---------|---------|----------|
| Theme switching | `next-themes` | 0.4.6 | `components/providers/theme-provider.tsx` |
| Theme toggle (binary) | Custom component | -- | `components/shared/theme-toggle.tsx` |
| Dark mode CSS variables | Tailwind CSS 4 + oklch | -- | `app/globals.css` (`:root` + `.dark`) |
| Dark variant config | `@custom-variant dark` | -- | `app/globals.css` line 4 |
| ThemeProvider in layout | Wraps entire app | -- | `app/[locale]/layout.tsx` |
| SSE real-time events | Custom SSEProvider | -- | `lib/contexts/sse-context.tsx` |
| SSE subscription hook | `useSSE` / `useSSESubscription` | -- | `lib/hooks/use-sse.ts` |
| Push notification toggle | `usePushNotifications` | -- | `lib/hooks/use-push-notifications.ts` |
| Push notification UI | `NotificationSettings` | -- | `components/settings/notification-settings.tsx` |
| In-app notifications | `NotificationsDropdown` | -- | `components/dashboard/notifications-dropdown.tsx` |
| Notifications API client | `notificationsApi` | -- | `lib/api/notifications.ts` |
| IndexedDB offline storage | `idb` | 8.0.3 | `lib/db/offline-db.ts` |
| Offline context | `OfflineProvider` / `useOffline` | -- | `lib/contexts/offline-context.tsx` |
| Persistent storage request | `requestPersistentStorage()` | -- | `lib/db/offline-db.ts` |
| DB clear/delete operations | `clearStore()` / `deleteDB()` | -- | `lib/db/offline-db.ts` |
| Service worker (PWA) | `serwist` / `@serwist/next` | 9.5.0 | `app/sw.ts` |
| Form validation | `react-hook-form` + `zod` | 7.70.0 / 4.3.5 | Already configured |
| i18n | `next-intl` | 4.7.0 | Already configured (en/et/ru) |
| Toast notifications | `sonner` | 2.0.7 | Already configured |
| Radio groups | `@radix-ui/react-radio-group` | -- | Used in backup-restore-dialog |
| Animations | `motion` | 12.29.2 | Already installed |
| Progress bar | shadcn/ui Progress | -- | `components/ui/progress.tsx` |
| Settings page | Existing monolithic page | -- | `app/[locale]/(dashboard)/dashboard/settings/page.tsx` |
| Backup/Restore | `BackupRestoreDialog` | -- | `components/shared/backup-restore-dialog.tsx` |
| Format preferences | Date/Time/Number settings | -- | `components/settings/*-format-settings.tsx` |

---

## Recommended Stack Additions

### 1. shadcn/ui Switch Component (Add via CLI)

| Technology | Version | Bundle Size | Purpose |
|------------|---------|-------------|---------|
| shadcn/ui Switch | Latest (CLI-managed) | ~2 KB (Radix primitive) | Toggle controls for notification preferences |

**Why:** Notification preference toggles need an on/off control. The project uses shadcn/ui components everywhere else. Switch is the standard pattern for boolean settings -- semantically "enable/disable" rather than Checkbox which implies "select/agree". The project currently has NO `switch.tsx` in `components/ui/`.

**Confidence:** HIGH -- verified shadcn/ui Switch exists at `ui.shadcn.com/docs/components/radix/switch`, verified absence by listing `components/ui/`.

**Installation:**
```bash
cd frontend && pnpm dlx shadcn@latest add switch
```

This adds `@radix-ui/react-switch` as a dependency (consistent with the project's current individual `@radix-ui/react-*` package approach) and generates `components/ui/switch.tsx`.

**Note on Radix UI migration:** As of February 2026, shadcn/ui supports a unified `radix-ui` package replacing individual `@radix-ui/react-*` packages. This project still uses individual packages. A migration is available (`pnpm dlx shadcn@latest migrate radix`) but is out of scope for this milestone.

---

### 2. CSS Fix: Tailwind v4 Dark Mode Variant (Not a dependency -- a bug fix)

| Item | Detail |
|------|--------|
| File | `app/globals.css` line 4 |
| Current | `@custom-variant dark (&:is(.dark *));` |
| Correct | `@custom-variant dark (&:where(.dark, .dark *));` |

**Why this matters:**

1. **Missing self-match:** The current selector `(&:is(.dark *))` only matches descendants of `.dark` elements, NOT the `.dark` element itself. The correct selector `(&:where(.dark, .dark *))` matches both the element with the `.dark` class AND its descendants. This matters for `dark:bg-background` on the `<body>` tag -- if `.dark` is on `<html>`, then `<html>` elements with `dark:` utilities would not match.

2. **Specificity:** `:where()` has zero specificity (unlike `:is()` which takes the highest specificity of its arguments). Using `:where()` prevents unintentional specificity inflation that could make dark mode overrides harder to manage. This is the approach recommended by the official Tailwind CSS v4 documentation.

**Confidence:** HIGH -- verified against official Tailwind CSS v4 documentation at `tailwindcss.com/docs/dark-mode`.

---

## What You Do NOT Need

### No new theme library
`next-themes` 0.4.6 already provides everything needed:
- Three-way theme: `theme` returns `"light"` | `"dark"` | `"system"`, `setTheme()` accepts these values
- System preference detection via `prefers-color-scheme` media query
- Class-based toggling via `attribute="class"` (already configured)
- Flash prevention via injected inline script (handled by the provider)
- SSR-safe: `resolvedTheme` is undefined on server, `useTheme()` requires mounting check
- localStorage persistence (automatic, key: `"theme"`)
- The ThemeProvider is already configured with `enableSystem` and `defaultTheme="system"` in `components/providers/theme-provider.tsx`

### No CSS-in-JS or theme tokens library
The project already has complete light and dark CSS custom property sets in oklch color space in `globals.css`. All shadcn/ui components consume these variables through Tailwind's `@theme inline` mapping. No additional theming infrastructure is needed.

### No storage estimation library
`navigator.storage.estimate()` is a native browser API returning `{ usage, quota }` in bytes. Combined with the existing `idb` library's ability to count records per object store via `getAll()`, this covers all storage visibility needs. No third-party library adds value here.

### No notification preferences library / state manager
In-app notification preferences (which SSE event types to display) are simple boolean toggles. localStorage is sufficient for storage. The existing `useSSE` hook already receives all event types -- filtering is a client-side concern at the subscriber level.

### No state management library (Zustand, Jotai, etc.)
- Theme state: managed by `next-themes`
- Notification preferences: localStorage + a custom hook
- Storage metrics: one-shot async reads via `navigator.storage.estimate()`
None of these warrant a state management library.

---

## Integration Architecture Per Feature

### Feature 1: Theme Settings (Three-Way Selector)

**Existing infrastructure used:**
- `next-themes` `useTheme()` hook: `theme` (current), `setTheme()`, `resolvedTheme` (actual active theme)
- `ThemeProvider` already wraps the entire app with `enableSystem` and `attribute="class"`
- `globals.css` already has `:root` (light) and `.dark` (dark) CSS variable sets

**UI pattern:** RadioGroup with three options (Light, Dark, System). Use `theme` for the selected value, `setTheme()` for onChange. Show `resolvedTheme` as a badge when "System" is selected to indicate which theme is actually active.

**Hydration safety:** The existing ThemeToggle already demonstrates the pattern -- use `useState(false)` for mounted, set to `true` in `useEffect`. Render skeleton/placeholder until mounted. This same pattern applies to the three-way selector.

**Existing component to refactor:** The binary `ThemeToggle` in `components/shared/theme-toggle.tsx` currently only toggles between light/dark, skipping system. After adding the settings subpage with three-way selection, the header toggle can remain as a quick shortcut (cycling light -> dark -> system) or link to settings.

**shadcn/ui components needed (all already installed):**
- RadioGroup + RadioGroupItem
- Card, CardHeader, CardContent
- Label

### Feature 2: In-App Notification Preferences

**Approach: Client-side only (recommended for this milestone)**

No backend notification preference API exists (verified by searching the backend codebase for `notification_preferences`). Building backend preferences would require database migrations, new API endpoints, and backend filtering logic -- significant scope for what is primarily a UI/UX milestone.

**Implementation pattern:**
1. Create a `useNotificationPreferences()` hook backed by localStorage
2. Define preference categories matching existing SSE event types:
   - Loan events: `loan.created`, `loan.updated`, `loan.returned`, `loan.deleted`
   - Inventory events: `inventory.created`, `inventory.updated`, `inventory.deleted`
   - Item events: `item.created`, `item.updated`, `item.deleted`
   - Approval events: `pendingchange.created`, `pendingchange.approved`, `pendingchange.rejected`
   - Location/container events: grouped
3. Filter SSE events in `NotificationsDropdown` and in-app toast triggers based on preferences
4. The existing push notification toggle (`NotificationSettings`) remains separate -- it controls browser push permission, not in-app notification filtering

**SSE integration:** The `SSEProvider` broadcasts ALL events to subscribers. Filtering happens at the subscriber level in `useSSE({ onEvent })`. This means notification preferences are purely a consumer-side concern -- no changes to the SSE infrastructure needed.

**shadcn/ui components needed:**
- **Switch** (ADD via CLI) -- one per notification category
- Card, CardHeader, CardContent (already installed)
- Separator (already installed)
- Badge (already installed)

### Feature 3: Data & Storage Management

**Storage estimation (native API -- no library needed):**
```typescript
// navigator.storage.estimate() returns { usage, quota } in bytes
// Supported: Chrome, Firefox, Edge, Safari 17+
// Returns origin-wide totals, not per-database breakdown
const estimate = await navigator.storage.estimate();
```

**Per-store record counts (using existing idb):**
```typescript
// Already available via getAll() or can add count operations
const db = await getDB();
const tx = db.transaction(['items', 'inventory', 'locations'], 'readonly');
const itemCount = await tx.objectStore('items').count();
```

**Persistent storage status (already implemented):**
- `navigator.storage.persisted()` -- already called in `offline-db.ts`
- `OfflineProvider` already exposes `persistentStorage` boolean

**Cache management (native API):**
```typescript
// Service worker cache keys -- native API, no library needed
const cacheNames = await caches.keys();
// Clear specific cache
await caches.delete(cacheName);
```

**Existing operations to expose in UI:**
- `clearStore(storeName)` -- already in `lib/db/offline-db.ts`
- `deleteDB()` -- already in `lib/db/offline-db.ts`
- `triggerSync()` -- already in `OfflineProvider`

**New hook needed:** A `useStorageEstimate()` hook wrapping `navigator.storage.estimate()` with loading/error states. This is ~20 lines of custom code, not a library.

**shadcn/ui components needed (all already installed):**
- Progress -- for storage usage bars
- Card, CardHeader, CardContent -- section wrappers
- AlertDialog -- confirm destructive actions (clear cache, delete DB)
- Button -- action triggers
- Separator -- between sections

---

## Installation Commands

```bash
# The ONLY installation needed:
cd frontend && pnpm dlx shadcn@latest add switch
```

No `bun add`, `npm install`, or manual package additions are needed. Everything else is already in `package.json`.

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Theme system | HIGH | `next-themes` 0.4.6 verified on npm, ThemeProvider config verified in codebase, dark mode CSS variables verified in globals.css |
| Switch component | HIGH | Verified on shadcn/ui docs, confirmed absence in project's `components/ui/` |
| CSS variant fix | HIGH | Verified against official Tailwind CSS v4 docs (`tailwindcss.com/docs/dark-mode`) |
| Notification preferences | HIGH | SSE event types verified in codebase, localStorage approach is standard |
| Storage APIs | MEDIUM | `navigator.storage.estimate()` is well-supported in Chrome/Firefox/Edge, but Safari support for `estimate()` is limited (Safari supports `persisted()` but `estimate()` may return approximate values). Need graceful fallback. |
| No-new-deps conclusion | HIGH | Every capability verified against installed packages in `package.json` and existing code |

---

## Sources

### Verified (HIGH confidence)
- [Tailwind CSS v4 Dark Mode docs](https://tailwindcss.com/docs/dark-mode) -- `:where(.dark, .dark *)` variant syntax
- [shadcn/ui Switch component](https://ui.shadcn.com/docs/components/radix/switch) -- installation and API
- [shadcn/ui Dark Mode with Next.js](https://ui.shadcn.com/docs/dark-mode/next) -- next-themes integration pattern
- [next-themes npm](https://www.npmjs.com/package/next-themes) -- version 0.4.6, latest
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) -- `useTheme()` API, system preference support
- [shadcn/ui February 2026 changelog](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) -- unified radix-ui package migration (noted, out of scope)

### Verified (MEDIUM confidence)
- [MDN Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API) -- `navigator.storage.estimate()` browser compatibility
- [MDN Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- quota limits, persistence model
- [Chrome Developer Blog - Estimating Available Storage](https://developer.chrome.com/blog/estimating-available-storage-space) -- `estimate()` API details
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) -- Safari storage behavior

### Codebase verification (HIGH confidence)
- `frontend/package.json` -- confirmed all existing dependencies and versions
- `frontend/app/globals.css` -- confirmed dark mode variant and CSS variable setup
- `frontend/components/providers/theme-provider.tsx` -- confirmed ThemeProvider configuration
- `frontend/components/shared/theme-toggle.tsx` -- confirmed current binary toggle implementation
- `frontend/lib/contexts/sse-context.tsx` -- confirmed SSE event broadcast architecture and all event types
- `frontend/lib/db/offline-db.ts` -- confirmed IndexedDB setup with `clearStore()` / `deleteDB()`
- `frontend/lib/contexts/offline-context.tsx` -- confirmed OfflineProvider with storage metrics
- `frontend/components/ui/` directory listing -- confirmed Switch component is NOT present
- `frontend/components/settings/notification-settings.tsx` -- confirmed existing push notification UI
- `frontend/lib/api/notifications.ts` -- confirmed notification types and API client
- Backend codebase -- confirmed NO `notification_preferences` API exists
