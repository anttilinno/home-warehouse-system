# Phase 65 Bundle Baseline (pre-phase snapshot)

**Captured:** 2026-04-19 09:21:30 UTC
**Source commit:** b04ae7c28be657ec2b938c7fba13154f106093a1 (master HEAD post-Phase-64-10)
**Source tree status (frontend2/):** clean — all dirty files at capture time (`M .planning/ROADMAP.md`, `M .planning/STATE.md`, `?? .planning/phases/65-item-lookup-and-not-found-flow/`) are planning-only artifacts outside `frontend2/`; the `frontend2/src/` build input matches the committed tree at b04ae7c exactly.
**Build command:** `cd frontend2 && bun run build` (runs `bun run lint:imports && tsc -b && vite build`)
**Tooling versions:**
  - node: v24.14.1
  - bun: 1.3.12
  - vite: 8.0.8 (linux-x64)
**Gzip measurement method:** `gzip -c <file> | wc -c` on the plain `.js` file (deterministic, reproducible by Plan 65-08 Task 3 with the same invocation).

## Chunk sizes

| Chunk | File | Raw bytes | gzip bytes |
|-------|------|-----------|------------|
| main | dist/assets/index-CgNjjzTO.js | 497192 | 135754 |
| scanner | dist/assets/scanner-CLRWiLFx.js | 147102 | 58057 |

## Vite-reported gzip (cross-check only — NOT the gate)

Vite's own `computing gzip size` report from the same build:
  - `dist/assets/index-CgNjjzTO.js` — 497.19 kB raw / 136.89 kB gzip
  - `dist/assets/scanner-CLRWiLFx.js` — 147.10 kB raw / 58.88 kB gzip

These are close but not byte-identical to `gzip -c | wc -c` (Vite uses a different compression level / internal implementation). **Plan 65-08 MUST use the same `gzip -c | wc -c` method** documented below — not Vite's self-reported numbers — so the comparison is apples-to-apples.

## Gate for Plan 65-08

- `scanner chunk gzip` AFTER Phase 65 ships MUST be ≤ **58057 bytes** (zero regression tolerance — Phase 64 shipped main-chunk gzip −37.8 kB vs pre-Phase-64 baseline and that win MUST be preserved; Phase 65 production code must NOT leak into the scanner chunk via `manualChunks` misgrouping or `barcode.ts`-pulls-scanner-dep regressions).
- `main index chunk gzip` AFTER Phase 65 ships MUST be ≤ **135754 + 5120 = 140874 bytes** (≤ 5 kB main-chunk delta per 65-CONTEXT `<code_context>` budget: Phase 65 adds `ItemFormPage`, `UpcSuggestionBanner`, `useBarcodeEnrichment`, `lib/api/barcode.ts` plus widened `ScanResultBanner` — total ≤ 5 kB gzip delta tolerance).

## Reproducibility

Plan 65-08 Task 3 MUST:

1. Run `cd frontend2 && bun run build` from the post-Phase-65 HEAD.
2. Identify the hashed main-chunk filename pattern `dist/assets/index-*.js` and scanner-chunk `dist/assets/scanner-*.js`.
3. Run:
   ```bash
   gzip -c dist/assets/index-<NEW-HASH>.js | wc -c   # → main gzip AFTER
   gzip -c dist/assets/scanner-<NEW-HASH>.js | wc -c # → scanner gzip AFTER
   ```
4. Record both absolute numbers + the delta vs the baseline captured here in `65-08-SUMMARY.md`.
5. Fail the plan if either gate threshold is exceeded.

## Notes

- `manualChunks` in `frontend2/vite.config.ts` groups `@yudiel/react-qr-scanner`, `barcode-detector`, `zxing-wasm`, `webrtc-adapter` into the `scanner` chunk. Any Phase 65 import of these modules from non-scan code paths would cause the scanner chunk to grow beyond baseline — the gate catches that class of regression.
- The main `index` chunk currently bundles retro atoms, all non-scan features (items / loans / borrowers / categories / locations / containers), TanStack Query, Lingui runtime, react-router, react-hook-form, zod. Phase 65 adds `ItemFormPage` + `UpcSuggestionBanner` + `useBarcodeEnrichment` + `lib/api/barcode.ts` — all destined for the main chunk (none are scanner-chunk members).
- Separate Lingui message-chunk files (`messages-*.js`) are NOT gated — they are per-locale, loaded on demand, and Phase 65 i18n gap-fill (Plan 65-08) will grow them proportionally to the ~15 new msgids.

---

## POST-PHASE-65 measurements

**Captured:** 2026-04-19 10:29:40 UTC
**Source commit:** `003c163a7f7a5628409f3ed0de04dd360c98bafe` (HEAD of master after Plan 65-08 Task 2 — `chore(65-08): fill Estonian translations for Phase 65 msgids`; Task 3 measurement runs on this tree pre-final-commit)
**Build command:** `cd frontend2 && bun run build`
**Tooling versions:** same as pre-phase baseline (node v24.14.1, bun 1.3.12, vite 8.0.8) — no lockfile churn mid-phase.
**Gzip measurement method:** `gzip -c <file> | wc -c` on the plain `.js` file (identical to Plan 65-01 baseline — apples-to-apples).

### Chunk sizes (post-Phase-65)

| Chunk | File | Raw bytes | gzip bytes |
|-------|------|-----------|------------|
| main | dist/assets/index-ChvbQJeu.js | 429179 | 114418 |
| scanner | dist/assets/scanner-CLRWiLFx.js | 147102 | 58057 |
| scan (new split) | dist/assets/scan-Dju4dEQ1.js | 184095 | 61534 |
| ScanPage (route-lazy) | dist/assets/ScanPage-NiCfBQCY.js | 16938 | 5605 |

The scanner chunk filename hash (`CLRWiLFx`) is byte-identical to the pre-phase baseline — Plan 65-08 did not touch any scanner-chunk input; the manualChunks grouping and scanner-dep imports are unchanged. The rolldown toolchain produced identical output for that chunk.

### Delta analysis vs Plan 65-01 baseline

| Chunk | Pre bytes (gzip) | Post bytes (gzip) | Delta (gzip) | Gate |
|-------|------------------|-------------------|--------------|------|
| main | 135754 | 114418 | **−21,336** (−15.72%) | PASS (budget ≤ +5120) |
| scanner | 58057 | 58057 | **0** (0.00%) | PASS (budget ≤ 0) |

The main chunk SHRANK by 21.3 kB gzip. Plan 65-07 introduced a React.lazy route split that moved the scan-feature application code (ScanPage + its siblings) into a new on-demand `scan-*.js` chunk (61.5 kB gzip), and a separate `ScanPage-*.js` route-lazy chunk (5.6 kB gzip). Neither is on the first-load path for non-scan routes — they load when the user navigates to `/scan`. Phase 65's additions (`ItemFormPage`, `UpcSuggestionBanner`, `useBarcodeEnrichment`, `lib/api/barcode.ts`, widened `ScanResultBanner`, new BRAND field) landed inside the main chunk yet the net delta is strongly negative because the split offset them.

### Chunk boundary verification (Pitfall #7)

```
$ grep -oE 'yudiel|zxing-wasm|barcode-detector|webrtc-adapter|zxing' dist/assets/index-*.js | sort -u
(empty — PASS: no scanner dep leaked into main)

$ grep -oE 'zxing' dist/assets/scanner-*.js | sort -u
zxing
(scanner deps isolated — PASS)

$ grep -oE 'yudiel|zxing-wasm|barcode-detector|webrtc-adapter|zxing' dist/assets/scan-*.js | sort -u
(empty — PASS: new scan chunk holds application code only, scanner deps stay in scanner-*.js)
```

Pitfall #7 (`useBarcodeEnrichment` accidentally imported from `features/scan/**` pulling enrichment code into scanner chunk) is NOT triggered — the scanner chunk's byte-identical hash confirms zero content drift.

## Gate result

PASS

Both the scanner-zero-regression gate and the ≤5 kB main-delta budget pass with large margin. Phase 65 shipped LOOK-01/02/03 with a net main-chunk reduction of 21.3 kB gzip relative to the pre-phase baseline.

## Notes

- The `scan-*.js` split chunk is a net win: ScanPage + its features no longer load on first paint for any non-scan route. A user landing on `/items` or `/` never downloads the 61.5 kB scan chunk.
- Message-chunk files grew by the expected small amount for 16 new msgids:
  - `messages-RHceV1uj.js` (EN) — 8.45 kB gzip (was 7.90 kB @ baseline → +560 bytes)
  - `messages-FoShxNE6.js` (ET) — 8.14 kB gzip (was 8.20 kB @ baseline → −60 bytes, within noise)
  These load on demand per locale and are out of scope for the main-chunk gate.
- Test suite post-phase: **99 files / 710 tests passed / 0 failures / 0 todos** (was 710/0 post-65-07 — no Plan 65-08 test-surface changes; i18n-only plan).
- `bunx tsc -b --noEmit` clean; `bun run lint:imports` OK.
