---
phase: 04-pwa-screenshots-polish
plan: 02
subsystem: ui
tags: [offline, pwa, ux, accessibility]
dependency-graph:
  requires:
    - 01-03  # Original OfflineIndicator component
  provides:
    - Subtle icon-only offline indicator with pulse animation
  affects: []
tech-stack:
  added: []
  patterns:
    - Tooltip for accessible status indicators
    - CSS animate-ping for attention transitions
key-files:
  created: []
  modified:
    - frontend/components/pwa/offline-indicator.tsx
decisions:
  - key: icon-style
    choice: CloudOff with amber color
    reason: Subtle warning indicator that doesn't demand attention
  - key: animation
    choice: animate-ping + animate-pulse for 2 seconds
    reason: Brief attention-getting transition when going offline
  - key: back-online-banner
    choice: Removed
    reason: Too intrusive for subtle design per user decision
metrics:
  duration: 66s
  completed: 2026-01-24
---

# Phase 04 Plan 02: Subtle Offline Indicator Summary

Enhanced OfflineIndicator from full-width banner to subtle CloudOff icon with 2-second pulse animation on offline transition, amber-500 color, and tooltip for accessibility.

## What Was Built

### OfflineIndicator Component Enhancement

Transformed the offline indicator from an intrusive full-width banner to a minimal icon-only design:

**Before:**
- Full-width banner with WifiOff icon and text
- Destructive red background color
- "Back online" green banner on reconnection
- Takes up header space

**After:**
- Single CloudOff icon (h-4 w-4)
- Amber-500 color (warning, not destructive)
- Pulse animation (animate-ping) triggers when going offline
- Animation stops after 2 seconds
- Tooltip shows "You are offline" on hover
- Returns null when online (invisible)
- No "back online" banner (removed per subtle design decision)

**Key implementation details:**
- `showPulse` state tracks animation timing
- `useEffect` triggers pulse on offline transition with 2-second timeout
- Tooltip wraps the icon for accessibility
- `data-testid="offline-indicator"` for E2E testing
- `role="status"` and `aria-label` for screen readers

### Hook Verification

The `useNetworkStatus` hook already provides all required functionality:
- `isOffline` boolean for current status
- SSR handling (checks navigator availability)
- Listens to online/offline window events
- No changes needed

## Files Modified

| File | Changes |
|------|---------|
| `frontend/components/pwa/offline-indicator.tsx` | Refactored to icon-only design with pulse animation |

## Commits

| Hash | Message |
|------|---------|
| `8f55493` | feat(04-02): enhance offline indicator with icon-only subtle design |

## Verification

- CloudOff icon renders when offline (DevTools > Network > Offline)
- Tooltip shows "You are offline" on hover
- Pulse animation triggers when going offline
- Nothing renders when online (returns null)
- data-testid="offline-indicator" present in DOM when offline

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] OfflineIndicator renders CloudOff icon only (no banner/text)
- [x] Icon uses amber-500 color (subtle warning, not destructive red)
- [x] Pulse animation (animate-ping) triggers on offline transition
- [x] Animation stops after ~2 seconds
- [x] Tooltip shows "You are offline" on hover
- [x] data-testid="offline-indicator" present for E2E testing
- [x] Component returns null when online
- [x] No "back online" banner (removed per subtle design decision)
