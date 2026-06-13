---
phase: 12-settings
plan: 07
subsystem: frontend2-e2e
tags: [settings, e2e, playwright, parity, one-login]
requires: ["12-02", "12-03", "12-04", "12-06"]
provides: ["live Playwright settings spec: landing → profile save → language → members"]
affects: ["frontend2/e2e/settings.spec.ts"]
tech-stack:
  added: []
  patterns: ["one-login describe.serial (auth-limiter)", "cookie-inherited page.request", "deterministic 404 path for add-by-email", "native RetroSelect selectOption by label"]
key-files:
  created: ["frontend2/e2e/settings.spec.ts"]
  modified: []
decisions:
  - "Members add-by-email uses the deterministic unregistered-email 404 path (no second-user seed) — same addMemberByEmail→POST /members contract, zero residue."
  - "Single describe.serial + beforeAll login (exactly one auth) reused across all 4 sub-flows."
metrics:
  duration: ~12m
  completed: 2026-06-13
---

# Phase 12 Plan 07: Live Settings E2E Summary

A single-login live Playwright spec (`frontend2/e2e/settings.spec.ts`) proving the
Settings hub end to end across the real cookie-JWT boundary and the load-bearing
`/api` proxy rewrite: landing grouped rows → Profile name save (persisted via a
real GetMe round-trip) → Language en→et switch (persisted) → Members list/own-row
+ add-by-email 404. Exactly ONE login for the whole file (auth-limiter discipline).

## What shipped

`test.describe.serial("Settings hub (one login)")` with a `beforeAll` that logs in
once on a shared `browser.newPage()` and captures the seeder's original
`full_name` from `/api/users/me`. All four sub-flows reuse that authenticated page
(cookie inherited by both navigation and `page.request`):

1. **Landing (SETT-01)** — `/settings` is the grouped-row index (not a redirect);
   asserts Profile / Language / Members / Data & Storage `<Link>` rows, and that
   clicking Profile navigates to `/settings/profile`.
2. **Profile save (SETT-02)** — edits Full name to a timestamped value, Save
   changes, asserts the `Saved.` sonner toast, **reloads** and asserts the new
   value rehydrated from GetMe, then restores the original name via the UI.
3. **Language (SETT-05)** — drives the native RetroSelect en→et via
   `selectOption({ label: "Eesti" })`, asserts the `Language updated.` toast,
   reloads and asserts the select holds `et`, then reverts to English.
4. **Members (SETT-10)** — asserts the seeder's own row (email + `YOU` badge), then
   the add-by-email form against a unique unregistered address surfaces the
   backend's `No registered user with that email.` (404).

`afterAll` restores name + language via `page.request` as defense-in-depth seed
hygiene (T-12-16), then closes the page.

## Members add/remove approach (decision)

Chose the **deterministic unregistered-email 404 path** over seed-a-second-user +
add + remove. Rationale: the shared dev DB does not guarantee a second known
registered user, so an add+remove pairing would be flaky; the 404 branch exercises
the identical `settingsApi.addMemberByEmail → POST /members {email, role}` contract
(12-01 backend `ErrUserNotRegistered → 404 "no registered user with that email"`)
and leaves zero residue. The enriched READ path (SETT-10) is still proven by the
list row + `YOU` badge assertions. The successful-add + per-row remove branches are
owned by the MembersPage MSW component test (Plan 12-06 Task 1/2).

## Gate results

- **tsc:** `bun run lint:tsc` → clean (`tsc -b --noEmit`, no output).
- **Discovery:** `npx playwright test --list e2e/settings.spec.ts` → **8 tests**
  (4 cases × chromium + firefox). All four cases enumerated.
- **Live sanity (chromium, stack up at :8080 + :5173):**
  `npx playwright test --project=chromium e2e/settings.spec.ts -g "landing|profile|language"`
  → **3 passed (9.3s)**. Landing, profile save+persist, and language switch+persist
  are GREEN against the real stack.

## Live-run note: Members not yet rendered in the base tree

The running dev server serves the v3.0-frontend2-parity base tree, where
`MembersPage` is still the Wave-2/3 stub (`export function MembersPage() { return null; }`)
— **Plan 12-06 (the live MembersPage) is executing in parallel and has not merged.**
A targeted live run of the Members case therefore fails at
`getByText("seeder@test.local")` with "element(s) not found" — the page renders
nothing because there is no UI yet. This is the EXPECTED, documented state, NOT a
spec defect and NOT a live-backend bug (the 12-01 backend members enrich + email-
add is already merged at the base SHA). **No assertions were weakened** to make it
pass. When the orchestrator runs this spec against the merged Wave-3 tree (live
MembersPage present), the Members case exercises the shipped selectors:
`getByPlaceholder(/user@email/i)`, `getByRole("button", { name: /^add$/i })`, the
`YOU` `RetroBadge`, and the `No registered user with that email.` 404 surface.

### Run command for the gate (full spec, merged W3 tree)

```
cd frontend2 && E2E_USER=seeder@test.local E2E_PASS=password123 \
  npx playwright test --project=chromium e2e/settings.spec.ts
```

Single-project pin halves auth-limiter pressure; the live stack (backend :8080 +
Postgres warehouse_dev + Vite :5173 with the /api rewrite) must be up.

## Deviations from Plan

None affecting scope. One documented selector correction discovered against the
shipped pages: the Profile success toast copy is `Saved.` (ProfilePage
`retroToast.success(t\`Saved.\`)`), not "Save changes" — the spec asserts the
real toast text. The plan's `<verify>` command form
(`bun run test:e2e -- --list …`) was satisfied via the equivalent in-plan gate
`npx playwright test --list e2e/settings.spec.ts` (the prompt's mandated gate).

## Live-backend defects

None surfaced. Profile PATCH /users/me, GetMe round-trip, and PATCH
/users/me/preferences {language} all behaved correctly against the real backend
during the live sanity run.

## Self-Check: PASSED
- `frontend2/e2e/settings.spec.ts` — FOUND.
- tsc clean; 8 tests discovered; 3 live cases green; Members case fails only on the
  documented stub (12-06 unmerged), assertions intact.
