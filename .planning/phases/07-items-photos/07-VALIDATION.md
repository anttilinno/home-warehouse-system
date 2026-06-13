---
phase: 7
slug: items-photos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 7 — Validation Strategy

> Pure frontend integration phase — zero new backend work, zero new deps
> (RHF/zod confirmed installed). Two load-bearing pitfalls: absolute photo
> URLs must rewrite to /api-relative; EXIF orientation is an ADDITION via
> createImageBitmap. HEIC is NOT server-accepted (jpeg/png/webp).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + RTL + MSW; Playwright vs live stack (UP) |
| **Quick run command** | `cd frontend2 && bun run test src/features/items/` |
| **Full suite command** | `cd frontend2 && bun run test && bun run build && bun run lint:imports && bun run lint:tsc` |
| **Estimated runtime** | ~60s full |

---

## Sampling Rate

- After every task commit: affected specs
- After every plan wave: full suite + build + lint
- Before phase verification: full suite + live E2E (item CRUD flow)
- Max feedback latency: 60s

---

## Per-Requirement Verification Map

| Requirement | Behavior to prove | Test Type |
|-------------|-------------------|-----------|
| ITEM-01 | List renders 25/page from MSW envelope {items,total,page,total_pages}; search/category/archived chips drive URL params; sort headers; deep-link restores state | unit |
| ITEM-02 | Detail renders fields + gallery + active-loan (client-partitioned is_active) + history + labels row + 7b STUB slot | unit |
| ITEM-03/04 | Create with ?barcode= prefill; edit optimistic invalidation of ["items", wsId] prefix + detail key | unit |
| ITEM-05/06 | Archive/unarchive; archived hidden by default + chip reveals; delete only-when-archived, type-to-confirm | unit |
| ITEM-07 | Upload: accept jpeg/png/webp ONLY (no HEIC), client resize + EXIF via createImageBitmap, 10MB cap client check, FormData field name `photo`, per-file progress | unit |
| ITEM-08 | Gallery + lightbox (arrows/ESC via modal stack), set-primary (put), per-photo delete confirm; **URL rewrite: absolute backend URLs → /api-relative (dedicated unit test)** | unit |
| Photo extras | captions, reorder buttons, bulk-delete/caption, zip (blob helper), dup-check dialog flow | unit |
| ITEM-09 | lookupByBarcode re-added: direct GET by-barcode, 404→null, encodeURIComponent, case guard — fetch-mock tests per Phase 65 pattern; backend G-65-01 integration test STAYS GREEN | unit + go-integration (existing) |
| ITEM-10 | useShortcuts("items", [N, /, F]) registered; guard respected | unit |
| Bulk/saved/export | bulk archive/delete via selection + Bottombar chips; SavedFilters round-trip; CSV export button hits GET /export/item?format=csv via blob helper | unit |
| E2E | live: create item → in list → detail → archive → hidden → chip reveals → unarchive | e2e (phase gate) |

---

## Wave 0 Requirements

- [ ] api.ts additive helpers (put, blob) land FIRST with invariant-preservation tests (locked file)
- [ ] Photo URL rewrite helper + test before any <img> consumer
- [ ] lookupByBarcode fetch-mock suite per Phase 65 canonical pattern

---

## Manual-Only Verifications

| Behavior | Why Manual | Instructions |
|----------|------------|--------------|
| Real photo upload incl. EXIF-rotated phone JPEG | needs real image fixtures + eyeball | upload rotated photo, confirm orientation correct |
| Lightbox feel + zip download | visual/file | gallery interactions on live data |
| List density vs sketch 008 | visual | eyeball 30+ rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
