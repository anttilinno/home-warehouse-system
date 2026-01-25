# Phase 5: Form Integration for Offline Mutations - Research

**Researched:** 2026-01-24
**Domain:** React form integration, offline mutations, optimistic UI
**Confidence:** HIGH

## Summary

This phase bridges the gap identified in v1-MILESTONE-AUDIT.md: the `useOfflineMutation` hook (251 lines) and `useOfflineData` hook (147 lines) exist but are not consumed by production forms. The infrastructure for offline mutations is complete - what remains is migrating the Items page inline dialog form to use these hooks.

The current Items page (`/app/[locale]/(dashboard)/dashboard/items/page.tsx`) has an inline dialog form for create/update that uses direct API calls (`itemsApi.create`, `itemsApi.update`). This form needs to be migrated to use `useOfflineMutation` for offline capability while maintaining the existing UX including approval workflow support.

**Primary recommendation:** Migrate the inline item dialog form to use `useOfflineMutation`, add a pending indicator badge to items in the list, and create E2E tests that validate the full offline create/update flow.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `useOfflineMutation` | internal | Queue mutations to IndexedDB | Custom hook already implemented |
| `useOfflineData` | internal | Stale-while-revalidate offline reads | Custom hook already implemented |
| `react-hook-form` | current | Form state management | Already used in auth forms |
| `zod` | current | Schema validation | Already used in auth forms |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | current | Toast notifications | Success/error feedback |
| `usePendingChangeHandler` | internal | Approval workflow | Member role submissions |
| `syncManager` | internal | Process mutation queue | Triggers sync on online |

### No New Dependencies Required
The codebase has all necessary infrastructure. No new libraries are needed.

## Architecture Patterns

### Current Form Pattern (Items Page)
```
ItemsPage
├── Inline formData state (useState)
├── Direct API call in handleSave
├── refetch() to reload data after mutation
└── Dialog with form fields
```

### Target Pattern (Offline-Capable Form)
```
ItemsPage
├── react-hook-form + zod schema
├── useOfflineMutation hook for create
├── useOfflineMutation hook for update
├── Optimistic item added to list with _pending: true
├── Pending indicator in table row
└── Automatic sync when back online
```

### Pattern 1: useOfflineMutation Integration

**What:** Hook that queues mutations to IndexedDB before optimistic UI update
**When to use:** All create/update operations that should work offline
**Example:**
```typescript
// Source: frontend/lib/hooks/use-offline-mutation.ts
const { mutate: createItem, isPending: isCreating } = useOfflineMutation({
  entity: 'items',
  operation: 'create',
  onMutate: (payload, tempId) => {
    // Add optimistic item to local state
    setItems(prev => [...prev, {
      ...payload,
      id: tempId,
      _pending: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
  },
});

// Usage
const handleCreate = async (data: ItemFormData) => {
  const tempId = await createItem(data);
  // tempId is the idempotency key, used as temporary ID
  setDialogOpen(false);
};
```

### Pattern 2: Pending State Display

**What:** Visual indicator for items pending sync
**When to use:** List views showing items that may have optimistic entries
**Example:**
```typescript
// Check if item has _pending property
const isPending = '_pending' in item && item._pending === true;

// In table row
<TableRow className={isPending ? "opacity-70" : ""}>
  <TableCell>
    {item.name}
    {isPending && (
      <Badge variant="outline" className="ml-2 text-xs">
        Pending sync
      </Badge>
    )}
  </TableCell>
</TableRow>
```

### Pattern 3: Approval Workflow Coexistence

**What:** Offline mutations must coexist with approval workflow
**When to use:** When member users submit changes that may need approval
**Flow:**
1. Mutation queued to IndexedDB
2. Optimistic item shown with `_pending: true`
3. When online, sync attempts POST/PATCH
4. If 202 Accepted, approval workflow takes over
5. If 201/200, change applied

**Key insight:** The `_pending` marker means "not yet synced to server". Once synced, if approval required, the item gets a different status via the approval pipeline.

### Anti-Patterns to Avoid
- **Don't mix direct API calls and offline mutations:** Use one pattern per form
- **Don't rely only on refetch() for optimistic updates:** The point is immediate feedback
- **Don't forget to handle both online and offline states:** Hook works in both

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Generating temp IDs | Custom UUID logic | useOfflineMutation (returns tempId) | UUIDv7 for temporal ordering |
| Queue persistence | Custom IndexedDB code | useOfflineMutation (uses queueMutation) | Already handles schema |
| Sync triggering | Custom online listener | syncManager.processQueue() | Handles locking, retries |
| Retry logic | Custom backoff | mutation-queue.ts (RETRY_CONFIG) | Exponential backoff built-in |
| Pending indicator | Custom state | `_pending: true` property | Consistent across hooks |

**Key insight:** The `useOfflineMutation` hook does queue-first optimistic updates - it writes to IndexedDB BEFORE triggering onMutate. This ensures mutations survive tab close.

## Common Pitfalls

### Pitfall 1: Forgetting Optimistic Data Shape
**What goes wrong:** Optimistic item missing required fields causes UI errors
**Why it happens:** The payload doesn't include generated fields (id, timestamps)
**How to avoid:** In onMutate, spread payload AND add generated fields:
```typescript
onMutate: (payload, tempId) => {
  addItem({
    ...payload,
    id: tempId,
    workspace_id: workspaceId,
    _pending: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Include defaults for nullable fields
    is_archived: false,
    min_stock_level: payload.min_stock_level || 0,
  });
}
```
**Warning signs:** TypeScript errors, UI rendering exceptions

### Pitfall 2: State Sync After Successful Online Mutation
**What goes wrong:** Optimistic item not replaced with server response
**Why it happens:** onSuccess callback not implemented or doesn't update state
**How to avoid:** Listen to MUTATION_SYNCED events from syncManager or refetch after sync:
```typescript
// In useEffect or via SyncManager subscription
syncManager?.subscribe((event) => {
  if (event.type === 'MUTATION_SYNCED') {
    refetch(); // Reload fresh data from server
  }
});
```
**Warning signs:** Duplicate items, stale temporary IDs

### Pitfall 3: Form Validation Before Queue
**What goes wrong:** Invalid data gets queued and fails server-side
**Why it happens:** Validation done after mutation attempt
**How to avoid:** Always validate BEFORE calling mutate:
```typescript
const handleSubmit = async (data: ItemFormData) => {
  // Validate first
  if (!data.sku.trim() || !data.name.trim()) {
    toast.error("SKU and Name are required");
    return;
  }
  // Then queue
  await createItem(data);
};
```
**Warning signs:** Queue fills with permanently failed mutations

### Pitfall 4: Not Handling Update Entity ID
**What goes wrong:** Updates fail because entityId not passed
**Why it happens:** Update operation requires entityId parameter
**How to avoid:** Pass entityId as second argument to mutate:
```typescript
const { mutate: updateItem } = useOfflineMutation({
  entity: 'items',
  operation: 'update',
});

// For updates, pass the ID
await updateItem(payload, item.id);
```
**Warning signs:** Update creates new item instead

### Pitfall 5: E2E Test Timing
**What goes wrong:** Test flakes due to timing issues with IndexedDB operations
**Why it happens:** IndexedDB is async, Playwright moves faster
**How to avoid:** Use waitFor patterns and check IndexedDB state:
```typescript
// Wait for optimistic item to appear
await expect(page.getByText('Pending sync')).toBeVisible({ timeout: 5000 });

// Wait for sync complete
await expect(page.getByText('Pending sync')).not.toBeVisible({ timeout: 10000 });
```
**Warning signs:** Flaky tests, works locally fails in CI

## Code Examples

### Example 1: Complete Offline-Capable Create Form
```typescript
// Source: Pattern derived from use-offline-mutation.ts and items/page.tsx
const { mutate: createItem, isPending: isCreating } = useOfflineMutation<ItemCreate>({
  entity: 'items',
  operation: 'create',
  onMutate: (payload, tempId) => {
    // 1. Add optimistic item to local state
    const optimisticItem: Item = {
      ...payload,
      id: tempId,
      workspace_id: workspaceId!,
      _pending: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_archived: false,
      min_stock_level: payload.min_stock_level ?? 0,
    };

    // Add to items state (depends on how list manages state)
    // Could be via setItems or via queryClient if using react-query
  },
});

const handleCreate = async (data: ItemFormData) => {
  if (!data.sku.trim() || !data.name.trim()) {
    toast.error("SKU and Name are required");
    return;
  }

  const createData: ItemCreate = {
    sku: data.sku,
    name: data.name,
    description: data.description || undefined,
    // ... map other fields
  };

  await createItem(createData);
  setDialogOpen(false);
  toast.success("Item queued for sync");
};
```

### Example 2: Pending Indicator in List
```typescript
// Source: Pattern derived from use-offline-mutation.ts
<TableRow
  key={item.id}
  className={cn(
    "cursor-pointer hover:bg-muted/50",
    '_pending' in item && item._pending && "bg-amber-50/50 dark:bg-amber-950/20"
  )}
>
  <TableCell>
    {item.name}
    {'_pending' in item && item._pending && (
      <Badge variant="outline" className="ml-2 text-xs text-amber-600">
        <Cloud className="w-3 h-3 mr-1 animate-pulse" />
        Pending
      </Badge>
    )}
  </TableCell>
</TableRow>
```

### Example 3: E2E Offline Create Flow Test
```typescript
// Source: Pattern derived from e2e/offline tests
test.describe("Offline Item Creation", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium only");

  test("creates item offline and syncs when online", async ({ page, context }) => {
    // Load items page
    await page.goto("/en/dashboard/items");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    // Verify offline indicator
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

    // Click Add Item button
    await page.getByRole("button", { name: /Add Item/i }).click();

    // Fill form
    await page.getByLabel("SKU").fill("TEST-OFFLINE-001");
    await page.getByLabel("Name").fill("Offline Test Item");

    // Submit
    await page.getByRole("button", { name: /Create/i }).click();

    // Verify optimistic item appears with pending indicator
    await expect(page.getByText("Offline Test Item")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pending")).toBeVisible();

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // Wait for sync and pending indicator to disappear
    await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 10000 });

    // Item should still be visible
    await expect(page.getByText("Offline Test Item")).toBeVisible();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct API in form | Queue-first optimistic | Already implemented | Enables offline |
| refetch() only | optimistic + refetch | Already implemented | Instant feedback |
| No pending UI | _pending property | Already implemented | User clarity |

**Current Status:**
- Infrastructure is 100% complete (per v1-MILESTONE-AUDIT.md)
- useOfflineMutation: 251 lines, fully functional
- useOfflineData: 147 lines, fully functional
- SyncManager: Handles queue processing, conflict resolution
- Missing: Form consumption of these hooks

## Open Questions

Things that couldn't be fully resolved:

1. **Local State Management Pattern**
   - What we know: Current Items page uses useInfiniteScroll + local state
   - What's unclear: Best way to inject optimistic items into infinite scroll state
   - Recommendation: Use a separate optimistic items state that merges with fetched items

2. **Update Operation and Optimistic Data**
   - What we know: Updates need entityId and cached updated_at for conflict detection
   - What's unclear: How to track original updated_at before edit
   - Recommendation: Store updated_at when opening edit dialog, pass to queueMutation

3. **useOfflineData Hook Usage (Optional Phase Item)**
   - What we know: Hook exists for stale-while-revalidate pattern
   - What's unclear: Whether items list should migrate to this vs current infinite scroll
   - Recommendation: Defer to Phase 5 optional scope - focus on mutations first

## Sources

### Primary (HIGH confidence)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/hooks/use-offline-mutation.ts` - Complete hook implementation
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/hooks/use-offline-data.ts` - Complete hook implementation
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/sync/mutation-queue.ts` - Queue operations
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/lib/sync/sync-manager.ts` - Sync orchestration
- `/home/antti/Repos/Misc/home-warehouse-system/.planning/v1-MILESTONE-AUDIT.md` - Gap analysis

### Secondary (MEDIUM confidence)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/app/[locale]/(dashboard)/dashboard/items/page.tsx` - Current form implementation (1537 lines)
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/e2e/offline/*.spec.ts` - E2E test patterns
- `/home/antti/Repos/Misc/home-warehouse-system/frontend/docs/PENDING_CHANGES_INTEGRATION.md` - Approval workflow integration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code exists in codebase, no external research needed
- Architecture: HIGH - Patterns documented in existing hooks and audit
- Pitfalls: MEDIUM - Derived from code analysis, not production experience

**Research date:** 2026-01-24
**Valid until:** N/A - Internal codebase research, patterns are stable
