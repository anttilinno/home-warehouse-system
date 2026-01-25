# Phase 3: Conflict Resolution - Research

**Researched:** 2026-01-24
**Domain:** Offline sync conflict detection and resolution
**Confidence:** HIGH

## Summary

The Home Warehouse System already has a robust backend foundation for conflict resolution through the existing batch sync endpoint (`POST /sync/batch`). The backend implements timestamp-based optimistic concurrency control using `updated_at` columns present on all entity tables. When a conflict is detected (server's `updated_at` is newer than client's), the batch endpoint returns the server's current data alongside a `conflict` status.

The frontend sync-manager currently processes mutations individually via standard REST endpoints but does not detect or handle 409 Conflict responses. This phase needs to:
1. Integrate with the existing batch endpoint for conflict-aware sync
2. Add conflict detection to the current sync flow (fallback for non-batch operations)
3. Implement UI for conflict notification and resolution
4. Store conflict audit trail in IndexedDB with optional server sync

**Primary recommendation:** Use the existing batch sync endpoint which already returns server data on conflicts. For critical fields (inventory quantity, status), show a merge dialog. For non-critical fields, apply last-write-wins with a notification toast.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Place)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sonner | ^2.0.7 | Toast notifications | Already used throughout app, supports action buttons |
| @radix-ui/react-dialog | ^1.1.15 | Conflict resolution dialog | Already in shadcn/ui setup |
| idb | 8.0.3 | IndexedDB wrapper | Already used for offline storage |

### Supporting (No New Dependencies Needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.562.0 | Icons for conflict indicators | Already available |
| date-fns | ^4.1.0 | Timestamp formatting in conflict UI | Already available |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom diff component | react-diff-viewer | Extra dependency; simple field comparison sufficient for this use case |
| IndexedDB audit trail | Server-only audit | Server already has activity_log; IndexedDB provides immediate offline access |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/lib/sync/
├── sync-manager.ts          # Existing - add conflict event types
├── mutation-queue.ts        # Existing - no changes needed
├── conflict-detector.ts     # NEW - conflict detection logic
├── conflict-resolver.ts     # NEW - resolution strategies
└── conflict-store.ts        # NEW - IndexedDB conflict audit trail

frontend/components/sync/
├── SyncStatusIndicator.tsx  # Existing - enhance with conflict badge
├── ConflictNotification.tsx # NEW - toast wrapper for conflicts
├── ConflictResolutionDialog.tsx # NEW - merge UI for critical fields
└── ConflictDiffView.tsx     # NEW - side-by-side field comparison
```

### Pattern 1: Timestamp-Based Optimistic Concurrency
**What:** Compare client's `updated_at` with server's before applying mutations
**When to use:** All update operations
**Example:**
```typescript
// Source: Backend batch/service.go line 142-145
// Already implemented in backend, frontend needs to send updated_at
interface MutationWithTimestamp {
  operation: 'update';
  entity_type: string;
  entity_id: string;
  data: Record<string, unknown>;
  updated_at: string; // ISO 8601 timestamp from cached entity
}
```

### Pattern 2: Conflict Classification
**What:** Classify fields as critical (require manual resolution) vs non-critical (auto-resolve)
**When to use:** When conflict is detected, before showing UI
**Example:**
```typescript
// Critical fields requiring manual resolution
const CRITICAL_FIELDS: Record<string, string[]> = {
  inventory: ['quantity', 'status'],
  loans: ['quantity', 'returned_at'],
};

// Non-critical fields use last-write-wins
function isCriticalConflict(entityType: string, changedFields: string[]): boolean {
  const critical = CRITICAL_FIELDS[entityType] || [];
  return changedFields.some(field => critical.includes(field));
}
```

### Pattern 3: Three-State Resolution
**What:** Offer "Keep Mine", "Use Server", or "Merge" options
**When to use:** Critical field conflicts in dialog
**Example:**
```typescript
type ConflictResolution =
  | { strategy: 'keep-local'; }
  | { strategy: 'use-server'; }
  | { strategy: 'merge'; merged: Record<string, unknown>; };
```

### Anti-Patterns to Avoid
- **Silent data loss:** Never auto-resolve critical fields without user awareness
- **Blocking UI for non-critical conflicts:** Use toasts, not dialogs, for LWW notifications
- **Polling for conflicts:** Use server responses, not separate conflict-check endpoints
- **Storing full entity copies:** Store only changed fields and timestamps in audit trail

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict detection | Custom timestamp comparison in fetch | Batch endpoint with `updated_at` | Backend already returns server data on conflict |
| Toast with actions | Custom modal for notifications | `toast()` with action button | Sonner handles dismiss/action callbacks |
| Diff visualization | Custom comparison logic | Simple field iteration | Only need field-by-field comparison, not text diff |
| Audit storage | localStorage JSON | IndexedDB with `conflictLog` store | Already using idb, consistent with mutation queue |

**Key insight:** The backend batch endpoint does all the heavy lifting - it compares timestamps, returns server state on conflict, and counts conflicts. The frontend just needs to interpret and present the results.

## Common Pitfalls

### Pitfall 1: Not Sending updated_at
**What goes wrong:** Mutations sync without conflict detection, leading to silent overwrites
**Why it happens:** Developers forget to include timestamp from cached entity
**How to avoid:** Require `updated_at` in mutation queue entry for all updates
**Warning signs:** Updates succeeding without expected conflicts during testing

### Pitfall 2: Showing Dialog for Every Conflict
**What goes wrong:** User fatigue, sync feels broken
**Why it happens:** Over-cautious approach to data safety
**How to avoid:** Classify fields, use LWW + toast for non-critical, dialog only for critical
**Warning signs:** User complaints about "too many popups"

### Pitfall 3: Losing Conflict Context
**What goes wrong:** User can't understand what changed or when
**Why it happens:** Only showing values, not timestamps or field names
**How to avoid:** Include entity name, field labels, timestamps in dialog
**Warning signs:** Users always choosing "Use Server" because they can't compare

### Pitfall 4: Not Handling Batch Partial Failures
**What goes wrong:** Some operations succeed, some conflict, app state inconsistent
**Why it happens:** Treating batch response as all-or-nothing
**How to avoid:** Process each result individually, update UI per-item
**Warning signs:** "Succeeded: 5, Conflicts: 2" but UI shows incorrect state

### Pitfall 5: Forgetting Delete Conflicts
**What goes wrong:** Entity deleted on server, client tries to update
**Why it happens:** Focus on update-vs-update conflicts only
**How to avoid:** Handle 404 responses during sync as "deleted conflict"
**Warning signs:** Errors about "entity not found" during sync

## Code Examples

Verified patterns from official sources and existing codebase:

### Sonner Action Toast
```typescript
// Source: https://sonner.emilkowal.ski/toast
import { toast } from "sonner";

// Conflict notification with action
toast.warning("Conflict detected", {
  description: "Item 'Hammer' was modified on server",
  action: {
    label: "Review",
    onClick: () => openConflictDialog(conflictData),
  },
  duration: 10000, // Longer duration for conflicts
});

// Last-write-wins notification (informational)
toast.info("Changes merged", {
  description: "Your edits to 'Screwdriver' were applied",
  duration: 4000,
});
```

### Using Batch Endpoint
```typescript
// Source: backend/internal/domain/batch/types.go
interface BatchOperation {
  operation: 'update' | 'delete';
  entity_type: 'item' | 'location' | 'container' | 'inventory' | 'category' | 'label' | 'company';
  entity_id: string;
  data?: Record<string, unknown>;
  updated_at?: string; // ISO 8601 - REQUIRED for conflict detection
}

interface BatchResult {
  index: number;
  status: 'success' | 'error' | 'conflict';
  entity_id?: string;
  has_conflict?: boolean;
  server_data?: Record<string, unknown>; // Current server state on conflict
  error?: string;
  error_code?: string;
}

interface BatchResponse {
  results: BatchResult[];
  succeeded: number;
  failed: number;
  conflicts: number;
}
```

### Conflict Store Schema
```typescript
// Add to frontend/lib/db/types.ts
interface ConflictLogEntry {
  id: number; // auto-increment
  entityType: MutationEntityType;
  entityId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  resolution: 'local' | 'server' | 'merged';
  resolvedData?: Record<string, unknown>;
  timestamp: number;
  resolvedAt?: number;
}

// Add to OfflineDBSchema
conflictLog: {
  key: number;
  value: ConflictLogEntry;
  indexes: {
    entityType: MutationEntityType;
    timestamp: number;
  };
};
```

### Dialog Component Pattern
```typescript
// Using existing shadcn dialog
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ConflictDialogProps {
  conflict: {
    entityType: string;
    entityName: string;
    localData: Record<string, unknown>;
    serverData: Record<string, unknown>;
    fields: string[]; // Fields with differences
  };
  onResolve: (resolution: ConflictResolution) => void;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ETag/If-Match headers | Timestamp comparison in batch | Already in place | Simpler, batch-aware |
| 409 per-request | Batch returns conflicts in response body | Already in place | Better UX, fewer round-trips |
| Modal for all conflicts | Classification + toast/dialog | 2024-2025 pattern | Reduced user fatigue |
| Server-only audit | Client + server audit | 2024-2025 offline-first | Immediate offline access |

**Deprecated/outdated:**
- Individual If-Match headers: Batch endpoint handles this internally
- react-conflict-resolver packages: Overkill for field-level comparison

## Open Questions

Things that couldn't be fully resolved:

1. **Concurrent same-device edits**
   - What we know: Batch processes sequentially, IndexedDB mutations are serialized
   - What's unclear: Edge case where user edits same entity in two tabs
   - Recommendation: Use BroadcastChannel to notify tabs of conflicts (already in sync-manager)

2. **Conflict resolution for creates**
   - What we know: Backend batch doesn't support creates (returns error)
   - What's unclear: What if client creates entity with duplicate SKU?
   - Recommendation: Handle as validation error, not conflict (different code path)

3. **Audit trail sync to server**
   - What we know: Backend has `activity_log` table with `changes` JSONB column
   - What's unclear: Whether to add separate conflict resolution logging
   - Recommendation: Start with IndexedDB only; add server sync if needed for compliance

## Sources

### Primary (HIGH confidence)
- Backend batch service: `/backend/internal/domain/batch/service.go` - Lines 58-145 (conflict detection)
- Backend batch types: `/backend/internal/domain/batch/types.go` - Full type definitions
- Database schema: `/backend/db/migrations/001_initial_schema.sql` - `updated_at` columns on all tables
- Frontend sync-manager: `/frontend/lib/sync/sync-manager.ts` - Current mutation processing

### Secondary (MEDIUM confidence)
- [Sonner Documentation](https://sonner.emilkowal.ski/toast) - Action buttons, duration, callbacks
- [shadcn/ui Sonner](https://ui.shadcn.com/docs/components/sonner) - Integration patterns

### Tertiary (LOW confidence)
- [Offline-first patterns 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) - General patterns, not verified against this codebase
- [Hasura offline-first guide](https://hasura.io/blog/design-guide-to-offline-first-apps) - Conflict strategy recommendations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Backend already implements conflict detection
- Pitfalls: HIGH - Based on existing codebase analysis and industry patterns
- Code examples: HIGH - Derived from actual backend code and Sonner docs

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (stable - core patterns unlikely to change)
