---
phase: 08-loans
plan: 02
subsystem: frontend2/loans
tags: [loans, list-page, retro-tabs, csv-export, sidebar]
requires:
  - "08-01: loansApi.active/overdue/list, loanStatus, loanCsv, MSW loanHandlers"
provides:
  - "LoansListPage — /loans tabbed list surface (LOAN-01)"
  - "useLoansQuery — tab→endpoint selector keyed [\"loans\", wsId, tab]"
  - "LoanRowActions — stable exported stub (Plan 04 overwrites body)"
  - "/loans route + Sidebar Loans link"
affects:
  - "frontend2/src/routes/index.tsx (single-writer this wave)"
  - "frontend2/src/components/layout/Sidebar.tsx (Loans NavItem enabled)"
tech-stack:
  added: []
  patterns:
    - "InventoryListPage render-loop guard (tRef + stable shortcut deps)"
    - "URL-driven RetroTabs (?tab=) with client-side search"
    - "client-generated per-tab CSV (no backend export)"
key-files:
  created:
    - frontend2/src/features/loans/hooks/useLoansQuery.ts
    - frontend2/src/features/loans/LoansListPage.tsx
    - frontend2/src/features/loans/LoansListPage.test.tsx
    - frontend2/src/features/loans/components/LoanRowActions.tsx
  modified:
    - frontend2/src/routes/index.tsx
    - frontend2/src/components/layout/Sidebar.tsx
decisions:
  - "FilterBar has no facets for loans — empty facets[] + empty chips; search is the only client filter"
  - "EXPORT CSV + NEW LOAN both ride the FilterBar primaryAction slot (single slot → fragment)"
  - "All three tabs share one tableContent node; useLoansQuery keys on the active tab so only the mounted panel fetches"
metrics:
  duration: "~18m"
  completed: "2026-06-13"
  tasks: 3
  files: 6
---

# Phase 8 Plan 02: /loans Tabbed List Page Summary

Built the `/loans` browsing surface (LOAN-01): a mint-titled Window with
URL-driven RetroTabs (Active / Overdue / History, `?tab=`, default active), a
RetroTable of item / borrower / loaned / due / status rows, three non-color
overdue cues, per-tab client-generated CSV export, the Sidebar `/loans` link,
and a stable `LoanRowActions` stub seam for Plan 04.

## What was built

- **useLoansQuery** (`hooks/useLoansQuery.ts`) — reads `?tab=` (default + unknown
  → `active`), maps `overdue`→`loansApi.overdue`, `history`→`loansApi.list`, else
  `loansApi.active`. Key `["loans", wsId, tab]` (under the SSE-invalidation prefix,
  no `exact:true`). History client-filters the bare list to `!is_active`
  (override 4 — no `/loans/returned` endpoint). Reads no pagination metadata
  (Pitfall 3 — bare `{items}` envelope). `enabled: Boolean(wsId)`.
- **LoansListPage** (`LoansListPage.tsx`) — mirrors InventoryListPage density and
  the render-loop guard (tRef + `useCallback`/`useMemo` shortcut deps, no
  unstable `t` in deps). RetroTabs `value`=current tab, `onChange` writes `?tab=`
  via `setSearchParams`. FilterBar with client-side item-OR-borrower search and
  `{n} loans` count; EXPORT CSV (disabled + `Nothing to export.` toast on empty)
  and the mint `⊕ NEW LOAN` CTA in the primaryAction slot. RetroTable columns
  Item / Borrower / Loaned / Due / Status: Item font-semibold, row click →
  `/items/{loan.item.id}`. Due cell renders neutral `due in {n}d` / `due {date}`,
  History shows `returned {date}`, overdue rows render the danger `⚠ −{n}d` chip.
  Overdue rows get the `bg-danger-bg` tint + the danger `Overdue` pill word + the
  `⚠` chip (the three non-color cues). Status from `loanStatus()` (server flags).
  Per-tab RetroEmptyState copy from the UI-SPEC Copywriting Contract.
  `useShortcuts("loans", [...])` (N → new, / → focus search).
- **LoanRowActions** (`components/LoanRowActions.tsx`) — real exported stub, props
  `{ loan: Loan; tab?: string }`, three disabled BevelButtons (RETURN / EXTEND /
  ↧ EDIT); History tab renders no actions (terminal). Plan 04 overwrites the body
  at the same path with the wired dialogs.
- **routes/index.tsx** — `<Route path="loans" element={<LoansListPage />} />`
  added under the AppShell branch (single-writer this wave; `loans/new` lands in a
  later wave's serialized edit).
- **Sidebar.tsx** — Loans NavItem gains `to="/loans"`.

## Tests

`LoansListPage.test.tsx` (MSW + RTL, mirrors the InventoryListPage harness,
registers Plan-01 `loanHandlers`):

1. Default tab Active → `/loans/active` rows (item + borrower), overdue/returned
   fixtures absent.
2. Overdue tab → `/loans/overdue`; asserts all three cues (Overdue pill word + ⚠
   glyph + `bg-danger-bg` row class).
3. History tab → `GET /loans` client-filtered to `!is_active` (only the returned
   fixture; Returned pill).
4. EXPORT CSV with rows spies `URL.createObjectURL` (download fired).
5. EXPORT CSV disabled on an empty (no-match search) tab.

## Deviations from Plan

None of the auto-fix rules fired. Two minor implementation choices, both within
plan latitude:

- The FilterBar exposes a single `primaryAction` slot, so EXPORT CSV and NEW LOAN
  are wrapped in one `<span>` fragment passed to that slot (UI-SPEC: EXPORT CSV at
  the right end before the primary CTA — preserved).
- Loans have no facet filters this phase, so `facets={[]}` and `filterChips={[]}`
  are passed; search is the only client filter (matches the UI-SPEC §2 FilterBar
  spec which lists only search + count + export + CTA for loans).

The TDD task (Task 3) was authored after the implementation task (Task 2) per the
plan's task ordering, so it landed GREEN-first rather than RED-first — the
behavior was already implemented when the test ran.

## Verification

- `bun run lint:tsc` — clean.
- `bun run test src/features/loans/` — 2 files, 10 tests passed (5 new + 5 from
  Plan 01).
- `bun run lint:imports` — OK.
- `bun run build` — built (pre-existing >500 kB chunk-size advisory only).

## Self-Check: PASSED

- frontend2/src/features/loans/hooks/useLoansQuery.ts — FOUND
- frontend2/src/features/loans/LoansListPage.tsx — FOUND
- frontend2/src/features/loans/LoansListPage.test.tsx — FOUND
- frontend2/src/features/loans/components/LoanRowActions.tsx — FOUND
- /loans route registered; Sidebar Loans → /loans — FOUND
