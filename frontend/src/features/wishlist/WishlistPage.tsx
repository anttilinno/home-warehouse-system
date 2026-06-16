import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  RetroTable,
  RetroTabs,
  RetroBadge,
  RetroEmptyState,
  RetroConfirmDialog,
  type RetroBadgeVariant,
} from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { formatCents } from "@/lib/utils/money";
import type { WishlistItem, WishlistStatus } from "@/lib/api/wishlist";
import { useWishlist } from "./hooks/useWishlist";
import { useWishlistMutations } from "./hooks/useWishlistMutations";
import { WishlistFormDialog } from "./components/WishlistFormDialog";

// Phase 14 Plan 03 — the /wishlist page (WISH-01/02). Mirrors LoansListPage: a
// blue Window with a `?status=` searchParam driving three RetroTabs
// (wanted/ordered/acquired). Each tab's content is the same table bound to
// useWishlist(status); switching tabs re-queries the filtered list. A ⊕ ADD
// primary action and a per-row edit open WishlistFormDialog; a per-row delete
// routes through a RetroConfirmDialog then wishlistApi.remove (mutation
// invalidates the list). price_estimate is CENTS → formatCents, with a GUARDED
// currency (null currency renders the major-unit fallback, never white-screens —
// T-14-08). A url renders as a safe http(s) anchor (rel/noopener — T-14-09).
//
// Route wiring (the /wishlist registration + sidebar entry) is Wave 2 (14-08).

const STATUSES: readonly WishlistStatus[] = ["wanted", "ordered", "acquired"];

function readStatus(params: URLSearchParams): WishlistStatus {
  const raw = params.get("status");
  return STATUSES.includes(raw as WishlistStatus)
    ? (raw as WishlistStatus)
    : "wanted";
}

const STATUS_VARIANT: Record<WishlistStatus, RetroBadgeVariant> = {
  wanted: "info",
  ordered: "warn",
  acquired: "ok",
};

// Only http(s) urls become live anchors (no javascript: passthrough — T-14-09).
function safeHref(url?: string): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export function WishlistPage() {
  const { t } = useLingui();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const status = useMemo(() => readStatus(searchParams), [searchParams]);
  const { rows, isLoading, isError } = useWishlist(status);
  const { remove } = useWishlistMutations();
  const removeItem = remove.mutate;

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  // Dialog state: closed | create | edit(item).
  const [dialog, setDialog] = useState<
    { mode: "create" } | { mode: "edit"; item: WishlistItem } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<WishlistItem | null>(null);

  const setStatus = useCallback(
    (id: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("status", id);
        return next;
      });
    },
    [setSearchParams],
  );

  // Format a row's price with a guarded currency (null → undefined → EUR fallback
  // inside formatCents; never a RangeError white-screen — T-14-08).
  function renderPrice(row: WishlistItem) {
    if (row.price_estimate === undefined) {
      return <span className="text-fg-muted">—</span>;
    }
    return (
      <span className="font-mono tabular-nums">
        {formatCents(row.price_estimate, row.currency_code ?? undefined)}
      </span>
    );
  }

  function renderName(row: WishlistItem) {
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

  const showEmpty = !isLoading && !isError && rows.length === 0;

  const tableContent = (
    <>
      <div className="mb-sp-3 flex items-center justify-end">
        <BevelButton
          variant="mint"
          onClick={() => setDialog({ mode: "create" })}
        >
          <Trans>⊕ ADD</Trans>
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

      {showEmpty && (
        <div className="p-sp-4">
          <RetroEmptyState
            eyebrow={<Trans>Wishlist</Trans>}
            glyph="◇"
            heading={<Trans>NOTHING HERE YET</Trans>}
            body={
              <Trans>No items in this list. Add something you're after.</Trans>
            }
            action={{
              label: <Trans>⊕ ADD ITEM</Trans>,
              onClick: () => setDialog({ mode: "create" }),
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
            {rows.map((row) => {
              let statusLabel: ReactNode = <Trans>Acquired</Trans>;
              if (row.status === "wanted") {
                statusLabel = <Trans>Wanted</Trans>;
              } else if (row.status === "ordered") {
                statusLabel = <Trans>Ordered</Trans>;
              }
              return (
              <tr key={row.id}>
                <td>{renderName(row)}</td>
                <td>{renderPrice(row)}</td>
                <td className="font-mono tabular-nums">{row.priority}</td>
                <td>
                  <RetroBadge variant={STATUS_VARIANT[row.status]}>
                    {statusLabel}
                  </RetroBadge>
                </td>
                <td className="actions text-right">
                  <span className="flex items-center justify-end gap-sp-2">
                    <BevelButton
                      variant="neutral"
                      onClick={() => setDialog({ mode: "edit", item: row })}
                    >
                      <Trans>Edit</Trans>
                    </BevelButton>
                    <BevelButton
                      variant="danger"
                      onClick={() => setPendingDelete(row)}
                    >
                      <Trans>Delete</Trans>
                    </BevelButton>
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </RetroTable>
      )}
    </>
  );

  const statusLabel = (id: (typeof STATUSES)[number]): ReactNode => {
    if (id === "wanted") return <Trans>WANTED</Trans>;
    if (id === "ordered") return <Trans>ORDERED</Trans>;
    return <Trans>ACQUIRED</Trans>;
  };
  const tabs = STATUSES.map((id) => {
    return {
      id,
      label: statusLabel(id),
      // All tabs render the SAME table chrome — useWishlist keys on the active
      // status, so only the selected panel mounts (RetroTabs renders one).
      content: tableContent,
    };
  });

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`WISHLIST — ${workspaceName}`} titlebarVariant="blue">
        <RetroTabs tabs={tabs} value={status} onChange={setStatus} />
      </Window>

      <WishlistFormDialog
        open={dialog !== null}
        mode={dialog?.mode ?? "create"}
        item={dialog?.mode === "edit" ? dialog.item : undefined}
        onClose={() => setDialog(null)}
      />

      <RetroConfirmDialog
        open={pendingDelete !== null}
        title={<Trans>DELETE WISHLIST ITEM?</Trans>}
        confirmLabel={<Trans>Delete</Trans>}
        cancelLabel={<Trans>Cancel</Trans>}
        onConfirm={() => {
          const item = pendingDelete;
          setPendingDelete(null);
          if (item) removeItem(item.id);
        }}
        onCancel={() => setPendingDelete(null)}
        onClose={() => setPendingDelete(null)}
      >
        <Trans>This removes it from your wishlist. This can't be undone.</Trans>
      </RetroConfirmDialog>
    </div>
  );
}
