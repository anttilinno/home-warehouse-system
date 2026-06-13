---
phase: 14-system-group
plan: 04
subsystem: ui
tags: [react, react-query, declutter, csv, lingui, retro, formula-injection]

requires:
  - phase: 08-loans
    provides: loanCsv escapeCell + triggerCsvDownload object-URL pattern (mirrored, not imported)
  - phase: 10b-currency
    provides: formatCents null-safe money helper
provides:
  - declutterApi.list/counts/markUsed over /declutter* (items envelope; mark-used by inventory row id)
  - declutterToCsvBlob + triggerCsvDownload — formula-injection-safe CLIENT CSV (no backend export)
  - useDeclutter list hook + useMarkUsed mutation (keyed ["declutter", wsId, groupBy, thresholdDays])
  - DeclutterPage — score-badge analysis table + group_by grouping + CSV export + per-row mark-used
affects: [14-08-route-wiring, declutter-live-e2e]

tech-stack:
  added: []
  patterns:
    - "Client CSV per-feature: copy loanCsv's escapeCell verbatim into a feature-shaped *Csv.ts (single-writer-clean, no cross-import)"
    - "List hook keyed on stable primitives (wsId + groupBy + thresholdDays) so mutation invalidates by [\"declutter\", wsId] prefix"
    - "Contiguous-group sectioning off server-ordered category_name/location_name"

key-files:
  created:
    - frontend2/src/lib/api/declutter.ts
    - frontend2/src/lib/api/declutter.test.ts
    - frontend2/src/features/declutter/declutterCsv.ts
    - frontend2/src/features/declutter/declutterCsv.test.ts
    - frontend2/src/features/declutter/hooks/useDeclutter.ts
    - frontend2/src/features/declutter/hooks/useDeclutter.test.tsx
    - frontend2/src/features/declutter/DeclutterPage.tsx
    - frontend2/src/features/declutter/DeclutterPage.test.tsx
  modified: []

key-decisions:
  - "purchase_price emitted as RAW CENTS in the CSV (round-trip fidelity); the UI renders it via formatCents"
  - "mark-used routes through RetroConfirmDialog (butter/mint, non-destructive) and sends row.id (inventory id), never item_id"
  - "Grouping done client-side off server-ordered rows (server already orders by group key)"

patterns-established:
  - "Per-feature client CSV builder mirroring loanCsv (T-14-10/T-14-11 parity)"
  - "useDeclutter/useMarkUsed query-key family + prefix invalidation"

requirements-completed: [DECL-01, DECL-02]

duration: 18min
completed: 2026-06-13
---

# Phase 14 Plan 04: Declutter (DECL-01/02) Summary

**The /declutter page: an unused-inventory analysis table with a score badge + group_by grouping (DECL-01), a formula-injection-safe client CSV export and a per-row mark-used that invalidates the list (DECL-02). Greenfield declutter api + feature dir.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-13T20:18Z
- **Completed:** 2026-06-13T20:25Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files created:** 8

## Accomplishments
- `declutterApi` — `list(ws, {thresholdDays,groupBy,page,limit})` resolving the BARE `{ items, total }` envelope (rows under `items`, NOT `changes`), `counts(ws)`, and `markUsed(ws, inventoryId)` POSTing `/inventory/{id}/mark-used`.
- `declutterCsv.ts` — `declutterToCsvBlob(rows)` + `triggerCsvDownload`, copying loanCsv's `escapeCell`/`INJECTION_PREFIXES` verbatim (leading `=,+,-,@,\t,\r` → `'` prefix, quotes doubled, cell wrapped). Header-only Blob on empty; raw-cents price for round-trip; null-safe cells.
- `useDeclutter` list hook (re-queries on groupBy/thresholdDays change; disabled without a workspace) + `useMarkUsed` mutation invalidating `["declutter", wsId]`.
- `DeclutterPage` — score-badge table (RetroBadge variant scales danger≥70 / warn≥40 / neutral), group_by RetroSelect with grouped sections, EXPORT CSV (disabled on empty), per-row "Mark used" via RetroConfirmDialog, calm RetroEmptyState. Null-currency price renders via formatCents without white-screening (T-14-12).

## Task Commits

1. **Task 1: declutter api + client CSV + tests** — `c02256bf` (feat; TDD test→impl in one commit)
2. **Task 2: useDeclutter list hook + useMarkUsed mutation + test** — `514524ab` (feat)
3. **Task 3: DeclutterPage — score-badge table + grouping + CSV + mark-used + page test** — `ce8613e7` (feat)

**Plan metadata:** this commit (docs).

## Files Created/Modified
- `frontend2/src/lib/api/declutter.ts` — declutterApi (list/counts/markUsed), DeclutterItem/DeclutterGroupBy/DeclutterCounts types.
- `frontend2/src/lib/api/declutter.test.ts` — URL-shape + items-envelope + mark-used-path (fetch-stub) tests.
- `frontend2/src/features/declutter/declutterCsv.ts` — formula-injection-safe client CSV (mirrors loanCsv).
- `frontend2/src/features/declutter/declutterCsv.test.ts` — escape + header-only + null-safe cell tests.
- `frontend2/src/features/declutter/hooks/useDeclutter.ts` — list hook + mark-used mutation.
- `frontend2/src/features/declutter/hooks/useDeclutter.test.tsx` — MSW + QueryClient hook tests.
- `frontend2/src/features/declutter/DeclutterPage.tsx` — the /declutter page.
- `frontend2/src/features/declutter/DeclutterPage.test.tsx` — render integration tests (score badge, grouping re-query, CSV download spy, mark-used refetch, empty state).

## Selectors for 14-08 wiring + the live E2E spec
- **Page export:** `DeclutterPage` (named export) from `frontend2/src/features/declutter/DeclutterPage.tsx`.
- **Window title:** `DECLUTTER — {workspaceName}`.
- **declutterApi shape:** `declutterApi.list(ws, {thresholdDays?, groupBy?, page?, limit?}) → { items, total }`, `declutterApi.counts(ws)`, `declutterApi.markUsed(ws, inventoryId)`.
- **Query keys:** `["declutter", wsId, groupBy, thresholdDays]` (list); invalidated by `["declutter", wsId]` prefix on mark-used.
- **Controls:** group-by `<select>` (accessible name "Group by", values `none|category|location`); buttons named "EXPORT CSV" and "Mark used"; mark-used confirm is a RetroConfirmDialog (`role="dialog"`) whose confirm button is also "Mark used".

## Decisions Made
- CSV `purchase_price` kept as raw cents (round-trip fidelity); UI display uses formatCents.
- mark-used sends `row.id` (the inventory row id / mark-used path param), explicitly never `item_id` (T-14-13).
- Grouping computed client-side from server-ordered rows.

## Deviations from Plan

None of substance — three minor TDD-cycle test adjustments handled inline (Rule 1):
- `declutter.test.ts`: cast `res` through `unknown` for the `.changes`-absent runtime assertion (tsc TS2352).
- `DeclutterPage.test.tsx`: gave the second fixture row a distinct `days_unused` (365) so `getByText("200")` stays unambiguous (the two default rows otherwise collided).
- `DeclutterPage.tsx`: dropped an unused `isoDate` helper (tsc TS6133) and replaced a `t({ id })` option-label lookup with a `groupLabel(value)` `t`-macro helper for clean lingui extraction.

All within the plan's own files; no scope creep.

## Issues Encountered
None.

## User Setup Required
None — composes existing react-query + @/lib/api + retro atoms; installs NO packages (T-14-SC).

## Next Phase Readiness
- DECL-01/02 feature surface complete and green. Route + Sidebar wiring is Wave 2 (14-08) — this plan deliberately touches NO route/Sidebar file.
- A browser-level declutter spec can bind to the selectors listed above once 14-08 wires `/declutter`.

## Verification
- `bun run lint:tsc` — clean.
- `bun run lint:imports` — OK.
- `bun run test src/lib/api/declutter.test.ts src/features/declutter` — 4 files, 18 tests, all green.

## Self-Check: PASSED
- All 8 created files exist on disk.
- Commits `c02256bf`, `514524ab`, `ce8613e7` present on `exec/14-04`.

---
*Phase: 14-system-group*
*Completed: 2026-06-13*
