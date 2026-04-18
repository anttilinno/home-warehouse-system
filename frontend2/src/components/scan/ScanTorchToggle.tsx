// frontend2/src/components/scan/ScanTorchToggle.tsx
//
// Feature-gated retro torch button. Parent (BarcodeScanner) decides whether to
// mount this at all — when the active stream reports no torch capability the
// toggle is NOT rendered (D-16: no placeholder, no disabled button).
//
// State is owned by the parent and passed as `torchOn`. Tapping invokes
// `onToggle`; actual MediaStreamTrack.applyConstraints wiring is deferred to
// Plan 09 / ScanPage because @yudiel/react-qr-scanner v2.5.1 does not expose
// the active track handle. This component is the visual toggle only —
// hardware torch ON/OFF is a manual UAT path per VALIDATION.md.
//
// aria-pressed carries the state for assistive tech; the visible label switches
// [◉] TORCH OFF ↔ [◉] TORCH ON. Variant swaps neutral → primary (amber fill).
import { useLingui } from "@lingui/react/macro";
import { RetroButton } from "@/components/retro";

export interface ScanTorchToggleProps {
  torchOn: boolean;
  onToggle: () => void;
}

export function ScanTorchToggle({ torchOn, onToggle }: ScanTorchToggleProps) {
  const { t } = useLingui();
  return (
    <RetroButton
      variant={torchOn ? "primary" : "neutral"}
      onClick={onToggle}
      aria-pressed={torchOn}
      type="button"
      className="absolute bottom-md right-md"
    >
      {torchOn ? t`[◉] TORCH ON` : t`[◉] TORCH OFF`}
    </RetroButton>
  );
}
