---
phase: 12-settings
plan: 05
subsystem: settings
tags: [data-storage, clear-cache, export, import-pointer, online-only]
requires:
  - "12-02: settingsApi.exportWorkspace + DataStoragePage stub + lazy route"
  - "useWorkspace().currentWorkspaceId + workspaces[].role (WorkspaceProvider)"
provides:
  - "DataStoragePage: clear-cache (client-only) + admin-gated export + import pointer"
affects:
  - "frontend2/src/features/settings/DataStoragePage.tsx (stub body overwritten in-place)"
tech-stack:
  added: []
  patterns:
    - "queryClient.clear() behind a butter RetroConfirmDialog (no backend call)"
    - "useMutation wrapping settingsApi.exportWorkspace with defensive 403 toast"
    - "role gate (owner/admin) on the export action"
key-files:
  created:
    - frontend2/src/features/settings/DataStoragePage.test.tsx
  modified:
    - frontend2/src/features/settings/DataStoragePage.tsx
decisions:
  - "Import section = disabled butter 'COMING SOON' RetroBadge — no imports/restore route exists in routes/index.tsx on this branch (grep confirmed)."
  - "Export follows the PLAN (binding override): real admin-gated GET /workspaces/{wsId}/export/workspace via settingsApi.exportWorkspace, NOT the UI-SPEC §9 'NOT AVAILABLE' fallback — 12-02 shipped the verified endpoint wrapper (OQ5 resolved in the plan)."
  - "Role read via workspaces.find(w => w.id === currentWorkspaceId)?.role; ADMIN_ROLES = {owner, admin}."
metrics:
  duration: "~12m"
  completed: "2026-06-13"
---

# Phase 12 Plan 05: Data & Storage Summary

SETT-09 Data & Storage subpage — one blue `Window` with three sections:
client-only clear-cache (`queryClient.clear()` behind a butter confirm, no
fetch), an admin-gated real workspace export (`settingsApi.exportWorkspace`),
and an import POINTER rendered as a disabled "COMING SOON" badge.

## What shipped

- **CACHED DATA** — "Clear cached data" BevelButton opens a butter
  `RetroConfirmDialog`; confirming calls `queryClient.clear()` (CLIENT-only, no
  network) and fires `retroToast.success("Cached data cleared.")`. Cancel is a
  no-op (cache untouched).
- **EXPORT** — visible only when the current workspace role is `owner`/`admin`;
  click runs a `useMutation` calling
  `settingsApi.exportWorkspace(currentWorkspaceId, "xlsx")` →
  `GET /workspaces/{wsId}/export/workspace?format=xlsx` via `downloadBlob`. A
  null wsId is guarded; any failure (incl. server `requireAdminRole` 403,
  T-12-10) surfaces a persistent danger toast "Couldn't export. Try again."
  (defense in depth, Pitfall 8). Non-admin roles see a muted note instead of the
  button.
- **IMPORT** — pointer to the Phase-14 imports surface. **No imports/restore
  route exists in `routes/index.tsx` on this branch** (grep confirmed), so it
  renders as a non-link row with a disabled butter `RetroBadge variant="info"`
  "Coming soon" (`aria-disabled`). No inline restore flow built (A3).

## Online-only invariant (T-12-11)

The file imports NO `idb`/`serwist`/`sync*` modules. The verify grep
(`grep -nE "idb|serwist|sync[A-Z]"`) returns nothing — the original explanatory
comment that mentioned those token names was reworded to "offline-cache" so the
source-level grep guard stays clean. The test also reads the source and asserts
the pattern is absent.

## Test (TDD)

`DataStoragePage.test.tsx` (7 cases, all green). `useWorkspace` and
`@/lib/api/settings` are mocked; a `vi.spyOn(client, "clear")` verifies the
clear path, a `vi.spyOn(globalThis, "fetch")` asserts clear fires NO network:

- confirm → `queryClient.clear()` once + success toast + zero fetch
- cancel → no clear
- admin → export calls `exportWorkspace("ws-1", "xlsx")`
- export rejection → danger toast
- viewer role → no export button + admin-required note
- import → "COMING SOON" badge, no imports link
- source grep: no offline-storage tokens

## Deviations from Plan

None — plan executed as written. Plan-vs-UI-SPEC tension on export resolved in
favor of the PLAN's binding objective (real admin-gated export); documented above.

## Files

- `frontend2/src/features/settings/DataStoragePage.tsx` (stub body overwritten;
  export name `DataStoragePage` preserved; routes/SettingsLayout untouched)
- `frontend2/src/features/settings/DataStoragePage.test.tsx` (new)

## Verification

- `bun run test src/features/settings/DataStoragePage.test.tsx` → 7 passed
- `grep -nE "idb|serwist|sync[A-Z]" .../DataStoragePage.tsx` → no matches (exit 1)
- `bun run lint:tsc` → clean
- `bun run lint:imports` → OK

## Self-Check: PASSED

- FOUND: frontend2/src/features/settings/DataStoragePage.tsx
- FOUND: frontend2/src/features/settings/DataStoragePage.test.tsx
- FOUND: .planning/phases/12-settings/12-05-SUMMARY.md
