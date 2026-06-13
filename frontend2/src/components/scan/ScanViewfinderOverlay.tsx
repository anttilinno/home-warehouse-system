import { Trans } from "@lingui/react/macro";

/**
 * Presentational reticle + aim-hint overlay drawn ON TOP of the live camera frame
 * (UI-SPEC Surface 1). Pure decoration + one hint line — no logic, no props.
 *
 * The reticle is four 2px white (`--bevel-light`) corner brackets framing a
 * centered ~70%-width region (System-7 corner-mark idiom), NOT a full box — a box
 * would mask the code being scanned. The brackets are `aria-hidden` decoration.
 * The aim hint sits on a `bg-fg-ink/55` ink scrim with white text (AA holds).
 *
 * Static under prefers-reduced-motion (it is static anyway — no pulse). Intended
 * to be absolutely positioned by the page over the always-mounted BarcodeScanner.
 */
export function ScanViewfinderOverlay() {
  // 2px white L-shaped corner bracket. Each corner enables exactly two borders.
  const corner = "absolute h-7 w-7 border-bevel-light";

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      data-testid="scan-viewfinder-overlay"
    >
      {/* Centered ~70%-width framing region; brackets hang on its corners. */}
      <div
        aria-hidden="true"
        className="relative aspect-square w-[70%] max-w-[320px]"
      >
        <span className={`${corner} left-0 top-0 border-l-2 border-t-2`} />
        <span className={`${corner} right-0 top-0 border-r-2 border-t-2`} />
        <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
        <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
      </div>

      {/* Aim hint on an ink scrim, bottom-anchored, white text (AA holds). */}
      <p className="absolute bottom-sp-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-fg-ink/55 px-sp-3 py-sp-1 font-body text-[13px] text-bg-panel">
        <Trans>Point the camera at a barcode or QR code.</Trans>
      </p>
    </div>
  );
}
