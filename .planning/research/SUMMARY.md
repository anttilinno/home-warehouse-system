# Project Research Summary

**Project:** Quick Capture Item Entry (v1.9) — Home Warehouse System
**Domain:** Mobile-first rapid bulk item onboarding for offline-capable PWA
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

Quick capture is a well-scoped feature addition to an already-sophisticated offline-first PWA. Research across all four areas converges on a single clear approach: build a new single-page capture flow that reuses the existing offline mutation infrastructure, avoids reusing the existing multi-step wizard, and extends the IndexedDB schema with one new store for photo blobs. The existing stack needs zero new npm dependencies — every required capability (camera capture, image compression, offline queueing, form persistence, haptic feedback) is already installed and working. The primary work is integration, new components, and a minimal backend schema change.

The most important architectural decision is to keep the entire capture session on a single route. iOS PWA camera permission handling requires this — navigating between pages drops the permission grant and triggers re-prompts mid-session. The second key decision is treating photos as a separate pipeline from item mutations: items sync first (text data via the existing mutation queue), then photos upload using the resolved real server ID. This separation is already how the existing wizard works, and quick capture must follow the same pattern while adding a new IndexedDB store to bridge the offline photo storage gap.

The highest-risk area is the photo upload pipeline. The system already has two separate photo mechanisms (service worker fetch intercept + application-level mutation queue), and quick capture must add a third lifecycle (photos captured before items exist on server). The risk of these diverging into duplicate uploads, lost photos, or wrong-item associations is real and must be addressed with explicit architectural decisions before implementation starts. Every other risk — SKU collisions, iOS storage eviction, batch state loss — has clear mitigation strategies documented in the research.

---

## Key Findings

### Recommended Stack

No new packages are required. The existing stack covers every quick-capture requirement. Key building blocks already in place: `InlinePhotoCapture` (camera-first capture with compression), `useOfflineMutation` (IndexedDB-queued item creation with idempotency), `useFormDraft` (draft persistence), `idb` v8 (typed IndexedDB wrapper), `uuid` v13 (UUIDv7 for session IDs), `ios-haptics` (haptic feedback), `motion` (animations), and `react-hook-form` + `zod` for form validation.

What must be built (not installed): a `quickCapturePhotos` IndexedDB store (DB version bump from 4 to 5), a `BatchSessionContext` for sticky location/category settings, a `useQuickCaptureSKU` hook, and a dedicated `QuickCapturePage` component. On the backend, one migration adds a `needs_review` boolean column to `warehouse.items`, with corresponding entity, handler, and sqlc query updates.

See `.planning/research/STACK.md` for full integration point analysis, what to build vs. install, and alternatives considered.

**Core technologies (all existing):**
- `idb` v8.0.3: Extend schema to v5 with new `quickCapturePhotos` object store for offline blob storage
- `useOfflineMutation`: Reuse as-is for item creates — already handles idempotency keys, optimistic writes, and SyncManager integration
- `InlinePhotoCapture`: Reuse as-is — handles `capture="environment"`, compression, preview URLs
- `useFormDraft`: Reuse for batch session state crash recovery
- `uuid` v13: UUIDv7 for capture session IDs and photo store keys
- `ios-haptics` + `navigator.vibrate`: Reuse existing haptic patterns on save confirmation
- `react-hook-form` + `zod`: Minimal form schema (name required, SKU auto-generated)

**What NOT to add:**
- Any camera/video capture library — native `<input capture>` already works, tested in v1.3
- `zustand` / `jotai` — project pattern is React Context; one new context for batch sessions is correct granularity
- `browser-image-compression` — `compressImage()` in `lib/utils/image.ts` already handles this
- A second IndexedDB wrapper — `idb` v8 is the project standard

### Expected Features

The save-and-next loop is the central feature. Every other feature either enables it or extends it. Build the loop first, then layer on differentiators.

See `.planning/research/FEATURES.md` for the full feature landscape with dependency graph, complexity ratings, and MVP recommendation.

**Must have (table stakes):**
- Camera-first entry point — new page at `/dashboard/items/quick-capture`, camera triggers on mount; no intermediate screens
- Auto-generated SKU — client-side `QC-{timestamp_base36}-{random4}` pattern; SKU required by backend but user must never type one during rapid capture
- Minimal single-screen form — photo + name only; all other fields deferred
- Save-and-next loop — on save: queue mutation, clear form, increment counter, re-trigger camera; no page navigation
- Item counter — session progress display ("5 items captured")
- Offline support — wire through `useOfflineMutation`; existing photo upload queue handles network retry
- FAB integration — add "Quick Capture" action to existing `useFABActions` radial menu

**Should have (differentiators):**
- Sticky batch settings — set location + category once, apply to all items in session; eliminates the most repetitive field selection in bulk entry
- Batch settings header bar — persistent collapsible bar showing current context with tap-to-change
- "Needs review" flag — explicit `needs_review BOOLEAN DEFAULT false` column; distinguishes quick-captured items from intentionally minimal items
- "Needs review" filter chip on items list — enables the "capture now, detail later" desktop completion workflow
- Session summary — end-of-session screen listing captured items with edit links
- Haptic feedback on save — light tap on each successful save

**Defer (v2+):**
- Multi-photo per item — adds UX complexity to the capture loop; users can add photos later via edit wizard
- Location/inventory auto-creation — creates cross-entity sync dependency complexity; defer to Phase 2 of the quick capture feature
- AI image categorization — high complexity, unreliable accuracy for diverse home goods; separate milestone
- Batch editing of captured items — build on top of "needs review" filter in a future milestone
- Duplicate detection during capture — interrupts flow; handle during desktop review session

### Architecture Approach

Quick capture is a new frontend flow that reuses existing backend APIs with a minimal schema addition. It is not a separate system. The critical design constraint is that `CreateItemWizard` calls `itemsApi.create()` directly (fails offline), so quick capture must build a separate single-screen component that uses `useOfflineMutation` instead. Photos cannot be included in mutation payloads (JSON pipeline, not multipart) so they must be stored in a new `quickCapturePhotos` IndexedDB store and uploaded after item sync resolves the temp ID to a real server ID. This requires modifying `SyncManager` to add a photo-chaining phase after the entity sync loop.

See `.planning/research/ARCHITECTURE.md` for component boundaries, full data flow, code examples, and a 7-phase build order.

**Major components:**
1. `QuickCapturePage` (NEW) — full-screen single-route capture flow; must never navigate away during active session; state machine: READY -> CAPTURING -> NAMING -> SAVING -> READY
2. `useBatchSettings` (NEW) — sticky location/category in `sessionStorage`; ephemeral by design (dies on tab close); offline data available via IndexedDB cache
3. `quickCapturePhotos` IndexedDB store (NEW) — bridges offline photo storage gap; blobs keyed by item idempotency key with `tempItemId` index; DB version bump from 4 to 5
4. `SyncManager.processQueuedPhotos()` (MODIFY) — new phase after entity sync loop; resolves temp IDs to real server IDs, uploads queued photos, handles partial failures and retries
5. Backend `needs_review` field (MODIFY) — `BOOLEAN DEFAULT false` on `warehouse.items`; filter parameter on list endpoint; set on item create via quick capture; cleared on item update via edit wizard

**Key patterns to follow:**
- Single-route capture — never use `router.push()` during active session; use drawers/sheets for review views
- Photos separate from mutations — text data via mutation queue, blobs via `quickCapturePhotos` store, upload chained after item sync
- Client-side SKU with collision recovery — `QC-{ts}-{rand}` format; SyncManager handles 409 via SKU regeneration and retry
- Backend deployed first for schema changes — `needs_review` column added before frontend sends the field

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full analysis with detection strategies and phase-specific warnings.

1. **Dual photo upload queues diverging** — Two existing photo mechanisms (SW fetch intercept + application mutation queue) must not conflict with quick capture's pre-item photos. Store quick-capture photo blobs in a new store in `hws-offline-v1` (not the SW's separate `PhotoUploadQueue` DB). Process photos only after parent item syncs. Test by creating 5 items offline, going online, verifying exactly 5 items with exactly 1 photo each — any duplicates or mismatches indicate queue divergence.

2. **Photo-to-item association lost during sync** — Photos reference temp UUIDv7 IDs; uploads must use resolved real server IDs. Extend `SyncManager.resolvedIds` map persistence across sync runs (or store mapping in IndexedDB). Process photos only after item sync completes. Test: create 3 items with photos offline, go online, verify all photos present on server with zero 404 errors.

3. **iOS IndexedDB quota exhaustion** — Camera photos compressed to ~200-400KB each; 50 items = ~10-20MB, within quota but fragile on low-storage devices. Compress more aggressively than existing defaults (target 0.6-0.7 quality, 1200px max). Show storage estimate in UI. Upload eagerly when online, do not wait for session end. Cap at ~100 queued photos with actionable error message.

4. **Auto-SKU collisions in multi-device households** — Two family members offline simultaneously generate colliding SKUs on sync. Use format `QC-{timestamp_base36}-{random4}` for low collision probability. Add 409 conflict handling to SyncManager that auto-regenerates SKU and retries.

5. **iOS camera permission loss on route navigation** — iOS PWA drops camera permission grants on page navigation. Keep entire quick capture flow on ONE route. Use drawer/sheet overlays for review views, never `router.push()` during active session. Validated behavior from barcode scanner implementation (v1.3).

---

## Implications for Roadmap

Based on combined research, the feature has a natural 7-phase build order where each phase produces a testable increment and respects the dependency graph from FEATURES.md.

### Phase 1: Backend Schema and API

**Rationale:** The `needs_review` column and backend filter are independent of frontend work and must be deployed before frontend sends the new field. Schema changes in offline-first systems must be deployed backend-first to avoid sync failures during rolling updates. This phase has no frontend dependencies and unblocks all later work.
**Delivers:** `needs_review BOOLEAN DEFAULT false` column on `warehouse.items`; `?needs_review=true` filter on list endpoint; field in create/update request bodies and responses; sqlc query regeneration
**Addresses:** "Needs review" flag feature, completion workflow foundation
**Avoids:** Pitfall 7 (schema change breaking existing sync) — deploy backend before frontend sends the new field; column is nullable with default so old clients are unaffected

### Phase 2: Auto-SKU and Batch Settings Hooks

**Rationale:** Pure frontend logic with no backend dependency. Can be built and unit-tested in isolation before any UI exists. These hooks are direct inputs to the capture UI — establish them first so the UI is built against real implementations, not mocks.
**Delivers:** `useQuickCaptureSKU` hook (`QC-{ts}-{rand}` generation with collision-resistant format); `useBatchSettings` hook (sessionStorage persistence with correct ephemeral semantics)
**Addresses:** Auto-generated SKU (table stakes), sticky batch settings (differentiator)
**Avoids:** Pitfall 3 (SKU collisions) — timestamp+random format with correct entropy established early; collision recovery strategy designed before SyncManager work begins

### Phase 3: Quick Capture Photo Store (IndexedDB v5)

**Rationale:** The photo store is a dependency for both the capture UI (Phase 4) and the SyncManager extension (Phase 5). Build the data layer first, separately from both consumers. This is where the dual-queue architecture decision is locked in — the store design must explicitly prevent queue divergence before any upload logic is written.
**Delivers:** `quickCapturePhotos` store added to `OfflineDBSchema`; DB version bumped 4 -> 5 in `offline-db.ts`; CRUD helpers (`storeQuickCapturePhoto`, `getPhotosForItem`, `deletePhoto`); compression parameters tuned for mobile storage constraints
**Addresses:** Offline photo storage for pre-sync items
**Avoids:** Pitfall 1 (dual queues) — store lives in `hws-offline-v1`, design explicitly separates concerns from SW `PhotoUploadQueue`; Pitfall 2 (quota exhaustion) — aggressive compression parameters (0.6-0.7 quality, 1200px max) established here; Pitfall 4 (temp ID mapping) — store schema includes `tempItemId` index for later resolution

### Phase 4: Quick Capture UI

**Rationale:** With hooks (Phase 2) and storage (Phase 3) in place, the UI can be built with all dependencies available and tested against real implementations. The single-route constraint must be enforced from the first line of code — retrofitting it later would require significant rework.
**Delivers:** `QuickCapturePage` at `/dashboard/items/quick-capture`; `QuickCaptureForm` with READY -> CAPTURING -> NAMING -> SAVING -> READY state machine; `BatchSettingsBar` showing sticky context; `CaptureCounter` with session progress; FAB integration via `useFABActions`; haptic feedback on save; batch session state persisted to IndexedDB on every change
**Addresses:** All Phase 1 MVP features from FEATURES.md — camera-first entry, minimal form, save-and-next loop, item counter, offline support wiring, FAB integration, batch settings header
**Avoids:** Pitfall 6 (iOS permission loss) — single-route architecture enforced; Pitfall 5 (session state loss on iOS kill) — batch state persisted to IndexedDB on every change not just debounced; Pitfall 8 (IndexedDB transaction overload) — batch all writes for one capture into a single transaction; Pitfall 10 (object URL memory leaks) — revoke URLs immediately after IndexedDB write; Pitfall 12 (compression blocking main thread) — consider OffscreenCanvas

### Phase 5: SyncManager Photo Chaining

**Rationale:** This is the riskiest phase. Modifying `SyncManager` touches the core sync engine used by all entities. It must come after the photo store (Phase 3) is stable and the capture UI (Phase 4) is generating real data to test with. Integration tests here verify the full offline-to-online cycle.
**Delivers:** `SyncManager.uploadQueuedPhotos()` method; `processQueuedPhotos()` phase after entity sync loop (not inline, to avoid blocking other mutations); partial failure handling with `"failed"` status and retry on next sync cycle; `PHOTO_UPLOAD_PROGRESS` and `PHOTO_UPLOAD_COMPLETE` broadcast events for `PendingUploadsIndicator`
**Addresses:** Photo-to-item sync (Pitfall 4 resolution), complete offline photo upload pipeline
**Avoids:** Pitfall 1 (dual queues) — photos processed entirely through application-level pipeline; Pitfall 4 (temp ID mapping) — resolved IDs from item sync passed directly to photo upload phase

### Phase 6: Needs Review UI

**Rationale:** Depends on Phase 1 (backend field exists) and Phase 4 (quick capture sets the flag on item create). The completion workflow is last because it builds on all capture infrastructure and is purely additive — it can always be deferred without blocking the capture workflow itself.
**Delivers:** `needs_review` field in frontend `Item`, `ItemCreate`, `ItemUpdate` types; "Needs Review" filter chip in items list `FilterBar`; "Needs Review" badge on item detail page with "Mark as Reviewed" action (PATCH `needs_review: false`); items created via quick capture automatically set `needs_review: true`; Fuse.js search index updated after each quick-capture write
**Addresses:** "Needs review" filter chip (differentiator), session summary, completion workflow
**Avoids:** Pitfall 9 (search index staleness) — Fuse.js index incremental update on each quick-capture item write

### Phase 7: Polish and Edge Cases

**Rationale:** Edge cases and non-happy-path scenarios are handled last when the happy path is stable and testable end-to-end. These are improvements to an already-working feature, not prerequisites for it.
**Delivers:** Storage quota warning UI (check `navigator.storage.estimate()` before each capture); SKU 409 collision recovery in SyncManager (auto-regenerate SKU + retry); photo compression moved off main thread (Web Worker or OffscreenCanvas); storage estimate display in capture UI; i18n keys for all new strings in `en.json`, `et.json`, `ru.json`; E2E Playwright tests for full offline capture -> sync -> photo upload flow; haptic parameter tuning (subtle for batch mode, not fatiguing at 30+ items)
**Addresses:** All minor pitfalls (10, 11, 12, 13); production readiness
**Avoids:** Pitfall 3 (SKU collision handling complete); Pitfall 12 (compression blocking main thread)

### Phase Ordering Rationale

- Backend schema is deployed first so it is ready before any frontend sends new fields — critical for offline-first systems where client/server versions diverge during rollout
- Hook and storage layers (Phases 2-3) precede the UI (Phase 4) — avoids building UI against mocked implementations and ensures the dual-queue architecture decision is locked in before any upload logic is written
- SyncManager modification (Phase 5) comes after the photo store is stable and real capture data exists to test against — the sync engine is too critical to modify speculatively
- "Needs review" UI (Phase 6) is last because it is purely additive — deferring it does not block the capture workflow
- The dependency graph from FEATURES.md directly maps to this ordering: the save-and-next loop (Phase 4 core) is the central node; DB migration (Phase 1) and hooks (Phase 2) enable it; photo chaining (Phase 5) and review UI (Phase 6) extend it

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (SyncManager Photo Chaining):** Complex async coordination between entity sync and photo upload; failure modes for partial batches (some photos succeed, some fail mid-batch) need careful design; the `resolvedIds` map persistence behavior across page reloads needs code verification before finalizing the chaining design
- **Phase 3 (IndexedDB v5 Schema):** Storage budget calculations assume specific compressed photo sizes; validate on real iOS devices before committing to compression parameters — simulator behavior does not match real device behavior

Phases with standard patterns (skip research-phase):
- **Phase 1 (Backend Schema):** Standard Go migration + sqlc regen pattern; well-established in existing codebase; nullable column with default is a single-line migration
- **Phase 2 (Hooks):** Pure TypeScript utilities with no external dependencies; deterministic logic; fully unit-testable
- **Phase 4 (Quick Capture UI):** All component patterns (camera input, offline mutation, haptic feedback) already exist in the codebase; integration work, not new patterns; the `useFABActions` extension is a one-liner
- **Phase 6 (Needs Review UI):** Standard filter chip addition to existing `FilterBar` using `useFilters` hook patterns; `needs_review` badge follows existing archived/pending badge patterns
- **Phase 7 (Polish):** Incremental improvements with no architectural decisions; i18n follows established translation key patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Full codebase analysis; all existing packages verified for the required capabilities; zero new dependencies confirmed with specific code references |
| Features | HIGH | Competitor analysis (Everspruce, Sortly) plus direct codebase gap analysis; existing infrastructure significantly reduces uncertainty; dependency graph explicitly traced |
| Architecture | HIGH | Based on thorough code reading of `SyncManager`, `useOfflineMutation`, `offline-db.ts`, `sw.ts`, item entity; integration points precisely identified with file-level specificity |
| Pitfalls | HIGH | Grounded in actual codebase structure (two existing photo queues, iOS PWA permission behavior from v1.3 barcode scanner, IDB schema v4 details); not generic advice |

**Overall confidence:** HIGH

### Gaps to Address

- **`SyncManager.resolvedIds` persistence across page reloads:** The current implementation's behavior needs code verification before Phase 5 design is finalized. If `resolvedIds` is in-memory only (not persisted to IndexedDB), photos for items created and synced across a page reload will fail to upload because the temp-to-real ID mapping is lost. This is the single largest unknown in the architecture and affects Phase 5 design significantly — investigate early in Phase 5 planning.

- **Backend SKU auto-assignment pattern:** The import worker already uses `AUTO-{name}-{timestamp}` SKU generation server-side. Research whether the backend can be extended to accept `sku: null` or `sku: "AUTO"` on item create, assigning the real SKU server-side. This would eliminate client-side SKU collision risk entirely. Evaluate during Phase 1 planning as an alternative to client-side generation + 409 recovery.

- **iOS storage eviction under real device conditions:** Quota behavior on low-storage iOS devices requires physical device testing before Phase 3 compression parameters are locked in. Simulator behavior does not match. Schedule a real device test during Phase 3 to validate the ~200-400KB per photo target.

---

## Sources

### Primary (HIGH confidence — codebase analysis)

- `frontend/lib/db/offline-db.ts` — IndexedDB schema at v4, upgrade callback pattern, persistent storage request
- `frontend/lib/hooks/use-offline-mutation.ts` — offline create flow, idempotency key lifecycle, optimistic write pattern
- `frontend/lib/sync/sync-manager.ts` — entity sync ordering, dependency resolution, ID mapping, queue processing loop
- `frontend/lib/sync/mutation-queue.ts` — queue operations, retry config, entity type handling
- `frontend/components/forms/inline-photo-capture.tsx` — camera capture, compression, `<input capture="environment">` behavior
- `frontend/lib/utils/image.ts` — canvas-based compression (1920px max, 0.85 quality)
- `frontend/app/sw.ts` — service worker `PhotoUploadQueue` (separate IDB database, fetch intercept)
- `frontend/components/items/create-item-wizard/index.tsx` — direct API call (confirms offline limitation)
- `frontend/lib/hooks/use-fab-actions.tsx` — route-aware FAB action patterns
- `frontend/lib/db/types.ts` — OfflineDBSchema type, current 10 stores, mutation queue types
- `backend/internal/domain/warehouse/item/entity.go` — Item domain model, all fields
- `backend/internal/domain/warehouse/item/service.go` — SKU uniqueness validation, `CreateInput` struct
- `backend/db/schema.sql` — `warehouse.items` table definition

### Secondary (HIGH confidence — product research)

- [Everspruce batch capture mode](https://everspruceapp.com/capturing-home-inventory-with-multiple-photos/) — photo-first batch capture, "add details later" workflow; market leader pattern
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) — iOS IndexedDB eviction behavior; 7-day eviction window
- [MDN Storage Quotas and Eviction Criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — quota limits by browser and platform
- [PWA iOS Limitations Guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — camera permission behavior in standalone mode
- [RxDB IndexedDB Max Storage Size](https://rxdb.info/articles/indexeddb-max-storage-limit.html) — practical quota limits and eviction behavior

---

*Research completed: 2026-02-27*
*Ready for roadmap: yes*
