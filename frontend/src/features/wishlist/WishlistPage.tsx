import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { Window, RetroTabs, RetroConfirmDialog } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { WishlistItem, WishlistStatus } from "@/lib/api/wishlist";
import { useWishlist } from "./hooks/useWishlist";
import { useWishlistMutations } from "./hooks/useWishlistMutations";
import { WishlistFormDialog } from "./components/WishlistFormDialog";
import { WishlistTable } from "./components/WishlistTable";

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

  const tableContent = (
    <WishlistTable
      rows={rows}
      isLoading={isLoading}
      isError={isError}
      onAdd={() => setDialog({ mode: "create" })}
      onEdit={(item) => setDialog({ mode: "edit", item })}
      onDelete={setPendingDelete}
    />
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
