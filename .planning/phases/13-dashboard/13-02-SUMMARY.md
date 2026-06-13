---
phase: 13-dashboard
plan: 02
subsystem: frontend2/approvals
tags: [dashboard, approvals, pending-changes, side-rail, 403-degrade]
requires:
  - "GET /api/workspaces/{ws}/pending-changes (owner/admin-only; { changes, total })"
  - "useWorkspace().currentWorkspaceId (D-12 SSOT)"
  - "@/components/retro Window + RetroBadge atoms"
provides:
  - "pendingChangesApi.list(ws, {status?}) — lib/api/pendingChanges.ts"
  - "usePendingChangesQuery({status?}) — { total, isLoading, isError, isForbidden }"
  - "PendingApprovalsPanel — standalone side-rail card (mount target for Plan 13-05)"
affects:
  - "Plan 13-05 (W2) imports + mounts PendingApprovalsPanel in the dashboard side rail"
tech-stack:
  added: []
  patterns:
    - "retry:false + HttpError.status===403 → isForbidden → silent degrade"
    - "BEVEL_LINK: <Link> styled as a bevel button (BevelButton has no `as`)"
key-files:
  created:
    - frontend2/src/lib/api/pendingChanges.ts
    - frontend2/src/features/approvals/hooks/usePendingChangesQuery.ts
    - frontend2/src/features/approvals/components/PendingApprovalsPanel.tsx
    - frontend2/src/features/approvals/components/PendingApprovalsPanel.test.tsx
  modified: []
decisions:
  - "Envelope decoded as { changes, total } — key is `changes`, NOT `items` (verified pendingchange/handler.go:381-382)"
  - "isForbidden derives from HttpError.status===403; the api client already carries status"
  - "Both a 403 AND any non-403 error render null — a best-effort side-rail card never spams"
  - "Link target /approvals is a forward seam — no such route exists on this branch yet (see Seams)"
metrics:
  duration: ~12m
  completed: 2026-06-13
---

# Phase 13 Plan 02: Pending Approvals side-rail (api/hook + PendingApprovalsPanel) Summary

Workspace-scoped pending-changes api + a `retry:false` query hook + a self-contained
`PendingApprovalsPanel` (DASH-03) that shows the pending count for owners/admins and
degrades silently — rendering nothing — on a 403 for everyone else.

## What shipped

- **`lib/api/pendingChanges.ts`** — `pendingChangesApi.list(ws, { status? })` →
  `get<{ changes: PendingChangeDTO[]; total: number }>("/workspaces/{ws}/pending-changes" + ?status=)`.
  Envelope key is **`changes`** (NOT `items`), verified against the backend output DTO. `PendingChangeDTO`
  types only the consumer-relevant fields (id, workspace_id, requester_*, entity_*, action, status, created_at).
- **`features/approvals/hooks/usePendingChangesQuery.ts`** — `usePendingChangesQuery({ status? })`
  keyed `["pending-changes", wsId, status ?? "all"]`, `enabled: Boolean(wsId)`, **`retry: false`**.
  Returns `{ total, isLoading, isError, isForbidden }`; `isForbidden` = `error instanceof HttpError && error.status === 403`.
- **`features/approvals/components/PendingApprovalsPanel.tsx`** — a `Window`-chrome side-rail card
  (`titlebarVariant="butter"`, title `<Trans>Pending approvals</Trans>`). Branching: `isForbidden || isError`
  → `return null` (silent degrade, no banner, no leak); `isLoading` → mono `Loading…`; `total > 0` → big mono
  count + `RetroBadge variant="warn"` + a `Review` link to `/approvals`; `total === 0` → calm `Nothing pending`.
  All strings via `@lingui/react/macro` `<Trans>`. STANDALONE — does not import DashboardPage.

## For Plan 13-05 (the mount)

- **Import:** `import { PendingApprovalsPanel } from "@/features/approvals/components/PendingApprovalsPanel";`
- **Props:** none — the panel self-fetches via `usePendingChangesQuery()` (needs a `WorkspaceProvider` +
  `QueryClientProvider` ancestor, both already present inside the authed AppShell). It also renders a `<Link>`,
  so it must sit under the router (it does, inside AppShell). No props to wire.
- **Behaviour for non-admins:** the panel renders `null`, so it simply will not appear in the side rail for
  members/viewers — no placeholder needed at the mount site.

## Seams / follow-ups

- **`/approvals` route does not exist yet** on this branch (`src/routes/index.tsx` declares no such Route).
  The `Review` link points at `/approvals` as the forward seam; until a future plan lands that page the link
  falls through to the `*` PlaceholderShell. A later approvals-page plan should add
  `<Route path="approvals" element={<ApprovalsPage />} />` under the authed AppShell.

## Deviations from Plan

None — plan executed as written. (Chose the `return null` silent-degrade form over a neutral "—" strip,
which the plan explicitly offered as a pick; this most strictly satisfies "no leak of existence/volume", T-13-04.)

## Threat coverage

- **T-13-04 (Elevation, non-admin reading pending changes):** server returns 403; the panel renders `null`
  on `isForbidden` — no count, no title, no leak of pending-work volume/existence.
- **T-13-05 (DoS, retry storm on a 403):** `retry: false` on the query — a forbidden response settles once.

## Verification

- `bunx tsc --noEmit -p tsconfig.json` → exit 0 (clean, whole project).
- `grep -c "retry: false" usePendingChangesQuery.ts` → matches (key invariant present).
- `bun run test PendingApprovalsPanel.test.tsx` → **4 passed** (admin count + Review link, calm total=0,
  silent 403 degrade with NO error banner, Loading… placeholder).

## Commits

- `ac3e540b` feat(13-02): workspace pending-changes api + 403-safe query hook
- `4672af4c` feat(13-02): PendingApprovalsPanel — count + silent 403 degrade

## Self-Check: PASSED

- FOUND: frontend2/src/lib/api/pendingChanges.ts
- FOUND: frontend2/src/features/approvals/hooks/usePendingChangesQuery.ts
- FOUND: frontend2/src/features/approvals/components/PendingApprovalsPanel.tsx
- FOUND: frontend2/src/features/approvals/components/PendingApprovalsPanel.test.tsx
- FOUND commit: ac3e540b
- FOUND commit: 4672af4c
