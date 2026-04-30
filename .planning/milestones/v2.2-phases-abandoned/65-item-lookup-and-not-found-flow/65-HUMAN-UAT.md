---
status: diagnosed
phase: 65-item-lookup-and-not-found-flow
source: [65-VERIFICATION.md]
started: 2026-04-19T13:42:00Z
updated: 2026-04-19T14:06:00Z
verified_via: Firefox MCP desktop session (Linux, no camera — manual barcode entry via KÄSITSI tab)
---

## Current Test

[complete — 4/5 automated; 1 not testable on desktop]

## Tests

### 1. iOS PWA camera permission resume after /scan → /items/new → back
expected: Scanner resumes without re-prompting the OS-level camera permission
why_human: Real iOS device + Safari PWA install required; Pitfall #1 cannot be asserted in JSDOM or Firefox desktop.
result: not-tested
note: Requires iPhone. No regression risk from Phase 65 code — ScanPage keeps the same getUserMedia lifecycle as Phase 64.

### 2. Enrichment banner visual under live api.upcitemdb.com data
expected: Scanning a real consumer UPC (e.g. 5449000000996) and navigating to /items/new shows UpcSuggestionBanner with name/brand rows + [USE] chips; tapping [USE] writes to the form; category renders as helper text only
why_human: Depends on live public endpoint.
result: PASS
evidence: Navigated to /items/new?barcode=5449000000996. Live api.upcitemdb.com returned Coca-Cola data. `SOOVITUSED SAADAVAL` banner rendered with NIMI=Original Taste and BRÄND=Coca-Cola rows + [KASUTA] buttons + `Kategooria vihje: Beverages…` helper-text + SULGE + KASUTA KÕIK. Clicking KASUTA KÕIK wrote both NAME and BRAND into the form (D-13..D-16 verified). Category rendered as helper text only (not written, D-15 verified).

### 3. prefers-reduced-motion: reduce opts out of LOADING cursor blink
expected: Cursor glyph ▍ stays static (no opacity oscillation) when prefers-reduced-motion is reduce
why_human: CSS @media rule effect cannot be asserted in JSDOM.
result: PASS
evidence: Verified the three required CSS rules are in the compiled stylesheet via JS introspection of document.styleSheets:
  - `@keyframes retro-cursor-blink { 0%,50% {opacity:1} 51%,100% {opacity:0} }`
  - `.retro-cursor-blink { animation: 1s steps(1) infinite retro-cursor-blink; }`
  - `@media (prefers-reduced-motion: reduce) { .retro-cursor-blink { animation: none; opacity: 1; } }`
The browser will honor the OS/DevTools setting automatically.

### 4. End-to-end scan → match → VIEW ITEM navigation in a real browser
expected: Live decode of a barcode for an existing workspace item shows MATCHED banner with name + short_code; VIEW ITEM lands on /items/{id}
why_human: Live camera + workspace-seeded item required.
result: FAIL
evidence: Created an item with barcode=5449000000996 via /items/new submit flow. Navigated to /scan → KÄSITSI (manual entry) → entered 5449000000996 → OTSI KOOD. Banner rendered `EI LEITUD` (NOT FOUND) despite the item existing in the workspace database (verified via GET /api/workspaces/{wsId}/items/{id} returning barcode:"5449000000996"). Direct API probe: GET /api/workspaces/{wsId}/items?search=5449000000996&limit=1 → total:0. The MATCH state is UNREACHABLE in production because the backend FTS `search_vector` generated column only indexes (name, brand, model, description) — NOT barcode or sku. All 710 unit tests pass because they mock itemsApi.list to return the seeded candidate; they did not catch this backend contract mismatch.
root_cause: D-06 in 65-CONTEXT.md assumed "GET /items?search={code}" covers barcode matches. SQL evidence disproves this (backend/db/migrations/001_initial_schema.sql:495-500 defines search_vector over name/brand/model/description only).

### 5. End-to-end scan → not-found → CREATE ITEM → submit happy-path
expected: Live decode of an unknown barcode shows NOT FOUND banner; CREATE ITEM navigates to /items/new?barcode=<encoded>; form submit creates the item; rescanning the same code now shows MATCHED
why_human: Cross-route + cross-cache invalidation (Pitfall #7) round-trip.
result: PARTIAL-FAIL
evidence:
  - NOT-FOUND banner render + CREATE ITEM button: PASS (`EI LEITUD` + `LOO UUS ESE SELLE VÖÖTKOODIGA` + `SKANEERI UUESTI` rendered; D-19 + D-20 verified)
  - Navigation to /items/new?barcode=<encoded>: PASS (URL includes barcode=5449000000996 after CREATE ITEM click)
  - ?barcode= prefill in form: PASS (VÖÖTKOOD input pre-populated)
  - Form submit creates item: PASS (navigated to /items/{uuid}, GET on that id returns barcode intact)
  - Rescan shows MATCHED: FAIL (same root cause as Test 4 — backend FTS misses barcode; banner shows NOT FOUND for a just-created barcoded item)

## Summary

total: 5
passed: 2
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

### Gap G-65-01: LOOK-01 MATCH state unreachable due to backend FTS contract mismatch
severity: blocking
requirement: LOOK-01
decision_violated: D-06 (v2.2: Backend lookup via existing list endpoint — GET /items?search={code} with exact-match guard; no new HTTP route)
observed:
  - 46 items in seeded workspace, 1 with a barcode (the just-created Coca-Cola item with barcode=5449000000996)
  - GET /api/workspaces/{wsId}/items?search=5449000000996&limit=1 → total:0
  - GET /api/workspaces/{wsId}/items/{id} → returns the item with barcode=5449000000996 (confirms item exists)
  - GET /api/workspaces/{wsId}/items?search=Original%20Taste&limit=1 → total:1 (name search works)
  - GET /api/workspaces/{wsId}/items?search=ITEM-MO5NQT5O&limit=1 → total:0 (sku search also fails)
root_cause:
  - backend/db/migrations/001_initial_schema.sql:495-500: `search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(name, '')), 'A') || setweight(to_tsvector('english', coalesce(brand, '')), 'B') || setweight(to_tsvector('english', coalesce(model, '')), 'B') || setweight(to_tsvector('english', coalesce(description, '')), 'C')) STORED`
  - Comment in backend/internal/domain/warehouse/item/repository.go:16 says "FTS search over name, SKU, barcode" but SQL contradicts this — comment is aspirational, implementation is not
  - Backend has `FindByBarcode(ctx, workspaceID, barcode)` in the repo layer (backend/internal/infra/postgres/item_repository.go:157) using the `ix_items_barcode` btree index, but NO HTTP handler exposes it
evidence_tests_missed_it:
  - Plan 65-02 test `itemsApi.lookupByBarcode` mocks `itemsApi.list` to return the seeded item — never exercises the real backend FTS. The D-07 case-sensitive exact-match guard fires only on what `list` returns; if `list` returns empty, D-07 is never hit.
  - No Playwright/E2E test in Phase 65 exercised the real backend lookup path.
impact:
  - LOOK-01 (scan match) fails for every real barcode in production
  - LOOK-02 (CREATE ITEM from NOT FOUND) works, but the "rescan now matches" round-trip from SC-65-3 fails — feels broken
  - ScanResultBanner MATCH state (D-18) rendering + onViewItem navigation are unreachable; code is correct, just unreachable
fix_options:
  - A. Add dedicated `GET /api/workspaces/{wsId}/items/by-barcode/{code}` handler using existing `FindByBarcode` repo method + `ix_items_barcode` index; update `itemsApi.lookupByBarcode` to call it. Cleanest; revises D-06. Estimated 2 plans (backend route + frontend swap).
  - B. Extend `search_vector` generated column to include `coalesce(barcode, '')`. Requires DB migration. Wider impact (changes FTS ranking for all list queries). Estimated 1 plan but higher blast radius.
  - C. Keep list-based approach, augment frontend: after `list({search})` returns empty, call a new barcode endpoint as fallback. Two round trips per unknown barcode. Not recommended.
recommended_fix: Option A — add dedicated barcode endpoint, revise D-06 to "dedicated GET /items/by-barcode/{code} endpoint using FindByBarcode repo method".
