---
phase: 13-dashboard
verified: 2026-06-13T18:47:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the dashboard in a browser and visually confirm the four StatCard tiles (Items, Loans, Overdue, Low stock) render with retro bevel panel chrome."
    expected: "Four Window-chrome stat tiles show live counts from /analytics/dashboard; token-correct titlebar colour variants (default/mint/pink/butter). A second row shows Locations/Containers/Categories/Borrowers as smaller bevel strips."
    why_human: "DASH-01 requirement text says 'Total Items, Locations, Containers, Active Loans' but the implementation ships Items/Loans/Overdue/Low-stock as the primary four StatCards, with Locations/Containers/Categories/Borrowers in a secondary strip row. The implementation is substantively richer and was consciously documented in 13-CONTEXT.md line 10, but the literal tile labels diverge from the requirement. A visual sign-off is needed to formally accept this interpretation."
  - test: "Open the notifications dropdown and click 'Mark all read' then reload."
    expected: "Bell badge disappears; all rows show as read; 'Mark all read' button is disabled. On reload badge remains absent."
    why_human: "Mutation correctness (prefix-invalidation reaching unread/count) cannot be verified by grep; requires a live backend with seeded notifications."
---

# Phase 13: Dashboard Verification Report

**Phase Goal:** `/` shows 4 stat tiles + TUI activity table + side rail (Pending Approvals + System Alerts) + flag-gated HUD row. Plus notifications bell/dropdown/badge in TopBar.
**Verified:** 2026-06-13T18:47:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DASH-01: Four stat tiles with token-correct retro panel styling | VERIFIED (WARN label mismatch vs req text) | `DashboardPage.tsx:108-153` — 4 StatCards (Items/Loans/Overdue/Low-stock) + 4 bevel strips (Locations/Containers/Categories/Borrowers), both rows from live DashboardStats query; 13-CONTEXT.md line 10 pre-approved this interpretation |
| 2 | DASH-02: Activity table with relative time (<24h) + absolute (≥24h) + Timestamp/Action/Entity/Actor/Status columns | VERIFIED | `relativeTime.ts:16-43` — exact boundaries implemented; `DashboardPage.tsx:177-243` — 5 columns rendered; Actor = user_id.slice(0,8) or "—"; Status = ACTION_BADGES[action] derived pill |
| 3 | DASH-03: Side rail stacks Pending Approvals (403 silent-degrade) + System Alerts (expiring + maintenance-due) | VERIFIED | `DashboardSideRail.tsx:11-18` — PendingApprovalsPanel above SystemAlertsPanel; `PendingApprovalsPanel.tsx:34` — `isForbidden \|\| isError → return null`; `SystemAlertsPanel.tsx:4-5` — imports `useExpiringQuery` + `useMaintenanceDueQuery` (no new hooks) |
| 4 | DASH-04: HudRow flag-gated VITE_FEATURE_HUD_ROLLUPS default OFF, hand-rolled SVG, no charting library | VERIFIED | `HudRow.tsx:62-63` — `import.meta.env.VITE_FEATURE_HUD_ROLLUPS === "true"` gate; SVG arc/sparkline hand-rolled; grep confirms no recharts/chart.js/d3/visx import; HudRow.test.tsx 6/6 green incl. flag-off→null |
| 5 | DASH-05: useShortcuts("dashboard", [N→/items/new, S→/scan, L→/loans]) with no render-loop | VERIFIED | `DashboardPage.tsx:75-86` — stable navigate ref, useCallback per action, useMemo bindings; tRef pattern for label; DashboardPage.test.tsx line 215 asserts N/S/L registration |
| 6 | NOTIF-01: TopBar bell button (not disabled placeholder) | VERIFIED | `TopBar.tsx:116` — `<NotificationsBell />` imported and mounted; TopBar.test.tsx updated to assert live button (no aria-disabled) |
| 7 | NOTIF-03: Unread-count badge hidden when 0, shown when >0 | VERIFIED | `NotificationsBell.tsx:37,52-59` — `hasUnread = count > 0`; badge node only renders when `hasUnread`; NotificationsBell.test.tsx 8 tests incl. badge-gating |
| 8 | NOTIF-02: Dropdown with per-row mark-read + mark-all-read + ESC close | VERIFIED | `NotificationsDropdown.tsx:60-66` — markAllRead disabled when !hasUnread; per-row markRead button; useModalStack(open, onClose) for ESC |

**Score:** 8/8 truths verified (one with an interpretive label-mismatch on DASH-01 requiring human visual UAT)

### DASH-01 Label Mismatch Note

REQUIREMENTS.md line 151 specifies "Total Items, Locations, Containers, Active Loans" as the four tile labels. The implementation ships **Items / Loans / Overdue / Low stock** as the four StatCard tiles, with Locations/Containers/Categories/Borrowers rendered as a secondary strip row below. The 13-CONTEXT.md (orchestrator-authored, line 10) pre-approved this richer layout as satisfying DASH-01. The implementation is substantively correct and provides MORE information than the requirement text, but the literal tile identity differs. A human visual sign-off closes this gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend2/src/lib/api/notifications.ts` | USER-scoped notifications api | VERIFIED | 5 methods: list/unread/unreadCount/markRead/markAllRead; endpoint paths correct |
| `frontend2/src/features/notifications/hooks/useNotifications.ts` | useNotificationsQuery + useUnreadCountQuery | VERIFIED | 30s refetchInterval on unread count; ["notifications"] key prefix; no wsId |
| `frontend2/src/features/notifications/hooks/useNotificationMutations.ts` | markRead + markAllRead mutations | VERIFIED | prefix-invalidates ["notifications"]; retroToast.error on failure |
| `frontend2/src/features/notifications/components/NotificationsBell.tsx` | Bell button + badge + dropdown toggle | VERIFIED | data-testid="bell-slot"; RetroBadge danger gated on count>0; outside-click close |
| `frontend2/src/features/notifications/components/NotificationsDropdown.tsx` | List + mark-read + mark-all + ESC | VERIFIED | role="menu"; useModalStack ESC; BevelButton disabled when !hasUnread |
| `frontend2/src/lib/api/pendingChanges.ts` | pendingChangesApi.list | VERIFIED | envelope key `changes` (verified against backend) |
| `frontend2/src/features/approvals/hooks/usePendingChangesQuery.ts` | isForbidden + retry:false | VERIFIED | HttpError.status===403; retry:false confirmed |
| `frontend2/src/features/approvals/components/PendingApprovalsPanel.tsx` | 403 silent-degrade + count display | VERIFIED | `if (isForbidden \|\| isError) return null`; total > 0 shows count + Review link |
| `frontend2/src/features/dashboard/components/SystemAlertsPanel.tsx` | Expiring + maintenance-due cards | VERIFIED | Imports useExpiringQuery + useMaintenanceDueQuery; is_overdue rendered from server flag verbatim |
| `frontend2/src/features/dashboard/components/DashboardSideRail.tsx` | PendingApprovals above SystemAlerts | VERIFIED | DashboardSideRail renders PendingApprovalsPanel then SystemAlertsPanel |
| `frontend2/src/features/dashboard/components/HudRow.tsx` | Flag-gated SVG HUD | VERIFIED | `VITE_FEATURE_HUD_ROLLUPS === "true"` gate; donut arc + dashed sparkline hand-rolled; null default |
| `frontend2/src/features/dashboard/relativeTime.ts` | formatRelativeTime formatter | VERIFIED | <1m / Nm ago / Nh ago / absolute date+time at ≥24h; future-delta clamp |
| `frontend2/src/features/dashboard/DashboardPage.tsx` | Full dashboard page | VERIFIED | 4 stat tiles + secondary strip + HudRow + activity table (5 cols) + DashboardSideRail + useShortcuts |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| NotificationsBell | useUnreadCountQuery | import | WIRED | TopBar.tsx:8 imports NotificationsBell; Bell imports useUnreadCountQuery |
| NotificationsDropdown | useNotificationsQuery + useNotificationMutations | import | WIRED | `NotificationsDropdown.tsx:5-6` |
| TopBar | NotificationsBell | single-writer replace | WIRED | `TopBar.tsx:116` — live bell, not disabled placeholder |
| DashboardPage | DashboardSideRail | import + render | WIRED | `DashboardPage.tsx:16,249` |
| DashboardPage | HudRow | import + render | WIRED | `DashboardPage.tsx:17,158` |
| DashboardPage | formatRelativeTime | import + usage | WIRED | `DashboardPage.tsx:18,201` |
| DashboardSideRail | PendingApprovalsPanel | import + render | WIRED | `DashboardSideRail.tsx:1,14` |
| DashboardSideRail | SystemAlertsPanel | import + render | WIRED | `DashboardSideRail.tsx:2,15` |
| SystemAlertsPanel | useExpiringQuery | direct reuse | WIRED | `SystemAlertsPanel.tsx:4` — no new hook |
| SystemAlertsPanel | useMaintenanceDueQuery | direct reuse | WIRED | `SystemAlertsPanel.tsx:5` — no new hook |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| DashboardPage | `stats.data` | `GET /workspaces/{ws}/analytics/dashboard` | Yes — live API query, not hardcoded | FLOWING |
| DashboardPage | `activity.data` | `GET /workspaces/{ws}/analytics/activity?limit=10` | Yes — live API query | FLOWING |
| NotificationsBell | `count` | `GET /notifications/unread/count` (30s poll) | Yes — live API poll | FLOWING |
| NotificationsDropdown | `items` | `GET /notifications?page=&limit=` | Yes — live API query | FLOWING |
| PendingApprovalsPanel | `total` | `GET /workspaces/{ws}/pending-changes` | Yes — live API query; 403→null | FLOWING |
| SystemAlertsPanel | `expiringCount` | `useExpiringQuery()` → `/inventory/expiring` | Yes — reused Phase 7b hook | FLOWING |
| SystemAlertsPanel | `dueCount` | `useMaintenanceDueQuery()` → `/maintenance/due` | Yes — reused Phase 10b hook | FLOWING |
| HudRow | gauge fill ratio | `DashboardStats.total_inventory` + `CAPACITY_TARGET_PLACEHOLDER=500` | Partial — inventory is live; capacity target is a labelled client constant with "data pending" caption | STATIC (intentional, documented) |
| HudRow | sparkline series | `series: []` | No 14-day aggregate backend — empty array, dashed baseline + "data pending" caption | STATIC (intentional, documented) |

**Note on HudRow STATIC items:** Both static data points are intentional and honest (labelled "data pending" in the UI). The backend lacks both endpoints. This matches DASH-04's "data pending" carry-forward note and is not a defect.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 968 unit tests pass | `cd frontend2 && bun run test` | 145 files, 968 tests passed | PASS |
| No charting library import in HudRow | `grep -n "recharts\|chart.js\|d3\|visx" frontend2/src/features/dashboard/components/HudRow.tsx` | No match (comment-only reference) | PASS |
| No charting library in package.json | `grep -n "recharts\|chart.js\|d3\|visx" frontend2/package.json` | No output | PASS |
| formatRelativeTime boundaries | Covered by relativeTime.test.ts (8 boundary tests) | All green | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DASH-01 | 13-05 | Four stat tiles with retro panel styling | VERIFIED (human UAT for label interpretation) | DashboardPage.tsx:108-153 |
| DASH-02 | 13-05 | Activity table: relative time + columns | VERIFIED | relativeTime.ts; DashboardPage.tsx:177-243 |
| DASH-03 | 13-02, 13-03, 13-05 | Side rail: Pending Approvals + System Alerts | VERIFIED | DashboardSideRail.tsx; PendingApprovalsPanel.tsx; SystemAlertsPanel.tsx |
| DASH-04 | 13-04, 13-05 | HUD row flag-gated, no charting lib | VERIFIED | HudRow.tsx; flag gate line 62 |
| DASH-05 | 13-05 | useShortcuts("dashboard", N/S/L) no render-loop | VERIFIED | DashboardPage.tsx:75-86 |
| NOTIF-01 | 13-01 | TopBar bell button | VERIFIED | TopBar.tsx:116; NotificationsBell.tsx |
| NOTIF-02 | 13-01 | Dropdown mark-read + mark-all + ESC | VERIFIED | NotificationsDropdown.tsx |
| NOTIF-03 | 13-01 | Unread-count badge hidden at 0 | VERIFIED | NotificationsBell.tsx:37,52-59 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| HudRow.tsx | 73 | `series: number[] = []` — always empty | INFO | Intentional — "data pending" caption shown; no fake data; sparkline renders honest dashed baseline |
| HudRow.tsx | 27 | `CAPACITY_TARGET_PLACEHOLDER = 500` | INFO | Intentional — labelled "data pending"; no backend endpoint exists; tracked as carry-forward |

No TBD/FIXME/XXX/PLACEHOLDER markers found in files modified by this phase. No stub-returning API routes. No hardcoded empty data presented as real.

### Human Verification Required

#### 1. DASH-01 Tile Label Sign-Off

**Test:** Open the dashboard at `/`. Observe the primary stat tile row.
**Expected:** Four Windows/StatCard tiles show live counts; labels are Items / Loans / Overdue / Low stock. A second strip row below shows Locations / Containers / Categories / Borrowers. All panels have correct retro bevel chrome (titlebar colour variants: default/mint/pink/butter for the 4 primary tiles).
**Why human:** REQUIREMENTS.md line 151 specifies "Total Items, Locations, Containers, Active Loans" as the four tile names. The implementation ships a richer 4+4 layout with different label ordering that was pre-approved in 13-CONTEXT.md but the literal requirement text was not retroactively updated. A sign-off here closes the gap between the requirement prose and the implementation.

#### 2. Notifications Mark-All-Read Mutation

**Test:** Seed 2+ unread notifications (or confirm the backend has some). Open the dashboard, click the bell, observe the unread badge count. Click "Mark all read". Close the dropdown. Observe the badge.
**Expected:** Badge disappears after "Mark all read". Reopening dropdown shows all items as read (muted). "Mark all read" button is disabled when all are already read.
**Why human:** Mutation prefix-invalidation reaching the unread-count key requires a live backend with real data. The unit tests use MSW mocks; the live flow requires end-to-end verification.

### Gaps Summary

No automated blockers found. All 8 must-haves are verified in code. The two human verification items are:

1. **DASH-01 label sign-off** — the implementation is richer than the requirement text and was pre-approved by the orchestrator, but the requirement text was not updated. Low risk; high confidence in the implementation.
2. **Notification mutation live test** — unit-tested with MSW mocks (4 mutation tests green); live backend confirmation of prefix-invalidation to the unread/count key is a belt-and-suspenders check.

---

_Verified: 2026-06-13T18:47:00Z_
_Verifier: Claude (gsd-verifier)_
