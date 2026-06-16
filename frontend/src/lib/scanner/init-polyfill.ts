/**
 * Barcode Detection API Polyfill Initialization
 *
 * Registers the `barcode-detector` polyfill for browsers that lack the native
 * Barcode Detection API (Safari, Firefox). 1:1 parity port of the legacy
 * `frontend/lib/scanner/init-polyfill.ts`.
 *
 * SIDE-EFFECT MODULE: importing this file registers the polyfill once, on the
 * client, ONLY when the native `BarcodeDetector` is absent. The
 * `barcode-detector/polyfill` entry itself no-ops when a native (or already
 * installed) `BarcodeDetector` exists, so this is idempotent and safe under
 * jsdom (where the test setup installs a `MockBarcodeDetector` global — the
 * native-present guard below leaves that stub untouched).
 *
 * RESEARCH "Don't Hand-Roll": never roll a custom polyfill — this bundled,
 * maintained side-effect import is the canonical registration path.
 *
 * @see https://github.com/Sec-ant/barcode-detector
 */

let polyfillLoaded = false;

/**
 * Register the polyfill (idempotent). Resolves immediately when native /
 * already-installed `BarcodeDetector` is present, otherwise dynamically imports
 * the polyfill side-effect entry. Never throws on the happy path.
 */
export async function initBarcodePolyfill(): Promise<void> {
  if (polyfillLoaded || typeof globalThis.window === "undefined") {
    return;
  }

  // Native (or a test stub / prior polyfill) already present — nothing to do.
  if ("BarcodeDetector" in globalThis) {
    polyfillLoaded = true;
    return;
  }

  await import("barcode-detector/polyfill");
  polyfillLoaded = true;
}

/** True when a `BarcodeDetector` (native or polyfilled) is available. */
export function isBarcodeDetectionAvailable(): boolean {
  return typeof globalThis !== "undefined" && "BarcodeDetector" in globalThis;
}

// Side-effect registration on import. Guarded so it never overrides a native /
// test-stubbed detector and never throws at module scope under jsdom.
void initBarcodePolyfill().catch(() => {
  // Polyfill load failure is non-fatal here; live-scan code surfaces an error
  // banner via the scanner lib's onError when decode is actually attempted.
});
