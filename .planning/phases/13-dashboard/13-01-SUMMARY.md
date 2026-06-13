---
phase: 13-dashboard
plan: 01
subsystem: ui
tags: [react, tanstack-query, notifications, msw, lingui, retro-os]

# Dependency graph
requires:
  - phase: 04-retro-atoms
    provides: RetroBadge, RetroEmptyState, BevelButton, retroToast (the dropdown/bell compose these)
  - phase: 06-sse
    provides: TopBar SSE binding + useModalStack (ESC modal stack the dropdown pops)
provides:
  - USER-scoped notifications api (lib/api/notifications.ts) over /api/notifications (no wsId)
  - useNotificationsQuery + useUnreadCountQuery (30s refetchInterval poll) keyed ["notifications"]
  - useNotificationMutations (markRead + markAllRead) invalidating the ["notifications"] prefix
  - NotificationsBell (TopBar bell + unread badge) + NotificationsDropdown (list, mark-read, ESC)
  - TopBar single-writer wiring: reserved disabled bell-slot replaced with the live bell
affects: [13-dashboard live E2E, future SSE notification invalidation follow-up]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "USER-scoped query key discipline: ["notifications"] prefix, NO wsId (contrast workspace-scoped repairs/maintenance)"
    - "Badge freshness via TanStack refetchInterval (no SSE notification entry in the invalidation map)"
    - "Shared MSW handler module (test/msw/notificationHandlers.ts) reused by hook test, component test, and TopBar chrome test"

key-files:
  created:
    - frontend2/src/lib/api/notifications.ts
    - frontend2/src/features/notifications/hooks/useNotifications.ts
    - frontend2/src/features/notifications/hooks/useNotificationMutations.ts
    - frontend2/src/features/notifications/hooks/useNotificationMutations.test.tsx
    - frontend2/src/features/notifications/components/NotificationsBell.tsx
    - frontend2/src/features/notifications/components/NotificationsDropdown.tsx
    - frontend2/src/features/notifications/components/NotificationsBell.test.tsx
    - frontend2/src/test/msw/notificationHandlers.ts
  modified:
    - frontend2/src/components/layout/TopBar.tsx
    - frontend2/src/components/layout/TopBar.test.tsx

key-decisions:
  - "Notifications are USER-scoped: every endpoint is /api/notifications/... with no {ws} segment; query key is ["notifications"] (no wsId)."
  - "Unread badge polls /notifications/unread/count on a 30s refetchInterval — there is no notification entry in the SSE invalidation map (VALIDATION confirmed), so SSE invalidation is a follow-up, not this plan's job."
  - "DTO mark-all route is POST /notifications/read-all (NOT /{id}/read-all)."
  - "Bell keeps the stable data-testid=\"bell-slot\" (now a <button>) so existing TopBar chrome tests and the live E2E spec resolve the same selector."
  - "Mutations invalidate the ["notifications"] PREFIX (exact:false) — one call covers list + unread + unread/count."

patterns-established:
  - "User-scoped feature hooks: no useWorkspace dependency; always enabled once authed."
  - "Dropdown overlay = absolute right-aligned bevel-raised-ink panel + useModalStack(open, onClose) for ESC + transparent backdrop button for click-outside (mirrors the TopBar user-menu)."

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03]

# Metrics
duration: 18min
completed: 2026-06-13
---

# Phase 13 Plan 01: Notifications feature + TopBar bell Summary

**A USER-scoped notifications stack — api + query/mutation hooks, a TopBar bell with a polled unread-count badge, and a dropdown listing notifications with per-item and mark-all read — replacing the reserved disabled bell-slot placeholder (NOTIF-01/02/03).**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 / 3
- **Files created:** 8
- **Files modified:** 2

## Accomplishments
- Delivered the full notifications feature surface: api module, read/poll hooks, write mutations, bell + dropdown components, and the TopBar single-writer wiring.
- Unread badge shows iff count > 0, sourced from `/notifications/unread/count` on a 30s poll; hidden at 0.
- Dropdown supports per-row mark-read, mark-all-read (disabled when nothing unread), empty/loading/error states, ESC-to-close via the modal stack, and click-outside dismiss.
- 12 new unit tests (4 mutation + 8 bell/dropdown), all green; full frontend2 suite 943 passed (up from 931).

## Task Commits

1. **Task 1: notifications api + query/mutation hooks** — `d3c0ca2a` (feat)
2. **Task 2: NotificationsBell + NotificationsDropdown** — `f3fd8ac8` (feat)
3. **Task 3: wire NotificationsBell into TopBar (single-writer)** — `40e16ed5` (feat)

## Files Created/Modified
- `frontend2/src/lib/api/notifications.ts` — USER-scoped notificationsApi (list/unread/unreadCount/markRead/markAllRead) + NotificationDTO/NotificationType/envelope types.
- `frontend2/src/features/notifications/hooks/useNotifications.ts` — useNotificationsQuery (list) + useUnreadCountQuery (30s refetchInterval poll).
- `frontend2/src/features/notifications/hooks/useNotificationMutations.ts` — markRead + markAllRead, prefix-invalidating ["notifications"], retroToast.error on failure.
- `frontend2/src/features/notifications/hooks/useNotificationMutations.test.tsx` — 4 tests (endpoints, prefix invalidate incl. unread/count, error toast).
- `frontend2/src/features/notifications/components/NotificationsBell.tsx` — 28×28 toggle, stable data-testid="bell-slot", RetroBadge (danger) badge gated on count>0, outside-click close.
- `frontend2/src/features/notifications/components/NotificationsDropdown.tsx` — user-menu-style panel, list + mark-read + mark-all, RetroEmptyState, useModalStack ESC.
- `frontend2/src/features/notifications/components/NotificationsBell.test.tsx` — 8 tests (testid, badge gating, open, empty, mark-read, mark-all, ESC).
- `frontend2/src/test/msw/notificationHandlers.ts` — shared MSW handlers + fixtures (NOTIF_UNREAD/NOTIF_READ/ALL_NOTIFS).
- `frontend2/src/components/layout/TopBar.tsx` — **single-writer:** disabled bell-slot `<span>▦</span>` → `<NotificationsBell/>`; header comment updated.
- `frontend2/src/components/layout/TopBar.test.tsx` — added QueryClientProvider + notificationHandlers; updated the bell-slot chrome test to assert the live button.

## Verified Contract (for the live E2E spec)

- **NotificationDTO TS shape:** `{ id, user_id, workspace_id?, notification_type, title, message, is_read, read_at?, metadata?, created_at }` — `notification_type` ∈ `LOAN_DUE_SOON | LOAN_OVERDUE | LOAN_RETURNED | LOW_STOCK | WORKSPACE_INVITE | MEMBER_JOINED | SYSTEM`.
- **Endpoints (USER-scoped, no wsId):** `GET /api/notifications?page=&limit=`, `GET /api/notifications/unread`, `GET /api/notifications/unread/count` → `{ count }`, `POST /api/notifications/{id}/read` (204), `POST /api/notifications/read-all` (204).
- **Query keys:** `["notifications","list",{page,limit}]`, `["notifications","unread","count"]`. Prefix `["notifications"]` invalidates both.
- **Bell selector:** `data-testid="bell-slot"` (a `<button aria-haspopup="menu" aria-label="Notifications">`). Dropdown is `role="menu"`; "Mark all read" + per-row "Mark read" are `role="button"`; empty state text is "No notifications".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TopBar chrome test broke from the single-writer edit**
- **Found during:** Task 3
- **Issue:** Swapping the static disabled bell-slot for the live `<NotificationsBell/>` introduced a `useQuery` call (the unread-count poll) into TopBar, so the existing `TopBar.test.tsx` — which renders without a QueryClientProvider and without notification MSW handlers — threw "No QueryClient set" on every test (11 failures). One test also still asserted the old `aria-disabled`/`title="Coming soon"` placeholder.
- **Fix:** Added a `QueryClientProvider` to the test's `renderTopBar` wrapper (and the inline rerender), registered `notificationHandlers` in `beforeEach`, and updated the "reserved bell slot disabled" test to assert the live button (`<button aria-haspopup="menu" aria-label="Notifications">`, no `aria-disabled`). The plan's `<done>` for Task 3 explicitly requires chrome tests to still resolve `bell-slot`, so this fix is in-scope for the single-writer edit.
- **Files modified:** `frontend2/src/components/layout/TopBar.test.tsx`
- **Commit:** `40e16ed5`

## Known Stubs
None — every component is wired to live queries/mutations; no hardcoded empty data flows to the UI.

## Self-Check: PASSED
- All 8 created files + 2 modified files exist on disk.
- Commits `d3c0ca2a`, `f3fd8ac8`, `40e16ed5` present in `git log`.
- `bunx tsc --noEmit` clean; `bun run test src/features/notifications` 12/12; full suite 943/943.
