# Phase 38: Data and Storage Management - Research

**Researched:** 2026-02-13
**Domain:** PWA storage APIs, offline cache management, IndexedDB, Service Worker cache
**Confidence:** HIGH

## Summary

This phase builds the Data & Storage settings subpage by composing existing infrastructure into a new UI. The codebase already has all the backend plumbing: `useOffline()` context exposes `triggerSync`, `lastSyncTimestamp`, `isSyncing`, `persistentStorage`, and `dbReady`. The `offline-db.ts` module provides `deleteDB()` and `clearStore()`. The `BackupRestoreDialog` component exists but is not imported anywhere -- it needs to be relocated into this page. The `importExportApi` in `lib/api/importexport.ts` and `lib/api/workspace-backup.ts` provide the export/import functionality.

The main new code is: (1) a storage usage display using `navigator.storage.estimate()` with a progress bar, (2) a clear-cache button with AlertDialog confirmation, (3) a persistent storage status indicator with a request button, (4) a manual sync trigger with last-sync timestamp, and (5) embedding the existing `BackupRestoreDialog` inline (not as a dialog trigger but as rendered content on the page).

**Primary recommendation:** Build 3-4 new Card-based settings components in `components/settings/` that consume existing `useOffline()` context and browser Storage APIs, then compose them into the data-storage page following the established subpage pattern.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-progress` | ^1.1.8 | Storage usage progress bar | Already installed, used by `Progress` component |
| `@radix-ui/react-alert-dialog` | ^1.1.15 | Clear cache confirmation dialog | Already installed, AlertDialog component exists |
| `idb` | 8.0.3 | IndexedDB wrapper for offline DB | Already used throughout `lib/db/` |
| `serwist` | ^9.5.0 | Service worker + cache management | Already configured in `app/sw.ts` |
| `next-intl` | ^4.7.0 | i18n translations | Already used by all settings components |
| `sonner` | ^2.0.7 | Toast notifications | Already used by all settings components |
| `lucide-react` | ^0.562.0 | Icons | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns` | ^4.1.0 | Formatting last-sync timestamp | Already installed, use for date formatting |

### Alternatives Considered
None -- this phase uses exclusively existing dependencies. No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── components/settings/
│   ├── storage-usage.tsx          # NEW: Storage estimate + progress bar
│   ├── cache-management.tsx       # NEW: Clear cache + persistent storage
│   ├── sync-settings.tsx          # NEW: Manual sync trigger + last-sync timestamp
│   └── ... (existing files)
├── components/shared/
│   └── backup-restore-dialog.tsx  # EXISTING: Relocate/embed into data-storage page
├── app/[locale]/(dashboard)/dashboard/settings/
│   └── data-storage/
│       └── page.tsx               # MODIFY: Replace stub with composed components
├── lib/contexts/
│   └── offline-context.tsx        # EXISTING: Provides all sync/offline state
├── lib/db/
│   └── offline-db.ts             # EXISTING: deleteDB(), clearStore(), initDB()
└── messages/
    ├── en.json                    # MODIFY: Add settings.dataStorage translations
    ├── et.json                    # MODIFY: Add settings.dataStorage translations
    └── ru.json                    # MODIFY: Add settings.dataStorage translations
```

### Pattern 1: Settings Subpage Composition
**What:** Each settings subpage follows an identical structure: mobile back link, heading, description, then imported component(s).
**When to use:** Always for settings subpages.
**Example:**
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/settings/profile/page.tsx
"use client";

import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AccountSettings } from "@/components/settings/account-settings";

export default function ProfilePage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      {/* Mobile back link */}
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.profile")}</h2>
        <p className="text-muted-foreground">{t("account.description")}</p>
      </div>

      <AccountSettings />
    </div>
  );
}
```

### Pattern 2: Settings Card Component
**What:** Each feature section is a Card with CardHeader (title + description) and CardContent.
**When to use:** For each logical grouping within a settings subpage.
**Example:**
```typescript
// Source: Pattern from notification-settings.tsx and theme-settings.tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Icon className="h-5 w-5" />
      {t("title")}
    </CardTitle>
    <CardDescription>{t("description")}</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Content */}
  </CardContent>
</Card>
```

### Pattern 3: useOffline() as State Source
**What:** All offline/sync state comes from `useOffline()` context -- never duplicate this state.
**When to use:** For sync triggers, last-sync timestamp, persistent storage status, online status.
**Exposed values relevant to this phase:**
```typescript
const {
  isOnline,          // boolean - network status
  dbReady,           // boolean - IndexedDB initialized
  persistentStorage, // boolean - persistent storage granted
  isSyncing,         // boolean - workspace data sync in progress
  lastSyncTimestamp, // number | null - epoch ms of last sync
  syncError,         // string | null - error from last sync
  syncCounts,        // Record<EntityType, number> | null - records synced per entity
  triggerSync,       // () => Promise<void> - manual sync trigger
  pendingMutationCount, // number - pending offline mutations
  isMutationSyncing, // boolean - mutation queue processing
} = useOffline();
```

### Anti-Patterns to Avoid
- **Creating a new context for data-storage state:** The `useOffline()` context already provides everything needed for sync and persistent storage. Do NOT create a `DataStorageContext`.
- **Wrapping components in extra Card layers in page.tsx:** Per Phase 36 decision, page.tsx imports components directly. Each component manages its own Card wrapper.
- **Calling `navigator.storage.estimate()` on every render:** Cache the result in state and only refresh on user action or interval. The API call is async and imprecise.
- **Using the BackupRestoreDialog as a dialog on this page:** Since this IS the dedicated page for it, render the export/import sections inline (not behind a dialog trigger). Reuse the existing component with `open={true}` or extract its content for inline rendering.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Storage estimation | Custom IndexedDB size calculation | `navigator.storage.estimate()` | Browser API gives total origin usage; iterating IDB stores manually is slow and misses Cache API |
| Cache clearing | Manual cache deletion loop | `caches.keys()` + `caches.delete()` for SW caches; `deleteDB()` for IndexedDB | Handles all cache names dynamically; `deleteDB()` already handles connection cleanup |
| Persistent storage | Custom eviction prevention | `navigator.storage.persist()` / `navigator.storage.persisted()` | Browser-native; already called in `offline-db.ts` but not exposed to UI |
| Sync state | New sync tracking | `useOffline()` context | Already tracks `isSyncing`, `lastSyncTimestamp`, `syncError`, `triggerSync` |
| Relative time formatting | Custom formatter | Existing `formatRelativeTime()` from `sync-status-indicator.tsx` | Already written, tested, and used in production |
| Import/Export UI | New component | Existing `BackupRestoreDialog` | Full export/import UI with format selection, progress, error handling |

**Key insight:** Nearly all the logic for this phase already exists in the codebase. The work is composing existing pieces into new Card-based settings components and adding the one truly new feature (storage usage display with progress bar).

## Common Pitfalls

### Pitfall 1: Safari Storage Estimate Inaccuracy
**What goes wrong:** `navigator.storage.estimate()` on Safari returns imprecise values. Usage may show 0 or a rough approximation.
**Why it happens:** WebKit intentionally obfuscates exact values for privacy reasons. The spec explicitly says values are NOT exact.
**How to avoid:** Display values as "approximately X MB" and include a note about estimates being approximate. Never show decimals beyond 1 place. Use a fallback "Storage information unavailable" message if the API is not supported.
**Warning signs:** Tests on Safari show 0 bytes or wildly different numbers than Chrome for same data.

### Pitfall 2: Cache API Not Available in All Contexts
**What goes wrong:** `caches` global is undefined in some contexts (non-HTTPS localhost in some browsers, or SSR).
**Why it happens:** Cache API requires secure context; SSR has no browser APIs.
**How to avoid:** Guard all browser API calls with `typeof caches !== 'undefined'` and `typeof navigator !== 'undefined'`. All components using these APIs must be `"use client"` (they already will be since they're settings components).
**Warning signs:** "caches is not defined" errors during development.

### Pitfall 3: Clearing Cache While Service Worker Is Active
**What goes wrong:** Deleting caches that the SW is actively using causes fetch failures until page reload.
**Why it happens:** SW references cache by name; deleting it removes responses the SW expects to serve.
**How to avoid:** After clearing caches, either (a) unregister and re-register the SW, or (b) reload the page. Show the user a "Page will reload" message in the confirmation dialog.
**Warning signs:** Blank pages or failed resource loads after cache clear.

### Pitfall 4: deleteDB() When Connections Are Open
**What goes wrong:** `indexedDB.deleteDatabase()` blocks if there are open connections.
**Why it happens:** The singleton `dbPromise` in `offline-db.ts` holds an open connection.
**How to avoid:** The existing `deleteDB()` function already closes the connection before deleting. Use it directly rather than calling `indexedDB.deleteDatabase()` manually.
**Warning signs:** "Database deletion blocked" warning in console.

### Pitfall 5: Forgetting i18n for All Three Languages
**What goes wrong:** New translation keys added to `en.json` but not to `et.json` and `ru.json`.
**Why it happens:** Easy to forget secondary locales.
**How to avoid:** Add translations to all three message files (en, et, ru) in the same commit. Use English as placeholder for et/ru if proper translations aren't available yet.
**Warning signs:** Missing translation warnings in console during locale switching.

### Pitfall 6: BackupRestoreDialog Uses useWorkspace() Hook
**What goes wrong:** The existing `BackupRestoreDialog` calls `useWorkspace()` for the workspace ID, and uses `importExportApi` for export/import. When relocating to the settings page, ensure the workspace context is available.
**Why it happens:** Settings pages are rendered within the dashboard layout which provides workspace context.
**How to avoid:** The dashboard layout already provides workspace context. No special handling needed, but verify during testing.
**Warning signs:** "No workspace selected" toast when trying to export/import from settings page.

## Code Examples

### Storage Estimation with Graceful Degradation
```typescript
// Pattern for getting storage estimate with fallback
async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  supported: boolean;
}> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0, supported: false };
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
      supported: true,
    };
  } catch {
    return { usage: 0, quota: 0, supported: false };
  }
}
```

### Clearing All Caches (SW + IndexedDB)
```typescript
// Source: Combines patterns from offline-db.ts deleteDB() and Cache API
async function clearAllOfflineData(): Promise<void> {
  // 1. Delete IndexedDB (closes connection first)
  await deleteDB(); // from lib/db/offline-db.ts

  // 2. Delete all SW caches
  if (typeof caches !== "undefined") {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }

  // 3. Optionally delete the photo upload queue DB
  if (typeof indexedDB !== "undefined") {
    indexedDB.deleteDatabase("PhotoUploadQueue");
  }
}
```

### Persistent Storage Request
```typescript
// Source: Extends pattern from lib/db/offline-db.ts requestPersistentStorage()
async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

async function checkPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
    return false;
  }
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
```

### Format Bytes Utility
```typescript
function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}
```

### Existing Cache Names from sw.ts
```
Cache names used by the service worker (from app/sw.ts):
- "api-cache" (NetworkFirst - API responses)
- "item-photos-cache" (CacheFirst - item photos)
- "photo-thumbnails-cache" (CacheFirst - thumbnails)
- "images-cache" (CacheFirst - general images)
- "fonts-cache" (CacheFirst - fonts)
- Plus Serwist precache entries (name varies by Serwist version)
```

### IndexedDB Database Names
```
Databases used by the application:
- "hws-offline-v1" (main offline DB - items, inventory, locations, etc.)
- "PhotoUploadQueue" (queued photo uploads from SW)
```

## Existing Infrastructure Map

This section maps each requirement to existing code:

| Requirement | Existing Code | What's New |
|------------|---------------|------------|
| DATA-01: Storage usage display | `navigator.storage.estimate()` (browser API) | New `StorageUsage` Card component with Progress bar |
| DATA-02: Clear offline cache | `deleteDB()` in `offline-db.ts`, Cache API `caches.delete()` | New `CacheManagement` Card component with AlertDialog |
| DATA-03: Persistent storage | `persistentStorage` from `useOffline()`, `requestPersistentStorage()` in `offline-db.ts` | New status indicator + request button in `CacheManagement` Card |
| DATA-04: Manual sync trigger | `triggerSync()`, `lastSyncTimestamp`, `isSyncing` from `useOffline()` | New `SyncSettings` Card component |
| DATA-05: Import/export | `BackupRestoreDialog` component, `importExportApi` | Embed existing component in page (no dialog wrapper) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Safari has no Storage API | Safari 17+ supports `estimate()` and `persist()` | Safari 17 (Sep 2023) | Can now use same API across all browsers |
| Manual IDB size calculation | `navigator.storage.estimate()` for total usage | Baseline 2023 | Single API for total origin storage |
| Serwist v8 cache names | Serwist v9 cache names (may prefix differently) | Serwist 9.x | Need to use `caches.keys()` dynamically, not hardcode names |

**Deprecated/outdated:**
- `usageDetails` property on `StorageEstimate` is non-standard (Chrome-only). Do not rely on it for per-storage breakdown.
- `webkitStorageInfo` / `navigator.webkitTemporaryStorage` are deprecated. Use `navigator.storage` only.

## Component Design Decisions

### Storage Usage Card (`storage-usage.tsx`)
- Show total usage vs quota as a progress bar
- Display usage and quota in human-readable format (e.g., "12.3 MB of 2.1 GB")
- Show percentage used
- Include "approximate values" disclaimer for Safari
- Refresh button to re-fetch estimate
- Handle unsupported browsers gracefully

### Cache Management Card (`cache-management.tsx`)
- "Clear Offline Cache" button with AlertDialog confirmation
  - Confirmation text: warns data will be deleted, page will reload
  - On confirm: delete IDB + SW caches, then `window.location.reload()`
- Persistent storage status: Badge showing "Granted" or "Not granted"
- "Request Persistent Storage" button (only shown if not yet granted)
  - On success: update status badge, show success toast
  - On failure: show info toast (browser auto-decides, no user prompt on Chrome/Safari)

### Sync Settings Card (`sync-settings.tsx`)
- "Sync Now" button with loading spinner (reuse RefreshCw animation from SyncStatusIndicator)
- Last sync timestamp: formatted as absolute date/time + relative time
- Sync error display if last sync failed
- Pending mutation count badge (from `useOffline()`)
- Online/offline status indicator

### Import/Export Section
- Render `BackupRestoreDialog` content inline or use it with `open={true}` and hide the trigger
- Alternatively, keep using it as a dialog triggered by a button in a Card -- simpler approach that preserves existing component without modification

## Open Questions

1. **Inline vs Dialog for Backup/Restore**
   - What we know: `BackupRestoreDialog` is a complete, working component with tab switching (export/import)
   - What's unclear: Whether to render it inline on the page or keep it as a dialog triggered by a button
   - Recommendation: Keep it as a dialog triggered by a button within a "Backup & Restore" Card. This preserves the component unchanged and matches the settings pattern where actions happen via buttons/dialogs, not inline forms. The Card provides context (title, description) and the button opens the existing dialog.

2. **Per-cache size breakdown**
   - What we know: Can iterate `caches.keys()` and measure each cache via blob sizes, but opaque responses return size 0
   - What's unclear: Whether per-cache breakdown adds value vs just showing total
   - Recommendation: Show total only via `navigator.storage.estimate()`. Per-cache breakdown is unreliable and adds complexity with little user value.

3. **Page reload after cache clear**
   - What we know: Deleting SW caches while SW is active breaks resource loading
   - What's unclear: Whether to auto-reload or let user manually reload
   - Recommendation: Auto-reload after a short delay (1-2 seconds) with a toast message "Clearing cache... Page will reload."

## Sources

### Primary (HIGH confidence)
- Codebase files directly read:
  - `frontend/lib/contexts/offline-context.tsx` - Complete sync/offline state management
  - `frontend/lib/db/offline-db.ts` - IndexedDB operations including deleteDB()
  - `frontend/lib/sync/sync-manager.ts` - Mutation queue sync orchestration
  - `frontend/components/shared/backup-restore-dialog.tsx` - Complete backup/restore UI
  - `frontend/lib/api/importexport.ts` - Import/export API client
  - `frontend/app/sw.ts` - Service worker with cache configuration
  - `frontend/components/settings/*.tsx` - All existing settings components (pattern reference)
  - `frontend/app/[locale]/(dashboard)/dashboard/settings/*/page.tsx` - All subpage patterns

### Secondary (MEDIUM confidence)
- [MDN StorageManager.estimate()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) - API details, browser compatibility
- [MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) - Quota details per browser, Safari behavior
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) - Safari 17+ storage API support

### Tertiary (LOW confidence)
- Cache size calculation via blob iteration (from GitHub gist) - Works but opaque responses return 0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture: HIGH - Follows established settings subpage patterns verified from 5+ existing implementations
- Pitfalls: HIGH - Safari behavior documented by MDN and WebKit blog; cache clearing behavior verified from SW code
- Existing code reuse: HIGH - All APIs read and verified from actual source files

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable APIs, established patterns)
