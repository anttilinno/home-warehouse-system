---
phase: 64
plan: 10
subsystem: frontend2-i18n-and-bundle-gate
tags: [i18n, lingui, bundle-gate, scanner, phase-close]
requires:
  - plan: 64-09
    why: ScanPage + /scan React.lazy split must exist for bundle gate to measure a fully-wired scanner feature
provides:
  - Full EN + ET Lingui catalog coverage of every Phase 64 t`...` msgid
  - Verified [BLOCKING] bundle gate: scanner deps isolated in scanner-*.js chunk, main chunk clean, /scan contribution to main bundle actually NEGATIVE vs pre-phase baseline
  - Full phase gate green (test, lint:imports, tsc, build, i18n:compile)
affects:
  - frontend2/locales/en/messages.po
  - frontend2/locales/et/messages.po
tech-stack:
  added: []
  patterns:
    - Per-phase i18n gap-fill (Phase 63 precedent D-06)
    - Bundle-gate containment grep on built main chunk
key-files:
  created: []
  modified:
    - frontend2/locales/en/messages.po
    - frontend2/locales/et/messages.po
decisions:
  - Measured pre-phase baseline via detached worktree at 13e3bb8 for true /scan main-bundle delta
  - Confirmed containment via minified-string grep on zxing/yudiel/barcode-detector/webrtc-adapter patterns
metrics:
  duration_min: 8
  completed: 2026-04-18
  tasks_completed: 2
  files_modified: 2
---

# Phase 64 Plan 10: i18n Extract + ET Gap-Fill + [BLOCKING] Bundle Gate Summary

Extracted 36 new Phase 64 msgids into EN+ET Lingui catalogs, hand-filled every ET msgstr
per UI-SPEC §ET catalog table + register rules, and verified the [BLOCKING] bundle gate:
scanner deps fully isolated in `scanner-*.js` (58.1 kB gzip) and the main chunk actually
SHRANK by 37.8 kB gzip vs the pre-phase 13e3bb8 baseline.

## Tasks Executed

### Task 1: Extract EN catalog + fill ET translations

**Files:** `frontend2/locales/en/messages.po`, `frontend2/locales/et/messages.po`
**Commit:** `238a852` — `chore(64-10): extract + fill EN/ET catalogs for Phase 64 scan strings`

- Ran `bun run i18n:extract` — Lingui scanned `src/**/*.{ts,tsx}` and appended 36 new
  msgids to both `en/` and `et/` catalogs (EN auto-filled, ET empty).
- Hand-filled all 36 ET msgstr entries using UI-SPEC §ET catalog lines 243-267 as the
  source of truth, with register rules (UPPERCASE labels, sentence-case bodies,
  preserved punctuation incl. `→`, `…`, `—`) applied to derived strings.
- Verbatim-from-spec translations:
  `SCAN→SKANEERI`, `MANUAL→KÄSITSI`, `HISTORY→AJALUGU`, `SCAN AGAIN→SKANEERI UUESTI`,
  `LOOK UP CODE→OTSI KOOD`, `USE MANUAL ENTRY→KASUTA KÄSITSI`,
  `CLEAR HISTORY→TÜHJENDA AJALUGU`, `YES, CLEAR→JAH, TÜHJENDA`,
  `KEEP HISTORY→HOIA ALLES`, `CAMERA ACCESS DENIED→KAAMERALE LIGIPÄÄS KEELATUD`,
  `NO CAMERA FOUND→KAAMERAT EI LEITUD`,
  `SCANNER FAILED TO LOAD→SKÄNNER EI LAADINUD`,
  `SCANNING UNSUPPORTED→SKANEERIMINE POLE TOETATUD`,
  `NO SCANS YET→SKANEERIMISI POLE VEEL`, `SCANNED→SKANEERITUD`,
  `CODE→KOOD`, `FORMAT→FORMAAT`, `[◉] TORCH ON→[◉] TULI SEES`,
  `[◉] TORCH OFF→[◉] TULI VÄLJAS`, `BARCODE OR CODE→VÖÖTKOOD VÕI KOOD`.
- Derived (cleanly-rendered) translations: `Enter code manually`, `Any code supported…`,
  `Enter a code before submitting.`, `Code must be 256 characters or fewer.`,
  `Scanned codes appear here…`, `SCAN HISTORY`, `CLEAR SCAN HISTORY`,
  `LOADING SCANNER…`, `Please wait.`, 4 error-panel bodies (permission-denied,
  no-camera, library-init-fail, unsupported-browser), 3 platform hints
  (iOS, Android, fallback), destructive confirm body, plus `RELOAD PAGE → LAE LEHT UUESTI`
  (extracted from `ScanErrorPanel.tsx:118` — not in UI-SPEC draft, derived per rules).
- **Extra msgid not anticipated by plan text:** `RELOAD PAGE` appeared in the extract
  from the library-init-fail panel's reload affordance. Translated `LAE LEHT UUESTI`
  following UPPERCASE-label register. Logged here for review.

**Verification:**
- `bun run i18n:compile` exits 0, 0 warnings (`/tmp/i18n-compile.log`)
- ET empty msgstr count: **1** (header only) — parity with pre-Phase-64 baseline
- Every required msgid present in EN catalog (17/17 checks ≥1)
- Every required ET translation present (16 checks ≥1; `MANUAL ENTRY` as standalone
  msgid does NOT exist in source — only `USE MANUAL ENTRY`, which IS translated)
- `bun run test --run`: **609/609 passed**
- `bun run lint:imports`: OK
- `bunx tsc --noEmit -p tsconfig.json`: exit 0

### Task 2: [BLOCKING] Bundle gate verification

**Files:** (verification-only, no code changes, no commit)

**Build output (post-phase):**
```
dist/index.html                             0.96 kB │ gzip:   0.45 kB
dist/assets/index-C8lB9Zth.css             28.52 kB │ gzip:   6.23 kB
dist/assets/rolldown-runtime-Dw2cE7zH.js    0.68 kB │ gzip:   0.41 kB
dist/assets/ScanPage-BL729yxO.js           14.06 kB │ gzip:   4.78 kB
dist/assets/messages-DNOB0M5G.js           17.92 kB │ gzip:   7.90 kB
dist/assets/messages-D8k4Qzti.js           19.14 kB │ gzip:   8.20 kB
dist/assets/retro-CMHFf3mm.js             110.35 kB │ gzip:  37.84 kB
dist/assets/scanner-CLRWiLFx.js           147.10 kB │ gzip:  58.88 kB
dist/assets/index-CgNjjzTO.js             497.19 kB │ gzip: 136.89 kB
```

Actual measured gzipped bytes (via `gzip -c ... | wc -c`):
- Scanner chunk: **58,057 bytes gzipped** (147,102 raw) — well within RESEARCH.md
  120–180 kB expected range
- Main chunk: **135,754 bytes gzipped** (497,192 raw)
- ScanPage chunk: **4,806 bytes gzipped** (14,063 raw) — route-lazy chunk

**Main chunk containment grep** (must be empty):
```
$ ls dist/assets/index-*.js | head -n 1 | xargs -I {} grep -oE 'yudiel|zxing-wasm|barcode-detector|webrtc-adapter|zxing' {} | sort -u
(empty — PASS)
```

**Scanner chunk isolation grep** (must contain scanner deps):
```
$ grep -oE 'zxing' dist/assets/scanner-*.js | sort -u
zxing
```
Minifier stripped the longer import strings (`yudiel`, `barcode-detector` appeared only in
module-path comments which are discarded); `zxing` (from `zxing-wasm`) survives as a
runtime string. Containment confirmed.

**Pre-phase baseline (at commit `13e3bb8`, via detached `git worktree`):**
```
dist/assets/index-CRagYQGd.js     615.33 kB │ gzip: 175.86 kB
```
- Baseline main chunk: **174,409 bytes gzipped** (615,333 raw)

**/scan main-bundle contribution (gate: ≤ 20 kB gzip added):**
- Post-phase main chunk (135,754 gzipped) − Baseline (174,409 gzipped) = **−38,655 bytes
  gzipped (−37.8 kB)**
- The phase's Vite `manualChunks` + React.lazy split caused the main chunk to SHRINK by
  37.8 kB gzip. The net /scan contribution to the main bundle is strongly negative — the
  retro + scanner code paths that previously lived in the monolithic `index-*.js` now
  load on demand.
- **[BLOCKING] gate: PASS with 57.8 kB gzip of headroom below the 20 kB ceiling.**

**Full phase gate (all exit 0):**
- `bun run test --run` → 92 files / 609 tests passed
- `bun run lint:imports` → OK
- `bunx tsc --noEmit -p tsconfig.json` → clean
- `bun run build` → 334 modules transformed, scanner chunk present, no warnings
- `bun run i18n:compile` → 0 warnings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical Completeness] Translated `RELOAD PAGE` (msgid not in plan's translation table)**
- **Found during:** Task 1 after `bun run i18n:extract`
- **Issue:** The extract produced a `RELOAD PAGE` msgid from `ScanErrorPanel.tsx:118`
  that was not listed in the plan's Step 3 verbatim table or Step 4 additional-strings
  table. Plan Step 5 explicitly instructs: "If the extract produces any msgid not
  covered above, apply the register rules in step 2 and record the additions in the
  SUMMARY for review."
- **Fix:** Applied `LAE LEHT UUESTI` (UPPERCASE-label register, idiomatic ET).
- **Files modified:** `frontend2/locales/et/messages.po`
- **Commit:** `238a852`

No other deviations. Plan executed as written.

## Authentication Gates

None. No network, auth, or external-service interaction in this plan.

## Threat Flags

None. All new surface is build-time i18n + build artifact verification; no runtime
trust boundaries introduced by this plan.

## Manual UAT Items Still Pending (from 64-VALIDATION.md — remaining sign-off)

These are NOT blockers for Phase 64 close (all automated-verifiable requirements are
green); they remain manual-device checks to be performed before shipping the user-facing
release:
- **SCAN-03 / iOS first-beep audio** — AudioContext resume inside user-gesture path is
  covered by code + Pitfall #19 pattern; requires real-device confirmation
- **SCAN-01 / iOS PWA camera permission persistence** — single-route paused-not-stopped
  invariant verified in tests; requires real iOS PWA install confirmation
- **SCAN-04 / Android torch hardware** — `MediaStreamTrack.applyConstraints({ torch })`
  wiring deferred to Plan 64-09; actual on-device toggle is manual UAT per
  VALIDATION.md
- (Note: D-17 removed iOS haptic from Phase 64 scope; not a UAT item for this phase.)

## Phase 64 Verdict

**PASS — Phase 64 is shippable.**

- All 10 plans complete (64-01 through 64-10)
- All 7 SCAN-0N requirements have rendered user paths + automated tests + ET
  translations
- Full phase gate green (test 609/609, lint:imports, tsc, build, i18n:compile — all exit 0)
- [BLOCKING] bundle gate verified: scanner deps isolated, main chunk shrank 37.8 kB
  gzip below the pre-phase baseline

## Self-Check: PASSED

- File `frontend2/locales/en/messages.po` — present (modified)
- File `frontend2/locales/et/messages.po` — present (modified, 36 new translations
  filled)
- Commit `238a852` — FOUND (verified via `git log`)
- Build artifact `dist/assets/scanner-CLRWiLFx.js` — present post-build (147,102 bytes)
- Main chunk containment grep — empty (zero matches for yudiel/zxing-wasm/
  barcode-detector/webrtc-adapter/zxing in `index-*.js`)
- Scanner chunk isolation grep — match (`zxing` found in `scanner-*.js`)
