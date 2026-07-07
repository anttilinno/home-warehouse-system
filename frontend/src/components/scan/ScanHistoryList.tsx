import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  PixelIcon,
  RetroConfirmDialog,
  RetroEmptyState,
} from "@/components/retro";
import type { ScanHistoryEntry } from "@/lib/scanner";

// SCAN-06/07 — the History tab. PRESENTATIONAL: the owning page reads
// localStorage (getScanHistory) and passes entries down; rows re-fire the
// shared funnel via onSelect, CLEAR confirms then onClear.
export interface ScanHistoryListProps {
  entries: ScanHistoryEntry[];
  /** Re-fire the lookup for a tapped code (shared funnel). */
  onSelect: (code: string, source: "history") => void;
  /** Wipe the history (after confirm). */
  onClear: () => void;
}

// Relative time, en-US, no extra deps. Past timestamps → "N min ago" etc.
function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} d ago`;
}

export function ScanHistoryList({
  entries,
  onSelect,
  onClear,
}: Readonly<ScanHistoryListProps>) {
  const { t } = useLingui();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const now = Date.now();
  const empty = entries.length === 0;

  function confirmClear() {
    onClear();
    setConfirmOpen(false);
  }

  if (empty) {
    return (
      <div className="flex flex-col gap-sp-3">
        <div className="flex items-center justify-between">
          <p className="text-11 font-bold uppercase tracking-8 text-fg-muted">
            <Trans>RECENT SCANS</Trans>
          </p>
          <BevelButton variant="danger" disabled aria-disabled>
            ✕ <Trans>CLEAR HISTORY</Trans>
          </BevelButton>
        </div>
        <RetroEmptyState
          glyph="camera"
          heading={t`NO SCANS YET`}
          body={t`Scanned and looked-up codes show up here for quick re-lookup.`}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sp-3">
      <div className="flex items-center justify-between">
        <p className="text-11 font-bold uppercase tracking-8 text-fg-muted">
          <Trans>RECENT SCANS</Trans>
        </p>
        <BevelButton variant="danger" onClick={() => setConfirmOpen(true)}>
          ✕ <Trans>CLEAR HISTORY</Trans>
        </BevelButton>
      </div>

      <ul className="flex flex-col border-2 border-border-ink">
        {entries.map((entry, i) => (
          <li key={`${entry.code}-${entry.timestamp}`}>
            <button
              type="button"
              onClick={() => onSelect(entry.code, "history")}
              className={`flex w-full items-center justify-between gap-sp-2 px-sp-3 py-sp-2 text-left hover:bg-info-bg ${
                i % 2 === 1 ? "bg-table-stripe" : ""
              }`}
            >
              <span className="font-mono text-13 tabular-nums text-fg-ink">
                {entry.code}
              </span>
              <span className="flex items-center gap-sp-2">
                <span className="text-11 text-fg-muted">
                  {relativeTime(entry.timestamp, now)}
                </span>
                <span aria-hidden="true" className="text-fg-muted">
                  <PixelIcon name="chevron-right" size={16} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <RetroConfirmDialog
        open={confirmOpen}
        title={t`CLEAR HISTORY?`}
        confirmLabel={t`CLEAR HISTORY`}
        onConfirm={confirmClear}
        onCancel={() => setConfirmOpen(false)}
        onClose={() => setConfirmOpen(false)}
      >
        <Trans>
          This removes every code from your scan history. It can't be undone.
        </Trans>
      </RetroConfirmDialog>
    </div>
  );
}
