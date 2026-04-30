---
phase: 64
plan: 06
subsystem: frontend2/src/components/scan
tags: [barcode-scanner, viewfinder, torch-probe, retro-viewfinder, wave-2, tdd]
requires:
  - 64-01 (retro barrel: RetroButton + HazardStripe variant="yellow"|"red")
  - 64-02 (test mocks: yudiel-scanner, media-devices)
  - 64-03 (lib/scanner barrel: initBarcodePolyfill)
provides:
  - frontend2/src/components/scan/BarcodeScanner (retro-wrapped <Scanner> + torch probe + error-kind surfacing)
  - frontend2/src/components/scan/ScanViewfinderOverlay (corner reticle + amber scanline, reduced-motion aware)
  - frontend2/src/components/scan/ScanTorchToggle (feature-gated retro torch button, aria-pressed)
affects:
  - Plan 64-07 (ScanErrorPanel — consumes BarcodeScannerErrorKind union in onError callback)
  - Plan 64-09 (ScanPage — mounts BarcodeScanner, wires onDecode → useScanHistory.add + useScanFeedback.trigger, onError → ScanErrorPanel variant switch)
tech-stack:
  added: []
  patterns:
    - "Retro-wrapped 3rd-party library: relative ink-border container hosts <Scanner>, sibling-stacked ScanViewfinderOverlay + conditionally-mounted ScanTorchToggle (D-16 no-render-when-unsupported)"
    - "Torch capability probe (Pitfall #4 / PATTERNS §S8): single getUserMedia → getCapabilities().torch → track.stop(), with streamsRef<MediaStream[]> cleanup on unmount; iOS UA short-circuit to false pre-probe"
    - "Error-kind surfacing (NOT rendering): onError(kind) callback maps DOMException name → union member; parent switches UI; component never renders an error panel"
    - "Inline <style> keyframe scoping: @keyframes scan-sweep + .animate-scan-sweep class lives inside ScanViewfinderOverlay (React dedupes identical style nodes), keeping globals.css untouched"
    - "prefers-reduced-motion useEffect hook with addEventListener('change') fallback to addListener for older Safari"
    - "vi.mock bridge module pattern: tests mock '@yudiel/react-qr-scanner' via `async () => import('@/test/mocks/yudiel-scanner')`, and mock '@/lib/scanner' to replace initBarcodePolyfill with a vi.fn spy"
key-files:
  created:
    - frontend2/src/components/scan/ScanViewfinderOverlay.tsx
    - frontend2/src/components/scan/ScanTorchToggle.tsx
    - frontend2/src/components/scan/BarcodeScanner.tsx
    - frontend2/src/components/scan/__tests__/ScanViewfinderOverlay.test.tsx
    - frontend2/src/components/scan/__tests__/ScanTorchToggle.test.tsx
    - frontend2/src/components/scan/__tests__/BarcodeScanner.test.tsx
  modified: []
decisions:
  - "scan-sweep keyframe lives INLINE in ScanViewfinderOverlay (<style> tag inside the returned JSX), not in globals.css. Rationale: UI-SPEC explicitly marks both locations as acceptable; inline keeps the change localized and avoids a Plan 10 edit to globals.css. React dedupes identical <style> children when multiple overlays co-mount."
  - "Torch toggle is VISUAL-ONLY in Phase 64 — applyConstraints({ advanced: [{ torch }] }) is NOT wired. @yudiel/react-qr-scanner v2.5.1 does not expose the active MediaStreamTrack handle, and hand-rolling a second getUserMedia races the library's exclusive-use lock (Pitfall #4). Hardware ON/OFF is a manual UAT path per VALIDATION.md; automated tests cover (a) button presence when torchSupported, (b) aria-pressed + variant flip on click."
  - "Error-kind mapping is hardcoded in BarcodeScanner.tsx (not extracted to lib/scanner) because it's single-call-site — ScanPage consumes the kind; no other component needs the mapping."
  - "Plan 64-06 does NOT introduce a components/scan/index.ts barrel. Downstream plans (64-07, 64-08) can add it when they land ManualBarcodeEntry / ScanResultBanner / ScanErrorPanel / ScanHistoryList — keeps the barrel a one-shot edit per the RESEARCH.md §19 pattern instead of churning it every wave."
metrics:
  duration_min: 7
  tasks_completed: 3
  commits: 6
  files_created: 6
  files_modified: 0
  tests_added: 25
  completed_at: "2026-04-18T20:55:00Z"
requirements_addressed: [SCAN-01, SCAN-02, SCAN-04]
---

# Phase 64 Plan 06: BarcodeScanner + ScanViewfinderOverlay + ScanTorchToggle Summary

Delivered the three viewfinder-surface retro components that form the visual hallmark of the `/scan` route. `BarcodeScanner` wraps `@yudiel/react-qr-scanner`'s `<Scanner>` in a 3px ink-border retro container, runs `initBarcodePolyfill()` on mount, probes torch capability via a throwaway `getUserMedia` (with iOS UA short-circuit and `streamsRef` cleanup per PATTERNS §S8), and surfaces the four scanner error kinds upward via `onError(kind)` without ever rendering an error panel itself. `ScanViewfinderOverlay` is a pure-CSS overlay (four corner brackets + a 2s linear-infinite amber scanline, scoped `<style>` keyframes) that respects `prefers-reduced-motion`. `ScanTorchToggle` is a feature-gated `RetroButton` with `aria-pressed` and a primary↔neutral variant swap — the parent decides whether to mount it, following D-16 "not rendered at all when unsupported."

## Exact `<Scanner>` Prop Surface (for downstream verification)

```tsx
<Scanner
  paused={paused}                                       // prop passthrough
  onScan={(codes) => onDecode({code: codes[0].rawValue, // allowMultiple=false → len 1
                               format: codes[0].format})}
  onError={(err) => onError(mapScannerErrorToKind(err))}
  formats={["qr_code", "upc_a", "ean_13", "code_128"]}  // SCAN-02 subset
  constraints={{
    facingMode: "environment",                          // rear camera preference
    width: { ideal: 1280 },
    height: { ideal: 720 },
  }}
  scanDelay={200}                                       // legacy value, RESEARCH §Discrepancies #6
  allowMultiple={false}                                 // first-hit wins
  sound={false}                                         // we own audio via useScanFeedback
  components={{ finder: false, torch: false }}          // we render our own overlay + button
/>
```

## Error-Kind Mapping Table (`mapScannerErrorToKind`)

| `err.name` (DOMException) | Returned `BarcodeScannerErrorKind` | Downstream `ScanErrorPanel` variant |
|---|---|---|
| `NotAllowedError` | `"permission-denied"` | `permission-denied` (hazard-yellow, platform-specific instructions + USE MANUAL ENTRY) |
| `NotFoundError` | `"no-camera"` | `no-camera` (hazard-yellow, USE MANUAL ENTRY + RELOAD PAGE) |
| `OverconstrainedError` | `"no-camera"` | same as above |
| `NotSupportedError` | `"unsupported-browser"` | `unsupported-browser` (hazard-yellow, USE MANUAL ENTRY only — no retry) |
| _anything else (including polyfill init failure)_ | `"library-init-fail"` | `library-init-fail` (red HazardStripe, RETRY + USE MANUAL ENTRY) |

The polyfill-init failure path is surfaced via a separate code path (catch block around `initBarcodePolyfill()` in the mount effect), not the `onError` prop of `<Scanner>` — but both paths feed the same `onError(kind)` callback with the same `library-init-fail` kind.

## scan-sweep Keyframe Location Decision

**Chosen location:** INLINE in `ScanViewfinderOverlay.tsx` via a `<style>` child of the overlay root.

**Rationale:** UI-SPEC §Viewfinder Visual Spec (lines 356-363) marks both "inline `<style>`" and "appended to globals.css" as acceptable. Inline keeps this plan's surface area to six new files with zero modifications, avoiding an orthogonal globals.css edit that would have to be re-verified in every later retro-styling phase. React dedupes identical `<style>` nodes at runtime (verified empirically — co-mounting two overlays produces one `<style>` in the flushed HTML). The `animate-scan-sweep` class name is locally defined in the same `<style>` block to keep the keyframe + its utility class co-located — no Tailwind theme token needed.

## Test Count per File

| Test File | Tests | Behaviors Covered |
|-----------|-------|-------------------|
| `__tests__/ScanViewfinderOverlay.test.tsx` | **5** | 4 corners present, scanline present, `animate-scan-sweep` class on scanline, `prefers-reduced-motion: reduce` strips animation class + sets `data-reduced-motion="true"`, zero-prop invocation compiles |
| `__tests__/ScanTorchToggle.test.tsx` | **5** | `TORCH OFF` + `[◉]` label at torchOn=false, `TORCH ON` + `[◉]` label at torchOn=true, `aria-pressed` serialization ("false"/"true"), single `onToggle` call per click / no call on render, neutral↔primary variant swap (`bg-retro-cream` vs `bg-retro-amber`) |
| `__tests__/BarcodeScanner.test.tsx` | **15** | `initBarcodePolyfill` called once on mount; torch probe uses `getUserMedia({video:{facingMode:"environment"}})` then stops the track; iOS UA short-circuit (`getUserMedia` NOT called + no TORCH button); no-torch-when-caps-absent; torch-button-when-caps-present; formats subset passthrough; `paused` prop passthrough (mount + rerender); `scanDelay=200`; `sound=false`; `components={finder:false,torch:false}`; `constraints.facingMode="environment"`; `allowMultiple=false`; decode mapping to `{ code, format }`; 5-way error-kind mapping (NotAllowed/NotFound/Overconstrained/NotSupported/unknown); `streamsRef` cleanup on unmount |

**Total new tests:** 25 (across three RED → GREEN task pairs).

## Commits

| Task | Gate | Hash | Message |
|------|------|------|---------|
| 1 | RED | `b5672e1` | `test(64-06): add failing test for ScanViewfinderOverlay` |
| 1 | GREEN | `951ccd9` | `feat(64-06): implement ScanViewfinderOverlay (UI-SPEC §Viewfinder)` |
| 2 | RED | `18f1870` | `test(64-06): add failing test for ScanTorchToggle` |
| 2 | GREEN | `1d75fa1` | `feat(64-06): implement ScanTorchToggle (SCAN-04 rendered path, D-16)` |
| 3 | RED | `fc5d143` | `test(64-06): add failing test for BarcodeScanner` |
| 3 | GREEN | `6f95f2f` | `feat(64-06): implement BarcodeScanner (SCAN-01, SCAN-02, SCAN-04 probe)` |

## Verification Results

| Check | Result |
|-------|--------|
| `bun run test -- ScanViewfinderOverlay --run` | **5/5 passed** |
| `bun run test -- ScanTorchToggle --run` | **5/5 passed** |
| `bun run test -- BarcodeScanner --run` | **15/15 passed** |
| `bun run test --run` (full regression) | **556/556 passed** (was 531 — +25 new) |
| `bunx tsc --noEmit -p tsconfig.json` | clean |
| `bun run lint:imports` | clean (no forbidden substrings) |
| `grep -c "export function ScanViewfinderOverlay" …/ScanViewfinderOverlay.tsx` | 1 |
| `grep -c "viewfinder-corner" …/ScanViewfinderOverlay.tsx` | 4 |
| `grep -c "viewfinder-scanline" …/ScanViewfinderOverlay.tsx` | 1 |
| `grep -c "prefers-reduced-motion" …/ScanViewfinderOverlay.tsx` | 3 |
| `grep -c "scan-sweep" …/ScanViewfinderOverlay.tsx` | 4 |
| `grep -c "bg-retro-amber" …/ScanViewfinderOverlay.tsx` | 2 |
| `grep -c "framer-motion" …/ScanViewfinderOverlay.tsx` | 0 |
| `grep -c "lucide-react" …/ScanViewfinderOverlay.tsx` | 0 |
| `grep -c "import.*motion" …/ScanViewfinderOverlay.tsx` | 0 |
| `grep -c "export function ScanTorchToggle" …/ScanTorchToggle.tsx` | 1 |
| `grep -c "aria-pressed" …/ScanTorchToggle.tsx` | 2 |
| `grep -c "TORCH ON" …/ScanTorchToggle.tsx` | 2 |
| `grep -c "TORCH OFF" …/ScanTorchToggle.tsx` | 2 |
| `grep -c 'from "@/components/retro"' …/ScanTorchToggle.tsx` | 1 (barrel-only) |
| `grep -c 'from "@/components/retro/' …/ScanTorchToggle.tsx` | 0 (no direct file import) |
| `grep -c "useLingui" …/ScanTorchToggle.tsx` | 2 |
| `grep -c "export function BarcodeScanner" …/BarcodeScanner.tsx` | 1 |
| `grep -c "export type BarcodeScannerErrorKind" …/BarcodeScanner.tsx` | 1 |
| `grep -c 'from "@yudiel/react-qr-scanner"' …/BarcodeScanner.tsx` | 1 |
| 4 formats present (`qr_code`, `upc_a`, `ean_13`, `code_128`) | 1 each ✓ |
| `grep -c "scanDelay={200}" …/BarcodeScanner.tsx` | 1 |
| `grep -c "sound={false}" …/BarcodeScanner.tsx` | 1 |
| `grep -c "allowMultiple={false}" …/BarcodeScanner.tsx` | 1 |
| `grep -c "finder: false" …/BarcodeScanner.tsx` | 2 (props + inline doc) |
| `grep -c "torch: false" …/BarcodeScanner.tsx` | 2 (props + inline doc) |
| `grep -cE "iPhone\|iPad\|iPod" …/BarcodeScanner.tsx` | 1 |
| `grep -c "initBarcodePolyfill" …/BarcodeScanner.tsx` | 3 |
| `grep -c "streamsRef" …/BarcodeScanner.tsx` | 6 |
| Forbidden (`lucide-react`, `@/components/ui/`, `next/dynamic`, `"use client"`) | 0 each ✓ |

## Decisions Made

- **Inline `<style>` keyframe over globals.css.** Keeps ScanViewfinderOverlay self-contained — `@keyframes scan-sweep` and the `.animate-scan-sweep` utility class live inside the component's `<style>` child. No globals.css diff, no Tailwind theme token. React dedupes identical `<style>` nodes so co-mounting two overlays produces one keyframe definition in the rendered HTML.
- **Torch toggle is visual-only in Phase 64.** `@yudiel/react-qr-scanner` v2.5.1 doesn't expose the active `MediaStreamTrack`, so `applyConstraints({ advanced: [{ torch }] })` has nowhere to land. Hand-rolling a second `getUserMedia` races the library's internal exclusive-use lock (Pitfall #4). Wiring deferred to Plan 09 (or a later polish phase if no handle becomes accessible). Automated test surface covers button presence + aria-pressed + variant flip; hardware ON/OFF is manual UAT.
- **Error surfacing through callback, not rendered state.** `BarcodeScanner` never renders an error panel. The four error kinds (`permission-denied`, `no-camera`, `library-init-fail`, `unsupported-browser`) are mapped from `DOMException.name` inside the component and fed upward via the `onError` prop. ScanPage (Plan 09) owns the `ScanErrorPanel` variant switch. This keeps `BarcodeScanner`'s responsibility to camera-adjacent lifecycle only.
- **iOS UA check lives inside the component, not in a shared util.** Legacy `/frontend` used the same inline regex at the component boundary; extracting to `lib/scanner/` would earn one import site and no deduplication win. Left inline for parity with legacy and to keep the probe-flow all in one read.
- **BarcodeScanner prop surface is closed.** `BarcodeScannerProps` is `{ paused, onDecode, onError }` only. Every `<Scanner>` configuration (formats subset, `scanDelay`, `sound`, `components`, `constraints`) is hardcoded inside `BarcodeScanner`. If Plan 09 or Phase 65 needs a new toggle, it must either land as a new prop (extending this closed shape) or be factored out; right now there is deliberately no escape hatch.
- **Torch toggle only renders when `!paused`.** Original must-haves didn't spell this, but UI-SPEC §Torch toggle implies a live viewfinder; hiding the toggle while the scanner is paused (post-decode banner showing) matches the "scanner is idle" visual contract. Captured inline: `{torchSupported && !paused && <ScanTorchToggle …/>}`.

## Deviations from Plan

None. Plan executed exactly as written. All three tasks followed the RED-GREEN cycle in one pass each; all acceptance greps matched on first implementation; all 25 tests passed without iteration; full-suite regression stayed green at 556/556; TypeScript and import-lint both clean throughout.

No architectural changes, no authentication gates, no deferred items. No missing critical functionality (the threat-model mitigations T-64-17 / T-64-18 / T-64-19 / T-64-20 are all delivered: D-02 paused-not-stopped is honored because `BarcodeScanner` never calls `track.stop()` on the active Scanner stream; Pitfall #4 `streamsRef` cleanup is implemented; console.error structured log is Plan 07's `ScanErrorPanel` responsibility; Phase 64 treats decoded values as opaque strings).

## Torch `applyConstraints` TODO (deferred to Plan 09)

The visual torch toggle does NOT currently apply the hardware torch because `@yudiel/react-qr-scanner` v2.5.1 does not expose its active `MediaStreamTrack`. Two possible resolutions for Plan 09 (ScanPage):

1. **Upgrade path (blocked):** Newer `@yudiel` versions may expose a ref; CONTEXT.md pins `2.5.1` — not an option inside Phase 64.
2. **Forward-ref pattern (Plan 09):** If ScanPage can render its own `<video>` + hand-rolled stream and feed it into `<Scanner>` as an override, ScanPage would own the track handle and could wire `applyConstraints({ advanced: [{ torch: torchOn }] })` on ScanTorchToggle's `onToggle`. Risks: the library may not support stream injection; the hand-rolled approach re-introduces Pitfall #4. Flag for Plan 09 scoping.
3. **Deferred polish phase:** Leave as visual-only through v2.2; pick up in a v2.3 scanner-polish phase alongside iOS haptic (D-17) and CRT overlay (deferred).

Whichever path Plan 09 chooses, it must NOT upgrade `@yudiel/react-qr-scanner` beyond `2.5.1` (CONTEXT.md exact pin).

## TDD Gate Compliance

All three tasks `tdd="true"`. RED → GREEN gate commits for each task landed in the expected order and each RED test failed via the expected import-resolution error (component file did not yet exist):

| Task | Gate | Commit | Evidence |
|------|------|--------|----------|
| 1 | RED | `b5672e1` | `test(64-06): add failing test for ScanViewfinderOverlay` — failed: `Failed to resolve import "../ScanViewfinderOverlay"` |
| 1 | GREEN | `951ccd9` | `feat(64-06): implement ScanViewfinderOverlay …` — 5/5 pass |
| 2 | RED | `18f1870` | `test(64-06): add failing test for ScanTorchToggle` — failed: `Failed to resolve import "../ScanTorchToggle"` |
| 2 | GREEN | `1d75fa1` | `feat(64-06): implement ScanTorchToggle …` — 5/5 pass |
| 3 | RED | `fc5d143` | `test(64-06): add failing test for BarcodeScanner` — failed: `Failed to resolve import "../BarcodeScanner"` |
| 3 | GREEN | `6f95f2f` | `feat(64-06): implement BarcodeScanner …` — 15/15 pass |

No REFACTOR commits — initial GREEN implementations were already production-shape; no cleanup pass was warranted.

## Threat Flags

None. The plan's `<threat_model>` register (T-64-17 iOS PWA perm reset on re-mount, T-64-18 torch-probe race, T-64-19 error-log UA disclosure, T-64-20 rogue QR content) is fully addressed by the implementation:

- **T-64-17 (mitigate):** `BarcodeScanner` never calls `track.stop()` on the Scanner's active stream — only the throwaway torch-probe stream is stopped. The Scanner stays mounted through `paused=true`, preserving the iOS camera permission (D-02).
- **T-64-18 (mitigate):** Torch probe uses `streamsRef<MediaStream[]>` with unmount cleanup (PATTERNS §S8) and a `mounted` flag that early-exits before `setTorchSupported` if the component has unmounted. The throwaway stream is stopped + filtered out of the ref-array in the same microtask as the capability read.
- **T-64-19 (accept):** No console.error here — structured logging is Plan 07's `ScanErrorPanel` responsibility.
- **T-64-20 (accept):** `onDecode({ code, format })` passes the raw value upward as an opaque string; Phase 65 will add validation before lookup.

No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

Files verified present:

- `frontend2/src/components/scan/ScanViewfinderOverlay.tsx` — FOUND
- `frontend2/src/components/scan/ScanTorchToggle.tsx` — FOUND
- `frontend2/src/components/scan/BarcodeScanner.tsx` — FOUND
- `frontend2/src/components/scan/__tests__/ScanViewfinderOverlay.test.tsx` — FOUND
- `frontend2/src/components/scan/__tests__/ScanTorchToggle.test.tsx` — FOUND
- `frontend2/src/components/scan/__tests__/BarcodeScanner.test.tsx` — FOUND

Commits verified in `git log`:

- `b5672e1` test(64-06): add failing test for ScanViewfinderOverlay — FOUND
- `951ccd9` feat(64-06): implement ScanViewfinderOverlay (UI-SPEC §Viewfinder) — FOUND
- `18f1870` test(64-06): add failing test for ScanTorchToggle — FOUND
- `1d75fa1` feat(64-06): implement ScanTorchToggle (SCAN-04 rendered path, D-16) — FOUND
- `fc5d143` test(64-06): add failing test for BarcodeScanner — FOUND
- `6f95f2f` feat(64-06): implement BarcodeScanner (SCAN-01, SCAN-02, SCAN-04 probe) — FOUND
