import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroTree,
  RetroEmptyState,
  RetroConfirmDialog,
  type RetroTreeNode,
} from "@/components/retro";
import type { Category } from "@/lib/api/category";
import type { TreeNode } from "@/features/taxonomy/lib/buildTree";
import { useCategoriesQuery } from "../hooks/useCategoriesQuery";
import { useCategoryMutations } from "../hooks/useCategoryMutations";
import { useUsageCountTarget } from "../hooks/useUsageCountTarget";
import { TaxonomyTabState } from "./TaxonomyTabState";

// Phase 10 Plan 02 — the Categories tab (TAX-01 tree + CRUD, TAX-02 client
// usage-warning archive). Consumes useCategoriesQuery (tree) +
// useCategoryMutations + useUsageCount. The RetroTree EMITS row actions; this
// tab owns the dialogs. Category forms are ROUTED (Task 2 registered
// /taxonomy/categories/new + /:id/edit) — onAddChild/onEdit navigate to them.
//
// Archive flow (TAX-02): on archive-open we fetch the item count via
// useUsageCount.fetchCount("category", id) BEFORE confirming; total>0 renders the
// count-aware butter "Archive anyway" copy, total=0 renders the plain butter
// confirm. The archive call is UNCONDITIONAL after confirm (advisory warning —
// NO ?force=). Restore fires the restore mutation directly.
//
// Render-loop guard: destructure the stable .mutate handlers.

// Map a buildTree TreeNode<Category> into the RetroTreeNode shape. itemCount is
// left 0 in the tree (the count is fetched only on archive — no per-row fan-out).
function toTreeNodes(nodes: TreeNode<Category>[]): RetroTreeNode[] {
  return nodes.map((n) => ({
    id: n.node.id,
    name: n.node.name,
    itemCount: 0,
    isArchived: n.node.is_archived,
    children: toTreeNodes(n.children),
  }));
}

export function CategoriesTab() {
  const { t } = useLingui();
  const navigate = useNavigate();

  const { tree, isLoading, isError, refetch } = useCategoriesQuery();
  const { archive, restore } = useCategoryMutations();
  const archiveCategory = archive.mutate;
  const restoreCategory = restore.mutate;

  const nodes = useMemo(() => toTreeNodes(tree), [tree]);

  // Archive opens the confirm immediately (count=null → "loading"), then the
  // assigned-item count is fetched and patched in so the copy becomes count-aware.
  const {
    target: archiveTarget,
    open: openArchiveTarget,
    clear: clearArchive,
  } = useUsageCountTarget("category");

  const openCreateRoot = () => navigate("/taxonomy/categories/new");
  const openAddChild = (node: RetroTreeNode) =>
    navigate(`/taxonomy/categories/new?parent=${encodeURIComponent(node.id)}`);
  const openEdit = (node: RetroTreeNode) =>
    navigate(`/taxonomy/categories/${node.id}/edit`);

  const openArchive = (node: RetroTreeNode) =>
    openArchiveTarget(node.id, node.name);

  function confirmArchive() {
    if (!archiveTarget) return;
    archiveCategory({ id: archiveTarget.id, name: archiveTarget.name });
    clearArchive();
  }

  function onRestore(node: RetroTreeNode) {
    restoreCategory({ id: node.id, name: node.name });
  }

  const hasItems = (archiveTarget?.count ?? 0) > 0;
  const n = archiveTarget?.count ?? 0;

  return (
    <TaxonomyTabState
      isError={isError}
      isLoading={isLoading}
      errorTitle={<Trans>COULDN'T LOAD CATEGORIES</Trans>}
      onRetry={() => refetch()}
    >
      <div className="flex flex-col gap-sp-3">
        <div className="flex items-center">
          <BevelButton variant="mint" onClick={openCreateRoot}>
            <Trans>⊕ ADD ROOT CATEGORY</Trans>
          </BevelButton>
        </div>

        <RetroTree
          nodes={nodes}
          storageKey="taxonomy:tree:categories"
          onAddChild={openAddChild}
          onEdit={openEdit}
          onArchive={openArchive}
          onRestore={onRestore}
          emptyState={
            <RetroEmptyState
              eyebrow={<Trans>Taxonomy</Trans>}
              glyph="◇"
              heading={<Trans>NO CATEGORIES YET</Trans>}
              body={
                <Trans>
                  Group your inventory by creating a top-level category. You can
                  nest sub-categories underneath it.
                </Trans>
              }
              action={{
                label: <Trans>⊕ ADD ROOT CATEGORY</Trans>,
                onClick: openCreateRoot,
              }}
            />
          }
        />

        {/* TAX-02 usage-warning archive confirm (butter, non-destructive). The
          count is fetched on open; total>0 surfaces the count-aware copy. */}
        <RetroConfirmDialog
          open={archiveTarget !== null}
          title={<Trans>ARCHIVE CATEGORY?</Trans>}
          titlebarVariant="butter"
          confirmVariant="neutral"
          confirmLabel={
            hasItems ? <Trans>Archive anyway</Trans> : <Trans>Archive</Trans>
          }
          cancelLabel={<Trans>Cancel</Trans>}
          onConfirm={confirmArchive}
          onCancel={clearArchive}
          onClose={clearArchive}
        >
          {hasItems ? (
            <span>
              <span aria-hidden="true">⚠ </span>
              {t`"${archiveTarget?.name ?? ""}" has ${n} item${
                n === 1 ? "" : "s"
              } assigned to it. Archiving keeps those items but hides this category from pickers until you restore it.`}
            </span>
          ) : (
            <span>
              {t`Archive "${archiveTarget?.name ?? ""}"? You can restore it later.`}
            </span>
          )}
        </RetroConfirmDialog>
      </div>
    </TaxonomyTabState>
  );
}
