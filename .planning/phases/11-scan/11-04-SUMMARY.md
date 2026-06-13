---
phase: 11-scan
plan: 04
subsystem: frontend2/scan
tags: [scan, camera, barcode, retro-os, react, components]
requires:
  - "@/lib/scanner SUPPORTED_FORMATS (11-02)"
  - "@yudiel/react-qr-scanner@2.5.1 + barcode-detector (11-01)"
  - "@/test/scanner-mock (11-01 test infra)"
  - "@/components/retro BevelButton (existing atom)"
provides:
  - "BarcodeScanner — persistent <Scanner> wrapper, prop-driven pause, lib-managed torch"
  - "ScanTorchToggle — supported-gated three-cue retro torch button"
  - "ScanViewfinderOverlay — corner-bracket reticle + aim hint"
affects:
  - "11-06 ScanPage (hoists BarcodeScanner into a persistent always-mounted sibling)"
  - "11-05 owns components/scan/index.ts barrel (NOT created here)"
tech-stack:
  added: []
  patterns:
    - "Prop-driven pause (paused), never unmount — iOS PWA camera-permission persistence"
    - "Lib-managed torch via components.torch boolean (RESEARCH Pattern 4 approach 1)"
    - "Three-non-color-cue state (color + word + glyph) for torch ON/OFF"
key-files:
  created:
    - frontend2/src/components/scan/BarcodeScanner.tsx
    - frontend2/src/components/scan/BarcodeScanner.test.tsx
    - frontend2/src/components/scan/ScanTorchToggle.tsx
    - frontend2/src/components/scan/ScanTorchToggle.test.tsx
    - frontend2/src/components/scan/ScanViewfinderOverlay.tsx
  modified: []
decisions:
  - "lint:tsc used as the typecheck gate (no `typecheck` script exists in package.json)"
  - "Torch ON visuals applied via className override (bg-titlebar-butter + bevel-pressed) rather than a new BevelButton variant — keeps the shared atom untouched"
metrics:
  duration: "~6 min"
  completed: "2026-06-13"
  tasks: 3
  files: 5
---

# Phase 11 Plan 04: Scan Camera Components Summary

BarcodeScanner (a `<Scanner>` wrapper that mounts once and pauses by prop, never
unmount), ScanViewfinderOverlay (non-masking corner-bracket reticle + aim hint),
and ScanTorchToggle (Android-only three-cue torch button) — the camera-facing
retro components for `/scan`, disjoint from 11-03/05/07.

## Prop Contracts (for 11-06 wiring — no re-discovery needed)

### `BarcodeScanner` — `@/components/scan/BarcodeScanner`
```ts
interface BarcodeScannerProps {
  paused: boolean;                                   // prop-driven pause; NEVER unmount
  onDecode: (rawValue: string, format: string) => void; // fires only when active + non-empty
  onError?: (error: unknown) => void;               // forward NotAllowedError → camera-blocked state
  torchSupported?: boolean;                          // default false (iOS → false)
  torchEnabled?: boolean;                            // default false
}
```
- Wraps `@yudiel/react-qr-scanner` `<Scanner>` with `formats={[...SUPPORTED_FORMATS]}`
  (the 4-format subset — SCAN-02), `scanDelay={200}`, `allowMultiple={false}`,
  `sound={false}`, `components={{ finder:false, torch: torchSupported && torchEnabled }}`,
  `constraints={{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720} }}`,
  and fill styles (objectFit cover).
- `onScan` guard: returns early on empty array OR while `paused` (double-fire /
  render-loop guard) before calling `onDecode(codes[0].rawValue, codes[0].format)`.
- **Must be kept mounted + paused by 11-06** — it does NOT unmount itself and never
  calls `track.stop()`. Hoist it into a persistent sibling layer above the RetroTabs
  panels (RetroTabs unmounts inactive panels — Pitfall 1 / T-11-06).
- The lib mounts its own `<video>`; do NOT inject one. The viewfinder + torch render
  as siblings ON TOP (lib `finder` is off).

### `ScanTorchToggle` — `@/components/scan/ScanTorchToggle`
```ts
interface ScanTorchToggleProps {
  supported: boolean;   // false → renders null (iOS auto-hide, SCAN-04)
  enabled: boolean;     // ON state
  onToggle: () => void;
}
```
- Renders `null` when `!supported` (no disabled ghost).
- Three cues: `bg-titlebar-butter` fill + `bevel-pressed` (color), `TORCH` vs
  `TORCH ON` (word), `⚡` glyph. `aria-pressed={enabled}`. 44×44 touch floor.
- 11-06 owns `supported`/`enabled` state (probe + toggle) and feeds the same
  `torchEnabled` into `BarcodeScanner`.

### `ScanViewfinderOverlay` — `@/components/scan/ScanViewfinderOverlay`
- No props. Pure presentational. `pointer-events-none absolute inset-0`.
- Four 2px white (`--bevel-light`) corner brackets framing a centered ~70%-width
  square (not a full box — won't mask the code); brackets `aria-hidden`.
- Aim hint `Point the camera at a barcode or QR code.` on a `bg-fg-ink/55` scrim,
  white text (AA holds). Intended to be absolutely positioned over BarcodeScanner.

## Verification

- `bun install --frozen-lockfile` — clean (325 packages).
- `bun run lint:tsc` (tsc -b --noEmit) — EXIT 0, clean.
- `bun run test src/components/scan/` — 2 files, 14 tests, all pass.
  - BarcodeScanner: 8 (format subset, pause passthrough, decode, paused/empty
    guards, onError forward, torch gating, no-remount on pause toggle).
  - ScanTorchToggle: 6 (unsupported→null, OFF/ON words, aria-pressed, 44px, onToggle).

## Threat Mitigations Applied

- **T-11-06 (iOS camera re-prompt):** `paused` is a pass-through prop; the wrapper
  never unmounts and never `track.stop()`s. Test `never unmounts <Scanner> across a
  paused toggle` asserts re-render (not remount). The double-fire guard also drops
  any final decode that lands as pause settles.
- **T-11-07 (decoded rawValue tampering):** `onDecode` forwards `rawValue` as a
  plain string only — no rendering, no `dangerouslySetInnerHTML`. Downstream (11-05)
  renders it via React auto-escape.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 - Blocking] `bun run typecheck` script does not exist**
- **Found during:** Task 3 verify gate (`bun run typecheck`).
- **Issue:** The plan's verify/verification blocks call `bun run typecheck`, but
  `package.json` has no `typecheck` script — the typecheck script is `lint:tsc`
  (`tsc -b --noEmit`). The prompt's hard rules also specify `lint:tsc` as the gate.
- **Fix:** Ran `bun run lint:tsc` for every typecheck gate. Clean (EXIT 0).
- **Files modified:** none.

No other deviations — plan executed as written. No barrel created (11-05 owns
`components/scan/index.ts`); only the 5 declared files were touched.

## Known Stubs

None. All three components are fully wired to their props; no placeholder data,
no hardcoded empty values. (BarcodeScanner's `onDecode`/`onError` are caller-owned
callbacks — that is the intended contract, not a stub.)

## Self-Check: PASSED

- FOUND: frontend2/src/components/scan/BarcodeScanner.tsx
- FOUND: frontend2/src/components/scan/BarcodeScanner.test.tsx
- FOUND: frontend2/src/components/scan/ScanTorchToggle.tsx
- FOUND: frontend2/src/components/scan/ScanTorchToggle.test.tsx
- FOUND: frontend2/src/components/scan/ScanViewfinderOverlay.tsx
- Commits ef513eb (Task 1), 3828884 (Task 2), 6c071e6 (Task 3) present on exec/11-04.
