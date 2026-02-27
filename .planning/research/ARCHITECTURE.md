# Architecture: Quick-Capture Integration

**Domain:** Rapid item entry mode for existing home inventory PWA
**Researched:** 2026-02-27
**Confidence:** HIGH (based on thorough codebase analysis)

## Recommended Architecture

Quick-capture is NOT a separate system. It is a **new frontend flow** that reuses existing backend APIs with minimal schema additions. The key architectural insight: the existing `CreateItemWizard` uses direct API calls (not `useOfflineMutation`), while quick-capture MUST use the offline mutation path for its core value proposition (rapid capture while walking around a warehouse without network).

### High-Level Data Flow

```
Camera -> Photo blob -> IndexedDB (quickCapturePhotos store)
  |
  v
Name input -> QuickCaptureForm -> useOfflineMutation("items", "create")
  |                                    |
  |                                    v
  |                              mutationQueue (IndexedDB)
  |                                    |
  v                                    v
Sticky batch state (React state     SyncManager.processQueue()
  + sessionStorage)                    |
                                       v
                                  POST /items (with needs_review=true)
                                       |
                                       v
                                  Response: { id: "real-id" }
                                       |
                                       v
                                  Photo upload queue processes
                                  (POST /items/{realId}/photos)
```

### Component Boundaries

| Component | Responsibility | New/Modified | Communicates With |
|-----------|---------------|--------------|-------------------|
| `QuickCapturePage` | Full-screen camera-first capture flow | **NEW** | InlinePhotoCapture, QuickCaptureForm |
| `QuickCaptureForm` | Minimal form: name only (+ hidden batch fields) | **NEW** | useOfflineMutation, useBatchSettings |
| `useBatchSettings` | Sticky location/category across capture sessions | **NEW** | sessionStorage, QuickCaptureForm |
| `useQuickCaptureSKU` | Client-side auto-SKU generation (prefix + timestamp) | **NEW** | QuickCaptureForm |
| `QuickCaptureReview` | "Needs details" item list with filter + edit | **NEW** | itemsApi, items page filters |
| `InlinePhotoCapture` | Camera/gallery capture with compression | **REUSE** (no changes) | QuickCaptureForm |
| `useOfflineMutation` | Queue item create to IndexedDB | **REUSE** (no changes) | SyncManager |
| `SyncManager` | Process mutation queue, resolve temp IDs | **MODIFY** (photo upload chaining) | Backend APIs |
| `FloatingActionButton` | Radial menu entry point | **REUSE** (no changes) | - |
| `useFABActions` | Add "Quick Capture" action to FAB menu | **MODIFY** (add action) | QuickCapturePage |
| Backend `item` entity | Add `needs_review` boolean column | **MODIFY** (schema + entity + handler) | PostgreSQL |
| Backend item handler | Accept `needs_review` field, add list filter | **MODIFY** | item service |

## Integration Points (Detailed)

### 1. FAB Entry Point (Modify `useFABActions`)

**Current state:** FAB has 3 default actions: Scan, Add Item, Log Loan. On items page, it swaps Add Item to primary position with Plus icon. The FAB component supports up to 5 actions in its radial menu.

**Change:** Add "Quick Capture" as a 4th action (Camera icon). On items page, make it the primary action.

```typescript
// In use-fab-actions.tsx - add to imports and default actions
const quickCaptureAction: FABAction = {
  id: "quick-capture",
  icon: <Camera className="h-5 w-5" />,
  label: "Quick capture",
  onClick: () => router.push("/dashboard/items/quick-capture"),
};

// Default: [quickCaptureAction, scanAction, addItemAction, logLoanAction]
// Items page: [quickCaptureAction, addItemAction, scanAction]
```

**Integration risk:** LOW. The FAB already supports variable action counts. Adding a 4th action to defaults is straightforward -- the radial arc calculation in `getActionPosition` handles any count.

### 2. Quick Capture Page (New Route)

**Route:** `/app/[locale]/(dashboard)/dashboard/items/quick-capture/page.tsx`
**Layout:** Full-screen mobile-optimized. Single-screen with camera dominant, name field below, save button.

**Why NOT reuse MultiStepForm/CreateItemWizard:**
- `CreateItemWizard` is a 3-step form designed for thorough entry with Basic -> Details -> Photos flow
- Its `handleSubmit` calls `itemsApi.create()` directly -- this FAILS offline
- Quick capture needs a single screen with immediate camera access and a save-and-repeat loop
- The "save & next" rapid cycle is fundamentally different from "fill 3 steps and submit once"

**Component structure:**
```
QuickCapturePage
  |-- BatchSettingsBar (location/category pills, tap to change)
  |-- InlinePhotoCapture (camera-first, large capture area)
  |-- QuickCaptureNameInput (single text field, auto-focused after photo)
  |-- QuickCaptureActions (Save & Next / Save & Done buttons)
  |-- CaptureCounter (shows "5 items captured this session")
```

**The InlinePhotoCapture component can be reused as-is.** It already:
- Handles camera via `capture="environment"` for rear camera
- Handles gallery selection as fallback
- Compresses images above 2MB threshold
- Creates preview URLs for display
- Returns processed `File` objects via `onCapture` callback

### 3. Auto-SKU Generation (New Hook: `useQuickCaptureSKU`)

**Current state:** CreateItemWizard requires manual SKU entry (step 1, required field). Backend validates SKU uniqueness via `repo.SKUExists()` and rejects duplicates with `ErrSKUTaken`. Backend does NOT auto-generate SKUs (only short_code is auto-generated).

**Design:** Generate SKU client-side using `QC-{timestamp}-{random}` pattern.

```typescript
function generateQuickCaptureSKU(): string {
  const ts = Date.now().toString(36); // compact timestamp
  const rand = Math.random().toString(36).substring(2, 6);
  return `QC-${ts}-${rand}`; // e.g., "QC-m2k4f7a-a3b1"
}
```

**Why client-side:**
- Offline-first: must work without server
- UUIDv7 idempotency key already prevents duplicate item creation at sync time
- `QC-` prefix makes quick-capture items visually identifiable in the items list
- SKU uniqueness is validated at sync time by the existing `repo.SKUExists()` check
- Collision is astronomically unlikely with timestamp + random (same millisecond + same 4 random chars)
- If collision occurs at sync, SyncManager gets a 400/422 error -- needs a retry handler that regenerates the SKU

**Backend impact:** None for auto-generation. The SKU column is VARCHAR(50), plenty of room for the `QC-` prefix pattern.

### 4. Offline Item Creation via `useOfflineMutation` (Reuse)

**Current state:** `CreateItemWizard.handleSubmit()` calls `itemsApi.create()` directly. Meanwhile, five other entities (categories, locations, borrowers, containers, inventory) already use `useOfflineMutation` successfully.

**Quick capture integration:**
```typescript
const { mutate } = useOfflineMutation<ItemCreatePayload>({
  entity: "items",
  operation: "create",
  onMutate: (payload, tempId) => {
    // Optimistic: increment capture counter
    setCaptureCount(prev => prev + 1);
  },
});

async function handleCapture(name: string, photos: File[]) {
  const sku = generateQuickCaptureSKU();
  const tempId = await mutate({
    sku,
    name,
    needs_review: true,
    category_id: batchSettings.categoryId || undefined,
  });
  // Queue photos for upload linked to tempId
  for (const photo of photos) {
    await storeQuickCapturePhoto(tempId, photo);
  }
}
```

**The `useOfflineMutation` hook already handles everything needed:**
- Queuing to IndexedDB `mutationQueue` store with UUIDv7 idempotency key
- Writing optimistic item to `items` store with `_pending: true` marker
- Capturing `workspaceId` from localStorage at mutation time
- Triggering `SyncManager.processQueue()` when online
- Entity-type ordered sync (items process after categories, so batch category exists first)

**No changes needed to `useOfflineMutation` itself.**

### 5. Photo Queuing for Offline (New IndexedDB Store)

**Current state:** Two separate photo upload systems exist:
1. `CreateItemWizard` uploads photos sequentially via XHR after successful item creation (online only)
2. Service worker intercepts failed photo uploads to a separate `PhotoUploadQueue` IndexedDB database

**Problem for quick capture:** Photos are captured BEFORE the item exists on the server. The item has only a temp ID (UUIDv7 idempotency key). Photos cannot be uploaded until the item mutation syncs and a real server ID is returned from the response.

**Solution: New IndexedDB store + SyncManager photo chaining**

Add a `quickCapturePhotos` store to the main offline database (`hws-offline-v1`):

```typescript
// Add to OfflineDBSchema in lib/db/types.ts
quickCapturePhotos: {
  key: number;
  value: {
    id: number;           // auto-increment
    tempItemId: string;   // links to mutation idempotency key
    blob: Blob;           // compressed photo data
    timestamp: number;
    status: "pending" | "uploading" | "uploaded" | "failed";
  };
  indexes: {
    tempItemId: string;
    status: string;
  };
};
```

**Why a new store in the main DB instead of reusing `PhotoUploadQueue`:**
- `PhotoUploadQueue` is a separate IndexedDB database managed entirely by the service worker
- It stores the full upload URL (expects the item already exists on the server with a real ID)
- Quick capture photos have no upload URL yet because the item only has a temp ID
- The main offline DB (`hws-offline-v1`) is managed by application code with a typed schema via `idb`
- Keeping photo blobs in the main DB lets SyncManager chain: item create -> resolve real ID -> photo upload

**DB version bump:** IndexedDB version goes from 4 to 5. The `upgrade` callback in `offline-db.ts` adds the new store.

**Storage budget:** Each compressed photo is ~200KB-2MB after `InlinePhotoCapture`'s compression (1920x1920, quality 0.85). For a batch of 50 items with 1 photo each: 10-100MB. IndexedDB quota is 50MB minimum, typically much higher on mobile. The `requestPersistentStorage()` call (already implemented) helps prevent eviction. Add a capture limit warning at ~30 items or when storage estimate exceeds 80% of quota.

### 6. SyncManager Photo Chaining (Modify `SyncManager.processMutation`)

**Current state:** After a successful item create, `SyncManager` maps `tempId -> realId` in the `resolvedIds` Map and broadcasts `MUTATION_SYNCED`. It does NOT trigger any follow-up actions.

**Change:** After item create succeeds, check `quickCapturePhotos` store for pending photos:

```typescript
// In processMutation(), after successful create for items:
if (mutation.entity === "items" && mutation.operation === "create") {
  const realId = resolvedIds.get(mutation.idempotencyKey);
  if (realId) {
    await this.uploadQueuedPhotos(
      mutation.idempotencyKey, realId, mutation.workspaceId
    );
  }
}
```

**The `uploadQueuedPhotos` method:**
1. Read all entries from `quickCapturePhotos` where `tempItemId === idempotencyKey`
2. For each, create `FormData` with the blob and POST to `/workspaces/{wsId}/items/{realId}/photos`
3. On success, delete the entry from the store
4. On failure, mark as `"failed"` (retry on next sync cycle)
5. Broadcast progress events (`PHOTO_UPLOAD_PROGRESS`, `PHOTO_UPLOAD_COMPLETE`) for UI feedback

**Critical design detail:** Process photos AFTER all item mutations in the current batch complete, not inline during mutation processing. This prevents photo uploads from blocking other mutations. Add a `processQueuedPhotos()` phase after the main entity sync loop:

```typescript
// In processQueue(), after the entity sync loop:
await this.processQueuedPhotos(resolvedIds);
```

**Integration risk:** MEDIUM. Adding async photo upload work to `processQueue()` increases processing time. Must handle: upload timeout, partial failures (some photos upload, some fail), network loss mid-batch.

### 7. Sticky Batch Settings (New Hook: `useBatchSettings`)

**Current state:** No batch settings concept exists anywhere in the codebase.

**Design:**
```typescript
interface BatchSettings {
  categoryId: string | null;
  locationId: string | null;   // for future inventory creation
  containerId: string | null;  // for future inventory creation
}

function useBatchSettings() {
  // sessionStorage: dies on tab close, which is correct behavior
  const [settings, setSettings] = useState<BatchSettings>(() => {
    if (typeof sessionStorage === "undefined") return DEFAULT;
    const saved = sessionStorage.getItem("quickCaptureBatch");
    return saved ? JSON.parse(saved) : DEFAULT;
  });
  // ... setter that writes to sessionStorage + state
}
```

**Why sessionStorage (not localStorage, not IndexedDB):**
- Batch settings are intentionally ephemeral -- they represent "I'm in the garage right now"
- When the user closes the tab, batch context should reset (next time they may be somewhere else)
- localStorage would persist across sessions, which is wrong for spatial context
- IndexedDB is overkill for 3 nullable string values of ephemeral UI state

**UI:** A horizontal bar at the top of the quick capture screen showing current batch settings as tappable pills (e.g., `[Garage] [Tools]`). Tapping opens a bottom sheet selector populated from cached IndexedDB data (categories/locations stores), so it works offline.

### 8. "Needs Review" Flag (Modify Backend + Frontend)

**Backend changes:**

1. **Migration:** Add column to `warehouse.items`:
```sql
ALTER TABLE warehouse.items ADD COLUMN needs_review BOOLEAN DEFAULT false;
```

2. **Entity (`entity.go`):** Add `needsReview *bool` field to `Item` struct, getter, include in `Reconstruct`, `NewItem` (defaults false), and `Update`.

3. **CreateInput/UpdateInput (`service.go`):** Add `NeedsReview *bool` field to both structs. Service passes through to entity.

4. **Handler (`handler.go`):** Accept `needs_review` in create/update request bodies. Add `?needs_review=true|false` query parameter to the list endpoint.

5. **Repository/sqlc:** Add `needs_review` to insert/update/select queries. Add `ListItemsNeedingReview` query or parameterize existing `ListItems`.

6. **Response mapping (`toItemResponse`):** Include `needs_review` in JSON response.

**Frontend changes:**

1. **Item type (`lib/types/items.ts`):** Add `needs_review?: boolean` to `Item`, `ItemCreate`, `ItemUpdate` interfaces.

2. **Items list page:** Add "Needs Review" filter chip/toggle in the existing `FilterBar` component. The page already uses `useFilters` hook and `FilterPopover` for category/archived filtering.

3. **Item detail page:** Show "Needs Review" badge when true. Add "Mark as Reviewed" action button that PATCHes `needs_review: false`.

4. **Quick capture review page (or section):** A dedicated view at `/dashboard/items?needs_review=true` or a tab on the items page. Shows quick-captured items with photo thumbnails, name, auto-SKU. Each row has an "Edit" action that opens the full edit form for detail completion.

**The review flow:**
```
Quick capture (mobile, offline) -> Items created with needs_review=true
  |
  v
Desktop user visits items page, clicks "Needs Review" filter
  |
  v
Sees list of quick-captured items with photos but minimal details
  |
  v
Clicks item -> Full edit form (existing edit-item-wizard)
  |
  v
Fills in details (brand, model, serial, etc) -> saves -> needs_review set to false
```

### 9. Location/Inventory Integration (Deferred to Phase 2)

**Important architectural note:** The `warehouse.items` table does NOT have a `location_id` column. Location is tracked via the `warehouse.inventory` table -- items have inventory entries that are placed in locations/containers.

**For quick capture MVP:** Only apply `category_id` from batch settings to the item itself. Location/container from batch settings are stored in sessionStorage but NOT used to create inventory entries in Phase 1.

**Why defer:** Creating an inventory entry requires a separate mutation that depends on:
1. The item existing (must sync first)
2. The location existing (may also be a temp ID if created offline)
3. Container existing (optional, same dependency issue)

The `dependsOn` mechanism in `useOfflineMutation` and `SyncManager.areDependenciesSynced()` already supports this, but it adds failure modes and complexity. Better to ship item capture first, then add inventory auto-creation as enhancement.

**Phase 2 approach:** After item mutation syncs, auto-create an inventory entry:
```typescript
const itemTempId = await mutate(itemPayload);
const inventoryTempId = await mutate(
  { item_id: itemTempId, location_id: batchSettings.locationId, quantity: 1 },
  undefined,
  [itemTempId] // dependsOn: wait for item to sync first
);
```

## Data Flow: Complete Offline Capture Sequence

```
 1. User taps "Quick Capture" in FAB
 2. Route: /dashboard/items/quick-capture
 3. Camera opens immediately (InlinePhotoCapture with capture="environment")
 4. User snaps photo -> compressed File blob stored in component state
 5. User types item name (single field, auto-focused after photo capture)
 6. User taps "Save & Next"
 7. Client generates SKU: "QC-m2k4f7a-a3b1"
 8. useOfflineMutation queues to IndexedDB mutationQueue:
    { entity: "items", operation: "create",
      payload: { sku, name, needs_review: true, category_id } }
 9. Optimistic item written to IndexedDB items store with _pending: true
10. Photo blob stored to quickCapturePhotos store:
    { tempItemId: idempotencyKey, blob, status: "pending" }
11. Form resets, camera re-opens for next item
12. Counter shows "1 item captured"
13. Steps 3-12 repeat for each item

--- Later, when online ---

14. SyncManager.processQueue() runs (triggered by online event or visibility change)
15. Processes items mutations in ENTITY_SYNC_ORDER (after categories)
16. POST /workspaces/{wsId}/items with JSON payload
    -> Server validates SKU uniqueness, creates item, returns { id: "real-server-id" }
17. resolvedIds.set(tempId, realServerId)
18. After all mutations processed, SyncManager.processQueuedPhotos() runs
19. For each entry in quickCapturePhotos matching a resolved tempId:
    POST /workspaces/{wsId}/items/{realServerId}/photos with FormData
20. On success: photo entry removed from quickCapturePhotos store
21. Broadcast MUTATION_SYNCED + PHOTO_UPLOADED events for UI feedback
22. PendingUploadsIndicator updates to reflect progress
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reusing CreateItemWizard for Quick Capture
**What:** Trying to add a "quick mode" toggle to the existing 3-step wizard.
**Why bad:** The wizard uses direct API calls (`itemsApi.create()`), has no offline support, uses `MultiStepForm` with form draft persistence and iOS keyboard handling. Quick capture needs a fundamentally different UX loop (capture -> save -> repeat immediately) not a multi-step form submission.
**Instead:** Build a new single-screen component that uses `useOfflineMutation` directly.

### Anti-Pattern 2: Storing Photos as Base64 in Mutation Payload
**What:** Converting photos to base64 strings and including them in the mutation queue payload.
**Why bad:** Base64 inflates size by 33% (2MB photo -> 2.7MB string). The mutation queue is designed for JSON payloads. SyncManager sends mutations via `fetch` with `Content-Type: application/json` -- you cannot send multipart FormData through the existing mutation queue pipeline.
**Instead:** Store photo Blobs in a separate IndexedDB store. Chain photo upload (multipart POST) after item sync completes.

### Anti-Pattern 3: Client-Side SKU Validation Against Server
**What:** Checking SKU uniqueness by calling `itemsApi.search()` before saving offline.
**Why bad:** Defeats the purpose of offline-first. The whole point is capturing without network.
**Instead:** Use timestamp+random SKU pattern that is statistically unique. Let the server validate at sync time. Handle the rare collision gracefully with a retry.

### Anti-Pattern 4: Using localStorage for Photo Blobs
**What:** Serializing photos and storing in localStorage.
**Why bad:** localStorage has a 5MB hard limit across ALL keys, is synchronous (blocks main thread during writes), and only stores strings (requiring base64 encoding which inflates size).
**Instead:** IndexedDB stores `Blob` objects natively without serialization overhead and has much higher quotas (50MB minimum, typically hundreds of MB).

### Anti-Pattern 5: Creating Inventory Entries in Phase 1
**What:** Auto-creating inventory records (for location placement) as part of the same quick capture action.
**Why bad:** Adds cross-entity dependency complexity. The inventory mutation depends on items + locations + containers in the sync order. The `dependsOn` mechanism works but adds failure modes (cascade failures if item sync fails). Users may not even want inventory tracking for every captured item.
**Instead:** Phase 1 captures items only (with category from batch). Location/inventory is a Phase 2 enhancement or handled during "needs review" desktop completion.

## Suggested Build Order

Build order follows the dependency chain. Each phase produces a testable increment.

### Phase 1: Backend Schema + API (no frontend dependency)
1. Add `needs_review` column via migration
2. Update item entity, CreateInput, UpdateInput, Reconstruct, handler, repository
3. Add `?needs_review=true` filter to list endpoint
4. Update sqlc queries (insert, update, select, list)
5. Unit tests for new field + filter

### Phase 2: Auto-SKU + Batch Settings Hooks (no backend dependency)
1. `useQuickCaptureSKU` hook with `QC-{ts}-{rand}` generation
2. `useBatchSettings` hook with sessionStorage persistence
3. Unit tests for both hooks

### Phase 3: Quick Capture Photo Store (IndexedDB)
1. Add `quickCapturePhotos` store to `OfflineDBSchema`
2. Bump DB version from 4 to 5 in `offline-db.ts`
3. CRUD helper functions: `storeQuickCapturePhoto`, `getPhotosForItem`, `deletePhoto`
4. Unit tests for photo store operations

### Phase 4: Quick Capture UI
1. `QuickCapturePage` component at `/dashboard/items/quick-capture`
2. Integrate `InlinePhotoCapture` (reuse), name input, batch settings bar
3. Wire up `useOfflineMutation` for item creation with `needs_review: true`
4. Wire up photo blob storage to `quickCapturePhotos` store
5. Save & Next loop with capture counter and haptic feedback
6. Add "Quick Capture" action to `useFABActions`

### Phase 5: SyncManager Photo Chaining
1. Add `uploadQueuedPhotos` method to `SyncManager`
2. Add `processQueuedPhotos` phase after entity sync loop
3. Handle upload failures, retries, and partial success
4. Broadcast photo sync events for `PendingUploadsIndicator`
5. Integration tests for the full chain: queue item -> sync -> upload photos

### Phase 6: Needs Review UI
1. Add `needs_review` to frontend `Item`, `ItemCreate`, `ItemUpdate` types
2. Add "Needs Review" filter chip to items list `FilterBar`
3. Badge on item detail page, "Mark as Reviewed" action
4. Inline editing for quick detail completion from the items list

### Phase 7: Polish + Edge Cases
1. Storage quota warning (check `navigator.storage.estimate()` before each capture)
2. SKU collision handling at sync time (regenerate SKU on 400/422 and retry)
3. Haptic feedback on capture success via existing `triggerHaptic`
4. i18n: add all new translation keys to en.json, et.json, ru.json
5. E2E tests for the quick capture flow (Playwright)

## Project Structure (New Files)

### Frontend
```
frontend/
  app/[locale]/(dashboard)/dashboard/items/
    quick-capture/
      page.tsx                          # NEW: Quick capture route
  components/items/
    quick-capture/
      quick-capture-page.tsx            # NEW: Main capture component
      batch-settings-bar.tsx            # NEW: Sticky settings pills
      capture-counter.tsx               # NEW: Session counter display
  lib/hooks/
    use-batch-settings.ts               # NEW: sessionStorage batch state
    use-quick-capture-sku.ts            # NEW: Auto-SKU generation
  lib/db/
    quick-capture-photos.ts             # NEW: Photo blob CRUD helpers
    types.ts                            # MODIFY: Add quickCapturePhotos store
    offline-db.ts                       # MODIFY: Bump version, add store
  lib/sync/
    sync-manager.ts                     # MODIFY: Add photo chaining
  lib/hooks/
    use-fab-actions.tsx                 # MODIFY: Add quick capture action
  lib/types/
    items.ts                            # MODIFY: Add needs_review field
```

### Backend
```
backend/
  db/migrations/
    NNN_add_needs_review.sql            # NEW: Add needs_review column
  db/queries/
    items.sql                           # MODIFY: Add needs_review to queries
  internal/domain/warehouse/item/
    entity.go                           # MODIFY: Add needsReview field
    service.go                          # MODIFY: Add to CreateInput/UpdateInput
    handler.go                          # MODIFY: Accept needs_review, add filter
    repository.go                       # MODIFY: Add to interface if needed
```

## Sources

- Direct codebase analysis of:
  - `frontend/components/items/create-item-wizard/index.tsx` -- current item creation flow, direct API calls
  - `frontend/components/items/create-item-wizard/schema.ts` -- form schema, SKU required
  - `frontend/lib/hooks/use-offline-mutation.ts` -- offline mutation queue infrastructure
  - `frontend/lib/sync/sync-manager.ts` -- sync processing, entity ordering, dependency resolution, ID mapping
  - `frontend/lib/sync/mutation-queue.ts` -- queue operations, retry config
  - `frontend/components/forms/inline-photo-capture.tsx` -- camera capture with compression
  - `frontend/components/forms/multi-step-form.tsx` -- wizard framework (not reused)
  - `frontend/components/fab/floating-action-button.tsx` -- FAB radial menu, variable action count
  - `frontend/lib/hooks/use-fab-actions.tsx` -- route-aware FAB actions, existing patterns
  - `frontend/lib/db/types.ts` -- IndexedDB schema v4, 10 stores, mutation queue types
  - `frontend/lib/db/offline-db.ts` -- DB singleton, version upgrades, persistent storage
  - `frontend/app/sw.ts` -- service worker PhotoUploadQueue (separate DB)
  - `frontend/lib/contexts/offline-context.tsx` -- pending uploads tracking
  - `frontend/lib/types/items.ts` -- Item, ItemCreate, ItemUpdate interfaces
  - `frontend/lib/api/items.ts` -- items API client
  - `frontend/lib/api/item-photos.ts` -- photo upload via XHR with progress
  - `backend/internal/domain/warehouse/item/entity.go` -- Item domain model, all fields
  - `backend/internal/domain/warehouse/item/service.go` -- SKU uniqueness validation, CreateInput
  - `backend/internal/domain/warehouse/item/handler.go` -- HTTP handler, Huma framework
  - `backend/db/schema.sql` -- warehouse.items table definition

---
*Architecture research for: Quick-Capture Integration*
*Researched: 2026-02-27*
