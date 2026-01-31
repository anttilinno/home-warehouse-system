---
phase: 21-mobile-form-improvements
plan: 01
subsystem: ui
tags: [indexeddb, radix-ui, collapsible, form-draft, smart-defaults, ios-keyboard, visual-viewport]

# Dependency graph
requires:
  - phase: 10-offline-mutation-queue
    provides: IndexedDB infrastructure and getDB function
provides:
  - Collapsible UI component for progressive disclosure
  - useFormDraft hook for IndexedDB draft persistence
  - useSmartDefaults hook for recent selection memory
  - useIOSKeyboard hook for Visual Viewport keyboard detection
  - IndexedDB formDrafts store (DB_VERSION 4)
affects:
  - 21-02-plan (progressive disclosure uses Collapsible)
  - 21-03-plan (form draft recovery uses useFormDraft)
  - 21-04-plan (may use useIOSKeyboard for keyboard handling)
  - 21-05-plan (may use useSmartDefaults for field defaults)

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-collapsible@1.1.12"
  patterns:
    - Form draft persistence via IndexedDB with 1s debounce
    - localStorage-based recent selection memory
    - Visual Viewport API for iOS keyboard detection

key-files:
  created:
    - frontend/components/ui/collapsible.tsx
    - frontend/lib/hooks/use-form-draft.ts
    - frontend/lib/hooks/use-smart-defaults.ts
    - frontend/lib/hooks/use-ios-keyboard.ts
  modified:
    - frontend/lib/db/offline-db.ts
    - frontend/lib/db/types.ts
    - frontend/package.json
    - frontend/bun.lock

key-decisions:
  - "IndexedDB formDrafts store for draft persistence (vs localStorage)"
  - "1-second debounce on draft saves to prevent IndexedDB thrashing"
  - "localStorage for smart defaults (lightweight, per-field)"
  - "Visual Viewport API for iOS keyboard detection (standard approach)"
  - "iOS 26 blur event workaround for keyboard state tracking"

patterns-established:
  - "Form draft pattern: formType + draftId as composite key"
  - "Smart defaults: hws-smart-defaults-{fieldKey} localStorage pattern"
  - "iOS keyboard detection: vv.height vs window.innerHeight comparison"

# Metrics
duration: 4min
completed: 2026-01-31
---

# Phase 21 Plan 01: Mobile Form Infrastructure Summary

**IndexedDB draft persistence, smart defaults, and iOS keyboard detection hooks with Collapsible UI component**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-31T10:39:11Z
- **Completed:** 2026-01-31T10:43:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added Collapsible UI component from Radix UI for progressive disclosure
- Created useFormDraft hook for IndexedDB draft persistence with 1s debounce
- Created useSmartDefaults hook storing last 5 selections per field in localStorage
- Created useIOSKeyboard hook using Visual Viewport API with iOS 26 bug workaround
- Upgraded IndexedDB schema to version 4 with formDrafts store migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Collapsible UI component and IndexedDB formDrafts store** - `a667849` (feat)
2. **Task 2: Create useFormDraft hook for IndexedDB draft persistence** - `a14c90d` (feat)
3. **Task 3: Create useSmartDefaults and useIOSKeyboard hooks** - `9babb84` (feat)

## Files Created/Modified

- `frontend/components/ui/collapsible.tsx` - Radix UI Collapsible wrapper with Trigger and Content exports
- `frontend/lib/hooks/use-form-draft.ts` - IndexedDB draft persistence with load/save/clear and debounce
- `frontend/lib/hooks/use-smart-defaults.ts` - localStorage recent selection memory (5 items per field)
- `frontend/lib/hooks/use-ios-keyboard.ts` - Visual Viewport keyboard detection with style helpers
- `frontend/lib/db/types.ts` - FormDraft interface and formDrafts store in OfflineDBSchema
- `frontend/lib/db/offline-db.ts` - DB_VERSION 4 with formDrafts store migration
- `frontend/package.json` - Added @radix-ui/react-collapsible dependency

## Decisions Made

- **IndexedDB for form drafts:** Chosen over localStorage for larger payload support and consistency with existing offline data infrastructure
- **1-second debounce:** Prevents IndexedDB thrashing during rapid typing while still capturing most changes
- **localStorage for smart defaults:** Lightweight per-field storage doesn't need transaction safety
- **Visual Viewport API:** Standard iOS keyboard detection method, with blur event workaround for iOS 26 bug

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **TypeScript null check on visualViewport:** Required capturing visualViewport reference before null check to satisfy TypeScript strict mode. Fixed by assigning to `vv` constant early in useEffect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Collapsible component ready for progressive disclosure in form layouts (21-02)
- useFormDraft ready for integration with create/edit forms (21-03)
- useSmartDefaults ready for field default suggestions
- useIOSKeyboard ready for mobile keyboard handling
- All hooks follow existing codebase patterns and are SSR-safe

---
*Phase: 21-mobile-form-improvements*
*Completed: 2026-01-31*
