# Home Warehouse System

## What This Is

A multi-tenant home inventory management system with complete offline capabilities. Users can access and modify their inventory while offline (e.g., walking around a warehouse without network), with changes syncing automatically when connectivity returns.

## Core Value

Reliable inventory access anywhere — online or offline — with seamless sync.

## Requirements

### Validated

**v1.1 Offline Entity Extension (shipped 2026-01-25):**

- ✓ Offline mutations for borrowers — create/update while offline with optimistic UI
- ✓ Offline mutations for categories — hierarchical support with topological sort
- ✓ Offline mutations for locations — hierarchical support with topological sort
- ✓ Offline mutations for containers — cross-entity location dependency tracking
- ✓ Offline mutations for inventory — multi-entity dependency (item, location, container)
- ✓ Conflict history UI — `/dashboard/sync-history` with entity type and date range filtering
- ✓ Dependency-aware sync — `dependsOn` field for prerequisite tracking, cascade failure handling
- ✓ Entity-type ordered sync — categories → locations → borrowers → containers → items → inventory

**v1 PWA Offline Completion (shipped 2026-01-24):**

- ✓ Proactive data sync — all workspace data cached to IndexedDB on app load
- ✓ Offline mutations — queue create/update operations when offline, sync when back online
- ✓ Conflict handling — critical field resolution UI, last-write-wins for non-critical, audit logging
- ✓ Sync status UI — last synced time, pending changes count, offline indicator
- ✓ PWA screenshots — mobile (1080x1920) and desktop (1920x1080) for install prompts
- ✓ iOS Safari fallback — online event + visibility change triggers for Background Sync limitation

**Pre-existing:**

- ✓ PWA installable on iOS/Android
- ✓ Service worker with runtime caching
- ✓ NetworkFirst API caching for visited pages
- ✓ Offline photo upload queuing
- ✓ Online/offline status detection
- ✓ Pending uploads indicator UI

### Active

**v1.2 Phase 2 Completion (in progress):**

- [ ] Repair log tracking — full lifecycle with photos, attachments, reminders
- [ ] Declutter assistant — unused item detection, scoring, grouping, export
- [ ] Bulk photo operations — multi-select, bulk delete/edit, zip download
- [ ] Background thumbnail processing — async generation, WebP, multiple sizes
- [ ] SSE test coverage — remaining 9 handler tests
- [ ] Import testing checklist — manual verification documented

### Out of Scope

- Offline delete operations — conflict resolution too complex, data loss risk
- Photo/attachment sync — heavy assets excluded from proactive sync (cached on-demand)
- Real-time sync while offline — changes sync on reconnection, not continuously

## Current State

**Shipped:** v1.1 Offline Entity Extension (2026-01-25)

**Tech stack:**
- Backend: Go 1.25, Chi, sqlc, PostgreSQL
- Frontend: Next.js 16, React 19, shadcn/ui, Tailwind CSS 4
- PWA: Serwist service worker, IndexedDB (idb v8), UUIDv7

**Offline infrastructure:**
- IndexedDB v3 with 9 stores (7 entities + mutationQueue + conflictLog)
- SyncManager with iOS fallback (online + visibilitychange)
- Conflict resolver with critical field classification
- 17+ E2E tests covering offline scenarios

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IndexedDB over localStorage | Larger storage, async, structured data | ✓ Good — 7 entity stores + queue + log |
| idb wrapper v8.0.3 | Type-safe, promise-based, minimal (1.19kB) | ✓ Good — clean API |
| No offline deletes | Conflict resolution too complex, data loss risk | ✓ Good — avoided complexity |
| Lightweight data only | Storage constraints, sync speed | ✓ Good — JSON only, photos on-demand |
| UUIDv7 for idempotency | Time-ordered, globally unique, better deduplication | ✓ Good — server-side dedup works |
| Critical fields manual resolution | Inventory quantity/status too important for auto-merge | ✓ Good — user decides |
| iOS fallback sync | Safari lacks Background Sync API | ✓ Good — online + visibility triggers |

## Constraints

- **Storage**: IndexedDB quota varies by browser (~50MB minimum, expandable)
- **Performance**: Sync must not block UI, run in service worker/background
- **Compatibility**: Must work in Safari (limited Background Sync support)
- **No heavy assets**: Photos, PDFs, attachments excluded from proactive sync

---
*Last updated: 2026-01-25 after v1.2 milestone started*
