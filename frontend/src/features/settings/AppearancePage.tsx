import { Trans } from "@lingui/react/macro";
import { RetroBadge, Window } from "@/components/retro";

// Phase 12 Plan 03 — AppearancePage (SETT-04 / SETT-11). Light-only by design:
// the Retro OS Pastel theme is the single, locked, current theme. This page is
// PRESENTATIONAL — it fires no PATCH and offers no dark option or switcher
// (resolved OQ-R3). SETT-11 ("light only") supersedes SETT-04's stale
// premium-terminal prose. The selected card uses THREE non-color cues (a glyph,
// a filled selected treatment, and the CURRENT badge) so the "current" state is
// legible without relying on color alone.

export function AppearancePage() {
  return (
    <Window
      title={<Trans>Appearance</Trans>}
      bodyClassName="grid gap-sp-4 p-sp-4"
    >
      <p className="text-12 font-bold uppercase tracking-8 text-fg-muted">
        <Trans>Theme</Trans>
      </p>

      {/* The single, locked, selected Light theme card. */}
      <div className="flex items-start gap-sp-3 border-2 border-border-ink bg-titlebar-blue px-sp-3 py-sp-3 bevel-pressed">
        <span
          aria-hidden="true"
          className="mt-px flex-none text-16 leading-none text-fg-ink"
        >
          ◉
        </span>
        <span className="flex flex-1 flex-col gap-sp-1">
          <span className="flex items-center gap-sp-2">
            <span className="text-14 font-bold text-fg-ink">
              <Trans>Light</Trans>
            </span>
            <RetroBadge variant="info">
              <Trans>CURRENT</Trans>
            </RetroBadge>
          </span>
          <span className="text-12 text-fg-ink/80">
            <Trans>Retro OS Pastel — the only theme.</Trans>
          </span>
        </span>
      </div>

      {/* Butter backlog band (PasswordCard note pattern). */}
      <p
        role="note"
        className="border-2 border-border-ink bg-titlebar-butter px-sp-3 py-sp-2 text-13 text-fg-ink"
      >
        <Trans>Light only — a dark theme is on the backlog.</Trans>
      </p>
    </Window>
  );
}
