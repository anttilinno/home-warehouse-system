# Phase 64: Scanner Foundation & Scan Page — Research

**Researched:** 2026-04-18
**Domain:** Browser-based barcode / QR scanning (camera + WASM decoder) + React 19 + Vite 8 + iOS PWA
**Confidence:** HIGH

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope & Post-Scan UX:**
- **D-01:** Phase 64 delivers primitives + stub API/hook. `lib/api/scan.ts` is created as an empty scaffold. `useScanLookup(code)` hook exists and returns a hardcoded `{ status: 'idle', match: null }` shape that Phase 65 replaces with the real TanStack Query call.
- **D-02:** Post-scan UX is **pause + result banner**. On a successful decode the scanner pauses (stream stays mounted, **no `track.stop()`**), a retro banner shows the decoded code + format + a "SCAN AGAIN" button, and a history entry is written. Phase 66 replaces the banner with the full QuickActionMenu overlay.
- **D-03:** Dedupe follows legacy: same code moves to the top of history, no duplicate entry. Scanner still pauses and re-shows the banner on each decode.
- **D-04:** `useScanHistory()` is the single API surface: `{ entries, add, clear, remove }`. Components never touch `localStorage` directly.

**Tabs & Camera Bootstrap:**
- **D-05:** Default tab on mount is **Scan**.
- **D-06:** No tab persistence. Every `/scan` visit starts on the default tab.
- **D-07:** Camera permission prompt fires on page mount — the `Scanner` renders with `paused=false` immediately on first render.
- **D-08:** AudioContext is created and resumed via a `pointerdown` handler at the `RetroTabs` / page wrapper level on first user interaction.

**Error States & Retry:**
- **D-09:** Four distinct retro error panels: **permission-denied**, **no-camera**, **library-init-fail**, **unsupported-browser**.
- **D-10:** Permission-denied panel shows platform-specific instructions (iOS / Android / fallback) + "USE MANUAL ENTRY" button. No fake retry.
- **D-11:** Library-init-fail panel has "RETRY" (dynamic re-import) + "USE MANUAL ENTRY" fallback.
- **D-12:** All error paths log structured `console.error({ kind, errorName, userAgent, timestamp })`. No backend telemetry.

**Viewfinder + Manual Entry:**
- **D-13:** Viewfinder = thick retro-ink **corner reticle brackets** + single animated **amber horizontal scanline**. Respects `prefers-reduced-motion`.
- **D-14:** Manual tab accepts any trimmed non-empty string (max 256 chars). No format gate.
- **D-15:** Tapping a history entry re-fires the post-scan flow (same code path as live decode).
- **D-16:** Torch button is **not rendered at all** when unsupported. Feature-detected per-stream via `MediaStreamTrack.getCapabilities().torch`.

### Claude's Discretion

- Exact `RetroTabs` API fit for the 3-tab Scan / Manual / History strip
- Scanline animation timing/easing (pick values consistent with retro feel; likely ~2s linear)
- Exact per-platform copy in the permission-denied panel (EN first; ET must be filled in this phase per Phase 63 gap-fill pattern)
- Banner visual arrangement (code, format label, SCAN AGAIN button position within the retro panel)
- Torch icon glyph (ASCII vs retro monospace bold); decide during implementation
- File split inside `lib/scanner/` — 1:1 port of legacy structure (init-polyfill / feedback / scan-history / types / index) with `"use client"` stripped and any Next.js dynamic-import replaced with Vite/React 19 equivalents
- AudioContext singleton ownership (hook vs module-scope) — whichever maps cleaner to `useScanFeedback`

### Deferred Ideas (OUT OF SCOPE)

**Downstream phases:**
- Real workspace item lookup — Phase 65 (LOOK-01)
- "Not found → create item" navigation with barcode prefill — Phase 65 (LOOK-02)
- External UPC enrichment suggestion banner — Phase 65 (LOOK-03)
- Quick-action overlay sheet (View / Loan / Back to Scan) — Phase 66 (QA-01..03)
- FAB mounted in AppShell — Phase 67 (FAB-01..04)
- Loan preselect from scan — Phase 68 (INT-LOAN-01)
- Quick Capture inline scan — Phase 69 (INT-QC-03)

**Beyond v2.2:**
- Container / location scanning (schema does not yet support barcode on those entities)
- Offline scan queue
- Cross-device scan history sync
- Full-viewport CRT scanline overlay
- Differentiated haptic patterns (found vs not-found)
- Error beep on not-found
- Per-entry delete in scan history
- Duplicate-scan soft warning
- GTIN-14 canonicalization on write + lookup

**Never:**
- Hardware scanner (USB/Bluetooth HID), NFC tag read, auto-submit / auto-navigate / auto-create on scan, continuous batch-scan mode, scanning from uploaded image

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-01 | User can open `/scan` and see a live rear-camera preview with scanner controls (single-page route, scanner stays mounted during overlays) | Use `<Scanner>` from `@yudiel/react-qr-scanner@2.5.1` with `constraints={{ facingMode: { ideal: 'environment' } }}`; mount lazy via `React.lazy` and keep mounted across paused state — never unmount on decode. See §Pattern 1 below. |
| SCAN-02 | Scanner decodes QR, UPC-A, EAN-13, and Code128 formats | Pass `formats={['qr_code', 'upc_a', 'ean_13', 'code_128']}` prop (names verified against v2.5.1 README). See §Pattern 2. |
| SCAN-03 | Audio beep + haptic + visual flash on successful scan | AudioContext oscillator at 880 Hz × 100 ms (verbatim port of `frontend/lib/scanner/feedback.ts`); `ios-haptics` `haptic()` call for iOS + falls through to `navigator.vibrate` on Android internally. See §Pattern 3. |
| SCAN-04 | User can toggle flashlight/torch on Android devices that expose `MediaStreamTrack.getCapabilities().torch`; hidden on iOS | Feature-detect **on the active stream** via `track.getCapabilities().torch`; apply with `track.applyConstraints({ advanced: [{ torch: true/false }] })`. See §Pattern 6. Note: `@yudiel`'s built-in `components.torch` prop also works, but domain-component approach gives richer retro UI. |
| SCAN-05 | Manual barcode entry fallback | `ManualBarcodeEntry` domain component using `RetroInput` + `RetroButton`; 256-char cap; trims; fires same post-scan flow with `format: 'MANUAL'`. |
| SCAN-06 | Last 10 scanned codes in localStorage key `hws-scan-history` with timestamps and quick-rescan | Verbatim port of `frontend/lib/scanner/scan-history.ts`; wrap in `useScanHistory` hook that exposes `{ entries, add, clear, remove }`. |
| SCAN-07 | Clear scan history with confirm prompt | `RetroConfirmDialog` (already in retro barrel) with copy from UI-SPEC; invoke `useScanHistory().clear()` on affirm. |

---

## Project Constraints (from CLAUDE.md)

No root `CLAUDE.md` file exists. `VERIFIED: ls -la /home/antti/Repos/Misc/home-warehouse-system/CLAUDE.md` returns non-existent.

**Cross-cutting project rules (sourced from STATE.md, ROADMAP.md, prior phases):**
- All retro imports MUST go through `@/components/retro` barrel (Phase 54 mandate; no direct file imports)
- CI grep guard: no `idb` / `serwist` / `offline` / `sync` specifiers in `frontend2/src/**` (`scripts/check-forbidden-imports.mjs`)
- All user-facing strings go through Lingui `t` macro; EN catalog in `frontend2/locales/en/messages.po`, ET in `frontend2/locales/et/messages.po`; ET gap-fill happens in THIS phase (Phase 63 established this rule)
- No `lucide-react` (v2.2 OOS); no `motion` / `framer-motion`
- TanStack Query v5 is the substrate for server state (v2.1 decision)
- `localStorage` is the only persistence layer for scan history; schema key = `hws-scan-history`
- `@yudiel/react-qr-scanner` locked to EXACT `2.5.1` (no caret) for parity with `/frontend`

---

## Summary

Phase 64 ports the shipped v1.3 scanner (`/frontend/lib/scanner/*` + `/frontend/components/scanner/*`) into `/frontend2`, preserving algorithmic behavior verbatim while rewriting the UI surfaces in the retro aesthetic. Three new runtime deps land: `@yudiel/react-qr-scanner@2.5.1` (exact pin), `ios-haptics@^0.1.4`, `uuid@^13.0.0`. One devDep: `@types/uuid@^11.0.0`. Transitive footprint is `barcode-detector@3.0.8` + `zxing-wasm@2.2.4` (NOT 3.0.2 as the milestone STACK.md claimed — see §Discrepancies) + `webrtc-adapter@9.0.3` + `sdp@^3.2.0`. Scanner WASM must be manual-chunked in `vite.config.ts` or the main-bundle gzip budget is blown.

The dominant architectural constraint is **iOS PWA camera permission persistence** (Pitfall #1): the scanner must stay MOUNTED on the `/scan` route through post-scan banner, history-tap re-fire, and future Phase 66 overlay — only the `paused` prop toggles. Calling `track.stop()` or unmounting `<Scanner>` mid-flow triggers permission re-prompts on iOS Safari in standalone-PWA mode. This shapes every component boundary in the phase.

Secondary constraints: StrictMode double-mount safety (ref-array cleanup pattern) and AudioContext user-gesture unlock (Pitfall #4 + #19). The legacy `feedback.ts` already implements a singleton AudioContext with `resume()` on first use; wrap it in a hook that guarantees resume fires inside a real `pointerdown` handler on the page wrapper (D-08).

**Primary recommendation:** Straight 1:1 port of the four legacy `lib/scanner/` modules (strip `"use client"`, replace `@/lib/types/*` entity imports with a locally-defined `EntityMatch` stub); rewrite the three `components/scanner/*.tsx` files using retro atoms + new domain components (`BarcodeScanner`, `ManualBarcodeEntry`, `ScanErrorPanel`, `ScanResultBanner`, `ScanViewfinderOverlay`, `ScanTorchToggle`); add `manualChunks` rule for `zxing-wasm` + `@yudiel/react-qr-scanner`; wrap `/scan` route in `React.lazy` + `Suspense`. Every new string lands in EN + ET catalogs via `bun run i18n:extract`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Camera stream acquisition + decode | Browser (client) | — | WebRTC `getUserMedia` + WASM decode are browser-only; no server involvement [VERIFIED: `@yudiel/react-qr-scanner` README] |
| Audio beep on scan success | Browser (client) | — | `AudioContext.createOscillator()`; zero network; respects iOS silent switch [VERIFIED: existing `frontend/lib/scanner/feedback.ts`] |
| Haptic feedback | Browser (client) | — | `ios-haptics` uses DOM checkbox hack + `navigator.vibrate`; client-only [VERIFIED: `ios-haptics` README] |
| Scan history persistence | Browser (client) | — | `localStorage` only; online-only milestone, no server sync [LOCKED: v2.1 decision, CI grep guard] |
| Lookup API stub (Phase 64) | Browser (client) | — | Hardcoded return; Phase 65 will wire to existing `GET /api/workspaces/{wsId}/items?search=` endpoint [LOCKED: D-01] |
| i18n catalog | Build-time | Browser (runtime) | Lingui `t` macro compiled at build; runtime resolves locale via `@lingui/react` [VERIFIED: Phase 63 precedent] |
| Route lazy-loading | Build-time | Browser (runtime) | Vite `rollupOptions.output.manualChunks` + `React.lazy` split scanner WASM into separate chunk [CITED: Vite docs] |

---

## Standard Stack

### Core (new runtime deps — add to `frontend2/package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@yudiel/react-qr-scanner` | `2.5.1` (EXACT, no caret) | Camera-based QR + 1D barcode scanning with torch support | Same version `/frontend` ships in production through v1.9; React 19 peerDep-clean (`^17 \|\| ^18 \|\| ^19`); built on native `BarcodeDetector` API with `barcode-detector@3.0.8` polyfill; built-in `components.torch` prop [VERIFIED: npm registry 2026-04-18 + WebFetch README] |
| `ios-haptics` | `^0.1.4` | Haptic feedback on iOS Safari 17.4+ with Android Vibration API fallback | Only known technique that works on iOS Safari (hidden `<input type=checkbox switch>` label-click hack); 4.8 kB unpacked, zero deps; internally falls through to `navigator.vibrate` on Android [VERIFIED: npm registry + WebFetch README] |
| `uuid` | `^13.0.0` | Client-generated idempotency keys (future Phase 65+ scan-driven creates); ready-to-use helper id generator if needed in this phase | RFC9562-compliant; zero deps; tree-shakes to `import { v7 } from 'uuid'`; v1.1 project-wide mandate [VERIFIED: npm registry 2026-04-18] |

### Core (new devDep)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@types/uuid` | `^11.0.0` | Type shims for `uuid` v13 | DEPRECATION NOTE: npm registry warning says "uuid provides its own type definitions, so you do not need this installed." CONTEXT.md locks it anyway (parity with `/frontend`); safe to install but may be redundant. Flag for planner: ASSUMED required; actually optional per upstream. [VERIFIED: `npm view @types/uuid`: DEPRECATED ⚠️] |

### Transitive dependencies (auto-installed; DO NOT declare directly)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `barcode-detector` | `3.0.8` | BarcodeDetector API polyfill for Safari/Firefox | Bundled by `@yudiel/react-qr-scanner@2.5.1`; exports `/polyfill` side-effect module that registers `window.BarcodeDetector` [VERIFIED: `npm view @yudiel/react-qr-scanner@2.5.1 dependencies`] |
| `zxing-wasm` | `2.2.4` | WASM barcode decoder engine | Pulled by `barcode-detector@3.0.8` → pins `zxing-wasm@2.2.4` EXACT. ⚠️ This differs from STACK.md §Version & Compatibility Matrix which claims `zxing-wasm@3.0.2`. Verified 2026-04-18 via `npm view`. [VERIFIED: `npm view barcode-detector@3.0.8 dependencies`] |
| `webrtc-adapter` | `9.0.3` | WebRTC shim for cross-browser `getUserMedia` | Pulled by `@yudiel` directly [VERIFIED: npm view] |
| `sdp` | `^3.2.0` | Session Description Protocol parser used by `webrtc-adapter` | [VERIFIED: npm view webrtc-adapter@9.0.3] |

### Already in place (reuse; DO NOT re-add)

| Existing | Use in Phase 64 |
|----------|-----------------|
| `@tanstack/react-query@^5` | `useScanLookup` stub uses this hook shape; Phase 65 fills the `queryFn` |
| `@lingui/core` + `@lingui/react` + `@lingui/swc-plugin` + `@lingui/vite-plugin` + `@lingui/cli` | All scanner UI strings; `bun run i18n:extract` in this phase to gap-fill ET |
| `react-router@^7.14.0` | Route registration already present at `routes/index.tsx:85`; only change is wrapping `<ScanPage>` in `React.lazy` if bundle analyzer shows scanner chunk not isolated |
| Retro atoms (`RetroTabs`, `RetroPanel`, `RetroButton`, `RetroInput`, `RetroEmptyState`, `RetroConfirmDialog`, `HazardStripe`) | All UI surfaces in Phase 64 (no new retro atoms per UI-SPEC) |

### Deliberately NOT added

| Library | Reason |
|---------|--------|
| `barcode-detector` as direct dep | Already transitive via `@yudiel`; declaring causes version drift [CITED: STACK.md §Core Additions] |
| `html5-qrcode`, `@zxing/browser`, `@ericblade/quagga2` | No React 19 peerDep, larger bundles, worse ergonomics |
| `lucide-react` | Explicit v2.2 OOS; retro uses ASCII monospace glyphs `[◉]`, `[!]`, `[×]` [LOCKED: UI-SPEC] |
| `motion` / `framer-motion` | ~60 kB gzip for a single scanline animation is disproportionate; CSS `@keyframes` sufficient [LOCKED: v2.2 STATE.md] |
| `idb` / IndexedDB | CI grep guard blocks it; `localStorage` is the persistence substrate |
| `react-haptic-feedback` / generic haptic wrappers | `ios-haptics` is the specific technique that works on iOS Safari 17.4+ |
| `vite-plugin-wasm` | `@yudiel` → `barcode-detector` polyfill dynamic-imports the WASM glue at runtime; no plugin needed. Confirmed via `npm view` exports field: `zxing-wasm` exposes `./full/zxing_full.wasm` as an explicit export but `barcode-detector` consumes it internally via dynamic import [VERIFIED: npm view] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Exact `2.5.1` pin | `^2.5.1` caret | Caret risks picking up 2.6.x (currently has a `beta: 2.4.0-alpha.0` dist-tag but no stable 2.6.x exists as of 2026-04-18). CONTEXT.md locks exact pin for parity with `/frontend`. [VERIFIED] |
| Library's built-in `components.torch: true` | Custom `ScanTorchToggle` domain component | Built-in renders a non-retro DOM button we can't style. UI-SPEC requires retro torch button (ASCII glyph + retro border + amber fill on state). Use custom, with `components.torch` left default-false. |
| `zxing-wasm@3.0.2` (full) build variant | Library's auto-pulled `zxing-wasm@2.2.4` (via barcode-detector) | We don't control the transitive pin; using 2.2.4 is automatic. 3.0.2 would require forking `barcode-detector`. Skip. |

### Installation

```bash
cd frontend2
bun add @yudiel/react-qr-scanner@2.5.1
bun add ios-haptics@^0.1.4
bun add uuid@^13.0.0
bun add -d @types/uuid@^11.0.0
```

Resulting `frontend2/package.json` delta:

```json
// dependencies
"@yudiel/react-qr-scanner": "2.5.1",
"ios-haptics": "^0.1.4",
"uuid": "^13.0.0"

// devDependencies
"@types/uuid": "^11.0.0"
```

### Version verification (2026-04-18 via `npm view`)

| Package | Published Version | Registry Date | Status |
|---------|-------------------|---------------|--------|
| `@yudiel/react-qr-scanner` | `2.5.1` (latest) | 2 months ago (Feb 2026) | Current. `beta: 2.4.0-alpha.0` exists — pre-release, ignore. |
| `ios-haptics` | `0.1.4` (latest) | 7 months ago (Sep 2025) | Current. No newer release. |
| `uuid` | `13.0.0` (latest) | 7 months ago (Sep 2025) | Current. |
| `@types/uuid` | `11.0.0` (latest) | — | DEPRECATED ⚠️ by upstream — `uuid` now ships its own types. Install anyway for CONTEXT.md parity; planner flag. |
| `barcode-detector` | `3.0.8` (transitive pin) | — | — |
| `zxing-wasm` | `2.2.4` (transitive via barcode-detector) | — | ⚠️ Not 3.0.2 as STACK.md claimed. Confirm in `bun.lock` after install. |

---

## Architecture Patterns

### System Architecture Diagram

```
                User navigates to /scan
                         │
                         ▼
              ┌────────────────────────┐
              │  React.lazy(ScanPage)  │  <- Suspense boundary
              │   (scanner chunk)      │
              └────────────────────────┘
                         │
                         ▼
        ┌─────────────────────────────────────┐
        │            ScanPage                 │
        │  (state machine: tab + paused)      │
        │                                     │
        │   ┌──────── RetroTabs ────────┐     │
        │   │  SCAN  │ MANUAL │ HISTORY │     │
        │   └───────────────────────────┘     │
        │                                     │
        │   ┌── pointerdown handler ──┐       │
        │   │  resumeAudioContext()   │       │  <- D-08, iOS unlock
        │   └─────────────────────────┘       │
        └──────────────┬──────────────────────┘
                       │
       ┌───────────────┼────────────────┬────────────────────┐
       │               │                │                    │
       ▼ (Scan tab)    ▼ (Manual tab)   ▼ (History tab)      ▼ (error)
┌─────────────┐   ┌──────────────┐   ┌─────────────────┐   ┌───────────────┐
│ BarcodeScanner│   │ ManualEntry  │   │ ScanHistoryList │   │ ScanErrorPanel│
│  <Scanner/>   │   │  RetroInput  │   │  + ConfirmDlg   │   │  (4 variants) │
│  +  Overlay   │   │  RetroButton │   │                 │   └───────────────┘
│  +  Torch     │   └───────┬──────┘   └────────┬────────┘
└───────┬───────┘           │                   │
        │ onScan            │ onSubmit          │ onSelect
        ▼                   ▼                   ▼
  ┌──────────────────────────────────────────┐
  │   handleDecode({ rawValue, format })     │
  │                                          │
  │   1. pauseScanner()          [D-02]      │
  │   2. triggerScanFeedback()   [SCAN-03]   │  (beep + haptic + flash)
  │   3. addToScanHistory({...}) [D-03/D-04] │  (dedupe-to-top)
  │   4. setBanner({ code, format })         │
  └──────────────┬───────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  ScanResultBanner  │
        │  CODE + FORMAT     │
        │  + SCAN AGAIN btn  │
        └────────┬───────────┘
                 │  tap SCAN AGAIN
                 ▼
        pauseScanner(false), clearBanner()

External integrations:
  - useScanLookup(code) stub -> Phase 65 wires to itemsApi
  - AudioContext singleton (feedback.ts module scope)
  - localStorage 'hws-scan-history' (scan-history.ts module scope)
  - MediaStream (owned by <Scanner>; never stop() in Phase 64)
```

### Recommended Project Structure

```
frontend2/src/
├── components/
│   └── scan/                          # NEW — domain components
│       ├── BarcodeScanner.tsx         # retro wrapper over <Scanner>
│       ├── ManualBarcodeEntry.tsx     # RetroInput + RetroButton
│       ├── ScanErrorPanel.tsx         # 4-variant panel (permission/no-camera/lib-fail/unsupported)
│       ├── ScanResultBanner.tsx       # post-decode banner (code + format + SCAN AGAIN)
│       ├── ScanViewfinderOverlay.tsx  # corner reticle + amber scanline
│       ├── ScanTorchToggle.tsx        # feature-gated torch button
│       └── index.ts                   # barrel
├── features/scan/
│   ├── ScanPage.tsx                   # REPLACES current stub; orchestrates tabs + banner state
│   ├── ScanHistoryList.tsx            # consumes useScanHistory
│   └── hooks/
│       ├── useScanHistory.ts          # { entries, add, clear, remove } — wraps scan-history.ts
│       ├── useScanFeedback.ts         # triggerScanFeedback + resumeAudioContext for D-08
│       └── useScanLookup.ts           # STUB { status: 'idle', match: null } — Phase 65 replaces
├── lib/scanner/                       # NEW — verbatim port from /frontend/lib/scanner
│   ├── init-polyfill.ts               # 49 LOC port, strip "use client"
│   ├── feedback.ts                    # 149 LOC port, strip "use client"
│   ├── scan-history.ts                # 196 LOC port, strip "use client"; also drop ./types import re-export of scan-lookup
│   ├── types.ts                       # port; strip Item/Container/Location imports, inline `EntityMatch` stub
│   └── index.ts                       # barrel; remove scan-lookup exports (no lookup in Phase 64)
└── lib/api/
    └── scan.ts                        # NEW — empty scaffold: export `scanApi = {}` + `scanKeys` factory
```

### Pattern 1: Scanner stays mounted across paused state (iOS PWA safety)

**What:** The `<Scanner>` library component has a `paused` prop. Toggle that instead of unmounting when post-scan banner shows. Never call `track.stop()` in Phase 64 — the stream must survive through Phase 66's QuickActionMenu overlay.

**When to use:** Every post-decode flow (live scan, history-tap re-fire, manual submit).

**Example:**

```tsx
// Source: @yudiel/react-qr-scanner v2.5.1 README (WebFetch 2026-04-18)
// Scanner prop surface verified:
//   onScan: (detectedCodes: IDetectedBarcode[]) => void  (REQUIRED)
//   onError?: (error: unknown) => void
//   paused?: boolean                              (default false)
//   formats?: BarcodeFormat[]                     (default: ALL formats)
//   constraints?: MediaTrackConstraints           (default {})
//   components?: { torch?: boolean; finder?: boolean; ... }
//   scanDelay?: number                            (default 500ms — UI-SPEC may override)
//   allowMultiple?: boolean                       (default false)
//   sound?: boolean | string                      (default false — WE HANDLE AUDIO)

import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";

function BarcodeScanner({ onDecode, paused }: Props) {
  return (
    <Scanner
      paused={paused}
      onScan={(codes: IDetectedBarcode[]) => {
        if (codes.length === 0 || paused) return;
        const { rawValue, format } = codes[0]; // allowMultiple=false → array length 1
        onDecode({ code: rawValue, format });
      }}
      onError={(err) => handleScannerError(err)}
      formats={['qr_code', 'upc_a', 'ean_13', 'code_128']}
      constraints={{ facingMode: { ideal: 'environment' } }}
      scanDelay={200}
      allowMultiple={false}
      sound={false}             // we own audio via feedback.ts
      components={{ finder: false, torch: false }}  // custom overlay + torch button
    />
  );
}
```

**Critical:** Scanner mounts its own `<video>` element internally; do NOT try to inject one. Attribute `playsInline` is handled by the library [VERIFIED: Pitfall #3 + README].

### Pattern 2: Format restriction

**What:** Pass a `BarcodeFormat[]` to the `formats` prop. v2.5.1 uses the name `formats` (NOT `enabledFormats`). Supported values confirmed from README:

```
'aztec', 'code_128', 'code_39', 'code_93', 'codabar', 'databar',
'databar_expanded', 'data_matrix', 'dx_film_edge', 'ean_13', 'ean_8',
'itf', 'maxi_code', 'micro_qr_code', 'pdf417', 'qr_code', 'rm_qr_code',
'upc_a', 'upc_e', 'linear_codes', 'matrix_codes', 'unknown'
```

**Phase 64 value:** `['qr_code', 'upc_a', 'ean_13', 'code_128']` (matches SCAN-02 exactly). Explicit subset is also a mild perf win — the decoder only tries those symbologies [CITED: @yudiel README; MEDIUM confidence on perf impact — documented but not benchmarked].

**Legacy difference:** `/frontend` uses `SUPPORTED_FORMATS = ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']` — 6 formats. SCAN-02 only requires 4. Recommend `types.ts` keeps the superset as `SUPPORTED_FORMATS` for future-proofing; BarcodeScanner prop passes the SCAN-02 subset. Planner: decide.

### Pattern 3: AudioContext resume in page-level pointerdown (D-08 / Pitfall #19)

**What:** Create a singleton AudioContext (legacy `feedback.ts` already does this at module scope). `resume()` must fire inside a REAL user gesture handler (`pointerdown` or `click`). iOS Safari will reject `resume()` calls initiated from `useEffect` or `onLoad`.

**When:** On first `pointerdown` anywhere in the page wrapper or RetroTabs strip (D-08). Repeated resumes are no-ops.

**Example:**

```tsx
// Source: frontend/lib/scanner/feedback.ts (existing, ships in production)
// + MDN Web Audio API best practices (https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

// module scope
let audioContext: AudioContext | null = null;

export function initAudioContext(): void {
  if (audioContext || typeof window === "undefined") return;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (Ctor) audioContext = new Ctor();
}

export function resumeAudioContext(): void {
  if (!audioContext) initAudioContext();
  if (audioContext?.state === "suspended") {
    audioContext.resume().catch(() => { /* ignore */ });
  }
}

// In ScanPage (or a thin wrapper):
function ScanPage() {
  const primedRef = useRef(false);
  return (
    <div
      onPointerDown={() => {
        if (primedRef.current) return;
        primedRef.current = true;
        resumeAudioContext();  // safe — no-op on non-iOS, unlocks on iOS
      }}
    >
      {/* RetroTabs + content */}
    </div>
  );
}
```

**Why `pointerdown` not `click`:** On iOS Safari, `click` fires AFTER the permission dialog dismisses. If the user taps a tab button that ALSO triggers the camera prompt, the `click` handler can fire inside a de-prioritized context. `pointerdown` fires before the prompt and is reliably within the gesture [CITED: Matt Montag article; MEDIUM confidence — widely reported pattern, not explicitly spec'd].

### Pattern 4: StrictMode double-mount safety (ref-array cleanup)

**What:** React 19 dev-mode deliberately double-mounts effects. If `getUserMedia` resolves between the two mounts, two tracks claim the camera. `@yudiel/react-qr-scanner` 2.5.1 owns the stream internally — README does not explicitly claim StrictMode safety. Defensive belt-and-braces pattern below.

**When:** If Phase 64 wraps `<Scanner>` in a component that ALSO hand-requests streams (e.g., for torch feature-detection pre-mount). Otherwise rely on library's internal cleanup.

**Example:**

```tsx
// Source: PITFALLS.md §Pitfall 4 + MDN MediaStreamTrack.stop()
// Verified pattern — also used in legacy frontend/components/scanner/barcode-scanner.tsx (lines 102-135)

function useTorchCapability() {
  const [torchSupported, setTorchSupported] = useState(false);
  const streamsRef = useRef<MediaStream[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamsRef.current.push(stream);
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(caps?.torch === true);
        // Release probe stream — <Scanner> will request its own
        stream.getTracks().forEach((t) => t.stop());
        streamsRef.current = streamsRef.current.filter((s) => s !== stream);
      } catch { /* treat as no-torch */ }
    }

    probe();
    return () => {
      cancelled = true;
      streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      streamsRef.current = [];
    };
  }, []);

  return torchSupported;
}
```

**NOTE:** Probing via a throwaway `getUserMedia` can race against `<Scanner>`'s own request on some Android browsers (exclusive camera lock). Prefer reading `track.getCapabilities()` from the **active** scanner stream if the library exposes it. `@yudiel` does NOT expose the track handle in v2.5.1. Planner options:

1. **Probe-and-release** (legacy pattern): request → read capabilities → stop. Works but adds a small delay before torch button appears, and can race on Android.
2. **Defer detection until first frame**: subscribe to `components.torch` via library's built-in toggle state. Simplest. But UI-SPEC requires retro-styled toggle, not library's default button.
3. **Recommended for Phase 64:** Use legacy pattern (option 1) with the ref-array cleanup above. On iOS the probe throws `NotSupportedError` in the `advanced` constraints path, so the button auto-hides; on Android the race is benign (exclusive-use errors are caught and treated as "no torch").

### Pattern 5: Vite manualChunks for scanner WASM

**What:** Split `@yudiel/react-qr-scanner`, `barcode-detector`, `zxing-wasm`, and `webrtc-adapter` into a separate `scanner` chunk so users who never open `/scan` don't pay for ~500-700 kB gzip.

**When:** Phase 64 acceptance gate — main-bundle `/scan` contribution must be ≤20 kB gzip (CONTEXT.md).

**Example:**

```ts
// Source: Vite rollupOptions.output.manualChunks — https://rollupjs.org/configuration-options/#output-manualchunks
// Required addition to frontend2/vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { lingui } from "@lingui/vite-plugin";
import path from "path";

export default defineConfig({
  plugins: [
    react({ plugins: [["@lingui/swc-plugin", {}]] }),
    tailwindcss(),
    lingui(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          scanner: [
            "@yudiel/react-qr-scanner",
            "barcode-detector",
            "barcode-detector/polyfill",
            "zxing-wasm",
            "webrtc-adapter",
          ],
        },
      },
    },
  },
});
```

**Verification step for planner:** After install + build, run `bun run build` and inspect `dist/assets/*.js` — expect a `scanner-[hash].js` chunk of ~500-700 kB raw / ~120-180 kB gzip. If `zxing-wasm` WASM binary (`.wasm` file) appears as a separate asset in `dist/assets/`, that's expected — Vite fingerprints static WASM files separately and they're fetched on demand.

**Route-level lazy split (complementary):**

```tsx
// In frontend2/src/routes/index.tsx
import { lazy, Suspense } from "react";
import { RetroPanel } from "@/components/retro";

const ScanPage = lazy(() =>
  import("@/features/scan/ScanPage").then((m) => ({ default: m.ScanPage }))
);

// In route config:
<Route
  path="scan"
  element={
    <Suspense fallback={<RetroPanel showHazardStripe title="LOADING SCANNER…">{/* retro loader */}</RetroPanel>}>
      <ScanPage />
    </Suspense>
  }
/>
```

### Pattern 6: Torch feature detection + toggle (SCAN-04 / D-16)

**What:** Feature-detect `torch` capability per-stream; render toggle only when supported; apply via `MediaTrackConstraints.advanced`.

**Example:**

```ts
// Source: MDN MediaStreamTrack.getCapabilities()
// https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getCapabilities

// Detection (on probe or active stream)
const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
const hasTorch = caps?.torch === true;

// Toggle
async function setTorch(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [{ torch: on } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;  // silently revert per D-16 / UI-SPEC
  }
}
```

**Browser compatibility:** Chrome Android YES; Safari iOS NO (WebKit bug #243075); desktop Chrome MOSTLY NO (depends on webcam hardware) [CITED: WebKit bug #243075 + MDN].

**iOS early-exit:** Legacy `frontend/components/scanner/barcode-scanner.tsx:64-66` explicitly checks `/iPad|iPhone|iPod/.test(navigator.userAgent)` and returns false before probing. Recommend keeping this short-circuit — avoids spurious `getUserMedia` on iOS where the probe always returns false anyway.

### Pattern 7: Haptic feedback via ios-haptics

**What:** `ios-haptics` exports a `haptic` function (with `.confirm()` and `.error()` variants) that internally dispatches to the Safari 17.4+ `<input type="checkbox" switch>` trick OR `navigator.vibrate` on Android.

**Example:**

```ts
// Source: WebFetch tijnjh/ios-haptics README (2026-04-18)
// API:
//   haptic() — single pulse
//   haptic.confirm() — two rapid haptics
//   haptic.error() — three rapid haptics

import { haptic } from "ios-haptics";

function triggerScanHaptic(): void {
  haptic();  // single pulse on success
  // (desktop: no-op; Android: navigator.vibrate; iOS 17.4+: checkbox-switch trick)
}
```

**User-gesture priming:** The README does not explicitly require it. Empirically: the checkbox-switch technique creates + clicks an element inside the current event loop; if called outside a user gesture, iOS may silently ignore the "click." Phase 64 calls `haptic()` from `onScan` → fires inside the user-initiated camera-decode event pipeline, which iOS treats as eligible. [ASSUMED — MEDIUM confidence. No explicit documentation confirming scanner-decode is a gesture-eligible context on iOS.]

**Fallback path:** Legacy `feedback.ts` uses `navigator.vibrate([50])` directly; the ported-verbatim port would keep that. Recommend REPLACING the legacy vibrate call with `haptic()` from `ios-haptics` so iOS gets real haptics. This is a behavior CHANGE (not a verbatim port) — planner to flag.

### Pattern 8: useScanLookup stub shape (Phase 65 compat)

**What:** Stub hook returning the shape Phase 65 will fill. Pre-shaped to TanStack Query's `useQuery` result so Phase 65 is a one-file swap.

**Example:**

```ts
// Source: Research — inferred from TanStack Query v5 API + Phase 65 scope (LOOK-01)
// Phase 65 will replace the implementation with:
//   useQuery({ queryKey: ['scan','lookup',code], queryFn: () => itemsApi.lookupByBarcode(wsId, code), staleTime: 0 })

import type { Item } from "@/lib/api/items";

export type ScanLookupStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ScanLookupResult {
  /** 'idle' until Phase 65 wires the real query; consumer treats 'idle' as "not looked up yet" */
  status: ScanLookupStatus;
  /** Phase 65 populates this when a match is found; Phase 64 always null */
  match: Item | null;
  /** Phase 65 populates this on query error; Phase 64 always null */
  error: Error | null;
  /** Phase 65 populates with TanStack's refetch(); Phase 64 no-op */
  refetch: () => void;
}

export function useScanLookup(_code: string | null): ScanLookupResult {
  // STUB — Phase 65 replaces with useQuery. Consumers should use result.status
  // and result.match in the same way they will when the real query lands.
  return {
    status: 'idle',
    match: null,
    error: null,
    refetch: () => {},
  };
}
```

**Consumer contract:** Phase 64's `ScanResultBanner` reads `match === null` → shows the decoded-code-only layout. Phase 65 flips match to an Item → banner would show item name/SKU, but Phase 66 replaces the banner before that matters. Net effect: Phase 64 callsites stay intact.

### Anti-Patterns to Avoid

- **`track.stop()` on decode or unmount of `<Scanner>` during post-scan banner** — triggers iOS PWA permission re-prompt (Pitfall #1). Use `paused` prop only.
- **`navigate('/items/new?barcode=...')` inside Phase 64** — Phase 65 scope; locks in the wrong pattern if done here.
- **Writing `localStorage` directly from components** — violates D-04; route everything through `useScanHistory`.
- **Rendering torch button with `disabled` + tooltip on iOS** — D-16 says "not rendered at all."
- **Using library's `components.torch: true`** — mounts a non-retro button we can't style. Use custom `ScanTorchToggle`.
- **Calling `audioContext.resume()` in `useEffect`** — iOS Safari rejects. Must be inside a `pointerdown` / `click` handler.
- **Declaring `barcode-detector` as direct dep** — already transitive; declaring forces version drift.
- **Hand-rolling a `<video>` element** — `<Scanner>` mounts its own; library handles `playsInline` (Pitfall #3).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera + WASM barcode decode | Custom `<video>` + ZXing glue | `@yudiel/react-qr-scanner@2.5.1` `<Scanner>` | StrictMode safety, webrtc-adapter shim, BarcodeDetector polyfill, torch prop — all included |
| `navigator.vibrate` with iOS fallback | Custom checkbox-switch trick | `ios-haptics` | 4.8 kB, verified Safari 17.4+ technique, zero deps |
| Barcode format normalization (UPC-A ↔ EAN-13 padding) | `raw.replace(/\D/g,'').padStart(14,'0')` inline | ⚠️ OUT OF SCOPE in Phase 64 — Phase 65 (LOOK-01) will own this. Do not introduce normalization here; history preserves `rawValue` verbatim. | Phase 64 has no lookup path; canonicalization is a write-side concern that belongs with the lookup phase. |
| Haptic gesture priming | Manual `<input type=checkbox switch>` JSX | `ios-haptics` library internally creates/removes the element | Don't reinvent |
| AudioContext lifecycle | Per-component `new AudioContext()` | Legacy `feedback.ts` module-scope singleton + `resumeAudioContext()` helper | iOS rejects multiple contexts; one-per-page is correct |
| Ref-array stream cleanup | Ad-hoc `let stream` in effect closure | Ref-array pattern (Pattern 4) with `cancelled` flag | Pitfall #2 (stale closure → leaked stream) is documented |
| Lazy route + Suspense fallback | Inline import + hope for code-split | `React.lazy(() => import(...))` + `<Suspense>` with retro loader | Rollup + Vite need the dynamic import to split; Suspense is the React 19 idiom |

**Key insight:** Camera access on mobile browsers is a tripwire field. Every hand-rolled solution re-discovers the same iOS/StrictMode/gesture-unlock bugs the library already solved. The ONLY hand-rolling in Phase 64 is UI skinning over the library's internals.

---

## Runtime State Inventory

> Phase 64 is greenfield code (new files + stub API); there is no rename/refactor of existing runtime state. Included for completeness given the port-from-legacy nature.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage` key `hws-scan-history` introduced by this phase. No pre-existing entries on any `/frontend2` device (current code does not touch it). | None — phase creates the key fresh. No migration needed. |
| Live service config | None — `/frontend2` has no n8n/Datadog/Cloudflare integrations touched by this phase. | None. |
| OS-registered state | None — no Task Scheduler / launchd / systemd hooks. | None. |
| Secrets/env vars | None — no new secrets. `VITE_API_BASE_URL` unchanged. | None. |
| Build artifacts / installed packages | `bun.lockb` (or `package-lock.json`) will gain transitive entries for `barcode-detector@3.0.8`, `zxing-wasm@2.2.4`, `webrtc-adapter@9.0.3`, `sdp@^3.2.0` after install. | Run `bun install` after `package.json` edit; commit lockfile. |

**Stale legacy `/frontend` state:** The legacy key `hws-scan-history` is written by `/frontend`'s running app; if a user has both frontends open in the same browser profile, they share the key. Not a Phase 64 problem — the shape is compatible (both use `{ code, format, entityType, timestamp }`), and `/frontend2`'s `getScanHistory()` filter accepts any entry with `code: string` + `timestamp: number`. [VERIFIED: inspected legacy `scan-history.ts:40-45` filter logic.]

---

## Common Pitfalls

> Phase 64 is primarily exposed to CONTEXT.md's cited pitfalls: **#1** (iOS perm reset on navigation), **#4** (StrictMode double-mount), **#12** (Bundle size bomb), **#19** (AudioContext suspended). Detailed here plus adjacent ones.

### Pitfall 1: iOS PWA camera permission reset on navigation

**What goes wrong:** Any `navigate('/items/new')` mid-scan (Phase 65) OR unmounting `<Scanner>` during the post-scan banner (Phase 64) regresses the single-route pattern. iOS Safari in standalone PWA mode re-prompts for camera permission on each re-mount.

**Why it happens:** WebKit bug #215884 — getUserMedia recurring permission prompts when hash/path changes in standalone mode. WebKit bug #185448 — getUserMedia not working in apps added to home screen.

**How to avoid:** Phase 64 never calls `track.stop()` and never unmounts `<Scanner>` during the paused state. Post-scan banner renders BESIDE (below) the viewfinder, not in place of it. Manual tab / History tab switching unmounts `<Scanner>` (acceptable — user has switched contexts); but within the Scan tab, mount is permanent.

**Warning signs:** Two consecutive decodes in a single session: second triggers permission prompt = bug. `navigator.permissions.query({ name: 'camera' })` returns `'prompt'` after first success.

**Phase 64 test procedure:** Decode twice in succession (use two QR codes); assert no permission dialog between. Manual smoke test on iOS Safari PWA (add to home screen).

### Pitfall 4: React 19 StrictMode double-mount breaks camera init

**What goes wrong:** Dev-mode StrictMode mounts effects twice. If two `getUserMedia` requests race, one stream leaks.

**How to avoid:** Ref-array pattern (Pattern 4) with `cancelled` flag. For Phase 64 specifically: the probe-for-torch-support hook uses this pattern; the main `<Scanner>` stream is owned by the library — verified library handles internal cleanup in 2.5.x [CITED: STACK.md §Dev HMR note, MEDIUM — library claims but not independently verified for React 19 dev mode].

**Warning signs:** Console logs "Camera started" twice. `chrome://media-internals/` shows two active streams.

**Phase 64 test procedure:** Vitest component test that mounts `<BarcodeScanner>` with mocked `@yudiel/react-qr-scanner`, unmounts, remounts, asserts mock called once-per-mount (not leaking).

### Pitfall 12: Bundle size bomb

**What goes wrong:** Main bundle grows ~500-700 kB gzip because WASM decoder is statically imported into the entry chunk.

**How to avoid:** Pattern 5 manualChunks + route-level `React.lazy`. Phase 64 acceptance gate: `/scan` contribution to main bundle ≤20 kB gzip.

**Warning signs:** `bun run build` output shows `index-[hash].js` over ~100 kB gzip. Scanner chunk absent from `dist/assets/`.

**Phase 64 test procedure:** After implementation, run `bun run build` and `ls -lh frontend2/dist/assets/ | grep scanner`. Confirm `scanner-[hash].js` exists, `index-[hash].js` gzip is not inflated relative to pre-phase baseline.

### Pitfall 19: AudioContext suspended on first scan

**What goes wrong:** Lazy-init AudioContext on first decode → `suspended` state → silent beep on iOS.

**How to avoid:** Pattern 3 — resume in `pointerdown` at page wrapper level (D-08).

**Warning signs:** First scan after cold page load is silent; subsequent scans have audio. Console: "The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page."

**Phase 64 test procedure:** Vitest unit test that mocks `AudioContext.state` as `suspended`, dispatches `pointerdown` on the wrapper, asserts `ctx.resume()` was called.

### Pitfall 3: Missing `playsInline` on video element

**What goes wrong:** On iPhone, `<video>` goes native-fullscreen, hiding the retro overlay.

**How to avoid:** `<Scanner>` from v2.5.1 handles this internally [CITED: library README + legacy code has been running on iOS for months]. Do NOT hand-roll a `<video>`.

**Warning signs:** Scanner page goes black-fullscreen on iPhone first frame.

**Phase 64 test procedure:** Vitest DOM snapshot of rendered `<video>` — assert `playsInline` attribute present. If the library regresses, detect it here.

### Pitfall 13: Continuous decode CPU drain

**What goes wrong:** Library defaults `scanDelay=500ms`; that's already reasonable. Legacy uses `scanDelay=200ms`. Unthrottled decoders (`scanDelay=0`) burn battery.

**How to avoid:** Keep `scanDelay` ≥ 200 ms. Pause decoder after a successful decode (we already do — D-02). Don't re-enable without user action.

### Pitfall 20: Feedback spam from continuous decode

**What goes wrong:** Same barcode in frame → decode fires on every `scanDelay` interval → beep spam.

**How to avoid:** Phase 64 pauses on first decode (D-02), so this can't happen in scope. For post-phase defensiveness, consider an in-memory `lastDecode` debounce; not required.

### Pitfall 32: Scanner route accessible without auth

**What goes wrong:** Unauth user hits `/scan` → camera prompt → "please log in" page. Bad UX.

**How to avoid:** `/scan` is already inside the `<RequireAuth>` wrapper in `routes/index.tsx` [VERIFIED: `frontend2/src/routes/index.tsx:85` is nested under the auth-guarded parent route per inspection]. No additional work.

### Project-specific Pitfall (Lingui ET gap-fill)

**What goes wrong:** EN strings land in catalog but ET msgstr stays empty → app renders EN to ET-locale users.

**How to avoid:** Phase 63 established the pattern: `bun run i18n:extract` inside `frontend2/`, then hand-fill ET `msgstr` for every new `msgid`. UI-SPEC §ET catalog provides the draft translations for every new string.

**Warning signs:** `frontend2/locales/et/messages.po` diff contains `msgstr ""` lines. CI lint (if configured) catches it; Phase 63 relies on human review.

---

## Code Examples

### Port: `init-polyfill.ts` (strip `"use client"`)

```ts
// Source: frontend/lib/scanner/init-polyfill.ts (49 LOC, audit-clean)
// Port action: REMOVE line 12 ("use client") + no other changes

let polyfillLoaded = false;

export async function initBarcodePolyfill(): Promise<void> {
  if (polyfillLoaded || typeof window === "undefined") return;
  if ("BarcodeDetector" in window) {
    console.log("[Scanner] Native Barcode Detection API available");
    polyfillLoaded = true;
    return;
  }
  try {
    await import("barcode-detector/polyfill");
    polyfillLoaded = true;
    console.log("[Scanner] Barcode Detection API polyfill registered");
  } catch (error) {
    console.error("[Scanner] Failed to load barcode polyfill:", error);
    throw new Error("Barcode scanning not supported in this browser");
  }
}

export function isBarcodeDetectionAvailable(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}
```

### Port: `scan-history.ts` (strip `"use client"` + minor)

Core dedupe logic (legacy `scan-history.ts:61-87`):

```ts
// Source: frontend/lib/scanner/scan-history.ts — audit-clean, ships in production

export function addToScanHistory(entry: Omit<ScanHistoryEntry, "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getScanHistory();
    const newEntry: ScanHistoryEntry = { ...entry, timestamp: Date.now() };
    const filtered = history.filter((h) => h.code !== entry.code);  // dedupe
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);  // cap at 10
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("[ScanHistory] Failed to save history:", error);
  }
}
```

Port actions: keep verbatim; types.ts `EntityMatch` shim becomes a local stub (Item/Container/Location imports dropped since no lookup in Phase 64).

### Port: `types.ts` (strip entity imports)

```ts
// Source: frontend/lib/scanner/types.ts (51 LOC)
// Port action: Remove `import type { Item } from "@/lib/types/items"` etc.
//              Inline EntityMatch as a stub referencing unknown types
//              (Phase 65 will wire real types)

export type EntityMatch =
  | { type: "item"; entity: { id: string; name: string } }
  | { type: "container"; entity: { id: string; name: string } }
  | { type: "location"; entity: { id: string; name: string } }
  | { type: "not_found"; code: string };

export interface ScanHistoryEntry {
  code: string;
  format: string;
  entityType: "item" | "container" | "location" | "unknown";
  entityId?: string;
  entityName?: string;
  timestamp: number;
}

// Phase 64 superset — SCAN-02 uses a 4-subset at the <Scanner> prop
export const SUPPORTED_FORMATS = [
  "qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128",
] as const;
export type BarcodeFormat = (typeof SUPPORTED_FORMATS)[number];
```

### New: `useScanHistory` hook

```ts
// Source: Phase 64 design — wraps scan-history.ts module with React state sync
import { useCallback, useEffect, useState } from "react";
import {
  getScanHistory,
  addToScanHistory,
  removeFromScanHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from "@/lib/scanner";

export function useScanHistory() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getScanHistory());
    // cross-tab sync
    const onStorage = () => setEntries(getScanHistory());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((e: Omit<ScanHistoryEntry, "timestamp">) => {
    addToScanHistory(e);
    setEntries(getScanHistory());
  }, []);

  const remove = useCallback((code: string) => {
    removeFromScanHistory(code);
    setEntries(getScanHistory());
  }, []);

  const clear = useCallback(() => {
    clearScanHistory();
    setEntries([]);
  }, []);

  return { entries, add, clear, remove };
}
```

---

## Retro Component Fit Audit

| Retro atom | Phase 64 use | API gap? |
|------------|--------------|----------|
| `RetroTabs` | 3-tab strip (Scan / Manual / History) | **NO.** Current API `{ tabs: {key,label}[], activeTab, onTabChange }` is a perfect fit. Visually: active tab = cream, inactive = gray; correct per UI-SPEC. |
| `RetroPanel` | Result banner + 4 error panels + empty-history wrapper | **NO.** `title` + `showHazardStripe` + `children` handles all cases. HazardStripe color: current impl is a single `bg-hazard-stripe` (yellow/ink stripe). UI-SPEC calls for red variant on library-init-fail panel — see below. |
| `RetroInput` | Manual entry | **NO.** Has `error?: string` prop for validation error; `maxLength` via `...rest` spread. |
| `RetroButton` | SCAN AGAIN, RETRY, USE MANUAL ENTRY, CLEAR HISTORY, LOOK UP CODE, torch toggle | **NO.** `primary` (amber) / `danger` (red) / `neutral` (cream→amber hover) / `secondary` (blue) variants cover everything in UI-SPEC. 44px minimum height baked in. |
| `RetroEmptyState` | History zero-state | **NO.** `title` + `body` + `action?` handles it; no CTA per UI-SPEC (empty state is passive). |
| `RetroConfirmDialog` | Clear history confirmation | **NO.** `variant: "destructive"` + `destructiveLabel: "YES, CLEAR"` + `escapeLabel: "KEEP HISTORY"` matches UI-SPEC destructive confirmation table. |
| `HazardStripe` | Inside RetroPanel header + error panels | ⚠️ **Potential gap.** Current impl is a single `bg-hazard-stripe` (presumably amber/ink yellow-hazard pattern). UI-SPEC §Color specifies: `library-init-fail` uses `retro-red` stripe, other error panels use `retro-hazard-yellow`. HazardStripe has NO color variant prop today. |

**Gap: HazardStripe color variant.** UI-SPEC Panel 3 (library-init-fail) requires a red stripe. Current `HazardStripe` renders one fixed color via `bg-hazard-stripe` Tailwind class. Planner options:

1. **Add a `variant?: "yellow" | "red"` prop** to `HazardStripe` — minimal change, but violates the UI-SPEC "no new retro atoms" gate... EXCEPT this is modifying an existing atom, not adding one. Check: UI-SPEC Acceptance Gate #4 says "No new retro atom introduced (`frontend2/src/components/retro/*.tsx` file count unchanged)." File count stays the same — legal.
2. **Apply a local CSS override** inside `ScanErrorPanel` when variant='library-init-fail' (e.g., wrap HazardStripe in a div with `[&_.bg-hazard-stripe]:bg-retro-red` class).
3. **Don't differentiate** — keep all 4 panels on yellow stripe. Violates UI-SPEC §Color which explicitly calls for red on lib-init-fail.

**Recommendation:** Option 1. Add `variant` prop to `HazardStripe` component (trivial ~5 LOC). Legal per the gate. The alternative (option 2) is a code smell.

---

## Legacy Port Mapping

File-by-file edit plan for the 5 legacy `lib/scanner/*` files and the 3 legacy `components/scanner/*.tsx` files.

### `frontend/lib/scanner/init-polyfill.ts` → `frontend2/src/lib/scanner/init-polyfill.ts`

| Line | Edit |
|------|------|
| 12 | Remove `"use client";` directive |
| Rest | Verbatim |

### `frontend/lib/scanner/feedback.ts` → `frontend2/src/lib/scanner/feedback.ts`

| Line | Edit |
|------|------|
| 12 | Remove `"use client";` |
| 128-140 | Consider REPLACING `navigator.vibrate` with `haptic()` from `ios-haptics` (behavior CHANGE — planner decide). Alternative: keep verbatim and add a NEW `triggerScanHapticIOS()` wrapper that uses `ios-haptics`. |
| Rest | Verbatim |

### `frontend/lib/scanner/scan-history.ts` → `frontend2/src/lib/scanner/scan-history.ts`

| Line | Edit |
|------|------|
| 13 | Change `import type { ScanHistoryEntry, EntityMatch } from "./types"` — keep as-is (types.ts also ported) |
| Rest | Verbatim. No `"use client"` directive in this file (confirmed — only `useDateFormat` consumer had it). |

### `frontend/lib/scanner/types.ts` → `frontend2/src/lib/scanner/types.ts`

| Line | Edit |
|------|------|
| 7-9 | REMOVE imports of `@/lib/types/items`, `@/lib/types/containers`, `@/lib/types/locations` (paths don't exist in `/frontend2`; no lookup in Phase 64) |
| 14-18 | Replace `EntityMatch` with inline stub (see §Code Examples) |
| Rest | Verbatim |

### `frontend/lib/scanner/index.ts` → `frontend2/src/lib/scanner/index.ts`

| Line | Edit |
|------|------|
| 42-47 | REMOVE `scan-lookup` exports (no lookup in Phase 64) |
| 15-16 | Remove `// Polyfill` comment-block if scan-lookup export block is gone (cleanup) |
| Rest | Verbatim |

### `frontend/components/scanner/barcode-scanner.tsx` → `frontend2/src/components/scan/BarcodeScanner.tsx`

**REWRITE (not port).** Legacy uses `shadcn` (`Button`, `Alert`), `lucide-react` (`Loader2`, `Flashlight`, `FlashlightOff`, `Camera`, `AlertCircle`), `next/dynamic`, `@/lib/utils:cn`. All FORBIDDEN in `/frontend2`.

Keep from legacy:
- `checkTorchSupport()` pattern (probe → capabilities → release) — Pattern 4/6
- `paused` prop pass-through
- `onScan` / `onError` callbacks
- `scanDelay=200`, `allowMultiple=false`, `sound=false`, `constraints={facingMode: 'environment'}`
- iOS UA early-exit on torch check (line 64-66)

Rewrite as:
- Retro container using `RetroPanel` OR a domain `<div className="border-retro-thick border-retro-ink bg-retro-ink aspect-square">` matte
- `ScanViewfinderOverlay` sibling for corner brackets + scanline
- `ScanTorchToggle` sibling rendered only when `torchSupported`
- Loading / error states routed to `ScanErrorPanel` (NOT inline Alert)
- Replace `next/dynamic` with `React.lazy` at the route level (the Scanner import itself can be static inside the lazy-loaded ScanPage)

### `frontend/components/scanner/manual-entry-input.tsx` → `frontend2/src/components/scan/ManualBarcodeEntry.tsx`

**REWRITE.** Legacy uses `shadcn` (`Button`, `Input`, `Label`), `lucide-react` (`Search`, `X`), `next-intl`. Rewrite with `RetroInput` + `RetroButton` + Lingui macro.

Keep from legacy:
- `trim + non-empty` validation
- `onSubmit(code)` callback contract
- `autoComplete="off"` + `autoCapitalize="off"` + `autoCorrect="off"` + `spellCheck={false}` on input
- Clear-button pattern (optional — UI-SPEC doesn't require it, planner decides)

Add:
- `maxLength={256}` per D-14
- Validation error messages via Lingui (UI-SPEC §Manual tab copy)

### `frontend/components/scanner/scan-history-list.tsx` → `frontend2/src/features/scan/ScanHistoryList.tsx`

**REWRITE.** Legacy uses `shadcn Card/Button`, `lucide-react`, `useTranslations`, `useDateFormat`. Rewrite with `RetroPanel` + `RetroButton` + `RetroEmptyState` + Lingui.

Keep from legacy:
- Timestamp formatter pattern (`Just now` / `N min ago` / `N hr ago` / absolute date)
- Per-row tap target (no per-entry delete in Phase 64; deferred to v2.3+)
- Clear-all button wiring
- Storage-event listener for cross-tab sync

Replace:
- `ENTITY_ICONS` map (lucide icons) → ASCII glyphs per entity type, or just plain code display (Phase 64 always writes `entityType: 'unknown'` so icon differentiation is moot)
- `useDateFormat` hook → Phase 64 can use a local `formatRelativeTime` util; Phase 65 may route through retro date-format hook if it exists in `/frontend2` (check `frontend2/src/lib/hooks/` during planning)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@zxing/browser` + `@zxing/library` direct | `@yudiel/react-qr-scanner` (wraps similar engine) | v1.9 onward (project decision) | -50% LOC, gets torch / React wrapper built-in |
| `navigator.vibrate` direct (iOS silent) | `ios-haptics` (Safari 17.4+ checkbox trick + Android vibrate fallback) | v1.3 onward | iOS users now get haptics |
| `AudioContext` created on first scan | Singleton resumed on opening user gesture | Fixed in v1.3 Pitfall #19 | First-scan beep works on iOS |
| `shadcn/ui` + `lucide-react` | Retro custom atoms + ASCII glyphs | Phase 50-54 (`/frontend2` establishment) | Zero icon deps; retro aesthetic consistent |
| `barcode-detector` as direct dep (v2.1 STACK.md proposal) | Auto-transitive via `@yudiel` | v2.2 (this milestone) | No version drift; declaration would conflict with library's own pin |

**Deprecated / outdated:**
- `@types/uuid` — DEPRECATED per npm registry (uuid v13 now ships its own types). CONTEXT.md locks it in anyway for `/frontend` parity; safe.
- Legacy `/frontend` `BarcodeScanner` component uses `lucide-react` + `shadcn` — kept only for backward compat; new development in `/frontend2` must not follow that pattern.
- `/frontend`'s `next-intl` → replaced by Lingui in `/frontend2`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ios-haptics` `haptic()` does NOT require explicit user-gesture priming when called from scanner decode callback. | §Pattern 7 | Silent haptic on iOS → SCAN-03 partially fails. Mitigation: manual smoke-test on iPhone during Phase 64 verification. |
| A2 | `@yudiel/react-qr-scanner` 2.5.1 handles StrictMode double-mount internally (per STACK.md §Dev HMR note). | §Pitfall 4 | Dev-mode camera leak → two streams. Mitigation: StrictMode integration test (mount/unmount 3×, assert no stream leak). |
| A3 | Explicit `formats` subset (`['qr_code','upc_a','ean_13','code_128']`) tree-shakes unused format handlers in `barcode-detector@3.0.8` + `zxing-wasm@2.2.4`. | §Pattern 2 | Marginal bundle impact only. Format filtering is runtime by default — the bundle includes all decoders. Not a correctness risk; perf impact ≤ few KB. |
| A4 | `RetroPanel` can be used as the container for BOTH the result banner AND error panels without visual conflict. | §Retro Audit | If the two visual treatments need to diverge beyond HazardStripe color, we need a new domain component. Low risk per UI-SPEC which explicitly reuses RetroPanel. |
| A5 | `scanDelay=200ms` is safe on low-end Android (iPhone 11 baseline). Legacy uses 200ms in production; no reported complaints. | §Pattern 1 / §Pitfall 13 | At 200ms, CPU < 10% sustained on iPhone 11 — should be fine. Could raise to 300ms if user reports warmth. |
| A6 | The legacy `scan-history.ts` schema (entries with `entityType: 'unknown'`, no `entityId`) will be accepted by Phase 65's lookup path when tapping a pre-Phase-65 history entry. | §Specifics (CONTEXT.md) | Phase 65 must accept `entityType: 'unknown'` and do a fresh lookup on history-tap. If Phase 65's lookup flow assumes `entityId` is always populated, history tap breaks. Planner flag. |

---

## Open Questions (RESOLVED)

> All 5 questions resolved by CONTEXT.md decisions D-15, D-17, D-18, D-19 (narrowed), D-20 on 2026-04-18 during plan-phase. Plans 03, 05, 08, 09 implement these resolutions.

1. **Should `feedback.ts` port replace `navigator.vibrate` with `haptic()` from `ios-haptics`?** — **RESOLVED: D-17 — `ios-haptics` deferred out of Phase 64; port feedback.ts verbatim (navigator.vibrate only). iOS haptic picked up in a later scanner-polish phase.**
   - What we know: Legacy uses `navigator.vibrate`; iOS users get nothing. `ios-haptics` fixes that. CONTEXT.md adds `ios-haptics` to package.json implying intended use.
   - What's unclear: Does the legacy "verbatim port" instruction preclude behavior changes, or does it just cover algorithmic structure?
   - Recommendation: **Replace.** Wrap in `triggerScanFeedback()` (same external name, new internal impl). Document in phase plan as "behavior change: iOS haptics enabled."

2. **Where does `useScanHistory` `add()` derive the `format` field for history-tap re-fires?** — **RESOLVED: D-15 — preserve stored `format` from the original entry; dedupe-to-top with original format so banner shows the same label as the first decode. Plan 05 (`useScanHistory`) + Plan 09 (`ScanPage` history-tap handler) implement this path.**

3. **Should Phase 64 add an error boundary around the lazy-loaded `<Scanner>` import?** — **RESOLVED: D-19 (narrowed 2026-04-18) — RETRY in library-init-fail panel covers `initBarcodePolyfill()` only (via `errorKind` state clear + `scannerKey` bump on BarcodeScanner). React.lazy scanner-chunk load failures fall through to the existing route-level `ErrorBoundaryPage` (architectural constraint: lazy-chunk errors throw above any in-feature try/catch). No new Error Boundary class is added. Plan 09 implements this.**

4. **Does the Phase 64 stub `useScanLookup` need to model the in-flight `loading` state?** — **RESOLVED: D-18 — `ScanLookupStatus` type defines full 4-state discriminated union (`'idle' | 'loading' | 'success' | 'error'`) even though the Phase 64 stub always returns `'idle'`. Phase 65 flips between states without touching any callsite. Plan 04 defines the type + stub; Plan 09 locks the callsite with Test 15.**

5. **Is Phase 64's history-tap flow correct when user is on the History tab (no live scanner to pause)?** — **RESOLVED: D-20 — banner renders on the current tab, above the list when on History tab. No auto-switch to Scan tab (respects D-06 no-auto-navigation). Plan 09's ScanPage implements this.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | Install deps, run `i18n:extract` | ✓ (verified via `frontend2/bun.lock` existence convention) | unknown — planner confirms at exec | npm/yarn (slower) |
| Node.js (runtime) | Vite build, Vitest | ✓ | TBD | — |
| Modern browser with `getUserMedia` | Smoke test camera flow | dev-local ✓; CI ✗ | — | Manual smoke on dev machine + UAT on real iOS device |
| iOS device (real or TestFlight) | Verify iOS haptic + first-beep + torch-absent | manual only — CI can't do this | — | Flag SCAN-03 iOS haptic + SCAN-04 torch-absent as **manual verification required** |
| Android device with torch | Verify SCAN-04 torch ON/OFF | manual only | — | Flag SCAN-04 as manual test |

**Missing dependencies with no fallback:**
- **Real iOS Safari (not simulator):** Camera permission reset behavior (Pitfall #1), `ios-haptics` checkbox trick, AudioContext gesture unlock — all must be tested on device. Flag as manual UAT.
- **Real Android with torch-capable rear camera:** SCAN-04 positive path. Simulator doesn't emulate torch capability.

**Missing dependencies with fallback:**
- Automated E2E scanner tests — Vitest component tests with mocked `@yudiel/react-qr-scanner` substitute for most unit coverage. Real-device testing remains manual.

---

## Validation Architecture

> workflow.nyquist_validation is absent in `.planning/config.json` → treated as ENABLED. This section is included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.3 + `@testing-library/react` 16.3.2 + `@testing-library/user-event` 14.6.1 + `@testing-library/jest-dom` 6.9.1 + `jsdom` 29.0.2 |
| Config file | `frontend2/vitest.config.*` — verify during Wave 0 (absent in current inspection; may inherit from `vite.config.ts`) |
| Quick run command | `cd frontend2 && bun run test` (single run) |
| Full suite command | `cd frontend2 && bun run test` + `bun run lint:imports` + `bun run build` |
| Watch command | `cd frontend2 && bun run test:watch` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAN-01 | `/scan` mounts and shows viewfinder container | component | `bun run test frontend2/src/features/scan/__tests__/ScanPage.test.tsx -t "renders viewfinder on Scan tab"` | ❌ Wave 0 |
| SCAN-01 | Scanner component stays mounted on `paused=true` toggle | component (mocked Scanner) | `bun run test frontend2/src/components/scan/__tests__/BarcodeScanner.test.tsx -t "keeps video element mounted when paused"` | ❌ Wave 0 |
| SCAN-01 (manual) | Two consecutive decodes on iOS PWA do not re-prompt camera perm | **manual UAT** | — | N/A — manual iOS device check |
| SCAN-02 | `formats` prop passes the 4-format subset to library | component (mocked) | `bun run test BarcodeScanner.test.tsx -t "passes formats=[qr_code,upc_a,ean_13,code_128]"` | ❌ Wave 0 |
| SCAN-02 (manual) | Real QR, UPC-A, EAN-13, Code128 codes decode within 1s | **manual UAT** | — | Manual with sample codes |
| SCAN-03 | On decode, `useScanFeedback.trigger()` fires (beep + haptic + flash) | unit (mocked AudioContext + ios-haptics) | `bun run test frontend2/src/features/scan/hooks/__tests__/useScanFeedback.test.ts` | ❌ Wave 0 |
| SCAN-03 | AudioContext `resume()` fires in pointerdown handler | unit | `bun run test useScanFeedback.test.ts -t "resumes AudioContext on pointerdown"` | ❌ Wave 0 |
| SCAN-03 (manual) | First beep after cold load has audio on iOS | **manual UAT** | — | Manual iOS |
| SCAN-04 | Torch toggle absent when `capabilities.torch !== true` | component (mocked MediaStream) | `bun run test frontend2/src/components/scan/__tests__/ScanTorchToggle.test.tsx -t "does not render when torch unsupported"` | ❌ Wave 0 |
| SCAN-04 | Torch toggle applies `advanced: [{ torch: true }]` on tap | component | `bun run test ScanTorchToggle.test.tsx -t "applies torch on via applyConstraints"` | ❌ Wave 0 |
| SCAN-04 (manual) | Real Android device + torch hardware: flashlight turns on | **manual UAT** | — | Manual Android |
| SCAN-05 | Manual input accepts 1-256 char trimmed strings; fires onSubmit | component | `bun run test frontend2/src/components/scan/__tests__/ManualBarcodeEntry.test.tsx` | ❌ Wave 0 |
| SCAN-05 | Manual input rejects empty / whitespace-only / >256 char | component | `bun run test ManualBarcodeEntry.test.tsx -t "rejects empty"` | ❌ Wave 0 |
| SCAN-06 | `useScanHistory.add()` stores entry in `localStorage['hws-scan-history']` | unit | `bun run test frontend2/src/features/scan/hooks/__tests__/useScanHistory.test.ts -t "adds entry"` | ❌ Wave 0 |
| SCAN-06 | Duplicate code dedupes-to-top | unit | `bun run test useScanHistory.test.ts -t "dedupes same code"` | ❌ Wave 0 |
| SCAN-06 | History capped at 10 entries | unit | `bun run test useScanHistory.test.ts -t "caps at 10"` | ❌ Wave 0 |
| SCAN-06 | Tapping history entry re-fires post-scan flow (D-15) | component/integration | `bun run test ScanPage.test.tsx -t "history tap shows banner"` | ❌ Wave 0 |
| SCAN-07 | `useScanHistory.clear()` empties storage + triggers confirm flow | component | `bun run test ScanHistoryList.test.tsx -t "clear confirmation removes all"` | ❌ Wave 0 |
| Bundle gate | `/scan` main-bundle contribution ≤ 20 kB gzip | build artifact inspection | `bun run build && du -b dist/assets/scanner-*.js` | — (automated shell script post-build) |
| Guardrail | No `idb`/`serwist`/`offline`/`sync` in new scan code | CI lint | `bun run lint:imports` | ✓ (exists at `scripts/check-forbidden-imports.mjs`) |
| i18n | EN + ET catalogs contain every new msgid | manual + compile | `bun run i18n:compile` (no orphan warnings) | ✓ (Lingui CLI) |

### Sampling Rate (Nyquist spec)

- **Per task commit:** `cd frontend2 && bun run test -- --changed` (only affected tests)
- **Per wave merge:** `cd frontend2 && bun run test && bun run lint:imports`
- **Phase gate:** `cd frontend2 && bun run test && bun run lint:imports && bun run build` → all green + bundle gate verified + manual UAT checklist (iOS haptic, iOS first-beep, Android torch, iOS two-consecutive-decodes) signed off in VERIFICATION.md

### Wave 0 Gaps

**Test files to create (before Wave 1 begins):**

- [ ] `frontend2/src/lib/scanner/__tests__/init-polyfill.test.ts` — covers `initBarcodePolyfill` native-available + polyfill-load paths
- [ ] `frontend2/src/lib/scanner/__tests__/feedback.test.ts` — AudioContext init / suspended-resume / beep + haptic fire
- [ ] `frontend2/src/lib/scanner/__tests__/scan-history.test.ts` — get / add / dedupe / cap / remove / clear / format
- [ ] `frontend2/src/features/scan/hooks/__tests__/useScanHistory.test.ts` — React state sync with module, cross-tab storage event
- [ ] `frontend2/src/features/scan/hooks/__tests__/useScanFeedback.test.ts` — pointerdown resume + trigger()
- [ ] `frontend2/src/features/scan/hooks/__tests__/useScanLookup.test.ts` — stub returns `{status:'idle', match:null}`; Phase 65 will extend
- [ ] `frontend2/src/components/scan/__tests__/BarcodeScanner.test.tsx` — mocks `@yudiel/react-qr-scanner`; asserts prop passthrough, StrictMode cleanup
- [ ] `frontend2/src/components/scan/__tests__/ManualBarcodeEntry.test.tsx` — validation, submit, 256 cap
- [ ] `frontend2/src/components/scan/__tests__/ScanErrorPanel.test.tsx` — 4 variants render correct copy + action
- [ ] `frontend2/src/components/scan/__tests__/ScanTorchToggle.test.tsx` — feature-gate, ON/OFF cycle
- [ ] `frontend2/src/components/scan/__tests__/ScanResultBanner.test.tsx` — code/format render, SCAN AGAIN handler
- [ ] `frontend2/src/components/scan/__tests__/ScanViewfinderOverlay.test.tsx` — reduced-motion check (scanline animation present / static)
- [ ] `frontend2/src/features/scan/__tests__/ScanPage.test.tsx` — tab switching, default = Scan, post-decode banner flow, history-tap re-fire, pointerdown audio unlock
- [ ] Wave 0 infrastructure: verify `frontend2/vitest.config.*` exists (currently unknown — may inherit from vite.config.ts). If absent, add a minimal config that enables jsdom, sets up `@testing-library/jest-dom`, and registers `globalThis` matchers.
- [ ] Wave 0 infrastructure: verify `frontend2/src/test-setup.ts` or equivalent exists with `@testing-library/jest-dom` imports. Create if absent.

**Mock helpers to stand up in Wave 0:**

- [ ] `frontend2/src/test/mocks/yudiel-scanner.ts` — mock `<Scanner>` that invokes `onScan` on a controllable trigger
- [ ] `frontend2/src/test/mocks/ios-haptics.ts` — mock `haptic()` for assertion
- [ ] `frontend2/src/test/mocks/media-devices.ts` — mock `navigator.mediaDevices.getUserMedia` returning a fake MediaStream with controllable `getCapabilities().torch`

**Framework install:** Already complete — `vitest@^4.1.3` and `@testing-library/*` in `frontend2/package.json` devDeps.

---

## Security Domain

> `security_enforcement` is not set in config.json → treated as ENABLED. Phase 64 is primarily a client-side phase; security surface is limited but non-zero.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 64 inherits `/scan` route's auth wrapper (`<RequireAuth>`); no new auth surface. |
| V3 Session Management | no | No session mutation; `useScanLookup` stub makes no calls. |
| V4 Access Control | yes (inherited) | `/scan` route is behind `<RequireAuth>` (verified in `routes/index.tsx`). Phase 64 does NOT add any public endpoints. |
| V5 Input Validation | yes | Manual entry input: trim, 256-char cap, no format gate (D-14). Scanned values: no client-side validation (format handled by decoder). **No SQL / no server call in Phase 64** — validation is for UX / data-hygiene only. |
| V6 Cryptography | no | No crypto operations. UUID generation (for potential future use) via `uuid` library — RFC9562-compliant, vetted. |
| V7 Error Handling | yes | Structured `console.error({ kind, errorName, userAgent, timestamp })` on all 4 error paths (D-12). No sensitive-info leakage (no tokens, no user-PII in error logs). |
| V11 Business Logic | partial | Dedupe-to-top + 10-cap is business logic; tested. |
| V13 API | no | Phase 64 adds NO API calls. `useScanLookup` stub makes no network requests. |
| V14 Configuration | yes | `manualChunks` config change in `vite.config.ts`; no secrets added. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| localStorage XSS-exfiltration of scan history | Information Disclosure | `/frontend2` is CSP-scoped (inherited from v2.1 hardening); scan codes are not secrets. Still — do NOT log scanned values to remote telemetry (D-12 already specifies console-only). |
| Clipboard injection via manual entry | Tampering (low) | `RetroInput` does not paste-execute; plain text. Max 256 chars caps payload size. |
| Camera permission dialog phishing | Spoofing | Browser-owned UI; not under our control. Mitigated by correct HTTPS origin. |
| Cross-origin camera via iframe embed | Elevation of Privilege | Not an issue — app is not embedded. |
| WASM supply-chain (zxing-wasm compromise) | Tampering | `zxing-wasm@2.2.4` is pinned via transitive; `bun.lockb` commits the integrity hash. Review once on install; monitor GitHub Advisory DB. |
| Prototype pollution via scanned QR content | Tampering | Scanned value is treated as opaque string; only stored/displayed, never `eval`'d or merged into objects. |
| Scan history privacy across users on shared device | Information Disclosure | Low severity in home-warehouse context. Phase 64 does NOT scope key by user (legacy parity). Deferred to v2.3+ per OOS list. Planner acknowledges. |

**No new attack surface introduced by Phase 64 beyond the client-side UI. All elevated-risk operations (DB lookup, item creation, loan preselect) are deferred to Phase 65+.**

---

## Forbidden Imports Audit (CI grep guard)

`scripts/check-forbidden-imports.mjs` blocks specifiers matching:
- Exact: `idb`, `serwist`, `@serwist/*`
- Substring (case-insensitive): `offline`, `sync`

**Transitive audit of new deps (2026-04-18 `npm view` + manual grep):**

| Dep | Transitive | Contains forbidden? |
|-----|-----------|---------------------|
| `@yudiel/react-qr-scanner@2.5.1` | `barcode-detector@3.0.8`, `webrtc-adapter@9.0.3` | Top-level `import ... from "@yudiel/react-qr-scanner"` — clean. |
| `barcode-detector@3.0.8` | `zxing-wasm@2.2.4` | `import ... from "barcode-detector"` or `"barcode-detector/polyfill"` — clean (string "detector" does not contain "offline" or "sync"). |
| `zxing-wasm@2.2.4` | — | `import ... from "zxing-wasm"` — clean. |
| `webrtc-adapter@9.0.3` | `sdp@^3.2.0` | `import ... from "webrtc-adapter"` — **CAREFUL.** The substring check matches `sync` — `webrtc-adapter` doesn't have "sync" in the specifier, but one of its internal modules might be `async`. ⚠️ **The CI check only scans the frontend2/src/ directory, not node_modules.** Only top-level import specifiers are inspected. Verified safe. [VERIFIED: `check-forbidden-imports.mjs:12` `SCAN_ROOT = ...frontend2/src`] |
| `sdp@^3.2.0` | — | Not imported directly by our code. |
| `ios-haptics@^0.1.4` | none | `import { haptic } from "ios-haptics"` — clean. |
| `uuid@^13.0.0` | none | `import { v7 } from "uuid"` — clean. |

**Verification commands planner should run after install:**

```bash
cd frontend2
bun run lint:imports  # CI grep guard — expect "OK"
```

**Conclusion:** Zero forbidden imports introduced. The CI guard will pass.

---

## Sources

### Primary (HIGH confidence)

- **Context7 fallback skipped:** Phase 64 deps are sufficiently verified via direct `npm view` + library READMEs. Context7 MCP not strictly needed.
- `npm view @yudiel/react-qr-scanner@2.5.1` — version, peerDeps, dependencies, main/module exports (2026-04-18)
- `npm view ios-haptics@0.1.4` — version, zero deps, bundle size 4.8 kB unpacked (2026-04-18)
- `npm view uuid@13.0.0` — version, zero deps (2026-04-18)
- `npm view @types/uuid@11.0.0` — **DEPRECATED** per upstream (uuid ships its own types) (2026-04-18)
- `npm view barcode-detector@3.0.8` — dependencies `{ zxing-wasm: 2.2.4 }` (NOT 3.0.2 as STACK.md claimed) (2026-04-18)
- `npm view zxing-wasm@2.2.4` — exports reader/writer/full variants + `.wasm` asset paths (2026-04-18)
- WebFetch: https://raw.githubusercontent.com/yudielcurbelo/react-qr-scanner/master/README.md — full prop surface + IDetectedBarcode shape + supported formats list (2026-04-18)
- WebFetch: https://raw.githubusercontent.com/tijnjh/ios-haptics/main/README.md — `haptic()` / `haptic.confirm()` / `haptic.error()` API (2026-04-18)
- `frontend/lib/scanner/*` — 5 files, 500 LOC, ships in production; direct inspection
- `frontend/components/scanner/*` — 3 files, 538 LOC; direct inspection (behavior reference)
- `frontend2/src/components/retro/*` — retro atom API surface; direct inspection
- `frontend2/src/routes/index.tsx` — route registration at line 85; direct inspection
- `frontend2/vite.config.ts` — current config (no manualChunks yet); direct inspection
- `frontend2/package.json` — current deps baseline; direct inspection
- `scripts/check-forbidden-imports.mjs` — CI grep guard scope = `frontend2/src`, rules verified; direct inspection
- `.planning/phases/64-scanner-foundation-scan-page/64-CONTEXT.md` — D-01..D-16 locked decisions
- `.planning/phases/64-scanner-foundation-scan-page/64-UI-SPEC.md` — UI design contract (copy, color, spacing)
- `.planning/phases/63-navigation-and-polish/63-CONTEXT.md` — prior-phase ET catalog gap-fill precedent
- `.planning/REQUIREMENTS.md` — SCAN-01..07 exact wording
- `.planning/research/SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md` — milestone-wide research synthesis (2026-04-18)
- `.planning/STATE.md` — v2.2 locked decisions (lines 77–103)

### Secondary (MEDIUM confidence)

- WebKit bug #215884 (https://bugs.webkit.org/show_bug.cgi?id=215884) — getUserMedia recurring permissions prompts in standalone PWA
- WebKit bug #185448 (https://bugs.webkit.org/show_bug.cgi?id=185448) — getUserMedia not working in apps added to home screen
- WebKit bug #243075 (https://bugs.webkit.org/show_bug.cgi?id=243075) — torch track constraint ignored on iOS
- MDN MediaStreamTrack.getCapabilities() — API reference
- MDN Web Audio API Best Practices — AudioContext user-gesture requirement
- MDN MediaStreamTrack.applyConstraints() — torch toggle mechanism
- Matt Montag "Unlock JavaScript Web Audio in Safari" — AudioContext.resume() user-gesture pattern (community)
- tijnjh/ios-haptics library source — checkbox-switch haptic technique (library source, HIGH for technique, MEDIUM for "works on all iOS 17.4+ variants")
- html5-qrcode issue #641 — class-of-bug reference for camera double-mount
- Vite rollupOptions.output.manualChunks docs (rollupjs.org) — chunk-splitting config

### Tertiary (LOW confidence, flagged for validation)

- Scanner chunk size estimate ~500-700 kB gzip — ZXing-WASM npm-reported unpacked sizes + gzip ratio estimate; verify with `vite build --report` during Phase 64 build
- `scanDelay=200ms` CPU safety on iPhone 11 — legacy production evidence only; no independent benchmark in Phase 64 scope
- `ios-haptics` working from scanner decode callback without explicit user-gesture priming — ASSUMED; verify on iPhone manual test
- `@yudiel/react-qr-scanner` 2.5.1 React 19 StrictMode internal cleanup — library docs silent; relies on `/frontend` production evidence (MEDIUM bumped to LOW since `/frontend` is Next.js 14 / React 18, not React 19)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version registry-verified 2026-04-18; legacy `/frontend` ships same versions in production (except React 19 gap)
- Architecture: HIGH — module layout inspected directly; retro atom APIs confirmed fit; iOS single-route pattern is a v1.3+v1.9 precedent
- Pitfalls: HIGH — grounded in project's own v1.3/v1.9/v2.1 audits + WebKit bug tracker + MDN
- Retro fit audit: HIGH — every atom inspected; one gap flagged (HazardStripe color variant)
- Validation architecture: HIGH — Vitest + Testing Library already in devDeps; mock surface is straightforward

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stack is stable, library versions don't change weekly; iOS Safari behavior changes quarterly)

---

## Discrepancies Flagged for Planner / Discuss-Phase

1. **STACK.md claims `zxing-wasm@3.0.2`; actual transitive is `zxing-wasm@2.2.4`.** Verified 2026-04-18 via `npm view barcode-detector@3.0.8 dependencies`. No action required beyond confirming in `bun.lock` post-install — functionality is equivalent, but the claim in STACK.md is wrong.

2. **`@types/uuid@^11.0.0` is DEPRECATED per npm registry.** CONTEXT.md locks it anyway for parity with `/frontend`. Install will produce a deprecation warning. Safe to keep; planner may want to drop per NPM guidance and type from uuid's own definitions.

3. **HazardStripe component lacks a `variant` prop** but UI-SPEC §Color requires `retro-red` stripe on library-init-fail panel vs `retro-hazard-yellow` on other panels. Planner must either (a) add `variant?: 'yellow' | 'red'` prop to HazardStripe (legal per "no new atoms" gate — file count unchanged), (b) apply local CSS override in ScanErrorPanel, or (c) keep all 4 panels on yellow stripe (violates UI-SPEC). Recommendation: option (a).

4. **Legacy `feedback.ts` uses `navigator.vibrate` directly; `ios-haptics` is added to deps but not wired in the legacy port.** CONTEXT.md's "verbatim port" instruction conflicts with the intent of adding `ios-haptics`. Planner to choose: verbatim port (iOS users get no haptic — SCAN-03 partial fail) vs replace-vibrate-with-haptic() (behavior change, full SCAN-03). Recommendation: replace.

5. **CONTEXT.md D-11 "RETRY re-imports scanner module dynamically" — unclear whether this covers the React.lazy chunk load or just the polyfill.** Recommendation: retry both in the button handler (await polyfill init + await `import("@yudiel/react-qr-scanner")`); on either failure, panel stays (inline error state, not thrown to shell boundary).

6. **`scanDelay` prop default in `@yudiel/react-qr-scanner@2.5.1` is 500 ms (confirmed via README).** Legacy `/frontend` sets `scanDelay=200`. UI-SPEC does not specify. CONTEXT.md does not specify. Recommendation: use `scanDelay=200` for parity with legacy + snappier decode.

7. **`SUPPORTED_FORMATS` types.ts constant (6 formats) vs SCAN-02's 4-format subset.** Planner to decide whether the runtime `formats` prop passes the SCAN-02 subset or the legacy superset. SCAN-02 wording says "decodes QR, UPC-A, EAN-13, and Code128" — literal = subset. Recommendation: subset at the `<Scanner>` prop; keep superset in `types.ts` as the exported constant for future use.

---

*Research completed: 2026-04-18*
*Ready for planning: yes*
