# Milestone v1: PWA Offline Completion

**Status:** SHIPPED 2026-01-24
**Phases:** 1-5
**Total Plans:** 14

## Overview

5 phases to deliver complete offline capabilities for Home Warehouse System.

```
Phase 1: IndexedDB Foundation     --> Phase 2: Mutation Queue    --> Phase 3: Conflict Resolution
    |                                     |                              |
    +-- Offline reads work                +-- Offline writes work        +-- Multi-user safe
                                                                            |
                                                                       Phase 4: Screenshots & Polish
                                                                            |
                                                                            +-- Production ready
                                                                            |
                                                                       Phase 5: Form Integration
                                                                            |
                                                                            +-- User-accessible offline mutations
```

---

## Phase 1: IndexedDB Foundation & Proactive Caching

**Goal:** Users can view all workspace data while offline.
**Depends on:** None (foundation)
**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md - IndexedDB schema and database access layer (idb wrapper, types, CRUD operations)
- [x] 01-02-PLAN.md - Proactive data caching on workspace load (sync operations, offline data hook)
- [x] 01-03-PLAN.md - UI components (sync status indicator, PWA install prompt, layout integration)

**Delivers:**
- IndexedDB database schema (7 entity stores + syncMeta)
- Database access layer using `idb` wrapper
- Persistent storage request (Safari eviction prevention)
- Proactive workspace data caching on load
- Stale-while-revalidate read pattern
- Last sync timestamp tracking
- Offline data freshness indicator
- PWA install prompt for home screen

**Key files:**
- `frontend/lib/db/offline-db.ts` - IndexedDB schema and operations
- `frontend/lib/db/types.ts` - TypeScript types for offline entities
- `frontend/lib/db/sync-operations.ts` - Sync data from API to IndexedDB
- `frontend/lib/hooks/use-offline-data.ts` - Hook for reading offline data
- `frontend/lib/contexts/offline-context.tsx` - Extended with sync state
- `frontend/components/sync-status-indicator.tsx` - Freshness indicator
- `frontend/components/pwa-install-prompt.tsx` - Install prompt

**Status:** Complete (2026-01-22)

---

## Phase 2: Mutation Queue & Optimistic UI

**Goal:** Users can create and update records while offline.
**Depends on:** Phase 1 (IndexedDB infrastructure)
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md - Mutation queue infrastructure (IndexedDB schema, queue operations, retry logic)
- [x] 02-02-PLAN.md - SyncManager class with iOS fallback and BroadcastChannel communication
- [x] 02-03-PLAN.md - useOfflineMutation hook with optimistic updates
- [x] 02-04-PLAN.md - Enhanced SyncStatusIndicator and PendingChangesDrawer UI

**Delivers:**
- Sync Manager class (orchestrator)
- Mutation queue with idempotency keys
- Queue CRUD operations when offline
- Optimistic UI updates using React 19 useOptimistic
- Visual indicators for pending changes (badge, icons)
- Replay queue on reconnection
- Serwist BackgroundSyncPlugin integration
- iOS fallback (online event + visibility change triggers)
- Retry with exponential backoff
- Queue visibility drawer (view/cancel pending changes)

**Key files:**
- `frontend/lib/sync/sync-manager.ts` - Orchestrates offline mutations
- `frontend/lib/sync/mutation-queue.ts` - IndexedDB queue operations
- `frontend/lib/hooks/use-offline-mutation.ts` - Hook for queuing mutations
- `frontend/components/sync-status-indicator.tsx` - Unified status component
- `frontend/components/pending-changes-drawer.tsx` - Queue management UI
- `frontend/app/sw.ts` - BackgroundSyncPlugin config

**Status:** Complete (2026-01-24)

---

## Phase 3: Conflict Resolution

**Goal:** Graceful handling when synced data conflicts with server state.
**Depends on:** Phase 2 (mutation sync flow)
**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md - Conflict infrastructure (types, IndexedDB v3, resolver)
- [x] 03-02-PLAN.md - Conflict UI (ConflictResolutionDialog, useConflictResolution)
- [x] 03-03-PLAN.md - SyncManager integration (conflict-aware sync, providers)

**Delivers:**
- Version/timestamp checking on sync (If-Match headers)
- 409 Conflict response detection
- Last-write-wins default with notification
- Conflict resolution UI for critical fields (inventory quantity, item status)
- Audit trail of conflict resolutions
- Conflict notification toast

**Key files:**
- `frontend/lib/sync/conflict-resolver.ts` - Conflict detection and resolution
- `frontend/lib/sync/use-conflict-resolution.tsx` - Provider and hook
- `frontend/components/conflict-resolution-dialog.tsx` - Manual resolution UI

**Status:** Complete (2026-01-24)

---

## Phase 4: PWA Screenshots & Polish

**Goal:** Production-ready offline experience with install screenshots.
**Depends on:** Phase 3 (complete system)
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md - Screenshot generation script and PWA screenshots
- [x] 04-02-PLAN.md - Enhanced offline indicator (icon-only with pulse animation)
- [x] 04-03-PLAN.md - E2E offline tests (flows, sync, multi-tab)

**Delivers:**
- Mobile screenshot (1080x1920) - dashboard view
- Desktop screenshot (1920x1080) - inventory page
- PWA manifest screenshot entries
- Enhanced offline indicator styling (icon-only with pulse)
- E2E tests for offline flows (Playwright network simulation)

**Key files:**
- `frontend/e2e/scripts/generate-screenshots.ts` - Screenshot automation
- `frontend/public/screenshots/mobile-dashboard.png` - Mobile screenshot
- `frontend/public/screenshots/desktop-inventory.png` - Desktop screenshot
- `frontend/components/pwa/offline-indicator.tsx` - Enhanced indicator
- `frontend/e2e/offline/*.spec.ts` - Offline E2E tests

**Status:** Complete (2026-01-24)

---

## Phase 5: Form Integration for Offline Mutations

**Goal:** Migrate item forms to use offline mutation infrastructure, enabling users to create/update items while offline.
**Depends on:** Phases 2-3 (mutation hooks, SyncManager)
**Plans:** 1 plan

Plans:
- [x] 05-01-PLAN.md - Migrate item forms to useOfflineMutation with pending indicators and E2E tests

**Delivers:**
- Item create form uses useOfflineMutation hook
- Item update form uses useOfflineMutation hook
- Optimistic UI updates in item forms
- E2E test for offline item creation flow

**Key files:**
- `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx` - Item page with inline form
- `frontend/e2e/offline/offline-mutations.spec.ts` - E2E tests for offline mutation flow

**Status:** Complete (2026-01-24)

---

## Milestone Summary

**Key Decisions:**
- IndexedDB over localStorage (larger storage, async, structured data)
- idb wrapper v8.0.3 (type-safe, promise-based, minimal)
- No offline deletes (conflict resolution too complex)
- Lightweight data only (JSON, no photos/attachments)
- UUIDv7 for idempotency keys (time-ordered, globally unique)
- Critical fields manual resolution (inventory quantity/status)
- iOS fallback sync (online + visibilitychange events)

**Issues Resolved:**
- Safari 7-day data eviction via persistent storage request
- Duplicate records via idempotency keys
- iOS Background Sync limitation via fallback triggers
- Silent data loss via explicit conflict UI

**Technical Debt Incurred:**
- Conflict history UI not exposed (getConflictLog function exists but no UI)
- Safari iOS manual testing pending

---

_For current project status, see `.planning/PROJECT.md`_
