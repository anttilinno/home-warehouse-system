import { useCallback } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { SUPPORTED_FORMATS } from "@/lib/scanner";
// Side-effect import: registers the barcode-detector polyfill (idempotent,
// no-ops when a native BarcodeDetector exists) so the Scanner below can decode
// on Safari/Firefox. THE scanner component is the prescribed registration site
// (see lib/scanner/index.ts) — direct path, never the barrel.
import "@/lib/scanner/init-polyfill";

export interface BarcodeScannerProps {
  /**
   * Prop-driven pause (SCAN-01/02, binding override 1). When `true` the lib stops
   * decoding but the `<video>` stays mounted — NEVER unmount or `track.stop()` or
   * iOS standalone PWAs re-prompt for camera permission (Pitfall 1 / T-11-06).
   */
  paused: boolean;
  /** Called with the first decoded code's value + format when active + non-empty. */
  onDecode: (rawValue: string, format: string) => void;
  /**
   * Forwards lib errors (e.g. `NotAllowedError`) so the page can render the
   * camera-blocked state. The decoded value is forwarded as a plain string only
   * (T-11-07) — never injected as HTML.
   */
  onError?: (error: unknown) => void;
  /** Android-only torch capability flag (probed by the page; iOS → false). */
  torchSupported?: boolean;
  /** Whether the torch is currently requested ON (page-owned state). */
  torchEnabled?: boolean;
}

/**
 * Retro wrapper around `@yudiel/react-qr-scanner`'s `<Scanner>`.
 *
 * This is THE node that must mount once and stay mounted for the life of `/scan`
 * (binding override 1): 11-06's ScanPage hoists it into a persistent always-mounted
 * sibling layer (NOT inside a RetroTabs panel, which unmounts inactive panels —
 * Pitfall 1). Visibility/pause is driven entirely by the `paused` prop; the
 * component never unmounts on its own and never calls `track.stop()`.
 *
 * The lib mounts its OWN `<video>` element (it handles `playsInline`) — we do not
 * inject one. The reticle/aim overlay (ScanViewfinderOverlay) and the torch toggle
 * (ScanTorchToggle) are rendered by the page as siblings ON TOP of this node, so
 * the lib's built-in `finder` is disabled here.
 */
export function BarcodeScanner({
  paused,
  onDecode,
  onError,
  torchSupported = false,
  torchEnabled = false,
}: Readonly<BarcodeScannerProps>) {
  const handleScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      // Double-fire / render-loop guard: drop empty arrays and any decode that
      // arrives while paused (the lib can emit one final batch as pause settles).
      if (codes.length === 0 || paused) return;
      const { rawValue, format } = codes[0]; // allowMultiple:false ⇒ length 1
      onDecode(rawValue, format);
    },
    [paused, onDecode],
  );

  return (
    <Scanner
      onScan={handleScan}
      onError={onError}
      paused={paused}
      // SCAN-02: the four-format subset (qr_code / upc_a / ean_13 / code_128).
      // The lib's prop expects this enum tuple; SUPPORTED_FORMATS is the single
      // source of truth from 11-02.
      formats={[...SUPPORTED_FORMATS]}
      scanDelay={200}
      allowMultiple={false}
      sound={false}
      components={{
        // We render our own retro finder + torch overlays.
        finder: false,
        // Lib-managed torch apply (RESEARCH Pattern 4, approach 1 — legacy-proven):
        // flipping this boolean makes the lib apply the constraint on its own stream.
        torch: torchSupported && torchEnabled,
      }}
      constraints={{
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }}
      styles={{
        container: { width: "100%", height: "100%" },
        video: { width: "100%", height: "100%", objectFit: "cover" },
      }}
    />
  );
}
