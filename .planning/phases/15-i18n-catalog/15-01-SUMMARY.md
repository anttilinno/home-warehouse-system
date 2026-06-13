---
phase: 15-i18n-catalog
plan: 01
subsystem: frontend2 / i18n format layer
tags: [i18n, formatting, hooks, react-query, recharts]
requires:
  - "['me'] query (settingsApi.getMe) — already cached app-wide (Phase 12)"
  - "RegionalFormatsPage persisted preference tokens (date_format/time_format/separators)"
provides:
  - "src/lib/format: useDateFormat/useTimeFormat/useNumberFormat hooks"
  - "src/lib/format: pure formatDateToken/formatTimeToken/formatNumberToken/formatMonthYearToken helpers + DEFAULT_FORMAT_TOKENS"
affects:
  - "Every date/number render site (dashboard activity, notifications, analytics chart axis, item+borrower loan panels, inventory movements, security sessions)"
  - "15-02 grep guard (this is the substrate it enforces)"
tech-stack:
  added: []
  patterns:
    - "Pure token→string core (no React) + thin useMemo hook wrapper reading ['me']"
    - "useMemo keyed on token PRIMITIVES only (render-loop-safe)"
    - "Recharts tickFormatter / pure formatRelativeTime use the PURE helper (cannot call a hook)"
    - "Decorative chrome allowlisted via inline // i18n-format-ignore on the call line"
key-files:
  created:
    - frontend2/src/lib/format/tokens.ts
    - frontend2/src/lib/format/tokens.test.ts
    - frontend2/src/lib/format/hooks.ts
    - frontend2/src/lib/format/index.ts
  modified:
    - frontend2/src/features/dashboard/relativeTime.ts
    - frontend2/src/features/dashboard/relativeTime.test.ts
    - frontend2/src/features/notifications/components/NotificationsDropdown.tsx
    - frontend2/src/features/analytics/components/MonthlyLoanActivityChart.tsx
    - frontend2/src/features/items/components/LoanPanels.tsx
    - frontend2/src/features/loans/components/BorrowerLoanPanels.tsx
    - frontend2/src/features/inventory/components/MovementsPanel.tsx
    - frontend2/src/features/inventory/components/MovementsPanel.test.tsx
    - frontend2/src/features/settings/SecurityPage.tsx
    - frontend2/src/components/layout/Clock.tsx
    - frontend2/src/components/layout/AppShell.tsx
decisions:
  - "formatRelativeTime + monthTick use PURE helpers with DEFAULT tokens (a pure fn / Recharts formatter cannot call a hook)"
  - "UTC decomposition (getUTC*) in tokens.ts, matching MovementsPanel's prior convention — documented in tokens.ts header"
  - "EditLoanDialog/ExtendLoanDialog toISOString().slice are <input type=date> VALUE producers, not display — out of 15-CONTEXT scope, left untouched"
metrics:
  duration: ~9m
  completed: 2026-06-13
---

# Phase 15 Plan 01: I18N-03 Format Hooks Summary

Built the `src/lib/format/` layer — three render-loop-safe React hooks
(`useDateFormat`/`useTimeFormat`/`useNumberFormat`) wrapping pure, unit-tested
token→string helpers — and routed every raw date/number render site listed in
15-CONTEXT through a hook (or, where a hook is impossible, the pure helper),
allowlisting the two decorative clocks. `money.ts` untouched.

## What was built

**Task 1 (TDD) — `tokens.ts` + `tokens.test.ts` + `index.ts`**
Pure functions (no React): `formatDateToken`, `formatTimeToken`,
`formatNumberToken`, plus `formatMonthYearToken` (a small `YYYY-MM` slice the
Recharts axis needs) and `DEFAULT_FORMAT_TOKENS`. Switch logic mirrors
RegionalFormatsPage.tsx:70-101 exactly but operates on a real `new Date(iso)` /
real number. UTC decomposition (`getUTC*`) matches MovementsPanel's prior
convention so timestamps never shift across timezones (documented in the file
header). Invalid ISO / NaN → passthrough, never throws. 22 cases written RED
(import failed), then GREEN.

**Task 2 — `hooks.ts`**
Each hook reads the shared `["me"]` query via
`useQuery({ queryKey: ["me"], queryFn: () => settingsApi.getMe() })`, derives the
token primitive(s) with a `?? DEFAULT_FORMAT_TOKENS.*` fallback (pending/absent →
defaults), and returns a `useMemo`-stable formatter keyed on the **token strings
only** — never `me.data` identity, never a fresh object literal in the deps array
(the recurring 4× render-loop bug).

**Task 3 — route render sites + allowlist clocks**
- `relativeTime.ts`: absolute (≥24h) branch → `formatDateToken` + `formatTimeToken`
  with DEFAULT tokens; removed the `i18n` import. It is a PURE fn (not a
  component) so it cannot call a hook. New shape: `2026-06-12 12:00`.
- `NotificationsDropdown.tsx`, `MovementsPanel.tsx`, `SecurityPage.tsx`,
  `LoanPanels.tsx` (`ActiveLoanPanel` + `LoanHistoryList`),
  `BorrowerLoanPanels.tsx` (`BorrowerLoanHistory`): call `useDateFormat()`
  (+ `useTimeFormat()` where a time component was rendered) at component top;
  removed the hand-rolled `toISOString().slice` / `toLocaleString` /
  `formatTimestamp` helpers.
- `MonthlyLoanActivityChart.tsx` `monthTick`: → pure `formatMonthYearToken`.
  Recharts invokes `tickFormatter` outside React's hook call stack, so it cannot
  call a hook.
- `Clock.tsx` + `AppShell.tsx`: decorative locale-fixed clocks → inline
  `// i18n-format-ignore` on the call line + rationale. Not user data, not routed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MovementsPanel.test.tsx missing QueryClientProvider**
- **Found during:** Task 3 (full `bun run test`)
- **Issue:** Routing `MovementsPanel` through `useDateFormat`/`useTimeFormat` made
  it call `useQuery(["me"])`, which threw `No QueryClient set` in the existing
  test that rendered the panel under only `I18nProvider`.
- **Fix:** Wrapped the test's `wrap()` helper in a `QueryClientProvider` (mirroring
  the project's `ItemAttachmentPanel.test.tsx` pattern). The `["me"]` query never
  resolves in-test → hooks fall back to `DEFAULT_FORMAT_TOKENS`, so the existing
  `"2026-06-13 14:30"` assertion still holds unchanged.
- **Files modified:** frontend2/src/features/inventory/components/MovementsPanel.test.tsx
- **Commit:** 9daf42fb

**2. [Plan-directed test update] relativeTime.test.ts absolute-branch shape**
- The plan explicitly required updating relativeTime's own test for the new
  absolute-branch shape. Tightened the 24h assertion to the deterministic default
  shape `2026-06-12 12:00` and removed the now-pointless `i18n` load/activate in
  `beforeAll` (the fn no longer touches `i18n`).

### Scope notes (left intentionally untouched)

- `EditLoanDialog.tsx` / `ExtendLoanDialog.tsx` still use
  `toISOString().slice(0,10)`. These produce `<input type="date">` VALUES
  (HTML requires `YYYY-MM-DD`), not user-facing display — NOT in 15-CONTEXT's
  render-site list nor this plan's `files_modified`. The 15-02 guard (D-4) targets
  display `.toLocale*(` calls, not date-input value producers. Left for the
  planner's scope.
- `money.ts` / `money.test.ts` unchanged by this plan (the diff-vs-master entries
  for them come from the earlier planner commit cc4e2435, not these commits).

## Authentication Gates

None.

## Known Stubs

None — every routed site renders real data; defaults apply only while `["me"]`
is pending (correct fallback behavior, not a stub).

## Verification (gate, run from frontend2)

```
bun run lint:tsc      → clean (tsc -b --noEmit)
bun run test          → 174 files, 1120 tests passed
bun run build         → Vite build succeeded
bun run lint:imports  → check-forbidden-imports: OK
```

Grep self-check: no untagged display `.toLocale*(` / `toISOString().slice` render
sites remain in `src/features` + `src/components` except the two out-of-scope
date-input value producers (EditLoanDialog/ExtendLoanDialog). Both decorative
clocks carry `// i18n-format-ignore` on the call line.

## Commits

- 628117e7 — test(15-01): pure token formatters + RED/GREEN unit tests
- b759c64c — feat(15-01): render-loop-safe useDateFormat/useTimeFormat/useNumberFormat
- 9daf42fb — feat(15-01): route render sites through format hooks; allowlist clocks

## Self-Check: PASSED

All 4 new format files + the SUMMARY exist on disk; all 3 task commits present in
git log.
