import { Trans } from "@lingui/react/macro";
import { BevelButton } from "@/components/retro";

export interface ScanTorchToggleProps {
  /**
   * Whether the device exposes a torch capability (`getCapabilities().torch`).
   * iOS lacks it → the page passes `false` and this component renders NOTHING
   * (no disabled ghost — SCAN-04 auto-hide).
   */
  supported: boolean;
  /** Whether the torch is currently ON (page-owned state). */
  enabled: boolean;
  /** Fired on press; the page flips its torch boolean (fed to BarcodeScanner). */
  onToggle: () => void;
}

/**
 * Android-only retro torch toggle (UI-SPEC Surface 1).
 *
 * Three non-color cues for the ON/OFF state so it reads without color perception:
 *  - color: butter fill + pressed bevel when ON, neutral bevel when OFF
 *  - word:  `TORCH` (OFF) vs `TORCH ON` (ON)
 *  - glyph: ⚡ (always present)
 *
 * Renders nothing when `supported` is false (iOS auto-hide). Touch floor 44×44.
 * Copy is wrapped in <Trans> (Lingui) — the consumer owns wording.
 */
export function ScanTorchToggle({
  supported,
  enabled,
  onToggle,
}: ScanTorchToggleProps) {
  if (!supported) return null;

  return (
    <BevelButton
      variant="neutral"
      aria-pressed={enabled}
      onClick={onToggle}
      className={`min-h-[44px] min-w-[44px] ${
        enabled ? "bg-titlebar-butter text-fg-ink bevel-pressed" : ""
      }`}
    >
      <span aria-hidden="true">⚡</span>
      {enabled ? <Trans>TORCH ON</Trans> : <Trans>TORCH</Trans>}
    </BevelButton>
  );
}
