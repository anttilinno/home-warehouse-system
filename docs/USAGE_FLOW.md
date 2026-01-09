# Home Warehouse System - Usage Flow

## Overview

This document describes the complete lifecycle of using the Home Warehouse System, from initial setup through daily operations and maintenance.

---

## Phase 1: Initial Setup

### 1.1 Create Workspace

First-time setup creates your isolated environment.

```
User registers → Personal workspace auto-created → User becomes owner
```

### 1.2 Define Location Hierarchy

Start with physical structure before adding items. Work top-down:

```
Level 1 (Buildings/Areas):    House, Garage, Shed
Level 2 (Rooms/Zones):        Kitchen, Bedroom, Cellar
Level 3 (Specific spots):     Kitchen Cabinet A, Under Sink, Shelf 1
```

**Recommended approach:**
1. Walk through your property
2. Create all Level 1 locations first
3. Add Level 2 as children
4. Add Level 3 only where needed (don't over-engineer)

Each location gets a `short_code` for QR labels (e.g., `G1A2B3`).

### 1.3 Define Categories

Create a simple hierarchy. Start broad:

```
Tools
├── Power Tools
├── Hand Tools
└── Garden Tools

Electronics
├── Computers
├── Audio/Video
└── Cables & Adapters

Household
├── Kitchen
├── Cleaning
└── Furniture
```

**Tip:** Don't overthink categories initially. You can recategorize later.

### 1.4 Create Labels

Labels are flexible tags orthogonal to categories:

| Label | Color | Purpose |
|-------|-------|---------|
| Needs Info | #E74C3C | Incomplete item data |
| Needs Photo | #F39C12 | Missing image |
| Fragile | #9B59B6 | Handle with care |
| Seasonal | #3498DB | Holiday/seasonal items |
| Valuable | #F1C40F | High-value items |
| Consumable | #2ECC71 | Items that get used up |

### 1.5 Create Containers (Optional)

For locations with boxes, bins, drawers:

```
Location: Garage Shelf 1
├── Container: Blue Bin - Screws
├── Container: Red Bin - Electrical
└── Container: Toolbox A
```

Containers get their own `short_code` for labels.

---

## Phase 2: Cataloging (Your Current Stage)

### 2.1 Systematic Approach

Work location by location using `cataloging_status`:

```
1. Pick a location (e.g., Garage)
2. Set status: IN_PROGRESS
3. Catalog everything in that location
4. Set status: COMPLETED
5. Move to next location
```

### 2.2 Quick Entry Mode

When cataloging, prioritize speed over completeness:

**Minimum viable item:**
- Name (required)
- Location (required)
- Category (recommended)

**Add later:**
- Photos
- Serial numbers
- Purchase info
- Detailed description

**Mark incomplete items** with "Needs Info" label.

### 2.3 Item Entry Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  CREATE ITEM (Master Data)                                  │
│  - Name, SKU, Category, Brand, Model                        │
│  - This is the "what" - describes the item type             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CREATE INVENTORY (Physical Instance)                       │
│  - Location, Container, Quantity, Condition                 │
│  - This is the "where" - a physical thing in a place        │
│  - One item can have multiple inventory entries             │
└─────────────────────────────────────────────────────────────┘
```

**Example:**
- Item: "AA Batteries (Pack of 8)"
- Inventory 1: Kitchen drawer, quantity: 2 packs
- Inventory 2: Garage shelf, quantity: 5 packs

### 2.4 Handling Duplicates

Same item in multiple locations? Two approaches:

**Approach A: Single item, multiple inventory**
```
Item: Screwdriver Set
├── Inventory: Garage toolbox, qty: 1
└── Inventory: Kitchen drawer, qty: 1
```

**Approach B: Separate items**
```
Item: Screwdriver Set (Garage)
Item: Screwdriver Set (Kitchen)
```

Approach A is cleaner for fungible items (batteries, screws).
Approach B is simpler for unique items you want to track separately.

### 2.5 Progress Tracking

Query to see cataloging progress:

```sql
SELECT 
  l.name,
  l.cataloging_status,
  COUNT(DISTINCT i.id) as inventory_count,
  l.last_audited_at
FROM warehouse.locations l
LEFT JOIN warehouse.inventory i ON i.location_id = l.id
WHERE l.workspace_id = $1
GROUP BY l.id
ORDER BY 
  CASE l.cataloging_status 
    WHEN 'IN_PROGRESS' THEN 1 
    WHEN 'NOT_STARTED' THEN 2
    WHEN 'NEEDS_REVIEW' THEN 3
    ELSE 4 
  END;
```

---

## Phase 3: Daily Operations

### 3.1 Finding Items

**By search:**
```sql
SELECT i.name, loc.name as location, c.name as container
FROM warehouse.items i
JOIN warehouse.inventory inv ON inv.item_id = i.id
JOIN warehouse.locations loc ON loc.id = inv.location_id
LEFT JOIN warehouse.containers c ON c.id = inv.container_id
WHERE i.workspace_id = $1
  AND i.search_vector @@ plainto_tsquery('english', $2);
```

**By QR scan:**
Scan location/container/item `short_code` → Direct lookup.

**By browsing:**
Navigate location hierarchy or category tree.

### 3.2 Moving Items

When you move something:

```
1. Update inventory.location_id and/or inventory.container_id
2. System logs to inventory_movements automatically
3. Activity log captures the change
```

### 3.3 Loaning Items

```
1. Select inventory entry
2. Create loan (borrower, quantity, due_date)
3. Inventory status → ON_LOAN
4. System sends notification when due
5. Mark returned → loan.returned_at = now()
```

### 3.4 Consuming Items

For consumables (batteries, cleaning supplies):

```
1. Decrease inventory.quantity
2. When quantity hits min_stock_level → LOW_STOCK notification
3. When quantity = 0 → either delete inventory or set status = DISPOSED
```

### 3.5 Adding New Items

Quick flow for new purchases:

```
1. Scan barcode (if supported) or manual entry
2. Create item with basic info
3. Create inventory at "Incoming" or target location
4. Attach receipt photo
5. Add purchase price, warranty info
```

---

## Phase 4: Maintenance & Audits

### 4.1 Periodic Audits

Recommended: audit each location annually.

```
1. Filter locations by last_audited_at < 1 year ago
2. For each location:
   - Physically verify items exist
   - Check quantities
   - Update conditions
   - Remove items that are gone
3. Set cataloging_status = COMPLETED
4. Set last_audited_at = now()
```

### 4.2 Handling Disposed/Lost Items

**Option A: Soft delete (recommended for valuable items)**
```sql
UPDATE warehouse.items SET is_archived = true WHERE id = $1;
```
- Item remains in database
- Can be restored easily
- Shows in "archived" views

**Option B: Status change**
```sql
UPDATE warehouse.inventory SET status = 'DISPOSED' WHERE id = $1;
UPDATE warehouse.inventory SET status = 'MISSING' WHERE id = $1;
```
- Keeps item, marks as gone
- Good for tracking what happened

**Option C: Hard delete (permanent)**
```sql
DELETE FROM warehouse.inventory WHERE id = $1;
-- If no inventory left:
DELETE FROM warehouse.items WHERE id = $1;
```
- Gone forever (except audit log)
- Use sparingly

---

## Data Safety & Restoration

### Current Capabilities

| Entity | Soft Delete | Audit Trail | Easy Restore |
|--------|-------------|-------------|--------------|
| Items | ✅ `is_archived` | ✅ | ✅ Set `is_archived = false` |
| Inventory | ❌ | ✅ | ⚠️ Manual from audit log |
| Locations | ❌ | ✅ | ⚠️ Manual from audit log |
| Containers | ❌ | ✅ | ⚠️ Manual from audit log |
| Categories | ❌ | ✅ | ⚠️ Manual from audit log |
| Labels | ❌ | ✅ | ⚠️ Manual from audit log |

### What Activity Log Captures

```json
{
  "action": "DELETE",
  "entity_type": "LOCATION",
  "entity_id": "uuid-here",
  "entity_name": "Garage Shelf 1",
  "changes": {
    "name": {"old": "Garage Shelf 1", "new": null},
    "description": {"old": "Top shelf", "new": null}
  }
}
```

### Restoring from Audit Log (Manual Process)

```sql
-- Find what was deleted
SELECT * FROM warehouse.activity_log 
WHERE entity_type = 'LOCATION' 
  AND action = 'DELETE'
  AND entity_name ILIKE '%garage%'
ORDER BY created_at DESC;

-- Manually recreate from changes JSON
-- This is tedious but possible
```

### Recommendation: Add Soft Delete to Other Entities

See migration in next section.

---

## Appendix: Soft Delete Migration

To add consistent soft delete across all major entities:

```sql
-- Add is_archived to entities that lack it
ALTER TABLE warehouse.locations ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE warehouse.containers ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE warehouse.categories ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE warehouse.inventory ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

-- Add indexes for filtering
CREATE INDEX ix_locations_archived ON warehouse.locations(workspace_id) WHERE is_archived = false;
CREATE INDEX ix_containers_archived ON warehouse.containers(workspace_id) WHERE is_archived = false;
CREATE INDEX ix_categories_archived ON warehouse.categories(workspace_id) WHERE is_archived = false;
CREATE INDEX ix_inventory_archived ON warehouse.inventory(workspace_id) WHERE is_archived = false;
```

This enables easy restoration of any accidentally deleted record.

---

## Quick Reference: Status Workflows

### Location Cataloging Status
```
NOT_STARTED → IN_PROGRESS → COMPLETED
                   ↑              │
                   └──────────────┘
                   (needs attention)
                   
                        or
                        
COMPLETED → NEEDS_REVIEW → IN_PROGRESS → COMPLETED
```

### Item Lifecycle
```
                    ┌─────────────┐
                    │   CREATE    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
              ┌─────│  AVAILABLE  │─────┐
              │     └──────┬──────┘     │
              │            │            │
       ┌──────▼──────┐     │     ┌──────▼──────┐
       │   ON_LOAN   │     │     │   IN_USE    │
       └──────┬──────┘     │     └──────┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌───▼────┐ ┌─────▼─────┐
       │   MISSING   │ │DISPOSED│ │ ARCHIVED  │
       └─────────────┘ └────────┘ └───────────┘
```

### Loan Lifecycle
```
CREATE LOAN → ACTIVE → DUE_SOON notification → OVERDUE notification → RETURNED
                                                      │
                                                      └── (or stays overdue)
```
