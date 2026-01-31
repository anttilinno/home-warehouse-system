# Home Warehouse System

## What This Is

A multi-tenant home inventory management system with complete offline capabilities and mobile-first UX. Users can access and modify their inventory while offline (e.g., walking around a warehouse without network), with changes syncing automatically when connectivity returns. Mobile users can scan barcodes, use floating action buttons for quick access, and complete forms efficiently with progressive disclosure.

## Core Value

Reliable inventory access anywhere — online or offline — with seamless sync.

## Requirements

### Validated

**v1.3 Mobile UX Overhaul (shipped 2026-01-31):**

- ✓ Barcode/QR scanning with camera — QR, UPC/EAN, Code128 formats supported
- ✓ Visual/audio/haptic feedback on scan — beep sound, vibration, visual highlight
- ✓ Flashlight toggle for low-light scanning — torch control on Android
- ✓ Scan history with timestamps — last 10 scans, localStorage persistence
- ✓ Manual barcode entry fallback — for when camera fails
- ✓ Quick action menu after scan — View/Loan/Move/Repair context-aware actions
- ✓ "Item not found" with create option — seamless new item flow
- ✓ Instant search results (< 300ms) — Fuse.js with debounced input
- ✓ Fuzzy matching for typos — threshold 0.4 tolerates 1-2 char errors
- ✓ Autocomplete suggestions — 5-8 items while typing
- ✓ Recent searches on focus — last 5 searches
- ✓ 44x44px search touch targets — WCAG 2.5.5 AA compliance
- ✓ Offline search via IndexedDB — Fuse.js indices with pending mutations merge
- ✓ Floating action button on mobile — bottom-right, 56px, hidden on desktop
- ✓ Radial menu with 3-5 actions — scan, add item, log loan context-aware
- ✓ Haptic feedback on FAB — ios-haptics for iOS 17.4+, navigator.vibrate for Android
- ✓ Context-aware FAB actions — different actions per route
- ✓ Long-press for selection mode — 500ms threshold, 25px cancel on movement
- ✓ Progressive disclosure forms — CollapsibleSection for advanced fields
- ✓ Mobile keyboard types — inputMode for number/email/url
- ✓ 44px form touch targets — min-h-[44px] throughout
- ✓ Visible labels (not placeholder-only) — labels above inputs
- ✓ Inline validation errors — AlertCircle icon, red text near field
- ✓ Inline photo capture — camera + gallery without leaving form
- ✓ Form draft auto-save — IndexedDB persistence, 1s debounce
- ✓ 16px+ fonts prevent iOS zoom — text-base class

**v1.2 Phase 2 Completion (shipped 2026-01-25):**

- ✓ Repair log tracking — full lifecycle with photos, attachments, warranty, reminders
- ✓ Declutter assistant — unused item detection, scoring, grouping, export
- ✓ Bulk photo operations — multi-select, bulk delete/edit, zip download, duplicate detection
- ✓ Background thumbnail processing — async generation, WebP, multiple sizes via Asynq
- ✓ SSE test coverage — all 11 handlers tested (47 SSE tests passing)
- ✓ Import testing checklist — 8 comprehensive manual test scenarios documented

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

**v1.4 Test Overhaul (shipped 2026-01-31):**

- ✓ Go test factories — 8 entity types with functional options, gofakeit integration
- ✓ Backend coverage — importexport 92.4%, importjob 86.3%, itemphoto 80.5%, repairlog 92.8%
- ✓ Frontend unit tests — useOfflineMutation (29), SyncManager (34), MultiStepForm (21), BarcodeScanner (18), FAB (28)
- ✓ CI parallelization — matrix strategy for Go tests, Codecov integration with badge
- ✓ E2E auth stability — waitForTimeout removed, proper wait conditions
- ✓ E2E coverage — inventory tests (18), loan CRUD tests (4)
- ⚠ pendingchange 57.3% — handler.go tested via integration, not unit tests
- ⚠ jobs 20.1% — architectural constraint (ProcessTask requires database)

### Active

(No active requirements — ready for next milestone)

### Out of Scope

- Offline delete operations — conflict resolution too complex, data loss risk
- Photo/attachment sync — heavy assets excluded from proactive sync (cached on-demand)
- Real-time sync while offline — changes sync on reconnection, not continuously
- Hardware barcode scanner support — USB/Bluetooth scanners add complexity, camera sufficient
- AR overlay for item location — high complexity, not core to mobile UX
- NFC tag scanning — limited device support, QR/barcode covers use cases

## Current State

**Shipped:** v1.4 Test Overhaul (2026-01-31)

**Tech stack:**
- Backend: Go 1.25, Chi, sqlc, PostgreSQL
- Frontend: Next.js 16, React 19, shadcn/ui, Tailwind CSS 4
- PWA: Serwist service worker, IndexedDB (idb v8), UUIDv7
- Mobile UX: Fuse.js 7.1.0, @yudiel/react-qr-scanner, ios-haptics, motion v12.27

**Offline infrastructure:**
- IndexedDB v4 with 10 stores (7 entities + mutationQueue + conflictLog + formDrafts)
- SyncManager with iOS fallback (online + visibilitychange)
- Conflict resolver with critical field classification
- Fuse.js indices for offline fuzzy search
- 17+ E2E tests covering offline scenarios

**Mobile infrastructure:**
- BarcodeScanner with QR/UPC/EAN/Code128 support
- FloatingActionButton with radial menu and haptic feedback
- MultiStepForm wizard with draft persistence
- Smart defaults from recent selections
- Visual Viewport API for iOS keyboard handling

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IndexedDB over localStorage | Larger storage, async, structured data | ✓ Good — 10 stores now |
| idb wrapper v8.0.3 | Type-safe, promise-based, minimal (1.19kB) | ✓ Good — clean API |
| No offline deletes | Conflict resolution too complex, data loss risk | ✓ Good — avoided complexity |
| Lightweight data only | Storage constraints, sync speed | ✓ Good — JSON only, photos on-demand |
| UUIDv7 for idempotency | Time-ordered, globally unique, better deduplication | ✓ Good — server-side dedup works |
| Critical fields manual resolution | Inventory quantity/status too important for auto-merge | ✓ Good — user decides |
| iOS fallback sync | Safari lacks Background Sync API | ✓ Good — online + visibility triggers |
| Fuse.js v7.1.0 exact version | Reproducible builds, tested configuration | ✓ Good — stable fuzzy search |
| @yudiel/react-qr-scanner | Active maintenance, ZXing-based, React-friendly | ✓ Good — reliable scanning |
| Single-page scan flow | iOS PWA camera permission persistence | ✓ Good — avoids re-permission prompts |
| ios-haptics library | iOS 17.4+ Safari haptic workaround | ✓ Good — cross-platform haptics |
| Visual Viewport API | iOS keyboard hides fixed elements | ✓ Good — nav buttons stay visible |
| IndexedDB for form drafts | Survives page reload, more storage than localStorage | ✓ Good — robust persistence |
| Functional options pattern for factories | Flexible test customization without constructor changes | ✓ Good — clean factory API |
| Interface extraction for testability | WorkspaceBackupQueries, ServiceInterface enable mocking | ✓ Good — handler isolation |
| vi.hoisted for Vitest mocks | vi.mock is hoisted, so mock functions need vi.hoisted() | ✓ Good — works with factory pattern |
| waitForURL over waitForTimeout | Event-driven waits more reliable than arbitrary timeouts | ✓ Good — auth stability improved |
| domcontentloaded over networkidle | SSE connections prevent networkidle from completing | ✓ Good — E2E tests reliable |

## Constraints

- **Storage**: IndexedDB quota varies by browser (~50MB minimum, expandable)
- **Performance**: Sync must not block UI, run in service worker/background
- **Compatibility**: Must work in Safari (limited Background Sync support)
- **No heavy assets**: Photos, PDFs, attachments excluded from proactive sync
- **iOS quirks**: Camera permissions volatile in PWA, Visual Viewport API needed for keyboard

## Test Infrastructure

**Added in v1.4:**
- Go test factories: 8 entity types with gofakeit in `backend/internal/testutil/factory/`
- Frontend mock utilities: offline-mock.ts, sync-mock.ts in `frontend/lib/test-utils/`
- CI: Matrix strategy for parallel Go tests, Codecov integration
- 130+ new frontend unit tests (Vitest)
- 20+ new E2E tests (Playwright)

**Coverage achieved:**
- importexport: 92.4%
- importjob: 86.3%
- itemphoto: 80.5%
- repairlog: 92.8%
- pendingchange: 57.3% (handler.go via integration tests)
- jobs: 20.1% (architectural constraint)

## Tech Debt

**From v1.4:**
- pendingchange handler.go needs unit tests (tested via integration)
- jobs ProcessTask methods require database mocking for unit testing
- 56 waitForTimeout calls remain in 24 lower-priority E2E files
- Go test factories orphaned (not adopted by Phase 23/24 tests)

---
*Last updated: 2026-01-31 after v1.4 milestone complete*
