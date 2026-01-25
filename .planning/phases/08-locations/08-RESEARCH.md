# Phase 8: Locations - Research

**Researched:** 2026-01-24
**Domain:** Offline mutations for hierarchical locations with parent-child relationships
**Confidence:** HIGH

## Summary

Phase 8 extends offline mutation support to locations, which are structurally very similar to categories (Phase 7). Locations have a self-referential `parent_location` field that creates parent-child relationships. The infrastructure for hierarchical entity handling was already built in Phase 7: `dependsOn` tracking in `useOfflineMutation`, topological sort algorithm in sync-manager (currently applied only to categories), and pending badge with parent context.

The key differences between locations and categories are:
1. **Field names:** `parent_location` vs `parent_category_id`
2. **Extra fields:** Locations have `short_code` (QR label), `zone`, `shelf`, `bin`, `is_archived`
3. **No drag-drop:** Locations page doesn't use drag-drop for reordering (unlike categories)
4. **Archive/restore:** Locations have archive functionality that categories don't

The implementation will follow the exact pattern established in Phase 7, adapting for these differences.

**Primary recommendation:** Copy the categories offline mutation pattern, add `topologicalSortLocations` function (identical algorithm, different field name), update locations page with offline hooks and pending indicators.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | IndexedDB wrapper with typed stores | Already integrated, locations store exists |
| uuid | 13.0.0 | UUIDv7 generation for idempotency | Already used for temp IDs |
| useOfflineMutation | internal | Queue mutations with optimistic UI | Supports dependsOn parameter (from Phase 7) |
| syncManager | internal | Entity-ordered queue processing | Has locations in ENTITY_SYNC_ORDER |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mutation-queue.ts | internal | CRUD operations on mutation queue | queueMutation with dependsOn |
| offline-db.ts | internal | Generic IndexedDB CRUD | Location store operations |
| lucide-react | - | Cloud icon for pending badge | Already imported in categories page |

### No New Dependencies Required
All infrastructure exists from Phase 6-7. The topological sort pattern from categories can be copied for locations.

## Architecture Patterns

### Pattern 1: Topological Sort for Hierarchical Locations
**What:** Sort pending location creates by parent-child dependency before syncing
**When to use:** When processing locations in sync-manager.processQueue()
**Why needed:** If parent "Warehouse A" (pending) has child "Shelf 1" (pending), "Warehouse A" must sync first

**Implementation location:** `frontend/lib/sync/sync-manager.ts`

```typescript
// Add below topologicalSortCategories function
export function topologicalSortLocations(mutations: MutationQueueEntry[]): MutationQueueEntry[] {
  // Only sort create operations (updates don't create new IDs)
  const creates = mutations.filter(m => m.operation === 'create');
  const updates = mutations.filter(m => m.operation === 'update');

  if (creates.length <= 1) return [...creates, ...updates];

  // Build dependency graph from parent_location references
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  // Initialize
  for (const m of creates) {
    indegree.set(m.idempotencyKey, 0);
    children.set(m.idempotencyKey, []);
  }

  // Build edges from parent references where parent is also a pending create
  const keySet = new Set(creates.map(m => m.idempotencyKey));
  for (const m of creates) {
    const parentId = m.payload.parent_location as string | null;
    if (parentId && keySet.has(parentId)) {
      // parentId is another pending create's temp ID
      indegree.set(m.idempotencyKey, (indegree.get(m.idempotencyKey) || 0) + 1);
      children.get(parentId)!.push(m.idempotencyKey);
    }
  }

  // Kahn's algorithm: start with nodes with indegree 0
  const queue = creates.filter(m => indegree.get(m.idempotencyKey) === 0);
  const sorted: MutationQueueEntry[] = [];

  while (queue.length > 0) {
    const m = queue.shift()!;
    sorted.push(m);
    for (const childKey of children.get(m.idempotencyKey) || []) {
      const newDegree = (indegree.get(childKey) || 1) - 1;
      indegree.set(childKey, newDegree);
      if (newDegree === 0) {
        const child = creates.find(c => c.idempotencyKey === childKey);
        if (child) queue.push(child);
      }
    }
  }

  // Combine sorted creates with updates
  return [...sorted, ...updates];
}
```

**Key difference from categories:** Uses `parent_location` field instead of `parent_category_id`.

### Pattern 2: dependsOn Tracking for Sublocation Creates
**What:** When creating a sublocation under a pending parent, track the dependency
**When to use:** In locations page when user selects a pending parent from dropdown
**Example:**

```typescript
// In locations/page.tsx handleSave function
const handleSave = async () => {
  // ... validation ...

  const payload: Record<string, unknown> = {
    name: formName.trim(),
    description: formDescription.trim() || null,
    parent_location: formParentId || null,
    short_code: formShortCode || undefined,
  };

  // Check if parent is a pending optimistic location
  const parentIsPending = formParentId && optimisticLocations.some(
    loc => loc.id === formParentId && loc._pending
  );

  // If parent is pending, we need to track dependency
  const dependsOn = parentIsPending ? [formParentId] : undefined;

  await createLocationOffline(payload, undefined, dependsOn);
};
```

### Pattern 3: Parent Name Context in Pending Badge
**What:** Show "Pending... under Warehouse A" instead of just "Pending"
**When to use:** For sublocations where parent is visible
**Implementation:**

```typescript
// In LocationRow component
const getParentName = (parentId: string | null): string | null => {
  if (!parentId) return null;
  // Check allLocations which includes optimistic
  const parent = allLocations.find(loc => loc.id === parentId);
  return parent?.name || null;
};

// In render
{location._pending && (
  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
    <Cloud className="w-3 h-3 mr-1 animate-pulse" />
    {(() => {
      if (!location.parent_location) return 'Pending';
      const parentName = getParentName(location.parent_location);
      return parentName ? `Pending... under ${parentName}` : 'Pending';
    })()}
  </Badge>
)}
```

### Pattern 4: LocationTreeItem with _pending Flag
**What:** Extend the existing LocationTreeItem interface to include _pending
**Implementation:**

```typescript
// Already exists in locations/page.tsx but needs _pending
interface LocationTreeItem extends Location {
  children: LocationTreeItem[];
  expanded?: boolean;
  _pending?: boolean;  // Add this
}
```

### Anti-Patterns to Avoid
- **Don't skip topological sort:** Processing child before parent causes FK error on server
- **Don't forget dependsOn when parent is pending:** Child will sync before parent is created
- **Don't show stale parent name:** Pending parent name may differ from form value
- **Don't allow archive/delete of pending locations:** These operations need the entity to exist on server

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency ordering | Complex scheduler | Inline Kahn's algorithm (copy from categories) | ~25 lines, well-understood |
| Queue infrastructure | New queue system | Existing mutationQueue with dependsOn | Already supports dependency tracking |
| Cascade failure | Custom error chain | Existing handleCascadeFailure | Phase 6 already implemented |
| Tree rendering | Custom tree component | Existing LocationRow recursion | Already handles hierarchy |
| Offline mutation hook | New hook | useOfflineMutation | Already supports dependsOn |

**Key insight:** Phase 7 did the hard work. Locations just needs to apply the same patterns with different field names.

## Common Pitfalls

### Pitfall 1: Creating Sublocation Without dependsOn
**What goes wrong:** Child syncs before parent, server rejects with FK constraint error
**Why it happens:** Forgot to check if selected parent is a pending optimistic location
**How to avoid:** In handleSave, check if formParentId matches an optimistic location's tempId
**Warning signs:** 400 errors with "parent not found" message

### Pitfall 2: Topological Sort Not Applied to Locations
**What goes wrong:** Parent-child creates processed in wrong order
**Why it happens:** Sync-manager only applies topological sort to categories, not locations
**How to avoid:** Add locations to the entity type check in processQueue
**Warning signs:** FK constraint errors, intermittent failures

### Pitfall 3: Parent Dropdown Shows Pending Locations Without Visual Distinction
**What goes wrong:** User doesn't know they're creating under a pending parent
**Why it happens:** Parent dropdown doesn't indicate which items are pending
**How to avoid:** Add "(pending)" suffix to pending locations in dropdown
**Warning signs:** User confusion, unexpected dependency chains

### Pitfall 4: Archive/Delete Actions Shown for Pending Locations
**What goes wrong:** User tries to archive a pending location, operation fails
**Why it happens:** Pending locations don't exist on server yet, can't be archived/deleted
**How to avoid:** Hide archive/delete menu items for pending locations (already visible via _pending flag)
**Warning signs:** 404 errors when archiving, confused UI state

### Pitfall 5: Short Code Conflict with Pending Create
**What goes wrong:** User enters short_code that matches a pending location's generated short_code
**Why it happens:** Client doesn't validate short_code uniqueness against pending creates
**How to avoid:** For Phase 8, accept that server will reject duplicates. User can retry with different code.
**Warning signs:** 400 "short_code already exists" after sync

### Pitfall 6: Parent Name Not Found for Pending Badge
**What goes wrong:** Badge shows "Pending... under undefined"
**Why it happens:** Parent lookup doesn't check optimisticLocations array
**How to avoid:** Check merged locations (fetched + optimistic) when looking up parent
**Warning signs:** "under undefined" or "under null" in UI

## Code Examples

### Example 1: Location Type with Pending Flag
```typescript
// Source: frontend/lib/types/locations.ts (existing)
interface Location {
  id: string;
  workspace_id: string;
  name: string;
  parent_location?: string | null;  // Key field for hierarchy
  zone?: string | null;
  shelf?: string | null;
  bin?: string | null;
  description?: string | null;
  short_code?: string | null;  // QR label - unique within workspace
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// Extended for optimistic UI
type OptimisticLocation = Location & { _pending?: boolean };
```

### Example 2: Offline Mutation Hook Integration
```typescript
// Pattern from categories page, adapted for locations
const { mutate: createLocationOffline } = useOfflineMutation<Record<string, unknown>>({
  entity: 'locations',
  operation: 'create',
  onMutate: (payload, tempId, dependsOn) => {
    const optimisticLocation: Location & { _pending: boolean } = {
      id: tempId,
      workspace_id: workspaceId!,
      name: (payload.name as string) || '',
      description: (payload.description as string) || null,
      parent_location: (payload.parent_location as string) || null,
      short_code: (payload.short_code as string) || null,
      zone: null,
      shelf: null,
      bin: null,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _pending: true,
    };
    setOptimisticLocations(prev => [...prev, optimisticLocation]);
  },
});
```

### Example 3: Sync Manager Locations Topological Sort Integration
```typescript
// Source: Pattern for sync-manager.ts processQueue method
// Update the entity processing loop to include locations:

for (const entityType of ENTITY_SYNC_ORDER) {
  const mutations = byEntity.get(entityType) || [];
  if (mutations.length === 0) continue;

  // Apply topological sort for hierarchical entities
  let sortedMutations: MutationQueueEntry[];
  if (entityType === 'categories') {
    sortedMutations = topologicalSortCategories(mutations);
  } else if (entityType === 'locations') {
    sortedMutations = topologicalSortLocations(mutations);
  } else {
    sortedMutations = mutations;
  }

  for (const mutation of sortedMutations) {
    // ... existing processing logic ...
  }
}
```

### Example 4: Pending Badge with Parent Context in LocationRow
```typescript
// Source: Pattern for LocationRow component
<Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
  <Cloud className="w-3 h-3 mr-1 animate-pulse" />
  {(() => {
    if (!location.parent_location) return 'Pending';
    const parentName = getParentName(location.parent_location);
    return parentName ? `Pending... under ${parentName}` : 'Pending';
  })()}
</Badge>
```

### Example 5: E2E Test for Hierarchical Offline Create
```typescript
// Pattern for e2e/offline/offline-locations.spec.ts
test("creates sublocation under pending parent with correct context", async ({ page, context }) => {
  const parentName = `Parent Location ${Date.now()}`;
  const childName = `Child Location ${Date.now()}`;

  // Go offline
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  // Create parent location
  await page.getByRole("button", { name: /Add Location/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByLabel(/^Name/i).fill(parentName);
  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Verify parent appears with pending indicator
  await expect(page.getByText(parentName)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Pending")).toBeVisible({ timeout: 5000 });

  // Create child location under pending parent
  await page.getByRole("button", { name: /Add Location/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByLabel(/^Name/i).fill(childName);

  // Select the pending parent from dropdown
  // Click on Parent Location select
  await page.locator('#parent').click();  // Or getByLabel(/Parent/i)
  // The pending parent should show with (pending) suffix
  await page.getByRole("option", { name: new RegExp(`${parentName}.*pending`, "i") }).click();

  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Verify child appears with pending indicator AND parent context
  await expect(page.getByText(childName)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(`Pending... under ${parentName}`)).toBeVisible({ timeout: 5000 });

  // Go online and verify sync order
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // Both pending indicators should disappear
  await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

  // Both locations should remain visible
  await expect(page.getByText(parentName)).toBeVisible();
  await expect(page.getByText(childName)).toBeVisible();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FIFO mutation processing | Entity-ordered + topological sort | Phase 6/7 | Correct hierarchy sync |
| Categories-only topological sort | Categories + locations topological sort | Phase 8 | Both hierarchical entities supported |
| No parent context | Pending badge with parent name | Phase 7 | Better UX clarity |

**Current Infrastructure Status:**
- SyncManager: Has entity ordering, topological sort for categories, needs locations addition
- MutationQueueEntry: Has dependsOn field ready
- Locations page: Has CRUD, SSE, tree view, archive, needs offline integration
- IndexedDB: Has locations store already
- useOfflineMutation: Already supports dependsOn parameter

## Differences from Categories Implementation

| Aspect | Categories | Locations | Impact on Implementation |
|--------|------------|-----------|-------------------------|
| Parent field | `parent_category_id` | `parent_location` | Topological sort field name |
| Extra fields | None | `short_code`, `zone`, `shelf`, `bin`, `is_archived` | Optimistic state includes these |
| Drag-drop | Yes (reparenting) | No | No need to disable drag for pending |
| Archive/restore | No | Yes | Hide archive menu for pending |
| Delete behavior | Direct delete | Direct delete | Same - hide delete for pending |
| Short code | No | Yes (QR label) | Include in optimistic create |
| Visual indicator | Tree with FolderTree icon | Tree with MapPin icon | Different icon, same pattern |

## Open Questions

### 1. Archive/Delete for Pending Locations
**What we know:** Pending locations don't exist on server yet
**Recommendation:** Hide archive/delete dropdown menu items for pending locations (same as categories hides edit/delete). The `_pending` flag makes this easy.

### 2. Short Code Handling for Pending Locations
**What we know:** Short codes are unique within workspace, auto-generated if not provided
**What's unclear:** Should we let users enter short_code for pending locations?
**Recommendation:** Allow it. If user doesn't provide short_code, leave it undefined in optimistic state (will show as empty/null). Server will generate on sync. If user provides one and it conflicts, server will reject with validation error after sync.

### 3. Sublocation "Add sublocation" Action for Pending Parents
**What we know:** Locations page has "Add sublocation" context menu action
**Recommendation:** Allow "Add sublocation" action on pending locations - this creates a child with dependsOn tracking, which is exactly the expected behavior.

## Sources

### Primary (HIGH confidence - Codebase Analysis)
- `/frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx` - Current locations page (823 lines)
- `/frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx` - Categories offline pattern (970 lines)
- `/frontend/lib/sync/sync-manager.ts` - Entity-ordered sync, topological sort for categories (805 lines)
- `/frontend/lib/db/types.ts` - MutationQueueEntry with dependsOn, locations in MutationEntityType
- `/frontend/lib/types/locations.ts` - Location type definition with parent_location field
- `/frontend/lib/hooks/use-offline-mutation.ts` - Hook implementation with dependsOn support

### Primary (HIGH confidence - Phase 7 Implementation)
- `/.planning/phases/07-categories/07-RESEARCH.md` - Topological sort algorithm, entity ordering
- `/.planning/phases/07-categories/07-01-PLAN.md` - Implementation plan for categories offline
- `/.planning/phases/07-categories/07-VERIFICATION.md` - Verification of categories implementation

### Secondary (MEDIUM confidence - Algorithm)
- Kahn's algorithm for topological sort - standard CS algorithm, already implemented for categories

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code exists in codebase
- Architecture: HIGH - Direct copy of verified Phase 7 patterns
- Topological sort: HIGH - Identical algorithm to categories, just different field name
- Locations page integration: HIGH - Same pattern as categories, well-documented

**Research date:** 2026-01-24
**Valid until:** N/A - Internal codebase research, patterns stable

## Implementation Checklist

Phase 8 implementation should:

1. **sync-manager.ts:**
   - Add `topologicalSortLocations` function (copy from categories, change field to `parent_location`)
   - Update processQueue to apply topological sort for locations entity type

2. **locations/page.tsx:**
   - Add `Cloud` icon import
   - Add `optimisticLocations` state
   - Add `useOfflineMutation` hooks for create and update
   - Add sync event subscription (MUTATION_SYNCED, MUTATION_FAILED)
   - Add `mergedLocations` useMemo
   - Update tree building to use mergedLocations
   - Update handleSave to use offline mutations with dependsOn
   - Update getAvailableParents to include optimistic locations
   - Update parent dropdown to show "(pending)" suffix
   - Add pending badge to LocationRow with parent context
   - Hide dropdown menu (archive, delete, edit) for pending locations
   - Add amber background styling for pending rows

3. **E2E tests:**
   - Create `frontend/e2e/offline/offline-locations.spec.ts`
   - Test create offline with pending indicator
   - Test update offline with pending indicator
   - Test sublocation under pending parent with context
   - Test archive/delete hidden for pending locations
