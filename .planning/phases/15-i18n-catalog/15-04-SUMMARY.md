---
phase: 15-i18n-catalog
plan: 04
subsystem: i18n
tags: [i18n, locales, ru, catalog, lingui]
requires: [15-01, 15-02]
provides: ["Complete Russian Lingui catalog (locales/ru/messages.po, 1010 msgstr filled)"]
affects: [I18N-01]
tech-stack:
  added: []
  patterns: ["Lingui .po catalog filled by lift-from-legacy + native technical-UI translation"]
key-files:
  created: []
  modified:
    - frontend2/src/locales/ru/messages.po
decisions:
  - "Lifted 105 msgstr from legacy next-intl ru.json by exact English-leaf-value match; hand-translated the remaining 905 natively (legacy overlap is mostly marketing/landing copy, the Lingui catalog is app-UI)."
  - "Consistent domain terminology: item=предмет, inventory entry=складская запись, location=местоположение, container=контейнер, loan=выдача, borrower=получатель, workspace=рабочее пространство."
metrics:
  duration: ~25m
  completed: 2026-06-13
---

# Phase 15 Plan 04: Fill Russian Catalog Summary

Filled all 1010 empty `msgstr` entries in `frontend2/src/locales/ru/messages.po`
with correct, idiomatic technical-UI Russian for the warehouse/inventory app —
105 lifted verbatim from the legacy next-intl `ru.json`, 905 hand-translated —
with every ICU placeholder preserved and msgid/comment/header bytes untouched.

## What was built

- Built an English-leaf-value → Russian-leaf-value map by walking
  `frontend/messages/en.json` + `frontend/messages/ru.json` in parallel
  (identical key trees, 1282 leaf pairs).
- Lifted the **105** Lingui msgids whose English source exactly matched a legacy
  English leaf (placeholder-parity guarded — a lift was only applied when its
  `{var}` token set matched the msgid's exactly).
- Hand-translated the remaining **905** msgids natively. The legacy catalog is
  predominantly marketing/landing copy, while the refreshed Lingui catalog is
  app-UI (buttons, dialogs, table headers, validation, empty states, toasts),
  so the exact-English overlap is small by construction.
- Applied via a throwaway read-transform-write node script (placed in `/tmp`,
  removed after use — nothing extra landed in the repo). The transform only ever
  rewrites the single `msgstr ""` line that immediately follows a non-header
  `msgid`; all `msgid`, `#:` source-comment, and header lines are copied
  byte-for-byte.

## Verification

- `node scripts/check-i18n-catalog.mjs --only ru` →
  `check-i18n-catalog: OK (1010 msgids, parity + full coverage across en + ru)`,
  **exit 0** (zero empty ru msgstr excluding header + full ru/en msgid parity).
- `git diff` on the po file: **2020** changed lines, **100% `msgstr`** (1010
  removed empty `msgstr ""` + 1010 added filled). Zero `msgid`/comment/header
  lines changed; every removed line was an empty `msgstr ""`.
- ICU spot-checks confirmed verbatim placeholder preservation, e.g.
  `{0} — loaned to {1}.` → `{0} — выдано получателю {1}.`,
  `Approved {ok}, {fail} failed.` → `Одобрено: {ok}, не удалось: {fail}.`,
  `page {page} of {pageCount} · {perPage} / page` →
  `страница {page} из {pageCount} · {perPage} / стр.`
- Frontend gate green: `bun run lint:tsc` (clean), `bun run test`
  (174 files / 1120 tests pass), `bun run build` (built), `bun run lint:imports`
  (OK).

## Deviations from Plan

None — plan executed exactly as written. Only `locales/ru/messages.po` modified;
STATE.md / ROADMAP.md / the et sibling catalog untouched, per single-writer (D-8).

## Notes for the orchestrator

- The et locale (15-03) is owned by a parallel plan and may still be empty
  pre-merge — that is not this plan's failure. After both Wave-2 plans merge,
  run the full `node scripts/check-i18n-catalog.mjs` (all three locales) on the
  merged tree to catch any semantic conflict (14b lesson).

## Self-Check: PASSED

- `frontend2/src/locales/ru/messages.po` — FOUND (modified, 1010 msgstr filled).
- `--only ru` guard exit 0 — confirmed.
