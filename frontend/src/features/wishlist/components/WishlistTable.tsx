import type { ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  PixelIcon,
  RetroBadge,
  type RetroBadgeVariant,
  RetroEmptyState,
  RetroTable,
} from "@/components/retro";
import { formatCents } from "@/lib/utils/money";
import type { WishlistItem, WishlistStatus } from "@/lib/api/wishlist";

// Phase 14 refactor — the wishlist table region: the ⊕ ADD action plus the
// loading / error / empty / table switch shared by all three status tabs.
// Extracted from WishlistPage to lift those view branches (and the price/name/
// status row helpers) out of the page body. price_estimate is CENTS with a
// guarded currency (T-14-08); a url renders only as a safe http(s) anchor
// (T-14-09). Behavior is identical to the inlined table.

const STATUS_VARIANT: Record<WishlistStatus, RetroBadgeVariant> = {
  wanted: "info",
  ordered: "warn",
  acquired: "ok",
};

const STATUS_LABEL: Record<WishlistStatus, ReactNode> = {
  wanted: <Trans>Wanted</Trans>,
  ordered: <Trans>Ordered</Trans>,
  acquired: <Trans>Acquired</Trans>,
};

// Only http(s) urls become live anchors (no javascript: passthrough — T-14-09).
function safeHref(url?: string): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

function PriceCell({ row }: Readonly<{ row: WishlistItem }>) {
  if (row.price_estimate === undefined) {
    return <span className="text-fg-muted">—</span>;
  }
  return (
    <span className="font-mono tabular-nums">
      {formatCents(row.price_estimate, row.currency_code ?? undefined)}
    </span>
  );
}

function NameCell({ row }: Readonly<{ row: WishlistItem }>) {
  const href = safeHref(row.url);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-titlebar-blue underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.name}
      </a>
    );
  }
  return <span className="font-semibold">{row.name}</span>;
}

export function WishlistTable({
  rows,
  isLoading,
  isError,
  onAdd,
  onEdit,
  onDelete,
}: Readonly<{
  rows: WishlistItem[];
  isLoading: boolean;
  isError: boolean;
  onAdd: () => void;
  onEdit: (item: WishlistItem) => void;
  onDelete: (item: WishlistItem) => void;
}>) {
  const { t } = useLingui();

  return (
    <>
      <div className="mb-sp-3 flex items-center justify-end">
        <BevelButton variant="mint" onClick={onAdd}>
          <PixelIcon name="plus" size={16} /> <Trans>ADD</Trans>
        </BevelButton>
      </div>

      {isLoading && (
        <p className="p-sp-4 font-mono text-13 text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      )}

      {isError && (
        <p className="p-sp-4 text-13 font-semibold text-danger">
          <Trans>Couldn't load the wishlist. Try again.</Trans>
        </p>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <div className="p-sp-4">
          <RetroEmptyState
            eyebrow={<Trans>Wishlist</Trans>}
            glyph="heart"
            heading={<Trans>NOTHING HERE YET</Trans>}
            body={
              <Trans>No items in this list. Add something you're after.</Trans>
            }
            action={{
              label: (
                <>
                  <PixelIcon name="plus" size={16} /> <Trans>ADD ITEM</Trans>
                </>
              ),
              onClick: onAdd,
            }}
          />
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <RetroTable>
          <thead>
            <tr>
              <th>{t`Name`}</th>
              <th>{t`Price`}</th>
              <th>{t`Priority`}</th>
              <th>{t`Status`}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <NameCell row={row} />
                </td>
                <td>
                  <PriceCell row={row} />
                </td>
                <td className="font-mono tabular-nums">{row.priority}</td>
                <td>
                  <RetroBadge variant={STATUS_VARIANT[row.status]}>
                    {STATUS_LABEL[row.status]}
                  </RetroBadge>
                </td>
                <td className="actions text-right">
                  <span className="flex items-center justify-end gap-sp-2">
                    <BevelButton variant="neutral" onClick={() => onEdit(row)}>
                      <Trans>Edit</Trans>
                    </BevelButton>
                    <BevelButton variant="danger" onClick={() => onDelete(row)}>
                      <Trans>Delete</Trans>
                    </BevelButton>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </RetroTable>
      )}
    </>
  );
}
