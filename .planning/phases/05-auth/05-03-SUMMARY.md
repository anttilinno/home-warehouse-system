---
phase: 05-auth
plan: 03
subsystem: frontend-workspace
tags: [auth, workspace, context, switcher, react-query, d-12, msw, vitest]

# Dependency graph
requires:
  - plan: 05-02
    provides: "MSW shared fixture (src/test/msw/*) + auth-expired event + RequireAuth ['workspaces'] probe"
  - phase: 04-atoms
    provides: "Popover (chromeless listbox), retroToast (mint), RetroEmptyState, useModalStack ESC arbiter"
  - phase: 03-shell
    provides: "TopBar disabled workspace-pill slot; AppShell grid; QueryClientProvider at App root"
provides:
  - "WorkspaceProvider (D-12 SSOT): currentWorkspaceId context + localStorage['workspace_id'] + first-workspace heal + invalidate-on-switch"
  - "useWorkspace() hook (throws outside provider) — the wsId source for every Phase 7+ entity hook"
  - "WorkspaceSwitcher: live TopBar pill → Popover listbox (loading/single/zero/multi states, ESC-safe)"
  - "DashboardPage de-hardcoded: wsId sourced from context, first-workspace hardcode GONE"
affects: [05-auth Plan 05 (useLogout resets workspace_id), all Phase 7+ entity pages]

# Tech tracking
tech-stack:
  added: []  # no new packages — reused Popover/retroToast/RetroEmptyState/MSW
  patterns:
    - "WorkspaceProvider = D-12 SSOT: reuse the shared ['workspaces'] query key (no extra request), heal to workspaces[0].id, invalidateQueries on switch (never page-reload — Pitfall 6)"
    - "useWorkspace() throws-outside-provider guard so a missing provider fails loudly"
    - "Switcher tests mock useWorkspace per-case; provider tests use real QueryClient + MSW + invalidateQueries spy"

key-files:
  created:
    - frontend2/src/features/workspace/WorkspaceProvider.tsx
    - frontend2/src/features/workspace/useWorkspace.ts
    - frontend2/src/features/workspace/WorkspaceProvider.test.tsx
    - frontend2/src/components/layout/WorkspaceSwitcher.tsx
    - frontend2/src/components/layout/WorkspaceSwitcher.test.tsx
    - frontend2/src/features/dashboard/DashboardPage.test.tsx
  modified:
    - frontend2/src/components/layout/TopBar.tsx
    - frontend2/src/components/layout/TopBar.test.tsx
    - frontend2/src/components/layout/AppShell.tsx
    - frontend2/src/components/layout/AppShell.test.tsx
    - frontend2/src/features/dashboard/DashboardPage.tsx

decisions:
  - "Mounted WorkspaceProvider in AppShell (wrapping the grid root) — the smallest wrapper covering both TopBar (switcher) and the Outlet (pages), and authenticated-only since AppShell sits under RequireAuth."
  - "Switcher + DashboardPage tests mock useWorkspace per-case (state-branch coverage) rather than threading a real provider; the provider's own five behaviors are proven against a real QueryClient + MSW in WorkspaceProvider.test.tsx."
  - "Removed the now-redundant disabled 'Switch workspace' user-menu placeholder — with the live pill switcher it was a misleading 'coming soon' stub (Rule 1, truthfulness)."

requirements-completed: [AUTH-06]

# Metrics
duration: ~30min
completed: 2026-06-13
tasks: 3
files-modified: 11
---

# Phase 5 Plan 03: WorkspaceProvider (D-12 SSOT) + TopBar Switcher + DashboardPage De-hardcode Summary

**The D-12 WorkspaceProvider is now the single source of truth for the active workspace — context + localStorage with a first-workspace heal and invalidate-on-switch — feeding a live, accessible TopBar Popover switcher and a DashboardPage whose `workspaces.data?.[0]?.id` hardcode is gone.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 11 (6 created, 5 modified)

## Accomplishments

- **WorkspaceProvider + useWorkspace (D-12 SSOT):** A React context holding `{ currentWorkspaceId, setWorkspace, workspaces, isLoading }`. It reuses the existing `["workspaces"]` query (the same cache entry RequireAuth + DashboardPage use, so it costs no extra request), initialises `currentWorkspaceId` from `localStorage["workspace_id"]`, and a heal effect falls back to `workspaces[0].id` whenever the stored id is null or absent from the list (rewriting localStorage). `setWorkspace` persists, sets state, and calls `queryClient.invalidateQueries()` — never a page reload (Pitfall 6). `useWorkspace()` throws outside the provider. All five behaviors proven.
- **WorkspaceSwitcher:** The Phase 3 disabled placeholder pill is replaced by a live `<button>` trigger (`aria-haspopup="listbox"`, `aria-expanded`) opening a chromeless Phase 4 `Popover` (`role="listbox"`, `min-w-[220px]`). Rows are `role="option" aria-selected`; the current row carries `aria-current`, a `bg-titlebar-blue` fill, and a `✓`. Clicking a non-current row switches context and fires a mint `Switched to {name}.` toast; clicking the current row just closes. The four UI-SPEC §4 states are realised: loading (`aria-busy` skeleton), single (non-expanding `aria-disabled`), zero (empty `No workspaces. Contact an owner.` row), multi (full switcher). ESC closes via `useModalStack` and never logs out.
- **TopBar / AppShell wiring:** TopBar mounts `<WorkspaceSwitcher />` in the old pill slot (keeping the `data-testid="workspace-pill"`). AppShell wraps the authenticated shell subtree in `<WorkspaceProvider>` so the switcher AND every Outlet page read context.
- **DashboardPage de-hardcoded:** `const wsId = workspaces.data?.[0]?.id` → `const { currentWorkspaceId: wsId, workspaces } = useWorkspace()`. The duplicate local `["workspaces"]` query is dropped; the empty-state check reads the provider's list. The `["dashboard", wsId]` / `["activity", wsId]` keys and `enabled: !!wsId` guards are unchanged — only the wsId source moved.

## Task Commits

1. **Task 1: WorkspaceProvider + useWorkspace (D-12 SSOT)** — `af1aa861` (feat)
2. **Task 2: WorkspaceSwitcher Popover + TopBar/AppShell wiring** — `2744f057` (feat)
3. **Task 3: De-hardcode DashboardPage to read wsId from useWorkspace** — `5f98cf0d` (feat)

## Verification

- `cd frontend2 && bun run test src/` — **279 passed (44 files)**; 263 baseline + 16 new (6 provider + 8 switcher + 2 dashboard; TopBar/AppShell updated in place).
- `bun run lint:tsc` — clean (`tsc -b --noEmit`).
- `bun run lint:imports` — OK.
- `bun run build` — succeeds (418.98 kB index, built in 648ms).
- Grep gates:
  - `grep -c 'workspaces.data?.[0]?.id' DashboardPage.tsx` → **0** (AUTH-06 hardcode-removed proof).
  - `grep -c 'location.reload' WorkspaceProvider.tsx` → **0** (no reload anti-pattern).
  - `grep '"workspace_id"' WorkspaceProvider.tsx` → matches (D-12 localStorage key).
  - `grep 'invalidateQueries' WorkspaceProvider.tsx` → matches.
  - `grep 'aria-haspopup="listbox"|role="listbox"' WorkspaceSwitcher.tsx` → matches.
  - `grep 'WorkspaceProvider' AppShell.tsx` → matches (provider mounted).

## TDD Gate Compliance

Tasks 1 and 2 were authored `tdd="true"`. For both, the test file was written first and the source verified to fail before implementation existed (Task 1 RED: the test imported missing `WorkspaceProvider`/`useWorkspace` modules and errored at collection; Task 2 RED implicit via the same author-test-first flow). Unlike Plan 05-02's split RED→GREEN commits, here each TDD task's test + implementation landed in a single `feat` commit because both were staged together before the first commit of the task. The RED→GREEN observation was real (Task 1's failing run captured before the source Write); the gate sequence is collapsed into one commit per task rather than two. No `feat` preceded its test logically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AppShell.test.tsx + TopBar.test.tsx needed provider/context plumbing**
- **Found during:** Task 2
- **Issue:** Mounting `<WorkspaceProvider>` in AppShell made AppShell.test.tsx render a `useQuery` with no `QueryClientProvider` in scope; and TopBar now renders `<WorkspaceSwitcher />` which calls `useWorkspace()` with no provider.
- **Fix:** AppShell.test.tsx now wraps `renderShell` in a `QueryClientProvider` (the shared MSW server answers `/api/users/me/workspaces`). TopBar.test.tsx mocks `@/features/workspace/useWorkspace` with a two-workspace context so the switcher renders an interactive pill; the disabled-placeholder assertion became a live-switcher assertion. The BAR-05 ESC-never-logs-out coverage is intact.
- **Files modified:** AppShell.test.tsx, TopBar.test.tsx
- **Commit:** 2744f057

**2. [Rule 1 - Bug] Redundant disabled "Switch workspace" user-menu item**
- **Found during:** Task 2
- **Issue:** With the live switcher in the pill, the user-menu's disabled `Switch workspace` placeholder ("coming soon") was a misleading stub.
- **Fix:** Removed the placeholder item; the menu now lists only the truthful Profile/Settings placeholders + Log out.
- **Files modified:** TopBar.tsx
- **Commit:** 2744f057

## Authentication Gates

None.

## Known Stubs

None — the switcher's single/zero/loading branches are intentional UI states (UI-SPEC §4), not unwired stubs. The Profile/Settings user-menu placeholders predate this plan (Phase 12 scope).

## Threat Flags

None — no new network surface. `workspace_id` is a client preference, not an authority boundary (T-05-10: backend repos enforce tenancy regardless of the selected wsId). T-05-11 (stale cross-workspace data) is mitigated by both halves: every entity key includes wsId AND `setWorkspace` invalidates all queries. T-05-12 (ESC logout) is mitigated: the switcher routes ESC through `useModalStack` and the test asserts no logout.

## Self-Check: PASSED

- frontend2/src/features/workspace/WorkspaceProvider.tsx — FOUND
- frontend2/src/features/workspace/useWorkspace.ts — FOUND
- frontend2/src/features/workspace/WorkspaceProvider.test.tsx — FOUND
- frontend2/src/components/layout/WorkspaceSwitcher.tsx — FOUND
- frontend2/src/components/layout/WorkspaceSwitcher.test.tsx — FOUND
- frontend2/src/features/dashboard/DashboardPage.test.tsx — FOUND
- Commit af1aa861 — FOUND
- Commit 2744f057 — FOUND
- Commit 5f98cf0d — FOUND

---
*Phase: 05-auth*
*Completed: 2026-06-13*
