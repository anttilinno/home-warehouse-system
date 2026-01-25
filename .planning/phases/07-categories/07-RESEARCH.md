# Phase 7: Categories - Research

**Researched:** 2026-01-24
**Domain:** Offline mutations for hierarchical categories with parent-child relationships
**Confidence:** HIGH

## Summary

Phase 7 extends offline mutation support to categories, which are the first hierarchical entity in the system. Categories have a self-referential `parent_category_id` field that creates parent-child relationships. This introduces a key complexity not present in borrowers (Phase 6): when creating a subcategory under a pending parent, the child must wait for the parent to sync first.

The infrastructure from Phase 6 (dependsOn tracking, entity-ordered sync, cascade failure) is already in place. Phase 7 needs to add: (1) topological sort for categories to order create mutations by parent-child dependency, (2) dependsOn tracking when creating subcategories under pending parents, and (3) parent name context in the pending indicator badge.

**Primary recommendation:** Implement inline topological sort (~20 lines using Kahn's algorithm) in sync-manager for categories, track parent dependency via dependsOn when parent is pending, and display "Pending... under [ParentName]" in the pending badge.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | IndexedDB wrapper with typed stores | Already integrated, categories store exists |
| uuid | 13.0.0 | UUIDv7 generation for idempotency | Already used for temp IDs |
| useOfflineMutation | internal | Queue mutations with optimistic UI | Established pattern from items/borrowers |
| syncManager | internal | Entity-ordered queue processing | Has ENTITY_SYNC_ORDER with categories first |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mutation-queue.ts | internal | CRUD operations on mutation queue | queueMutation with dependsOn |
| offline-db.ts | internal | Generic IndexedDB CRUD | Category store operations |
| @dnd-kit/core | 6.x | Drag and drop | Already used in categories page |

### No New Dependencies Required
All infrastructure exists. Topological sort is ~20 lines inline, no external package needed.

## Architecture Patterns

### Pattern 1: Topological Sort for Hierarchical Categories
**What:** Sort pending category creates by parent-child dependency before syncing
**When to use:** When processing categories in sync-manager.processQueue()
**Why needed:** If parent "Electronics" (pending) has child "Cables" (pending), "Electronics" must sync first

**Implementation location:** `frontend/lib/sync/sync-manager.ts`

```typescript
// Add inside sync-manager.ts, before processQueue method
function topologicalSortCategories(mutations: MutationQueueEntry[]): MutationQueueEntry[] {
  // Only sort create operations (updates don't create new IDs)
  const creates = mutations.filter(m => m.operation === 'create');
  const updates = mutations.filter(m => m.operation === 'update');

  if (creates.length <= 1) return [...creates, ...updates];

  // Build dependency graph from parent_category_id references
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  // Initialize
  for (const m of creates) {
    indegree.set(m.idempotencyKey, 0);
    children.set(m.idempotencyKey, []);
  }

  // Build edges from parent references
  const keySet = new Set(creates.map(m => m.idempotencyKey));
  for (const m of creates) {
    const parentId = m.payload.parent_category_id as string | null;
    if (parentId && keySet.has(parentId)) {
      // parentId is another pending create's temp ID
      indegree.set(m.idempotencyKey, (indegree.get(m.idempotencyKey) || 0) + 1);
      children.get(parentId)!.push(m.idempotencyKey);
    }
  }

  // Kahn's algorithm
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

### Pattern 2: dependsOn Tracking for Subcategory Creates
**What:** When creating a subcategory under a pending parent, track the dependency
**When to use:** In categories page when user selects a pending parent from dropdown
**Example:**

```typescript
// In categories/page.tsx handleSave function
const handleSave = async () => {
  // ... validation ...

  const payload: Record<string, unknown> = {
    name: formName.trim(),
    description: formDescription.trim() || null,
    parent_category_id: formParentId,
  };

  // Check if parent is a pending optimistic category
  const parentIsPending = formParentId && optimisticCategories.some(
    c => c.id === formParentId && c._pending
  );

  // If parent is pending, we need to track dependency
  const dependsOn = parentIsPending ? [formParentId] : undefined;

  await createCategoryOffline(payload, undefined, dependsOn);
};
```

### Pattern 3: Parent Name Context in Pending Badge
**What:** Show "Pending... under Electronics" instead of just "Pending"
**When to use:** For subcategories where parent is visible
**Implementation:**

```typescript
// In CategoryRow component
const getParentName = (parentId: string | null): string | null => {
  if (!parentId) return null;
  // Check optimistic first, then fetched
  const optimistic = optimisticCategories.find(c => c.id === parentId);
  if (optimistic) return optimistic.name;
  const fetched = categories.find(c => c.id === parentId);
  return fetched?.name || null;
};

// In render
{'_pending' in category && category._pending && (
  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
    <Cloud className="w-3 h-3 mr-1 animate-pulse" />
    Pending{category.parent_category_id && getParentName(category.parent_category_id)
      ? `... under ${getParentName(category.parent_category_id)}`
      : ''}
  </Badge>
)}
```

### Anti-Patterns to Avoid
- **Don't skip topological sort:** Processing child before parent causes FK error on server
- **Don't forget dependsOn when parent is pending:** Child will sync before parent is created
- **Don't show stale parent name:** Pending parent name may differ from form value

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency ordering | Complex scheduler | Inline Kahn's algorithm | ~20 lines, well-understood |
| Queue infrastructure | New queue system | Existing mutationQueue with dependsOn | Already supports dependency tracking |
| Cascade failure | Custom error chain | Existing handleCascadeFailure | Phase 6 already implemented |
| Tree rendering | Custom tree component | Existing CategoryRow recursion | Already handles hierarchy |

**Key insight:** The hard work was done in Phase 6. Categories just needs the topological sort addition and UI integration following the borrowers pattern.

## Common Pitfalls

### Pitfall 1: Creating Subcategory Without dependsOn
**What goes wrong:** Child syncs before parent, server rejects with FK constraint error
**Why it happens:** Forgot to check if selected parent is a pending optimistic category
**How to avoid:** In handleSave, check if formParentId matches an optimistic category's tempId
**Warning signs:** 400 errors with "parent not found" message

### Pitfall 2: Topological Sort Not Applied to Categories
**What goes wrong:** Parent-child creates processed in wrong order
**Why it happens:** Sync-manager processes categories without sorting
**How to avoid:** Apply topologicalSortCategories before processing category mutations
**Warning signs:** FK constraint errors, intermittent failures

### Pitfall 3: Parent Dropdown Shows Pending Categories Without Visual Distinction
**What goes wrong:** User doesn't know they're creating under a pending parent
**Why it happens:** Parent dropdown doesn't indicate which items are pending
**How to avoid:** Add "(pending)" suffix or different styling to pending parents in dropdown
**Warning signs:** User confusion, unexpected dependency chains

### Pitfall 4: Orphaned Optimistic Children When Parent Fails
**What goes wrong:** Parent mutation fails, children stuck as pending indefinitely
**Why it happens:** Cascade failure not properly propagated via dependsOn
**How to avoid:** Ensure dependsOn is set correctly; existing cascade handler will mark children as failed
**Warning signs:** Children never sync, stuck in pending state

### Pitfall 5: Parent Name Not Found for Pending Badge
**What goes wrong:** Badge shows "Pending... under undefined"
**Why it happens:** Parent lookup doesn't check optimisticCategories array
**How to avoid:** Check optimistic categories first, then fetched categories
**Warning signs:** "under undefined" or "under null" in UI

## Code Examples

### Example 1: Category Type with Pending Flag
```typescript
// Source: frontend/lib/api/categories.ts (existing)
interface Category {
  id: string;
  name: string;
  parent_category_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Extended for optimistic UI
type OptimisticCategory = Category & { _pending?: boolean };
```

### Example 2: Offline Mutation Hook Integration
```typescript
// Source: Pattern from borrowers page, adapted for categories
const { mutate: createCategoryOffline } = useOfflineMutation<Record<string, unknown>>({
  entity: 'categories',
  operation: 'create',
  onMutate: (payload, tempId) => {
    const optimisticCategory: Category & { _pending: boolean } = {
      id: tempId,
      workspace_id: workspaceId!,
      name: (payload.name as string) || '',
      description: (payload.description as string) || null,
      parent_category_id: (payload.parent_category_id as string) || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _pending: true,
    };
    setOptimisticCategories(prev => [...prev, optimisticCategory]);
  },
});
```

### Example 3: Sync Manager Topological Sort Integration
```typescript
// Source: Pattern for sync-manager.ts processQueue method
// Inside the entity processing loop for categories:

for (const entityType of ENTITY_SYNC_ORDER) {
  const mutations = byEntity.get(entityType) || [];
  if (mutations.length === 0) continue;

  // Apply topological sort for hierarchical entities
  const sortedMutations = entityType === 'categories'
    ? topologicalSortCategories(mutations)
    : mutations;

  for (const mutation of sortedMutations) {
    // ... existing processing logic ...
  }
}
```

### Example 4: Pending Badge with Parent Context
```typescript
// Source: Pattern for CategoryRow component
<Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
  <Cloud className="w-3 h-3 mr-1 animate-pulse" />
  {(() => {
    if (!category.parent_category_id) return 'Pending';
    const parentName = getParentName(category.parent_category_id);
    return parentName ? `Pending... under ${parentName}` : 'Pending';
  })()}
</Badge>
```

### Example 5: E2E Test for Hierarchical Offline Create
```typescript
// Source: Pattern for e2e/offline/offline-categories.spec.ts
test("creates subcategory under pending parent", async ({ page, context }) => {
  // Create parent category offline
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  const parentName = `Parent ${Date.now()}`;
  await page.getByRole("button", { name: /Add/i }).click();
  await page.getByLabel(/Name/i).fill(parentName);
  await page.getByRole("button", { name: /Save/i }).click();

  // Verify parent appears with pending indicator
  await expect(page.getByText(parentName)).toBeVisible();
  await expect(page.getByText("Pending")).toBeVisible();

  // Create child under pending parent
  const childName = `Child ${Date.now()}`;
  await page.getByRole("button", { name: /Add/i }).click();
  await page.getByLabel(/Name/i).fill(childName);
  await page.getByLabel(/Parent/i).click();
  await page.getByRole("option", { name: parentName }).click();
  await page.getByRole("button", { name: /Save/i }).click();

  // Verify child shows with parent context
  await expect(page.getByText(childName)).toBeVisible();
  await expect(page.getByText(`Pending... under ${parentName}`)).toBeVisible();

  // Go online and verify sync order
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // Both pending indicators should disappear
  await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

  // Both categories should remain visible
  await expect(page.getByText(parentName)).toBeVisible();
  await expect(page.getByText(childName)).toBeVisible();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FIFO mutation processing | Entity-ordered + topological sort | Phase 6/7 | Correct hierarchy sync |
| No parent context | Pending badge with parent name | Phase 7 | Better UX clarity |
| Borrowers-only offline | Categories offline | Phase 7 | First hierarchical entity |

**Current Infrastructure Status:**
- SyncManager: Has entity ordering, needs topological sort for categories
- MutationQueueEntry: Has dependsOn field ready
- Categories page: Has CRUD, SSE, drag-drop, needs offline integration
- IndexedDB: Has categories store already

## Open Questions

### 1. Backend Client-Provided UUID Acceptance
**Status:** RESOLVED - Not needed
**What we know:** Backend generates UUIDs server-side. The Idempotency-Key header is sent but not used for ID generation.
**Impact:** After sync, the tempId (idempotencyKey) is replaced by server-generated ID. This is already handled by the existing sync pattern - optimistic items are removed from state when MUTATION_SYNCED fires, and refetch() gets the server data with real IDs.

### 2. Cycle Detection in Hierarchy
**What we know:** Parent field changes could theoretically create cycles (A -> B -> A)
**What's unclear:** Edge case for offline: can user create A under B, then change B's parent to A?
**Recommendation:** The categories page already prevents selecting descendants as parents in edit mode. Same logic should apply to optimistic categories. Server validates on sync.

### 3. Drag-Drop for Pending Categories
**What we know:** Categories page has drag-drop to reparent
**What's unclear:** Should drag-drop be disabled for pending categories?
**Recommendation:** Disable drag-drop for pending categories (rows with _pending flag). Prevents complex reparenting scenarios until category is synced.

## Sources

### Primary (HIGH confidence - Codebase Analysis)
- `/frontend/app/[locale]/(dashboard)/dashboard/categories/page.tsx` - Current categories page (843 lines)
- `/frontend/app/[locale]/(dashboard)/dashboard/borrowers/page.tsx` - Borrowers offline pattern (973 lines)
- `/frontend/lib/sync/sync-manager.ts` - Entity-ordered sync, cascade failure (740 lines)
- `/frontend/lib/db/types.ts` - MutationQueueEntry with dependsOn
- `/frontend/lib/api/categories.ts` - Category type definition
- `/frontend/lib/hooks/use-offline-mutation.ts` - Hook implementation

### Primary (HIGH confidence - Phase 6 Research)
- `/.planning/phases/06-infrastructure-borrowers/06-RESEARCH.md` - Topological sort algorithm, entity ordering
- `/.planning/phases/06-infrastructure-borrowers/06-01-SUMMARY.md` - Infrastructure completion status

### Secondary (MEDIUM confidence - Algorithm)
- Kahn's algorithm for topological sort - standard CS algorithm, well-documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code exists in codebase
- Architecture: HIGH - Patterns derived from Phase 6 + borrowers implementation
- Topological sort: HIGH - Standard algorithm, code provided in Phase 6 research
- Categories page integration: HIGH - Direct copy of borrowers pattern with tree adjustments

**Research date:** 2026-01-24
**Valid until:** N/A - Internal codebase research, patterns stable
