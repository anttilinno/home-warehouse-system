---
phase: 13b-analytics
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend2/src/features/analytics/components/OutOfStockTable.tsx
  - frontend2/src/features/analytics/components/OutOfStockTable.test.tsx
otmf_note: "Wave 1, DISJOINT from siblings 13b-01 (lib/api/analytics.ts + features/analytics/hooks/* + features/analytics/types.ts) and 13b-02 (package.json/bun.lock + features/analytics/charts/* + the six *Chart.tsx components). This plan owns exactly ONE component file (OutOfStockTable.tsx) + its test, both new files in features/analytics/components/ — no path overlap with 13b-02's *Chart.tsx files. It imports the OutOfStockItem TYPE from 13b-01 (features/analytics/types.ts) but creates no api/hook and no single-writer file. The AnalyticsPage (13b-04, W2) mounts this table and feeds it the useOutOfStock() rows."
autonomous: true
requirements: [ANL-04]
must_haves:
  truths:
    - "The out-of-stock table renders one row per OutOfStockItem with the item name as a <Link to=/items/{id}> in accent-blue-deep"
    - "min_stock_level is shown and current stock renders as 0 in mono danger-red (the item IS out of stock — not a fabricated number)"
    - "Each row carries an OUT badge"
    - "An empty dataset renders a RetroEmptyState, not a blank/broken table"
    - "The table uses sketch-008 density (RetroTable) with a pink attention title bar"
  artifacts:
    - path: frontend2/src/features/analytics/components/OutOfStockTable.tsx
      provides: "presentational out-of-stock table: name links to /items/{id}, min-stock + 0-current danger, OUT badge, empty state"
      contains: "OutOfStockTable"
  key_links:
    - from: frontend2/src/features/analytics/components/OutOfStockTable.tsx
      to: "/items/{id}"
      via: "<Link to={`/items/${item.id}`}> on the item-name cell (react-router)"
      pattern: "/items/\\$\\{"
    - from: frontend2/src/features/analytics/components/OutOfStockTable.tsx
      to: frontend2/src/components/retro/feedback/RetroEmptyState
      via: "render RetroEmptyState when the rows array is empty (ANL-04 empty case)"
      pattern: "RetroEmptyState"
---

<objective>
The out-of-stock table (ANL-04): a PURE presentational `OutOfStockTable({ items, isLoading })`
component that the AnalyticsPage (13b-04) feeds with `useOutOfStock()` rows. Each row links its item
name to `/items/{id}`; current stock renders as `0` (the item is out of stock — that is WHY it is in
this list; OutOfStockItem carries no current_stock field, so render a literal danger-red mono `0`,
NEVER a fabricated number) alongside the real `min_stock_level`; each row carries an `OUT` badge. An
empty list renders a RetroEmptyState. The table uses sketch-008 density via RetroTable, with a pink
"attention" title bar (the out-of-stock surface is a warning, per CONTEXT layout).

Verified shape (CONTEXT, from 13b-01 types): `OutOfStockItem` =
`{ id, name, sku, min_stock_level, category_id?, category_name? }`.

Purpose: ANL-04 — the dedicated out-of-stock table linking back to items.
Output: OutOfStockTable.tsx + its test.

This plan is Wave 1 and DISJOINT from siblings 13b-01 (api/hooks/types) and 13b-02 (charts + recharts):
it creates exactly one component + its test, no api/hook, no single-writer file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/13b-analytics/13b-CONTEXT.md
@.planning/phases/13b-analytics/13b-VALIDATION.md
@.planning/sketches/MANIFEST.md

# The atoms to compose + the type this table reads + a RetroTable consumer to mirror:
@frontend2/src/components/retro/RetroTable.tsx
@frontend2/src/features/analytics/types.ts

<interfaces>
<!-- Verified from source this planning session. Use directly; no exploration needed. -->

RetroTable (`@/components/retro` barrel): `RetroTableProps = ComponentPropsWithRef<"table">` — it is a
THIN styled `<table>` wrapper. Compose `<thead>/<tbody>/<tr>/<th>/<td>` manually inside it (mirror the
existing RetroTable consumers, e.g. the dashboard activity table / items list table). It does NOT take
a `columns` prop.

Window (`@/components/retro` → `{ Window }`): `title` (ReactNode), `titlebarVariant` (use the PINK
attention accent variant — verify the exact prop value in Window.tsx; CONTEXT calls for a pink
"attention" title bar), `bodyClassName`. Wrap the table in a Window.

RetroBadge / StatusPill (`@/components/retro` → feedback): RetroBadge supports a danger/pink variant —
use it for the `OUT` badge. StatusPillVariant = "ok"|"warn"|"info"|"danger".

RetroEmptyState (`@/components/retro` → feedback): render when `items.length === 0`. Mirror its prop
shape from an existing empty-state consumer (label/description + optional action).

Link: `import { Link } from "react-router"` (the project is on react-router v7 library mode — verify
the import source matches routes/index.tsx, which imports from "react-router"). `<Link to={`/items/${item.id}`}>`.

Tokens: item-name link color = `accent-blue-deep` (`#19526f`); the `0` current-stock + zero emphasis =
danger red mono (`text-[--danger]`/`b73348` per the retro tokens) with `font-mono tabular-nums`.

i18n: all column headers, the OUT badge label, and the empty-state copy via @lingui `<Trans>`/`t`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: OutOfStockTable — linked rows, min-stock, 0-current danger, OUT badge, empty state</name>
  <files>frontend2/src/features/analytics/components/OutOfStockTable.tsx, frontend2/src/features/analytics/components/OutOfStockTable.test.tsx</files>
  <behavior>
    OutOfStockTable.test.tsx (render under a MemoryRouter + lingui providers — the rows contain
    react-router <Link>s so a Router is required):
    - given two OutOfStockItem fixtures, two rows render; each item name is a link whose href is
      `/items/{id}` (assert getByRole("link", { name }) → href ends with `/items/<id>`)
    - each row shows its min_stock_level value and a current-stock cell rendering "0" (assert the "0"
      cell carries the danger/mono class — assert text "0" present in the current-stock column)
    - each row carries an OUT badge (assert an "OUT" badge/label per row)
    - given an EMPTY items array, a RetroEmptyState renders (assert its copy) and NO table rows
    - category_name renders when present; absent → a muted "—" (do not crash on the optional field)
  </behavior>
  <action>
    OutOfStockTable.tsx: `export function OutOfStockTable({ items, isLoading }: { items:
    OutOfStockItem[]; isLoading?: boolean })` importing `OutOfStockItem` from `@/features/analytics/types`.
    Wrap everything in a retro `Window` titled (Silkscreen) "Out of stock" with the PINK attention
    title-bar variant. Body:
    - `isLoading` → a mono "Loading…" line.
    - `items.length === 0` (and not loading) → `<RetroEmptyState>` with a "Nothing is out of stock" /
      "All items are in stock" message (i18n) — NO table.
    - otherwise a RetroTable (sketch-008 density) with a manual thead/tbody. Columns: Item / SKU /
      Category / Min stock / Stock / "" (badge). Per row:
        · Item name = `<Link to={`/items/${item.id}`}>` styled `accent-blue-deep` (the link is the
          ANL-04 back-reference — every row links to its item).
        · SKU = mono.
        · Category = `item.category_name ?? "—"` (muted when absent).
        · Min stock = `item.min_stock_level` (mono tabular-nums).
        · Stock = a literal `0` in danger-red mono tabular-nums (the item is out of stock — there is no
          current_stock field on OutOfStockItem; render the honest 0, NEVER fabricate a number).
        · Badge = a RetroBadge danger/pink "OUT".
    All strings via <Trans>/t. Compose atoms only through `@/components/retro`. This is a pure
    presentational component — it takes its rows as a prop (the page wires useOutOfStock()); it does
    NOT call the hook itself (keeps it trivially testable + disjoint from 13b-01).
  </action>
  <verify>
    <automated>cd frontend2 && bun run lint:tsc && bun run test src/features/analytics/components/OutOfStockTable.test.tsx</automated>
  </verify>
  <done>Table test green: rows link to /items/{id}, min-stock shown, current "0" danger-mono, OUT badge per row, empty → RetroEmptyState.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| out-of-stock payload → table cells + item links | server-supplied name/sku/category render into the table; React escapes them. The item id flows into a `/items/{id}` Link path — a client-side route, no HTML/JS injection surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13b-05 | Spoofing | a fabricated "current stock" number | mitigate | OutOfStockItem carries NO current_stock field; the cell renders a literal honest `0` (the item is in this list precisely because it is out of stock) — never an invented quantity |
| T-13b-06 | Tampering | item id in the Link path | accept | id flows into a react-router client path `/items/{id}`; the target ItemDetailPage re-fetches + re-scopes server-side to the workspace, so a malformed/foreign id surfaces a 404 there, not here |
| T-13b-SC | Tampering | npm installs | mitigate | none — this plan installs NO packages (composes existing retro atoms + react-router Link) |
</threat_model>

<verification>
- `cd frontend2 && bun run lint:tsc` clean (tsc -b — VALIDATION landmine).
- `bun run test src/features/analytics/components/OutOfStockTable.test.tsx` green.
- Each row name is a working `/items/{id}` link; current stock renders honest danger-mono "0";
  OUT badge per row; empty → RetroEmptyState; pink attention title bar.
</verification>

<success_criteria>
- ANL-04: out-of-stock table renders one linked row per item (name → /items/{id}), min_stock_level
  shown, current stock honest "0" in danger, OUT badge, empty → RetroEmptyState, sketch-008 density.
</success_criteria>

<output>
Create `.planning/phases/13b-analytics/13b-03-SUMMARY.md` when done (record the OutOfStockTable prop
contract — `{ items, isLoading }` — and the column set so 13b-04's AnalyticsPage wires useOutOfStock()
into it against a verified signature).
</output>
