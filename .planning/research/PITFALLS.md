# Domain Pitfalls: Quick Capture (v1.9)

**Domain:** Adding rapid camera-first item capture with offline photo storage to existing PWA inventory system
**Researched:** 2026-02-27
**Confidence:** HIGH
**Scope:** Pitfalls specific to adding quick-capture features to the Home Warehouse System

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major regressions in existing functionality.

### Pitfall 1: Two Separate Photo Upload Queues Diverging

**What goes wrong:** The system already has a `PhotoUploadQueue` IndexedDB database in the service worker (`sw.ts` lines 276-342) that intercepts failed POST requests to `/photos` and queues them. Quick capture needs to store photos in IndexedDB BEFORE any upload attempt (since items don't exist on server yet). If you create a second queuing mechanism without coordinating with the existing one, you get duplicate uploads, lost photos, or race conditions where both queues try to upload the same photo.

**Why it happens:** The existing SW-based queue is request-level (intercepts fetch failures), while quick capture needs an application-level queue (photos captured before the item even has a server ID). These are fundamentally different lifecycles but target the same endpoint.

**Consequences:** Duplicate photos on items. Photos uploaded to wrong items. Upload count indicators (`PendingUploadsIndicator`) showing wrong numbers. Lost photos when both queues process simultaneously.

**Prevention:**
- Unify into a single photo queue in the main IndexedDB (`hws-offline-v1`) as a new store, NOT the separate `PhotoUploadQueue` database
- Quick capture photos get queued with a reference to the item's idempotency key (temp ID from UUIDv7)
- Photo uploads happen AFTER the item mutation syncs successfully (use `dependsOn` mechanism already in SyncManager)
- Deprecate or bypass the SW-level photo queue for items created via quick capture
- The SW intercept remains as fallback only for the existing full item-creation flow

**Detection:** Test by creating 5 items offline with photos, going online, and verifying exactly 5 items with exactly 1 photo each appear. Any duplicates or mismatches indicate queue divergence.

### Pitfall 2: IndexedDB Blob Storage Exhausting Quota on iOS

**What goes wrong:** Each camera photo from a modern phone is 3-8MB. Even after compression to ~1MB, capturing 50 items in a batch session stores 50MB+ of blobs in IndexedDB. iOS Safari grants up to 500MB but can evict data aggressively -- if the PWA hasn't been interacted with for 7 days, or if the device is low on storage, Safari silently deletes IndexedDB data.

**Why it happens:** The existing system explicitly avoids storing photos in IndexedDB (PROJECT.md: "No heavy assets: Photos, PDFs, attachments excluded from proactive sync"). Quick capture inverts this by requiring blob storage as a core path.

**Consequences:** Silent data loss. User captures 30 items, comes back later, photos are gone. No error message because eviction is silent. Even worse: item mutations succeed but photos are evicted before upload, creating items with no photos -- defeating the entire purpose of camera-first capture.

**Prevention:**
- Compress aggressively before IndexedDB storage (target 200-400KB per photo using lower quality 0.6-0.7 and max 1200px dimension, not the existing 1920px/0.85)
- Store thumbnail-quality previews in IndexedDB, queue full-res upload immediately when online
- Show storage usage estimate in the capture UI (use `navigator.storage.estimate()`)
- Set a hard cap on queued photos (e.g., 100 photos max) with clear warning
- Request persistent storage (`navigator.storage.persist()`) -- already called in `offline-db.ts` but verify it succeeds on the capture screen
- Upload photos eagerly when online, even mid-batch, don't wait for session end
- Monitor `QuotaExceededError` and show actionable error ("Connect to WiFi to upload queued photos before capturing more")

**Detection:** Test on a real iOS device (not simulator) with limited storage. Capture 50+ items, lock phone for 10 minutes, return and verify all photos still present.

### Pitfall 3: Auto-SKU Collisions When Multiple Devices Are Offline

**What goes wrong:** The backend requires `UNIQUE (workspace_id, sku)` on the items table. If SKUs are auto-generated client-side, two family members capturing items on separate phones offline will generate SKUs that look unique locally but collide when synced. The backend's `ErrSKUTaken` error (409 conflict) causes item creation to fail.

**Why it happens:** SKU generation is currently server-side (item.service.go `Create` method checks `SKUExists`). Moving auto-generation to the client for offline support means losing the uniqueness guarantee.

**Consequences:** Sync failures for items created offline. Items stuck in "failed" state in mutation queue. User frustration when items they thought were saved actually weren't.

**Prevention:**
- Generate SKUs with a format that includes device-unique entropy: `QC-{timestamp_base36}-{random4}` (e.g., `QC-M3KA-7F2X`)
- Include the UUIDv7 idempotency key's first 8 chars as part of the SKU to guarantee global uniqueness
- Make the backend accept a `needs_sku_assignment: true` flag where the server assigns the final SKU on sync, and the client SKU is just a placeholder
- Best approach: let the server assign the real SKU on create, send items without a client-generated SKU, and have the backend auto-generate one (the import worker already handles `items_auto_sku.csv` -- this pattern exists)
- If using client-side SKU: handle 409 gracefully by auto-regenerating and retrying (add to SyncManager's conflict handling)

**Detection:** Test with two browser instances both offline, each creating 10 items, then bringing both online simultaneously.

### Pitfall 4: Photo-to-Item Association Lost During Offline Sync

**What goes wrong:** Quick capture creates an item with a temporary UUIDv7 ID. Photos are associated with this temp ID in IndexedDB. When the item syncs, the server returns a real ID. If photos are uploaded using the temp ID in the URL path (`/items/{tempId}/photos`), the upload fails with 404 because the server doesn't know the temp ID.

**Why it happens:** The existing `SyncManager.resolvePayloadIds()` only resolves `_id` suffixed fields in mutation payloads. Photo uploads use URL paths, not payloads. The photo queue doesn't participate in the `resolvedIds` map.

**Consequences:** All photos for offline-created items fail to upload. Items appear on server without photos.

**Prevention:**
- Photo upload queue entries must store the item's idempotency key, not a URL
- When processing the photo queue, look up the resolved real ID from the idempotency key mapping (extend `resolvedIds` map to persist across sync runs, or store the mapping in IndexedDB)
- Process photos ONLY after their parent item has been synced (use `dependsOn` in mutation queue)
- Store the temp-to-real ID mapping in a new IndexedDB store or in syncMeta so it survives page reloads
- Alternatively: send photos as part of the item create payload (multipart) rather than as separate requests -- this avoids the mapping problem entirely but requires backend changes

**Detection:** Create 3 items with photos while offline. Go online. Verify all 3 items have their photos on the server. Check for 404 errors in the network tab.

---

## Moderate Pitfalls

### Pitfall 5: Batch Session State Lost on iOS PWA Kill

**What goes wrong:** User is mid-batch (location=Garage, category=Tools, 12 items captured). iOS kills the PWA process (memory pressure, user switches apps for too long). When they reopen, the batch session context (sticky location, sticky category, item count) is gone.

**Why it happens:** React state doesn't survive process kill. The existing `useFormDraft` hook saves form data to IndexedDB with 1-second debounce, but batch session metadata (which location, which category, batch mode active) isn't a form -- it's session state.

**Prevention:**
- Persist batch session state to IndexedDB immediately on each change (not debounced):
  - `batchSessionId`, `stickyLocationId`, `stickyCategoryId`, `itemsCapturedCount`, `isActive`, `startedAt`
- On app mount, check for active batch session and offer "Resume batch?" prompt
- Store in the existing `formDrafts` store with a well-known key like `quickCapture-batch-session`
- Use `visibilitychange` event to force-save session state when app goes to background

**Detection:** Start a batch on iOS, switch to another app for 30 seconds, force-kill the PWA from app switcher, reopen. Verify batch context is recoverable.

### Pitfall 6: Camera Permission Re-prompt on iOS PWA Navigation

**What goes wrong:** iOS PWAs lose camera permission grants when the page navigates. The existing system handles this with "Single-page scan flow" (PROJECT.md key decision). But quick capture might involve navigating away to view captured items, then returning to capture more -- each return triggers a new permission prompt.

**Why it happens:** iOS Safari in standalone mode (PWA) treats each page load as a new permission context. The existing barcode scanner stays on one page. Quick capture's "save and continue" flow might cause a route change.

**Prevention:**
- Keep the entire quick capture flow on a SINGLE route (e.g., `/dashboard/quick-capture`)
- Use client-side state/tabs to show "capture" vs "review" views without route changes
- Never use `router.push()` during active capture session
- If user needs to review items, use a sheet/drawer overlay, not a page navigation
- The capture input (`<input capture="environment">`) is less affected than `getUserMedia()` but still test thoroughly on real iOS devices

**Detection:** On iOS PWA, capture a photo, view the captured items list, return to capture another. If a permission dialog appears on the second capture, the navigation is breaking the permission context.

### Pitfall 7: "Needs Details" Schema Change Breaking Existing Sync

**What goes wrong:** Adding a `needs_details` boolean column to the items table requires a migration. If the frontend sends `needs_details: true` in offline mutations but the backend hasn't been updated yet (stale deployment, rolling update), the mutation fails. Worse: existing offline mutations queued before the migration don't include the field, so sync behavior diverges.

**Why it happens:** Schema changes in offline-first systems are inherently dangerous because client and server can be on different schema versions.

**Consequences:** Sync failures during rollout. Items created in quick capture mode fail to sync if they include `needs_details` and the backend hasn't migrated yet.

**Prevention:**
- Make `needs_details` column nullable with DEFAULT false in the migration -- existing items and old clients are unaffected
- Backend: accept and ignore unknown fields in the create/update payload (the Go handler already uses struct binding which silently ignores extra fields)
- Frontend: only send `needs_details` field if the feature is enabled, not in every item mutation
- Add the column to the backend first, deploy backend, then deploy frontend -- never the reverse
- The field should be backend-optional: items created without it default to `false`

**Detection:** Queue an item mutation offline with the old frontend, update the frontend, queue another mutation with the new frontend, go online. Both should sync successfully.

### Pitfall 8: Rapid Sequential Saves Overwhelming IndexedDB Transactions

**What goes wrong:** User captures items rapidly (one every 3-5 seconds). Each capture triggers: (1) item mutation queue write, (2) optimistic item store write, (3) photo blob write, (4) batch session state update, (5) form draft save. That's 5+ IndexedDB transactions in quick succession. IndexedDB transactions are serialized per database -- if one blocks, they all queue up. UI freezes between captures.

**Why it happens:** IndexedDB has good throughput for reads but writes are serialized per object store. The existing system handles single mutations fine, but rapid-fire batch writes are a different load pattern.

**Consequences:** Laggy capture experience. "Save" button appears stuck. User taps multiple times creating duplicate items. On slower devices (older iPhones), the UI can freeze for 1-2 seconds per item.

**Prevention:**
- Batch all writes for a single capture into ONE IndexedDB transaction (item + photo + session update in a single `readwrite` transaction)
- Use the existing `putAll` batch pattern from `offline-db.ts` but extended to cross-store transactions
- Debounce the batch session counter update
- Show immediate visual feedback (haptic + animation) BEFORE the IndexedDB write completes
- Consider storing photos as `ArrayBuffer` instead of `Blob` for faster writes (blobs can trigger additional I/O)
- Test on a real low-end device (iPhone SE 2, budget Android)

**Detection:** Profile with Chrome DevTools Performance tab. Capture 10 items in rapid succession (3-second intervals). Check for long tasks (>50ms) related to IndexedDB.

### Pitfall 9: Existing Offline Search Index Not Updating with Quick-Capture Items

**What goes wrong:** The system uses Fuse.js for offline search with indices built from the IndexedDB items store. Quick-capture items are written to IndexedDB with `_pending: true` marker. If the Fuse.js index isn't rebuilt after each capture, newly created items won't appear in search, making the "review what I just captured" use case broken.

**Why it happens:** The existing search index is built on app load or data sync. Quick capture adds items locally without triggering a full sync cycle.

**Prevention:**
- After each quick-capture item write, add the new item to the existing Fuse.js collection (Fuse.js supports `collection.add()` for incremental updates)
- Or: for the quick capture review screen, query IndexedDB directly rather than going through the Fuse.js search
- Ensure the items store query in `use-offline-data.ts` includes `_pending` items

**Detection:** Capture 3 items offline, then use the search bar to find one by name. If it doesn't appear, the index isn't updating.

---

## Minor Pitfalls

### Pitfall 10: Object URL Memory Leaks in Rapid Capture

**What goes wrong:** Each photo preview creates an object URL via `URL.createObjectURL()`. In rapid capture, if these aren't revoked promptly, memory usage climbs. After 50+ captures, the PWA can become sluggish or crash on memory-constrained mobile devices.

**Prevention:**
- Revoke object URLs immediately after the photo is written to IndexedDB as a blob
- For the capture preview (the brief flash showing what was just captured), use a very short-lived URL and revoke after 2 seconds
- Don't hold preview URLs in React state beyond the current capture

### Pitfall 11: UUIDv7 Ordering Assumption in Quick Capture

**What goes wrong:** UUIDv7 includes a timestamp component, making IDs monotonically increasing. If two items are captured in the same millisecond (fast tapper), the random component ensures uniqueness but the ordering might not match user expectation. More importantly, if the client clock is wrong, UUIDv7s will sort incorrectly server-side.

**Prevention:**
- Don't rely on UUIDv7 ordering for display order of captured items
- Maintain a separate `captureOrder` integer in the batch session
- The existing UUIDv7 generation (`shared.NewUUID()`) is fine for uniqueness

### Pitfall 12: Compression Blocking the Main Thread

**What goes wrong:** The existing `compressImage()` function in `image.ts` uses `canvas.toBlob()` which runs on the main thread. During rapid capture, compressing a 5MB photo while the user is trying to capture the next item causes jank.

**Prevention:**
- Move compression to a Web Worker (create `photo-compress.worker.ts`)
- Or use `createImageBitmap()` + `OffscreenCanvas` for off-main-thread compression
- At minimum: don't block the "next capture" action on compression completing -- queue compression and let it happen in the background

### Pitfall 13: Haptic Feedback Fatigue in Batch Mode

**What goes wrong:** The existing system uses haptic feedback on FAB press and scan detection. In rapid capture mode, haptic firing on every single save becomes annoying rather than helpful.

**Prevention:**
- Use subtle haptic (light tap) for rapid saves, not the full pattern used for barcode scans
- Consider disabling haptic after the 5th consecutive capture in a batch, or making it configurable
- Test with real users -- what feels good for one action feels terrible at 30 repetitions

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Camera-first flow UI | Pitfall 6 (iOS permission loss on navigation) | Keep capture on single route, use overlays for review |
| Offline photo storage | Pitfall 2 (quota exhaustion), Pitfall 1 (dual queues) | Aggressive compression, unified queue in main DB |
| Auto-SKU generation | Pitfall 3 (collision), Pitfall 7 (schema change) | Server-assigned SKU on sync, nullable needs_details column |
| Batch session state | Pitfall 5 (state loss on kill), Pitfall 8 (transaction overload) | IndexedDB persistence, batched transactions |
| Photo-item sync | Pitfall 4 (temp ID to real ID mapping) | Persist resolvedIds map, process photos after item sync |
| "Needs details" filter | Pitfall 7 (migration timing), Pitfall 9 (search index) | Deploy backend first, incremental Fuse.js updates |
| Rapid sequential capture | Pitfall 8, 10, 12 (performance) | Batched writes, revoke URLs, off-thread compression |

---

## Integration Risk Summary

The highest-risk integration point is the **photo upload pipeline** (Pitfalls 1, 2, 4). The existing system has two separate mechanisms for photo handling:
1. Service worker fetch intercept (`sw.ts`) with its own `PhotoUploadQueue` IndexedDB
2. Application-level mutation queue (`hws-offline-v1` / `mutationQueue` store)

Quick capture must bridge both without breaking either. The recommended approach is to handle quick-capture photos entirely through the application-level system (extending `mutationQueue` or adding a `photoQueue` store to `hws-offline-v1`), keeping the SW intercept as a legacy fallback for the existing full item-creation wizard.

## Sources

- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [MDN Storage Quotas and Eviction Criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [RxDB IndexedDB Max Storage Size Limit](https://rxdb.info/articles/indexeddb-max-storage-limit.html)
- [PWA iOS Limitations and Safari Support Guide](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- Codebase analysis: `sw.ts`, `offline-db.ts`, `sync-manager.ts`, `use-offline-mutation.ts`, `inline-photo-capture.tsx`, `item/service.go`, `001_initial_schema.sql`
