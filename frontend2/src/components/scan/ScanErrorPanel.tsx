// frontend2/src/components/scan/ScanErrorPanel.tsx
//
// Four-variant retro error panel (CONTEXT.md D-09). ScanPage's onError
// callback routes every BarcodeScanner error here via mapScannerErrorToKind
// (Plan 06). The component owns variant-specific copy, action set, hazard
// stripe color, and structured telemetry.
//
// Variants (D-09):
//   permission-denied    — yellow stripe, 3 platform hints, USE MANUAL ENTRY
//   no-camera            — yellow stripe, USE MANUAL ENTRY + RELOAD PAGE
//   library-init-fail    — red stripe (transient infra), RETRY + USE MANUAL ENTRY
//   unsupported-browser  — yellow stripe, USE MANUAL ENTRY only
//
// D-12: Every variant logs a structured console.error({ kind, errorName,
// userAgent, timestamp }) once on mount. `errorName` mirrors `kind` at this
// layer — the real DOMException.name lives inside BarcodeScanner's
// mapScannerErrorToKind and is not propagated here. If future phases need
// the upstream Error.name, add an optional `errorName?: string` prop and
// thread it through.
import { useEffect } from "react";
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";

export type ScanErrorKind =
  | "permission-denied"
  | "no-camera"
  | "library-init-fail"
  | "unsupported-browser";

export interface ScanErrorPanelProps {
  kind: ScanErrorKind;
  onUseManualEntry: () => void;
  /** Rendered only for kind="library-init-fail" when provided. */
  onRetry?: () => void;
  /** Rendered only for kind="no-camera" when provided. */
  onReload?: () => void;
}

export function ScanErrorPanel({
  kind,
  onUseManualEntry,
  onRetry,
  onReload,
}: ScanErrorPanelProps) {
  const { t } = useLingui();

  // D-12 telemetry: fire once per mounted `kind`. Client-only structured log,
  // no backend telemetry. useEffect dep on `kind` re-fires if the parent
  // somehow swaps the kind in place (defensive; normally the panel unmounts
  // when the underlying error clears).
  useEffect(() => {
    console.error({
      kind,
      errorName: kind,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      timestamp: Date.now(),
    });
  }, [kind]);

  const stripeVariant: "red" | "yellow" =
    kind === "library-init-fail" ? "red" : "yellow";

  let heading: string;
  let body: string;
  let platformHints: string[] | null = null;

  switch (kind) {
    case "permission-denied":
      heading = t`CAMERA ACCESS DENIED`;
      body = t`Barcode scanning needs camera permission. You can enable it in your browser settings, or enter codes manually.`;
      platformHints = [
        t`On iPhone / iPad: Settings → Safari → Camera → Allow.`,
        t`On Android Chrome: tap the lock icon in the address bar → Permissions → Camera → Allow.`,
        t`Open your browser's site settings and allow Camera for this page.`,
      ];
      break;
    case "no-camera":
      heading = t`NO CAMERA FOUND`;
      body = t`This device does not report a working camera. If one is attached, make sure no other app is using it, then reload.`;
      break;
    case "library-init-fail":
      heading = t`SCANNER FAILED TO LOAD`;
      body = t`The barcode engine could not initialize. Check your connection and retry, or enter codes manually.`;
      break;
    case "unsupported-browser":
      heading = t`SCANNING UNSUPPORTED`;
      body = t`This browser does not support camera scanning. Try the latest Safari, Chrome, Firefox, or Edge — or enter codes manually.`;
      break;
  }

  return (
    <RetroPanel>
      <HazardStripe variant={stripeVariant} className="mb-md" />
      <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
        {heading}
      </h2>
      <p className="font-sans text-[14px] text-retro-ink mb-md">{body}</p>
      {platformHints && (
        <ul className="flex flex-col gap-sm mb-md list-none">
          {platformHints.map((hint) => (
            <li key={hint} className="font-sans text-[14px] text-retro-ink">
              {hint}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-md">
        {kind === "library-init-fail" && onRetry && (
          <RetroButton variant="primary" onClick={onRetry}>
            {t`RETRY`}
          </RetroButton>
        )}
        <RetroButton variant="neutral" onClick={onUseManualEntry}>
          {t`USE MANUAL ENTRY`}
        </RetroButton>
        {kind === "no-camera" && onReload && (
          <RetroButton variant="neutral" onClick={onReload}>
            {t`RELOAD PAGE`}
          </RetroButton>
        )}
      </div>
    </RetroPanel>
  );
}
