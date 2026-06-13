# Phase 13 — Dashboard — CONTEXT

**Synthesised:** 2026-06-13 (orchestrator, surface verified inline — no external research needed).
**Goal (ROADMAP):** `/` shows 4 stat tiles + TUI activity table + side rail (Pending Approvals + System Alerts) + flag-gated HUD row. Plus notifications bell/dropdown/badge in TopBar.
**Depends on:** Phase 6 (SSE/providers), 7b (inventory/expiring), 10b (maintenance-due) — all DONE.
**Requirements:** DASH-01..05, NOTIF-01..03.

## What ALREADY ships (EXTEND, do not rebuild)
`frontend2/src/features/dashboard/DashboardPage.tsx` (191 lines):
- DASH-01 ✅ four stat tiles (Items/Loans/Overdue/Low-stock) + a second 4-tile row (Locations/Containers/Categories/Borrowers) over `GET /workspaces/{ws}/analytics/dashboard` (`DashboardStats`). Token-correct `StatCard` + bevel panels.
- DASH-02 PARTIAL ✅ activity table over `GET /workspaces/{ws}/analytics/activity?limit=10` (`RecentActivity[]`). Columns Time/Action/Entity/Name. `ACTION_BADGES` map CREATE/UPDATE/DELETE/MOVE/LOAN/RETURN → variant. **GAP vs DASH-02:** spec wants relative timestamps <24h then absolute; current `formatActivityTime` only does same-day-HH:MM vs absolute-date — needs a true relative formatter (`5m ago`, `3h ago`) under 24h. Also spec lists a **Status pill** column — not present yet.
- Reads `useWorkspace()` (`currentWorkspaceId` = D-12 SSOT) + workspaces empty-state. Uses `@lingui/react/macro` `<Trans>` / `useLingui`.

## Backend surface (VERIFIED, paths confirmed)
- **Stats:** `GET /api/workspaces/{ws}/analytics/dashboard` → `DashboardStats`. Already consumed.
- **Activity:** `GET /api/workspaces/{ws}/analytics/activity?limit=N` → `RecentActivity[]`. **`limit` only — NO `days=` aggregate.** (Confirms HUD 14-day sparkline has no backend; ships flag-off.)
- **Approvals (DASH-03 Pending Approvals):** `GET /api/workspaces/{ws}/pending-changes` (owner/admin; `?status=` filter) + `/pending-changes/{id}` + `/my-pending-changes`. NO frontend api/hook yet — BUILD `lib/api/pendingChanges.ts` + `usesPendingChangesQuery`. Need count for the side-rail card. 403 for non-owner/admin → card must degrade gracefully (hide or "—").
- **Expiring (DASH-03 System Alerts):** `GET /api/workspaces/{ws}/inventory/expiring` → `ListExpiringOutput`. Frontend hook EXISTS: `features/inventory/hooks/useExpiringQuery.ts` (`ExpiringPage` consumes it). REUSE.
- **Maintenance due (DASH-03 System Alerts):** `GET /api/workspaces/{ws}/maintenance/due` → `{ items: DueSchedule[] }` (`is_overdue` server-computed). Frontend hook EXISTS: `features/maintenance/hooks/useMaintenanceQuery.ts` → `useMaintenanceDueQuery`. REUSE.
- **Notifications (NOTIF-01..03):** USER-scoped (protectedAPI, NOT workspace-scoped). Paths under `/api`:
  - `GET /api/notifications?page=&limit=` → list
  - `GET /api/notifications/unread` → unread list
  - `GET /api/notifications/unread/count` → `{ count }` (badge — NOTIF-03)
  - `GET /api/notifications/{id}`
  - `POST /api/notifications/{id}/read` (mark one)
  - `POST /api/notifications/read-all` (mark all)
  NO frontend api/hook yet — BUILD `lib/api/notifications.ts` + hooks. Confirm exact response field names against `notification/entity.go` during planning.

## Chrome already reserved (EXTEND)
`frontend2/src/components/layout/TopBar.tsx` line 114-120: `data-testid="bell-slot"` — a **disabled placeholder** (`aria-disabled`, opacity-50, title "Coming soon"). Phase 13 replaces it with a real bell button → dropdown (NOTIF-01/02) + unread badge (NOTIF-03). TopBar comment already says "reserved disabled bell slot (Phase 13)". SSE ONLINE dot + sse-slot already live (Phase 6) — notifications can invalidate on SSE if a `notification` entity type is in the invalidation map (verify; else poll `unread/count`).

## Flag pattern (DASH-04)
Existing precedent: `import.meta.env.VITE_AUTHELIA_ENABLED === "true"` (`SocialLoginButtons.tsx`). HUD row gates on `import.meta.env.VITE_FEATURE_HUD_ROLLUPS === "true"`, **default off** (FOUND-06 / Conflict-3 resolution). Hand-rolled SVG only — NO charting library (POL-04 bundle budget; charting lib belongs to Phase 13b). Counts can come from `DashboardStats`; gauge needs a `capacity_target` (not in backend → use a client constant or stub when flag on; document as data-pending).

## Shortcuts (DASH-05)
Register `useShortcuts("dashboard", [{key:"N", → /items/new},{key:"S", → /scan},{key:"L", → /loans}])`. LANDMINE (handoff): pass `navigate` via stable ref / destructure `.mutate`; never put `t`/fresh-object in deps → render-loop (hit 4× this project). Pattern exists in `features/items` (`useShortcuts("items", …)`).

## Atoms available (Phase 4 — all exist, do not build)
`Window`/RetroPanel (`// HEADER` slot), `StatCard`, `RetroTable`, `RetroBadge`/`StatusPill`, `RetroStatusDot`, `RetroEmptyState`, `RetroBadge` dot-mode, RetroDialog/Popover (for the notifications dropdown — pattern from TopBar user menu + Phase 4 Popover). Sketch direction = retro-os pastel, dashboard = sketch 006 (auto-load `sketch-findings-home-warehouse-system`).

## Layout shape
Dashboard becomes a main column (tiles + activity) + a **side rail** (right, stacks Pending Approvals → System Alerts[expiring + due-maintenance]). Responsive: rail drops below main on narrow. HUD row (when flag on) sits between tiles and activity (or top). Keep `max-w-[1280px]` container.

## Open Questions (RESOLVED inline)
1. **HUD data with no backend aggregate?** → Ship flag-OFF default (DASH-04 explicit). When flag ON: gauge + counts from `DashboardStats`; 14-day sparkline uses whatever client-derivable series exists or renders an empty/"data pending" sparkline. Document the missing `/activity?days=14` + `capacity_target` as backend-coordination items (CARRY-FORWARD already notes Phase 13 HUD endpoint specs). Do NOT invent a backend endpoint this phase.
2. **Pending Approvals visible to non-admins?** → `/pending-changes` is owner/admin-only (403 otherwise). Card queries with `retry:false`; on 403 hide the card or show a neutral "—" (no error spam). `/my-pending-changes` is the all-roles fallback if we want every user to see their own — decide in planning (recommend: side-rail card = workspace pending-changes for admins; degrade silently for others).
3. **Notifications scope.** USER-scoped, not workspace — query key `["notifications"]` (no wsId). Badge polls `unread/count` (cheap) OR invalidates on SSE `notification` event if mapped. Recommend `refetchInterval` fallback + SSE invalidation if available.
4. **Activity Status pill column (DASH-02).** `RecentActivity` may lack a status field — verify `lib/types.ts`. If absent, derive a pill from `action` (CREATE=ok/DELETE=danger…) reusing `ACTION_BADGES` as the status, or add the column as the existing badge. Keep it honest — don't fabricate a status the data lacks.

## Likely plan split (for planner; disjoint files where parallel)
- **A. Notifications feature** (`lib/api/notifications.ts` + `features/notifications/` hooks + bell button + dropdown + badge; wire into TopBar bell-slot). NOTIF-01/02/03.
- **B. Pending-changes api+hook + side-rail PendingApprovals panel.** DASH-03 (part).
- **C. System Alerts panel** (expiring + due-maintenance cards, reuse existing hooks) + side-rail layout container. DASH-03 (part).
- **D. DashboardPage extend:** side-rail composition, relative-time formatter + Status column (DASH-02 finish), DASH-05 shortcuts, layout. (single-writer on DashboardPage.tsx)
- **E. HUD row** flag-gated SVG gauge+sparkline+counts. DASH-04. (new component file, flag off)
TopBar.tsx is single-writer (A touches it) — serialize anything else touching TopBar. DashboardPage.tsx single-writer (D, and C/E if they mount into it) — compose so D owns the page and imports B/C/E components (B/C/E ship as standalone components + hooks, D wires them in its wave).
