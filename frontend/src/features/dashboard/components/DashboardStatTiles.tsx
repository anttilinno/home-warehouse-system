import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "react-router";
import { StatCard } from "@/components/retro";
import type { DashboardStats } from "@/lib/types";

// Retro-os dashboard (sketch 006) — the stat windows row + the secondary
// count-tile grid. Extracted verbatim from DashboardPage to lift the four
// `stats?.x ?? "—"` reads and the two value-tone ternaries out of the page body.
// `stats` is undefined until the dashboard query resolves; every value falls
// back to "—" exactly as before.
export function DashboardStatTiles({
  stats,
}: Readonly<{ stats: DashboardStats | undefined }>) {
  const { t } = useLingui();
  // Destructure once over `stats ?? {}` so each cell reads a plain field with a
  // single nullish fallback — avoids a per-cell optional chain (every `stats?.x`
  // is its own branch). `loaded` gates the "N units total" sub line.
  const loaded = stats !== undefined;
  const {
    total_items,
    total_inventory,
    active_loans,
    overdue_loans,
    low_stock_items,
    total_locations,
    total_containers,
    total_categories,
    total_borrowers,
  } = stats ?? ({} as Partial<DashboardStats>);

  return (
    <>
      {/* Each stat window links to its source list (DASH clickable cards). The
          Link is the grid cell — `block min-w-0` keeps the [&>*]:min-w-0 cell
          truncation, `no-underline` drops the anchor underline so the card face
          is unchanged; the <a> default cursor:pointer signals interactivity. */}
      <section className="mb-sp-5 grid grid-cols-2 gap-sp-4 lg:grid-cols-4 [&>*]:min-w-0">
        <Link to="/items" className="block min-w-0 no-underline">
          <StatCard
            label={<Trans>Items</Trans>}
            value={total_items ?? "—"}
            sub={loaded && <Trans>{total_inventory} units total</Trans>}
          />
        </Link>
        <Link to="/loans" className="block min-w-0 no-underline">
          <StatCard
            label={<Trans>Loans</Trans>}
            value={active_loans ?? "—"}
            sub={<Trans>active</Trans>}
            titlebarVariant="mint"
          />
        </Link>
        <Link to="/loans" className="block min-w-0 no-underline">
          <StatCard
            label={<Trans>Overdue</Trans>}
            value={overdue_loans ?? "—"}
            sub={<Trans>action needed</Trans>}
            titlebarVariant="pink"
            valueTone={(overdue_loans ?? 0) > 0 ? "danger" : "ink"}
          />
        </Link>
        <Link to="/inventory" className="block min-w-0 no-underline">
          <StatCard
            label={<Trans>Low stock</Trans>}
            value={low_stock_items ?? "—"}
            sub={<Trans>below threshold</Trans>}
            titlebarVariant="butter"
            valueTone={(low_stock_items ?? 0) > 0 ? "warn" : "ink"}
          />
        </Link>
      </section>

      <section className="mb-sp-5 grid grid-cols-2 gap-sp-4 md:grid-cols-4 [&>*]:min-w-0">
        {(
          [
            [t`Locations`, total_locations, "/taxonomy?tab=locations"],
            [t`Containers`, total_containers, "/taxonomy?tab=containers"],
            [t`Categories`, total_categories, "/taxonomy?tab=categories"],
            [t`Borrowers`, total_borrowers, "/borrowers"],
          ] as const
        ).map(([label, count, to]) => (
          <Link
            key={label}
            to={to}
            title={label}
            // pr-sp-4 (not px-sp-3 both sides): the Silkscreen count is right-
            // aligned and was clipping on the right bevel/border — give it extra
            // right room. Label truncates (min-w-0) if the cell ever gets narrow
            // so the count stays whole instead of the word shoving it off-edge.
            // no-underline drops the anchor underline; <a> default cursor signals
            // the tile navigates to its taxonomy tab / borrowers list.
            className="flex items-baseline justify-between gap-sp-2 border-2 border-border-ink bg-bg-panel py-sp-2 pl-sp-3 pr-sp-4 text-12 font-semibold uppercase tracking-6 text-fg-muted no-underline bevel-raised-ink"
          >
            <span className="min-w-0 truncate">{label}</span>
            <b className="flex-none font-display text-16 leading-none text-fg-ink">
              {count ?? "—"}
            </b>
          </Link>
        ))}
      </section>
    </>
  );
}
