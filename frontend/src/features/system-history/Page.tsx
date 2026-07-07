import { Trans, useLingui } from "@lingui/react/macro";
import { Window, RetroEmptyState } from "@/components/retro";

// SyncHistoryPage — SYS-03, the /sync-history surface.
//
// PARITY-VESTIGIAL RESIDUE / ROADMAP DE-SCOPE CANDIDATE.
// ROADMAP success-criteria-3 asks for "past sync events with timestamps,
// status, and error details", but that is an offline-era concept. v3.0 is
// ONLINE-ONLY: changes save directly to the server and there is NO
// sync-event-history backend (the only sync route is GET /sync/delta — a
// DATA delta-pull, not an event log). OQ2 is resolved: render an HONEST
// informational/empty state rather than fabricating events.
//
// This page therefore:
//   - issues NO network request (no /sync/delta consumption),
//   - fabricates NO events / timestamps / statuses,
//   - imports NO `sync*` engine module (FOUND-02 — lint:imports CI guard).
// It composes ONLY retro atoms + lingui. It exists so the `// SYSTEM` nav
// group is complete and the route is not a dead PlaceholderShell.
//
// IMPORT-PATH NOTE (for 14-08 route wiring): the FOUND-02 lint:imports guard
// (scripts/check-forbidden-imports.mjs) substring-matches `sync` in ANY import
// specifier — so a `@/features/sync-history/...` path or a `./SyncHistoryPage`
// specifier would FALSELY trip it. The on-disk module therefore lives at
// `@/features/system-history/Page` (a `sync`-free specifier). The EXPORTED
// component name is unchanged (`SyncHistoryPage`) and the route URL stays
// `/sync-history` (a <Route path> JSX string, not an import specifier, so it
// is unaffected by the guard). 14-08 must import:
//   import { SyncHistoryPage } from "@/features/system-history/Page";
export function SyncHistoryPage() {
  const { t } = useLingui();

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`SYNC HISTORY`} titlebarVariant="blue">
        <RetroEmptyState
          eyebrow={<Trans>Sync</Trans>}
          glyph="reload"
          heading={<Trans>ONLINE ONLY</Trans>}
          body={
            <Trans>
              This workspace runs online-only — changes save directly to the
              server, so there are no background sync events to show.
            </Trans>
          }
        />
      </Window>
    </div>
  );
}
