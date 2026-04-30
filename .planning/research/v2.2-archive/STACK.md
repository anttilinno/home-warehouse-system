# Technology Stack — v2.2 Scanning & Stabilization Additions

**Project:** Home Warehouse System — `/frontend2` retro frontend
**Researched:** 2026-04-18
**Mode:** Ecosystem (targeted additions)
**Overall confidence:** HIGH

## Context Summary

`/frontend2` is already on its v2.1 baseline (Vite 8 + React 19.2.5 + React Router v7 library mode + Tailwind CSS 4, TanStack Query v5, react-hook-form + zod, Lingui v5, `@floating-ui/react` 0.27, hand-rolled retro component library, online-only). v2.2 adds:

1. Barcode/QR scanner at `/scan` (QR + UPC/EAN + Code128) with torch, feedback, and scan history
2. Manual barcode entry fallback
3. Quick-action menu after a successful scan (View/Loan/Move/Repair)
4. Mobile Floating Action Button with context-aware radial menu
5. Scan integration inside loan creation + quick capture flows

This document covers **only the NEW libraries** required beyond the v2.1 baseline. All v2.1 decisions (React Query, RHF, zod, Lingui, `@floating-ui/react`, retro components) carry forward unchanged.

---

## Recommended Stack Additions

### Core Additions (required)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@yudiel/react-qr-scanner` | `2.5.1` (exact) | Camera-based QR + 1D barcode scanning | React 19 peerDep-clean (`^17 \|\| ^18 \|\| ^19`), same version frontend1 ships in production through v1.9, built on the native `BarcodeDetector` API with a bundled `barcode-detector` polyfill. Exposes QR + UPC/EAN + Code128 + Code39 + DataMatrix + PDF417 + ITF out of the box. Built-in `torch` UI option (`components.torch: true`) handles flashlight plumbing. ~100 kB gzip incl. polyfill WASM loader. |
| `ios-haptics` | `^0.1.4` | Haptic feedback on scan + FAB tap (iOS Safari) | `navigator.vibrate` is unreliable on iOS Safari (WebKit intentionally does not expose a public vibration API; status has shifted in 2025–2026 but cannot be relied on). `ios-haptics` uses a hidden `<input type="checkbox" switch>` label-click hack that iOS Safari treats as a system haptic, and falls back to `navigator.vibrate` on Android. 4.7 kB unpacked, zero runtime deps. Matches frontend1 decision. |
| `uuid` | `^13.0.0` | Client-generated idempotency keys for scan-driven creates | Already mandated by v1.1 decision for all creates; scan "not-found → create" flow needs it. `@types/uuid` v11 for types. |

### Deliberately NOT Added

| Library | Alternative Chosen | Reason |
|---------|--------------------|--------|
| `barcode-detector` (direct dep) | Bundled by `@yudiel/react-qr-scanner@2.5.1` as `barcode-detector@3.0.8` | Declaring it directly forces version drift risk. The scanner pins its own polyfill and re-exports are not needed. The v2.1 STACK.md entry for `barcode-detector@3.0.0` was speculative — frontend2 never installed it, and `@yudiel/react-qr-scanner@2.5.1` already pulls in `3.0.8` automatically. Drop the direct dep from the v2.1 plan. |
| `html5-qrcode` | `@yudiel/react-qr-scanner` | No React bindings, DOM-mutation API, 2.5 MB unpacked, not React-19-aware. Would require a wrapper component and fights Tailwind/retro styling with injected chrome. |
| `@zxing/browser` + `@zxing/library` | `@yudiel/react-qr-scanner` (which wraps the same engine family) | ~15 MB combined unpacked, no peerDep on React, no torch helper, would require ~200 LOC of glue to get to feature parity with `@yudiel`. |
| `@ericblade/quagga2` | `@yudiel/react-qr-scanner` | QR detection is weak (Quagga2 is 1D-focused), 3.7 MB unpacked, depends on `gl-matrix`. Used by legacy /frontend v1.3, but the project already migrated off it when adopting `@yudiel` in v1.9. Regressing would be a step backward. |
| `react-haptic-feedback` / generic haptic wrappers | `ios-haptics` | `ios-haptics` is the specific technique that works on iOS Safari 17.4+; generic wrappers only call `navigator.vibrate` and silently no-op on iOS. |
| `@spaceymonk/react-radial-menu` | Hand-rolled FAB + radial menu on top of existing `@floating-ui/react` | Only 48 kB unpacked but imposes its own theming, animation model, and sub-menu assumptions. FAB radial with 3–5 static actions is ~150 LOC using existing `@floating-ui/react` primitives; we already own the animation tokens via Tailwind 4. Avoid a library that fights the retro aesthetic. |
| `@radix-ui/react-popover` | `@floating-ui/react` (already installed) | `@floating-ui/react` is what Radix itself uses under the hood. We already have it for RetroCombobox. Adding Radix would reintroduce chrome/theme conflicts we avoided in v2.1. |
| `react-easy-radial-menu` | Hand-rolled | Package does not exist on npm (confirmed 404 on registry lookup). Listed in the question as a candidate but it is not a real library. |
| `idb` / IndexedDB wrapper | `localStorage` (scan history only) | Online-only stance per v2.1. Scan history is capped at last 10 entries (~1 kB JSON). `localStorage` is synchronous, survives reloads, and needs no library. |

### Already in Place (NOT re-added)

| Existing | Use in v2.2 |
|----------|-------------|
| `@floating-ui/react@^0.27.19` | FAB radial menu positioning, quick-action menu after scan, scan-history popover. Use `useFloating` + `useTransitionStyles` + `FloatingPortal`. |
| `@tanstack/react-query@^5` | Barcode lookup mutation (`POST /api/items/lookup`), item-not-found → create mutation, scan-driven loan creation. |
| `react-hook-form@^7.72.1` + `@hookform/resolvers` + `zod@^4.3.6` | Manual barcode entry input (format validation), "item not found → create" form. |
| `@lingui/core` + `@lingui/react` | All scanner strings + FAB action labels. Estonian catalog must gap-fill (carryover from v2.1). |
| Retro components (`RetroButton`, `RetroPanel`, `RetroDialog`, `RetroInput`, `RetroToast`, `RetroFormField`) | Scanner shell, manual entry modal, not-found overlay, quick-action menu visuals. |

---

## Integration Notes (Vite 8 + React 19 + Tailwind 4 specific)

### `@yudiel/react-qr-scanner` with Vite 8

- The library ships ESM + CJS; Vite 8 picks ESM automatically.
- Depends on `webrtc-adapter@9.0.3` (runtime, not peer). This imports `sdp` and uses `globalThis` — both fine with Vite 8's default config.
- The `barcode-detector` polyfill lazy-loads a WASM blob from `zxing-wasm`. In Vite, leave it dynamic — do not `optimizeDeps.include` it, or the WASM binary ends up in the main chunk.
- Production build: add `zxing-wasm` to `build.rollupOptions.output.manualChunks` under a `"scanner"` chunk name so it splits off the main bundle (keeps first-paint budget intact for users who never hit `/scan`).
- Dev HMR: scanner unmount leaks `MediaStreamTrack`s if the `<Scanner>` unmounts without `track.stop()`. The library handles this internally in 2.5.x but only if the component actually unmounts. Ensure the `/scan` route uses `React.lazy` and an `AbortController` pattern so HMR-triggered remounts don't accumulate camera handles.

### Tailwind 4 + retro overlay on the video element

- `<Scanner>` renders its own `<video>` element; Tailwind classes applied to the wrapping container work but cannot style the inner video. For the retro scanline + corner brackets, position an absolute-sibling `<RetroPanel>` overlay inside the same container — same pattern frontend1 used.
- Tailwind 4's `@property` and container queries work normally; no special config for the scanner.

### iOS Safari quirks (critical)

1. **Camera permission persistence**: iOS PWA loses camera permission on navigation away from a page with an active `getUserMedia` stream. The existing v2.1 decision — single-page scan flow at `/scan` — carries forward. Do NOT allow sub-routes inside `/scan`; use modal overlays and state for "not found → create", loan selection, etc.
2. **Torch on iOS**: `MediaStreamTrack.applyConstraints({ advanced: [{ torch: true }] })` is **ignored on iOS Safari** (WebKit bug #243075, still open as of 2026-04). `@yudiel/react-qr-scanner`'s built-in torch button will render but silently no-op on iPhone. Plan the UX accordingly:
   - Detect `track.getCapabilities().torch === true` before rendering the torch button — the library already does this, so the button auto-hides on iOS.
   - Communicate "Flashlight unavailable on iOS" in a `RetroTooltip` attached to the camera icon area, not as a disabled button.
   - Android Chrome/Firefox: torch works via the library's built-in control with no extra code.
3. **Haptics**: Use `ios-haptics` `triggerHapticFeedback()` on every successful scan. Do not call `navigator.vibrate` directly — on iOS Safari it may or may not no-op depending on Safari version and the result is inconsistent (per MDN browser-compat issue #29166).
4. **Audio feedback**: Use a single long-lived `AudioContext` created lazily on the first user tap (permission gesture) and reused for every scan beep. Do **not** `new Audio('/beep.mp3').play()` each time — mobile Safari stalls the third or fourth playback and `.play()` returns a rejected promise under silent-switch. Trade-off: Web Audio respects the iOS silent switch (emits nothing when muted); HTMLAudioElement does not. For a scan-feedback beep this is the correct behavior — users on silent expect silence.
   - Pattern: `audioCtx = audioCtx ?? new (window.AudioContext || webkitAudioContext)()`, then `const osc = audioCtx.createOscillator(); osc.frequency.value = 880; osc.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.08);`
   - Zero-dep; no MP3 asset to ship.
   - Call `audioCtx.resume()` inside the same click handler that opens `/scan`.
5. **Tab backgrounding**: `MediaStream` tracks pause on iOS when the tab is backgrounded. The scanner library handles visibility-change, but our wrapper must show a "Tap to resume" overlay when `document.visibilityState` returns to `visible`.

### FAB + radial menu build pattern

Use what's already installed. No new dep.

```tsx
// Sketch — real implementation uses retro components + Lingui
import { useFloating, FloatingPortal, useTransitionStyles } from '@floating-ui/react'
import { useLongPress } from 'react' // or inline timer; no use-long-press dep needed

function FabRadialMenu({ actions }) {
  const [open, setOpen] = useState(false)
  const { refs, floatingStyles } = useFloating({ open, onOpenChange: setOpen, placement: 'top' })
  // Radial layout: compute N anchor points on a 96px-radius arc from refs.floating.
  // Animate with Tailwind 4 transition utilities + data-[state=open]:... variants.
}
```

- 3–5 actions laid out on a quarter-circle arc above the 56 px FAB.
- Context-aware: `/items` → [Scan, New Item, Quick Capture]; `/loans` → [Scan, New Loan]; default → [Scan, New Item].
- Backdrop-scrim modal-style dismiss on outside tap (floating-ui's `useDismiss` handles it).
- Haptic on FAB press (`ios-haptics`), haptic on action selection.
- Hidden on ≥md breakpoint via `md:hidden`.
- Visible Viewport API integration (already used in v1.3) keeps the FAB above the on-screen keyboard.

### Scan history persistence

**Stance: localStorage, confirmed.** Online-only milestone, 10 entries max, synchronous API is fine for UI reads.

```ts
type ScanHistoryEntry = { code: string; format: string; timestamp: number; itemId?: string }
const KEY = 'hw:scan-history:v1'
// 10 entries × ~100 bytes = ~1 kB. localStorage quota (~5 MB) is unaffected.
```

- Version the storage key (`:v1`) so future schema changes don't crash existing sessions.
- Wrap reads in a try/catch — private browsing on iOS Safari can throw on `setItem`.
- Do NOT add `idb` / IndexedDB. Revisit in v2.3+ if offline scanning enters scope.

---

## Installation

```bash
cd frontend2
bun add @yudiel/react-qr-scanner@2.5.1 ios-haptics uuid
bun add -d @types/uuid
```

Lock `@yudiel/react-qr-scanner` to `2.5.1` exact (no caret) for parity with frontend1 and to avoid picking up unannounced 2.6.x breaking changes while both frontends coexist. `ios-haptics` and `uuid` can use caret ranges.

Resulting `dependencies` delta in `frontend2/package.json`:

```json
"@yudiel/react-qr-scanner": "2.5.1",
"ios-haptics": "^0.1.4",
"uuid": "^13.0.0"
```

Dev delta:

```json
"@types/uuid": "^11.0.0"
```

Total added transitive cost: `@yudiel/react-qr-scanner` pulls `barcode-detector@3.0.8` (which pulls `zxing-wasm@3.0.2`) and `webrtc-adapter@9.0.3`. Together ~700 kB unpacked, but the bulk is the `zxing-wasm` binary which must be chunked (see Vite integration note above).

---

## Version & Compatibility Matrix (verified 2026-04-18)

| Library | Installed Version | React 19 peerDep | Bundle (gzip, approx) | Notes |
|---------|-------------------|------------------|----------------------|-------|
| `@yudiel/react-qr-scanner` | `2.5.1` | `^17 \|\| ^18 \|\| ^19` ✓ | ~25 kB (wrapper) + ~75 kB lazy (WASM polyfill) | Latest on npm; no 2.6.x exists. Confirmed via `npm view`. |
| `barcode-detector` (transitive) | `3.0.8` | none (non-React) | ~70 kB gzip (WASM binary separate) | Pulled in by `@yudiel` 2.5.1; do not install directly. |
| `webrtc-adapter` (transitive) | `9.0.3` | none | ~15 kB gzip | WebRTC shim; works on all modern mobile browsers. |
| `ios-haptics` | `0.1.4` | none (`>=16.8` React implicit via peer) | <1 kB gzip | 4.7 kB unpacked, vanilla JS. Works without React. |
| `uuid` | `13.x` | none | ~2 kB gzip (v7 subset) | Tree-shake to `import { v7 } from 'uuid'`. |

Confidence on each row: HIGH (registry-verified).

---

## Alternatives Considered (summary)

| Need | Recommended | Alternatives rejected | Reason |
|------|-------------|----------------------|--------|
| Barcode/QR scanning | `@yudiel/react-qr-scanner@2.5.1` | `html5-qrcode`, `@zxing/browser`, `@ericblade/quagga2` | Only `@yudiel` has React 19 peerDep, built-in torch API, and is already production-validated across iOS PWA in this project. |
| Haptics | `ios-haptics` | `navigator.vibrate` direct, `react-haptic-feedback` | `ios-haptics` is the only approach known to work on iOS Safari using the checkbox-switch trick. Direct `navigator.vibrate` is unreliable on iOS. |
| Audio | Native `AudioContext` (oscillator) | `new Audio('/beep.mp3')`, `howler.js`, `tone.js` | A 2-line oscillator has zero dep cost and respects silent mode. Ship no MP3 asset. |
| Radial menu | Hand-rolled with `@floating-ui/react` | `@spaceymonk/react-radial-menu`, `@radix-ui/react-popover` | We already own `@floating-ui/react`. 3–5 static actions do not justify a dependency that brings its own theme and animations. |
| Long-press | Inline `pointerdown` timer (~20 LOC) | `use-long-press@3.3.0` | Frontend1 used it; for frontend2 the primitive is small enough to inline and avoids another dep. Revisit if we need press-and-hold on >3 places. |
| Scan history | `localStorage` with versioned key | `idb`, in-memory only | Online-only milestone; 10 entries × ~100 B; synchronous is fine. No IndexedDB layer exists in frontend2 and adding one would contradict v2.1. |

---

## Risk Flags for Requirements/Roadmap

1. **iOS torch is a real gap, not a bug.** Any copy that says "tap the flashlight icon" will be wrong on half the user base. The requirements doc should state: "Flashlight toggle on Android browsers only; hidden automatically on iOS." The library handles the detection; ensure the UI copy doesn't promise it.
2. **First-scan audio silence on iOS.** The `AudioContext` must be `resume()`-ed during the same user gesture that navigates to `/scan`. If we lazy-init on first scan, the first scan will be silent. Plan a prep step in the navigation handler.
3. **Camera permission re-prompt on sub-navigation.** The single-route `/scan` page is load-bearing. Ensure the roadmap does not split scanning into nested routes (`/scan/result`, `/scan/manual`) — use overlays/state on the single route.
4. **Scanner chunk size.** The ~70 kB WASM binary must be manual-chunked in `vite.config.ts` or it bloats the main-bundle gzip budget for users who never open `/scan`. Add this to the scanner phase's acceptance checklist.
5. **Scan history schema**. Use a versioned `localStorage` key from day one — `hw:scan-history:v1`. If we later move to IndexedDB (v2.3+ offline milestone), we want a clean cutover, not a silent format collision.
6. **`ios-haptics` maintenance.** Version is 0.1.4, stable but lightly maintained. If it breaks, the fallback is `navigator.vibrate` with a documented iOS gap. Acceptable risk for <1 kB of code.

---

## Sources

- `frontend2/package.json` — existing baseline (HIGH)
- `frontend/package.json` — legacy reference, validates `@yudiel/react-qr-scanner@2.5.1` + `ios-haptics@0.1.4` in production (HIGH)
- `.planning/PROJECT.md` — v1.3 / v1.9 decisions confirming scanner + haptics + AudioContext choices (HIGH)
- npm registry `npm view` — version, peerDep, and unpacked-size verification for every listed library as of 2026-04-18 (HIGH)
- [WebKit bug #243075 "torch track constraint ignored on iOS"](https://bugs.webkit.org/show_bug.cgi?id=243075) — torch unsupported on iOS Safari (HIGH)
- [MDN browser-compat-data issue #29166 "navigator.vibrate works on iOS Safari"](https://github.com/mdn/browser-compat-data/issues/29166) — iOS vibration API status is inconsistent (MEDIUM — community tracking, not spec)
- [Matt Montag — "Unlock JavaScript Web Audio in Safari"](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos) — `AudioContext.resume()` on user gesture (MEDIUM)
- [tijnjh/ios-haptics GitHub](https://github.com/tijnjh/ios-haptics) — checkbox-switch haptic technique (HIGH — library source)
- [@yudiel/react-qr-scanner npm](https://www.npmjs.com/package/@yudiel/react-qr-scanner) — torch component prop, camera API (HIGH)
- [@yudiel/react-qr-scanner GitHub](https://github.com/yudielcurbelo/react-qr-scanner) — 2.5.1 release, peerDeps (HIGH)
