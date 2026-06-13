import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  RetroTabs,
  RetroEmptyState,
  RetroConfirmDialog,
  retroToast,
  type RetroTab,
} from "@/components/retro";
import { Popover } from "@/components/retro/overlay";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { HttpError } from "@/lib/api";
import { itemsApi } from "@/lib/api/items";
import { photosApi } from "@/lib/api/photos";
import type { Item } from "@/lib/types";
import { useItemMutations } from "./hooks/useItemMutations";
import { PhotoGallery } from "./components/PhotoGallery";
import { PhotoLightbox } from "./components/PhotoLightbox";
import { PhotoUpload } from "./components/PhotoUpload";
import {
  ActiveLoanPanel,
  LoanHistoryList,
  useItemLoans,
} from "./components/LoanPanels";
import { ItemLabels } from "./components/ItemLabels";
import { InventoryPanelStub } from "./components/InventoryPanelStub";

// Phase 7 Plan 06 — item detail page (`/items/:id`, ITEM-02).
//
// A mint Window titled with the item name (UPPERCASED via the titlebar rule).
// Two-column at lg: left = DETAILS/PHOTOS/HISTORY tabs, right = a persistent side
// rail (active-loan panel + InventoryPanelStub). Titlebar carries EDIT + an ↧
// overflow menu (ARCHIVE/RESTORE, DELETE…). Delete is archived-only with a
// type-to-confirm gate (pink). Loan partition + photo gallery/lightbox/upload are
// composed from Plans 01/04/06.

export function ItemDetailPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { id } = useParams();

  const itemQuery = useQuery({
    queryKey: ["items", wsId as string, "detail", id],
    queryFn: () => itemsApi.get(wsId as string, id as string),
    enabled: Boolean(wsId) && Boolean(id),
  });

  const photosQuery = useQuery({
    queryKey: ["items", wsId as string, "photos", id],
    queryFn: () => photosApi.list(wsId as string, id as string),
    enabled: Boolean(wsId) && Boolean(id),
  });

  const loansQuery = useItemLoans(wsId as string, id as string);

  const { archive, restore, del } = useItemMutations();
  // RQ v5 returns a fresh mutation object per render but the .mutate identity is
  // stable — destructure the stable fns (render-loop guard).
  const archiveItem = archive.mutate;
  const restoreItem = restore.mutate;
  const deleteItem = del.mutate;

  const item = itemQuery.data;
  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);
  const activeLoans = useMemo(
    () => loansQuery.data?.active ?? [],
    [loansQuery.data],
  );
  const historyLoans = useMemo(
    () => loansQuery.data?.history ?? [],
    [loansQuery.data],
  );

  // A 404 means the item was deleted/never existed → the not-found state, NOT a
  // load error. Every other failure (network/500/etc.) → the error state + a
  // persistent toast (UI-SPEC §2 — retroToast.error never auto-dismisses).
  const notFound =
    itemQuery.isError &&
    itemQuery.error instanceof HttpError &&
    itemQuery.error.status === 404;
  const loadError = itemQuery.isError && !notFound;

  // Read t through a ref so the error-toast effect deps stay stable.
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (loadError) {
      retroToast.error(tRef.current`Couldn't load this item.`);
    }
  }, [loadError]);

  const [tab, setTab] = useState("details");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const menuRef = useRef<HTMLButtonElement>(null);

  // ── Not-found / error full-window states (before any tab chrome).
  if (loadError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Window title={t`ITEM`} titlebarVariant="mint">
          <RetroEmptyState
            eyebrow={<Trans>Inventory</Trans>}
            heading={<Trans>COULDN'T LOAD ITEM</Trans>}
            body={<Trans>Something went wrong. Try again.</Trans>}
            action={{
              label: <Trans>RETRY</Trans>,
              onClick: () => itemQuery.refetch(),
            }}
          />
        </Window>
      </div>
    );
  }

  if (notFound || (!itemQuery.isLoading && !item)) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Window title={t`ITEM`} titlebarVariant="mint">
          <RetroEmptyState
            eyebrow={<Trans>Inventory</Trans>}
            heading={<Trans>ITEM NOT FOUND</Trans>}
            body={
              <Trans>
                This item may have been deleted. Return to the items list.
              </Trans>
            }
            action={{
              label: <Trans>← BACK TO ITEMS</Trans>,
              onClick: () => navigate("/items"),
            }}
          />
        </Window>
      </div>
    );
  }

  if (itemQuery.isLoading || !item) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Window title={t`ITEM`} titlebarVariant="mint">
          <p className="p-sp-4 font-mono text-[13px] text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        </Window>
      </div>
    );
  }

  const archived = item.is_archived ?? false;

  function copyBarcode() {
    if (!item?.barcode) return;
    navigator.clipboard
      ?.writeText(item.barcode)
      .then(() => retroToast.success(tRef.current`Barcode copied.`))
      .catch(() => retroToast.error(tRef.current`Couldn't copy the barcode.`));
  }

  const tabs: RetroTab[] = [
    {
      id: "details",
      label: <Trans>DETAILS</Trans>,
      content: (
        <DetailsTab
          item={item}
          wsId={wsId as string}
          onCopyBarcode={copyBarcode}
        />
      ),
    },
    {
      id: "photos",
      label: <Trans>PHOTOS</Trans>,
      content: (
        <div className="flex flex-col gap-sp-3">
          <div className="flex items-center gap-sp-2">
            <BevelButton variant="mint" onClick={() => setUploadOpen(true)}>
              <Trans>⊕ ADD PHOTOS</Trans>
            </BevelButton>
          </div>
          <PhotoGallery
            wsId={wsId as string}
            itemId={item.id}
            photos={photos}
            onOpenLightbox={(index) => setLightboxIndex(index)}
          />
        </div>
      ),
    },
    {
      id: "history",
      label: <Trans>HISTORY</Trans>,
      content: <LoanHistoryList history={historyLoans} />,
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px]">
      <Window
        title={item.name}
        titlebarVariant="mint"
        actions={
          <span className="flex items-center gap-sp-1">
            <BevelButton
              className="!px-[8px] !py-[2px] !text-[11px]"
              onClick={() => navigate(`/items/${item.id}/edit`)}
            >
              <Trans>EDIT</Trans>
            </BevelButton>
            <BevelButton
              ref={menuRef}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t`More actions`}
              className="!px-[8px] !py-[2px] !text-[11px]"
              onClick={() => setMenuOpen((o) => !o)}
            >
              ↧
            </BevelButton>
            <Popover
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              anchorRef={menuRef}
              role="menu"
              minWidth={180}
            >
              <div className="flex flex-col gap-sp-1 px-sp-1 py-sp-1">
                {archived ? (
                  <BevelButton
                    variant="mint"
                    onClick={() => {
                      setMenuOpen(false);
                      restoreItem(item.id);
                    }}
                  >
                    <Trans>RESTORE</Trans>
                  </BevelButton>
                ) : (
                  <BevelButton
                    onClick={() => {
                      setMenuOpen(false);
                      archiveItem(item.id);
                    }}
                  >
                    <Trans>ARCHIVE</Trans>
                  </BevelButton>
                )}
                <BevelButton
                  variant="danger"
                  disabled={!archived}
                  aria-disabled={!archived || undefined}
                  onClick={() => {
                    if (!archived) return;
                    setMenuOpen(false);
                    setConfirmName("");
                    setDeleteOpen(true);
                  }}
                >
                  <Trans>DELETE…</Trans>
                </BevelButton>
              </div>
            </Popover>
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-sp-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left column — tabs */}
          <div className="min-w-0">
            <RetroTabs tabs={tabs} value={tab} onChange={setTab} />
          </div>

          {/* Right column — persistent side rail */}
          <aside className="flex flex-col gap-sp-5">
            <ActiveLoanPanel active={activeLoans} />
            <InventoryPanelStub />
          </aside>
        </div>
      </Window>

      {/* Photo lightbox (chromeless dark overlay). */}
      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      {/* Photo upload dialog. */}
      <PhotoUpload
        wsId={wsId as string}
        itemId={item.id}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />

      {/* Type-to-confirm delete (archived-only, ITEM-06). */}
      <RetroConfirmDialog
        open={deleteOpen}
        title={<Trans>DELETE ITEM?</Trans>}
        confirmLabel={<Trans>DELETE</Trans>}
        confirmDisabled={confirmName !== item.name}
        onConfirm={() => {
          deleteItem(
            { id: item.id, isArchived: archived },
            { onSuccess: () => navigate("/items") },
          );
          setDeleteOpen(false);
          setConfirmName("");
        }}
        onCancel={() => {
          setDeleteOpen(false);
          setConfirmName("");
        }}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmName("");
        }}
      >
        <div className="flex flex-col gap-sp-2">
          <Trans>Type the item name to confirm. This can't be undone.</Trans>
          <input
            type="text"
            aria-label={t`Confirm item name`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="border-2 border-border-ink bg-bg-panel bevel-sunken px-[10px] py-[7px] text-[14px]"
          />
        </div>
      </RetroConfirmDialog>
    </div>
  );
}

// ── DETAILS tab: a definition-grid of fields + the labels row.
function DetailsTab({
  item,
  wsId,
  onCopyBarcode,
}: {
  item: Item;
  wsId: string;
  onCopyBarcode: () => void;
}) {
  return (
    <div className="flex flex-col gap-sp-4">
      <dl className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-sp-4 gap-y-sp-3">
        <Field label={<Trans>Name</Trans>}>{item.name}</Field>
        <Field label={<Trans>Category</Trans>}>
          {item.category_id ?? <Muted>—</Muted>}
        </Field>
        <Field label={<Trans>Quantity</Trans>} mono>
          {item.min_stock_level}
        </Field>
        <Field label={<Trans>Barcode</Trans>} mono>
          {item.barcode ? (
            <span className="flex items-center gap-sp-2">
              <span>{item.barcode}</span>
              <BevelButton
                className="!px-[8px] !py-[2px] !text-[11px]"
                onClick={onCopyBarcode}
              >
                <Trans>COPY</Trans>
              </BevelButton>
            </span>
          ) : (
            <Muted>—</Muted>
          )}
        </Field>
        <Field label={<Trans>Description</Trans>} full>
          {item.description ? (
            <span className="whitespace-pre-wrap">{item.description}</span>
          ) : (
            <Muted>—</Muted>
          )}
        </Field>
        <Field label={<Trans>Created</Trans>} mono muted>
          {item.created_at}
        </Field>
        <Field label={<Trans>Updated</Trans>} mono muted>
          {item.updated_at}
        </Field>
      </dl>

      {/* Labels row. */}
      <div className="flex flex-col gap-sp-2 border-t-2 border-border-ink pt-sp-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          <Trans>Labels</Trans>
        </p>
        <ItemLabels wsId={wsId} itemId={item.id} />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
  muted,
  full,
}: {
  label: ReactNode;
  children: ReactNode;
  mono?: boolean;
  muted?: boolean;
  full?: boolean;
}) {
  return (
    <>
      <dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </dt>
      <dd
        className={`${full ? "col-span-1" : ""} text-[14px] ${
          mono ? "font-mono tabular-nums" : ""
        } ${muted ? "text-fg-muted" : "text-fg-ink"}`}
      >
        {children}
      </dd>
    </>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-fg-muted">{children}</span>;
}
