---
phase: 13b-analytics
plan: 03
subsystem: frontend2/analytics
tags: [analytics, out-of-stock, retro-table, ANL-04, presentational]
requires:
  - "features/analytics/types.ts → OutOfStockItem (13b-01, same-wave sibling, merge-time type seam)"
  - "@/components/retro barrel: Window, RetroTable, RetroBadge, RetroEmptyState"
  - "react-router v7 (Link)"
provides:
  - "OutOfStockTable presentational component (ANL-04)"
  - "prop contract: { items: OutOfStockItem[]; isLoading?: boolean }"
affects:
  - "13b-04 AnalyticsPage (W2) mounts OutOfStockTable and feeds it useOutOfStock() rows"
tech-stack:
  added: []
  patterns:
    - "Pure presentational table — rows passed as a prop, no data fetch (disjoint from 13b-01 hook)"
    - "Honest literal danger-mono 0 for current stock (OutOfStockItem has no current_stock field; never fabricate — T-13b-05)"
key-files:
  created:
    - frontend2/src/features/analytics/components/OutOfStockTable.tsx
    - frontend2/src/features/analytics/components/OutOfStockTable.test.tsx
  modified: []
decisions:
  - "Column set: Item / SKU / Category / Min stock / Stock / (OUT badge) — give to 13b-04 when wiring useOutOfStock()"
  - "Empty state copy: 'NOTHING OUT OF STOCK' / 'All items are in stock…' with ✓ glyph"
metrics:
  duration: ~10m
  completed: 2026-06-13
---

# Phase 13b Plan 03: OutOfStockTable Component Summary

ANL-04 out-of-stock table: a pure presentational `OutOfStockTable({ items, isLoading })`
RetroTable (sketch-008 density) in a pink "attention" Window. Each row links its item name to
`/items/{id}` (accent-blue-deep), shows the real `min_stock_level`, renders current stock as an
honest danger-mono `0`, and carries an `OUT` danger badge. Empty rows → RetroEmptyState. No data
fetch — the AnalyticsPage (13b-04) feeds it `useOutOfStock()` rows.

## Prop Contract (for 13b-04 to wire against)

```ts
OutOfStockTable({
  items: OutOfStockItem[];   // from @/features/analytics/types (13b-01)
  isLoading?: boolean;
})
```

- `isLoading` → mono "Loading…" line, no table.
- `items.length === 0` (not loading) → `RetroEmptyState`, no table.
- otherwise a `RetroTable` with columns **Item / SKU / Category / Min stock / Stock / (badge)**.

`OutOfStockItem` shape consumed: `{ id, name, sku, min_stock_level, category_id?, category_name? }`.

## Per-row rendering

| Cell | Source | Treatment |
|------|--------|-----------|
| Item | `item.name` | `<Link to={`/items/${item.id}`}>` accent-blue-deep |
| SKU | `item.sku` | mono |
| Category | `item.category_name ?? "—"` | muted when absent |
| Min stock | `item.min_stock_level` | mono tabular-nums, right |
| Stock | literal `0` | danger-mono tabular-nums, right (T-13b-05 — honest, never fabricated) |
| Badge | — | `RetroBadge variant="danger"` "OUT" |

All strings via @lingui `<Trans>`/`t`. Atoms composed only through `@/components/retro`.

## Deviations from Plan

None — plan executed as written. One column-order nuance vs the action block (which lists
"Item / SKU / Category / Min stock / Stock / badge") was followed exactly.

## Expected Type Seam (NOT a failure)

`bun run lint:tsc` (`tsc -b --noEmit`) reports exactly ONE error:

```
src/features/analytics/components/OutOfStockTable.tsx(9,37): error TS2307:
  Cannot find module '@/features/analytics/types' or its corresponding type declarations.
```

This is the **13b-01 same-wave sibling seam** — `features/analytics/types.ts` (owner: 13b-01)
does not exist on this branch and resolves on merge. It was anticipated by the plan/prompt and is
the ONLY tsc error. No stub was added (per instructions). The component test inlines a structurally
identical local `Fixture` type so the test runs independently of the merge-time import.

## Verification

- `bun run lint:tsc` → clean except the expected `@/features/analytics/types` seam (above).
- `bun run test src/features/analytics/components/OutOfStockTable.test.tsx` → **6 passed (6)**.
  - one row per item, name → `/items/{id}` link
  - min_stock_level shown; current-stock `0` carries `mono` + `text-danger`
  - OUT badge per row
  - category_name present → rendered; absent → muted "—"
  - empty items → RetroEmptyState, no rows/links
  - isLoading → loading line, no rows

## Known Stubs

None. The literal `0` current-stock cell is an intentional honest value (the item is out of stock
and `OutOfStockItem` carries no `current_stock` field) — documented as threat mitigation T-13b-05,
not a stub.

## Self-Check: PASSED

- frontend2/src/features/analytics/components/OutOfStockTable.tsx — FOUND
- frontend2/src/features/analytics/components/OutOfStockTable.test.tsx — FOUND
- Commit 38524847 (test RED) — FOUND
- Commit f029338e (feat GREEN) — FOUND
