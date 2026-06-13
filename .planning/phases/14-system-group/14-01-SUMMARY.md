---
phase: 14-system-group
plan: 01
subsystem: frontend2-approvals
tags: [approvals, pending-changes, bulk-actions, shortcuts, render-loop-guard, 403-degrade]
requires:
  - "@/lib/api get<T> / post<T> / HttpError (bare-body cookie-JWT client)"
  - "@/features/workspace/useWorkspace currentWorkspaceId"
  - "@/components/retro useTableSelection (id-keyed Shift+Click) + BulkActionBar + RetroConfirmDialog + RetroInput + RetroEmptyState + retroToast"
  - "@/components/shortcuts useShortcuts(id, bindings)"
  - "@/components/modal ModalStackProvider (RetroConfirmDialog mounts a RetroDialog)"
provides:
  - "pendingChangesApi.approve(ws,id) + reject(ws,id,reason) (lib/api/pendingChanges.ts — EXTENDED, list unchanged)"
  - "useApprovalsList() → { rows, total, isLoading, isError, isForbidden }, key ['pending-changes', wsId, 'pending']"
  - "useApproveChange() / useRejectChange() per-id mutations (no self-invalidate; page batches)"
  - "ApprovalsPage (named export) — the /approvals review surface"
affects:
  - "14-08 (Wave 2 wiring): mounts <ApprovalsPage/> at /approvals + adds the Sidebar nav entry"
  - "Phase 13 PendingApprovalsPanel 'Review' link target is this page's /approvals route"
tech-stack:
  added: []
  patterns:
    - "EXTEND-not-rewrite: pendingChangesApi.list ({ changes, total }) preserved for usePendingChangesQuery; only approve/reject added"
    - "['pending-changes', wsId, ...] key prefix — page invalidates ['pending-changes', wsId] ONCE post-batch so this list AND the dashboard side-rail count both refresh"
    - "403 silent-degrade: retry:false + isForbidden from HttpError.status===403 → calm guard, no error storm / existence leak"
    - "bulk = Promise.allSettled over selected ids (NO bulk endpoint) → partial-failure toast"
    - "render-loop guard: all unstable values (sel, mutations, queryClient, wsId) read through refs so useCallback/useMemo deps are EMPTY; toast text built by a per-render notifyRef (the @lingui macro `t` cannot ride a ref — must interpolate at its call site)"
key-files:
  created:
    - frontend2/src/lib/api/pendingChanges.test.ts
    - frontend2/src/features/approvals/hooks/useApprovalsList.ts
    - frontend2/src/features/approvals/hooks/useApprovalMutations.ts
    - frontend2/src/features/approvals/hooks/useApprovalsList.test.tsx
    - frontend2/src/features/approvals/ApprovalsPage.tsx
    - frontend2/src/features/approvals/ApprovalsPage.test.tsx
  modified:
    - frontend2/src/lib/api/pendingChanges.ts
decisions:
  - "Defer OMITTED — there is NO backend defer endpoint (ROADMAP A/R/D resolved to A/R only); no client-only no-op chip that would imply server state"
  - "Reject reason gathered ONCE for the whole batch via RetroConfirmDialog + a sunken RetroInput; empty reason is blocked client-side (server requires minLength 1)"
  - "Mutations do NOT self-invalidate; the page invalidates the ['pending-changes', wsId] PREFIX exactly once after Promise.allSettled settles (one refetch, not N)"
  - "The @lingui/react/macro `t` is a compile-time macro and CANNOT be invoked as a tagged template through a ref (yields ''); dynamic toast strings are built by a per-render notifyRef closure, shortcut LABELS are computed with the macro at a stable call site with an exhaustive-deps disable"
metrics:
  duration: ~35m
  completed: 2026-06-13
---

# Phase 14 Plan 01: Approvals Page (SYS-01) Summary

The `/approvals` review surface: an owner/admin paginated activity-table of PENDING
approval requests with Shift+Click multi-select and a BulkActionBar exposing
Approve/Reject chips wired through `useShortcuts("approvals", [A→approve, R→reject])`.
EXTENDS the Phase-13 `pendingChanges` api (adds per-id approve/reject) and builds the
full `features/approvals` page that Phase 13's "Review" link already targets. Wiring (the
route + Sidebar nav) is Wave-2 plan 14-08.

## What Was Built

- **`lib/api/pendingChanges.ts`** (EXTENDED) — added `approve(ws, id) → POST
  /workspaces/{ws}/pending-changes/{id}/approve` and `reject(ws, id, reason) → POST
  .../reject { reason }`. The existing `list(ws, opts?) → { changes, total }` (the BARE
  `changes` envelope, key `changes` NOT `items`) is untouched so `usePendingChangesQuery`
  (Phase 13 side-rail) keeps working. `PendingChangeDTO` already carried every table field
  (requester_name/email, entity_type, entity_id?, action, status, created_at) — no widening
  needed. No defer call.
- **`features/approvals/hooks/useApprovalsList.ts`** — mirrors `usePendingChangesQuery`:
  `useQuery({ queryKey: ["pending-changes", wsId, "pending"], enabled: Boolean(wsId),
  retry: false })`, returns `{ rows: data?.changes ?? [], total, isLoading, isError,
  isForbidden }` where `isForbidden = error instanceof HttpError && status === 403`.
- **`features/approvals/hooks/useApprovalMutations.ts`** — `useApproveChange()` and
  `useRejectChange()`, each a bare `useMutation` reading `wsId` from `useWorkspace`. They do
  NOT invalidate — the page batches and invalidates the prefix once.
- **`features/approvals/ApprovalsPage.tsx`** (named export `ApprovalsPage`) — the page:
  RetroTable of pending rows (Requester name+muted email / Entity type+short id / Action
  RetroBadge create=info|update=warn|delete=danger / Requested iso-date). Rows are
  `aria-selected` and feed `useTableSelection` via `onClick={(e) => sel.onRowClick(id, e)}`.
  A `BulkActionBar` appears when `sel.selected.size > 0` with Approve (mint) + Reject
  (danger) chips. Reject opens a `RetroConfirmDialog` carrying a `RetroInput` for the
  required reason. A 403 list renders a calm `RetroEmptyState` guard ("Only workspace owners
  and admins can review approvals.") and returns early — no table, no bulk bar.

## Verified Selectors (for 14-08 wiring + the live E2E spec)

- Route component: **`ApprovalsPage`** (named export, mounts at **`/approvals`**).
- Query key: **`["pending-changes", wsId, "pending"]`** (a prefix of the side-rail's
  `["pending-changes", wsId]`). Invalidate the `["pending-changes", wsId]` prefix to refresh
  both the list and the dashboard count.
- API shape: `pendingChangesApi.list(ws, { status }) → { changes, total }`,
  `.approve(ws, id)`, `.reject(ws, id, reason)`.
- The BulkActionBar is `role="toolbar"` aria-label "Bulk actions"; the count chip reads
  `"{n} SELECTED"`. Approve/Reject buttons match `/approve/i` and `/reject/i`.

## Bulk / Partial-Failure Behavior

No bulk endpoint exists. Approve and Reject each do `Promise.allSettled(ids.map(id =>
mutateAsync(...)))`, count fulfilled vs rejected, and surface a summary toast — a clean
success when all succeed, or "Approved N, M failed." / "Rejected N, M failed." on any
partial failure. The list `["pending-changes", wsId]` prefix is invalidated exactly once
after the batch settles, then the selection clears — so the table reflects precisely what
the server applied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lingui macro `t` cannot ride a ref (render-loop guard collision)**
- **Found during:** Task 3
- **Issue:** The plan's interface notes prescribed reading the label through a `tRef`
  (a ref holding `useLingui().t`) inside the shortcut memo. `@lingui/react/macro`'s `t` is
  a COMPILE-TIME macro that only transforms at its literal call site; invoked as a tagged
  template through a ref it produces an EMPTY string. This made the partial-failure toast
  render with empty text (test caught it: `data-title` empty).
- **Fix:** Kept the render-loop discipline (all unstable values — `sel`, the mutation
  objects, `queryClient`, `wsId` — read through refs so `useCallback`/`useMemo` deps are
  EMPTY) but moved the toast-string construction into a per-render `notifyRef` whose
  closures call the macro `t` directly. Shortcut labels are computed with the macro at a
  stable call site with a scoped `exhaustive-deps` disable (labels are locale-stable; the
  bindings memo deps remain the two stable callbacks). No render-loop (verified: the page
  test ran to completion; the earlier ref-churning draft busy-looped one fork worker and
  was corrected).
- **Files modified:** frontend2/src/features/approvals/ApprovalsPage.tsx
- **Commit:** 63d40ca2

**2. [Rule 3 - Blocking] Test wrapper needed ModalStackProvider**
- **Found during:** Task 3
- **Issue:** `RetroConfirmDialog` mounts a `RetroDialog` that calls
  `useModalStackContext()`, throwing outside a `<ModalStackProvider>`. The dialog mounts
  even while closed, so every page test errored.
- **Fix:** Wrapped the test render tree in `<ModalStackProvider>` (mirrors the real app
  shell + the LoansListPage test harness).
- **Files modified:** frontend2/src/features/approvals/ApprovalsPage.test.tsx
- **Commit:** 63d40ca2

**3. [Test-harness] Shift+Click driven via fireEvent, not userEvent**
- **Found during:** Task 3
- **Issue:** `userEvent.click(el, { shiftKey: true })` does not propagate `shiftKey` (the
  second arg is options, not event-init), so the range-select never triggered.
- **Fix:** Used `fireEvent.click(el, { shiftKey: true })` for the modifier clicks (button
  clicks still use `userEvent`). Production code is unchanged — the row `onClick` reads
  `e.shiftKey` from the synthetic event correctly.
- **Files modified:** frontend2/src/features/approvals/ApprovalsPage.test.tsx
- **Commit:** 63d40ca2

## Omissions (by design)

- **Defer chip OMITTED** — there is no backend `defer` endpoint (the ROADMAP "A/R/D"
  success criterion resolves to Approve/Reject only). No client-only no-op chip was added,
  per the plan's explicit instruction not to imply server state.

## Threat Model Compliance

- **T-14-01 (EoP):** the server re-checks `canReviewChanges` on every list/approve/reject
  (403); the UI guard is cosmetic. Honored — no client trust.
- **T-14-02 (Info-disclosure via retry storm):** `retry: false` (one settle) + `isForbidden`
  renders a static guard; no count/existence leak. Honored.
- **T-14-03 (DoS via render-loop):** bindings memo'd with empty deps; all unstable values
  via refs; the page test guards completion (would hang on a loop). Honored — and actively
  caught during execution (see Deviation 1).
- **T-14-04 (Tampering via all-or-nothing assumption):** `Promise.allSettled` per id +
  partial-failure toast + single post-batch invalidate. Honored.
- **T-14-SC (npm installs):** none — composes existing deps only.

## Verification

- `bun run lint:tsc` (`tsc -b --noEmit`) — clean (EXIT 0).
- `bunx vitest run src/lib/api/pendingChanges.test.ts src/features/approvals` —
  **4 files, 18 tests passed**.
  - pendingChanges.test.ts: 3 (list bare envelope, approve path, reject reason body)
  - useApprovalsList.test.tsx: 5 (fetch on wsId / disabled without / 403 no-retry /
    approve + reject mutateAsync resolve)
  - ApprovalsPage.test.tsx: 6 (rows render / Shift+Click range count / bulk approve drops
    rows / 403 calm guard / A+R shortcuts registered / partial-failure toast + survivor)
- All strings via `@lingui` `<Trans>` / `t`.

## Known Stubs

None — the page is fully wired to the live `/pending-changes` endpoints; the only deferred
work is the Wave-2 route + nav wiring (14-08), which is out of this plan's single-writer scope.

## Self-Check: PASSED

- Files created/modified verified present (see below).
- Per-task commits verified in git log.
