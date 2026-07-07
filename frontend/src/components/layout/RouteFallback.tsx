import { Trans } from "@lingui/react/macro";

// Shared Suspense fallback for lazy routes. A centered mono "LOADING" line that
// reuses the existing .retro-progress stepped-opacity utility (globals.css) — no
// new motion language, and it holds solid under prefers-reduced-motion.
export function RouteFallback() {
  return (
    <div
      className="grid min-h-[40vh] place-items-center p-sp-4"
      role="status"
      aria-live="polite"
    >
      <span className="retro-progress font-mono text-12 uppercase tracking-12 text-fg-muted">
        <Trans>Loading</Trans>
      </span>
    </div>
  );
}
