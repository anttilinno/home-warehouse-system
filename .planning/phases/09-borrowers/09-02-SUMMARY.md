---
phase: 09-borrowers
plan: 02
subsystem: frontend2/borrowers
tags: [borrowers, list-page, sidebar, routing, retro-os]
requires:
  - "09-01: borrowersApi, useBorrowersQuery, BORROWERS_PER_PAGE, MSW borrowerHandlers"
provides:
  - "BORR-01 list surface: /borrowers (search + table + pager + NEW BORROWER CTA)"
  - "Sidebar Borrowers nav enabled (to=/borrowers)"
  - "/borrowers list route registered in routes/index.tsx"
affects:
  - "09-03 (Wave 3): adds borrowers/new, borrowers/:id, borrowers/:id/edit to the same shared routes/index.tsx"
tech-stack:
  added: []
  patterns:
    - "InventoryListPage/LoansListPage parity: mint Window + FilterBar + RetroTable + RetroPagination"
    - "Client search + client pagination over a single ≤100 fetch (no /search, no server total)"
    - "Render-loop guard: tRef + stable shortcut memo deps (never `t`)"
key-files:
  created:
    - frontend2/src/features/borrowers/BorrowersListPage.tsx
    - frontend2/src/features/borrowers/BorrowersListPage.test.tsx
  modified:
    - frontend2/src/components/layout/Sidebar.tsx
    - frontend2/src/routes/index.tsx
decisions:
  - "Loans column renders muted '—' placeholder (OQ7 / binding override #2): NO per-row loan-count fan-out; live count lives on the detail page (09-03)."
  - "Per-test MSW overrides registered in a SEPARATE later server.use() call so MSW prepends them and they win the route match (the bare borrowerHandlers list handler would otherwise shadow same-path overrides spread into one call)."
metrics:
  duration: ~20m
  completed: 2026-06-13
  tasks: 2
  files: 4
---

# Phase 9 Plan 02: /borrowers List Page Summary

Shipped the BORR-01 borrower browse surface — a mint Window cloning
InventoryListPage/LoansListPage density (FilterBar client search + count + NEW
BORROWER CTA, a 4-column RetroTable, and a client-computed RetroPagination) —
plus the Sidebar nav flip and the single `/borrowers` list route registration.

## What shipped

**Task 1 — BorrowersListPage (+ test).** Mint `Window title={t\`BORROWERS — ${workspaceName}\`}`.
`useBorrowersQuery(search)` supplies `{ rows, page, pageCount, isLoading, isError }`;
the hook does ONE ≤100 fetch then filters (name+email substring) and pages
entirely client-side — the page never calls `/borrowers/search` and never reads
a server `total`. FilterBar with `facets={[]}` (borrowers have no enum facets),
`itemCount={rows.length}`, a CLEAR-ALL on active search, and a mint
`⊕ NEW BORROWER` primaryAction. RetroTable columns: Name (`font-semibold`),
Contact (`email ?? phone ?? muted —`, `font-mono`), Loans (muted `—`
placeholder — OQ7 binding override #2, no per-row fan-out), and an
`aria-hidden` actions cell with a per-row EDIT BevelButton that calls
`e.stopPropagation()` and navigates to `/borrowers/:id/edit`. Whole `<tr>` is
`cursor-pointer` → `/borrowers/:id`. RetroPagination fed `page`/`pageCount`/
`perPage={BORROWERS_PER_PAGE}`; `onPageChange` writes `?page` to the URL
(InventoryListPage feed). Empty/no-match/loading/error copy verbatim from
09-UI-SPEC §Surface 1. RENDER-LOOP GUARD mirrored from InventoryListPage:
`const tRef = useRef(t); tRef.current = t;` read inside the `useShortcuts` memo
whose deps are STABLE callbacks only (`goNew`, `focusSearch`), never `t`.
Shortcuts: `N → /borrowers/new`, `/ → focus search`.

**Task 2 — Sidebar nav + route.** `Sidebar.tsx`: added `to="/borrowers"` to the
existing Borrowers NavItem (glyph `☺` + count already wired — single nav change
for the phase). `routes/index.tsx`: imported `BorrowersListPage`, registered
EXACTLY `<Route path="borrowers" element={<BorrowersListPage />} />` with a
comment noting the form/detail routes (`borrowers/new` above `:id` per AP-1,
`:id/edit`, `:id`) belong to plan 09-03 (later wave, sequential shared-file
merge). No form/detail page imports.

## Tests

8 BorrowersListPage cases: rows render (name + email-preferred contact); client
search filters with NO `/borrowers/search` request (asserted via a spy on the
search route); 30-fixture pager pages 01..25 → 26..30; NEW BORROWER CTA →
/borrowers/new; row click → detail; EDIT cell → /:id/edit (NOT detail,
stopPropagation); empty data → NO BORROWERS + ADD BORROWER; no-match search →
NO MATCHES + CLEAR ALL.

## Deviations from Plan

None functional — plan executed as written.

One test-infra detail worth recording (not a plan deviation): per-test MSW
overrides must be registered in a SEPARATE `server.use()` call AFTER the base
`borrowerHandlers`, not spread into the same call. MSW resolves the FIRST
matching runtime handler, and `borrowerHandlers` registers its bare-list
handler before any override spread into the same array would sit — so a
same-path override (empty list / 30-fixture list) was shadowed until split into
its own later `use()` (which MSW prepends). Both affected tests (pagination,
empty-state) pass with the split.

## Verification

- `bun run test BorrowersListPage --run` → 8 passed
- `bun run test src/features/borrowers/` → 2 files, 18 passed (8 here + 10 from 09-01)
- `bun run lint:tsc` → clean (no output; exit 0)

## Self-Check: PASSED

- BorrowersListPage.tsx — FOUND
- BorrowersListPage.test.tsx — FOUND
- Sidebar.tsx `to="/borrowers"` — FOUND
- routes/index.tsx `path="borrowers"` — FOUND
- commits b519543d (RED), 5d129282 (GREEN), 45b368bf (nav+route) — FOUND
