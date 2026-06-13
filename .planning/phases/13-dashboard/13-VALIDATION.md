# Phase 13 — VALIDATION (done-criteria the plans must satisfy)

Confirmed facts (orchestrator-verified 2026-06-13):
- `RecentActivity` (lib/types.ts:132) has **no** status field → DASH-02 status pill is **derived from `action`** via the existing `ACTION_BADGES` map. Do not invent a status field.
- Notification backend entity fields: id/user_id/workspace_id/type/title/message/is_read/read_at/metadata/created_at. Planner MUST read the handler **output DTO** (`notification/handler.go` output structs) for exact JSON tags before writing the TS type.
- No `notification` entry in the SSE invalidation map → unread badge uses `refetchInterval` poll on `GET /api/notifications/unread/count` (cheap). SSE invalidation optional follow-up.
- `/analytics/activity` accepts `limit` only — HUD 14-day sparkline has no backend; HUD ships behind `VITE_FEATURE_HUD_ROLLUPS`, **default off**.

Per-requirement done criteria:
- **DASH-01** — already shipped; verifier confirms 4 tiles render token-correct. No new work unless regressed.
- **DASH-02** — activity table gains: (a) relative-time formatter (`<1m`, `Nm ago`, `Nh ago` under 24h; absolute date+time at/after 24h), (b) Status pill column derived from `action`. Unit test the formatter at boundaries (59m→"ago", 23h→"ago", 24h→absolute).
- **DASH-03** — side rail renders Pending Approvals panel (count from `/pending-changes`, degrades on 403) + System Alerts panel stacking expiring-items (reuse `useExpiringQuery`) + due-maintenance (reuse `useMaintenanceDueQuery`). Each card links to its full page (`/inventory/expiring`, `/maintenance/due`, approvals page if exists).
- **DASH-04** — HUD row component exists, gated `import.meta.env.VITE_FEATURE_HUD_ROLLUPS === "true"`, default off → dashboard renders identically to today with flag unset. Hand-rolled SVG gauge + sparkline + counts; NO chart lib (grep-gate: lint:imports forbidden-list unaffected; assert no recharts/chart.js import). Unit test: flag-off → HUD not in DOM; flag-on → gauge svg present.
- **DASH-05** — `useShortcuts("dashboard", [N→/items/new, S→/scan, L→/loans])`. No render-loop (stable navigate ref). Unit test: shortcut registration present; pressing key navigates (or registration asserted).
- **NOTIF-01** — TopBar bell-slot becomes a real `<button>` (replaces disabled placeholder; keep `data-testid="bell-slot"` or add `bell-button` — keep a stable testid).
- **NOTIF-02** — clicking bell opens a dropdown (Popover/RetroDialog, ESC-pops via modal stack) listing notifications with per-item mark-read + a mark-all-read action (`POST /notifications/{id}/read`, `POST /notifications/read-all`). Optimistic or invalidate `["notifications"]` + `["notifications","unread","count"]`.
- **NOTIF-03** — unread-count badge on the bell from `/notifications/unread/count`; hidden when 0.

Gate (phase): `cd frontend2 && bun run lint:tsc && bun run test && bun run build && bun run lint:imports` all green; live E2E dashboard spec; gsd-verifier goal-backward PASS; bundle no regression (HUD adds only hand-rolled SVG, no lib).

Landmines (handoff): render-loop on shortcut/effect deps (use refs, destructure `.mutate`); backend list `limit` caps 100; ignore stale task-notifications on dead ids.
