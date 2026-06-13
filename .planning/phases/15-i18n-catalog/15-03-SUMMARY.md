---
phase: 15-i18n-catalog
plan: 03
subsystem: i18n
tags: [i18n, l10n, estonian, catalog, lingui]
requires: [15-01, 15-02]
provides: ["Complete Estonian Lingui catalog (locales/et/messages.po, 1010 msgstr filled)"]
affects: [frontend2-localization]
tech-stack:
  added: []
  patterns: ["lift-then-translate: legacy next-intl et.json values reused where English source matched, remainder hand-translated"]
key-files:
  created: []
  modified:
    - frontend2/src/locales/et/messages.po
decisions:
  - "One Estonian term per domain noun, reused everywhere: ese (item), asukoht (location), konteiner (container), laenutus/laen (loan), laenaja (borrower), tööruum (workspace), kategooria (category), silt (label), remont (repair), hooldus (maintenance), soovinimekiri (wishlist), laoseis/laokirje (inventory/stock entry)."
  - "Lift only when ICU placeholder sets matched exactly; legacy values with divergent placeholders were hand-translated to the Lingui msgid's exact tokens instead of blindly lifted."
metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 15 Plan 03: Fill the Estonian Catalog Summary

Filled every empty `msgstr` in `frontend2/src/locales/et/messages.po` (1010
non-header entries) with native, idiomatic Estonian for the warehouse/inventory
UI: 105 lifted verbatim from the legacy next-intl `et.json` (English-leaf →
Estonian-leaf map), 905 hand-translated. Catalog guard `--only et` exits 0;
full frontend gate green.

## What was built

- **Lift map (Task 1):** A throwaway `/tmp` node script walked
  `frontend/messages/en.json` + `frontend/messages/et.json` in parallel
  (identical key trees, 1282 leaves each) to build an English-value →
  Estonian-value map. For each po entry whose msgid (English source) exactly
  matched a legacy English value AND whose ICU placeholder set matched, the
  Estonian leaf was lifted. **105 entries lifted.**
- **Hand translation (Task 2):** The remaining 905 entries were translated by
  hand into idiomatic Estonian, keeping one term per domain noun (see
  decisions). **905 entries hand-filled.**
- Total: **1010 msgstr filled, 0 empty** (the header `msgstr ""` on line 2 is
  empty by design and excluded by the guard).

## Verification

- `node scripts/check-i18n-catalog.mjs --only et` →
  `check-i18n-catalog: OK (1010 msgids, parity + full coverage across en + et)`
  — **exit 0**.
- `bun run lint:tsc` — green.
- `bun run test` — **174 files, 1120 tests passed**.
- `bun run build` — green; the et `messages` chunk compiles to 35.42 kB
  (matching the en chunk, confirming the catalog is well-formed and complete).
- `bun run lint:imports` — green.
- ICU placeholder spot-checks confirmed verbatim preservation, e.g.
  `{0} created.` → `{0} loodud.`; `{0} — loaned to {1}.` →
  `{0} — laenatud: {1}.`; `page {page} of {pageCount} · {perPage} / page` →
  `leht {page} / {pageCount} · {perPage} / leht`.

## Single-writer / contract compliance

- Only `frontend2/src/locales/et/messages.po` was modified (`git status` clean
  otherwise). The ru po (15-04) was not touched; no src/lib, scripts, STATE, or
  ROADMAP edits.
- Only `msgstr` lines were edited — `git diff` shows zero changes to any
  `msgid`, source-reference comment (`#:`), or po header line. Entry order and
  the Lingui fold are byte-identical (body msgids are all single-line; only the
  header is folded, and it was left untouched).
- et/en msgid parity intact (1010 each).
- The throwaway lift/transform scripts live under `/tmp` only — none landed in
  the repo.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `frontend2/src/locales/et/messages.po` — FOUND, modified, 0 empty body msgstr.
- `node scripts/check-i18n-catalog.mjs --only et` — exit 0 confirmed.
