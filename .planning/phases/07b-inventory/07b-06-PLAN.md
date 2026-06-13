---
phase: 07b-inventory
plan: 06
type: execute
wave: 4
depends_on: ["07b-02", "07b-03", "07b-04", "07b-05"]
files_modified:
  - frontend2/e2e/inventory.spec.ts
autonomous: true
requirements: [INV-01, INV-04, INV-07]
must_haves:
  truths:
    - "A live browser run creates an inventory entry, sees it in the /inventory list, moves it to another location, and observes the move recorded in the movements drawer"
    - "The spec runs against the real dev stack via the cookie-JWT /login boundary"
  artifacts:
    - path: "frontend2/e2e/inventory.spec.ts"
      provides: "Live create → list → move → movements lifecycle E2E"
      min_lines: 60
  key_links:
    - from: "frontend2/e2e/inventory.spec.ts"
      to: "live backend :8080 via /api proxy"
      via: "page.request cookie-authed seeding + UI navigation"
      pattern: "page.request"
---

<objective>
Add the live phase-gate E2E (INV-01/04/07): create an inventory entry, see it listed, move it, and confirm the movement is recorded. This is the browser-level coverage the MSW unit layer cannot reach — it proves the create→list→move→movements lifecycle through the cookie-JWT boundary and the /api proxy, and specifically that a movement record only appears AFTER a move (07b-RESEARCH Pitfall 3).

Purpose: prevent a silent regression of the whole inventory write path; guard the movements-on-move-only semantic.
Output: `frontend2/e2e/inventory.spec.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/07b-inventory/07b-RESEARCH.md
@.planning/phases/07b-inventory/07b-UI-SPEC.md
@frontend2/e2e/items.spec.ts
@frontend2/e2e/login-dashboard.spec.ts

<interfaces>
<!-- Auth contract (CLAUDE.md §E2E + items.spec.ts): -->
loginAsSeeder: page.goto("/login"); fill Email/Password (E2E_USER default seeder@test.local, E2E_PASS default password123); click button name /^log in$/i; expect URL "/".
firstWorkspaceId: page.request.get("/api/users/me/workspaces") → first id. page.request inherits the access_token cookie (no token plumbing).
The dev stack must be UP (no webServer auto-launch): backend :8080 + Postgres warehouse_dev + Vite :5173.

<!-- The phase contract for the lifecycle (07b-RESEARCH Pitfall 3): -->
Movements start EMPTY (live workspace returns 0). A movement record is created ONLY by POST /inventory/{id}/move. So the spec MUST perform a move before asserting a movement appears.

<!-- Seeding endpoints (cookie-authed page.request): -->
Need an item + a location (and a second location to move to). Reuse/create via page.request.post("/api/workspaces/{wsId}/items", ...), "/locations", and "/inventory" (body: item_id, location_id, quantity≥1, condition, status). Then drive the UI: /inventory list shows the entry → row MOVE → pick the second location → MOVE → open the entry's movements drawer → assert a row.
</interfaces>

In-plan gate: `npx playwright test --list` must succeed (the spec is syntactically valid + discovered) even when the live stack is down. The full live run is the phase gate per 07b-VALIDATION; CI default path stays fast (Playwright is a separate lane).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Live inventory lifecycle E2E spec</name>
  <files>frontend2/e2e/inventory.spec.ts</files>
  <action>Create `e2e/inventory.spec.ts` mirroring `e2e/items.spec.ts`: import from @playwright/test, define `E2E_USER`/`E2E_PASS` env defaults, and the shared `loginAsSeeder(page)` + `firstWorkspaceId(page)` helpers (copy the verbatim auth contract — exact-match /^log in$/i submit, page.request cookie inheritance). One test: (1) login + get wsId; (2) seed prerequisites via cookie-authed page.request — ensure an item exists (POST /items with a unique `E2E-${Date.now()}` name + sku), two locations exist (POST /locations, capture both ids), and create one inventory entry (POST /inventory with the item id, the FIRST location id, quantity 1, a condition + status from the enums); (3) navigate to /inventory and assert the entry's item name is visible in the list; (4) trigger the row MOVE action, select the SECOND location in the move dialog, click MOVE, and wait for the success state; (5) open that entry's movements drawer and assert at least one movement row is present (the move just created the first one — proving Pitfall 3's move-only semantic). Use locale-agnostic locators where copy may be translated (e.g. role/name regexes). Cleanup is best-effort in a finally (archive the entry; leaked rows are acceptable since names are unique per run — mirror items.spec.ts T-07-20 rationale). Add a short header comment documenting the move-before-movements requirement and the live-stack prerequisite.</action>
  <verify>
    <automated>cd frontend2 && npx playwright test --list e2e/inventory.spec.ts</automated>
  </verify>
  <done>Spec discovered by Playwright (--list succeeds); the test body covers create → list → move → movements with cookie-authed seeding and a move performed before the movement assertion.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Playwright browser → /login cookie-JWT → /api proxy → backend | the E2E exercises the real auth + tenancy boundary end-to-end |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07b-13 | Tampering | E2E test data on the shared dev DB | accept | Unique per-run names (`E2E-${Date.now()}`) prevent collisions; best-effort cleanup in finally. A leaked archived row is acceptable (mirrors items.spec.ts). No production data touched (dev stack only). |
| T-07b-14 | Information disclosure | seeder credentials in spec | mitigate | Credentials come from env (E2E_USER/E2E_PASS) with dev-only defaults; no real secret hard-coded (matches the shipped items.spec.ts pattern). |
</threat_model>

<verification>
- `npx playwright test --list e2e/inventory.spec.ts` succeeds.
- Live phase gate (manual / when stack up, per 07b-VALIDATION): `E2E_USER=seeder@test.local E2E_PASS=password123 bun run test:e2e e2e/inventory.spec.ts` green on chromium + firefox.
- Grep gate: `grep -c 'page.request' frontend2/e2e/inventory.spec.ts` returns ≥1 (cookie-authed seeding present).
</verification>

<success_criteria>
A live, discoverable Playwright spec proves the full inventory lifecycle — entry creation, list visibility, a whole-entry move, and the movement record appearing only after the move — through the real cookie-JWT + /api proxy boundary.
</success_criteria>

<output>
Create `.planning/phases/07b-inventory/07b-06-SUMMARY.md` when done
</output>
