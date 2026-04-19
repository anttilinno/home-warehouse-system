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
