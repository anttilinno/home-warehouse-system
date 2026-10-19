# UX Follow-ups — after the `ux/simplify-flows` overhaul

Open items left by the 2026-10-19 UI/UX audit (axe + design-rule sweep over 19
routes at 1280px and 390px). Everything else the audit found is fixed and
merged: zero axe violations, zero hard-rule breaks, one h1 per page.

Order matters: step 1 unblocks CI, the rest are independent.

## 1. Repair the three red e2e merge gates (blocks CI)

All three were already failing on the branch before the audit commits
(verified by running them against `a7e53b4e` on a spare port).

- **`e2e/sse-online.spec.ts:41`** looks for `data-testid="sse-slot"`. The branch
  deleted that TopBar status dot (`TopBar.tsx`, commit `2da85722`). Decide:
  either drop the slot assertion and keep the `ONLINE` pill check, or restore a
  live/idle dot. Recommendation: drop it — the ONLINE pill already reports
  connectivity, and a second indicator was the clutter the branch removed.
- **`e2e/responsive.spec.ts:135`** fails on clipped overflow at 320px on
  `/items` (a `tr` 347px wide). The thumbnail + name + SKU + category + status
  columns don't fit. Fix in step 3, then update the spec's comments, which
  still describe the FAB (its locator already targets the TabBar's
  `Primary (mobile)` nav).
- **`e2e/offline-replay.spec.ts:56`** times out in `page.evaluate`. Locally it
  ran against `vite dev`; CI runs `vite preview`, which ships the service
  worker. First run it against a preview build
  (`bun run build && bunx vite preview --port 4173`,
  `E2E_BASE_URL=http://localhost:4173`). Only if it still fails, debug the
  TabBar/AppShell changes against the onlineManager boot seed (see memory
  note "Offline-PWA onlineManager boot seed").

Done when: `bunx playwright test` is fully green (a11y-sweep may stay
`continue-on-error`).

## 2. Drop the workspace name from window titles

`ITEMS — SEED TEST WORKSPACE` truncates to `ITEMS — SEED T…` on phones, and the
workspace is already named by the TopBar workspace pill. Change the title from
`t\`X — ${workspaceName}\`` to `t\`X\`` in:

ItemsListPage, InventoryListPage, LoansListPage, BorrowersListPage,
TaxonomyPage, MaintenanceDuePage, WishlistPage, DeclutterPage, ApprovalsPage,
MyChangesPage, ImportsPage.

Check first that the workspace pill is visible below `md`. If it isn't, show
the suffix only from `md` up instead of dropping it. Re-extract lingui, fill
et/ru, and grep `e2e/` for title text the specs match on.

## 3. Phone-width tables (320–390px)

- `/items`: below `md`, hide the Status column (it is blank for most items) and
  fold Category into the name cell's second line, as SKU already is. Target:
  no `tr` wider than the viewport at 320px (the responsive spec's check).
- Re-run the audit script at 320px too (it only covers 390px today) to find
  the other tables that clip.

## 4. Analytics charts on phones

On `/analytics` at 390px, bar value labels clip at the right edge (`€1,`,
`€11`) and location names truncate to `E2E-LOC-FROM-…`. The charts are
`CategoryValueChart`, `LocationValueChart`, `TopBorrowersChart` and
`MonthlyLoanActivityChart` in `src/features/analytics/components/`. Reserve
right padding for the value label (or put it inside the bar when the bar is
long), and shorten the y-axis label width at narrow widths. Keep
`charts.test.tsx` green.

## 5. Phone tap targets toward 44px (nice to have)

Tabs (29px), bevel buttons (36px) and inputs (39px) clear WCAG 2.5.8's 24px
minimum but not the 44px phone guideline. Raise the RetroTabs/
InventoryScopeTabs tab height and the BevelButton padding below `md` only, so
desktop density stays. Watch the 56px TabBar: content padding
(`AppShell.tsx`, `max-md:pb-[calc(64px+…)]`) must still clear it.

## How to verify

- Unit + gates: `bun run lint:tsc`, `bun run lint:complexity`,
  `bun run lint:dead`, `bunx vitest run`.
- Audit: the throwaway Playwright audit spec (axe + hard rules + tap targets +
  overflow per route at two widths) is not checked in. Recreate it from this
  plan's description if needed, or promote it into `e2e/` as a
  `continue-on-error` job next to `a11y-sweep`.
- Full e2e against the live stack, per `CLAUDE.md`.
