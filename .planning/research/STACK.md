# Stack Research: Quick Capture Item Entry

**Domain:** Mobile-first rapid item entry for home inventory PWA
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Assessment

Quick capture requires **zero new npm dependencies**. The existing stack already provides every building block: `InlinePhotoCapture` for camera-first flow, `idb` v8 for IndexedDB blob storage, `useOfflineMutation` for queued sync, `useFormDraft` for persistence, and `uuid` for client-side SKU generation. The work is integration and new components/hooks, not new libraries.

## Recommended Stack Additions

### Core Technologies -- NONE NEEDED

The existing stack covers all quick-capture requirements:

| Existing Technology | Version | Quick-Capture Role | Status |
|---------------------|---------|-------------------|--------|
| idb | 8.0.3 | Store photo blobs in IndexedDB for offline viewing | Extend schema (v5) |
| uuid | 13.0.0 | Client-side auto-SKU generation (UUIDv7 prefix) | Already used for idempotency keys |
| InlinePhotoCapture | n/a | Camera-first capture with compression | Existing component, minor adaptation |
| useOfflineMutation | n/a | Queue item creates for offline sync | Existing hook, use as-is |
| useFormDraft | n/a | Persist batch session settings | Existing hook, use as-is |
| motion | 12.29.2 | Transition animations between capture steps | Already installed |
| ios-haptics | 0.1.4 | Haptic feedback on save/next-item | Already installed |
| react-hook-form + zod | 7.70.0 / 4.3.5 | Minimal quick-capture form validation | Already installed |

### Supporting Libraries -- NONE NEEDED

| Considered Library | Purpose | Why NOT Needed |
|-------------------|---------|----------------|
| zustand / jotai | Batch session state management | React Context + useFormDraft already persists state to IndexedDB. Batch session is a single context with location_id, category_id, and session counter -- too simple for a state management library. |
| browser-image-compression | Client-side image compression | `compressImage()` in `lib/utils/image.ts` already does canvas-based resize + quality reduction. Works fine. |
| nanoid | Short ID generation | `uuid` v13 already installed. Client-side SKU uses prefix + counter, not random IDs. |
| localforage | IndexedDB wrapper | `idb` v8 already used everywhere. Adding a second IDB wrapper would create confusion. |
| react-camera-pro | Camera capture component | `<input type="file" capture="environment">` in InlinePhotoCapture already handles this. Native input is more reliable across browsers than MediaStream-based approaches. |

### Development Tools -- NONE NEEDED

Existing Vitest + Playwright + Testing Library covers all testing needs.

## Installation

```bash
# No new packages to install.
# All capabilities come from extending existing code.
```

## What to Build (Not Install)

### 1. IndexedDB Schema v5: Photo Blob Store

Add a `capturePhotos` object store to the existing `OfflineDBSchema`. Stores compressed image blobs keyed by a capture session ID, linked to the item's idempotency key.

**Why in IndexedDB, not the existing `PhotoUploadQueue`:** The service worker's `PhotoUploadQueue` (in `sw.ts`) is a separate raw IDB database used for retry-on-failure. It stores `FormData` for uploads that failed due to network. The quick-capture feature needs a **different** store: one that holds photo blobs for offline display (showing the user their captured photos before sync). After successful item creation + photo upload, the blob is cleaned up.

```typescript
// Addition to lib/db/types.ts
interface CapturePhoto {
  id: string;           // UUIDv7
  itemIdempotencyKey: string;  // Links to mutation queue entry
  blob: Blob;           // Compressed image blob
  thumbnail: string;    // Base64 data URL for fast list rendering
  capturedAt: number;   // Timestamp
}

// Addition to OfflineDBSchema
capturePhotos: {
  key: string;
  value: CapturePhoto;
  indexes: {
    itemIdempotencyKey: string;
  };
};
```

**Storage budget:** Each photo compressed to ~200-500KB at 1920px max dimension, 0.85 JPEG quality (existing `compressImage` defaults). 50 photos in a batch session = ~25MB, well within IndexedDB quotas. The project already requests persistent storage.

### 2. Client-Side Auto-SKU Generation

SKU is required by the backend (`NewItem` requires non-empty SKU). For quick capture, generate a temporary SKU client-side that the backend accepts, then let the user refine it later during the "needs details" completion step.

**Pattern:** `QC-{YYYYMMDD}-{NNN}` where NNN is a zero-padded session counter.

```typescript
// No library needed -- pure function
function generateQuickCaptureSKU(sessionDate: string, sessionCounter: number): string {
  return `QC-${sessionDate}-${String(sessionCounter).padStart(3, '0')}`;
}
```

**Why not UUIDv7 for SKU:** SKUs should be human-readable (displayed in lists, printed on labels). A sequential counter within a date prefix is scannable. The backend's `SKUExists` check prevents collisions across sessions.

### 3. Batch Session Context

A React Context holding sticky settings that persist across rapid item entries within a single capture session.

```typescript
interface BatchSessionState {
  sessionId: string;        // UUIDv7
  locationId: string | null;
  categoryId: string | null;
  sessionDate: string;      // YYYYMMDD
  itemCounter: number;      // Increments per item saved
  totalCaptured: number;    // Display counter
}
```

**Persistence:** Use existing `useFormDraft` hook with `formType: "quick-capture-session"` to survive accidental page refreshes. Session state is small (~200 bytes) and already covered by the `formDrafts` store.

### 4. "Needs Details" Flag

Add a boolean `needs_details` field to the items table (backend migration) and the `Item` type (frontend). Items created via quick capture set `needs_details: true`. The full edit form clears it.

**Backend:** New migration adding `needs_details BOOLEAN NOT NULL DEFAULT FALSE` to `items` table. Add to sqlc queries, entity, service, handler.

**Frontend:** Add to `Item` type, add filter option to items list page (dropdown or toggle). Use existing `Fuse.js` offline search with an additional filter predicate.

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Photo blob storage | IndexedDB `capturePhotos` store | Cache API (service worker) | Cache API is for request/response pairs, not arbitrary blobs. IndexedDB is already the project's storage pattern. |
| Batch session state | React Context + useFormDraft | zustand | Project has zero state management libraries. Adding one for a single context with 5 fields is over-engineering. |
| Auto-SKU format | `QC-YYYYMMDD-NNN` | Random nanoid/UUID | SKUs should be human-scannable. Sequential per-session is better UX for bulk entry. |
| Photo display while offline | Store blob + base64 thumbnail | Store only blob, generate thumbnail on render | Generating thumbnails is async + canvas work. Pre-generating a small base64 thumbnail at capture time avoids jank when scrolling the capture history. |
| Camera approach | Native `<input capture="environment">` | MediaStream API (getUserMedia) | Native input handles permissions, OS-level camera UI, and works consistently in PWA. MediaStream requires managing permissions, viewfinder UI, and breaks easily in iOS PWA context. Already validated in v1.3. |
| Needs-details implementation | Database boolean column | Client-side computed (check empty fields) | A computed approach is fragile -- which fields count as "incomplete"? An explicit flag is intentional: the user used quick capture, they know details are missing. The flag is cleared explicitly when they edit. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any camera/video capture library | Native `<input capture>` already works, tested in v1.3 across iOS/Android PWA | Existing `InlinePhotoCapture` component |
| zustand / jotai / redux | Project pattern is React Context. One new context for batch sessions is the right granularity. | `React.createContext` + `useFormDraft` for persistence |
| browser-image-compression | Adds 50KB+ for features already implemented in `compressImage()` utility | Existing `lib/utils/image.ts` |
| A second IndexedDB wrapper | `idb` v8 is the project standard. Don't mix `localforage` or raw IDB. | Extend existing `offline-db.ts` |
| Service worker changes for photo blobs | The SW already handles photo upload retry. Quick-capture photo storage belongs in the main thread's IndexedDB, not the SW's separate database. | New `capturePhotos` store in main `OfflineDBSchema` |

## Integration Points

### Existing Code to Extend

| File | Change | Why |
|------|--------|-----|
| `lib/db/offline-db.ts` | Add `capturePhotos` store in DB_VERSION 5 upgrade | Store photo blobs for offline display |
| `lib/db/types.ts` | Add `CapturePhoto` type, extend `OfflineDBSchema` | Type safety for new store |
| `lib/types/items.ts` | Add `needs_details?: boolean` to `Item`, `ItemCreate` | Track quick-capture items |
| `components/forms/inline-photo-capture.tsx` | Adapt for quick-capture mode (auto-trigger camera, return blob) | Camera-first flow needs immediate capture on mount |
| `lib/hooks/use-offline-mutation.ts` | No changes needed | Already handles item creates with idempotency |
| `lib/hooks/use-form-draft.ts` | No changes needed | Use for batch session persistence |
| `app/sw.ts` | No changes needed | Existing photo upload queue handles retry |

### New Code to Create

| File | Purpose |
|------|---------|
| `lib/contexts/batch-capture-context.tsx` | Batch session state (location, category, counter) |
| `lib/hooks/use-capture-photo-store.ts` | CRUD operations for `capturePhotos` IDB store |
| `lib/utils/sku-generator.ts` | Client-side `QC-YYYYMMDD-NNN` SKU generation |
| `features/quick-capture/quick-capture-flow.tsx` | Main capture flow component |
| `features/quick-capture/capture-card.tsx` | Camera-first minimal item card |
| `features/quick-capture/batch-settings-sheet.tsx` | Bottom sheet for sticky location/category |
| `features/quick-capture/capture-session-summary.tsx` | End-of-session summary |
| `app/[locale]/(dashboard)/dashboard/items/quick-capture/page.tsx` | Route for quick capture mode |

### Backend Changes

| File | Change |
|------|--------|
| `migrations/` | Add `needs_details` column to `items` table |
| `internal/domain/warehouse/item/entity.go` | Add `needsDetails` field |
| `internal/domain/warehouse/item/service.go` | Accept `NeedsDetails` in `CreateInput` |
| `internal/domain/warehouse/item/handler.go` | Add `needs_details` to create/update/list DTOs, add filter param to list |
| `internal/infra/queries/items.sql` | Add `needs_details` to queries, add filtered list query |

## Version Compatibility

No new packages, so no new compatibility concerns. Existing stack versions are all current and compatible.

| Existing Package | Version | Verified Compatible |
|-----------------|---------|---------------------|
| idb | 8.0.3 | Yes -- `Blob` storage in IndexedDB is a standard feature, works with idb's typed schema |
| react-hook-form | 7.70.0 | Yes -- minimal form for quick capture (name field only) |
| zod | 4.3.5 | Yes -- simple schema: name required, SKU auto-generated |
| uuid | 13.0.0 | Yes -- UUIDv7 for capture photo IDs and session IDs |

## Sources

- Codebase analysis: `frontend/lib/db/offline-db.ts` -- current IDB schema at v4 with 10 stores
- Codebase analysis: `frontend/lib/hooks/use-offline-mutation.ts` -- existing offline create flow
- Codebase analysis: `frontend/components/forms/inline-photo-capture.tsx` -- existing camera capture
- Codebase analysis: `frontend/lib/utils/image.ts` -- existing compression (canvas-based, 1920px max)
- Codebase analysis: `frontend/app/sw.ts` -- existing photo upload queue (separate IDB database)
- Codebase analysis: `backend/internal/domain/warehouse/item/service.go` -- SKU required, short_code auto-generated
- Codebase analysis: `backend/internal/domain/warehouse/item/entity.go` -- Item domain entity fields
- IndexedDB Blob storage: standard Web API, supported in all target browsers (Chrome 76+, Safari 14+, Firefox 67+)

---
*Stack research for: Quick Capture Item Entry (v1.9)*
*Researched: 2026-02-27*
