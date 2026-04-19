---
phase: 65-item-lookup-and-not-found-flow
plan: 08
subsystem: frontend2-i18n-and-bundle-gate
tags: [i18n, lingui, bundle-gate, blocking, et-gap-fill, release-gate, phase-close]

requires:
  - phase: 65-item-lookup-and-not-found-flow
    provides: "Every new t`...` call across Plans 65-05/06/07 (ScanResultBanner 4 states, UpcSuggestionBanner, ItemFormPage chrome, ItemForm BRAND placeholder)"
  - phase: 64-scanner-foundation-scan-page
    provides: "Plan 64-10 precedent for per-phase Lingui gap-fill + bundle gate method (gzip -c | wc -c)"

provides:
  - Full EN + ET Lingui catalog coverage of every Phase 65 t`...` msgid (16 new msgids — all EN auto-filled, all ET hand-filled)
  - Verified [BLOCKING] release gate — scanner chunk BYTE-IDENTICAL to pre-phase baseline (zero content drift); main chunk SHRANK 21.3 kB gzip below baseline (negative delta — well under +5 kB budget)
  - Test suite green 710/710, lint:imports OK, typecheck clean, i18n:compile 0 warnings, production build successful
  - Updated .planning/phases/65-item-lookup-and-not-found-flow/65-BUNDLE-BASELINE.md with POST-PHASE-65 measurements + PASS verdict

affects: [65, 66, 71, 72]

tech-stack:
  added: []
  patterns:
    - "Per-phase Lingui extract + ET gap-fill (Phase 63/64 precedent extended to Phase 65)"
    - "Bundle-gate containment grep on built scanner + main + new split chunks (scanner deps must NOT leak into non-scanner chunks)"
    - "gzip -c <file> | wc -c as the single authoritative bundle-measurement method (reproducible across Plan 65-01 baseline capture and Plan 65-08 post-phase measurement)"

key-files:
  created: []
  modified:
    - "frontend2/locales/en/messages.po — 16 new msgids extracted from Plans 65-05/06/07 (msgstr auto-filled to match msgid for EN source)"
    - "frontend2/locales/et/messages.po — 16 ET translations filled (15 from plan starting-point table + 1 Rule 2 auto-fix for CANCEL)"
    - ".planning/phases/65-item-lookup-and-not-found-flow/65-BUNDLE-BASELINE.md — POST-PHASE-65 measurements section + PASS verdict appended"

key-decisions:
  - "ET translations applied verbatim from plan's suggested starting-point table (the plan explicitly says 'developer-tunable — the table above is a STARTING POINT'); orchestrator deferred user review to post-phase diff inspection"
  - "Rule 2 auto-fix: CANCEL msgid was absent from master HEAD b04ae7c catalog despite plan tagging it as 'already reused from Phase 60/57' — added TÜHISTA translation to keep form-chrome register consistent with DISCARD/DISCARD CHANGES?/← BACK"
  - "Bundle gate PASS with large margin: main −21.3 kB gzip (Plan 65-07 React.lazy split offset Phase 65 additions by 4x); scanner byte-identical to baseline (CLRWiLFx hash unchanged — zero content drift)"

patterns-established:
  - "ET gap-fill idiom at phase close: pnpm/bun i18n:extract adds new msgids, then translator hand-fills msgstr rows matching msgid register (uppercase imperatives, sentence-case bodies, preserve punctuation like ellipsis/em-dash). Plan 64-10 established the pattern, Plan 65-08 extends it, both use the same 'missing=0' lingui extract confirmation"
  - "Bundle-gate measurement isolation: capture baseline at a frozen commit (b04ae7c for Phase 65), re-run identical build command (bun run build) + identical measurement (gzip -c | wc -c) at phase close, assert pre-defined budget per chunk. The scanner zero-regression gate catches Pitfall #7 class bugs (accidental scanner-chunk growth from misplaced imports)"
  - "Chunk boundary grep verification: after build, grep the main chunk for scanner-dep strings (yudiel/zxing-wasm/barcode-detector/webrtc-adapter/zxing) — MUST be empty. Grep the scanner chunk for the same strings — MUST contain at least one. Grep any new split chunks — MUST NOT leak scanner deps"

requirements-completed: [LOOK-01, LOOK-02, LOOK-03]

# Metrics
duration: 12min
completed: 2026-04-19
---

# Phase 65 Plan 08: i18n Extract + ET Gap-Fill + [BLOCKING] Release Gate Summary

**Extracted 16 new Phase 65 msgids into EN+ET Lingui catalogs, hand-filled every ET msgstr per the plan's starting-point table (plus one Rule 2 auto-fix for a CANCEL msgid the plan assumed was pre-existing), and verified the [BLOCKING] release gate: scanner chunk byte-identical to baseline (zero drift); main chunk SHRANK 21.3 kB gzip; full suite 710/710 green; Phase 65 LOOK-01/02/03 shippable.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-19T13:23Z (approx — post-orchestrator dispatch)
- **Completed:** 2026-04-19T13:35Z
- **Tasks:** 3 / 3
- **Files modified:** 3 (en/messages.po, et/messages.po, 65-BUNDLE-BASELINE.md)

## Accomplishments

- **Task 1 — i18n extract + EN catalog + zero-orphan compile gate.** `bun run i18n:extract` pulled 16 new msgids from Plans 65-05/06/07 production files (ScanResultBanner.tsx, UpcSuggestionBanner.tsx, ItemFormPage.tsx, ItemForm.tsx). EN catalog auto-filled (msgstr == msgid is the correct EN authoring). `bun run i18n:compile` exits 0 with zero warnings. Zod-literal schema error message "Use letters, numbers, hyphens, or underscores only." (Plan 65-02 D-24) confirmed absent from catalog — non-lingui-wrapped per repo convention. Pre-D-24 "Use letters and numbers only." also absent (extractor cleanly purged). Acceptance grep: SUGGESTIONS AVAILABLE, CREATE ITEM WITH THIS BARCODE, LOOKING UP…, LOOKUP FAILED, NOT FOUND, MATCHED, VIEW ITEM, USE ALL, DISMISS, BRAND — each appears exactly once in en/messages.po (BRAND dedupes ItemForm + UpcSuggestionBanner render sites per D-23).
- **Task 2 — ET translations.** Applied all 15 suggested starting-point translations from the plan's ET table verbatim. Extract-post-fill reported `Missing: 0` for ET catalog. Rule 2 auto-fix surfaced: `CANCEL` (used by ItemFormPage.tsx:127) was NOT in the master HEAD b04ae7c et/messages.po despite the plan tagging it as "already reused from Phase 60/57" — added the idiomatic operator-console-register translation `TÜHISTA` to keep form chrome consistent. `bun run i18n:compile` exits 0 with zero warnings.
- **Task 3 — [BLOCKING] release gate.** Full suite green: `bunx vitest run` → 99 files / 710 tests passed / 0 failed; `bun run lint:imports` → OK; `bunx tsc -b --noEmit` → clean; `bun run i18n:compile` → 0 warnings; `bun run build` → ✓ built in 319ms. Post-phase measurements (method: `gzip -c | wc -c`): main chunk 114,418 B gzip (delta **−21,336 B** vs 135,754 B baseline — PASS ≤ +5120 budget); scanner chunk 58,057 B gzip (delta **0 B** vs 58,057 B baseline — PASS ≤ 0 budget). Scanner chunk filename hash `CLRWiLFx` is BYTE-IDENTICAL to baseline — zero content drift confirms Pitfall #7 not triggered. Main chunk shrank because Plan 65-07's React.lazy route split moved scan-feature application code into new on-demand `scan-Dju4dEQ1.js` (61.5 kB gzip) + `ScanPage-NiCfBQCY.js` (5.6 kB gzip) chunks — neither loads on first paint for non-scan routes. 65-BUNDLE-BASELINE.md appended with POST-PHASE-65 section + delta table + "## Gate result" / `PASS` verdict.

## Task Commits

Each task committed atomically:

1. **Task 1 — Extract Phase 65 i18n strings into EN + ET catalogs** — `66432cd` (chore)
2. **Task 2 — Fill Estonian translations for Phase 65 msgids** — `003c163` (chore)
3. **Task 3 — [BLOCKING] Release gate PASS** — `3f3f239` (chore)

**Plan metadata (this SUMMARY + STATE + ROADMAP):** `{pending}` (docs: complete 65-08 plan)

## Files Created/Modified

### Modified (3)

- `frontend2/locales/en/messages.po` — +16 new msgid entries (auto-extracted). `SUGGESTIONS AVAILABLE`, `BRAND`, `[USE]`, `USE ALL`, `DISMISS`, `Category hint: {0} — pick manually below.`, `MATCHED`, `VIEW ITEM`, `LOOKING UP…`, `NOT FOUND`, `CREATE ITEM WITH THIS BARCODE`, `LOOKUP FAILED`, `No item in this workspace matches this barcode.`, `Could not reach the server. Check your connection and retry, or create a new item with this barcode.`, `e.g. DeWalt`, `CANCEL`. EN catalog total: 509 msgids (was 493). `RETRY`, `NAME`, `Optional` were already in the catalog — Lingui deduped (single entries; the new render sites attach to existing msgids).
- `frontend2/locales/et/messages.po` — 16 msgstr fills (15 from plan table + 1 Rule 2 auto-fix for CANCEL). ET missing count now 0 (was 16 post-extract; 1 post-extract pre-CANCEL-fix). The only remaining empty msgstr is the PO header (msgid "") — parity with Phase 64 baseline.
- `.planning/phases/65-item-lookup-and-not-found-flow/65-BUNDLE-BASELINE.md` — POST-PHASE-65 measurements section appended (post-phase chunk sizes table + delta analysis table vs Plan 65-01 baseline + chunk boundary verification greps + `## Gate result` / `PASS` verdict + notes on the Plan 65-07 split and message-chunk growth).

## Full List of New Msgids Extracted (16 new entries)

| msgid | EN msgstr | ET msgstr | Source |
|-------|-----------|-----------|--------|
| `[USE]` | `[USE]` | `[KASUTA]` | UpcSuggestionBanner.tsx:78, :91 |
| `BRAND` | `BRAND` | `BRÄND` | ItemForm.tsx:157, UpcSuggestionBanner.tsx:85 |
| `CANCEL` | `CANCEL` | `TÜHISTA` (Rule 2 fix) | ItemFormPage.tsx:127 |
| `Category hint: {0} — pick manually below.` | same | `Kategooria vihje: {0} — vali all käsitsi.` | UpcSuggestionBanner.tsx:97 |
| `Could not reach the server. Check your connection and retry, or create a new item with this barcode.` | same | `Serverit ei õnnestunud tabada. Kontrolli ühendust ja proovi uuesti, või loo selle vöötkoodiga uus ese.` | ScanResultBanner.tsx:170 |
| `CREATE ITEM WITH THIS BARCODE` | same | `LOO UUS ESE SELLE VÖÖTKOODIGA` | ScanResultBanner.tsx:194 |
| `DISMISS` | same | `SULGE` | UpcSuggestionBanner.tsx:103 |
| `e.g. DeWalt` | same | `nt DeWalt` | ItemForm.tsx:160 |
| `LOOKING UP…` | same | `OTSIN…` | ScanResultBanner.tsx:90 |
| `LOOKUP FAILED` | same | `OTSING EBAÕNNESTUS` | ScanResultBanner.tsx:95 |
| `MATCHED` | same | `VASTE LEITUD` | ScanResultBanner.tsx:92 |
| `No item in this workspace matches this barcode.` | same | `Selle vöötkoodiga eset ei leitud selles tööruumis.` | ScanResultBanner.tsx:164 |
| `NOT FOUND` | same | `EI LEITUD` | ScanResultBanner.tsx:94 |
| `SUGGESTIONS AVAILABLE` | same | `SOOVITUSED SAADAVAL` | UpcSuggestionBanner.tsx:66 |
| `USE ALL` | same | `KASUTA KÕIK` | UpcSuggestionBanner.tsx:106 |
| `VIEW ITEM` | same | `VAATA ESET` | ScanResultBanner.tsx:184 |

**BRAND dedup confirmation (D-23):** `BRAND` appears **exactly once** in en/messages.po with two source references combined (`ItemForm.tsx:157` + `UpcSuggestionBanner.tsx:85`). Lingui correctly merged both render sites into a single catalog entry; the single EN→ET translation `BRAND → BRÄND` covers both.

**Orphan msgid purged:** Zero. The pre-D-24 string `"Use letters and numbers only."` was never lingui-wrapped in the schema (zod-literal convention preserved per D-24), so no orphan cleanup was needed. Catalog entered and exited Phase 65 with the same number of non-Phase-65 entries.

## Bundle Measurements (post-phase)

**Method:** `gzip -c <file> | wc -c` on the plain `.js` file (deterministic; identical to the Plan 65-01 baseline capture). Build command: `cd frontend2 && bun run build`.

| Chunk | File | Raw bytes | gzip bytes |
|-------|------|-----------|------------|
| main | `dist/assets/index-ChvbQJeu.js` | 429,179 | 114,418 |
| scanner | `dist/assets/scanner-CLRWiLFx.js` | 147,102 | 58,057 |
| scan (new split) | `dist/assets/scan-Dju4dEQ1.js` | 184,095 | 61,534 |
| ScanPage (route-lazy) | `dist/assets/ScanPage-NiCfBQCY.js` | 16,938 | 5,605 |

| Chunk | Pre bytes (gzip) | Post bytes (gzip) | Delta (gzip) | Delta (%) | Gate |
|-------|------------------|-------------------|--------------|-----------|------|
| main | 135,754 | 114,418 | **−21,336 B** | −15.72% | PASS (budget ≤ +5,120 B) |
| scanner | 58,057 | 58,057 | **0 B** | 0.00% | PASS (budget ≤ 0 B) |

**Gate verdict:** PASS with large margin on both chunks. Scanner chunk is byte-identical (same CLRWiLFx hash) confirming zero content drift. Main chunk shrank because Plan 65-07's React.lazy `/scan` route split moved scan-feature application code (ScanPage + its features including the new ScanResultBanner wiring) into the new on-demand `scan-Dju4dEQ1.js` chunk (61.5 kB gzip) plus a separate route-lazy `ScanPage-NiCfBQCY.js` (5.6 kB gzip). Users landing on non-scan routes (`/items`, `/`, `/loans`, etc.) never download the scan chunks on first paint.

## Full `bunx vitest run` Output (summary)

```
 Test Files  99 passed (99)
      Tests  710 passed (710)
   Duration  14.83s
```

**710 passed / 710 total / 0 failed / 0 todos** (unchanged from post-Plan-65-07 count — Plan 65-08 introduced no test-surface changes; i18n-only plan).

## ET Catalog Completeness Confirmation

```
$ bun run i18n:extract
Catalog statistics for locales/{locale}/messages:
┌─────────────┬─────────────┬─────────┐
│ Language    │ Total count │ Missing │
├─────────────┼─────────────┼─────────┤
│ en (source) │     509     │    -    │
│ et          │     509     │    0    │
└─────────────┴─────────────┴─────────┘
```

Every Phase 65 msgid (and every pre-existing msgid) has a non-empty ET msgstr. The only empty msgstr in the ET .po file is the required PO-header `msgid ""` — parity with the Phase 64 baseline state and Lingui convention.

## Decisions Made

- **ET translations applied from plan's starting-point table verbatim.** The plan explicitly framed the ET table as "developer-tunable — the table above is a STARTING POINT matching UI-SPEC tone". Orchestrator directed to apply verbatim and defer any user review to the post-phase diff inspection. No adjustments were made to the plan's suggested translations; they match the retro operator-console register (uppercase imperative labels, sentence-case bodies, preserved ellipsis `…` and em-dash `—` per UI-SPEC §Copywriting Contract).
- **Rule 2 auto-fix for CANCEL.** The plan tagged `CANCEL` as "already reused from Phase 60/57" (no action needed). However, a `git show b04ae7c:frontend2/locales/et/messages.po` search confirmed `CANCEL` was ABSENT from the pre-phase catalog — Phase 65's ItemFormPage.tsx:127 is the first caller to introduce it. Added `TÜHISTA` as the ET translation, matching the operator-console register (sibling to `DISCARD` → `LOOBU`, `DISCARD CHANGES?` → `LOOBU MUUDATUSTEST?`, `← BACK` → `← TAGASI`) so form-chrome reads consistently in ET. Without this fix, the CANCEL button on `/items/new` would have rendered as literal English "CANCEL" on an ET-locale session, failing LOOK-02 acceptance in ET.
- **Task 3 ran in single sequential block.** All five gates (test/lint/typecheck/i18n:compile/build) ran serially rather than in parallel so any failure short-circuits before the expensive `bun run build`. Per 65-RESEARCH.md Pitfall #7, the recommended failure-mode triage (check import graph via `rg "useBarcodeEnrichment" frontend2/src/features/scan/`) was prepared but not invoked — no gate failed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical Completeness] Fill CANCEL msgstr in ET catalog**
- **Found during:** Task 2 — after applying the 15 starting-point ET translations and re-running `bun run i18n:extract`, the report showed `ET missing: 1` instead of the expected `0`. Inspection via `awk` for empty msgstr entries identified `msgid "CANCEL"` at line 357 with an empty msgstr.
- **Issue:** The plan's Task 1 <read_first> note listed `CANCEL` under "already-reused msgids in catalog — DO NOT duplicate ... (all from Phase 60/57)" and its ET-fill table did not include a translation for it. But a `git show b04ae7c:frontend2/locales/et/messages.po | grep CANCEL` confirmed `CANCEL` was ABSENT from the master HEAD baseline catalog. The plan's assumption was incorrect — CANCEL is a NEW msgid introduced by Phase 65's ItemFormPage.tsx:127 (Plan 65-05). Without a translation, the CANCEL button on `/items/new` would render as literal English "CANCEL" in an ET-locale session, failing LOOK-02's i18n acceptance bar.
- **Fix:** Added `msgstr "TÜHISTA"` for `msgid "CANCEL"`. The translation matches the retro operator-console register used elsewhere in the ET catalog (DISCARD → LOOBU; DISCARD CHANGES? → LOOBU MUUDATUSTEST?; ← BACK → ← TAGASI) and is idiomatic Estonian for a destructive-form cancel action.
- **Files modified:** `frontend2/locales/et/messages.po`
- **Verification:** `bun run i18n:extract` now reports `ET missing: 0`; `bun run i18n:compile` exits 0 with zero warnings; the only empty msgstr in the file is the required PO-header `msgid ""`.
- **Committed in:** `003c163` (part of the Task 2 atomic commit — the fix is inseparable from the Task 2 acceptance criterion "every Phase 65 msgid has a non-empty Estonian translation").

---

**Total deviations:** 1 auto-fixed (Rule 2 — critical completeness for a missing ET translation that would have shipped untranslated English in an ET-locale session).
**Impact on plan:** Zero scope creep. The fix is mechanical (add one msgstr line) and required for LOOK-02 ET acceptance.

## Issues Encountered

- **READ-BEFORE-EDIT harness re-reminders fired multiple times during Task 2 ET fills.** The messages.po file was Read earlier in the session with `offset`/`limit` for each target region, but the harness re-reminded on each successive Edit. All 13 sequential Edit calls in one parallel block succeeded per tool confirmations; no actual state drift. Verified by grep-based extraction of each final msgstr after all edits landed.
- **Chunk-split observation vs Plan 65-01 baseline.** The baseline was captured at `b04ae7c` which was master HEAD post-Phase-64-10. Plan 65-07 introduced a React.lazy route split between baseline capture and Plan 65-08 measurement, which produced new `scan-*.js` and `ScanPage-*.js` chunks and shrank the main chunk by 21.3 kB gzip. The gate arithmetic is still sound because (a) the scanner chunk (the zero-regression gate target) is byte-identical, and (b) the main chunk's delta is NEGATIVE — well inside the `+5120 B` ceiling. No investigation needed; the negative delta is a feature of Plan 65-07's split, not a regression.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 65 complete and shippable.** All three LOOK-0N requirements land with:
  - Rendered user paths (scan → match, scan → not-found → create, manual `/items/new?barcode=` with optional UPC enrichment suggestion)
  - Automated tests (710/710 passing)
  - EN + ET Lingui translations for every new msgid
  - No bundle regression (scanner chunk byte-identical; main chunk 21.3 kB gzip lighter than pre-phase)
  - Full phase gate green (test + lint:imports + typecheck + i18n:compile + build all exit 0)
- **Phase 66 unblocked.** QA-01/02/03 can start: QuickActionMenu will replace ScanResultBanner wholesale per the Phase 65 "prop-surface widening is throwaway by design" framing (D-17). LOOK-01 (MATCH → VIEW ITEM → `/items/:id`) and LOOK-02 (NOT-FOUND → CREATE ITEM → `/items/new?barcode=<encoded>`) are end-to-end functional — Phase 66 can freely iterate on the post-scan interaction surface.
- **v2.2 on track.** Phase 65 was plan 157→17 of Phase 65 (8 plans); Phase 64 is complete (10/10); Phases 66–72 remain. No open blockers, no accumulated tech debt from this plan.

## Threat Flags

None. Plan 65-08's surface is build-time i18n + build-artifact verification; no new runtime trust boundaries introduced.

## Self-Check: PASSED

Verified all claims:

- [x] `frontend2/locales/en/messages.po` exists — FOUND (modified; 16 new msgids present)
- [x] `frontend2/locales/et/messages.po` exists — FOUND (modified; 16 ET translations filled)
- [x] `.planning/phases/65-item-lookup-and-not-found-flow/65-BUNDLE-BASELINE.md` exists — FOUND (POST-PHASE-65 section appended)
- [x] `grep -c '^## POST-PHASE-65 measurements$' .planning/phases/65-item-lookup-and-not-found-flow/65-BUNDLE-BASELINE.md` returns 1
- [x] `grep -c '^## Gate result$' .planning/phases/65-item-lookup-and-not-found-flow/65-BUNDLE-BASELINE.md` returns 1
- [x] The line after `## Gate result` reads `PASS`
- [x] `grep -c '^msgid "SUGGESTIONS AVAILABLE"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "CREATE ITEM WITH THIS BARCODE"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "LOOKING UP…"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "LOOKUP FAILED"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "NOT FOUND"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "MATCHED"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "VIEW ITEM"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "USE ALL"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "DISMISS"$' frontend2/locales/en/messages.po` returns 1
- [x] `grep -c '^msgid "BRAND"$' frontend2/locales/en/messages.po` returns 1 (D-23 dedup — single entry covers ItemForm + UpcSuggestionBanner)
- [x] `grep -c "Use letters, numbers, hyphens, or underscores only\." frontend2/locales/en/messages.po` returns 0 (zod literal NOT extracted — repo convention preserved)
- [x] `bun run i18n:extract` reports `ET missing: 0`
- [x] `bun run i18n:compile` exits 0 with zero warnings
- [x] `bunx vitest run` — 99 files / 710 passed / 0 failed
- [x] `bun run lint:imports` — OK
- [x] `bunx tsc -b --noEmit` — clean
- [x] `bun run build` — exit 0 (✓ built in 319ms)
- [x] Scanner chunk gzip 58,057 B = baseline 58,057 B (delta 0 — PASS zero-regression)
- [x] Main chunk gzip 114,418 B ≤ baseline 135,754 B + 5,120 B budget (delta −21,336 B — PASS main budget)
- [x] Commits `66432cd` (Task 1), `003c163` (Task 2), `3f3f239` (Task 3) all exist in `git log --oneline`

---

*Phase: 65-item-lookup-and-not-found-flow*
*Plan: 08*
*Completed: 2026-04-19*
*Resume signal: et-fill-approved-65-08 (implicit — orchestrator directed starting-point table application without user pause)*
