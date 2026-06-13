import { useEffect, useRef, useState } from "react";
import { Trans } from "@lingui/react/macro";

export interface ClockProps {
  /** Render the LOCAL wall-clock readout. Defaults to true; the PageHeader
   *  reuses the same component with `local={false}` for a SESSION-only timer. */
  local?: boolean;
}

// hh:mm:ss, zero-padded. Elapsed seconds → clamped at 0.
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * The isolated SESSION/LOCAL clock leaf (BAR-01, SHELL-05).
 *
 * It owns exactly ONE `setInterval(…, 1000)` and the only ticking state, so a
 * tick re-renders this leaf and nothing else — the AppShell never re-renders on
 * the 1s cadence (03-RESEARCH.md Pattern 6 / Pitfall 5). `tabular-nums` + Plex
 * Mono keep the digits from reflowing.
 *
 * SESSION = elapsed since mount (the real login-time source lands in Phase 5).
 * LOCAL = a locale-fixed et-EE wall clock (sketch-006 locale); decorative chrome,
 * not user data — see the i18n-format-ignore note on the call below.
 */
export function Clock({ local = true }: ClockProps) {
  // Mount timestamp is stable across renders; only `now` ticks.
  const startRef = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const session = formatElapsed(now - startRef.current);
  // Decorative wall-clock chrome (sketch-006), intentionally locale-fixed to
  // et-EE; NOT user data, so it is not forced through the user's time_format
  // preference (see 15-CONTEXT).
  const localTime = new Date(now).toLocaleTimeString("et-EE"); // i18n-format-ignore

  return (
    <div className="inline-flex items-center gap-sp-2">
      <Readout testid="clock-session" value={session}>
        <Trans>SESSION</Trans>
      </Readout>
      {local && (
        <Readout testid="clock-local" value={localTime}>
          <Trans>LOCAL</Trans>
        </Readout>
      )}
    </div>
  );
}

function Readout({
  children,
  value,
  testid,
}: {
  children: React.ReactNode;
  value: string;
  testid: string;
}) {
  return (
    <span className="inline-flex items-center gap-sp-1">
      <span className="font-body text-[11px] font-bold uppercase tracking-[0.1em] text-fg-muted">
        {children}
      </span>
      <span
        data-testid={testid}
        className="font-mono text-[12px] tabular-nums text-fg-ink"
      >
        {value}
      </span>
    </span>
  );
}
