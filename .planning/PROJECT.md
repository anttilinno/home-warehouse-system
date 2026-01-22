# PWA Offline Completion

## What This Is

Completing the Progressive Web App (PWA) offline capabilities for Home Warehouse System. This milestone adds proactive data sync for offline viewing, background sync for offline mutations, and PWA install screenshots.

## Core Value

Users can access and modify their inventory while offline (e.g., walking around a warehouse without network), with changes syncing automatically when connectivity returns.

## Requirements

### Validated

- ✓ PWA installable on iOS/Android — existing
- ✓ Service worker with runtime caching — existing
- ✓ NetworkFirst API caching for visited pages — existing
- ✓ Offline photo upload queuing — existing
- ✓ Online/offline status detection — existing
- ✓ Pending uploads indicator UI — existing

### Active

- [ ] Proactive data sync — download all workspace data (items, inventory, locations, containers, categories, borrowers, loans) in background for offline access
- [ ] Offline mutations — queue create/update operations when offline, sync when back online
- [ ] Conflict handling — graceful handling when synced data conflicts with server state
- [ ] Sync status UI — show sync progress, last synced time, pending changes count
- [ ] PWA screenshots — capture mobile (1080x1920) and desktop (1920x1080) screenshots for install prompt

### Out of Scope

- Offline delete operations — too risky for conflicts, users must be online to delete
- Photo/attachment sync — heavy assets excluded from proactive sync (already cached on-demand)
- Real-time sync while offline — changes sync on reconnection, not continuously

## Context

**Existing Infrastructure:**
- Service worker (`frontend/app/sw.ts`) with Serwist
- IndexedDB for photo upload queue (`PhotoUploadQueue`)
- Offline context (`frontend/lib/contexts/offline-context.tsx`)
- Network status hook (`frontend/lib/hooks/use-network-status.ts`)
- Pending uploads indicator component

**Technical Approach:**
- Expand IndexedDB usage for mutation queue and data cache
- Use Background Sync API where supported, fallback to online event listener
- StaleWhileRevalidate for proactive data (show cached, update in background)

**Data to Sync (lightweight JSON only):**
- Items (name, SKU, category, brand — no photos)
- Inventory (quantities, locations, conditions)
- Locations (hierarchy)
- Containers
- Categories (hierarchy)
- Borrowers
- Loans (active)

## Constraints

- **Storage**: IndexedDB quota varies by browser (~50MB minimum, expandable)
- **Performance**: Sync must not block UI, run in service worker/background
- **Compatibility**: Must work in Safari (limited Background Sync support)
- **No heavy assets**: Photos, PDFs, attachments excluded from proactive sync

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IndexedDB over localStorage | Larger storage, async, structured data | — Pending |
| No offline deletes | Conflict resolution too complex, data loss risk | — Pending |
| Lightweight data only | Storage constraints, sync speed | — Pending |

---
*Last updated: 2026-01-22 after initialization*
