# Phase 44: Capture Infrastructure - Research

**Researched:** 2026-02-27
**Domain:** IndexedDB schema extension, React hooks/contexts, offline mutation wiring for quick capture
**Confidence:** HIGH

## Summary

Phase 44 builds the data layer and hook foundations that Phase 45 (Quick Capture UI) will consume. All work is frontend-only -- Phase 43 already shipped the backend `needs_review` column, API filter, and sync endpoint. The phase adds a new IndexedDB object store for photo blobs (schema v5), an auto-SKU generation hook, a React context for sticky batch settings, and wires offline item creation through the existing `useOfflineMutation` infrastructure with `needs_review=true`.

The project already has every library needed (idb 8.0.3, uuid 13.0.0, react-hook-form, zod). Zero new npm dependencies. The work is extending existing patterns (IndexedDB upgrade path, React context provider, custom hooks) and creating a batch settings bar component. The `useOfflineMutation` hook requires no changes -- it already handles item creates with idempotency keys, optimistic writes, and entity-ordered sync.

**Primary recommendation:** Structure the phase into two plans: (1) IndexedDB v5 schema + photo store types + auto-SKU hook, (2) batch settings context + batch settings bar component + offline item creation wiring with needs_review.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QC-05 | System auto-generates SKU for quick-captured items | Auto-SKU hook generating `QC-{timestamp}-{random}` pattern. Client-side, no server round-trip needed. Backend accepts any non-empty SKU string within VARCHAR(50). |
| BATCH-01 | User can set a default category that applies to all items in the session | Batch settings context with `categoryId` field, populated from offline-cached categories in IndexedDB `categories` store. |
| BATCH-02 | User can set a default location that applies to all items in the session | Batch settings context with `locationId` field, populated from offline-cached locations in IndexedDB `locations` store. Note: location is stored in context only -- items table has no location_id column. Location applies to future inventory creation (Phase 46+). |
| BATCH-03 | User sees a batch settings bar showing current category/location defaults | New `BatchSettingsBar` component rendering tappable pills for current category/location names. Reads from batch settings context. |
| BATCH-04 | Batch settings persist across items but reset when session ends | `sessionStorage` for persistence (dies on tab close). React state initialized from sessionStorage, written on each change. |
| SYNC-01 | Quick capture works fully offline -- items queued in IndexedDB | Existing `useOfflineMutation` hook with `entity: "items"`, `operation: "create"` queues to `mutationQueue` store. Payload includes `needs_review: true`, auto-generated SKU, name, and optional `category_id` from batch settings. |
| SYNC-02 | Photos stored as blobs in IndexedDB for offline display | New `quickCapturePhotos` object store in IndexedDB v5. Stores `Blob` objects keyed by auto-increment ID, indexed by `tempItemId` (idempotency key linking to mutation queue entry). |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | Type-safe IndexedDB wrapper for schema v5 upgrade and photo blob store | Already the project's IndexedDB standard. Supports Blob storage natively. |
| uuid | 13.0.0 | UUIDv7 generation for capture photo IDs | Already used for idempotency keys throughout offline mutation system. |
| React Context | (built-in) | Batch settings state management | Project pattern -- 3 existing contexts in `lib/contexts/`. No external state management libraries. |
| sessionStorage | (built-in) | Batch settings persistence across captures within a tab session | Intentionally ephemeral -- resets on tab close. Correct for spatial context like "I'm in the garage right now." |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.70.0 | Minimal form validation for batch settings selectors | If batch settings need form-like validation (optional). |
| ios-haptics | 0.1.4 | Haptic feedback integration in batch settings bar | Existing `useHaptic` hook wraps this. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sessionStorage for batch settings | IndexedDB via useFormDraft | useFormDraft persists to IndexedDB formDrafts store which survives tab close -- wrong semantics for batch settings that should reset per session. sessionStorage has exactly the right lifecycle. |
| React Context for batch settings | zustand / jotai | Project has zero external state management libraries. Adding one for a context with 4 fields is over-engineering. |
| Auto-increment key for photo store | UUID key | Auto-increment is simpler for sequential photo storage. The `tempItemId` index handles lookup by item. Matches `mutationQueue` and `conflictLog` store patterns. |

**Installation:**
```bash
# No new packages to install.
# All capabilities come from extending existing code.
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── lib/
│   ├── db/
│   │   ├── offline-db.ts          # MODIFY: Add v5 upgrade with quickCapturePhotos store
│   │   └── types.ts               # MODIFY: Add CapturePhoto type, extend OfflineDBSchema
│   ├── types/
│   │   └── items.ts               # MODIFY: Add needs_review field to Item, ItemCreate
│   ├── contexts/
│   │   └── batch-capture-context.tsx  # NEW: Batch settings provider + hook
│   └── hooks/
│       ├── use-auto-sku.ts           # NEW: Auto-SKU generation hook
│       └── use-capture-photos.ts     # NEW: CRUD operations for quickCapturePhotos store
├── components/
│   └── quick-capture/
│       └── batch-settings-bar.tsx    # NEW: Horizontal bar showing current category/location
```

### Pattern 1: IndexedDB Schema Versioning (Existing Pattern)

**What:** Incremental schema upgrades in the `offline-db.ts` `upgrade` callback, gated by `oldVersion < N`.
**When to use:** Every time the IndexedDB schema needs a new object store or index.
**Example:**
```typescript
// Source: frontend/lib/db/offline-db.ts (existing pattern)
// Add quickCapturePhotos store in v5
if (oldVersion < 5) {
  const photoStore = db.createObjectStore("quickCapturePhotos", {
    keyPath: "id",
    autoIncrement: true,
  });
  photoStore.createIndex("tempItemId", "tempItemId", { unique: false });
  photoStore.createIndex("status", "status", { unique: false });
}
```

### Pattern 2: React Context Provider (Existing Pattern)

**What:** Context + Provider + `useContext` hook pattern used for app-wide state.
**When to use:** State shared across multiple components within a subtree.
**Example:**
```typescript
// Source: frontend/lib/contexts/offline-context.tsx (existing pattern)
const BatchCaptureContext = createContext<BatchCaptureContextValue | undefined>(undefined);

export function BatchCaptureProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BatchSettings>(() => {
    if (typeof sessionStorage === "undefined") return DEFAULT_SETTINGS;
    const saved = sessionStorage.getItem("quickCaptureBatch");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Write to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem("quickCaptureBatch", JSON.stringify(settings));
  }, [settings]);

  // ...
}

export function useBatchCapture() {
  const ctx = useContext(BatchCaptureContext);
  if (!ctx) throw new Error("useBatchCapture must be used within BatchCaptureProvider");
  return ctx;
}
```

### Pattern 3: useOfflineMutation for Item Create (Existing Pattern)

**What:** Queue a create mutation to IndexedDB, write optimistic data, trigger sync.
**When to use:** Any entity creation that must work offline.
**Example:**
```typescript
// Source: frontend/lib/hooks/use-offline-mutation.ts (existing pattern)
const { mutate, isPending } = useOfflineMutation<ItemCreatePayload>({
  entity: "items",
  operation: "create",
  onMutate: (payload, tempId) => {
    // Optimistic UI update -- increment capture counter
    incrementCaptureCount();
  },
});

// In capture handler:
const sku = generateAutoSKU();
const tempId = await mutate({
  sku,
  name,
  needs_review: true,
  category_id: batchSettings.categoryId || undefined,
});
```

### Anti-Patterns to Avoid

- **Storing photo blobs in the mutation payload:** Base64 inflates size 33%. The mutation queue sends JSON via `Content-Type: application/json`. Photo blobs belong in a separate store, uploaded via multipart FormData after item sync (Phase 46).
- **Using localStorage for batch settings:** 5MB limit across ALL keys, synchronous (blocks main thread), strings only. Use sessionStorage for ephemeral settings or IndexedDB for persistent data.
- **Reusing the MultiStepForm/CreateItemWizard:** The wizard calls `itemsApi.create()` directly (fails offline), navigates between steps, and redirects on submit. Quick capture needs `useOfflineMutation` with a save-and-repeat loop.
- **Validating SKU uniqueness against the server during capture:** Defeats offline-first. Let the server validate at sync time. Collision is astronomically unlikely with `QC-{timestamp}-{random}`.
- **Persisting batch settings in localStorage/IndexedDB:** Batch settings represent spatial context ("I'm in the kitchen"). They should die when the tab closes. sessionStorage has exactly this lifecycle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB typed access | Raw IndexedDB API | idb v8 `openDB` with `OfflineDBSchema` | Type safety, promise-based, existing pattern across 10 stores |
| Unique ID generation | `Math.random()` string | `uuid` v13 UUIDv7 | Time-ordered, globally unique, already used for idempotency keys |
| Image compression | Canvas-based compression from scratch | Existing `compressImage()` in `lib/utils/image.ts` | Already handles 1920px max dimension, 0.85 JPEG quality, size thresholds |
| Haptic feedback | Direct `navigator.vibrate` calls | Existing `useHaptic` hook wrapping ios-haptics | Cross-platform (iOS 17.4+ Safari + Android), already tested |
| Offline mutation queue | Custom sync queue | Existing `useOfflineMutation` + `SyncManager` | UUIDv7 idempotency, entity-ordered sync, dependency tracking, conflict resolution |

**Key insight:** Phase 44 creates NEW infrastructure (photo store, auto-SKU, batch context) but relies entirely on EXISTING infrastructure for offline mutations, sync, compression, and haptics. The only existing code that needs modification is the IndexedDB schema (version bump) and the Item type (add `needs_review` field).

## Common Pitfalls

### Pitfall 1: IndexedDB Version Bump Breaking Existing Data
**What goes wrong:** Changing `DB_VERSION` from 4 to 5 triggers the `upgrade` callback. If the upgrade logic is not properly gated with `oldVersion < 5`, it could attempt to recreate existing stores and throw `ConstraintError`.
**Why it happens:** The upgrade runs for ALL version transitions (0->5, 1->5, 4->5). Each store creation must be guarded.
**How to avoid:** Follow the existing pattern: `if (oldVersion < 5) { ... }`. Only create the new `quickCapturePhotos` store in this block. Do NOT modify existing stores.
**Warning signs:** `ConstraintError: An object store with the specified name already exists` in console.

### Pitfall 2: Blob Storage Quota on iOS Safari
**What goes wrong:** iOS Safari has stricter IndexedDB quotas (~50MB default). A large batch capture session with many photos could hit the limit.
**Why it happens:** Each compressed photo is 200KB-2MB. A 50-item session with 2 photos each = 20-200MB.
**How to avoid:** The project already calls `requestPersistentStorage()` on DB init. Add a storage estimate check before saving photos: `navigator.storage.estimate()` returns `usage` and `quota`. Warn the user if approaching 80% capacity. Consider limiting to 1-3 photos per item in the capture flow.
**Warning signs:** `QuotaExceededError` from IndexedDB put operations. Silent data loss if errors are swallowed.

### Pitfall 3: sessionStorage Not Available in SSR
**What goes wrong:** `sessionStorage` is a browser-only API. Accessing it during server-side rendering throws `ReferenceError`.
**Why it happens:** Next.js 16 renders components on the server first. The batch settings context initializer runs during SSR.
**How to avoid:** Guard with `typeof sessionStorage !== "undefined"` or `typeof window !== "undefined"` before access. Use a default state for SSR, hydrate from sessionStorage in a `useEffect`. Follow the existing pattern in `useOfflineMutation` which guards `localStorage` access similarly.
**Warning signs:** Hydration mismatch warnings, `ReferenceError: sessionStorage is not defined`.

### Pitfall 4: Auto-SKU Collision at Sync Time
**What goes wrong:** Two items captured in the same millisecond with the same 4-char random suffix would have duplicate SKUs. The backend's `SKUExists` check rejects the second one with a 400/422.
**Why it happens:** `QC-{Date.now()}-{random4}` has ~1.6M combinations per millisecond (36^4). Collision is astronomically unlikely but theoretically possible.
**How to avoid:** Use `Date.now().toString(36)` for the timestamp (compact) and `Math.random().toString(36).substring(2, 6)` for the random part. If a 422 error occurs at sync time due to SKU collision, the SyncManager will mark it as a non-retryable client error. The user would need to manually resolve. Document this edge case but do not over-engineer a solution.
**Warning signs:** 422 responses in SyncManager logs with "SKU already exists" error.

### Pitfall 5: needs_review Field Not in Frontend Item Type
**What goes wrong:** The frontend `Item` interface in `lib/types/items.ts` does not yet include `needs_review`. The backend API (Phase 43) already returns it. Offline mutations sending `needs_review: true` would work (it's just a JSON payload), but the optimistic item written to the IndexedDB `items` store would not have the field typed.
**Why it happens:** Phase 43 was backend-only. The frontend type was not updated.
**How to avoid:** Add `needs_review?: boolean` to `Item`, `ItemCreate`, and `ItemUpdate` interfaces as the first task in this phase.
**Warning signs:** TypeScript errors when accessing `item.needs_review`, or the field silently being stripped by strict type checking.

## Code Examples

### IndexedDB v5 Schema Upgrade
```typescript
// Source: Extends existing pattern in frontend/lib/db/offline-db.ts
const DB_VERSION = 5;

// In upgrade callback:
if (oldVersion < 5) {
  const photoStore = db.createObjectStore("quickCapturePhotos", {
    keyPath: "id",
    autoIncrement: true,
  });
  photoStore.createIndex("tempItemId", "tempItemId", { unique: false });
  photoStore.createIndex("status", "status", { unique: false });
}
```

### CapturePhoto Type Definition
```typescript
// Source: Extends existing pattern in frontend/lib/db/types.ts
export interface CapturePhoto {
  /** Auto-incremented ID */
  id: number;
  /** Links to mutation queue entry's idempotency key */
  tempItemId: string;
  /** Compressed image blob */
  blob: Blob;
  /** Capture timestamp (ms since epoch) */
  capturedAt: number;
  /** Upload status */
  status: "pending" | "uploading" | "uploaded" | "failed";
}

// Add to OfflineDBSchema:
quickCapturePhotos: {
  key: number;
  value: CapturePhoto;
  indexes: {
    tempItemId: string;
    status: string;
  };
};
```

### Auto-SKU Generation Hook
```typescript
// Source: Derived from v1.9 architecture research recommendation
export function useAutoSKU() {
  const generateSKU = useCallback((): string => {
    const ts = Date.now().toString(36);       // compact timestamp
    const rand = Math.random().toString(36).substring(2, 6); // 4 random chars
    return `QC-${ts}-${rand}`;
    // e.g., "QC-m2k4f7a-a3b1" (18 chars, well within VARCHAR(50))
  }, []);

  return { generateSKU };
}
```

### Batch Settings Context
```typescript
// Source: Follows pattern from frontend/lib/contexts/offline-context.tsx
interface BatchSettings {
  categoryId: string | null;
  locationId: string | null;
}

interface BatchCaptureContextValue {
  settings: BatchSettings;
  setCategoryId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
  resetSettings: () => void;
  captureCount: number;
  incrementCaptureCount: () => void;
}

// Provider initializes from sessionStorage, writes on change.
// Context dies when provider unmounts (session ends).
```

### Offline Item Creation with needs_review
```typescript
// Source: Extends existing pattern from useOfflineMutation usage in items page
const { mutate, isPending } = useOfflineMutation<Record<string, unknown>>({
  entity: "items",
  operation: "create",
  onMutate: (_payload, _tempId) => {
    incrementCaptureCount();
  },
});

async function captureItem(name: string, photos: File[]) {
  const sku = generateSKU();
  const tempId = await mutate({
    sku,
    name,
    needs_review: true,
    category_id: batchSettings.categoryId || undefined,
  });
  // Store photos in quickCapturePhotos store linked to tempId
  for (const photo of photos) {
    await storeCapturePhoto(tempId, photo);
  }
}
```

### Batch Settings Bar Component
```typescript
// Source: New component following existing shadcn/ui patterns
export function BatchSettingsBar() {
  const { settings, setCategoryId, setLocationId } = useBatchCapture();
  // Read category/location names from offline IndexedDB cache
  // Render as tappable pills: [Kitchen] [Electronics]
  // Tapping opens a selector sheet populated from cached data
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct API calls for item creation (CreateItemWizard) | useOfflineMutation for offline-capable creation | v1.0 (2026-01-24) | Quick capture uses mutation queue, not direct API |
| localStorage for form persistence | IndexedDB via useFormDraft (v4 schema) | v1.3 (2026-01-31) | More storage, async, structured data |
| Derived "incomplete" status from empty fields | Explicit `needs_review` boolean column | v1.9 Phase 43 (2026-02-27) | Queryable, intentional, forward-compatible |

**Deprecated/outdated:**
- None relevant to this phase. All infrastructure is current.

## Open Questions

1. **Location in batch settings: display-only or functional?**
   - What we know: `warehouse.items` table has no `location_id` column. Location is tracked via `warehouse.inventory` table entries. The batch settings location cannot be applied to the item create payload.
   - What's unclear: Should location be stored in batch context purely for future inventory creation (Phase 46+), or should it be omitted from Phase 44 entirely?
   - Recommendation: Include `locationId` in the batch settings context and display it in the bar, but do NOT create inventory entries. The context is ready for Phase 46 to consume. This satisfies BATCH-02 (user can set a default location) without requiring inventory mutation wiring.

2. **Photo count limit per item in the capture store**
   - What we know: The success criteria says "1-5 photos per item" (from QC-03, which is Phase 45). Storage budget is ~200KB-2MB per compressed photo.
   - What's unclear: Should the photo store enforce a max count, or should it be unlimited and let the UI enforce limits?
   - Recommendation: No store-level limit. The store is infrastructure -- let Phase 45's UI enforce the 1-5 photo limit. The store should accept any number of photos per tempItemId.

3. **Capture photo thumbnail generation**
   - What we know: The v1.9 stack research suggested pre-generating base64 thumbnails at capture time for fast list rendering.
   - What's unclear: Is this needed for Phase 44 (infrastructure) or Phase 45 (UI)?
   - Recommendation: Defer to Phase 45. The `CapturePhoto` type can include an optional `thumbnail?: string` field, but the hook does not need to generate thumbnails. Phase 45 can add thumbnail generation when building the session summary UI.

## Sources

### Primary (HIGH confidence)
- Codebase: `frontend/lib/db/offline-db.ts` -- Current IndexedDB schema at v4 with 10 stores, upgrade pattern
- Codebase: `frontend/lib/db/types.ts` -- OfflineDBSchema interface, MutationQueueEntry, FormDraft types
- Codebase: `frontend/lib/hooks/use-offline-mutation.ts` -- Offline mutation hook API, optimistic writes pattern
- Codebase: `frontend/lib/sync/sync-manager.ts` -- SyncManager with entity-ordered sync, resolvedIds map
- Codebase: `frontend/lib/types/items.ts` -- Current Item/ItemCreate/ItemUpdate interfaces (no needs_review yet)
- Codebase: `frontend/lib/contexts/offline-context.tsx` -- React context provider pattern
- Codebase: `frontend/lib/hooks/use-haptic.ts` -- Haptic feedback hook pattern
- Codebase: `frontend/lib/hooks/use-form-draft.ts` -- IndexedDB form draft persistence pattern

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- v1.9 architecture research with data flow and component boundaries
- `.planning/research/STACK.md` -- v1.9 stack research confirming zero new dependencies
- `.planning/research/FEATURES.md` -- Feature landscape with anti-features and dependency graph
- `.planning/phases/43-backend-schema-and-needs-review-api/43-01-PLAN.md` -- Backend needs_review implementation details
- `.planning/phases/43-backend-schema-and-needs-review-api/43-02-PLAN.md` -- HTTP API and sync endpoint for needs_review

### Tertiary (LOW confidence)
- None. All findings are codebase-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies, all existing libraries verified in package.json
- Architecture: HIGH - All patterns derived from existing codebase patterns (IndexedDB upgrade, React context, useOfflineMutation)
- Pitfalls: HIGH - Based on known IndexedDB behavior, existing project constraints, and Phase 43 implementation gaps

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- no external dependency changes expected)
