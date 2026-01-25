# Phase 2 Research: Mutation Queue & Optimistic UI

**Researched:** 2026-01-24
**Domain:** Offline mutations, optimistic UI, background sync
**Confidence:** HIGH

## Summary

This research covers the key technical areas needed to implement offline mutation queuing with optimistic UI updates. The project already has a solid Phase 1 foundation with IndexedDB (idb library) and offline context established. The backend uses UUIDv7 for all IDs, so the frontend should match this for idempotency keys.

Key findings:
1. **UUIDv7** is strongly recommended for idempotency keys due to time-ordering benefits for IndexedDB queries and database performance
2. **React 19's useOptimistic** provides built-in support for optimistic updates with automatic rollback on failure
3. **Serwist BackgroundSyncPlugin** handles Chrome/Edge but Safari requires manual fallback using `online` and `visibilitychange` events
4. **Service worker to main thread communication** can use BroadcastChannel for simplicity or MessageChannel for targeted messaging

**Primary recommendation:** Use UUIDv7 via `uuid` npm package for idempotency keys, React 19 useOptimistic for UI updates, and implement iOS fallback using online + visibilitychange events.

## Idempotency Keys

### UUIDv7 vs UUID v4

**Recommendation: Use UUIDv7** (HIGH confidence)

| Aspect | UUIDv7 | UUIDv4 |
|--------|--------|--------|
| Time ordering | Yes (millisecond timestamp) | No (random) |
| IndexedDB performance | Excellent (sequential inserts) | Poor (random distribution) |
| Database lookup | Faster (time-ordered B-tree) | Slower (fragmented index) |
| Information leakage | Exposes creation time | None |
| Collision probability | Negligible | Negligible |

**Why UUIDv7 for this project:**
1. Backend already uses UUIDv7 (PostgreSQL `DEFAULT uuidv7()` in all tables)
2. Time-ordering allows efficient "get oldest pending mutations" queries
3. Sequential IDs improve IndexedDB write performance for mutation queue
4. Creation time visibility is acceptable (not a security-sensitive use case)

**JavaScript Implementation:**

```typescript
// Using uuid package (v10+)
import { v7 as uuidv7 } from 'uuid';

function generateIdempotencyKey(): string {
  return uuidv7(); // e.g., '019a26ab-9a66-71a9-a89e-63c35fce4a5a'
}
```

**Installation:** `bun add uuid` (uuid@13.0.0 supports v7)

### Server-Side Idempotency Handling

The backend should:
1. Store processed idempotency keys with their responses
2. Return cached response for duplicate keys (same key = same response)
3. TTL recommendation: **7 days** (matches queue entry TTL from requirements)
4. Storage: Redis with automatic expiration or database table with cleanup job

**Pattern:**
```go
// Check if request was already processed
if cachedResponse := getIdempotencyResponse(key); cachedResponse != nil {
    return cachedResponse
}

// Process request
response := processRequest(payload)

// Store for deduplication
storeIdempotencyResponse(key, response, 7*24*time.Hour)

return response
```

## React 19 useOptimistic

**Confidence: HIGH** (from official React documentation)

### API Reference

```typescript
const [optimisticState, addOptimistic] = useOptimistic(
  state,           // Current actual state (source of truth)
  updateFn         // (currentState, optimisticValue) => newState
);
```

**Parameters:**
- `state`: The value returned initially and when no action is pending
- `updateFn`: Pure function that merges current state with optimistic value

**Returns:**
- `optimisticState`: The current state (actual or optimistic)
- `addOptimistic`: Dispatcher to trigger optimistic update

### Integration Pattern for Offline Mutations

```typescript
import { useOptimistic, startTransition } from 'react';
import { useMutation } from '@/lib/hooks/use-offline-mutation';

function ItemList({ items }: { items: Item[] }) {
  const [optimisticItems, addOptimisticItem] = useOptimistic(
    items,
    (state, newItem: Omit<Item, 'id'> & { tempId: string; pending: true }) => [
      { ...newItem, id: newItem.tempId },
      ...state,
    ]
  );

  const { mutate } = useMutation({
    entity: 'items',
    operation: 'create',
  });

  async function handleCreate(data: ItemInput) {
    const tempId = generateIdempotencyKey();

    // 1. Optimistic update
    addOptimisticItem({ ...data, tempId, pending: true });

    // 2. Queue mutation (persists to IndexedDB)
    startTransition(async () => {
      await mutate(data, tempId);
    });
  }

  return (
    <ul>
      {optimisticItems.map((item) => (
        <li key={item.id} className={item.pending ? 'opacity-60' : ''}>
          {item.name}
          {item.pending && <span className="text-xs text-muted">(Saving...)</span>}
        </li>
      ))}
    </ul>
  );
}
```

### Key Behaviors

1. **Automatic rollback**: When async operation fails, optimistic state reverts to actual state
2. **Integration with startTransition**: Use for non-blocking updates
3. **Pure updateFn**: No side effects in the update function
4. **State reconciliation**: When actual state updates, optimistic state reconciles

### Rollback Strategy

React's useOptimistic handles rollback automatically when the promise rejects. For IndexedDB persistence across page refresh:

1. Mark items as `pending` in the optimistic state
2. On mount, load pending mutations from IndexedDB
3. Re-apply pending mutations to actual state
4. Keep `pending` flag until sync confirms success

```typescript
// On mount, merge pending mutations with actual state
useEffect(() => {
  async function loadPending() {
    const pending = await getMutationQueue();
    pending.forEach((mutation) => {
      if (mutation.operation === 'create') {
        addOptimisticItem({
          ...mutation.payload,
          tempId: mutation.idempotencyKey,
          pending: true,
        });
      }
    });
  }
  loadPending();
}, []);
```

## iOS/Safari Fallback

**Confidence: HIGH** (verified from multiple sources)

### Background Sync Support

| Browser | Background Sync API | Fallback Needed |
|---------|---------------------|-----------------|
| Chrome/Edge | Full support | No |
| Firefox | No support | Yes |
| Safari/iOS | No support | Yes |

**Detection:**
```typescript
function supportsBackgroundSync(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}
```

### Fallback Event Listeners

For browsers without Background Sync, use these events:

```typescript
// 1. Online event - fires when network connection restored
window.addEventListener('online', () => {
  processMutationQueue();
});

// 2. Visibility change - fires when app comes to foreground
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    processMutationQueue();
  }
});
```

### iOS-Specific Considerations

1. **HTTPS required**: Visibility events only fire over HTTPS
2. **5-second background limit**: App frozen after 5 seconds in background
3. **Storage limits**: ~50MB Cache API quota, possible 7-day eviction
4. **Service worker activation**: No guaranteed background execution

**iOS Sync Strategy:**
1. Sync on `online` event
2. Sync on `visibilitychange` when becoming visible
3. Sync on explicit user action (pull-to-refresh, manual sync button)
4. Request persistent storage to reduce eviction risk (already implemented in Phase 1)

### Implementation Pattern

```typescript
// In OfflineProvider or dedicated SyncManager
useEffect(() => {
  function handleOnline() {
    console.log('[Sync] Online event - processing queue');
    processMutationQueue();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      console.log('[Sync] Visibility change - processing queue');
      processMutationQueue();
    }
  }

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

## Serwist BackgroundSyncPlugin

**Confidence: MEDIUM** (based on Serwist documentation, limited real-world examples)

### Configuration for POST/PATCH Requests

```typescript
// frontend/app/sw.ts
import { BackgroundSyncPlugin, NetworkOnly } from "serwist";

const mutationSyncPlugin = new BackgroundSyncPlugin("mutation-queue", {
  maxRetentionTime: 7 * 24 * 60, // 7 days in minutes (matches OM-9)
});

// Register for POST requests (creates)
serwist.registerCapture(
  /\/api\/workspaces\/.*\/(items|inventory|locations|containers)/,
  new NetworkOnly({
    plugins: [mutationSyncPlugin],
  }),
  "POST"
);

// Register for PATCH requests (updates)
serwist.registerCapture(
  /\/api\/workspaces\/.*\/(items|inventory|locations|containers)/,
  new NetworkOnly({
    plugins: [mutationSyncPlugin],
  }),
  "PATCH"
);
```

### Handling 5xx Errors

By default, BackgroundSyncPlugin only catches network failures. To retry server errors:

```typescript
const serverErrorPlugin = {
  fetchDidSucceed: async ({ response }: { response: Response }) => {
    if (response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
    return response;
  },
};

serwist.registerCapture(
  /\/api\/.*/,
  new NetworkOnly({
    plugins: [serverErrorPlugin, mutationSyncPlugin],
  }),
  "POST"
);
```

### Service Worker to Main Thread Communication

**Option 1: BroadcastChannel (Recommended for simplicity)**

```typescript
// In service worker (sw.ts)
const channel = new BroadcastChannel('sync-status');

channel.postMessage({
  type: 'SYNC_COMPLETE',
  payload: { queueLength: 0 },
});

// In main thread (OfflineContext or SyncManager)
useEffect(() => {
  const channel = new BroadcastChannel('sync-status');

  channel.onmessage = (event) => {
    if (event.data.type === 'SYNC_COMPLETE') {
      refreshPendingCount();
      triggerDataRefresh();
    }
  };

  return () => channel.close();
}, []);
```

**Option 2: MessageChannel (For targeted communication)**

```typescript
// Main thread sends port to service worker
const messageChannel = new MessageChannel();
navigator.serviceWorker.controller?.postMessage(
  { type: 'INIT_PORT' },
  [messageChannel.port2]
);

messageChannel.port1.onmessage = (event) => {
  console.log('Received from SW:', event.data);
};
```

### Queue Status Access

The BackgroundSyncPlugin stores queued requests in IndexedDB under `serwist-background-sync` database. To get queue count:

```typescript
async function getBackgroundSyncQueueCount(): Promise<number> {
  const db = await openDB('serwist-background-sync', 3);
  const tx = db.transaction('requests', 'readonly');
  const store = tx.objectStore('requests');
  return store.count();
}
```

**Note:** This is implementation detail and may change. For robust solution, maintain separate queue in main thread IndexedDB (already planned in Phase 2).

## Retry/Backoff Strategy

**Confidence: HIGH**

### Exponential Backoff Implementation

```typescript
interface RetryConfig {
  initialDelay: number;     // 1000ms (1 second)
  maxDelay: number;         // 30000ms (30 seconds) - from OM-7
  maxRetries: number;       // 5 - from OM-8
  factor: number;           // 2 (doubles each retry)
  jitter: boolean;          // true (prevents thundering herd)
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  maxRetries: 5,
  factor: 2,
  jitter: true,
};

function calculateDelay(retryCount: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.factor, retryCount);
  const delay = Math.min(exponentialDelay, config.maxDelay);

  if (config.jitter) {
    // Add random jitter between 0-100% of calculated delay
    return delay * (0.5 + Math.random() * 0.5);
  }

  return delay;
}

// Retry sequence: 1s, 2s, 4s, 8s, 16s (capped at 30s)
```

### Retry Decision Logic

```typescript
function shouldRetry(error: Error, response?: Response): boolean {
  // Network error - always retry
  if (!response) return true;

  // 5xx server errors - retry
  if (response.status >= 500) return true;

  // 429 Too Many Requests - retry with backoff
  if (response.status === 429) return true;

  // 4xx client errors (except 429) - don't retry
  if (response.status >= 400 && response.status < 500) return false;

  // Success - don't retry
  return false;
}
```

### Max Retries Handling

When max retries exceeded (OM-8):
1. Mark mutation as `failed` in queue
2. Keep in queue for manual retry option
3. Surface error to user via sync status indicator
4. Allow user to retry manually or discard

```typescript
if (mutation.retries >= config.maxRetries) {
  await updateMutationStatus(mutation.id, {
    status: 'failed',
    lastError: error.message,
  });

  // Notify user
  notifyMutationFailed(mutation);
  return;
}
```

## Optimistic UI Patterns

**Confidence: HIGH**

### Visual Indicators for Pending State

| State | Visual Treatment | Icon |
|-------|-----------------|------|
| Pending | Reduced opacity (60%), italic text, "Saving..." label | Loader spinner |
| Syncing | Subtle pulse animation | Sync arrows |
| Failed | Red border/text, error icon | AlertCircle |
| Synced | Normal styling | None or brief checkmark |

```typescript
// Example styling with Tailwind
const itemClasses = cn(
  "p-4 border rounded",
  item.syncStatus === 'pending' && "opacity-60 italic border-dashed",
  item.syncStatus === 'syncing' && "animate-pulse",
  item.syncStatus === 'failed' && "border-red-500 bg-red-50",
);
```

### Badge for Pending Count

```typescript
// In header or nav
function PendingChangesBadge() {
  const { pendingCount } = useOffline();

  if (pendingCount === 0) return null;

  return (
    <Badge variant="secondary" className="ml-2">
      {pendingCount} pending
    </Badge>
  );
}
```

### Persist Optimistic State Across Refresh

Strategy: Store pending mutations in IndexedDB, reconstruct optimistic state on mount.

```typescript
// MutationQueueEntry in IndexedDB
interface MutationQueueEntry {
  id: number;                    // Auto-incremented
  idempotencyKey: string;        // UUIDv7
  operation: 'create' | 'update';
  entity: string;
  entityId?: string;
  payload: Record<string, any>;
  timestamp: number;
  retries: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

// On mount, reconstruct optimistic state
useEffect(() => {
  async function restoreOptimisticState() {
    const pending = await getMutationQueue();

    // Group by entity
    const byEntity = groupBy(pending, 'entity');

    // Apply to relevant stores
    for (const [entity, mutations] of Object.entries(byEntity)) {
      for (const mutation of mutations) {
        if (mutation.operation === 'create') {
          addOptimisticCreate(entity, mutation);
        } else if (mutation.operation === 'update') {
          addOptimisticUpdate(entity, mutation);
        }
      }
    }
  }

  restoreOptimisticState();
}, []);
```

## Implementation Recommendations

### 1. Mutation Queue Schema

Update IndexedDB schema to include mutation queue (DB version bump):

```typescript
// Add to offline-db.ts upgrade handler
if (!db.objectStoreNames.contains("mutationQueue")) {
  const store = db.createObjectStore("mutationQueue", {
    keyPath: "id",
    autoIncrement: true,
  });
  store.createIndex("status", "status", { unique: false });
  store.createIndex("entity", "entity", { unique: false });
  store.createIndex("timestamp", "timestamp", { unique: false });
  store.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
}
```

### 2. Sync Manager Architecture

Create a centralized SyncManager class:

```typescript
// frontend/lib/sync/sync-manager.ts
class SyncManager {
  private isProcessing = false;
  private channel = new BroadcastChannel('sync-status');

  async queueMutation(entry: Omit<MutationQueueEntry, 'id'>): Promise<string>;
  async processMutationQueue(): Promise<void>;
  async getMutationCount(): Promise<number>;
  async retryMutation(id: number): Promise<void>;
  async cancelMutation(id: number): Promise<void>;
  async clearAllMutations(): Promise<void>;

  // Subscribe to queue changes
  onQueueChange(callback: (count: number) => void): () => void;
}
```

### 3. Hook API Design

```typescript
// frontend/lib/hooks/use-offline-mutation.ts
function useOfflineMutation<TData, TPayload>(options: {
  entity: EntityType;
  operation: 'create' | 'update';
  mutationFn: (payload: TPayload) => Promise<TData>;
  onOptimisticUpdate?: (payload: TPayload, tempId: string) => void;
  onSuccess?: (data: TData, payload: TPayload) => void;
  onError?: (error: Error, payload: TPayload) => void;
}): {
  mutate: (payload: TPayload, entityId?: string) => Promise<void>;
  isQueued: boolean;
  queuedCount: number;
};
```

### 4. Service Worker Integration

Minimal SW changes needed - main queue processing in main thread with SW as fallback:

1. **Main thread (primary):** Process queue on online/visibility events
2. **Service worker (backup):** BackgroundSyncPlugin catches failures, notifies main thread

### 5. Testing Strategy for iOS

1. Use Safari Web Inspector on Mac connected to iOS device
2. Test offline by enabling Airplane Mode (not DevTools network throttling)
3. Verify queue persists when app minimized and reopened
4. Test visibilitychange fires when switching apps
5. Verify sync triggers when returning to app after being offline

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom timestamp+random | `uuid` package v7 | RFC 9562 compliant, tested |
| Exponential backoff | Custom delay logic | `exponential-backoff` npm or inline formula | Edge cases (jitter, overflow) |
| IndexedDB wrapper | Raw IndexedDB API | `idb` (already used) | Promise-based, typed, error handling |
| Optimistic updates | Custom state layer | React 19 `useOptimistic` | Built-in rollback, framework integration |
| Background sync | Custom SW queue | Serwist BackgroundSyncPlugin (with fallback) | Browser-managed retry |

## Common Pitfalls

### Pitfall 1: Lost Mutations on Page Refresh

**What goes wrong:** Optimistic state in React is lost on refresh, user thinks data saved
**Why it happens:** React state not persisted, IndexedDB write happens async
**How to avoid:** Write to IndexedDB BEFORE updating optimistic state; on mount, restore from queue
**Warning signs:** User reports "lost" data after closing app

### Pitfall 2: Duplicate Submissions

**What goes wrong:** Same mutation sent twice, creates duplicate records
**Why it happens:** Network timeout interpreted as failure, user retries
**How to avoid:** Idempotency keys + server-side deduplication
**Warning signs:** Duplicate items appearing in lists

### Pitfall 3: Race Conditions in Queue Processing

**What goes wrong:** Same mutation processed simultaneously by SW and main thread
**Why it happens:** Both online event and BackgroundSync fire close together
**How to avoid:** Use `isProcessing` flag, single-thread queue processing, status-based filtering
**Warning signs:** Intermittent duplicate requests in network logs

### Pitfall 4: iOS PWA Eviction

**What goes wrong:** IndexedDB data lost after app not used for ~7 days
**Why it happens:** Safari's storage eviction policy
**How to avoid:** Request persistent storage (Phase 1 already does this), sync on every app open
**Warning signs:** User opens app after vacation, all offline data gone

### Pitfall 5: Stale Optimistic State

**What goes wrong:** UI shows outdated pending state after sync completes
**Why it happens:** Main thread not notified of SW sync completion
**How to avoid:** BroadcastChannel notifications, refresh data after sync
**Warning signs:** "Saving..." indicator never disappears

## Open Questions

1. **Conflict resolution strategy**
   - What we know: Need to handle edits to same entity from multiple devices
   - What's unclear: Server-side merge strategy (last-write-wins vs. field-level merge)
   - Recommendation: Start with last-write-wins using `updated_at` timestamp, revisit if issues arise

2. **Delete operation handling**
   - What we know: Requirements mention create/update, not delete
   - What's unclear: Should offline deletes be supported?
   - Recommendation: Defer delete support to later phase, focus on create/update first

3. **Queue size limits**
   - What we know: 7-day TTL for entries (OM-9)
   - What's unclear: Max queue size before warning user
   - Recommendation: Warn at 100+ pending mutations, refuse new mutations at 1000

## Sources

### Primary (HIGH confidence)
- [React useOptimistic official docs](https://react.dev/reference/react/useOptimistic) - API reference, usage patterns
- [Serwist Background Synchronization Guide](https://serwist.pages.dev/docs/serwist/guide/background-syncing) - Plugin configuration
- [Serwist BackgroundSyncPlugin API](https://serwist.pages.dev/docs/serwist/runtime-caching/plugins/background-sync-plugin) - Constructor options

### Secondary (MEDIUM confidence)
- [UUID.js GitHub](https://github.com/uuidjs/uuid) - v7 support confirmation
- [web.dev Two-way communication guide](https://web.dev/articles/two-way-communication-guide) - SW messaging patterns
- [Better Stack exponential backoff](https://betterstack.com/community/guides/monitoring/exponential-backoff/) - Backoff algorithms

### Tertiary (LOW confidence)
- [Can I Use Background Sync](https://caniuse.com/background-sync) - Browser support data
- [Workbox Background Sync issues](https://github.com/GoogleChrome/workbox/issues/2386) - Safari fallback gotchas
- Various Medium/Dev.to articles on optimistic UI patterns

## Metadata

**Confidence breakdown:**
- Idempotency keys: HIGH - Backend already uses UUIDv7, uuid package well-documented
- React 19 useOptimistic: HIGH - Official React documentation
- iOS fallback: HIGH - Well-documented limitation, clear event-based workaround
- Serwist integration: MEDIUM - Documentation clear but limited real-world examples
- Retry/backoff: HIGH - Standard algorithm, well-established patterns

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable domain)
