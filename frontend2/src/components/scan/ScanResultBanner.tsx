// frontend2/src/components/scan/ScanResultBanner.tsx
//
// Post-decode retro banner (D-02). Rendered below the paused viewfinder after
// a successful scan — displays the decoded code, format, relative timestamp,
// and a SCAN AGAIN primary button that unpauses the scanner.
//
// Phase 64 placeholder for Phase 66's QuickActionMenu — the paused-but-mounted
// pattern is established here; the component swap in Phase 66 is a prop rewire,
// not a rearchitecture. Do NOT over-design with action affordances beyond
// SCAN AGAIN (CONTEXT.md <specifics>).
//
// Typography: code is 24px monospace bold (UI-SPEC Display role). Format pill
// uses data-testid='scan-format-pill' for deterministic test queries.
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";
import { formatScanTime } from "@/lib/scanner";

export interface ScanResultBannerProps {
  code: string;
  format: string;
  timestamp: number;
  onScanAgain: () => void;
}

export function ScanResultBanner({
  code,
  format,
  timestamp,
  onScanAgain,
}: ScanResultBannerProps) {
  const { t } = useLingui();

  return (
    <RetroPanel>
      <HazardStripe variant="yellow" className="mb-md" />
      <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
        {t`SCANNED`}
      </h2>
      <div className="flex flex-col gap-sm">
        <div className="flex items-center gap-md flex-wrap">
          <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
            {t`CODE`}
          </span>
          <span className="font-mono font-bold text-[24px] text-retro-ink break-all">
            {code}
          </span>
        </div>
        <div className="flex items-center gap-md flex-wrap">
          <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
            {t`FORMAT`}
          </span>
          <span
            data-testid="scan-format-pill"
            className="font-mono text-[12px] uppercase border-retro-thick border-retro-ink bg-retro-amber text-retro-ink px-sm py-xs"
          >
            {format}
          </span>
        </div>
        <p className="font-mono text-[14px] text-retro-charcoal">
          {formatScanTime(timestamp)}
        </p>
      </div>
      <div className="flex justify-end mt-md">
        <RetroButton variant="primary" onClick={onScanAgain}>
          {t`SCAN AGAIN`}
        </RetroButton>
      </div>
    </RetroPanel>
  );
}
