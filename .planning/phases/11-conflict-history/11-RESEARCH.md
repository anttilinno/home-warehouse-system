# Phase 11: Conflict History - Research

**Researched:** 2026-01-25
**Domain:** IndexedDB conflict log querying, React list UI with filtering
**Confidence:** HIGH

## Summary

Phase 11 implements a conflict history UI to display all resolved sync conflicts stored in IndexedDB. The existing infrastructure already provides complete conflict logging functionality via `logConflict()` and `getConflictLog()` in `conflict-resolver.ts`, with an IndexedDB `conflictLog` store that includes indexes for `entityType`, `timestamp`, and `resolution`.

The implementation follows established patterns from the approvals page for list-based UI with filtering. The date range filter requires either a new shadcn/ui Calendar component installation OR a simple dual-input date picker using native HTML5 date inputs (recommended for simplicity).

**Primary recommendation:** Build a read-only history page at `/dashboard/sync-history` following the approvals page pattern, using the existing `conflictLog` IndexedDB store with its `entityType` and `timestamp` indexes for efficient filtering.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | 8.0.3 | Type-safe IndexedDB wrapper | Already used throughout offline system |
| date-fns | 4.1.0 | Date formatting/manipulation | Already used in conflict-resolution-dialog.tsx |
| @radix-ui/react-popover | 1.1.15 | Popover for date picker | Already installed |

### Optional (New Dependency)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-day-picker | 9.x | Calendar component | Only if native date inputs insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-day-picker Calendar | Native HTML5 date inputs | Native is simpler, less styling but sufficient for v1 |
| Custom date picker | react-day-picker preset lib | More features but external dependency |

**Installation (if Calendar needed):**
```bash
bun add react-day-picker
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── app/[locale]/(dashboard)/dashboard/
│   └── sync-history/
│       └── page.tsx              # Conflict history page (client component)
├── lib/
│   └── sync/
│       └── conflict-resolver.ts  # EXISTING - getConflictLog(), getConflictsByEntityType()
├── components/
│   └── ui/
│       ├── date-range-picker.tsx # NEW - Simple date range input component
│       └── calendar.tsx          # NEW (optional) - Only if rich calendar needed
└── messages/
    ├── en.json                   # Add "syncHistory" translations
    ├── et.json                   # Add "syncHistory" translations
    └── ru.json                   # Add "syncHistory" translations
```

### Pattern 1: IndexedDB Query with Index-Based Filtering
**What:** Use IndexedDB indexes for efficient filtering by entity type and date range
**When to use:** When filtering conflict log by entityType or timestamp range
**Example:**
```typescript
// Source: Existing offline-db.ts pattern + MDN IDBKeyRange docs
import { getDB } from "@/lib/db/offline-db";
import type { ConflictLogEntry, MutationEntityType } from "@/lib/db/types";

export async function getConflictsByEntityType(
  entityType: MutationEntityType,
  limit: number = 50
): Promise<ConflictLogEntry[]> {
  const db = await getDB();
  const tx = db.transaction("conflictLog", "readonly");
  const store = tx.objectStore("conflictLog");
  const index = store.index("entityType");

  const conflicts: ConflictLogEntry[] = [];
  let cursor = await index.openCursor(IDBKeyRange.only(entityType));

  while (cursor && conflicts.length < limit) {
    conflicts.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return conflicts.sort((a, b) => b.timestamp - a.timestamp); // Newest first
}

export async function getConflictsByDateRange(
  fromDate: number, // ms since epoch
  toDate: number,
  limit: number = 50
): Promise<ConflictLogEntry[]> {
  const db = await getDB();
  const tx = db.transaction("conflictLog", "readonly");
  const store = tx.objectStore("conflictLog");
  const index = store.index("timestamp");

  // IDBKeyRange.bound for date range query
  const range = IDBKeyRange.bound(fromDate, toDate, false, false);

  const conflicts: ConflictLogEntry[] = [];
  let cursor = await index.openCursor(range, "prev"); // Newest first

  while (cursor && conflicts.length < limit) {
    conflicts.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return conflicts;
}
```

### Pattern 2: Client-Side Combined Filtering
**What:** Apply multiple filters (entity type + date range) client-side after fetching
**When to use:** When combining multiple filter criteria (IndexedDB doesn't support compound queries easily)
**Example:**
```typescript
// Source: Approvals page pattern + conflict-resolver.ts
export async function getFilteredConflicts(
  filters: {
    entityType?: MutationEntityType;
    fromDate?: number;
    toDate?: number;
  },
  limit: number = 100
): Promise<ConflictLogEntry[]> {
  // Start with date-based fetch if date filter provided
  const db = await getDB();
  const tx = db.transaction("conflictLog", "readonly");
  const store = tx.objectStore("conflictLog");
  const index = store.index("timestamp");

  let range: IDBKeyRange | undefined;
  if (filters.fromDate && filters.toDate) {
    range = IDBKeyRange.bound(filters.fromDate, filters.toDate);
  } else if (filters.fromDate) {
    range = IDBKeyRange.lowerBound(filters.fromDate);
  } else if (filters.toDate) {
    range = IDBKeyRange.upperBound(filters.toDate);
  }

  const allConflicts: ConflictLogEntry[] = [];
  let cursor = await index.openCursor(range, "prev");

  while (cursor) {
    const entry = cursor.value;
    // Apply entity type filter client-side
    if (!filters.entityType || entry.entityType === filters.entityType) {
      allConflicts.push(entry);
      if (allConflicts.length >= limit) break;
    }
    cursor = await cursor.continue();
  }

  await tx.done;
  return allConflicts;
}
```

### Pattern 3: Simple Date Range Picker (Native Inputs)
**What:** Use native HTML5 date inputs with shadcn styling for date range selection
**When to use:** When a full calendar component is overkill
**Example:**
```typescript
// Source: shadcn/ui patterns + native HTML5
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface DateRangePickerProps {
  fromDate?: string; // ISO date string YYYY-MM-DD
  toDate?: string;
  onFromChange: (date: string | undefined) => void;
  onToChange: (date: string | undefined) => void;
}

export function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="from-date" className="sr-only">From</Label>
        <Input
          id="from-date"
          type="date"
          value={fromDate || ""}
          onChange={(e) => onFromChange(e.target.value || undefined)}
          className="w-[140px]"
        />
      </div>
      <span className="text-muted-foreground">to</span>
      <div className="flex items-center gap-2">
        <Label htmlFor="to-date" className="sr-only">To</Label>
        <Input
          id="to-date"
          type="date"
          value={toDate || ""}
          onChange={(e) => onToChange(e.target.value || undefined)}
          className="w-[140px]"
        />
      </div>
      {(fromDate || toDate) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            onFromChange(undefined);
            onToChange(undefined);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Fetching all conflicts then filtering:** IndexedDB indexes exist for a reason. Use `IDBKeyRange` for date filtering to avoid memory issues with large logs.
- **Server-side filtering for IndexedDB data:** Conflict log is client-only (IndexedDB). Don't create backend endpoints for this.
- **Complex compound index queries:** IndexedDB compound indexes are brittle. Prefer single-index queries with client-side combination.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB date range query | Manual cursor iteration with date comparison | `IDBKeyRange.bound()` with timestamp index | Index-based queries are O(log n) vs O(n) |
| Date formatting | Custom date string manipulation | `date-fns` formatDistanceToNow, format | Already in codebase, handles i18n |
| Entity type icons | Custom icon mapping | Reuse `entityTypeIcons` from approvals page | Consistency across UI |
| Filter state management | Complex reducer | Simple `useState` with multiple states | Filters are independent, simple state works |

**Key insight:** The conflict log infrastructure is already complete. This phase is purely UI work leveraging existing IndexedDB storage and query capabilities.

## Common Pitfalls

### Pitfall 1: Forgetting IndexedDB is Async in SSR Context
**What goes wrong:** Page crashes on server-side render because IndexedDB doesn't exist
**Why it happens:** Next.js pre-renders pages on server where IndexedDB is undefined
**How to avoid:** Use `"use client"` directive and check `typeof indexedDB !== "undefined"` before operations
**Warning signs:** Hydration errors, "indexedDB is not defined" errors

### Pitfall 2: IDBKeyRange with Wrong Data Types
**What goes wrong:** Date range queries return empty results
**Why it happens:** Comparing numbers (timestamps) with Date objects or strings
**How to avoid:** `conflictLog.timestamp` stores `number` (ms since epoch). Always compare with `Date.getTime()`
**Warning signs:** Empty results when data clearly exists in IndexedDB

### Pitfall 3: Missing Empty State for No Conflicts
**What goes wrong:** User sees blank page when no conflicts exist
**Why it happens:** Only handling the list rendering case
**How to avoid:** Use `EmptyState` component (already in codebase) for zero-conflict state
**Warning signs:** Blank content area, confusion about whether feature works

### Pitfall 4: Navigation Link Not Added
**What goes wrong:** Users can't find the conflict history page
**Why it happens:** Page created but sidebar not updated
**How to avoid:** Add nav item to sidebar.tsx with appropriate icon (History or Clock icon)
**Warning signs:** Page works but users report they can't find it

## Code Examples

Verified patterns from the existing codebase:

### Existing ConflictLogEntry Type
```typescript
// Source: frontend/lib/db/types.ts lines 102-123
export interface ConflictLogEntry {
  /** Auto-incremented ID (keyPath for IndexedDB) */
  id: number;
  /** Type of entity that had the conflict */
  entityType: MutationEntityType;
  /** ID of the entity */
  entityId: string;
  /** Local version of the data */
  localData: Record<string, unknown>;
  /** Server version of the data */
  serverData: Record<string, unknown>;
  /** Fields that differed between local and server */
  conflictFields: string[];
  /** How the conflict was resolved */
  resolution: ConflictResolution;
  /** Merged data if resolution was 'merged' */
  resolvedData?: Record<string, unknown>;
  /** Timestamp when conflict was detected (ms since epoch) */
  timestamp: number;
  /** Timestamp when conflict was resolved (ms since epoch) */
  resolvedAt?: number;
}
```

### Existing getConflictLog Function
```typescript
// Source: frontend/lib/sync/conflict-resolver.ts lines 332-350
export async function getConflictLog(
  limit: number = 50
): Promise<ConflictLogEntry[]> {
  const db = await getDB();
  const tx = db.transaction("conflictLog", "readonly");
  const store = tx.objectStore("conflictLog");
  const index = store.index("timestamp");

  const conflicts: ConflictLogEntry[] = [];
  let cursor = await index.openCursor(null, "prev"); // newest first

  while (cursor && conflicts.length < limit) {
    conflicts.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return conflicts;
}
```

### Existing Field Formatting Helpers
```typescript
// Source: frontend/components/conflict-resolution-dialog.tsx lines 47-78
const FIELD_LABELS: Record<string, string> = {
  quantity: "Quantity",
  status: "Status",
  condition: "Condition",
  location_id: "Location",
  container_id: "Container",
  notes: "Notes",
  // ... etc
};

function formatFieldName(fieldName: string): string {
  return (
    FIELD_LABELS[fieldName] ||
    fieldName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}
```

### Existing Entity Type Icons
```typescript
// Source: frontend/app/[locale]/(dashboard)/dashboard/approvals/page.tsx lines 65-73
const entityTypeIcons: Record<PendingChangeEntityType, typeof Package> = {
  item: Package,
  location: MapPin,
  container: Box,
  category: FolderTree,
  borrower: Users,
  loan: HandCoins,
  inventory: Archive,
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full calendar component | Native date inputs for simple cases | 2025 | Simpler UX, less bundle size |
| Full fetch + client filter | Index-based IDBKeyRange queries | Always preferred | Better performance at scale |

**Deprecated/outdated:**
- react-day-picker v8: Use v9 if installing (breaking changes in v9)
- Fetching entire conflictLog: Use index-based queries with limits

## Open Questions

Things that couldn't be fully resolved:

1. **Entity Name Resolution**
   - What we know: `ConflictLogEntry` stores `entityId` but not `entityName`
   - What's unclear: How to display friendly names when entity might not be in cache
   - Recommendation: Show entity type + ID as fallback, attempt cache lookup for name

2. **Conflict Log Retention**
   - What we know: No automatic cleanup of old conflict log entries
   - What's unclear: Should there be a "clear history" action or auto-purge?
   - Recommendation: Out of scope for v1, document as future enhancement

## Sources

### Primary (HIGH confidence)
- `frontend/lib/db/types.ts` - ConflictLogEntry interface definition
- `frontend/lib/sync/conflict-resolver.ts` - logConflict, getConflictLog functions
- `frontend/lib/db/offline-db.ts` - IndexedDB schema with conflictLog indexes
- `frontend/components/conflict-resolution-dialog.tsx` - Field formatting helpers
- `frontend/app/[locale]/(dashboard)/dashboard/approvals/page.tsx` - List UI pattern

### Secondary (MEDIUM confidence)
- [MDN IDBKeyRange](https://developer.mozilla.org/en-US/docs/Web/API/IDBKeyRange) - Date range query patterns
- [shadcn/ui Date Picker](https://ui.shadcn.com/docs/components/date-picker) - Calendar + Popover composition pattern

### Tertiary (LOW confidence)
- WebSearch results for shadcn date picker 2026 - Confirmed react-day-picker v9 compatibility

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies required
- Architecture: HIGH - Follows existing patterns from approvals page and conflict-resolver.ts
- Pitfalls: HIGH - Based on actual codebase patterns and IndexedDB best practices

**Research date:** 2026-01-25
**Valid until:** 60 days (stable domain, no external API dependencies)
