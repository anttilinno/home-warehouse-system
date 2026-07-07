import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "react-router";
import {
  RetroBadge,
  RetroEmptyState,
  RetroTable,
  Window,
} from "@/components/retro";
import type { OutOfStockItem } from "@/features/analytics/types";

// OutOfStockTable (ANL-04) — a PURE presentational table the AnalyticsPage
// (13b-04) feeds with useOutOfStock() rows. It does NOT fetch: it takes its
// rows as a prop so it stays trivially testable and disjoint from 13b-01.
//
// Each row links its item name back to /items/{id} (the ANL-04 back-reference),
// shows the real min_stock_level, and renders the current stock as an honest
// literal `0` in danger-mono — OutOfStockItem carries NO current_stock field,
// and the item is in this list precisely BECAUSE it is out of stock, so 0 is
// the truthful value, never a fabricated quantity (threat T-13b-05). The window
// wears the PINK attention titlebar (the out-of-stock surface is a warning).
export function OutOfStockTable({
  items,
  isLoading,
}: Readonly<{
  items: OutOfStockItem[];
  isLoading?: boolean;
}>) {
  const { t } = useLingui();

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <p className="p-sp-4 font-mono text-13 text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  } else if (items.length === 0) {
    body = (
      <div className="p-sp-4">
        <RetroEmptyState
          eyebrow={<Trans>Inventory</Trans>}
          glyph="check"
          heading={<Trans>NOTHING OUT OF STOCK</Trans>}
          body={
            <Trans>
              All items are in stock. Anything that drops below its minimum will
              surface here.
            </Trans>
          }
        />
      </div>
    );
  } else {
    body = (
      <RetroTable>
        <thead>
          <tr>
            <th>{t`Item`}</th>
            <th>{t`SKU`}</th>
            <th>{t`Category`}</th>
            <th className="text-right">{t`Min stock`}</th>
            <th className="text-right">{t`Stock`}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="font-semibold">
                <Link
                  to={`/items/${item.id}`}
                  className="text-accent-blue-deep underline-offset-2 hover:underline"
                >
                  {item.name}
                </Link>
              </td>
              <td className="mono">{item.sku}</td>
              <td className={item.category_name ? "" : "text-fg-muted"}>
                {item.category_name ?? "—"}
              </td>
              <td className="mono tabular-nums text-right">
                {item.min_stock_level}
              </td>
              {/* Honest current stock: the item is out of stock → literal 0,
                    danger-mono, NEVER a fabricated number (T-13b-05). */}
              <td className="mono tabular-nums text-right text-danger">0</td>
              <td className="text-right">
                <RetroBadge variant="danger">
                  <Trans>OUT</Trans>
                </RetroBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </RetroTable>
    );
  }

  return (
    <Window title={t`Out of stock`} titlebarVariant="pink" bodyClassName="">
      {body}
    </Window>
  );
}
