# Phase 46: Photo Sync Pipeline - Research

**Researched:** 2026-03-14
**Domain:** Offline photo upload after item sync, pending item indicator, retry on partial failure
**Confidence:** HIGH

## Summary

Phase 46 is the final piece of the v1.9 offline sync chain: after an offline-captured item syncs to the server, its photos must upload automatically using the resolved real server ID. The heavy lifting was done in Phase 44 (IndexedDB `quickCapturePhotos` store, `useCapturePhotos` hook) and the core upload logic was already implemented in `frontend/lib/sync/capture-photo-uploader.ts` and wired into `OfflineContext`. Phase 46 is therefore much narrower than expected.

**What has already been built (before Phase 46):**
- `frontend/lib/sync/capture-photo-uploader.ts` — `handleItemSynced()` reads photos from `quickCapturePhotos` by `tempItemId`, uploads them via `itemPhotosApi.uploadItemPhoto()` using the resolved server ID, then deletes them from IndexedDB. Handles partial failures (continues uploading remaining photos on error).
- `frontend/lib/contexts/offline-context.tsx` — Already subscribes to `MUTATION_SYNCED` events and calls `handleItemSynced()` for item creates. The chained photo upload is already wired.
- `frontend/app/.../items/page.tsx` — Already shows pending indicator: amber background row, pulsing Cloud icon badge reading "Pending", blocks navigation to item detail, and clears the optimistic item from UI when `MUTATION_SYNCED` fires.
- `frontend/lib/sync/__tests__/capture-photo-uploader.test.ts` — Full unit test coverage for `handleItemSynced()`.

**What Phase 46 actually needs to deliver (the gap):**
1. **SYNC-03 partial-failure retry**: Photos that fail to upload are currently all-or-nothing deleted from IndexedDB after the upload loop, even if some failed. The cleanup happens unconditionally. On the next sync cycle, there are no photos left to retry — partial failures are silently lost. Fix: mark failed photos with `status: "failed"` instead of deleting them, and retry them on subsequent `MUTATION_SYNCED` or online events.
2. **SYNC-04 pending indicator on offline-captured items**: The items page already has this for items created via the main create dialog. However, quick-capture items added on the quick-capture page need to appear in the items list with the same pending indicator. The optimistic state (`optimisticItems`) only gets populated from the items page's `useOfflineMutation` `onMutate` callback. Quick-capture items mutated on the quick-capture page do NOT add themselves to the items page's state. The fix: on items page mount (and on returning to the items page), load pending creates from IndexedDB via `getPendingCreates("items")` and merge them into `optimisticItems`.
3. **Photo display offline (SYNC-02 is done, but photo preview in list)**: Offline-captured items in the pending state have blobs in IndexedDB but no server-side photo URL. The items list photo column shows a spinner/placeholder for pending items (photo API not called for `_pending` items). This is already correct — no change needed.

**Primary recommendation:** Split into one plan. Task 1: fix `capture-photo-uploader.ts` to mark failed photos as `failed` status and retry them on next upload cycle rather than deleting all. Task 2: fix `items/page.tsx` to load pending creates from IndexedDB on mount (using existing `getPendingCreates` helper) so quick-capture items appear in the list with pending indicator.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-03 | Photos upload automatically after item syncs to server (chained sync) | `handleItemSynced()` in `capture-photo-uploader.ts` already chains upload on `MUTATION_SYNCED`. Gap: partial failures silently lose photos because cleanup is unconditional. Fix: per-photo status tracking — mark failures as `status: "failed"`, retry on next cycle. |
| SYNC-04 | Offline-captured items appear in item list with pending indicator | Items page already renders pending indicator for items added via its own `useOfflineMutation`. Gap: quick-capture items (added from a different page) are not in `optimisticItems`. Fix: load `getPendingCreates("items")` from IndexedDB on mount and merge into the existing `optimisticItems` array. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | IndexedDB typed access for reading/updating `quickCapturePhotos` by status index | Project's IndexedDB standard; `status` index already on the store |
| itemPhotosApi | (internal) | Upload blobs to backend via `POST /workspaces/{id}/items/{id}/photos` | Already used by `capture-photo-uploader.ts` |
| getPendingCreates | (internal) | Load pending item creates from mutation queue IndexedDB | Exported from `use-offline-mutation.ts`; designed for exactly this pattern |
| syncManager | (internal) | Subscribe to `MUTATION_SYNCED` events | Singleton, already used by both offline-context and items page |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (project version) | Unit testing for capture-photo-uploader fix | Test file already exists at `lib/sync/__tests__/capture-photo-uploader.test.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-photo `status: "failed"` for retry tracking | A separate retry queue in IndexedDB | Simpler: the `status` index already exists on `quickCapturePhotos`; using `"failed"` status reuses existing infrastructure with zero schema changes |
| Loading pending creates on items page mount | Subscribing to a cross-page event | Mount-time load is simpler, avoids event bus complexity, and correctly handles page reloads between offline capture and viewing the list |

**Installation:**
```bash
# No new packages to install. Zero new dependencies.
```

## Architecture Patterns

### Current Implementation (Already Working)

```
Offline capture flow:
  QuickCapturePage.handleSave()
    -> useOfflineMutation.mutate()  (queues mutation, writes optimistic item to items store)
    -> useCapturePhotos.storePhoto()  (stores blob in quickCapturePhotos with status="pending")

Online sync flow (already wired):
  SyncManager.processQueue()
    -> processMutation(itemCreate)
    -> MUTATION_SYNCED event { mutation, resolvedId }
  OfflineContext (already subscribes):
    -> handleItemSynced(event, workspaceId)
      -> getPhotosByTempId(tempItemId)  [reads by tempItemId index]
      -> itemPhotosApi.uploadItemPhoto(workspaceId, serverId, file)
      -> deletePhotosByTempId(tempItemId)  [UNCONDITIONAL — the bug]
```

### Gap 1: Partial Failure Retry (SYNC-03)

**Problem:** `deletePhotosByTempId()` runs unconditionally after the upload loop. If photo 1 of 3 fails, all 3 are deleted. Retrying (going online again) has no photos left.

**Fix pattern:** Update status field on each photo, not delete-all:

```typescript
// Source: frontend/lib/sync/capture-photo-uploader.ts (current behavior — needs change)
// CURRENT (buggy): deletes all photos regardless of upload success
await deletePhotosByTempId(tempId);  // unconditional

// FIXED pattern: update status per-photo, only delete uploaded ones
for (const photo of photos) {
  try {
    const file = new File([photo.blob], `capture-${Date.now()}.jpg`, {
      type: photo.blob.type || "image/jpeg",
    });
    await itemPhotosApi.uploadItemPhoto(workspaceId, serverId, file);
    // Delete only successfully uploaded photos
    await db.delete("quickCapturePhotos", photo.id);
    uploaded++;
  } catch (err) {
    console.error(`${TAG} failed to upload photo ${photo.id}:`, err);
    // Mark as failed — leave in IndexedDB for retry
    await db.put("quickCapturePhotos", { ...photo, status: "failed" });
  }
}
```

**Retry trigger:** Photos with `status: "failed"` need a retry mechanism. Options:
1. On next `MUTATION_SYNCED` for the same item (but item is now already synced — no more creates)
2. On `online` event or visibility change — subscribe in `OfflineContext` to retry failed photo uploads
3. On next SyncManager queue processing — add a new step after mutation processing

**Recommended retry approach:** Add a `retryFailedPhotoUploads(workspaceId)` function to `capture-photo-uploader.ts`. Call it from `OfflineContext` when online (on the `online` event and on `SYNC_COMPLETE`). It scans for `status: "failed"` photos using the status index, maps each to its resolved server ID (from IndexedDB `items` store — the optimistic write includes the real ID after sync), and retries uploads.

**Critical constraint — resolving server ID for retry:** At retry time, the `tempItemId` in the photo record must be mapped to the real server ID. After the item syncs, the item store entry is updated with the real ID (the `useOfflineMutation` optimistic write uses `tempId` as the ID, then SSE or refetch brings the real item). However, the `resolvedIds` map only lives in the `processQueue()` call scope. For retry:
- Option A: When `handleItemSynced()` uploads photos, store the `resolvedId -> tempId` mapping in the `quickCapturePhotos` record itself (add a `resolvedItemId` field). Then retry just reads `resolvedItemId`.
- Option B: At retry time, look up the item in IndexedDB `items` store by iterating to find the item whose `_tempItemId` matches — but items don't store this.
- Option C: Store `resolvedItemId` on the `CapturePhoto` record when a successful upload is confirmed. For photos that fail, the `handleItemSynced()` call already has `serverId` — update the photo record with `resolvedItemId: serverId` before the per-photo loop.

**Recommended: Option C** — add `resolvedItemId?: string` to `CapturePhoto` type. In `handleItemSynced()`, before the upload loop, update all photos for this `tempId` to set `resolvedItemId = serverId`. Then failed-photo retry just reads `photo.resolvedItemId`.

### Gap 2: Quick-Capture Pending Items in List (SYNC-04)

**Problem:** Items page maintains `optimisticItems` state, populated by its own `useOfflineMutation` `onMutate`. Quick-capture items are mutated on a different page — they are in IndexedDB but not in the items page's `optimisticItems`.

**Fix pattern:** On items page mount, load pending creates from IndexedDB:

```typescript
// Source: Extends existing pattern in frontend/app/.../items/page.tsx
// Uses existing helper from use-offline-mutation.ts
import { getPendingCreates } from "@/lib/hooks/use-offline-mutation";

// On mount:
useEffect(() => {
  async function loadPendingItems() {
    const pending = await getPendingCreates<Item>("items");
    // Filter out any that are already in optimisticItems
    setOptimisticItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const newPending = pending.filter(p => !existingIds.has(p.id));
      return [...prev, ...newPending];
    });
  }
  loadPendingItems();
}, []); // Once on mount — sync events handle removal
```

**When to clear:** The existing `MUTATION_SYNCED` subscription already filters by `idempotencyKey` and removes from `optimisticItems`. This works for quick-capture items too because `idempotencyKey === item.id` (tempId).

**After sync completes:** When items page detects `MUTATION_SYNCED` for an items create, it already calls `refetch()` to bring in the real item from the server. This will include the newly synced quick-capture item.

### Recommended Project Structure

```
frontend/
├── lib/sync/
│   └── capture-photo-uploader.ts    # MODIFY: per-photo status, retry function
├── lib/db/types.ts                   # MODIFY: add resolvedItemId to CapturePhoto
├── lib/contexts/offline-context.tsx  # MODIFY: call retryFailedPhotoUploads on online/SYNC_COMPLETE
├── app/[locale]/(dashboard)/dashboard/items/
│   └── page.tsx                      # MODIFY: load pending creates from IndexedDB on mount
└── lib/sync/__tests__/
    └── capture-photo-uploader.test.ts # MODIFY: add retry tests
```

### Anti-Patterns to Avoid

- **Unconditional delete after upload loop:** The existing bug — deletes all photos even if some failed. Always delete per-photo only after confirmed upload.
- **Using the mutation queue for photo uploads:** Photos are binary blobs. The mutation queue sends JSON. Keep photo upload separate from the mutation queue.
- **Re-uploading already-uploaded photos:** The per-photo delete approach prevents this — a photo is removed from IndexedDB immediately after successful upload. The `uploaded` list stays clean.
- **Blocking SyncManager queue processing on photo uploads:** Photo uploads are chained after, not during, queue processing. Keep `handleItemSynced()` non-blocking (call with `.catch()` from the event subscriber).
- **Creating a new IndexedDB store for retry tracking:** The `status` field and `status` index already exist on `quickCapturePhotos`. Use them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Photo upload API | XHR manually | `itemPhotosApi.uploadItemPhoto()` | Already handles auth, progress, CORS; tested |
| Photo retrieval from IndexedDB | Raw IDB queries | `getDB().getAllFromIndex("quickCapturePhotos", ...)` | Typed, existing pattern |
| Pending item detection | Custom sync tracking | `getPendingCreates("items")` from `use-offline-mutation.ts` | Purpose-built helper already in the project |
| Status index queries | Full table scan | `getDB().getAllFromIndex("quickCapturePhotos", "status", "failed")` | Status index already created in v5 schema |
| Retry scheduling | Custom timer/interval | Call retry on `online` event + `SYNC_COMPLETE` event | Reuses existing event infrastructure |

**Key insight:** The core chained upload is already working. Phase 46 is surgical fixes to two specific gaps: (1) per-photo cleanup instead of bulk delete, and (2) items page reading pending creates from IndexedDB on mount.

## Common Pitfalls

### Pitfall 1: resolvedIds Map Scope
**What goes wrong:** The `resolvedIds` map that maps `tempItemId -> realServerId` only exists within the `processQueue()` call. By the time `handleItemSynced()` is called (asynchronously, outside processQueue), the map is gone.
**Why it happens:** `handleItemSynced()` is called from the `MUTATION_SYNCED` event subscription in `OfflineContext`, which receives the resolved ID in `event.payload.resolvedId`. This is available — the issue only arises for the retry path (where the item is already synced but some photos failed).
**How to avoid:** Store `resolvedItemId` on each `CapturePhoto` record during the initial upload attempt (before the per-photo loop). The `handleItemSynced()` function already has `serverId` at that point.
**Warning signs:** Retry loop finding photos with `status: "failed"` but no way to know which server item ID to upload to.

### Pitfall 2: Double Pending Display
**What goes wrong:** An item captured on the quick-capture page is already in IndexedDB `items` store (written by `useOfflineMutation`). When the items page loads, it fetches from the API AND loads pending creates. If the item syncs quickly, it could appear twice: once as a pending row and once as a real row.
**Why it happens:** The `filteredItems` memo already deduplicates by filtering `optimisticItems` to exclude IDs that exist in `items`. If the synced item is in the API response, it won't appear twice.
**How to avoid:** The deduplication is already in place: `optimisticItems.filter(opt => !items.some(item => item.id === opt.id))`. Pending items use `tempId` as ID; real items use server UUID. No collision unless we accidentally use the real ID for pending items.
**Warning signs:** Duplicate rows in items list after quick capture; items appearing with wrong IDs.

### Pitfall 3: Photo Thumbnail in Pending Item Row
**What goes wrong:** A pending item row tries to load its photo thumbnail from the API. This fails (the item doesn't exist server-side yet). The code falls into the loading skeleton state.
**Why it happens:** `loadItemPhotos()` is called for visible item IDs, including pending items. The API call fails or returns empty.
**How to avoid:** This is already handled by the existing code — the API call returning empty/failing results in `photo === null`, which renders `PhotoPlaceholder`. Optionally, skip the photo API call entirely for `_pending` items. Either way, there's no crash — just a placeholder.
**Warning signs:** 404 errors in network tab for pending item photo URLs; not a breaking issue.

### Pitfall 4: Photo Retry Uploading to Wrong Item ID
**What goes wrong:** A photo with `status: "failed"` has `tempItemId: "abc-temp"`. The retry function looks up the server ID. If the `resolvedItemId` was not stored on the photo record, the retry has no way to find the right server ID and fails silently.
**Why it happens:** Retry happens after the original `handleItemSynced()` call (which had `serverId`). The `resolvedIds` map is gone.
**How to avoid:** Store `resolvedItemId` on `CapturePhoto` records at the start of `handleItemSynced()` (before the per-photo upload loop). This is the single source of truth for retry.
**Warning signs:** `retryFailedPhotoUploads()` logs "no resolvedItemId for photo" and skips all retries.

### Pitfall 5: optimisticItems Loading on Every Render
**What goes wrong:** Loading pending creates from IndexedDB on every render causes performance issues and race conditions.
**Why it happens:** Passing a dependency to the mount `useEffect` that changes frequently.
**How to avoid:** The `useEffect` for loading pending creates must have `[]` as dependency array — run once on mount only. The existing `MUTATION_SYNCED` event subscription handles removal.
**Warning signs:** IndexedDB queries flooding the console on every render.

## Code Examples

### Fixed Per-Photo Upload with Status Tracking

```typescript
// Source: frontend/lib/sync/capture-photo-uploader.ts (modified)

export async function handleItemSynced(
  event: SyncEvent,
  workspaceId: string
): Promise<void> {
  if (event.type !== "MUTATION_SYNCED") return;

  const mutation = event.payload?.mutation;
  const resolvedId = event.payload?.resolvedId as string | undefined;
  if (!mutation || mutation.entity !== "items" || mutation.operation !== "create") return;

  const tempId = mutation.idempotencyKey;
  const serverId = resolvedId ?? tempId;

  const db = await getDB();
  const photos = await db.getAllFromIndex("quickCapturePhotos", "tempItemId", tempId);
  if (photos.length === 0) return;

  // Store the resolvedItemId on each photo for retry capability
  for (const photo of photos) {
    await db.put("quickCapturePhotos", { ...photo, resolvedItemId: serverId });
  }

  let uploaded = 0;
  for (const photo of photos) {
    try {
      const file = new File([photo.blob], `capture-${Date.now()}.jpg`, {
        type: photo.blob.type || "image/jpeg",
      });
      await itemPhotosApi.uploadItemPhoto(workspaceId, serverId, file);
      // Delete only this photo (successful upload)
      await db.delete("quickCapturePhotos", photo.id);
      uploaded++;
    } catch (err) {
      console.error(`${TAG} failed to upload photo ${photo.id}:`, err);
      // Mark as failed — leave for retry
      await db.put("quickCapturePhotos", {
        ...photo,
        status: "failed" as CapturePhotoStatus,
        resolvedItemId: serverId,
      });
    }
  }

  console.log(`${TAG} ${uploaded}/${photos.length} photos uploaded for item ${serverId}`);
}
```

### Retry Failed Photo Uploads

```typescript
// Source: frontend/lib/sync/capture-photo-uploader.ts (new function)

export async function retryFailedPhotoUploads(workspaceId: string): Promise<void> {
  const db = await getDB();
  const failedPhotos = await db.getAllFromIndex(
    "quickCapturePhotos",
    "status",
    "failed"
  );

  if (failedPhotos.length === 0) return;
  console.log(`${TAG} retrying ${failedPhotos.length} failed photo(s)`);

  for (const photo of failedPhotos) {
    if (!photo.resolvedItemId) {
      console.warn(`${TAG} photo ${photo.id} has no resolvedItemId, skipping`);
      continue;
    }
    try {
      const file = new File([photo.blob], `capture-retry-${Date.now()}.jpg`, {
        type: photo.blob.type || "image/jpeg",
      });
      await itemPhotosApi.uploadItemPhoto(workspaceId, photo.resolvedItemId, file);
      await db.delete("quickCapturePhotos", photo.id);
      console.log(`${TAG} retry succeeded for photo ${photo.id}`);
    } catch (err) {
      console.error(`${TAG} retry failed for photo ${photo.id}:`, err);
      // Leave status as "failed" for next retry cycle
    }
  }
}
```

### OfflineContext Retry Wiring

```typescript
// Source: frontend/lib/contexts/offline-context.tsx (addition to SYNC_COMPLETE/online handler)
import { handleItemSynced, retryFailedPhotoUploads } from "@/lib/sync/capture-photo-uploader";

// In syncManager.subscribe callback, add to SYNC_COMPLETE case:
case "SYNC_COMPLETE":
  setIsMutationSyncing(false);
  // ... existing logic ...
  // Retry any photos that failed in a previous upload attempt
  if (wsId) {
    retryFailedPhotoUploads(wsId).catch(err =>
      console.error("[OfflineContext] photo retry failed:", err)
    );
  }
  break;
```

### CapturePhoto Type Extension

```typescript
// Source: frontend/lib/db/types.ts (addition to CapturePhoto interface)
export interface CapturePhoto {
  id: number;
  tempItemId: string;
  blob: Blob;
  capturedAt: number;
  status: CapturePhotoStatus;
  /** Real server item ID, set when upload is first attempted. Used for retry. */
  resolvedItemId?: string;
}
```

### Items Page: Load Pending Creates on Mount

```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx (addition)
import { getPendingCreates } from "@/lib/hooks/use-offline-mutation";

// Inside ItemsPage component, add this useEffect:
useEffect(() => {
  async function loadQuickCapturePending() {
    const pending = await getPendingCreates<Item>("items");
    if (pending.length === 0) return;
    setOptimisticItems(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const newPending = pending.filter(p => !existingIds.has(p.id));
      return [...prev, ...newPending];
    });
  }
  loadQuickCapturePending();
}, []); // Mount-only: MUTATION_SYNCED subscription handles removal
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bulk-delete all photos after upload | Per-photo delete with failed-status marking | Phase 46 | Enables retry of partial failures |
| Optimistic items only from current page's `useOfflineMutation` | Load pending creates from IndexedDB on mount | Phase 46 | Quick-capture items visible in list across page boundaries |

**Deprecated/outdated:**
- `deletePhotosByTempId()` — still needed for cleanup at the end (photos that never got a `resolvedItemId`), but the main cleanup path switches to per-photo delete.

## Open Questions

1. **Should `retryFailedPhotoUploads` also be triggered on the `online` event?**
   - What we know: `OfflineContext` already triggers `processMutationQueue()` when coming back online. `SYNC_COMPLETE` fires after queue processing. Chaining retry on `SYNC_COMPLETE` is sufficient.
   - What's unclear: Edge case where all mutations were already synced in a previous session, but some photos failed. Then going online again won't trigger `SYNC_COMPLETE` (queue is empty). In this case, the `online` event handler should also call `retryFailedPhotoUploads`.
   - Recommendation: Call `retryFailedPhotoUploads` on both `SYNC_COMPLETE` and the `online` event in `OfflineContext`. Low cost, covers all paths.

2. **What workspace ID to use in `retryFailedPhotoUploads`?**
   - What we know: `OfflineContext` has access to `workspaceId` via `localStorage.getItem("workspace_id")` (same pattern as `processMutationQueue`). The photo records don't store workspaceId.
   - What's unclear: Multi-workspace scenarios.
   - Recommendation: Use the same `localStorage.getItem("workspace_id")` pattern as `processMutationQueue`. This is consistent with how `handleItemSynced` is called from `OfflineContext`.

3. **Should the items page also refresh on SYNC_COMPLETE (not just MUTATION_SYNCED)?**
   - What we know: The items page already calls `refetch()` on `MUTATION_SYNCED` for item creates. The pending indicator disappears and the real item appears.
   - What's unclear: Nothing — this works correctly.
   - Recommendation: No change needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-03 | Per-photo upload, failed photos marked as `failed`, not deleted | unit | `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts` | Exists (needs new test cases) |
| SYNC-03 | `retryFailedPhotoUploads` retries `failed` photos using `resolvedItemId` | unit | `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts` | Needs new test cases |
| SYNC-04 | Quick-capture pending items appear in items list | manual | Navigate to items list after offline quick-capture | N/A - UI behavior |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run lib/sync/__tests__/capture-photo-uploader.test.ts`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers phase requirements. The `capture-photo-uploader.test.ts` file needs new test cases added (not a new file).

## Sources

### Primary (HIGH confidence)
- Codebase: `frontend/lib/sync/capture-photo-uploader.ts` — Current implementation; the bulk-delete bug is confirmed at line 78 (`await deletePhotosByTempId(tempId)` is unconditional)
- Codebase: `frontend/lib/contexts/offline-context.tsx` — `handleItemSynced` call on line 244; MUTATION_SYNCED handler confirms chained upload is already wired; `wasOffline + isOnline` trigger at line 274
- Codebase: `frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx` — `optimisticItems` state (line 388); pending indicator rendering (line 1289-1370); `MUTATION_SYNCED` removal (line 662-683); deduplication in `filteredItems` memo (line 687-756)
- Codebase: `frontend/lib/hooks/use-offline-mutation.ts` — `getPendingCreates()` helper (line 239-250); `_pending: true` marker pattern (line 139)
- Codebase: `frontend/lib/db/types.ts` — `CapturePhoto` interface (line 151); `quickCapturePhotos` schema with `status` index (line 224-231)
- Codebase: `frontend/lib/sync/sync-manager.ts` — `resolvedIds` map scoping (line 355-360); `MUTATION_SYNCED` event payload includes `resolvedId` (line 491-495)
- Codebase: `frontend/lib/sync/__tests__/capture-photo-uploader.test.ts` — Existing test coverage for `handleItemSynced()`

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — v1.9 concern: "SyncManager.resolvedIds persistence across page reloads needs code verification before Phase 46" — confirmed: resolvedIds lives only in processQueue() scope, not persisted. The `resolvedItemId` field on CapturePhoto solves this for retry.
- Phase 44 RESEARCH.md — confirms `status` index on `quickCapturePhotos` store; designed for exactly this retry pattern
- Phase 45 RESEARCH.md — confirms save flow stores photos via `useCapturePhotos.storePhoto(tempId, blob)`

### Tertiary (LOW confidence)
- None. All findings are codebase-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in codebase; no new dependencies
- Architecture: HIGH - Bug location confirmed in source; fix pattern derived from existing code
- Pitfalls: HIGH - Derived from reading actual implementation and existing test patterns

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable — no external dependency changes expected)
