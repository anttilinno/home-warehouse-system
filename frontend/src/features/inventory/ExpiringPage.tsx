import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  RetroTable,
  RetroBadge,
  RetroSelect,
  RetroEmptyState,
} from "@/components/retro";
import type { ExpiringEntry } from "@/lib/types";
import {
  useExpiringQuery,
  EXPIRING_DAYS_OPTIONS,
} from "./hooks/useExpiringQuery";

// Phase 7b Plan 04 — the /inventory/expiring attention surface (INV-06).
//
// One butter Window (butter = warning semantic — UI-SPEC §5, MANIFEST). Backed
// by GET /inventory/expiring?days= (default 30). The read model is a thin
// projection (inventory_id, item_id, item_name, quantity, kind, date) — no
// item-name join needed (the name rides the row).
//
// Near-vs-past is CLIENT-computed (the backend returns the window but does not
// classify): daysDelta = date − today.
//   • daysDelta >= 0 → butter chip `in {n}d` (in 0d = today). Warning.
//   • daysDelta <  0 → danger chip `⚠ −{n}d`. Overdue.
// The `in`/`−`/`⚠` prefix carries the signal for color-blind users — color is
// never the sole signal (UI-SPEC §5, R12). Single list sorted by date asc
// (most-overdue first).

// Compute whole-day delta between a YYYY-MM-DD date and today (date-only, no
// time component — the projection's `date` has no clock).
function daysDeltaFrom(dateStr: string, today: Date): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const now = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target - now) / 86_400_000);
}

function WhenChip({ delta }: Readonly<{ delta: number }>) {
  if (delta >= 0) {
    // Near future (and today) — butter warning chip.
    return (
      <span className="inline-flex items-center rounded-chip border border-border-ink bg-titlebar-butter px-sp-2 py-px font-mono text-11 font-bold tabular-nums text-fg-ink">
        in {delta}d
      </span>
    );
  }
  // Past / overdue — danger chip with the ⚠ glyph + leading − sign.
  return (
    <span className="inline-flex items-center gap-[4px] rounded-chip border border-border-ink bg-danger-bg px-sp-2 py-px font-mono text-11 font-bold tabular-nums text-danger">
      <span aria-hidden="true">⚠</span>
      {/* U+2212 MINUS SIGN — the textual past-signal (not color alone). */}−
      {Math.abs(delta)}d
    </span>
  );
}

export function ExpiringPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, days } = useExpiringQuery();

  // Sort by date ascending (most-overdue first, then soonest). Computed once
  // per data change; the `date` strings are zero-padded YYYY-MM-DD so a lexical
  // sort is order-correct.
  const rows = useMemo(() => {
    const today = new Date();
    const items: (ExpiringEntry & { delta: number })[] = (
      data?.items ?? []
    ).map((e) => ({ ...e, delta: daysDeltaFrom(e.date, today) }));
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return items;
  }, [data]);

  const count = data?.total ?? rows.length;

  function onDaysChange(next: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("days", next);
      return params;
    });
  }

  const showEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`EXPIRING SOON`} titlebarVariant="butter">
        {/* Header strip: days selector + count. */}
        <div className="flex items-center gap-sp-3 border-b-2 border-border-ink bg-bg-panel-2 p-sp-3">
          <div className="w-[160px]">
            <RetroSelect
              label={<Trans>Window</Trans>}
              value={String(days)}
              onChange={(e) => onDaysChange(e.target.value)}
            >
              {EXPIRING_DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {t`${d} days`}
                </option>
              ))}
            </RetroSelect>
          </div>
          <div className="flex-1" />
          <span className="font-mono text-13 tabular-nums text-fg-muted">
            {t`${count} expiring`}
          </span>
        </div>

        {isLoading && (
          <p className="p-sp-4 font-mono text-13 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-13 font-semibold text-danger">
            <Trans>Couldn't load expiring entries. Try again.</Trans>
          </p>
        )}

        {showEmpty && (
          <div className="p-sp-4">
            <RetroEmptyState
              eyebrow={<Trans>Inventory</Trans>}
              glyph="◇"
              heading={<Trans>NOTHING EXPIRING</Trans>}
              body={
                <Trans>
                  No items are expiring or out of warranty in the next {days}{" "}
                  days.
                </Trans>
              }
              action={{
                label: <Trans>← BACK TO INVENTORY</Trans>,
                onClick: () => navigate("/inventory"),
              }}
            />
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <RetroTable>
            <thead>
              <tr>
                <th>{t`Item`}</th>
                <th className="text-right">{t`Qty`}</th>
                <th>{t`Kind`}</th>
                <th>{t`Date`}</th>
                <th>{t`When`}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.inventory_id}
                  onClick={() => navigate(`/items/${row.item_id}`)}
                  className="cursor-pointer"
                >
                  <td className="font-semibold">{row.item_name}</td>
                  <td className="mono text-right tabular-nums">
                    {row.quantity}
                  </td>
                  <td>
                    <RetroBadge variant="neutral">
                      {row.kind === "warranty" ? (
                        <Trans>WARRANTY</Trans>
                      ) : (
                        <Trans>EXPIRY</Trans>
                      )}
                    </RetroBadge>
                  </td>
                  <td className="mono text-fg-muted">{row.date}</td>
                  <td className="mono">
                    <WhenChip delta={row.delta} />
                  </td>
                </tr>
              ))}
            </tbody>
          </RetroTable>
        )}
      </Window>

      {!showEmpty && rows.length > 0 && (
        <div className="mt-sp-3">
          <BevelButton variant="neutral" onClick={() => navigate("/inventory")}>
            <Trans>← BACK TO INVENTORY</Trans>
          </BevelButton>
        </div>
      )}
    </div>
  );
}
