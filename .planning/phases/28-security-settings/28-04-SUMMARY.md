---
phase: 28-security-settings
plan: 04
subsystem: frontend/settings
tags: [react, sessions, security, ui]

# Dependency graph
requires:
  - 28-03 (session backend implementation)
provides:
  - Active sessions UI with view and revocation
  - Session API client functions
affects:
  - Settings page now shows live session data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React Query for session data fetching
    - Optimistic UI with query invalidation

# File tracking
key-files:
  created:
    - frontend/components/settings/active-sessions.tsx
  modified:
    - frontend/lib/api/auth.ts
    - frontend/components/settings/security-settings.tsx
    - frontend/messages/en.json

# Decision log
decisions:
  - key: device-icon-detection
    choice: Simple string matching on device_info for icon selection
    reason: Backend already parses user-agent into readable device_info; no need for complex parsing
  - key: revoke-current-protection
    choice: Hide revoke button for current session
    reason: Prevents users from accidentally logging themselves out

# Metrics
metrics:
  duration: ~8 minutes
  completed: 2026-02-03
---

# Phase 28 Plan 04: Active Sessions UI Summary

Session list component with device icons, relative timestamps, individual revoke, and bulk revoke functionality.

## What Was Built

### Task 1: Session API Functions
Added to `frontend/lib/api/auth.ts`:
- `Session` interface with id, device_info, ip_address, last_active_at, created_at, is_current
- `getSessions()` - Fetch all active sessions for current user
- `revokeSession(sessionId)` - Revoke a specific session
- `revokeAllOtherSessions()` - Revoke all sessions except current

### Task 2: ActiveSessions Component
Created `frontend/components/settings/active-sessions.tsx` (144 lines):
- Device icon detection (Monitor/Smartphone/Tablet) based on device_info content
- Session list with device info and relative last active time
- "Current" badge on current session with revoke button hidden
- Revoke button with loading spinner per session
- "Sign out all other sessions" button when multiple sessions exist
- Loading skeleton and error states
- Full i18n support with 12 translation keys

### Task 3: SecuritySettings Integration
Updated `frontend/components/settings/security-settings.tsx`:
- Imported ActiveSessions component
- Replaced "Coming Soon" placeholder with live ActiveSessions component
- Security section now shows Password + Sessions

## Technical Implementation

### Device Icon Selection
```typescript
function getDeviceIcon(deviceInfo: string) {
  const lower = deviceInfo.toLowerCase();
  if (lower.includes("iphone") || lower.includes("android") || lower.includes("mobile")) {
    return Smartphone;
  }
  if (lower.includes("ipad") || lower.includes("tablet")) {
    return Tablet;
  }
  return Monitor;
}
```

### Query Integration
- React Query with `["sessions"]` query key
- Mutations invalidate query on success for immediate UI update
- Sonner toast notifications for success/error feedback

## Commits

| Hash | Message |
|------|---------|
| af07d27 | feat(28-04): add session API functions to auth client |
| df33ac5 | feat(28-04): create ActiveSessions component with i18n |
| 2f44c94 | feat(28-04): integrate ActiveSessions into SecuritySettings |

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

- [x] SEC-02: User can view list of active sessions with device type and last activity
- [x] SEC-03: User can revoke individual sessions
- [x] SEC-04: User can logout all other sessions at once
- [x] Current session is protected from revocation (no button shown)
- [x] UI updates immediately after revocation actions (query invalidation)
- [x] Loading and error states handled gracefully

## Next Phase Readiness

Phase 28 Security Settings is now complete:
- 28-01: Password change form
- 28-02: SecuritySettings integration into settings page
- 28-03: Session backend (database, API endpoints)
- 28-04: Session frontend (this plan)

Ready for Phase 29 planning or verification.
