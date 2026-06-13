---
phase: 10b-repairs-maintenance
plan: 05
type: execute
wave: 4
depends_on: [10b-03, 10b-04]
files_modified:
  - frontend2/e2e/repairs-maintenance.spec.ts
autonomous: true
requirements: [RPR-01, RPR-02, MNT-01, MNT-02]
must_haves:
  truths:
    - "A live browser flow logs in ONCE and exercises the repair lifecycle create→start→complete with the cost rollup updating"
    - "A live browser flow creates a maintenance schedule, sees it on /maintenance/due, and completes it (row leaves the due list)"
    - "The spec runs against the real backend + Postgres (the CLAUDE.md E2E contract), not MSW"
  artifacts:
    - path: "frontend2/e2e/repairs-maintenance.spec.ts"
      provides: "live Playwright spec for repair lifecycle + maintenance due/complete"
      contains: "repairs-maintenance"
  key_links:
    - from: "frontend2/e2e/repairs-maintenance.spec.ts"
      to: "real /login → InventoryListPage row drawers → /maintenance/due"
      via: "single login (auth limiter), in-plan discovery-list gate, then drive the drawers"
      pattern: "page.goto|getByRole"
---

<objective>
A live Playwright spec covering the two end-to-end happy paths: (A) open an inventory row's Repairs drawer → create a repair → START → COMPLETE → the cost rollup reflects the completed repair; (B) open the Maintenance drawer → create a schedule due now → see it on /maintenance/due → COMPLETE → the row leaves the due list. Runs against the real backend + Postgres per the CLAUDE.md E2E runbook.

Purpose: Browser-level coverage for repairs/maintenance (the phase gate requires it). ONE login to respect the auth rate-limiter; a discovery-list step as an in-plan gate so the spec fails loudly if no inventory entry exists to attach to.
Output: frontend2/e2e/repairs-maintenance.spec.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10b-repairs-maintenance/10b-UI-SPEC.md
@.planning/phases/10b-repairs-maintenance/10b-02-SUMMARY.md
@.planning/phases/10b-repairs-maintenance/10b-03-SUMMARY.md
@.planning/phases/10b-repairs-maintenance/10b-04-SUMMARY.md
@CLAUDE.md

# Templates to mirror EXACTLY (live-spec conventions, single login, real backend):
@frontend2/e2e/loans-lifecycle.spec.ts
@frontend2/e2e/inventory.spec.ts
@frontend2/e2e/login-dashboard.spec.ts
@frontend2/playwright.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: repairs-maintenance.spec.ts (live, single login, two flows)</name>
  <files>frontend2/e2e/repairs-maintenance.spec.ts</files>
  <action>
    Mirror loans-lifecycle.spec.ts conventions: login ONCE in a beforeAll/serial-describe (auth rate-limiter — do NOT log in per test; reuse the storage state / single context so page.request inherits the access_token cookie per the CLAUDE.md auth contract). Use the real backend (:8080) + Vite proxy (:5173) — NO MSW.
    In-plan discovery gate: navigate to /inventory; assert at least one entry row exists (fail loudly with a clear message if the seeded DB has none — the spec depends on a seeded inventory entry; reuse the seeder approach from inventory.spec.ts, optionally seeding one via page.request.post against the real API if the existing specs do so).
    Flow A (RPR-01 + RPR-02): on an inventory row, click the 🔧 REPAIRS action → the Repairs drawer opens (title REPAIRS — {item}). Click ⊕ ADD REPAIR → fill Description + a Cost → SAVE REPAIR. The new repair appears as a Pending row. Click START → pill flips to In progress. Click COMPLETE → (complete dialog) → COMPLETE → pill flips to Completed and actions collapse to DELETE only. Assert the cost-rollup header now reflects the completed repair's cost (formatted currency string, e.g. contains the amount). Clean up (delete the repair) so the spec is re-runnable.
    Flow B (MNT-01 + MNT-02): on an inventory row, click the ⟳ MAINTENANCE action → drawer opens. ⊕ ADD SCHEDULE → fill Title + Interval (days) + a Next due of today (so it is due) → SAVE SCHEDULE. Navigate to /maintenance/due (via the Sidebar Maintenance entry or page.goto) → assert the schedule row appears with item + title. Click COMPLETE → blue confirm → COMPLETE → the row LEAVES the due list (next_due advanced server-side). Clean up (delete the schedule from the drawer) for re-runnability.
    Locator discipline: prefer role/label/text from the UI-SPEC copywriting contract (REPAIRS, ⊕ ADD REPAIR, START, COMPLETE, ⊕ ADD SCHEDULE, DUE MAINTENANCE). Follow the field-verb-prefix loosening note from the recent inventory E2E commits if exact-match is brittle. Tag both flows in one serial describe to share the single login.
  </action>
  <verify>
    <automated>cd frontend2 && E2E_USER=${E2E_USER:-seeder@test.local} E2E_PASS=${E2E_PASS:-password123} bun run test:e2e e2e/repairs-maintenance.spec.ts</automated>
  </verify>
  <done>The live spec passes against the real backend + Postgres: repair create→start→complete updates the cost rollup; schedule create→due→complete removes the row from /maintenance/due. Single login (no rate-limit trip). Re-runnable (cleans up its fixtures).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Playwright browser → live backend | real cookie-JWT auth + real DB writes during the spec |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-11 | DoS | auth rate-limiter trip from multiple logins | mitigate | single login in a serial describe; reuse context/storage state (CLAUDE.md constraint) |
| T-10b-12 | Tampering | test pollutes the seeded DB | accept | spec cleans up its created repair + schedule for re-runnability; dev DB is disposable |
| T-10b-SC | Tampering | npm/pip/cargo installs | mitigate | none — no packages installed (Playwright already in devDeps) |
</threat_model>

<verification>
- `bun run test:e2e e2e/repairs-maintenance.spec.ts` green against the real stack.
- Single login; spec re-runnable.
</verification>

<success_criteria>
- Repair lifecycle (create→start→complete→cost rollup) verified in a real browser.
- Maintenance schedule create→/maintenance/due→complete (row leaves) verified in a real browser.
</success_criteria>

<output>
Create `.planning/phases/10b-repairs-maintenance/10b-05-SUMMARY.md` when done.
</output>
