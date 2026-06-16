import { Trans } from "@lingui/react/macro";

export type RetroStatusDotState = "live" | "idle" | "error";

export interface RetroStatusDotProps {
  state: RetroStatusDotState;
}

// state → { dot fill, blink (live only), state-word color }. The dot is an 8px
// square (radius 0) ink-bordered chip; the state word carries the meaning.
const DOT_FILL: Record<RetroStatusDotState, string> = {
  live: "bg-titlebar-mint",
  idle: "bg-fg-faint",
  error: "bg-danger",
};

// RetroStatusDot (TUI-03) — the `sse: ● live` panel-header indicator, a DUMB
// prop-driven visual primitive with ZERO live-stream coupling (Pitfall 6). The
// dashboard feeds the real connection state into the `state` prop in Phase 6;
// this atom never imports a live-stream hook or a browser stream source.
export function RetroStatusDot({ state }: Readonly<RetroStatusDotProps>) {
  // Live = hard step-end blink (see globals.css .status-dot--live, reduced-
  // motion-safe). idle/error stay solid.
  const dotClass = `inline-block h-2 w-2 border border-border-ink ${DOT_FILL[state]}${
    state === "live" ? " status-dot--live" : ""
  }`;

  return (
    <span className="inline-flex items-center gap-sp-1 font-mono text-12">
      <span className="text-fg-muted">sse:</span>
      <span data-testid="status-dot" aria-hidden="true" className={dotClass} />
      {state === "live" && (
        <span className="text-accent-mint-deep">
          <Trans>live</Trans>
        </span>
      )}
      {state === "idle" && (
        <span className="text-fg-muted">
          <Trans>offline</Trans>
        </span>
      )}
      {state === "error" && (
        <span className="text-danger">
          <Trans>error</Trans>
        </span>
      )}
    </span>
  );
}
