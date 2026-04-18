// frontend2/src/components/scan/BarcodeScanner.tsx
//
// Retro-wrapped @yudiel/react-qr-scanner <Scanner>. Responsibilities:
//
//   1. Runs initBarcodePolyfill() on mount (lib/scanner/init-polyfill.ts).
//   2. Probes torch capability via a single throwaway getUserMedia + stops
//      the probe stream (PATTERNS §S8 streamsRef cleanup; iOS UA short-
//      circuits to false per legacy behavior).
//   3. Renders <Scanner> with the exact Phase 64 prop surface:
//        formats   : 4-format subset [qr_code, upc_a, ean_13, code_128]
//        scanDelay : 200ms
//        allowMultiple: false
//        sound     : false (we own audio via useScanFeedback)
//        components: { finder: false, torch: false } (our own overlay + button)
//        constraints: facingMode=environment, 1280x720 ideal
//   4. Wraps the Scanner in a retro 3px ink-border container
//      (aspect-square on mobile, aspect-video ≥ md).
//   5. Overlays ScanViewfinderOverlay and — when torchSupported && !paused —
//      ScanTorchToggle.
//   6. Surfaces errors upward via onError(kind) with a 4-way mapping:
//        NotAllowedError                    → "permission-denied"
//        NotFoundError / OverconstrainedError → "no-camera"
//        NotSupportedError                   → "unsupported-browser"
//        (anything else, incl. init failure) → "library-init-fail"
//      This component does NOT render any error UI itself — the parent
//      (ScanPage) switches to the correct ScanErrorPanel variant.
//
// Torch toggle note: @yudiel 2.5.1 does not expose the active track handle,
// so applyConstraints({ advanced: [{ torch }] }) is deferred to Plan 09.
// The toggle in this plan is visual-only; hardware ON/OFF is a manual UAT
// path per VALIDATION.md.
import { useEffect, useRef, useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { initBarcodePolyfill } from "@/lib/scanner";
import { ScanViewfinderOverlay } from "./ScanViewfinderOverlay";
import { ScanTorchToggle } from "./ScanTorchToggle";

export type BarcodeScannerErrorKind =
  | "permission-denied"
  | "no-camera"
  | "library-init-fail"
  | "unsupported-browser";

export interface BarcodeScannerProps {
  paused: boolean;
  onDecode: (decoded: { code: string; format: string }) => void;
  onError: (kind: BarcodeScannerErrorKind) => void;
}

// Phase 64 format subset — SCAN-02. Kept local (not pulled from
// lib/scanner/types SUPPORTED_FORMATS, which carries the 6-entry superset)
// because this plan's acceptance criteria reference the 4-entry literal.
const SCAN_FORMATS = ["qr_code", "upc_a", "ean_13", "code_128"] as const;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function mapScannerErrorToKind(err: unknown): BarcodeScannerErrorKind {
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? (err as { name?: string }).name
      : undefined;
  if (name === "NotAllowedError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "no-camera";
  }
  if (name === "NotSupportedError") return "unsupported-browser";
  return "library-init-fail";
}

export function BarcodeScanner({
  paused,
  onDecode,
  onError,
}: BarcodeScannerProps) {
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  // Ref-array tracks every stream we acquired so cleanup can always stop them
  // (PATTERNS §S8 no-stale-closure cleanup).
  const streamsRef = useRef<MediaStream[]>([]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initBarcodePolyfill();
      } catch {
        if (mounted) onError("library-init-fail");
        return;
      }

      // iOS Safari rejects `advanced: [{ torch }]` anyway — short-circuit the
      // probe to avoid a spurious getUserMedia call.
      if (isIOS()) {
        if (mounted) setTorchSupported(false);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        if (mounted) onError("unsupported-browser");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamsRef.current.push(stream);
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        if (mounted) setTorchSupported(caps?.torch === true);
        // Release probe stream — <Scanner> will acquire its own.
        stream.getTracks().forEach((t) => t.stop());
        streamsRef.current = streamsRef.current.filter((s) => s !== stream);
      } catch {
        // Probe failure is benign — treat as "no torch", not an error.
        // (Android can throw OverconstrainedError / NotReadableError when the
        // camera is held by another process; neither is a user-visible error.)
      }
    }

    init();

    return () => {
      mounted = false;
      streamsRef.current.forEach((s) =>
        s.getTracks().forEach((t) => t.stop()),
      );
      streamsRef.current = [];
    };
  }, [onError]);

  return (
    <div className="relative border-retro-thick border-retro-ink bg-retro-ink aspect-square md:aspect-video overflow-hidden">
      <Scanner
        paused={paused}
        onScan={(codes: IDetectedBarcode[]) => {
          if (codes.length === 0 || paused) return;
          const c = codes[0];
          onDecode({ code: c.rawValue, format: c.format });
        }}
        onError={(err) => onError(mapScannerErrorToKind(err))}
        formats={[...SCAN_FORMATS]}
        constraints={{
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }}
        scanDelay={200}
        allowMultiple={false}
        sound={false}
        components={{ finder: false, torch: false }}
      />
      <ScanViewfinderOverlay />
      {torchSupported && !paused && (
        <ScanTorchToggle
          torchOn={torchOn}
          onToggle={() => setTorchOn((v) => !v)}
        />
      )}
    </div>
  );
}
