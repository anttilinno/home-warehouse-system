---
phase: 03
plan: 02
subsystem: sync-ui
tags: [react-context, dialog, toast, sonner, conflict-resolution]
depends_on:
  requires: [01-01, 02-03]
  provides: [ConflictResolutionDialog, useConflictResolution, ConflictResolutionProvider]
  affects: [03-03]
tech-stack:
  added: []
  patterns: [context-provider, FIFO-queue, toast-tracking]
key-files:
  created:
    - frontend/lib/sync/use-conflict-resolution.tsx
    - frontend/components/conflict-resolution-dialog.tsx
  modified: []
decisions:
  - id: field-selection-default
    choice: "Default to 'server' for field selections"
    rationale: "Safety first - server data is known-good, local changes may be stale"
  - id: toast-cleanup-pattern
    choice: "Track toast IDs in ref, dismiss on unmount"
    rationale: "Prevents orphaned toasts during navigation"
  - id: file-extension
    choice: "Use .tsx for hook file due to JSX in Provider"
    rationale: "TypeScript requires .tsx extension for files with JSX"
metrics:
  duration: 7m
  completed: 2026-01-24
---

# Phase 03 Plan 02: Conflict UI Summary

## One-liner

React context provider with FIFO conflict queue, toast notifications via sonner, and side-by-side field comparison dialog.

## What Was Built

### useConflictResolution Hook (257 lines)

React context for managing sync conflicts with:

- **ConflictResolutionProvider** - Wraps app to provide conflict state
- **FIFO conflict queue** - Pending conflicts processed in order
- **currentConflict getter** - First conflict in queue for display
- **conflictCount** - Number of pending conflicts
- **addConflict()** - Queue a new conflict for resolution
- **resolveConflict()** - Resolve with local/server/merged strategy
- **dismissConflict()** - Remove without resolving
- **showAutoResolvedToast()** - Info toast for LWW auto-resolved conflicts
- **showCriticalConflictToast()** - Warning toast with Review action button
- **onResolve callback** - Integration point for SyncManager
- **Toast cleanup on unmount** - Prevents orphaned toasts

### ConflictResolutionDialog Component (432 lines)

Shadcn Dialog component for manual conflict resolution:

- **Side-by-side field comparison** - Local vs Server values
- **ConflictFieldRow** - Clickable cards to select field source
- **Visual differentiation** - Amber for local, blue for server values
- **Field labels** - Human-readable names for common fields
- **Value formatting** - Dates via date-fns, numbers localized, strings truncated
- **Quick actions** - "Select All Mine" / "Select All Server" buttons
- **Resolution buttons** - "Use Server Values", "Keep My Values", "Merge Selected"
- **Auto-opens** - Dialog appears when currentConflict is not null
- **Dismiss handling** - Closes conflict when dialog is dismissed

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Field default | Server | Safety - server data is authoritative |
| Toast tracking | Ref with Set | Cleanup on unmount without re-renders |
| File extension | .tsx | Provider contains JSX return statement |
| Queue structure | Array with FIFO | Simple, predictable processing order |

## Integration Points

### For SyncManager (03-03)

```typescript
<ConflictResolutionProvider
  onResolve={async (conflict, resolution, data) => {
    await logConflict({ ...conflict, resolution, resolvedData: data });
    await applyResolvedData(conflict.entityType, conflict.entityId, data);
  }}
>
  <App />
</ConflictResolutionProvider>
```

### For App Layout

```typescript
import { ConflictResolutionDialog } from "@/components/conflict-resolution-dialog";
import { ConflictResolutionProvider } from "@/lib/sync/use-conflict-resolution";

// In layout:
<ConflictResolutionProvider>
  {children}
  <ConflictResolutionDialog />
</ConflictResolutionProvider>
```

## Commits

| Commit | Description |
|--------|-------------|
| 598aefe | feat(03-02): create useConflictResolution hook with conflict queue |
| 98ca30c | feat(03-02): create ConflictResolutionDialog component |
| 4bdc583 | feat(03-02): add toast cleanup on provider unmount |

## Verification

- [x] `bun run lint` - No errors on conflict resolution files
- [x] `bun run build` - Successful (verified component compiles)
- [x] ConflictResolutionDialog > 100 lines (432 lines)
- [x] useConflictResolution exports Provider and hook
- [x] Dialog uses @/components/ui/dialog (shadcn)
- [x] Toast uses sonner with action button

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 03-03: SyncManager Integration

- ConflictResolutionProvider accepts onResolve callback
- addConflict() available for SyncManager to queue conflicts
- showAutoResolvedToast() for non-critical LWW notifications
- showCriticalConflictToast() for critical field conflicts
