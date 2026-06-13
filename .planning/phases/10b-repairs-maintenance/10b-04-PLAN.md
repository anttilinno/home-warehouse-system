---
phase: 10b-repairs-maintenance
plan: 04
type: execute
wave: 3
depends_on: [10b-02]
files_modified:
  - frontend2/src/features/maintenance/hooks/useMaintenanceQuery.ts
  - frontend2/src/features/maintenance/hooks/useMaintenanceMutations.ts
  - frontend2/src/features/maintenance/hooks/useMaintenanceMutations.test.tsx
  - frontend2/src/features/maintenance/components/MaintenanceDrawer.tsx
  - frontend2/src/features/maintenance/components/MaintenanceDrawer.test.tsx
  - frontend2/src/features/maintenance/components/MaintenanceForm.tsx
  - frontend2/src/features/maintenance/components/CompleteMaintenanceDialog.tsx
  - frontend2/src/features/maintenance/MaintenanceDuePage.tsx
  - frontend2/src/features/maintenance/MaintenanceDuePage.test.tsx
  - frontend2/src/routes/index.tsx
  - frontend2/src/components/layout/Sidebar.tsx
  - frontend2/src/features/inventory/InventoryListPage.tsx
otmf_note: "SINGLE-WRITER files: routes/index.tsx + Sidebar.tsx (the /maintenance/due route + nav) and InventoryListPage.tsx (the MAINTENANCE row trigger). This plan is their sole W3 writer; InventoryListPage was last written by Plan 10b-02 in W2 (serial — different wave). Disjoint from Plan 10b-03 (repairs/photos/attachments) in the same wave."
autonomous: true
requirements: [MNT-01, MNT-02, MNT-03]
must_haves:
  truths:
    - "User opens a Maintenance drawer from a per-inventory-row MAINTENANCE action and can create/edit/delete/complete schedules"
    - "Completing a schedule advances next_due server-side; the UI calls + invalidates (no client date math)"
    - "/maintenance/due lists schedules with the server is_overdue flag driving a 3-cue overdue treatment"
    - "useMaintenanceDueQuery ships as the Phase-13 dashboard feed hook"
    - "complete-maintenance invalidates BOTH maintenance and repairs caches (server wrote a repair-log row)"
  artifacts:
    - path: "frontend2/src/features/maintenance/components/MaintenanceDrawer.tsx"
      provides: "blue RetroDialog drawer for per-inventory schedules"
      min_lines: 50
      contains: "MaintenanceDrawer"
    - path: "frontend2/src/features/maintenance/MaintenanceDuePage.tsx"
      provides: "/maintenance/due page (mint window, RetroTable, is_overdue cues)"
      contains: "MaintenanceDuePage"
    - path: "frontend2/src/features/maintenance/hooks/useMaintenanceQuery.ts"
      provides: "useSchedulesByInventoryQuery + useMaintenanceDueQuery (Phase-13 feed)"
      contains: "useMaintenanceDueQuery"
    - path: "frontend2/src/features/maintenance/components/CompleteMaintenanceDialog.tsx"
      provides: "blue one-tap complete confirm"
      contains: "CompleteMaintenanceDialog"
  key_links:
    - from: "frontend2/src/routes/index.tsx"
      to: "MaintenanceDuePage at /maintenance/due"
      via: "<Route path=\"maintenance/due\" element={<MaintenanceDuePage />} />"
      pattern: "maintenance/due"
    - from: "frontend2/src/components/layout/Sidebar.tsx"
      to: "/maintenance/due nav entry"
      via: "NavItem to=/maintenance/due in the Inventory group"
      pattern: "maintenance/due|Maintenance"
    - from: "frontend2/src/features/inventory/InventoryListPage.tsx"
      to: "MaintenanceDrawer (maintenanceId state + per-row trigger)"
      via: "useState maintenanceId + BevelButton + <MaintenanceDrawer invId={maintenanceId}>"
      pattern: "MaintenanceDrawer"
    - from: "frontend2/src/features/maintenance/hooks/useMaintenanceMutations.ts"
      to: "invalidate [maintenance,wsId] AND [repairs,wsId] on complete"
      via: "invalidateQueries (server wrote a repair-log row)"
      pattern: "repairs.*wsId|\\[\"repairs\""
---

<objective>
Maintenance (MNT-01/02/03): the per-inventory-row Maintenance drawer (schedule CRUD + one-tap complete that advances next_due server-side), the standalone /maintenance/due page (server is_overdue cues), and the useMaintenanceDueQuery hook that Phase 13 mounts as the dashboard due-soon card. This plan OWNS the routes/index.tsx + Sidebar.tsx single-writer edits and the InventoryListPage MAINTENANCE trigger.

Purpose: Closes the maintenance half of the phase. Honors overrides #3 (server is_overdue, no date math), #7 (complete invalidates repairs too), #9 (routes/Sidebar single-writer).
Output: query+mutation hooks, MaintenanceDrawer, MaintenanceForm, CompleteMaintenanceDialog, MaintenanceDuePage, route + nav, and the InventoryListPage MAINTENANCE trigger.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10b-repairs-maintenance/10b-RESEARCH.md
@.planning/phases/10b-repairs-maintenance/10b-UI-SPEC.md
@.planning/phases/10b-repairs-maintenance/10b-01-SUMMARY.md
@.planning/phases/10b-repairs-maintenance/10b-02-SUMMARY.md

# Templates to mirror EXACTLY:
@frontend2/src/features/inventory/components/MovementsDrawer.tsx
@frontend2/src/features/loans/hooks/useLoanMutations.ts
@frontend2/src/features/loans/LoansListPage.tsx
@frontend2/src/features/loans/loanStatus.ts
@frontend2/src/routes/index.tsx
@frontend2/src/components/layout/Sidebar.tsx
@frontend2/src/features/inventory/InventoryListPage.tsx

<interfaces>
<!-- From 10b-01. Import, do not re-derive. -->
maintenanceApi (lib/api/maintenance.ts): list, byInventory, due, get, create, update, complete, del
Types: MaintenanceSchedule, DueSchedule (schedule + item_id, item_name, is_overdue)
maintenanceSchema + inferred type (features/maintenance/schema.ts)

Query keys (LOCKED): ["maintenance", wsId, "by-inventory", invId]; ["maintenance", wsId, "due", days];
  ["maintenance", wsId, id]; ["maintenance", wsId, { page, limit }]. All under prefix ["maintenance", wsId].

routes/index.tsx edit (OQ8 — EXACT): import MaintenanceDuePage; inside the AppShell layout route add
  <Route path="maintenance/due" element={<MaintenanceDuePage />} />  (literal route; place beside other feature routes).
  NO /maintenance index page this phase (OQ8 — drawers + due cover it).

Sidebar.tsx edit (OQ8 — EXACT): add one NavItem to the Inventory group (after Inventory, before Locations),
  glyph "⊞" (fallback ◇), label <Trans>Maintenance</Trans>, to="/maintenance/due"; NO count (stats has none).

InventoryListPage edit (single-writer, serial after 10b-02's W2 edit): add `const [maintenanceId, setMaintenanceId] = useState<string | null>(null);` beside repairsId; add a "⟳" MAINTENANCE BevelButton in the actions cluster (non-archived rows) onClick setMaintenanceId(entry.id), aria-label MAINTENANCE; mount <MaintenanceDrawer invId={maintenanceId} itemName={...resolved from entries...} onClose={() => setMaintenanceId(null)} /> after the RepairsDrawer mount. Import MaintenanceDrawer.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: maintenance hooks + MaintenanceDrawer + forms</name>
  <files>frontend2/src/features/maintenance/hooks/useMaintenanceQuery.ts, frontend2/src/features/maintenance/hooks/useMaintenanceMutations.ts, frontend2/src/features/maintenance/hooks/useMaintenanceMutations.test.tsx, frontend2/src/features/maintenance/components/MaintenanceDrawer.tsx, frontend2/src/features/maintenance/components/MaintenanceForm.tsx, frontend2/src/features/maintenance/components/CompleteMaintenanceDialog.tsx, frontend2/src/features/maintenance/components/MaintenanceDrawer.test.tsx</files>
  <behavior>
    useMaintenanceMutations.test.tsx (server.use(...maintenanceHandlers)):
    - createSchedule / updateSchedule / deleteSchedule invalidate ["maintenance", wsId]
    - completeSchedule calls maintenanceApi.complete AND invalidates BOTH ["maintenance", wsId] and ["repairs", wsId] (override #7 — server wrote a repair-log row)
    - on error optimistic changes revert + retroToast.error
    MaintenanceDrawer.test.tsx:
    - opens when invId non-null, titled "MAINTENANCE — {item}"
    - renders schedule rows (title, every Nd, Next due, Last done|never) with COMPLETE/EDIT/DELETE actions
    - the drawer renders next_due as a NEUTRAL date (no is_overdue cue — the per-inventory endpoint has no flag; NO client date math)
    - ADD SCHEDULE opens MaintenanceForm; COMPLETE opens CompleteMaintenanceDialog
    - empty fixture → "NO SCHEDULES"
  </behavior>
  <action>
    useMaintenanceQuery.ts: export useSchedulesByInventoryQuery(invId) keyed ["maintenance", wsId, "by-inventory", invId]; useMaintenanceDueQuery(days?) keyed ["maintenance", wsId, "due", days] calling maintenanceApi.due (THIS is the Phase-13 feed hook — MNT-03); optionally useMaintenanceListQuery for completeness (cap limit 100).
    useMaintenanceMutations.ts: mirror useLoanMutations — prefix ["maintenance", wsId]; create/update/del/complete; completeSchedule invalidates BOTH ["maintenance", wsId] AND ["repairs", wsId] (override #7 / Pitfall 8). No client date math anywhere. Render-loop guard (Pitfall 6).
    MaintenanceDrawer.tsx: blue RetroDialog (mirror MovementsDrawer) title `MAINTENANCE — {item}`; `⊕ ADD SCHEDULE` mint button; schedule rows per UI-SPEC §4 (title + `every {interval_days}d`; line2 `Next due {next_due}` neutral mono + `Last done {last_completed_at or never}`; actions COMPLETE/EDIT/DELETE). NO is_overdue in the drawer (override #3). Loading/error verbatim.
    MaintenanceForm.tsx: blue RetroDialog nested over the drawer, RHF+zod via maintenanceSchema; fields Title* / Interval (days)* (number min 1) / Next due* (date) / Notes (UI-SPEC §4 verbatim). Dirty-close → butter DISCARD CHANGES?. Submit create/edit → maintenanceApi.
    CompleteMaintenanceDialog.tsx: blue RetroConfirmDialog (completion is positive, not destructive — R8), title COMPLETE MAINTENANCE?, body `Mark "{title}" done? This advances the next due date by {interval_days} days.`, one-tap (no notes input — R16), confirm COMPLETE / cancel CANCEL. Submit → completeSchedule(id) (server advances next_due + writes repair-log row). Success toast `DONE · Marked done — next due {new next_due}.`
    Delete → pink RetroConfirmDialog → maintenanceApi.del.
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/maintenance/hooks/useMaintenanceMutations.test.tsx src/features/maintenance/components/MaintenanceDrawer.test.tsx</automated>
  </verify>
  <done>Mutation + drawer tests green incl. the dual repairs+maintenance invalidate on complete and the no-overdue-in-drawer assertion.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: MaintenanceDuePage (server is_overdue, 3 cues)</name>
  <files>frontend2/src/features/maintenance/MaintenanceDuePage.tsx, frontend2/src/features/maintenance/MaintenanceDuePage.test.tsx</files>
  <behavior>
    MaintenanceDuePage.test.tsx (server.use(...maintenanceHandlers); due fixture has one is_overdue:true + one is_overdue:false row):
    - renders a RetroTable with columns Item / Schedule / Next due / Status (+ actions)
    - an is_overdue:true row carries ALL THREE cues: row tint (bg-danger-bg), a danger "Overdue" StatusPill, and a ⚠-prefixed next-due chip
    - an is_overdue:false row renders a neutral mono next_due + an ok "Due" pill (NO ⚠, no tint)
    - NO client date comparison drives the cue (the flag does) — assert by flipping ONLY is_overdue in a fixture and observing the cue follow the flag, not the date
    - COMPLETE on a row calls maintenanceApi.complete; on success the row leaves the list
    - empty fixture → "NOTHING DUE" empty state (no action)
  </behavior>
  <action>
    MaintenanceDuePage.tsx: a Window (mint titlebar — inventory-family list) titled `DUE MAINTENANCE — {workspace}`, data via useMaintenanceDueQuery(). RetroTable columns per UI-SPEC §5: Item (item_name), Schedule (title), Next due (mono OR danger `⚠ {next_due}` chip when is_overdue), Status (danger "Overdue" when is_overdue else ok "Due"), actions COMPLETE. Overdue rows get the THREE cues (row tint + Overdue pill word + ⚠ chip — override #3, AA discipline; NEVER client next_due<now math). COMPLETE → CompleteMaintenanceDialog flow (reuse from Task 1) → on success the row leaves the due list; invalidate ["maintenance", wsId] prefix. Empty → RetroEmptyState NOTHING DUE (no action). Loading/error idiom. RetroPagination only if the due endpoint paginates (F3 — render only when total_pages > 1).
  </action>
  <verify>
    <automated>cd frontend2 && bun run test src/features/maintenance/MaintenanceDuePage.test.tsx</automated>
  </verify>
  <done>Due-page test green: 3 overdue cues driven by the server flag (not dates), COMPLETE removes the row, empty state shows NOTHING DUE.</done>
</task>

<task type="auto">
  <name>Task 3: wire route + sidebar nav + InventoryListPage MAINTENANCE trigger (single-writers)</name>
  <files>frontend2/src/routes/index.tsx, frontend2/src/components/layout/Sidebar.tsx, frontend2/src/features/inventory/InventoryListPage.tsx</files>
  <action>
    routes/index.tsx (SINGLE-WRITER, sole W3 writer): import MaintenanceDuePage; add `<Route path="maintenance/due" element={<MaintenanceDuePage />} />` inside the AppShell layout route beside the other feature routes (OQ8). No /maintenance index route.
    Sidebar.tsx (SINGLE-WRITER): add one NavItem to the Inventory group (after Inventory, before Locations), glyph "⊞", label <Trans>Maintenance</Trans>, to="/maintenance/due". No count. Match the shipped NavItem treatment verbatim.
    InventoryListPage.tsx (SINGLE-WRITER; serial after Plan 10b-02's W2 edit): add `maintenanceId` state beside repairsId; add a "⟳" MAINTENANCE BevelButton in the actions cluster (non-archived rows) onClick setMaintenanceId(entry.id) aria-label MAINTENANCE; mount <MaintenanceDrawer> after <RepairsDrawer> driven by maintenanceId, resolving itemName from entries. Import MaintenanceDrawer. Keep diffs minimal; do not disturb the repairs trigger added by 10b-02.
  </action>
  <verify>
    <automated>cd frontend2 && bunx tsc --noEmit && grep -c "maintenance/due" src/routes/index.tsx && grep -c "MaintenanceDrawer" src/features/inventory/InventoryListPage.tsx && bun run test src/features/inventory/InventoryListPage.test.tsx 2>/dev/null || true</automated>
  </verify>
  <done>tsc clean; /maintenance/due route registered; Sidebar shows Maintenance; InventoryListPage mounts MaintenanceDrawer + renders the MAINTENANCE trigger (alongside the existing REPAIRS trigger); inventory tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frontend → backend API | schedule CRUD + complete cross here; next_due + is_overdue server-computed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10b-08 | Tampering | client-derived overdue / next_due | mitigate | overdue = server is_overdue flag only; next_due advanced by POST complete; zero client date math (override #3, the loans lesson) |
| T-10b-09 | Information disclosure | stale repair list after maintenance complete | mitigate | completeSchedule invalidates ["repairs", wsId] too (server wrote a repair-log row — Pitfall 8) |
| T-10b-10 | DoS | maintenance list limit > 100 | mitigate | maintenanceApi caps limit at 100 (Pitfall 4) |
| T-10b-SC | Tampering | npm/pip/cargo installs | mitigate | none — no packages installed (RESEARCH audit: nothing to vet) |
</threat_model>

<verification>
- tsc clean; full `bun run test src/features/maintenance` green.
- /maintenance/due route + Sidebar Maintenance entry present.
- InventoryListPage renders BOTH the REPAIRS (10b-02) and MAINTENANCE (this plan) triggers; inventory tests green.
- Overdue cues follow the server flag, not dates (asserted).
</verification>

<success_criteria>
- MNT-01: schedule CRUD from the per-row Maintenance drawer.
- MNT-02: /maintenance/due lists schedules with server-driven 3-cue overdue treatment; COMPLETE advances next_due server-side.
- MNT-03: useMaintenanceDueQuery shipped as the Phase-13 dashboard feed hook.
</success_criteria>

<output>
Create `.planning/phases/10b-repairs-maintenance/10b-04-SUMMARY.md` when done.
</output>
