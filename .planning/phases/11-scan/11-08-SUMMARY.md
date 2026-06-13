---
phase: 11-scan
plan: 08
subsystem: scan / i18n / e2e
tags: [lingui, i18n, playwright, e2e, by-barcode, G-65-01]
requires: ["11-06", "11-07"]
provides:
  - "Extracted en/et/ru Lingui catalogs covering all Phase 11 scan/claim/item-form strings"
  - "frontend2/e2e/scan-lookup.spec.ts — live MANUAL-entry by-barcode E2E (MATCH + NOT-FOUND)"
  - "Re-established G-65-01 browser-level barcode-lookup guard"
affects:
  - "frontend2/src/locales/{en,et,ru}/messages.po"
  - "frontend2/e2e/"
tech-stack:
  added: []
  patterns:
    - "lingui extract sweeps all <Trans>/t`` call sites; EN is source, ET/RU msgids with empty msgstr (no hand-faked translations)"
    - "E2E: ONE login per spec (20/min auth limiter), cookie-inherited page.request seeding, discovery gate before UI assert"
    - "ScanResultBanner renders in the PERSISTENT scan-tab layer — manual submit sets state, banner is viewed on the Scan tab"
key-files:
  created:
    - frontend2/e2e/scan-lookup.spec.ts
  modified:
    - frontend2/src/locales/en/messages.po
    - frontend2/src/locales/et/messages.po
    - frontend2/src/locales/ru/messages.po
decisions:
  - "Manual-entry path is the CI-drivable surface (no real camera); the manual submit funnels through the same useScanResolve handler as a live decode, so it guards the real lookupByBarcode → 4-state banner contract"
  - "Banner assertions happen on the Scan tab because ScanPage renders ScanResultBanner inside the always-mounted scan/camera layer (binding override 1), not in the Manual panel"
metrics:
  duration: ~4m
  completed: 2026-06-13
requirements: [SCAN-05, SCAN-08, SCAN-09]
---

# Phase 11 Plan 08: Scan i18n Catalogs + By-Barcode Lookup E2E Summary

Phase-close plan: extracted the en/et/ru Lingui catalogs so every Phase 11 string is
translatable, and re-added the long-standing by-barcode Playwright guard (G-65-01) that
was wiped with the v2.2 frontend2 — a live MANUAL-entry spec that asserts the MATCH and
NOT-FOUND banners against the real backend.

## What Was Built

### Task 1 — Lingui catalog extraction (commit `88ee9991`)
`bun run i18n:extract` swept every `<Trans>` / `t\`\`` call site across the app into the
catalogs. The EN source catalog grew from ~30 msgids to **744** (`grep -c ^msgid`), with
**46** message references pointing at `src/features/scan` / `src/components/scan` call
sites — confirming all Phase 11 scan strings (LOOK UP CODE, ENTER CODE, MATCH, NOT FOUND,
CAMERA BLOCKED, RECENT SCANS, CREATE WITH CODE, MANUAL/HISTORY tabs, etc.) are extracted
and no Phase 11 call site renders a raw literal (a raw literal would simply be absent
from the catalog). ET and RU received the same 744 msgids with empty `msgstr` per the
existing catalog convention — no hand-faked translations.

### Task 2 — by-barcode lookup E2E (commit `a9cd7b60`)
`frontend2/e2e/scan-lookup.spec.ts`: a single live test (chromium + firefox) that does
ONE login (honoring the 20/min auth limiter), resolves the seeder's first workspace, and
seeds an item with a known 13-digit barcode via cookie-inherited `page.request`. A
discovery gate first asserts the real `GET /items/by-barcode/{code}` endpoint resolves the
seeded item (200) and 404s the absent code — so a UI failure can't be masked by a bad
seed. Then on `/scan?tab=manual` it:
- types the seeded code → LOOK UP CODE → asserts the **MATCH** banner + the item name;
- types a guaranteed-absent code → LOOK UP CODE → asserts the **NOT FOUND** banner + the
  **CREATE WITH CODE** link to `/items/new?barcode=<code>`.

This restores the browser-level barcode-lookup coverage flagged as "currently NOWHERE" in
CLAUDE.md §Backend Integration Tests (G-65-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug, E2E flow] Banner asserted on the Scan tab, not the Manual panel**
- **Found during:** Task 2 chromium sanity run.
- **Issue:** The first draft asserted `toBeVisible()` on the MATCH banner while still on
  the MANUAL tab. The run failed: the "MATCH" pill resolved in the DOM but was
  `hidden`. Root cause is ScanPage architecture (binding override 1): `ScanResultBanner`
  renders inside the PERSISTENT scan/camera layer (`<div className={activeTab === "scan" ? "" : "hidden"}>`),
  not in the Manual panel. The manual submit sets the shared banner state, but the banner
  is *displayed* on the Scan tab. (The component unit test masked this because jsdom's
  `toBeInTheDocument` ignores CSS `display:none`.)
- **Fix:** After the manual LOOK UP CODE submit, the spec switches to the Scan tab to view
  the result — mirroring the real user's eyes returning to the viewfinder — then asserts
  the banner. No component/src edits (hard-rule respected); the fix lives entirely in the
  spec.
- **Files modified:** `frontend2/e2e/scan-lookup.spec.ts`
- **Commit:** `a9cd7b60`

## Gate Results

- `bun run lint:tsc` — clean (exit 0). (Note: the typecheck script is `lint:tsc`, NOT
  `typecheck`.)
- `npx playwright test --list e2e/scan-lookup.spec.ts` — **2 tests in 1 file**
  (chromium + firefox). Spec discovered.
- Optional live sanity (stack up on :8080/:5173, seeder user present):
  - chromium — **1 passed (2.8s)**
  - firefox — **1 passed (3.9s)**
  This satisfies the human-verify checkpoint condition (MATCH + NOT-FOUND on both
  browsers); treated as orchestrator-approved per the execution mandate.

## Coverage Notes / Residues

- The spec covers the **MANUAL-entry** path only — a real camera (live decode), the torch
  toggle, and haptic feedback remain **device-only human-UAT residues** (cannot be driven
  in CI). Manual entry funnels through the same `useScanResolve.handleResolveCode` as a
  live decode, so the lookup → banner contract is still fully guarded.
- Run this spec ISOLATED (`npx playwright test e2e/scan-lookup.spec.ts`); batching with the
  other auth-heavy live specs trips the 20/min auth limiter.

## Live-Backend Defects

None observed. The real by-barcode endpoint behaved exactly per contract (200 for the
seeded code with the correct item id, 404 for the absent code), and the workspace-scoped
lookup matched the seeded item.

## Self-Check: PASSED
- `frontend2/e2e/scan-lookup.spec.ts` — FOUND
- `frontend2/src/locales/en/messages.po` (Phase 11 scan msgids) — FOUND
- commit `88ee9991` — FOUND
- commit `a9cd7b60` — FOUND
