import { useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroTree,
  RetroEmptyState,
  RetroConfirmDialog,
  type RetroTreeNode,
} from "@/components/retro";
import type { Location } from "@/lib/api/location";
import type { TreeNode } from "@/features/taxonomy/lib/buildTree";
import { useLocationsQuery } from "../hooks/useLocationsQuery";
import { useLocationMutations } from "../hooks/useLocationMutations";
import { LocationFormDialog } from "./LocationFormDialog";
import { TaxonomyTabState } from "./TaxonomyTabState";

// Phase 10 Plan 03 — the Locations tab (TAX-03 tree + CRUD, TAX-04 archive).
// Filled IN-PLACE over the W2 stub; export name `LocationsTab` UNCHANGED so the
// W2 TaxonomyPage import never needs re-editing (cross-wave handoff).
//
// MIRRORS CategoriesTab structure MINUS the usage-count fetch: locations are
// ARCHIVE-ONLY (TAX-04 / OQ6 — no delete affordance anywhere; location
// hard-delete is dangerous) and the archive confirm uses the PLAIN butter copy
// (no client usage-count requirement). The tree nests via parent_location
// (NOT _id — Pitfall 6). Forms are INLINE RetroDialogs (no route).
//
// Render-loop guard: destructure the stable .mutate handlers.

// Map a buildTree TreeNode<Location> into the RetroTreeNode shape. itemCount is
// left 0 (no per-row fan-out — locations have no usage badge requirement).
function toTreeNodes(nodes: TreeNode<Location>[]): RetroTreeNode[] {
  return nodes.map((n) => ({
    id: n.node.id,
    name: n.node.name,
    itemCount: 0,
    isArchived: n.node.is_archived,
    children: toTreeNodes(n.children),
  }));
}

interface ArchiveTarget {
  id: string;
  name: string;
}

interface FormState {
  open: boolean;
  location?: Location;
  parentId?: string;
}

export function LocationsTab() {
  const { t } = useLingui();

  const { rows, tree, isLoading, isError, refetch } = useLocationsQuery();
  const { archive, restore } = useLocationMutations();
  const archiveLocation = archive.mutate;
  const restoreLocation = restore.mutate;

  const nodes = useMemo(() => toTreeNodes(tree), [tree]);
  const rowsById = useMemo(() => {
    const m = new Map<string, Location>();
    rows.forEach((r) => {
      m.set(r.id, r);
    });
    return m;
  }, [rows]);

  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(
    null,
  );
  const [form, setForm] = useState<FormState>({ open: false });

  const openCreateRoot = () => setForm({ open: true });
  const openAddChild = (node: RetroTreeNode) =>
    setForm({ open: true, parentId: node.id });
  const openEdit = (node: RetroTreeNode) =>
    setForm({ open: true, location: rowsById.get(node.id) });
  const closeForm = () => setForm({ open: false });

  function openArchive(node: RetroTreeNode) {
    setArchiveTarget({ id: node.id, name: node.name });
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    archiveLocation({ id: archiveTarget.id, name: archiveTarget.name });
    setArchiveTarget(null);
  }

  function onRestore(node: RetroTreeNode) {
    restoreLocation({ id: node.id, name: node.name });
  }

  return (
    <TaxonomyTabState
      isError={isError}
      isLoading={isLoading}
      errorTitle={<Trans>COULDN'T LOAD LOCATIONS</Trans>}
      onRetry={() => refetch()}
    >
      <div className="flex flex-col gap-sp-3">
        <div className="flex items-center">
          <BevelButton variant="mint" onClick={openCreateRoot}>
            <Trans>⊕ ADD ROOT LOCATION</Trans>
          </BevelButton>
        </div>

        <RetroTree
          nodes={nodes}
          storageKey="taxonomy:tree:locations"
          onAddChild={openAddChild}
          onEdit={openEdit}
          onArchive={openArchive}
          onRestore={onRestore}
          emptyState={
            <RetroEmptyState
              eyebrow={<Trans>Taxonomy</Trans>}
              glyph="◇"
              heading={<Trans>NO LOCATIONS YET</Trans>}
              body={
                <Trans>
                  Add your first location — a room, shelf, or area. Nest
                  sub-locations to mirror your space.
                </Trans>
              }
              action={{
                label: <Trans>⊕ ADD ROOT LOCATION</Trans>,
                onClick: openCreateRoot,
              }}
            />
          }
        />

        {/* TAX-04 archive confirm (butter, non-destructive). Locations are
          ARCHIVE-ONLY — no usage-count fetch, plain butter copy. */}
        <RetroConfirmDialog
          open={archiveTarget !== null}
          title={<Trans>ARCHIVE LOCATION?</Trans>}
          titlebarVariant="butter"
          confirmVariant="neutral"
          confirmLabel={<Trans>Archive</Trans>}
          cancelLabel={<Trans>Cancel</Trans>}
          onConfirm={confirmArchive}
          onCancel={() => setArchiveTarget(null)}
          onClose={() => setArchiveTarget(null)}
        >
          <span>
            {t`Archive "${archiveTarget?.name ?? ""}"? You can restore it later.`}
          </span>
        </RetroConfirmDialog>

        <LocationFormDialog
          open={form.open}
          location={form.location}
          parentId={form.parentId}
          onClose={closeForm}
        />
      </div>
    </TaxonomyTabState>
  );
}
