# Phase 9: Containers - Research

**Researched:** 2026-01-24
**Domain:** Offline mutations for containers with location foreign key dependency
**Confidence:** HIGH

## Summary

Phase 9 extends offline mutation support to containers. Unlike categories and locations (which have self-referential parent-child hierarchies), containers have a simpler structure: a required foreign key to `location_id`. This means containers depend on locations but don't have internal hierarchies requiring topological sort.

The key complexity is the foreign key dependency: when a user creates a container in a pending (optimistic) location, the container mutation must wait for the location to sync first. This is already handled by the `dependsOn` parameter in `useOfflineMutation` (Phase 7) and the existing entity sync order in sync-manager (categories, locations, borrowers, containers, items, inventory, loans).

The containers page currently has no offline mutation support - it uses direct API calls for CRUD operations. This phase will add the same patterns established in categories (Phase 7) and locations (Phase 8): optimistic state management, offline mutation hooks, pending indicators with location context, and E2E tests.

**Primary recommendation:** Follow the locations page pattern (not hierarchical tree, but simpler table-based), add useOfflineMutation hooks with dependsOn for pending location references, and show "Pending... in [LocationName]" badge. No topological sort needed for containers.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | IndexedDB wrapper with typed stores | Already integrated, containers store exists |
| uuid | 13.0.0 | UUIDv7 generation for idempotency | Already used for temp IDs |
| useOfflineMutation | internal | Queue mutations with optimistic UI | Supports dependsOn parameter (from Phase 7) |
| syncManager | internal | Entity-ordered queue processing | Has containers in ENTITY_SYNC_ORDER after locations |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mutation-queue.ts | internal | CRUD operations on mutation queue | queueMutation with dependsOn |
| offline-db.ts | internal | Generic IndexedDB CRUD | Container store operations |
| lucide-react | - | Cloud icon for pending badge | Already used in locations/categories |
| sonner | - | Toast notifications | Already used for sync feedback |

### No New Dependencies Required
All infrastructure exists from Phase 6-8. No topological sort needed for containers (flat, not hierarchical).

## Architecture Patterns

### Pattern 1: Foreign Key Dependency Tracking
**What:** When creating a container in a pending location, track the dependency via `dependsOn`
**When to use:** In containers page when user selects a location that exists only in optimistic state
**Why:** Entity sync order puts containers after locations, but specific container->location dependencies must be explicit

```typescript
// In containers/page.tsx handleSave function
const handleSave = async () => {
  // ... validation ...

  const payload: Record<string, unknown> = {
    name: formName.trim(),
    location_id: formLocationId,
    description: formDescription.trim() || null,
    capacity: formCapacity || null,
    short_code: formShortCode || undefined,
  };

  // Check if location is a pending optimistic location
  const locationIsPending = formLocationId && optimisticLocations.some(
    loc => loc.id === formLocationId && loc._pending
  );

  // If location is pending, we need to track dependency
  const dependsOn = locationIsPending ? [formLocationId] : undefined;

  await createContainerOffline(payload, undefined, dependsOn);
};
```

### Pattern 2: Merged Locations for Location Dropdown
**What:** Include optimistic (pending) locations in the location dropdown
**When to use:** When rendering the location select in the container form dialog
**Why:** User should be able to create containers in locations they just created offline

```typescript
// In containers/page.tsx
// State for optimistic locations (from locations context or local state)
const [optimisticLocations, setOptimisticLocations] = useState<(Location & { _pending?: boolean })[]>([]);

// Merge fetched locations with optimistic locations
const allLocations = useMemo(() => {
  const fetchedIds = new Set(locations.map(l => l.id));
  return [
    ...locations,
    ...optimisticLocations.filter(o => !fetchedIds.has(o.id))
  ];
}, [locations, optimisticLocations]);

// In the Select component
<Select value={formLocationId} onValueChange={setFormLocationId}>
  <SelectTrigger>
    <SelectValue placeholder="Select a location" />
  </SelectTrigger>
  <SelectContent>
    {allLocations.filter(loc => !loc.is_archived).map((loc) => (
      <SelectItem key={loc.id} value={loc.id}>
        {loc.name}{'_pending' in loc && loc._pending ? ' (pending)' : ''}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Pattern 3: Location Name Context in Pending Badge
**What:** Show "Pending... in Warehouse A" instead of just "Pending"
**When to use:** For containers where the location provides meaningful context
**Implementation:**

```typescript
// Helper to get location name
const getLocationName = (locationId: string): string | null => {
  const location = allLocations.find(l => l.id === locationId);
  return location?.name || null;
};

// In TableRow render
{container._pending && (
  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
    <Cloud className="w-3 h-3 mr-1 animate-pulse" />
    {(() => {
      const locationName = getLocationName(container.location_id);
      return locationName ? `Pending... in ${locationName}` : 'Pending';
    })()}
  </Badge>
)}
```

### Pattern 4: Optimistic Container State Management
**What:** Maintain optimistic containers separately from fetched containers, merge for display
**When to use:** Throughout the containers page for create and update operations

```typescript
// State for optimistic containers
const [optimisticContainers, setOptimisticContainers] = useState<(Container & { _pending?: boolean })[]>([]);

// Merge fetched containers with optimistic containers
const mergedContainers = useMemo(() => {
  const fetchedIds = new Set(containers.map(c => c.id));
  const merged = containers.map(c => {
    const optimistic = optimisticContainers.find(o => o.id === c.id);
    if (optimistic) return { ...c, ...optimistic, _pending: true };
    return c;
  });
  const newOptimistic = optimisticContainers.filter(o => !fetchedIds.has(o.id));
  return [...merged, ...newOptimistic];
}, [containers, optimisticContainers]);
```

### Anti-Patterns to Avoid
- **Don't skip dependsOn when location is pending:** Container will sync before location, causing FK constraint error
- **Don't hide pending locations from dropdown:** User can't create container in location they just created
- **Don't forget to filter archived locations from dropdown:** Both fetched and optimistic should filter is_archived
- **Don't show actions (edit/archive/delete) for pending containers:** They don't exist on server yet

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency tracking | Custom scheduler | useOfflineMutation with dependsOn | Already supports dependencies |
| Queue infrastructure | New queue system | Existing mutationQueue | Already handles entity ordering |
| Cascade failure | Custom error chain | Existing handleCascadeFailure in sync-manager | Already implemented |
| Table rendering | Custom table | Existing Table components | Already have sorting, selection |
| Optimistic merging | Complex merge logic | Simple useMemo merge | Pattern proven in locations |

**Key insight:** Containers are simpler than categories/locations - no hierarchy, no topological sort. Just FK dependency to locations.

## Common Pitfalls

### Pitfall 1: Creating Container Without dependsOn When Location is Pending
**What goes wrong:** Container syncs before location, server rejects with FK constraint error
**Why it happens:** Forgot to check if selected location is a pending optimistic location
**How to avoid:** In handleSave, check if formLocationId matches any optimistic location's tempId
**Warning signs:** 400 errors with "location not found" or FK constraint message

### Pitfall 2: Location Dropdown Only Shows Fetched Locations
**What goes wrong:** User creates location offline, can't select it when creating container
**Why it happens:** Dropdown only uses fetched locations array, not optimistic locations
**How to avoid:** Merge fetched and optimistic locations for dropdown
**Warning signs:** User creates location, then can't find it in dropdown

### Pitfall 3: Edit/Archive/Delete Actions Shown for Pending Containers
**What goes wrong:** User tries to archive pending container, gets error
**Why it happens:** Actions not conditional on _pending flag
**How to avoid:** Conditionally render DropdownMenu only for non-pending containers
**Warning signs:** 404 errors when trying to archive, confused UI state

### Pitfall 4: Location Name Not Found for Pending Badge
**What goes wrong:** Badge shows "Pending... in undefined"
**Why it happens:** Location lookup doesn't include optimistic locations
**How to avoid:** Use allLocations (fetched + optimistic) when looking up location name
**Warning signs:** "in undefined" or "in null" in UI

### Pitfall 5: Pending Count Not Updated in Global Indicator
**What goes wrong:** SyncStatusIndicator shows wrong pending count
**Why it happens:** Not re-checking count after container mutations
**How to avoid:** This is already handled by OfflineContext subscriptions - no action needed
**Warning signs:** Count doesn't increase when creating container offline

### Pitfall 6: Short Code Conflict with Pending Create
**What goes wrong:** User enters short_code that conflicts with existing container
**Why it happens:** Client doesn't validate short_code uniqueness
**How to avoid:** For Phase 9, accept that server will reject duplicates. User can retry with different code.
**Warning signs:** 400 "short_code already exists" after sync

## Code Examples

### Example 1: Container Type with Pending Flag
```typescript
// Source: frontend/lib/types/containers.ts (existing)
interface Container {
  id: string;
  workspace_id: string;
  name: string;
  location_id: string;      // Required FK to locations
  description?: string | null;
  capacity?: string | null;
  short_code?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// Extended for optimistic UI
type OptimisticContainer = Container & { _pending?: boolean };
```

### Example 2: Offline Mutation Hook Integration for Create
```typescript
// Source: Pattern from locations page, adapted for containers
const { mutate: createContainerOffline } = useOfflineMutation<Record<string, unknown>>({
  entity: 'containers',
  operation: 'create',
  onMutate: (payload, tempId, dependsOn) => {
    const optimisticContainer: Container & { _pending: boolean } = {
      id: tempId,
      workspace_id: workspaceId!,
      name: (payload.name as string) || '',
      location_id: (payload.location_id as string) || '',
      description: (payload.description as string) || null,
      capacity: (payload.capacity as string) || null,
      short_code: (payload.short_code as string) || null,
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _pending: true,
    };
    setOptimisticContainers(prev => [...prev, optimisticContainer]);
  },
});
```

### Example 3: Offline Mutation Hook Integration for Update
```typescript
// Source: Pattern from locations page, adapted for containers
const { mutate: updateContainerOffline } = useOfflineMutation<Record<string, unknown>>({
  entity: 'containers',
  operation: 'update',
  onMutate: (payload, _tempId) => {
    const entityId = payload._entityId as string;
    if (entityId) {
      setOptimisticContainers(prev => {
        const existing = prev.find(c => c.id === entityId);
        if (existing) {
          return prev.map(c => c.id === entityId ? { ...c, ...payload, _pending: true } : c);
        }
        const fromFetched = containers.find(c => c.id === entityId);
        if (fromFetched) {
          return [...prev, { ...fromFetched, ...payload, _pending: true }];
        }
        return prev;
      });
    }
  },
});
```

### Example 4: Sync Event Subscription
```typescript
// Source: Pattern from locations page
useEffect(() => {
  if (!syncManager) return;

  const handleSyncEvent = (event: SyncEvent) => {
    if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'containers') {
      const syncedKey = event.payload.mutation.idempotencyKey;
      const entityId = event.payload.mutation.entityId;
      setOptimisticContainers(prev => prev.filter(c => c.id !== syncedKey && c.id !== entityId));
      refetch();
    }
    if (event.type === 'MUTATION_FAILED' && event.payload?.mutation?.entity === 'containers') {
      toast.error('Failed to sync container', {
        description: event.payload.mutation.lastError || 'Please try again',
      });
    }
  };

  return syncManager.subscribe(handleSyncEvent);
}, [refetch]);
```

### Example 5: Pending Badge with Location Context in TableRow
```typescript
// Source: Pattern for TableRow in containers page
<TableRow
  key={container.id}
  className={cn(container._pending && "bg-amber-50")}
>
  <TableCell>
    <Checkbox
      checked={isSelected(container.id)}
      onCheckedChange={() => toggleSelection(container.id)}
      disabled={container._pending}
      aria-label={`Select ${container.name}`}
    />
  </TableCell>
  <TableCell>
    <div>
      <div className="font-medium flex items-center gap-2">
        {container.name}
        {container._pending && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 shrink-0">
            <Cloud className="w-3 h-3 mr-1 animate-pulse" />
            {(() => {
              const locationName = getLocationName(container.location_id);
              return locationName ? `Pending... in ${locationName}` : 'Pending';
            })()}
          </Badge>
        )}
        {container.is_archived && (
          <Badge variant="secondary" className="text-xs">
            Archived
          </Badge>
        )}
      </div>
      {container.description && (
        <div className="text-sm text-muted-foreground line-clamp-1">
          {container.description}
        </div>
      )}
    </div>
  </TableCell>
  {/* ... other cells ... */}
  <TableCell>
    {/* Hide dropdown menu for pending containers */}
    {!container._pending && (
      <DropdownMenu>
        {/* ... menu items ... */}
      </DropdownMenu>
    )}
  </TableCell>
</TableRow>
```

### Example 6: E2E Test for Container in Pending Location
```typescript
// Source: Pattern for e2e/offline/offline-containers.spec.ts
test("creates container in pending location with correct context", async ({ page, context }) => {
  const locationName = `Offline Location ${Date.now()}`;
  const containerName = `Offline Container ${Date.now()}`;

  // First navigate to locations and create a location offline
  await page.goto("/en/dashboard/locations");
  await page.waitForLoadState("domcontentloaded");

  // Go offline
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

  // Create location offline
  await page.getByRole("button", { name: /Add Location/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByLabel(/^Name/i).fill(locationName);
  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Navigate to containers page
  await page.goto("/en/dashboard/containers");
  await page.waitForLoadState("domcontentloaded");

  // Verify still offline
  await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

  // Create container in the pending location
  await page.getByRole("button", { name: /Add Container/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
  await page.getByLabel(/^Name/i).fill(containerName);

  // Select the pending location (should show with "(pending)" suffix)
  await page.locator('#location').click();  // Or the appropriate trigger
  await page.getByRole("option", { name: new RegExp(`${locationName}.*pending`, "i") }).click();

  await page.getByRole("button", { name: /Create/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

  // Verify container appears with pending indicator AND location context
  await expect(page.getByText(containerName)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(`Pending... in ${locationName}`)).toBeVisible({ timeout: 5000 });

  // Go online and verify sync order (location before container)
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // Both pending indicators should disappear
  await expect(page.getByText("Pending")).not.toBeVisible({ timeout: 15000 });

  // Container should remain visible
  await expect(page.getByText(containerName)).toBeVisible();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct API calls | Offline mutation queue | Phase 6-8 | Works offline |
| Single entity offline | Multi-entity with ordering | Phase 6 | Respects FK dependencies |
| No FK dependency | dependsOn parameter | Phase 7 | Explicit child->parent deps |
| categories/locations only | + containers | Phase 9 | Container offline support |

**Current Infrastructure Status:**
- SyncManager: Has entity ordering with containers after locations (line 44)
- MutationQueueEntry: Has dependsOn field ready
- Containers page: Has CRUD, SSE, table view, archive, needs offline integration
- IndexedDB: Has containers store already (types.ts line 143-146)
- useOfflineMutation: Already supports dependsOn parameter
- Pending badge drawer: Already has containers icon (Boxes, line 55)

## Differences from Locations Implementation

| Aspect | Locations | Containers | Impact on Implementation |
|--------|-----------|------------|-------------------------|
| Structure | Hierarchical tree | Flat table | No tree building, simpler rendering |
| Parent field | `parent_location` (self-ref) | `location_id` (FK to locations) | No topological sort needed |
| Topological sort | Yes (for hierarchy) | No | Less sync complexity |
| dependsOn tracking | Parent location pending | Location pending | Similar pattern, different field |
| Pending context | "under [ParentName]" | "in [LocationName]" | Different preposition |
| Visual indicator | Tree with MapPin | Table with Box | Different icons |
| Archive/restore | Yes | Yes | Same pattern |
| Short code | Yes | Yes | Same pattern |
| Bulk operations | No | Yes (table) | Keep bulk actions for synced only |

## Cross-Entity Location State

**Important consideration:** The containers page needs to know about pending locations to:
1. Show them in the location dropdown (so user can create container in pending location)
2. Track dependencies correctly (set dependsOn when location is pending)
3. Show correct location name in pending badge

**Options:**
1. **Local state**: Containers page subscribes to location sync events, maintains optimisticLocations locally
2. **Context**: Create LocationsOfflineContext that both pages share
3. **Refetch locations**: Load locations with useInfiniteScroll, then also load pending creates for locations

**Recommendation:** Option 1 (local state) - simpler, follows existing pattern from locations page. Containers page subscribes to location sync events and maintains its own optimistic locations state for the dropdown.

```typescript
// In containers page
useEffect(() => {
  if (!syncManager) return;

  const handleSyncEvent = (event: SyncEvent) => {
    // Track location syncs to update location dropdown
    if (event.type === 'MUTATION_SYNCED' && event.payload?.mutation?.entity === 'locations') {
      setOptimisticLocations(prev =>
        prev.filter(l => l.id !== event.payload!.mutation!.idempotencyKey)
      );
      loadLocations(); // Refresh locations after sync
    }
    // ... container sync handling ...
  };

  // Also load any pending location creates on mount
  getPendingMutationsForEntity('locations').then(mutations => {
    const pendingLocations = mutations
      .filter(m => m.operation === 'create')
      .map(m => ({
        ...(m.payload as Location),
        id: m.idempotencyKey,
        _pending: true,
      }));
    setOptimisticLocations(pendingLocations);
  });

  return syncManager.subscribe(handleSyncEvent);
}, [loadLocations]);
```

## Open Questions

### 1. Bulk Selection of Pending Containers
**What we know:** Table has bulk selection for export/archive
**Recommendation:** Disable checkbox for pending containers. They can't be exported (no server data) or archived (don't exist on server).

### 2. Search/Filter Including Pending Containers
**What we know:** Table has search and filter by location
**Recommendation:** Include pending containers in search/filter results. They should appear in filtered views matching their optimistic data.

### 3. Location Filter Shows Pending Locations
**What we know:** Filter popover shows location checkboxes for filtering
**Recommendation:** Include pending locations in filter (with "(pending)" suffix). User should be able to filter to see all containers in a pending location.

## Sources

### Primary (HIGH confidence - Codebase Analysis)
- `/frontend/app/[locale]/(dashboard)/dashboard/containers/page.tsx` - Current containers page (1036 lines)
- `/frontend/app/[locale]/(dashboard)/dashboard/locations/page.tsx` - Locations offline pattern (945 lines)
- `/frontend/lib/sync/sync-manager.ts` - Entity-ordered sync, ENTITY_SYNC_ORDER with containers (866 lines)
- `/frontend/lib/db/types.ts` - MutationQueueEntry with dependsOn, containers in OfflineDBSchema
- `/frontend/lib/types/containers.ts` - Container type definition with location_id field
- `/frontend/lib/hooks/use-offline-mutation.ts` - Hook implementation with dependsOn support
- `/frontend/components/sync-status-indicator.tsx` - Global pending count display
- `/frontend/lib/contexts/offline-context.tsx` - pendingMutationCount from OfflineContext
- `/frontend/components/pending-changes-drawer.tsx` - Containers icon already present

### Primary (HIGH confidence - Phase 7/8 Implementation)
- `/.planning/phases/07-categories/07-RESEARCH.md` - dependsOn pattern, entity ordering
- `/.planning/phases/08-locations/08-RESEARCH.md` - Hierarchical offline patterns
- `/frontend/e2e/offline/offline-locations.spec.ts` - E2E test patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All code exists in codebase
- Architecture: HIGH - Direct adaptation of verified Phase 8 patterns
- FK dependency: HIGH - dependsOn already proven for parent-child in categories/locations
- Containers page integration: HIGH - Same pattern as locations, well-documented
- Global pending count: HIGH - Already handled by OfflineContext subscriptions

**Research date:** 2026-01-24
**Valid until:** N/A - Internal codebase research, patterns stable

## Implementation Checklist

Phase 9 implementation should:

1. **containers/page.tsx:**
   - Add `Cloud` icon import
   - Add `optimisticContainers` state
   - Add `optimisticLocations` state (for location dropdown)
   - Add `useOfflineMutation` hooks for create and update
   - Add sync event subscription (MUTATION_SYNCED, MUTATION_FAILED) for both containers and locations
   - Load pending location creates on mount (for dropdown)
   - Add `mergedContainers` useMemo
   - Update getLocationName to use merged locations
   - Update handleSave to use offline mutations with dependsOn
   - Update location dropdown to show pending locations with "(pending)" suffix
   - Add pending badge to TableRow with location context ("Pending... in LocationName")
   - Hide dropdown menu (edit, archive, delete) for pending containers
   - Disable bulk selection checkbox for pending containers
   - Add amber background styling for pending rows

2. **E2E tests:**
   - Create `frontend/e2e/offline/offline-containers.spec.ts`
   - Test create container offline with pending indicator
   - Test update container offline with pending indicator
   - Test container in pending location with correct context badge
   - Test dropdown menu hidden for pending containers
   - Test location dropdown shows pending locations
