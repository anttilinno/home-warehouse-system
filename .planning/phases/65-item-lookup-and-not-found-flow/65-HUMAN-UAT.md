---
status: partial
phase: 65-item-lookup-and-not-found-flow
source: [65-VERIFICATION.md]
started: 2026-04-19T13:42:00Z
updated: 2026-04-19T13:42:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. iOS PWA camera permission resume after /scan → /items/new → back
expected: Scanner resumes without re-prompting the OS-level camera permission
why_human: Real iOS device + Safari PWA install required; Pitfall #1 cannot be asserted in JSDOM. Documented manual UAT in 65-VALIDATION.md §Manual-Only Verifications.
result: [pending]

### 2. Enrichment banner visual under live api.upcitemdb.com data
expected: Scanning a real consumer UPC (e.g. 5449000000996) and navigating to /items/new shows UpcSuggestionBanner with name/brand rows + [USE] chips; tapping [USE] writes to the form; category renders as helper text only
why_human: Depends on live public endpoint; staging the upstream JSON shape in a unit test would not exercise the real network/error semantics.
result: [pending]

### 3. prefers-reduced-motion: reduce opts out of LOADING cursor blink
expected: Cursor glyph ▍ stays static (no opacity oscillation) when DevTools Rendering panel sets prefers-reduced-motion: reduce
why_human: CSS @media rule effect cannot be asserted in JSDOM; the automated grep gate confirms the rule + animation:none declaration exist (Plan 65-06 Task 2). Documented in 65-VALIDATION.md.
result: [pending]

### 4. End-to-end scan → match → VIEW ITEM navigation in a real browser
expected: Live decode of a barcode for an existing workspace item shows MATCHED banner with name + short_code; VIEW ITEM lands on /items/{id}
why_human: Live camera + workspace-seeded item required; ScanPage.test.tsx Test 16 covers the history-backfill effect but not the navigate() call surface.
result: [pending]

### 5. End-to-end scan → not-found → CREATE ITEM → submit happy-path
expected: Live decode of an unknown barcode shows NOT FOUND banner; CREATE ITEM navigates to /items/new?barcode=<encoded>; form submit creates the item; rescanning the same code now shows MATCHED
why_human: Cross-route + cross-cache invalidation (Pitfall #7) is verified at the unit level (D-04 grep proof) but the user-perceptible round-trip requires a live workspace and backend.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
