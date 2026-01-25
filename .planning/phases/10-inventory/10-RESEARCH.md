# Phase 10: Inventory - Research

**Researched:** 2026-01-24
**Domain:** Offline mutations for inventory records with multiple foreign key dependencies (item, location, container)
**Confidence:** HIGH

## Summary

Phase 10 extends offline mutation support to inventory records - physical instances of items at specific locations/containers. Inventory has the most complex dependency structure in the system: required foreign keys to `item_id` and `location_id`, plus an optional foreign key to `container_id`. Additionally, inventory has conflict-prone fields (`quantity`, `status`) that are already configured in `CRITICAL_FIELDS` for manual conflict resolution.

The existing offline infrastructure from Phases 6-9 provides all necessary patterns: `useOfflineMutation` hook with `dependsOn` tracking, entity-ordered sync processing (inventory comes after items, locations, containers in ENTITY_SYNC_ORDER), and the conflict resolution dialog already handles inventory conflicts via `CRITICAL_FIELDS`.

The key complexity is the multi-entity dependency: a user can create inventory referencing pending items, pending locations, and/or pending containers. Each pending reference needs `dependsOn` tracking so the inventory mutation waits for all dependencies to sync first. The existing conflict resolution UI (ConflictResolutionDialog) already handles inventory quantity/status conflicts - no changes needed there.

**Primary recommendation:** Follow the containers page pattern (not hierarchical), add three separate optimistic state arrays (items, locations, containers), collect all pending references into `dependsOn`, and show "Pending... [ItemName] at [LocationName] / [ContainerName]" badge. Conflict resolution already works - just verify during testing.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | IndexedDB wrapper with typed stores | Already integrated, inventory store exists |
| uuid | 13.0.0 | UUIDv7 generation for idempotency | Already used for temp IDs |
| useOfflineMutation | internal | Queue mutations with optimistic UI | Supports dependsOn parameter (from Phase 7) |
| syncManager | internal | Entity-ordered queue processing | Has inventory in ENTITY_SYNC_ORDER after items/locations/containers |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mutation-queue.ts | internal | CRUD operations on mutation queue | queueMutation with dependsOn |
| offline-db.ts | internal | Generic IndexedDB CRUD | Inventory store operations |
| conflict-resolver.ts | internal | Critical field classification | inventory quantity/status already configured |
| lucide-react | - | Cloud icon for pending badge | Already used in items/borrowers/categories/locations/containers |
| sonner | - | Toast notifications | Already used for sync feedback |

### No New Dependencies Required
All infrastructure exists from Phase 6-9. Conflict resolution for inventory (quantity, status) already configured in CRITICAL_FIELDS.

## Architecture Patterns

### Pattern 1: Multi-Entity Dependency Tracking
**What:** When creating inventory with pending item, location, or container, track all dependencies via `dependsOn`
**When to use:** In inventory page when user selects any pending entity
**Why:** All dependencies must sync before inventory can sync

```typescript
// In inventory/page.tsx handleSave function
const handleSave = async () => {
  // ... validation ...

  const payload: Record<string, unknown> = {
    item_id: formItemId,
    location_id: formLocationId,
    container_id: formContainerId || undefined,
    quantity: formQuantity,
    condition: formCondition,
    status: formStatus,
    notes: formNotes || undefined,
  };

  // Collect all pending dependencies
  const dependsOn: string[] = [];

  // Check if item is pending
  const itemIsPending = optimisticItems.some(
    i => i.id === formItemId && i._pending
  );
  if (itemIsPending) dependsOn.push(formItemId);

  // Check if location is pending
  const locationIsPending = optimisticLocations.some(
    l => l.id === formLocationId && l._pending
  );
  if (locationIsPending) dependsOn.push(formLocationId);

  // Check if container is pending (optional field)
  if (formContainerId) {
    const containerIsPending = optimisticContainers.some(
      c => c.id === formContainerId && c._pending
    );
    if (containerIsPending) dependsOn.push(formContainerId);
  }

  await createInventoryOffline(
    payload,
    undefined,
    dependsOn.length > 0 ? dependsOn : undefined
  );
};
```

### Pattern 2: Three Optimistic State Arrays
**What:** Maintain optimistic state for items, locations, and containers (for dropdowns)
**When to use:** When rendering dropdowns that need to include pending entities
**Why:** User should be able to create inventory with entities they just created offline

```typescript
// In inventory/page.tsx
// State for optimistic entities from pending mutations
const [optimisticItems, setOptimisticItems] = useState<(Item & { _pending?: boolean })[]>([]);
const [optimisticLocations, setOptimisticLocations] = useState<(Location & { _pending?: boolean })[]>([]);
const [optimisticContainers, setOptimisticContainers] = useState<(Container & { _pending?: boolean })[]>([]);

// Merge fetched with optimistic for dropdowns
const allItems = useMemo(() => {
  const fetchedIds = new Set(items.map(i => i.id));
  return [
    ...items,
    ...optimisticItems.filter(o => !fetchedIds.has(o.id))
  ];
}, [items, optimisticItems]);

// Same pattern for allLocations, allContainers
```

### Pattern 3: Item + Location Context in Pending Badge
**What:** Show "Pending... [ItemName] at [LocationName] / [ContainerName]" per CONTEXT.md decisions
**When to use:** For pending inventory rows to provide meaningful context
**Implementation:**

```typescript
// Badge content based on CONTEXT.md decisions
{inventory._pending && (
  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
    <Cloud className="w-3 h-3 mr-1 animate-pulse" />
    {(() => {
      const itemName = getItemName(inventory.item_id);
      const locationName = getLocationName(inventory.location_id);
      const containerName = inventory.container_id
        ? getContainerName(inventory.container_id)
        : null;

      // Format: "Pending... [ItemName] at [LocationName] / [ContainerName]"
      // Or without container: "Pending... [ItemName] at [LocationName]"
      let context = `Pending... ${itemName} at ${locationName}`;
      if (containerName) {
        context += ` / ${containerName}`;
      }
      return context;
    })()}
  </Badge>
)}
```

### Pattern 4: Dropdown with "(pending)" Suffix
**What:** Show pending entities in all three dropdowns with visual distinction
**When to use:** Item, location, and container dropdown rendering
**Implementation:**

```typescript
// Item dropdown
<SelectContent>
  {allItems.filter(item => !item.is_archived).map((item) => (
    <SelectItem key={item.id} value={item.id}>
      {item.name} ({item.sku}){'_pending' in item && item._pending ? ' (pending)' : ''}
    </SelectItem>
  ))}
</SelectContent>

// Location dropdown - same pattern
// Container dropdown - filter by selected location (existing behavior), add "(pending)" suffix
```

### Pattern 5: Load Pending Mutations on Mount
**What:** Load pending creates for items, locations, and containers when component mounts
**When to use:** In useEffect on inventory page mount
**Why:** User navigating from another page may have pending entities not yet in allItems/allLocations/allContainers

```typescript
// Load pending items, locations, containers on mount
useEffect(() => {
  const loadPendingEntities = async () => {
    const [pendingItems, pendingLocations, pendingContainers] = await Promise.all([
      getPendingMutationsForEntity('items'),
      getPendingMutationsForEntity('locations'),
      getPendingMutationsForEntity('containers'),
    ]);

    // Convert to optimistic entities
    const optimisticItems = pendingItems
      .filter(m => m.operation === 'create')
      .map(m => ({
        ...(m.payload as Record<string, unknown>),
        id: m.idempotencyKey,
        workspace_id: workspaceId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_archived: false,
        _pending: true,
      }));

    setOptimisticItems(optimisticItems);
    // Same for locations, containers
  };

  if (workspaceId) loadPendingEntities();
}, [workspaceId]);
```

### Anti-Patterns to Avoid
- **Don't skip dependsOn for ANY pending reference:** Inventory will sync before dependency, causing FK constraint error
- **Don't forget to check all three entity types:** Item, location, AND container can all be pending
- **Don't show dropdown menu for pending inventory:** They don't exist on server yet
- **Don't allow bulk selection of pending inventory:** Can't export or bulk-update server-side
- **Don't modify conflict resolution UI:** CRITICAL_FIELDS already configured for inventory

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency tracking | Custom scheduler | useOfflineMutation with dependsOn array | Already supports multiple dependencies |
| Conflict resolution | New conflict system | Existing ConflictResolutionDialog + CRITICAL_FIELDS | Already works for inventory |
| Queue infrastructure | New queue system | Existing mutationQueue | Already handles entity ordering |
| Entity lookups | Custom store queries | getPendingMutationsForEntity | Already implemented |
| Cascade failure | Custom error chain | Existing handleCascadeFailure in sync-manager | Already implemented |

**Key insight:** Inventory just has MORE dependencies than containers (3 vs 1), but the same pattern applies. The conflict resolution for quantity/status is already fully implemented.

## Common Pitfalls

### Pitfall 1: Creating Inventory Without All dependsOn
**What goes wrong:** Inventory syncs before item/location/container, server rejects with FK constraint error
**Why it happens:** Forgot to check ALL three entity types for pending status
**How to avoid:** Check optimisticItems, optimisticLocations, AND optimisticContainers when building dependsOn array
**Warning signs:** 400 errors with "item not found", "location not found", or "container not found" messages

### Pitfall 2: Missing Pending Entities in Dropdowns
**What goes wrong:** User creates item/location/container offline, can't select it when creating inventory
**Why it happens:** Dropdown only uses fetched arrays, not optimistic arrays
**How to avoid:** Merge fetched and optimistic for all three dropdowns
**Warning signs:** User creates item, navigates to inventory, can't find item in dropdown

### Pitfall 3: Container Not Filtered by Location When Pending
**What goes wrong:** Container dropdown shows all containers, not filtered by selected location
**Why it happens:** Filter logic doesn't account for optimistic containers
**How to avoid:** Filter allContainers by formLocationId just like existing filter logic
**Warning signs:** Containers from wrong locations appear in dropdown

### Pitfall 4: Edit/Archive Actions Shown for Pending Inventory
**What goes wrong:** User tries to archive pending inventory, gets error
**Why it happens:** Actions not conditional on _pending flag
**How to avoid:** Hide DropdownMenu for rows where _pending is true
**Warning signs:** 404 errors when archiving, confused UI state

### Pitfall 5: Pending Badge Shows "Unknown Item" or "Unknown Location"
**What goes wrong:** Badge shows "Pending... Unknown Item at Unknown Location"
**Why it happens:** Lookup functions don't check optimistic arrays
**How to avoid:** Use allItems/allLocations/allContainers in getItemName/getLocationName/getContainerName
**Warning signs:** "Unknown" or undefined in badge text

### Pitfall 6: Conflict Resolution Not Triggering
**What goes wrong:** Inventory update conflicts auto-resolve when they should prompt user review
**Why it happens:** Unlikely - CRITICAL_FIELDS already configured, but verify during testing
**How to avoid:** Test quantity and status conflict scenarios during E2E tests
**Warning signs:** No dialog appears when quantity/status conflict with server

### Pitfall 7: Pending Count Not Updated in Global Indicator
**What goes wrong:** SyncStatusIndicator shows wrong pending count
**Why it happens:** This should already work - OfflineContext handles pendingMutationCount generically
**How to avoid:** Verify during testing - no code change needed
**Warning signs:** Count doesn't increase when creating inventory offline

## Code Examples

### Example 1: Inventory Type with Pending Flag
```typescript
// Source: frontend/lib/types/inventory.ts (existing)
interface Inventory {
  id: string;
  workspace_id: string;
  item_id: string;           // Required FK to items
  location_id: string;       // Required FK to locations
  container_id?: string | null; // Optional FK to containers
  quantity: number;          // CRITICAL_FIELD - triggers manual conflict resolution
  condition: InventoryCondition;
  status: InventoryStatus;   // CRITICAL_FIELD - triggers manual conflict resolution
  date_acquired?: string | null;
  purchase_price?: number | null;
  currency_code?: string | null;
  warranty_expires?: string | null;
  expiration_date?: string | null;
  notes?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// Extended for optimistic UI
type OptimisticInventory = Inventory & { _pending?: boolean };
```

### Example 2: Offline Mutation Hook Integration for Create
```typescript
// Source: Pattern from containers page, adapted for inventory with multi-dependency
const { mutate: createInventoryOffline } = useOfflineMutation<Record<string, unknown>>({
  entity: 'inventory',
  operation: 'create',
  onMutate: (payload, tempId, dependsOn) => {
    const optimisticInventory: Inventory & { _pending: boolean } = {
      id: tempId,
      workspace_id: workspaceId!,
      item_id: (payload.item_id as string) || '',
      location_id: (payload.location_id as string) || '',
      container_id: (payload.container_id as string) || null,
      quantity: (payload.quantity as number) || 1,
      condition: (payload.condition as InventoryCondition) || 'GOOD',
      status: (payload.status as InventoryStatus) || 'AVAILABLE',
      date_acquired: (payload.date_acquired as string) || null,
      purchase_price: (payload.purchase_price as number) || null,
      currency_code: (payload.currency_code as string) || null,
      warranty_expires: (payload.warranty_expires as string) || null,
      expiration_date: (payload.expiration_date as string) || null,
      notes: (payload.notes as string) || null,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _pending: true,
    };
    setOptimisticInventory(prev => [...prev, optimisticInventory]);
  },
});
```

### Example 3: Offline Mutation Hook Integration for Update
```typescript
// Source: Pattern from containers page, adapted for inventory
const { mutate: updateInventoryOffline } = useOfflineMutation<Record<string, unknown>>({
  entity: 'inventory',
  operation: 'update',
  onMutate: (payload, _tempId) => {
    const entityId = payload._entityId as string;
    if (entityId) {
      setOptimisticInventory(prev => {
        const existing = prev.find(inv => inv.id === entityId);
        if (existing) {
          return prev.map(inv =>
            inv.id === entityId ? { ...inv, ...payload, _pending: true } : inv
          );
        }
        const fromFetched = inventories.find(inv => inv.id === entityId);
        if (fromFetched) {
          return [...prev, { ...fromFetched, ...payload, _pending: true }];
        }
        return prev;
      });
    }
  },
});
```

### Example 4: Sync Event Subscription for Multi-Entity
```typescript
// Source: Pattern from containers page, expanded for inventory
useEffect(() => {
  if (!syncManager) return;

  const handleSyncEvent = (event: SyncEvent) => {
    // Handle inventory syncs
    if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'inventory') {
      const syncedKey = event.payload.mutation.idempotencyKey;
      const entityId = event.payload.mutation.entityId;
      setOptimisticInventory(prev => prev.filter(inv =>
        inv.id !== syncedKey && inv.id !== entityId
      ));
      refetch();
    }

    // Handle item syncs - update optimistic items
    if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'items') {
      setOptimisticItems(prev =>
        prev.filter(i => i.id !== event.payload!.mutation!.idempotencyKey)
      );
      loadItems(); // Refresh items
    }

    // Handle location syncs
    if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'locations') {
      setOptimisticLocations(prev =>
        prev.filter(l => l.id !== event.payload!.mutation!.idempotencyKey)
      );
      loadLocations(); // Refresh locations
    }

    // Handle container syncs
    if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'containers') {
      setOptimisticContainers(prev =>
        prev.filter(c => c.id !== event.payload!.mutation!.idempotencyKey)
      );
      loadContainers(); // Refresh containers
    }

    // Handle inventory failures
    if (event.type === 'MUTATION_FAILED' && event.payload?.mutation?.entity === 'inventory') {
      toast.error('Failed to sync inventory', {
        description: event.payload.mutation.lastError || 'Please try again',
      });
    }
  };

  return syncManager.subscribe(handleSyncEvent);
}, [refetch, loadItems, loadLocations, loadContainers]);
```

### Example 5: Pending Badge with Full Context
```typescript
// Source: Pattern for TableRow in inventory page - per CONTEXT.md decisions
<TableRow
  key={inventory.id}
  className={cn(inventory._pending && "bg-amber-50")}
>
  <TableCell>
    <Checkbox
      checked={isSelected(inventory.id)}
      onCheckedChange={() => toggleSelection(inventory.id)}
      disabled={inventory._pending}
      aria-label={`Select ${getItemName(inventory.item_id)}`}
    />
  </TableCell>
  <TableCell>
    <div>
      <div className="font-medium flex items-center gap-2">
        {getItemName(inventory.item_id)}
        {inventory._pending && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
            <Cloud className="w-3 h-3 mr-1 animate-pulse" />
            {(() => {
              const itemName = getItemName(inventory.item_id);
              const locationName = getLocationName(inventory.location_id);
              const containerName = inventory.container_id
                ? getContainerName(inventory.container_id)
                : null;

              // "Pending... Drill at Garage / Toolbox" or "Pending... Drill at Garage"
              let context = `Pending... ${itemName} at ${locationName}`;
              if (containerName) {
                context += ` / ${containerName}`;
              }
              return context;
            })()}
          </Badge>
        )}
      </div>
      <div className="text-sm text-muted-foreground font-mono">
        {getItemSKU(inventory.item_id)}
      </div>
    </div>
  </TableCell>
  {/* ... other cells ... */}
  <TableCell>
    {/* Hide dropdown menu for pending inventory */}
    {!inventory._pending && (
      <DropdownMenu>
        {/* ... menu items ... */}
      </DropdownMenu>
    )}
  </TableCell>
</TableRow>
```

### Example 6: E2E Test for Multi-Dependency Create
```typescript
// Source: Pattern for e2e/offline/offline-inventory.spec.ts
test("creates inventory with pending item and location", async ({ page, context }) => {
  const itemName = `Offline Item ${Date.now()}`;
  const locationName = `Offline Location ${Date.now()}`;

  // Create item offline first
  await page.goto("/en/dashboard/items");
  await page.waitForLoadState("domcontentloaded");

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: /Add Item/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByLabel(/^Name/i).fill(itemName);
  await page.getByLabel(/SKU/i).fill(`SKU-${Date.now()}`);
  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Create location offline
  await page.goto("/en/dashboard/locations");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: /Add Location/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByLabel(/^Name/i).fill(locationName);
  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Navigate to inventory
  await page.goto("/en/dashboard/inventory");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

  // Create inventory with pending item and location
  await page.getByRole("button", { name: /Add Inventory/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

  // Select pending item (should show with "(pending)" suffix)
  await page.locator('#item').click();
  await page.getByRole("option", { name: new RegExp(`${itemName}.*pending`, "i") }).click();

  // Select pending location
  await page.locator('#location').click();
  await page.getByRole("option", { name: new RegExp(`${locationName}.*pending`, "i") }).click();

  // Fill quantity
  await page.getByLabel(/Quantity/i).fill("5");

  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Verify inventory appears with full context badge
  await expect(page.getByText(`Pending... ${itemName} at ${locationName}`)).toBeVisible({ timeout: 5000 });

  // Go online and verify all three sync in correct order (item, location, then inventory)
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // All pending indicators should disappear
  await expect(page.getByText(/Pending/)).not.toBeVisible({ timeout: 20000 });

  // Inventory should remain visible with item name
  await expect(page.getByText(itemName)).toBeVisible();
});
```

### Example 7: E2E Test for Update Conflict (Verify Existing Behavior)
```typescript
// Source: Pattern for verifying existing conflict resolution works
test("inventory update triggers conflict resolution UI when quantity differs", async ({ page, context }) => {
  // Prerequisite: Need existing inventory to update
  // This test verifies the EXISTING behavior - CRITICAL_FIELDS already has inventory: ["quantity", "status"]

  // Navigate to inventory
  await page.goto("/en/dashboard/inventory");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

  // Wait for inventory to load
  const inventoryRows = page.locator("tbody tr");
  await expect(inventoryRows.first()).toBeVisible({ timeout: 10000 });

  // Note: Full conflict testing requires:
  // 1. Make offline update to quantity
  // 2. Simulate server change to same entity with different quantity
  // 3. Go online
  // 4. Verify ConflictResolutionDialog appears

  // For Phase 10, we verify that:
  // - ConflictResolutionDialog exists and is wired up
  // - CRITICAL_FIELDS includes inventory: ["quantity", "status"]
  // This is already verified by existing infrastructure

  // Simplified verification: update inventory offline, go online, verify sync completes
  // Full conflict testing can be a separate test with server-side fixture manipulation
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct API calls | Offline mutation queue | Phase 6 | Works offline |
| Single entity dependency | Multi-entity dependsOn | Phase 10 | Inventory with 3 FKs |
| containers/locations only | + inventory | Phase 10 | Full inventory offline |
| Conflict auto-resolve all | CRITICAL_FIELDS for inventory | Phase 3 | quantity/status require review |

**Current Infrastructure Status:**
- SyncManager: Has entity ordering with inventory AFTER items, locations, containers (line 46)
- MutationQueueEntry: Has dependsOn field supporting array of dependencies
- CRITICAL_FIELDS: Already has `inventory: ["quantity", "status"]`
- ConflictResolutionDialog: Already handles inventory conflicts
- IndexedDB: Has inventory store already (types.ts line 134-136)
- useOfflineMutation: Already supports dependsOn array
- SyncStatusIndicator: Already includes inventory in pending count

## Differences from Containers Implementation

| Aspect | Containers | Inventory | Impact on Implementation |
|--------|------------|-----------|-------------------------|
| FK dependencies | 1 (location_id) | 3 (item_id, location_id, container_id) | Need to track all 3 for dependsOn |
| Optional FK | None | container_id | Conditional dependsOn check |
| Conflict fields | None configured | quantity, status | Verify existing conflict UI works |
| Pending badge context | "in [LocationName]" | "[ItemName] at [LocationName] / [ContainerName]" | More complex context string |
| Dropdown entities | locations only | items, locations, containers | Need 3 optimistic state arrays |
| Entity sync position | After locations | After items, locations, containers | More dependencies to wait for |

## Conflict Resolution Details

**Already Configured (conflict-resolver.ts line 26-29):**
```typescript
export const CRITICAL_FIELDS: Record<string, string[]> = {
  inventory: ["quantity", "status"],  // Already present!
  loans: ["quantity", "returned_at"],
};
```

**What This Means for Phase 10:**
- Create operations: No conflicts possible (nothing to conflict with)
- Update operations with quantity change: ConflictResolutionDialog will appear
- Update operations with status change: ConflictResolutionDialog will appear
- Update operations with other field changes: Auto-resolve with LWW (server wins)

**No Changes Needed to Conflict Resolution:**
The existing infrastructure handles inventory conflicts. Phase 10 just needs to verify it works during testing.

## Open Questions

### 1. Virtual Scrolling with Optimistic Rows
**What we know:** Inventory page uses virtual scrolling for performance
**What's unclear:** Does virtualizer handle dynamic row count with optimistic additions?
**Recommendation:** Test with existing virtualizer. If issues, may need to pass updated count. Existing pattern from items page suggests this works.

### 2. Inline Edit for Pending Rows
**What we know:** Inventory has inline edit for quantity/condition/status
**Recommendation:** Disable inline edit for pending rows (they're not on server yet). Use `_pending` flag to conditionally render static text instead of InlineEditCell.

### 3. Bulk Status Update Including Pending
**What we know:** BulkActionBar updates status for selected items
**Recommendation:** Already handled by disabling checkbox for pending rows. Pending rows won't be in selectedIds.

## Sources

### Primary (HIGH confidence - Codebase Analysis)
- `/frontend/app/[locale]/(dashboard)/dashboard/inventory/page.tsx` - Current inventory page (1431 lines)
- `/frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx` - Containers offline pattern with dependsOn
- `/frontend/lib/sync/sync-manager.ts` - Entity-ordered sync, ENTITY_SYNC_ORDER with inventory after items/locations/containers
- `/frontend/lib/sync/conflict-resolver.ts` - CRITICAL_FIELDS with inventory: ["quantity", "status"]
- `/frontend/components/conflict-resolution-dialog.tsx` - Conflict resolution UI
- `/frontend/lib/sync/use-conflict-resolution.tsx` - Conflict resolution hook
- `/frontend/lib/db/types.ts` - MutationQueueEntry with dependsOn, inventory in OfflineDBSchema
- `/frontend/lib/types/inventory.ts` - Inventory type definition with item_id, location_id, container_id fields
- `/frontend/lib/hooks/use-offline-mutation.ts` - Hook implementation with dependsOn array support
- `/frontend/e2e/offline/offline-containers.spec.ts` - E2E test patterns with multi-entity dependencies

### Primary (HIGH confidence - Phase 7-9 Research)
- `/.planning/phases/09-containers/09-RESEARCH.md` - FK dependency pattern, location dropdown with pending
- `/.planning/phases/08-locations/08-RESEARCH.md` - Hierarchical offline patterns
- `/.planning/phases/06-infrastructure-borrowers/06-RESEARCH.md` - Entity sync order, dependsOn pattern

### Primary (HIGH confidence - Phase 10 Context)
- `/.planning/phases/10-inventory/10-CONTEXT.md` - User decisions on badge format, dependency handling, conflict display

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code exists in codebase
- Architecture: HIGH - Direct adaptation of verified containers pattern with multiple dependencies
- FK dependencies: HIGH - dependsOn already supports array (tested in containers with single dependency)
- Conflict resolution: HIGH - CRITICAL_FIELDS already configured for inventory
- Inventory page integration: HIGH - Same pattern as containers, well-documented
- Global pending count: HIGH - Already handled by OfflineContext subscriptions

**Research date:** 2026-01-24
**Valid until:** N/A - Internal codebase research, patterns stable

## Implementation Checklist

Phase 10 implementation should:

1. **inventory/page.tsx:**
   - Add `Cloud` icon import
   - Add `optimisticInventory` state
   - Add `optimisticItems`, `optimisticLocations`, `optimisticContainers` state
   - Add `useOfflineMutation` hooks for create and update
   - Add sync event subscription for inventory, items, locations, containers
   - Load pending creates for all 3 reference entities on mount
   - Add `allItems`, `allLocations`, `allContainers` useMemo merges
   - Add `mergedInventory` useMemo
   - Update getItemName/getLocationName/getContainerName to use merged arrays
   - Update handleSave to use offline mutations with dependsOn array
   - Update item dropdown to show pending items with "(pending)" suffix
   - Update location dropdown to show pending locations with "(pending)" suffix
   - Update container dropdown to show pending containers with "(pending)" suffix (still filtered by location)
   - Add pending badge with full context: "Pending... [ItemName] at [LocationName] / [ContainerName]"
   - Hide dropdown menu (edit, archive, move) for pending inventory
   - Disable bulk selection checkbox for pending inventory
   - Add amber background styling for pending rows
   - Disable inline edit for pending rows

2. **E2E tests:**
   - Create `frontend/e2e/offline/offline-inventory.spec.ts`
   - Test create inventory offline with pending indicator
   - Test update inventory offline with pending indicator
   - Test inventory with pending item, location, and container (multi-dependency)
   - Test dropdown menu hidden for pending inventory
   - Test all three dropdowns show pending entities with "(pending)" suffix
   - Test badge shows full context with item + location + container names
   - Verify existing conflict resolution triggers for quantity/status (verification test)
