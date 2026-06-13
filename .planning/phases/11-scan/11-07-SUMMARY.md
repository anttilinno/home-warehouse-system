---
phase: 11-scan
plan: 07
subsystem: frontend2/scan
tags: [scan, claim, create-entity, parity-port, scan-12]
requires: ["11-02"]            # itemsApi.lookupByBarcode, retro atoms barrel
provides:
  - "features/scan/ClaimPage.tsx (export: ClaimPage)"
affects:
  - "11-06 routes/index.tsx (must import ClaimPage and register /claim/:code under RequireAuth)"
tech-stack:
  added: []                    # no new deps; frozen install held
  patterns:
    - "Declarative <Navigate replace> for MATCH → /items/:id (claim URL replaced, not pushed)"
    - "encodeURIComponent the user-controlled :code AGAIN in the /items/new?barcode= link (Pitfall 5 / T-11-11)"
    - "Anchor (<Link>) styled as a bevel button — NOT button-in-anchor — so role=link is exposed"
    - "Lookup error → persistent retroToast.error + in-page role=alert danger banner (ItemFormPage root-error idiom)"
key-files:
  created:
    - frontend2/src/features/scan/ClaimPage.tsx
    - frontend2/src/features/scan/ClaimPage.test.tsx
  modified: []
decisions:
  - "SCAN-12 implemented as PORT LEGACY create-entity per binding override 9 (USER DECISION): NO new backend, NO claim-as-loan, NO resolve endpoint."
  - "MATCH routes via <Navigate to=/items/:id replace> rather than rendering an inline item summary + VIEW ITEM action — the plan allowed either; navigate is the simpler parity behavior."
  - "Create CTA + Back-to-scan rendered as styled <Link> anchors (role=link), not <button> wrapped in <Link> (invalid HTML, hides link role)."
  - "RetroEmptyState 'CODE NOT FOUND' is the UI-SPEC fallback affordance and the sole BACK TO SCAN button in the UNRESOLVABLE state (avoids duplicate-accessible-name collisions)."
metrics:
  duration: ~12m
  completed: 2026-06-13
---

# Phase 11 Plan 07: /claim/:code Claim Flow (Port Legacy Create-Entity) Summary

The `/claim/:code` page component — a parity port of the shipped legacy create-ENTITY
claim flow (SCAN-12). It reads `:code`, resolves it via the existing
`itemsApi.lookupByBarcode`, and routes a MATCH to the matched item or offers
create-item-with-this-barcode on a 404. No new backend route, no claim-as-loan, no
resolve endpoint (binding override 9 / USER DECISION).

## What was built

- **ClaimPage.tsx** — `export function ClaimPage()` at `frontend2/src/features/scan/`.
  - `useParams<{ code }>()` → react-router-decoded `:code`.
  - `useQuery(["item-by-barcode", currentWorkspaceId, code])` → `itemsApi.lookupByBarcode(wsId, code)`
    (enabled only once `currentWorkspaceId` and `code` are present).
  - **RESOLVING** state: the retro stepped-progress idiom (`.retro-progress`, `role="status"`,
    `aria-busy`) with the raw code echoed in a mono line. Shown while the workspace settles
    OR the lookup is pending/fetching.
  - **RESOLVED (MATCH)**: `<Navigate to={`/items/${item.id}`} replace />` — routes straight
    to the item detail, replacing the claim URL in history.
  - **UNRESOLVABLE (404 / null)**: a mint `Window` offering a `CREATE ITEM WITH THIS CODE`
    link → `/items/new?barcode=${encodeURIComponent(code)}`, plus a `RetroEmptyState`
    (`◎ CODE NOT FOUND` / `BACK TO SCAN` → `/scan`) per UI-SPEC § Feedback Family.
  - **ERROR**: `useEffect` fires a persistent `retroToast.error` AND renders an in-page
    `role="alert"` danger banner (the ItemFormPage root-error idiom) with a BACK TO SCAN link.
- **ClaimPage.test.tsx** — MemoryRouter at `/claim/<encoded-code>` + MSW handler for
  `GET /api/workspaces/:wsId/items/by-barcode/:code`. 6 tests, all green:
  RESOLVING state; MATCH → navigates to `/items/:id`; 404 → CREATE link with encoded
  `?barcode=`; 404 → CODE NOT FOUND empty state + BACK TO SCAN navigates `/scan`;
  encoding guard (`../etc`-style code never leaks a raw `/etc` into the create URL);
  500 → role=alert banner + toast.

## Route expectation (for 11-06 — single-writer routes/index.tsx)

11-06 must wire the route exactly as:

```tsx
import { ClaimPage } from "@/features/scan/ClaimPage";
// …inside the RequireAuth / AppShell branch:
<Route path="/claim/:code" element={<ClaimPage />} />
```

- The route MUST live under the existing `RequireAuth` branch (the same one wrapping the
  other authed routes). ClaimPage does NOT re-implement auth (T-11-12 — login gating is the
  route's responsibility; unauth → bounced to `/login?next=` by the existing RequireAuth contract).
- ClaimPage relies on routes for `/items/:id`, `/items/new` (reads `?barcode=`), and `/scan`,
  all of which already exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Verify command script name mismatch**
- **Found during:** final gate.
- **Issue:** The plan's `<verification>` calls `bun run typecheck`, but `package.json` has no
  `typecheck` script — the typecheck script is `lint:tsc` (`tsc -b --noEmit`), as already
  noted in the 11-02 SUMMARY.
- **Fix:** Ran `bun run lint:tsc` for the typecheck gate. No source change.

**2. [Rule 1 - Test correctness] Unencoded slash in test route path**
- **Found during:** Task 1 GREEN.
- **Issue:** The test built `initialEntries={[`/claim/${code}`]}` with a raw `AB/CD 12` code;
  the unencoded slash split the route so `:code` never matched and the page didn't render.
- **Fix:** The test now `encodeURIComponent`s the code into the initial path, exactly as a
  real browser address bar would deliver it; react-router then decodes the param so the
  component receives the original `AB/CD 12`. This also faithfully exercises the
  double-encode guard (decoded param re-encoded into the create link). No source change to
  ClaimPage.

### Intentional design choices (not bugs)

- MATCH uses `<Navigate replace>` rather than an inline item summary + VIEW ITEM action.
  The plan's `<action>` explicitly allowed either ("navigate to /items/:id OR render the
  item with a VIEW ITEM action"); navigate is the simpler, parity-true path.
- QuickActionMenu (11-05) was NOT reused for MATCH — the plan listed it as optional
  ("if a richer surface is desired"). 11-05 files are off-limits to this plan anyway, and a
  direct navigate satisfies the success criteria.
- Create + Back-to-scan affordances are styled `<Link>` anchors, not `<button>`s wrapped in
  `<Link>` (which is invalid HTML and would hide `role="link"`). The test asserts
  `role="link"` for the create CTA, which this satisfies.

## Threat mitigations applied

- **T-11-11 (tampering — :code in lookup + create link):** `lookupByBarcode` encodeURIComponents
  the code for the lookup path; ClaimPage encodeURIComponents it AGAIN in the
  `/items/new?barcode=` link. Test asserts a `../etc`-style code is encoded (no raw `/etc`
  leaks into the create URL) and that `AB/CD 12` → `?barcode=AB%2FCD%2012`.
- **T-11-12 (EoP — unauth /claim/:code):** ClaimPage is pure authed content; gating is the
  route's job (11-06 registers it under RequireAuth). ClaimPage adds no auth bypass.

## Verification

- `bun install --frozen-lockfile` — clean (lockfile owned by 11-01; no drift).
- `bun run lint:tsc` — green (exit 0, no errors).
- `bun run lint:imports` — OK (no forbidden imports introduced).
- `bun run test src/features/scan/ClaimPage.test.tsx` — **1 file / 6 tests passed.**
- Plan `<verify>` greps: `lookupByBarcode` present, `encodeURIComponent` present.

## Known Stubs

None — ClaimPage wires to the real `itemsApi.lookupByBarcode` and real routes. No placeholder
data, no empty-return stubs, no claim-as-loan / resolve-endpoint scaffolding (deliberately
omitted per binding override 9).

## TDD Gate Compliance

Task is `tdd="true"`. RED was confirmed (test failed to import the absent ClaimPage) before
GREEN. Per the orchestrator's single-commit instruction for this plan, test + implementation
are committed together in one `feat(11-07)` commit rather than split RED/GREEN commits —
flagged here for transparency. The test is present and green.

## Self-Check: PASSED

Both source/test files + this SUMMARY exist on disk; tsc + lint:imports + the 6-test suite
are green. Commit hash recorded in the executor return.
