# Phase 10: Inventory - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver offline mutation support for inventory records — physical instances of items at specific locations/containers. Inventory has multiple foreign key dependencies (item, location, optional container) and conflict-prone fields (quantity, status). Users can create and update inventory while offline with pending indicators and automatic sync.

</domain>

<decisions>
## Implementation Decisions

### Pending badge context
- Full context: "Pending... [ItemName] at [LocationName] / [ContainerName]" when container exists
- Without container: "Pending... [ItemName] at [LocationName]" (no trailing separator)
- When referencing pending entities: show names optimistically (no special "(pending)" in badge text)
- Row styling: amber background consistent with borrowers/categories/locations/containers pattern

### Dependency handling
- Allow creating inventory in pending (unsynced) locations — dependsOn chain handles sync order
- Allow assigning inventory to pending containers — container depends on location, inventory depends on both
- Allow creating inventory for pending items — inventory waits for item to sync first
- On dependency failure: cascade fail with clear message (e.g., "Failed: Location failed to sync")

### Conflict display
- Reuse existing conflict resolution UI from v1 — no changes for offline context
- Conflict check happens at sync time when mutation is processed
- New inventory records: no conflicts possible (nothing to conflict with)
- Update conflicts: only quantity and status trigger manual resolution (critical fields)

### Form behavior
- Location dropdown: include pending locations with "(pending)" suffix
- Container dropdown: filter by selected location (existing behavior), include pending containers with "(pending)" suffix
- Item dropdown: include pending items with "(pending)" suffix
- All dropdowns show pending entities visually distinct via text suffix

### Claude's Discretion
- Exact dropdown component implementation details
- Sync ordering implementation within existing infrastructure
- E2E test structure following established patterns

</decisions>

<specifics>
## Specific Ideas

- Pending suffix pattern: "Name (pending)" in dropdowns — explicit text indicator
- Badge format matches success criteria example: "Pending... Drill at Garage"
- Cascade failure message pattern: "Failed: [EntityType] failed to sync"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-inventory*
*Context gathered: 2026-01-24*
