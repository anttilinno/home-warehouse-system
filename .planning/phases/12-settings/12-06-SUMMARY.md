---
phase: 12-settings
plan: 06
subsystem: frontend2/settings
tags: [settings, members, parity, role-mgmt, add-by-email, msw, tdd]
requires:
  - "backend 12-01: MemberResponse enriched with email/full_name; POST /members accepts {email,role}, 404 if unregistered"
  - "frontend 12-02: settingsApi.listMembers/addMemberByEmail/updateMemberRole/removeMember + Member type + pre-registered MembersPage route/stub"
provides:
  - "MembersPage — list (name/email/role) + per-row role change + remove confirm + add-by-email, wired to the real endpoints"
affects:
  - "Plan 12-07 (Members E2E) binds to the real route this fills in; uses the same query key / endpoints"
tech-stack:
  added: []   # ZERO new packages (T-12-SC mitigated; lint:imports green)
  patterns:
    - "Server-authoritative guards mirrored client-side for UX, surfaced on miss (AccountsPage 409 idiom)"
    - "Per-row RetroSelect with an sr-only aria-label (label-required atom, no visible per-row label)"
    - "vi.mock('@/features/workspace/useWorkspace') in the test to supply wsId without booting WorkspaceProvider"
key-files:
  created: []
  modified:
    - frontend2/src/features/settings/MembersPage.tsx
    - frontend2/src/features/settings/MembersPage.test.tsx
decisions:
  - "Own-row guard: role select disabled + Remove hidden for the row whose user_id === me.id (compared against ['me'].id). T-12-12 mirror."
  - "Add-by-email errors surface in an INLINE danger band in the footer strip (404 unregistered, 400 already-member, generic) rather than a toast — keeps the error attached to the form."
  - "Role/remove mutation errors surface as danger TOASTS (last-owner 400, own-role 400); the band is add-only."
  - "RetroSelect requires a label prop; per-row + add-form selects pass an sr-only <Trans> label, queried in tests via getByRole('combobox', { name: /role for/i })."
metrics:
  duration_sec: 360
  completed: 2026-06-13
  tasks: 2
  files_modified: 2
---

# Phase 12 Plan 06: Members Page Summary

Filled the pre-registered `MembersPage` stub in-place with the full members
management surface (SETT-10): a single blue `Window` "MEMBERS" holding a
RetroTable (NAME / EMAIL / ROLE / actions) plus a footer add-by-email strip.
Binds to the parity-true 12-01 backend (enriched email/full_name on the list
path, email-accepting POST) through the 12-02 `settingsApi`. TDD: 9 failing
specs first (RED commit), then the component (GREEN). Zero new packages.

## What was built

### Task 1 — list + role-change + remove (TDD)
- `["members", wsId]` (wsId from `useWorkspace`) → RetroTable rows. Each row
  shows `full_name` (fallback email, then truncated user_id), `email` in mono,
  a per-row `RetroSelect` of owner/admin/member/viewer, and a Remove button.
- Own row (member.user_id === `["me"].id`) is tagged with a `RetroBadge "YOU"`
  (info), its role select is **disabled**, and its Remove is **hidden**
  (T-12-12 self-promotion mirror).
- Role change → `settingsApi.updateMemberRole(wsId, userId, role)` → toast +
  invalidate `["members", wsId]`; a 400 (own-role, server-authoritative) →
  danger toast "Couldn't change role."
- Remove → pink `RetroConfirmDialog` ("Remove {name}? … They'll lose access
  immediately.") → `settingsApi.removeMember`; a 400 (last owner, T-12-13) →
  danger toast "Can't remove the last owner."
- Empty list → `RetroEmptyState` ("No members yet" / "Invite someone to share
  this workspace.").

### Task 2 — add-by-email (TDD)
- Footer strip (`border-t-2`, `bg-bg-panel-2`): a RHF + zod form (email: zod
  email; role: RetroSelect default "member") + an "Add" primary submit,
  placeholder "user@email…".
- Submit → `settingsApi.addMemberByEmail(wsId, { email, role })` → toast +
  reset + invalidate. Errors render in an inline danger band:
  - 404 → "No registered user with that email." (T-12-14 oracle, accepted)
  - 400 → "That user is already a member."
  - else → "Couldn't add member. Try again."

## Interface binding (verified against 12-01 / 12-02 summaries)

- `settingsApi.listMembers(wsId) → { items: Member[] }` — `Member` carries
  `email`/`full_name` (12-01 list enrichment).
- `settingsApi.addMemberByEmail(wsId, { email, role })` — POSTs `{email, role}`
  (test asserts exact body).
- `settingsApi.updateMemberRole(wsId, userId, role)` — PATCHes `{ role }`.
- `settingsApi.removeMember(wsId, userId)` — DELETE.
- Role enum: `owner | admin | member | viewer` (verified backend).

## Verification

- `bun run lint:tsc` — clean (rc=0).
- `bun run test src/features/settings/MembersPage.test.tsx` — 9 passed
  (list/empty/own-row/role-PATCH/remove-DELETE/last-owner-400 + add-POST/404/400).
- `bun run lint:imports` — OK (zero forbidden imports; T-12-SC: no new packages).

## TDD Gate Compliance

- RED: `test(12-06)` commit — 9 specs failing against the `return null` stub.
- GREEN: `feat(12-06)` commit — component implemented, all 9 green.

## Deviations from Plan

**1. [Rule 1 — Test correctness] Mocked `useWorkspace` in the test.**
- The plan's interfaces note offered "wrap with WorkspaceProvider (or mock
  useWorkspace)". Chose `vi.mock("@/features/workspace/useWorkspace")` returning
  `{ currentWorkspaceId: "ws-1" }` — avoids booting the provider's workspace-list
  fetch and keeps the spec focused on the members surface. The real provider
  binding is covered by the 12-07 E2E plan.

**2. [Rule 2 — UX correctness] Added a null-wsId guard branch.**
- `useWorkspace().currentWorkspaceId` is `string | null`. When null, the page
  renders a "Select a workspace…" note instead of firing a `/workspaces/null/...`
  request (the members query is `enabled: wsId != null`). Defensive; not in the
  plan's happy path but required for correctness.

## Known Stubs

None. All data is threaded from the real `settingsApi`; no hardcoded/placeholder
rows. The own-row YOU badge + guards derive from live `["me"]` + `["members"]`.

## Threat Flags

None beyond the plan's threat_model. T-12-14 (add-by-email existence oracle,
disposition: accept) is surfaced only to an authenticated workspace admin via
the inline 404 band — no new surface introduced.

## Self-Check: PASSED
