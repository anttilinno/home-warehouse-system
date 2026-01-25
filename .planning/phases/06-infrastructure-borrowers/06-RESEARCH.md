# Phase 6: Infrastructure & Borrowers - Research

**Researched:** 2026-01-24
**Domain:** Offline mutation infrastructure (dependency-aware sync) and borrowers entity offline support
**Confidence:** HIGH

## Summary

Phase 6 establishes dependency-aware sync infrastructure and delivers offline mutations for borrowers - the simplest entity in the system with no foreign keys and no hierarchy. This is the foundational phase for v1.1 that enables subsequent phases to handle hierarchical (categories, locations) and multi-FK (containers, inventory) entities.

The existing offline infrastructure from v1 is architecturally sound for single-entity mutations (items). What needs to be added is: (1) a `dependsOn` field in `MutationQueueEntry` for prerequisite tracking, (2) entity-type ordering in sync manager to process mutations in dependency order, (3) inline topological sort (~20 lines, Kahn's algorithm) for hierarchical entities, and (4) cascade failure handling when parent mutations fail. Borrowers serve as the validation entity - they use the extended infrastructure without complexity (no FKs, no hierarchy).

**Primary recommendation:** Extend `MutationQueueEntry` type with optional `dependsOn: string[]` field, implement entity-level sync ordering in `sync-manager.ts`, add cascade failure handling, then mirror the items pattern for borrowers with create/update offline support.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | IndexedDB wrapper with typed stores | Already integrated, 9 stores including mutationQueue |
| uuid | 13.0.0 | UUIDv7 generation for idempotency | Already used for temp IDs that become permanent |
| useOfflineMutation | internal | Queue mutations with optimistic UI | Established pattern from items implementation |
| syncManager | internal | Queue processing with BroadcastChannel | Handles iOS fallback, retry logic, conflicts |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mutation-queue.ts | internal | CRUD operations on mutation queue | queueMutation, getPendingMutations |
| conflict-resolver.ts | internal | Conflict detection and resolution | CRITICAL_FIELDS configuration |
| offline-db.ts | internal | Generic IndexedDB CRUD | Entity store operations |

### No New Dependencies Required
All infrastructure exists. No npm packages needed for topological sort - inline implementation is ~20 lines.

## Architecture Patterns

### Entity Sync Order (CRITICAL)
```
ENTITY_SYNC_ORDER = [
  "categories",   // No FK dependencies
  "locations",    // Self-referential hierarchy (parent_location)
  "borrowers",    // No FK dependencies
  "containers",   // FK: location_id
  "items",        // FK: category_id (optional)
  "inventory",    // FK: item_id, location_id, container_id (optional)
  "loans"         // FK: inventory_id, borrower_id
]
```

**Rationale:** Each entity type must sync after its dependencies. Categories before items (which reference categories). Locations before containers (which reference locations). Items and locations before inventory.

### Pattern 1: MutationQueueEntry Extension
**What:** Add optional `dependsOn` field for prerequisite tracking
**When to use:** Create operations that reference other pending creates
**Schema change:**
```typescript
// Source: frontend/lib/db/types.ts - MutationQueueEntry
interface MutationQueueEntry {
  // ... existing fields ...

  /** Optional array of idempotency keys this mutation depends on */
  dependsOn?: string[];
}
```

**Usage in hierarchical entities (Phase 7+):**
```typescript
// When creating a child location under a pending parent
const childEntry = await queueMutation({
  operation: 'create',
  entity: 'locations',
  payload: { name: 'Child', parent_location: parentTempId },
  dependsOn: [parentIdempotencyKey], // Wait for parent to sync first
});
```

### Pattern 2: Entity-Ordered Queue Processing
**What:** Process pending mutations grouped by entity type in dependency order
**When to use:** Always (in sync-manager.ts processQueue)
**Example:**
```typescript
// Source: Pattern for sync-manager.ts
const ENTITY_SYNC_ORDER: MutationEntityType[] = [
  'categories', 'locations', 'borrowers', 'containers', 'items', 'inventory', 'loans'
];

async processQueue(): Promise<void> {
  // ... existing locking logic ...

  const pending = await getPendingMutations();

  // Group mutations by entity type
  const byEntity = new Map<MutationEntityType, MutationQueueEntry[]>();
  for (const mutation of pending) {
    const list = byEntity.get(mutation.entity) || [];
    list.push(mutation);
    byEntity.set(mutation.entity, list);
  }

  // Process in entity order
  for (const entityType of ENTITY_SYNC_ORDER) {
    const mutations = byEntity.get(entityType) || [];
    // For hierarchical entities, apply topological sort here (Phase 7+)
    for (const mutation of mutations) {
      await this.processMutation(mutation);
    }
  }
}
```

### Pattern 3: Topological Sort for Hierarchical Entities
**What:** Sort create operations within an entity type by parent-child dependency
**When to use:** Categories and locations (self-referential hierarchies)
**Algorithm:** Kahn's algorithm (~20 lines)
```typescript
// Source: Inline implementation for sync-manager.ts
function topologicalSort(mutations: MutationQueueEntry[]): MutationQueueEntry[] {
  // Build dependency graph from parent references
  const indegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const m of mutations) {
    indegree.set(m.idempotencyKey, 0);
    graph.set(m.idempotencyKey, []);
  }

  // Find parent references in payload (parent_location, parent_category_id)
  for (const m of mutations) {
    const parentRef = m.payload.parent_location || m.payload.parent_category_id;
    if (parentRef && indegree.has(parentRef as string)) {
      // parentRef is a pending mutation's tempId
      indegree.set(m.idempotencyKey, (indegree.get(m.idempotencyKey) || 0) + 1);
      graph.get(parentRef as string)!.push(m.idempotencyKey);
    }
  }

  // Kahn's algorithm
  const queue = [...mutations].filter(m => indegree.get(m.idempotencyKey) === 0);
  const result: MutationQueueEntry[] = [];

  while (queue.length > 0) {
    const m = queue.shift()!;
    result.push(m);
    for (const childKey of graph.get(m.idempotencyKey) || []) {
      const newDegree = (indegree.get(childKey) || 1) - 1;
      indegree.set(childKey, newDegree);
      if (newDegree === 0) {
        queue.push(mutations.find(mut => mut.idempotencyKey === childKey)!);
      }
    }
  }

  return result;
}
```

### Pattern 4: Cascade Failure Handling
**What:** When a mutation fails, mark dependent mutations as failed with reason
**When to use:** After mutation fails permanently (max retries exceeded)
**Example:**
```typescript
// Source: Pattern for sync-manager.ts
async handleMutationFailure(mutation: MutationQueueEntry, error: string): Promise<void> {
  // Mark this mutation as failed
  await updateMutationStatus(mutation.id, {
    status: 'failed',
    lastError: error,
  });

  // Find and fail dependents
  const allPending = await getPendingMutations();
  const dependents = allPending.filter(m =>
    m.dependsOn?.includes(mutation.idempotencyKey)
  );

  for (const dependent of dependents) {
    await updateMutationStatus(dependent.id, {
      status: 'failed',
      lastError: `Dependency failed: ${mutation.entity}/${mutation.idempotencyKey}`,
    });

    // Recursively fail this mutation's dependents
    await this.handleMutationFailure(dependent, 'Cascade failure');
  }

  // Broadcast failure event
  this.broadcast({
    type: 'MUTATION_FAILED',
    payload: {
      mutation,
      cascadedCount: dependents.length,
    },
  });
}
```

### Pattern 5: Borrowers Offline Implementation (Same as Items)
**What:** Direct copy of items pattern - simplest entity
**Key differences from items:**
- No category_id (no FK dependencies)
- No photos (simpler optimistic shape)
- Simple fields: name, email, phone, notes

```typescript
// Source: Pattern derived from items/page.tsx
const { mutate: createBorrower } = useOfflineMutation<Record<string, unknown>>({
  entity: 'borrowers',
  operation: 'create',
  onMutate: (payload, tempId) => {
    const optimisticBorrower: Borrower & { _pending: boolean } = {
      id: tempId,
      workspace_id: workspaceId!,
      name: payload.name as string,
      email: (payload.email as string) || null,
      phone: (payload.phone as string) || null,
      notes: (payload.notes as string) || null,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _pending: true,
    };
    setOptimisticBorrowers(prev => [...prev, optimisticBorrower]);
  },
});
```

### Anti-Patterns to Avoid
- **Don't process all mutations in FIFO order:** Entity ordering prevents FK violations
- **Don't ignore parent references in creates:** Must track for topological sort
- **Don't process child before parent:** Server will reject with FK constraint error
- **Don't leave orphaned optimistic data:** Failed mutations must clean up IndexedDB store

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency graph | Complex dependency manager | Simple topological sort | ~20 lines, well-understood algorithm |
| Queue ordering | Custom priority system | Entity-type ordering | Fixed order based on schema relationships |
| Retry logic | Custom retry queue | Existing RETRY_CONFIG | Already handles exponential backoff |
| Conflict resolution | New conflict system | Existing conflict-resolver.ts | Already classifies critical vs non-critical |
| Pending indicator | New component | Existing Badge pattern | Already used in items page |

**Key insight:** The existing mutation queue is already ordered by timestamp. Entity-type grouping is a simple Map operation, not a complex rewrite.

## Common Pitfalls

### Pitfall 1: Processing Mutations Before Dependencies Complete
**What goes wrong:** Child entity sent to server before parent, server rejects with FK error
**Why it happens:** FIFO processing without dependency awareness
**How to avoid:** Implement entity-type ordering, topological sort for hierarchical entities
**Warning signs:** 400 errors with "foreign key constraint" message

### Pitfall 2: Orphaned Optimistic Data After Cascade Failure
**What goes wrong:** Parent fails, child still shows as pending in UI indefinitely
**Why it happens:** Child mutation not marked as failed when parent fails
**How to avoid:** Implement cascade failure handler that finds and fails dependents
**Warning signs:** Pending items stuck in UI, never sync or fail

### Pitfall 3: dependsOn Field Not Populated
**What goes wrong:** Topological sort doesn't order correctly because dependsOn is empty
**Why it happens:** queueMutation called without dependsOn for child entities
**How to avoid:** Update queueMutation calls in hierarchical entity forms to include parent idempotency key
**Warning signs:** Random sync order, intermittent FK failures

### Pitfall 4: Borrowers Optimistic Shape Missing Fields
**What goes wrong:** UI crashes when rendering optimistic borrower
**Why it happens:** onMutate callback doesn't include all required Borrower fields
**How to avoid:** Include all fields in optimistic object: id, workspace_id, name, email, phone, notes, is_archived, created_at, updated_at
**Warning signs:** TypeScript errors, undefined property access

### Pitfall 5: Sync Status Indicator Not Updated
**What goes wrong:** Pending count doesn't include borrowers
**Why it happens:** pendingMutationCount query doesn't filter by entity
**How to avoid:** The existing count is entity-agnostic (counts all pending), no change needed
**Warning signs:** Count mismatch with visible pending items

## Code Examples

### Example 1: Extended MutationQueueEntry Type
```typescript
// Source: frontend/lib/db/types.ts
export interface MutationQueueEntry {
  /** Auto-incremented ID (keyPath for IndexedDB) */
  id: number;
  /** UUIDv7 for server-side deduplication */
  idempotencyKey: string;
  /** Type of operation */
  operation: MutationOperation;
  /** Entity type being mutated */
  entity: MutationEntityType;
  /** Entity ID for updates (undefined for creates) */
  entityId?: string;
  /** The mutation payload to send to server */
  payload: Record<string, unknown>;
  /** Timestamp when mutation was queued (ms since epoch) */
  timestamp: number;
  /** Number of retry attempts */
  retries: number;
  /** Last error message if failed */
  lastError?: string;
  /** Current status */
  status: MutationStatus;
  /** Cached updated_at timestamp (ISO string) for conflict detection on updates */
  updatedAt?: string;

  // NEW FIELD for Phase 6
  /** Optional array of idempotency keys this mutation depends on */
  dependsOn?: string[];
}
```

### Example 2: Entity-Ordered Queue Processing
```typescript
// Source: Pattern for frontend/lib/sync/sync-manager.ts
const ENTITY_SYNC_ORDER: MutationEntityType[] = [
  'categories',
  'locations',
  'borrowers',
  'containers',
  'items',
  'inventory',
  'loans'
];

async processQueue(): Promise<void> {
  if (this.isProcessing) {
    console.log("[SyncManager] Already processing, skipping");
    return;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    console.log("[SyncManager] Offline, skipping queue processing");
    return;
  }

  this.isProcessing = true;
  this.broadcast({ type: "SYNC_STARTED" });

  try {
    const pending = await getPendingMutations();
    console.log(`[SyncManager] Processing ${pending.length} pending mutations`);

    // Group by entity type
    const byEntity = new Map<MutationEntityType, MutationQueueEntry[]>();
    for (const mutation of pending) {
      const list = byEntity.get(mutation.entity) || [];
      list.push(mutation);
      byEntity.set(mutation.entity, list);
    }

    // Process in entity dependency order
    for (const entityType of ENTITY_SYNC_ORDER) {
      const mutations = byEntity.get(entityType) || [];
      if (mutations.length === 0) continue;

      console.log(`[SyncManager] Processing ${mutations.length} ${entityType} mutations`);

      // For hierarchical entities, apply topological sort (Phase 7+)
      // const sorted = ['locations', 'categories'].includes(entityType)
      //   ? topologicalSort(mutations)
      //   : mutations;

      for (const mutation of mutations) {
        // Skip if dependencies not yet synced
        if (mutation.dependsOn?.length) {
          const allSynced = await this.areDependenciesSynced(mutation.dependsOn);
          if (!allSynced) {
            console.log(`[SyncManager] Skipping ${mutation.idempotencyKey} - dependencies pending`);
            continue;
          }
        }

        const success = await this.processMutation(mutation);
        if (!success && mutation.retries >= RETRY_CONFIG.maxRetries) {
          await this.handleCascadeFailure(mutation);
        }
      }
    }

    const queueLength = await this.getPendingCount();
    this.broadcast({ type: "SYNC_COMPLETE", payload: { queueLength } });
  } catch (error) {
    console.error("[SyncManager] Queue processing error:", error);
    this.broadcast({
      type: "SYNC_ERROR",
      payload: { error: String(error) },
    });
  } finally {
    this.isProcessing = false;
  }
}

private async areDependenciesSynced(keys: string[]): Promise<boolean> {
  for (const key of keys) {
    const mutation = await getMutationByIdempotencyKey(key);
    if (mutation) {
      // Still in queue = not synced
      return false;
    }
  }
  return true;
}

private async handleCascadeFailure(failed: MutationQueueEntry): Promise<void> {
  const allPending = await getPendingMutations();
  const dependents = allPending.filter(m =>
    m.dependsOn?.includes(failed.idempotencyKey)
  );

  for (const dep of dependents) {
    await updateMutationStatus(dep.id, {
      status: 'failed',
      lastError: `Parent mutation failed: ${failed.entity}/${failed.idempotencyKey}`,
    });
    // Recursive cascade
    await this.handleCascadeFailure(dep);
  }

  this.broadcast({
    type: 'MUTATION_FAILED',
    payload: {
      mutation: failed,
      error: failed.lastError,
    },
  });
}
```

### Example 3: Borrowers Page Offline Integration
```typescript
// Source: Pattern for frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx
import { useOfflineMutation } from "@/lib/hooks/use-offline-mutation";
import { syncManager } from "@/lib/sync/sync-manager";
import type { SyncEvent } from "@/lib/sync/sync-manager";

export default function BorrowersPage() {
  // ... existing state ...

  // Optimistic borrowers state for offline mutations
  const [optimisticBorrowers, setOptimisticBorrowers] = useState<(Borrower & { _pending?: boolean })[]>([]);

  // Offline mutation hooks
  const { mutate: createBorrowerOffline } = useOfflineMutation<Record<string, unknown>>({
    entity: 'borrowers',
    operation: 'create',
    onMutate: (payload, tempId) => {
      const optimisticBorrower: Borrower & { _pending: boolean } = {
        id: tempId,
        workspace_id: workspaceId!,
        name: (payload.name as string) || '',
        email: (payload.email as string) || null,
        phone: (payload.phone as string) || null,
        notes: (payload.notes as string) || null,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _pending: true,
      };
      setOptimisticBorrowers(prev => [...prev, optimisticBorrower]);
    },
  });

  const { mutate: updateBorrowerOffline } = useOfflineMutation<Record<string, unknown>>({
    entity: 'borrowers',
    operation: 'update',
  });

  // Subscribe to sync events
  useEffect(() => {
    if (!syncManager) return;

    const handleSyncEvent = (event: SyncEvent) => {
      if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'borrowers') {
        const syncedKey = event.payload.mutation.idempotencyKey;
        setOptimisticBorrowers(prev =>
          prev.filter(b => b.id !== syncedKey)
        );
        refetch();
      }
    };

    return syncManager.subscribe(handleSyncEvent);
  }, [refetch]);

  // Merge optimistic + fetched borrowers
  const allBorrowers = useMemo(() => [
    ...borrowers,
    ...optimisticBorrowers.filter(opt =>
      !borrowers.some(b => b.id === opt.id)
    )
  ], [borrowers, optimisticBorrowers]);

  // Use allBorrowers in filter/sort/display...
}
```

### Example 4: Pending Badge in Borrowers Table
```typescript
// Source: Pattern for borrowers table row
<TableRow
  key={borrower.id}
  className={cn(
    '_pending' in borrower && borrower._pending && "bg-amber-50/50 dark:bg-amber-900/10"
  )}
>
  <TableCell>
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">
          {getInitials(borrower.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-2">
        <span className="font-medium">{borrower.name}</span>
        {'_pending' in borrower && borrower._pending && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
            <Cloud className="w-3 h-3 mr-1 animate-pulse" />
            Pending
          </Badge>
        )}
      </div>
    </div>
  </TableCell>
  {/* ... other cells ... */}
</TableRow>
```

### Example 5: E2E Test for Borrowers Offline
```typescript
// Source: Pattern for e2e/offline/offline-borrowers.spec.ts
test.describe("Offline Borrower Mutations", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/en/dashboard/borrowers");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
  });

  test("creates borrower while offline with pending indicator", async ({ page, context }) => {
    const uniqueName = `Offline Borrower ${Date.now()}`;

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // Open create dialog
    await page.getByRole("button", { name: /Add Borrower/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Fill form
    await page.getByLabel(/^Name/i).fill(uniqueName);
    await page.getByLabel(/Email/i).fill("test@example.com");

    // Submit
    await page.getByRole("button", { name: /Create/i }).click();

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify optimistic borrower appears with pending indicator
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync - pending indicator should disappear
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

    // Borrower should still be visible after sync
    await expect(page.getByText(uniqueName)).toBeVisible();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FIFO mutation processing | Entity-ordered processing | Phase 6 | Prevents FK violations |
| No dependency tracking | dependsOn field in queue | Phase 6 | Enables parent-first sync |
| Silent failure | Cascade failure handling | Phase 6 | Clear error chain |
| Items-only offline | Multi-entity offline | Phase 6+ | Full offline capability |

**Current Infrastructure Status:**
- SyncManager: Entity-agnostic, needs entity ordering
- MutationQueueEntry: Needs dependsOn field
- Conflict resolver: Ready (CRITICAL_FIELDS configured)
- Borrowers: Needs useOfflineMutation integration

## Open Questions

Things that couldn't be fully resolved:

1. **Backend Client-Generated UUID Acceptance**
   - What we know: Backend generates UUIDs server-side currently
   - What's unclear: Whether backend accepts client-provided UUIDs in create requests
   - Recommendation: Verify during implementation. If not accepted, modify backend handler to accept `id` field in POST body. This is the cleanest approach - avoids temp ID mapping.

2. **Cycle Detection for Hierarchies**
   - What we know: Parent field changes could create cycles (A -> B -> A)
   - What's unclear: Whether server validates cycle-free hierarchies
   - Recommendation: Defer to Phases 7-8 (categories/locations). Server should reject cyclic references. Add to CRITICAL_FIELDS for manual conflict resolution.

3. **Queue Cleanup on Cascade Failure**
   - What we know: Failed mutations stay in queue with 'failed' status
   - What's unclear: Best UX for displaying/clearing cascade failures
   - Recommendation: Show in PendingChangesDrawer with "Retry Chain" button. User can fix root cause and retry all.

## Sources

### Primary (HIGH confidence - Codebase Analysis)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/hooks/use-offline-mutation.ts` - Hook implementation (251 lines)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/sync/sync-manager.ts` - Queue processing, conflict handling (589 lines)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/sync/mutation-queue.ts` - Queue CRUD operations (433 lines)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/db/types.ts` - MutationQueueEntry type definition
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx` - Items offline implementation pattern (1648 lines)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx` - Current borrowers page (853 lines)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/types/borrowers.ts` - Borrower type definition
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/e2e/offline/offline-mutations.spec.ts` - E2E test patterns

### Primary (HIGH confidence - Prior Research)
- `/home/antti/Repos/Misc/home-warehouse-system/.planning/research/SUMMARY.md` - Milestone research (topological sort, entity ordering)
- `/home/antti/Repos/Misc/home-warehouse-system/.planning/phases/05-form-integration/05-RESEARCH.md` - Form integration patterns

### Secondary (MEDIUM confidence - Algorithm References)
- Kahn's algorithm for topological sort - standard CS algorithm, well-documented
- Entity dependency order derived from database schema analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code exists in codebase, no external dependencies
- Architecture: HIGH - Patterns derived from existing implementations + prior research
- Pitfalls: HIGH - Sourced from existing items implementation and milestone research
- Borrowers: HIGH - Simple entity, direct copy of items pattern

**Research date:** 2026-01-24
**Valid until:** N/A - Internal codebase research, patterns are stable
