---
phase: 14-system-group
plan: 07
subsystem: frontend2-inventory
tags: [export, csv, parity, inventory, security-csv-injection]
requires:
  - frontend2/src/features/loans/loanCsv.ts (pattern mirrored, not imported)
  - frontend2/src/features/inventory/InventoryListPage.tsx (extended)
provides:
  - frontend2/src/features/inventory/inventoryCsv.ts (inventoryToCsvBlob)
  - InventoryListPage EXPORT CSV button (client CSV via object URL)
affects:
  - parity §4 (per-entity list export) — final gap closed
tech-stack:
  added: []
  patterns:
    - client-built formula-injection-safe CSV (escapeCell + object-URL download)
key-files:
  created:
    - frontend2/src/features/inventory/inventoryCsv.ts
    - frontend2/src/features/inventory/inventoryCsv.test.ts
  modified:
    - frontend2/src/features/inventory/InventoryListPage.tsx
decisions:
  - "Inventory export is CLIENT CSV (no server /export/inventory endpoint exists)"
  - "purchase_price exported as raw cents for round-trip fidelity"
requirements: [SYS-04]
metrics:
  tasks: 2
  files: 3
  completed: 2026-06-13
---

# Phase 14 Plan 07: Per-Entity Export — Inventory CSV Summary

Inventory list now exports a formula-injection-safe client CSV via an object
URL, closing the final parity §4 per-entity export gap (items + loans already
shipped).

## What Was Built

**Task 1 — `inventoryCsv.ts` + test (commit `11a9221f`)**
`inventoryToCsvBlob(rows: Inventory[]): Blob` mirrors `loanCsv.ts` verbatim for
the security-critical primitives (`escapeCell`, `INJECTION_PREFIXES`, `toRow`,
`triggerCsvDownload`) — copied, not imported, to keep the loans and inventory
CSV builders single-writer-clean. The header covers the inventory row's own
scalar fields: `item_id, location_id, container_id, quantity, condition, status,
purchase_price_cents, currency_code, date_acquired, warranty_expires,
expiration_date, is_archived`. `purchase_price` is emitted as raw cents for
round-trip fidelity (a formatted `$12.34` would not survive re-import); all
optional/null fields render as empty cells. Empty input → header-only Blob.
7 vitest cases assert the injection guard (`=,+,-,@,\t,\r → '` prefix),
quote-doubling, raw-cents fidelity, null handling, per-row mapping, and the
header-only-empty contract.

**Task 2 — EXPORT CSV button on InventoryListPage (commit `57bdc393`)**
Single-writer minimal-diff extension: imported `inventoryToCsvBlob` +
`triggerCsvDownload` from `./inventoryCsv` and `retroToast` from
`@/components/retro`; added an `exportCsv` `useCallback` (empty `visible` rows →
`retroToast.error(tRef.current\`Nothing to export.\`)`, else
`triggerCsvDownload(inventoryToCsvBlob(visible), "inventory.csv")`, deps =
`[visible]` only since `tRef` is stable — render-loop guard preserved). Wired an
`⤓ EXPORT CSV` `BevelButton` into the FilterBar `primaryAction` beside the mint
`⊕ ADD ENTRY` (export first), wrapped in
`<span className="flex items-center gap-sp-2">` — mirroring LoansListPage's
composition exactly. The button is `disabled` + `aria-disabled` on an empty
list. Every existing inventory query/filter/sort/table/drawer behavior is
unchanged.

## Why Client CSV (not server)

The backend `importexport` `EntityType` set is
`item | location | container | category | label | company | borrower` (verified
`importexport/types.go`). There is **NO** `/export/inventory` nor `/export/loan`
endpoint — a server export button for inventory would hit a 400 invalid-entity-
type. Inventory therefore mirrors the loans approach: a client-built CSV from
the already-fetched rows, streamed via an object URL (no token in a download
URL — T-14-20). This per-entity client-vs-server split is now:

| Entity     | Export | Mechanism                                   |
|------------|--------|---------------------------------------------|
| Items      | server | `photosApi.exportCsv` → `GET /export/item`  |
| Loans      | client | `loanCsv` → object URL                       |
| Inventory  | client | `inventoryCsv` (this plan) → object URL      |

Items and loans were already covered and were **not** touched by this plan.

## Deviations from Plan

None — plan executed exactly as written. The plan's interface note suggested
exporting item/sku/location/etc.; since the `Inventory` row carries `item_id` /
`location_id` (names require a separate join only available inside the page, not
in a pure CSV builder), the CSV exports the stable IDs plus the row's scalar
fields. This is the round-trip-faithful, single-source shape and matches the
plan's directive to "type the param off the inventory row type the page already
uses — do NOT invent a new shape."

## Threat Surface

T-14-19 (CSV/formula injection) mitigated by `escapeCell` (asserted by test).
T-14-20 (token in download URL) mitigated by the in-memory object-URL stream.
No new packages installed (T-14-SC). No new threat surface introduced.

## Verification

- `bun run lint:tsc` — clean (`tsc -b --noEmit`).
- `bun run test src/features/inventory/inventoryCsv.test.ts src/features/inventory/InventoryListPage.test.tsx` — 15 passed (2 files).
- `bun run lint:imports` — OK.

## Self-Check: PASSED

- FOUND: frontend2/src/features/inventory/inventoryCsv.ts
- FOUND: frontend2/src/features/inventory/inventoryCsv.test.ts
- FOUND: frontend2/src/features/inventory/InventoryListPage.tsx (modified)
- FOUND: commit 11a9221f (Task 1)
- FOUND: commit 57bdc393 (Task 2)
