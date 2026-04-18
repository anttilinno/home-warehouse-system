// frontend2/src/features/scan/ScanHistoryList.tsx
//
// SCAN-06 (history list rendered path) + SCAN-07 (clear-with-confirm) view.
//
// This component is a pure props-in / callbacks-out renderer. It does NOT call
// `useScanHistory` itself — the parent (ScanPage, Plan 09) owns the hook
// instance so it can also call `add()` from the post-decode handler. The list
// consumes parent-provided `entries` + `onSelect` + `onClear`.
//
// Row tap fires `onSelect(entry)` so the parent can re-fire the post-scan flow
// (D-15). The CLEAR HISTORY button opens a `RetroConfirmDialog` (destructive
// variant); affirm calls `onClear`.
import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroPanel,
  RetroEmptyState,
  RetroButton,
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { formatScanTime, type ScanHistoryEntry } from "@/lib/scanner";

export interface ScanHistoryListProps {
  entries: ScanHistoryEntry[];
  onSelect: (entry: ScanHistoryEntry) => void;
  onClear: () => void;
}

export function ScanHistoryList({
  entries,
  onSelect,
  onClear,
}: ScanHistoryListProps) {
  const { t } = useLingui();
  const confirmRef = useRef<RetroConfirmDialogHandle>(null);

  if (entries.length === 0) {
    return (
      <RetroEmptyState
        title={t`NO SCANS YET`}
        body={t`Scanned codes appear here. Your last 10 scans are kept on this device.`}
      />
    );
  }

  return (
    <RetroPanel>
      <div className="flex items-center justify-between mb-md gap-md flex-wrap">
        <h2 className="text-[20px] font-bold uppercase text-retro-ink">
          {t`SCAN HISTORY`}
        </h2>
        <RetroButton
          variant="danger"
          onClick={() => confirmRef.current?.open()}
        >
          {t`CLEAR HISTORY`}
        </RetroButton>
      </div>
      <ul
        className="flex flex-col divide-y-2 divide-retro-charcoal"
        role="list"
      >
        {entries.map((entry) => (
          <li key={`${entry.code}-${entry.timestamp}`} role="listitem">
            <button
              type="button"
              onClick={() => onSelect(entry)}
              className="w-full min-h-[44px] flex items-center justify-between gap-md py-sm px-xs text-left hover:bg-retro-cream/60 outline-2 outline-offset-2 outline-transparent focus-visible:outline-retro-amber cursor-pointer"
            >
              <div className="flex flex-col gap-xs min-w-0 flex-1">
                <span className="font-mono text-retro-ink break-all">
                  {entry.code}
                </span>
                <span className="font-mono text-[12px] uppercase text-retro-charcoal">
                  {entry.format}
                </span>
              </div>
              <span className="font-mono text-[14px] text-retro-charcoal whitespace-nowrap">
                {formatScanTime(entry.timestamp)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <RetroConfirmDialog
        ref={confirmRef}
        variant="destructive"
        title={t`CLEAR SCAN HISTORY`}
        body={t`All 10 most-recent scanned codes on this device will be removed. This cannot be undone.`}
        destructiveLabel={t`YES, CLEAR`}
        escapeLabel={t`KEEP HISTORY`}
        onConfirm={onClear}
      />
    </RetroPanel>
  );
}
