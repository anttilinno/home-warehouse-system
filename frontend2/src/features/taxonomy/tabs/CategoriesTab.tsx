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
import { useCategoriesTree } from "../hooks/useCategoriesTree";
import {
  useArchiveCategory,
  useDeleteCategory,
  useRestoreCategory,
} from "../hooks/useCategoryMutations";
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
import type { Category } from "@/lib/api/categories";

export function CategoriesTab() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);

  const entityPanelRef = useRef<EntityPanelHandle>(null);
  const archiveFlowRef = useRef<ArchiveDeleteFlowHandle>(null);

  // Always include archived so we can render the archived section; local toggle controls display
  const query = useCategoriesTree(true);
  const archiveMutation = useArchiveCategory();
  const deleteMutation = useDeleteCategory();
  const restoreMutation = useRestoreCategory();

  const allItems = query.items;
  const activeItems = useMemo(
    () => allItems.filter((c) => !c.is_archived),
    [allItems],
  );
  const archivedItems = useMemo(
    () => allItems.filter((c) => c.is_archived),
    [allItems],
  );
  const activeRoots = useMemo(
    () => buildTree(activeItems, (c) => c.parent_category_id ?? null),
    [activeItems],
  );
  const archivedRoots = useMemo(
    () => buildTree(archivedItems, (c) => c.parent_category_id ?? null),
    [archivedItems],
  );

  const excludedIds = useMemo(() => {
    if (!editingId) return new Set<string>();
    const editingNode = activeRoots
      .flatMap(function walk(n): ReturnType<typeof buildTree<Category>> {
        return [n, ...n.children.flatMap(walk)];
      })
      .find((n) => n.node.id === editingId);
    return editingNode ? collectDescendantIds(editingNode) : new Set<string>();
  }, [activeRoots, editingId]);

  const parentOptions: RetroOption[] = useMemo(
    () =>
      activeItems
        .filter((c) => !excludedIds.has(c.id))
        .map((c) => ({ value: c.id, label: c.name })),
    [activeItems, excludedIds],
  );

  if (authLoading) return null;

  const handleNew = () => {
    setEditingId(null);
    entityPanelRef.current?.open("create");
  };
  const handleEdit = (item: Category) => {
    setEditingId(item.id);
    entityPanelRef.current?.open("edit", item);
  };
  const handleArchive = (item: Category) => {
    setArchiveTarget(item);
    archiveFlowRef.current?.open();
  };
  const handleRestore = (item: Category) => {
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
          {t`+ NEW CATEGORY`}
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
            {t`Could not load categories.`}
          </p>
          <RetroButton variant="primary" onClick={() => query.refetch()}>
            {t`Retry`}
          </RetroButton>
        </RetroPanel>
      )}

      {workspaceId && query.isSuccess && allItems.length === 0 && (
        <RetroEmptyState
          title={t`NO CATEGORIES YET`}
          body={t`Create your first category to start organizing items.`}
          action={
            <RetroButton variant="primary" onClick={handleNew}>
              {t`+ NEW CATEGORY`}
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
        kind="category"
        ref={entityPanelRef}
        parentOptions={parentOptions}
      />
      <ArchiveDeleteFlow
        ref={archiveFlowRef}
        entityKind="category"
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
