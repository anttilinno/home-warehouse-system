import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { Plus, Pencil, Archive, Undo2, Trash2 } from "./icons";
import {
  RetroPanel,
  RetroButton,
  RetroEmptyState,
  RetroCheckbox,
  RetroBadge,
  RetroTable,
  HazardStripe,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { useBorrowersList } from "./hooks/useBorrowersList";
import {
  useArchiveBorrower,
  useDeleteBorrower,
  useRestoreBorrower,
} from "./hooks/useBorrowerMutations";
import {
  BorrowerPanel,
  type BorrowerPanelHandle,
} from "./panel/BorrowerPanel";
import {
  BorrowerArchiveDeleteFlow,
  type BorrowerArchiveDeleteFlowHandle,
} from "./actions/BorrowerArchiveDeleteFlow";
import type { Borrower } from "@/lib/api/borrowers";

export function BorrowersListPage() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Borrower | null>(null);

  const panelRef = useRef<BorrowerPanelHandle>(null);
  const archiveFlowRef = useRef<BorrowerArchiveDeleteFlowHandle>(null);

  const borrowersQuery = useBorrowersList(showArchived);
  const archiveMutation = useArchiveBorrower();
  const restoreMutation = useRestoreBorrower();
  const deleteMutation = useDeleteBorrower();

  const borrowers = borrowersQuery.items;
  const archivedCount = useMemo(
    () => borrowers.filter((b) => b.is_archived).length,
    [borrowers],
  );

  if (authLoading) return null;

  const handleNew = () => panelRef.current?.open("create");
  const handleEdit = (b: Borrower) => panelRef.current?.open("edit", b);
  const handleArchiveClick = (b: Borrower) => {
    setArchiveTarget(b);
    archiveFlowRef.current?.open();
  };
  const handleRestore = (b: Borrower) => restoreMutation.mutate(b.id);

  const isEmpty = borrowersQuery.isSuccess && borrowers.length === 0;

  const columns = [
    { key: "name", header: t`NAME` },
    { key: "email", header: t`EMAIL` },
    { key: "phone", header: t`PHONE` },
    { key: "actions", header: t`ACTIONS`, className: "text-right" },
  ];

  const rows = borrowers.map((b) => ({
    name: (
      <Link
        to={`/borrowers/${b.id}`}
        className={`font-sans no-underline ${
          b.is_archived ? "line-through text-retro-gray" : "text-retro-ink"
        }`}
      >
        {b.name}
        {b.is_archived && (
          <RetroBadge variant="neutral" className="ml-sm font-mono">
            {t`ARCHIVED`}
          </RetroBadge>
        )}
      </Link>
    ),
    email: (
      <span
        className={`font-mono ${
          b.email ? "text-retro-ink" : "text-retro-gray"
        }`}
      >
        {b.email ? b.email : "—"}
      </span>
    ),
    phone: (
      <span
        className={`font-mono ${
          b.phone ? "text-retro-ink" : "text-retro-gray"
        }`}
      >
        {b.phone ? b.phone : "—"}
      </span>
    ),
    actions: (
      <div className="flex items-center gap-xs justify-end">
        {!b.is_archived ? (
          <>
            <button
              type="button"
              aria-label={t`Edit ${b.name}`}
              onClick={() => handleEdit(b)}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
            >
              <Pencil size={14} />
              <span className="hidden lg:inline">{t`EDIT`}</span>
            </button>
            <button
              type="button"
              aria-label={t`Archive ${b.name}`}
              onClick={() => handleArchiveClick(b)}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
            >
              <Archive size={14} />
              <span className="hidden lg:inline">{t`ARCHIVE`}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label={t`Restore ${b.name}`}
              onClick={() => handleRestore(b)}
              disabled={restoreMutation.isPending}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Undo2 size={14} />
              <span className="hidden lg:inline">{t`RESTORE`}</span>
            </button>
            <button
              type="button"
              aria-label={t`Delete ${b.name}`}
              onClick={() => handleArchiveClick(b)}
              className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
            >
              <Trash2 size={14} />
              <span className="hidden lg:inline">{t`DELETE`}</span>
            </button>
          </>
        )}
      </div>
    ),
  }));

  return (
    <div className="flex flex-col gap-lg p-lg">
      <div className="flex items-center justify-between gap-md flex-wrap">
        <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-ink">
          {t`BORROWERS`}
        </h1>
        <RetroButton variant="primary" onClick={handleNew}>
          <Plus size={14} />
          {t`+ NEW BORROWER`}
        </RetroButton>
      </div>

      <div className="flex items-center gap-md flex-wrap">
        <RetroCheckbox
          label={`${t`Show archived`} (${archivedCount})`}
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
      </div>

      {workspaceId && borrowersQuery.isPending && (
        <RetroPanel>
          <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
        </RetroPanel>
      )}

      {workspaceId && borrowersQuery.isError && (
        <RetroPanel>
          <HazardStripe className="mb-md" />
          <p className="text-retro-red mb-md">
            {t`Could not load borrowers.`}
          </p>
          <RetroButton
            variant="primary"
            onClick={() => borrowersQuery.refetch()}
          >
            {t`Retry`}
          </RetroButton>
        </RetroPanel>
      )}

      {workspaceId && isEmpty && (
        <RetroEmptyState
          title={t`NO BORROWERS YET`}
          body={t`Create your first borrower to start tracking loans.`}
          action={
            <RetroButton variant="primary" onClick={handleNew}>
              {t`+ NEW BORROWER`}
            </RetroButton>
          }
        />
      )}

      {workspaceId &&
        borrowersQuery.isSuccess &&
        borrowers.length > 0 && (
          <RetroTable columns={columns} data={rows} />
        )}

      <BorrowerPanel ref={panelRef} />
      <BorrowerArchiveDeleteFlow
        ref={archiveFlowRef}
        nodeName={archiveTarget?.name ?? ""}
        onArchive={() =>
          archiveTarget
            ? archiveMutation.mutateAsync(archiveTarget.id)
            : Promise.resolve()
        }
        onDelete={() =>
          archiveTarget
            ? deleteMutation.mutateAsync(archiveTarget.id)
            : Promise.resolve()
        }
      />
    </div>
  );
}
