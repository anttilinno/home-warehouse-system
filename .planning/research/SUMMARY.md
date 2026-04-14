# Research Summary — v2.1 Feature Parity (Items, Loans & Scanning)

**Project:** Home Warehouse System — `/frontend2` retro frontend
**Researched:** 2026-04-14
**Overall confidence:** HIGH

## Executive Summary

v2.1 brings `/frontend2` (Vite + React 19 + React Router v7 + retro component library) to feature parity across four areas: Items CRUD (+ photos), Loans (+ Borrowers), Barcode Scanning, and Categories/Locations/Containers. The backend is done — every needed endpoint already ships. The work is additive UI on top of the existing feature-folder layout and `lib/api.ts` client, plus targeted library additions.

Approach: lean, online-only. Strip frontend1's offline/PWA/IndexedDB/SyncManager/SSE/bulk/saved-filter/quick-capture machinery. Add React Query for server state, react-hook-form + zod for forms, `@yudiel/react-qr-scanner` (pinned 2.5.1) for scanning, plus new retro primitives (Select/Combobox, Textarea, FileInput, Pagination, ConfirmDialog, EmptyState). Photos go direct to backend via multipart — no new upload library.

## Stack Additions

**Required (core):**
- `@tanstack/react-query` `^5.62.x` — server state/cache/mutations
- `react-hook-form` `^7.70.x` — form substrate
- `@hookform/resolvers` `^5.2.x` — RHF ↔ zod bridge
- `zod` `^4.3.x` — schema validation (match frontend1)
- `@yudiel/react-qr-scanner` `2.5.1` exact — camera scanner
- `barcode-detector` `3.0.0` exact — iOS Safari polyfill
- `date-fns` `^4.1.x` — loan dates
- `uuid` `^13.0.x` — UUIDv7 idempotency keys

**Photo upload:** native `FormData` + `fetch` in RQ mutation; optional `OffscreenCanvas` resize. No extra library.

**Explicitly NOT adding:** `@radix-ui/*`, `serwist`, `idb`, `next-intl`, `next-themes`, `recharts`, `@dnd-kit`, `papaparse`, `sonner`, `framer-motion`.

## Feature Table Stakes

### Items CRUD
- Paginated list (25/page), search, filter (category/location), sort
- Detail: inventory qty, photo gallery (read), loan history
- Create/edit form (~15 fields); delete with confirm; archive/unarchive
- **Photos as sub-phase** (multipart upload, gallery, thumbnails)
- OUT: virtualization, bulk, saved filters, CSV, SSE, quick-capture, declutter

### Loans + Borrowers
- Tabs: Active / Overdue / History
- Create with item+borrower pickers, due date, notes; mark returned; extend; edit
- Borrower flat CRUD; per-item + per-borrower history
- OUT: reminders, recurring, approvals, bulk, avatars

### Barcode Scanning
- Single-route `/scan` (iOS PWA constraint — camera permission)
- QR + UPC/EAN/Code128 via `@yudiel/react-qr-scanner`
- Lookup → detail; "not found → create" overlay (NOT navigate); manual entry fallback
- Flashlight toggle; retro CRT viewfinder; post-scan action sheet
- OUT: scan history, batch, external UPC DB, NFC, hardware scanners

### Categories / Locations / Containers
- Unified Taxonomy tabbed page; tree view with indented `└─` display
- CRUD with parent picker; archive toggle; usage count; delete with 409 cascade warning
- OUT: drag-drop reorder, merge, bulk, icons/colors, floor-plan

## Architecture Integration Points

**API client:** extend `lib/api.ts` with `postMultipart<T>` helper; add `lib/api/<entity>.ts` modules for items, loans, borrowers, categories, locations, containers, itemPhotos.

**Routes:** register ~12 new routes in `routes/index.tsx` (declarative) under `<AppShell>/<RequireAuth>`.

**Retro primitives to add:** RetroSelect, RetroCombobox, RetroTextarea, RetroCheckbox, RetroFileInput, RetroPagination, RetroConfirmDialog, RetroEmptyState, RetroFormField.

**React Query:** add `QueryClientProvider` to `App.tsx`; centralize per-entity mutation hooks with cache invalidation.

**Scanner port:** copy `frontend/lib/scanner/` polyfill; rebuild component stripping `next/dynamic`, shadcn, IndexedDB, audio/haptic.

## Recommended Build Order

1. Foundation — API client split + typed entity modules (no UI)
2. Retro primitives extension (blocks all forms)
3. Categories + Locations + Containers CRUD (FK prereq for Items)
4. Borrowers CRUD (parallel with #3; prereq for Loans)
5. Items CRUD (no photos)
6. Item Photos (multipart upload, gallery)
7. Loans (depends on Items + Borrowers)
8. Barcode Scanner (single-route, post-scan action menu)
9. Polish & Nav — sidebar links, empty states, i18n, verification

## Top 5 Pitfalls

1. **Porting offline plumbing by accident.** Treat frontend1 as reference, not source. Add CI grep: fail if `frontend2/src/**` imports `idb`, `serwist`, or `*offline*`/`*sync*`.

2. **iOS PWA camera permission reset.** Scanner MUST be a single long-lived route. Never `navigate()` mid-scan — render "create item" as overlay. Stop tracks on unmount. Test on installed iOS PWA.

3. **Photo upload footguns.** MIME allowlist, max ~10 MB, resize via `OffscreenCanvas`, strip EXIF, `revokeObjectURL` via ref (not closure — v1.9 trap), sequential POSTs.

4. **Pagination mismatch / "load all" anti-pattern.** Document contract per endpoint; pick ONE pattern (numbered or infinite); always show "N of M".

5. **Form state chaos.** Standardize rhf + zod with `RetroFormField` BEFORE any CRUD phase. Build `RetroSelect`/`RetroCombobox` first.

## Gaps to Validate During Planning

- Pagination response envelope per endpoint (cursor vs page/pageSize)
- Backend `itemphoto` max size limit
- Canonical barcode lookup path (`/items?barcode=` vs `/barcode/...`)
- `@yudiel/react-qr-scanner@2.5.1` React 19 peerDep (works in frontend1 prod, verify on install)
- Cascade policy for category/location delete (block vs cascade vs un-set)
