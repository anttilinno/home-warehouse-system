import { useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Plus } from "../icons";
import {
  RetroPanel,
  RetroButton,
  RetroEmptyState,
  RetroCheckbox,
  HazardStripe,
  type RetroOption,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { useLocationsTree } from "../hooks/useLocationsTree";
import {
  useArchiveLocation,
  useDeleteLocation,
  useRestoreLocation,
} from "../hooks/useLocationMutations";
import {
  EntityPanel,
  type EntityPanelHandle,
} from "../panel/EntityPanel";
import {
  ArchiveDeleteFlow,
  type ArchiveDeleteFlowHandle,
} from "../actions/ArchiveDeleteFlow";
import { TaxonomyTree } from "../tree/TaxonomyTree";
import { buildTree, collectDescendantIds } from "../tree/buildTree";
import type { Location } from "@/lib/api/locations";

export function LocationsTab() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Location | null>(null);

  const entityPanelRef = useRef<EntityPanelHandle>(null);
  const archiveFlowRef = useRef<ArchiveDeleteFlowHandle>(null);

  const query = useLocationsTree(true);
  const archiveMutation = useArchiveLocation();
  const deleteMutation = useDeleteLocation();
  const restoreMutation = useRestoreLocation();

  const allItems = query.items;
  const activeItems = useMemo(
    () => allItems.filter((l) => !l.is_archived),
    [allItems],
  );
  const archivedItems = useMemo(
    () => allItems.filter((l) => l.is_archived),
    [allItems],
  );
  const activeRoots = useMemo(
    () => buildTree(activeItems, (l) => l.parent_location ?? null),
    [activeItems],
  );
  const archivedRoots = useMemo(
    () => buildTree(archivedItems, (l) => l.parent_location ?? null),
    [archivedItems],
  );

  const excludedIds = useMemo(() => {
    if (!editingId) return new Set<string>();
    const editingNode = activeRoots
      .flatMap(function walk(n): ReturnType<typeof buildTree<Location>> {
        return [n, ...n.children.flatMap(walk)];
      })
      .find((n) => n.node.id === editingId);
    return editingNode ? collectDescendantIds(editingNode) : new Set<string>();
  }, [activeRoots, editingId]);

  const parentOptions: RetroOption[] = useMemo(
    () =>
      activeItems
        .filter((l) => !excludedIds.has(l.id))
        .map((l) => ({
          value: l.id,
          label: l.short_code ? `${l.name} (${l.short_code})` : l.name,
        })),
    [activeItems, excludedIds],
  );

  if (authLoading) return null;

  const handleNew = () => {
    setEditingId(null);
    entityPanelRef.current?.open("create");
  };
  const handleEdit = (item: Location) => {
    setEditingId(item.id);
    entityPanelRef.current?.open("edit", item);
  };
  const handleArchive = (item: Location) => {
    setArchiveTarget(item);
    archiveFlowRef.current?.open();
  };
  const handleRestore = (item: Location) => {
    restoreMutation.mutate(item.id);
  };

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-md flex-wrap">
        <RetroCheckbox
          label={`${t`Show archived`} (${archivedItems.length})`}
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        <RetroButton variant="primary" onClick={handleNew}>
          <Plus size={14} aria-hidden="true" />
          {t`+ NEW LOCATION`}
        </RetroButton>
      </div>

      {workspaceId && query.isPending && (
        <RetroPanel>
          <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
        </RetroPanel>
      )}

      {workspaceId && query.isError && (
        <RetroPanel>
          <HazardStripe className="mb-md" />
          <p className="text-retro-red mb-md">
            {t`Could not load locations.`}
          </p>
          <RetroButton variant="primary" onClick={() => query.refetch()}>
            {t`Retry`}
          </RetroButton>
        </RetroPanel>
      )}

      {workspaceId && query.isSuccess && allItems.length === 0 && (
        <RetroEmptyState
          title={t`NO LOCATIONS YET`}
          body={t`Create your first location to start placing items.`}
          action={
            <RetroButton variant="primary" onClick={handleNew}>
              {t`+ NEW LOCATION`}
            </RetroButton>
          }
        />
      )}

      {workspaceId && query.isSuccess && allItems.length > 0 && (
        <RetroPanel>
          <TaxonomyTree
            roots={activeRoots}
            archivedRoots={archivedRoots}
            showArchived={showArchived}
            onEdit={handleEdit}
            onArchive={handleArchive}
            onRestore={handleRestore}
            activeEditId={editingId}
          />
        </RetroPanel>
      )}

      <EntityPanel
        kind="location"
        ref={entityPanelRef}
        parentOptions={parentOptions}
      />
      <ArchiveDeleteFlow
        ref={archiveFlowRef}
        entityKind="location"
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
