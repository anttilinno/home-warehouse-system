import { useMemo, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroTable,
  RetroEmptyState,
  RetroConfirmDialog,
} from "@/components/retro";
import type { Container } from "@/lib/api/container";
import { useContainersQuery } from "../hooks/useContainersQuery";
import { useLocationsQuery } from "../hooks/useLocationsQuery";
import { useContainerMutations } from "../hooks/useContainerMutations";
import { useUsageCountTarget } from "../hooks/useUsageCountTarget";
import { ContainerFormDialog } from "./ContainerFormDialog";
import { TaxonomyTabState } from "./TaxonomyTabState";

// Phase 10 Plan 03 — the Containers tab (TAX-05 grouped-by-location list, TAX-06
// DELETE-with-unassign). Filled IN-PLACE over the W2 stub; export name
// `ContainersTab` UNCHANGED so the W2 TaxonomyPage import never needs re-editing.
//
// Containers are FLAT (location_id) — the grouping is a CLIENT group-by: rows are
// bucketed by location_id, groups sorted alpha by the resolved location name, and
// the unresolved/null bucket renders LAST as "(No location)" (mirrors the
// InventoryListPage unresolved-name discipline). Location names are resolved from
// useLocationsQuery rows — NO per-row fan-out.
//
// Delete (TAX-06): containers use bare DELETE (not archive). On delete-open we
// fetch the assigned-item count via useUsageCount("container", id); total>0
// surfaces the pink cascade warning ("⚠ … holds N item(s) … will be unassigned …
// they stay in their location"); total=0 shows the plain pink confirm. Confirm
// fires a single bare del.mutate(id) — NO ?force, NO second call (the server FK
// SET NULLs the inventory rows). useContainerMutations.del invalidates BOTH
// ["containers", ws] AND ["inventory", ws].
//
// Render-loop guard: destructure the stable .mutate handlers.

const NO_LOCATION = "__none__";

interface GroupBucket {
  key: string; // location id, or NO_LOCATION
  name: string; // resolved location name, or "(No location)"
  containers: Container[];
}

interface FormState {
  open: boolean;
  container?: Container;
}

export function ContainersTab() {
  const { t } = useLingui();

  const { rows, isLoading, isError, refetch } = useContainersQuery();
  const { rows: locationRows } = useLocationsQuery();
  const { del } = useContainerMutations();
  const deleteContainer = del.mutate;

  const locationNameById = useMemo(() => {
    const m = new Map<string, string>();
    locationRows.forEach((l) => {
      m.set(l.id, l.name);
    });
    return m;
  }, [locationRows]);

  const noLocationLabel = t`(No location)`;

  // Client group-by location_id. The unresolved/null bucket sorts LAST.
  const groups = useMemo<GroupBucket[]>(() => {
    const byKey = new Map<string, GroupBucket>();
    for (const c of rows) {
      const resolvedName = c.location_id
        ? locationNameById.get(c.location_id)
        : undefined;
      const key = resolvedName ? c.location_id : NO_LOCATION;
      const name = resolvedName ?? noLocationLabel;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = { key, name, containers: [] };
        byKey.set(key, bucket);
      }
      bucket.containers.push(c);
    }
    const all = [...byKey.values()];
    // Alpha-sort groups by name; the (No location) bucket always sorts LAST.
    all.sort((a, b) => {
      if (a.key === NO_LOCATION) return 1;
      if (b.key === NO_LOCATION) return -1;
      return a.name.localeCompare(b.name);
    });
    // Sort containers within each group alpha by name.
    all.forEach((g) => {
      g.containers.sort((a, b) => a.name.localeCompare(b.name));
    });
    return all;
  }, [rows, locationNameById, noLocationLabel]);

  const [form, setForm] = useState<FormState>({ open: false });

  // Delete opens the confirm immediately (count=null → "loading"), then the
  // assigned-item count is fetched and patched in so the cascade copy resolves.
  const {
    target: deleteTarget,
    open: openDeleteTarget,
    clear: clearDelete,
  } = useUsageCountTarget("container");

  const openCreate = () => setForm({ open: true });
  const openEdit = (c: Container) => setForm({ open: true, container: c });
  const closeForm = () => setForm({ open: false });

  const openDelete = (c: Container) => openDeleteTarget(c.id, c.name);

  function confirmDelete() {
    if (!deleteTarget) return;
    // A single bare DELETE — NO ?force, NO second call (server cascades).
    deleteContainer({ id: deleteTarget.id, name: deleteTarget.name });
    clearDelete();
  }

  const hasItems = (deleteTarget?.count ?? 0) > 0;
  const n = deleteTarget?.count ?? 0;

  return (
    <TaxonomyTabState
      isError={isError}
      isLoading={isLoading}
      errorTitle={<Trans>COULDN'T LOAD CONTAINERS</Trans>}
      onRetry={() => refetch()}
    >
      <div className="flex flex-col gap-sp-3">
        <div className="flex items-center">
          <BevelButton variant="mint" onClick={openCreate}>
            <Trans>⊕ ADD CONTAINER</Trans>
          </BevelButton>
        </div>

        {rows.length === 0 ? (
          <RetroEmptyState
            eyebrow={<Trans>Containers</Trans>}
            glyph="◇"
            heading={<Trans>NO CONTAINERS YET</Trans>}
            body={
              <Trans>
                Containers live inside a location. Add one to start grouping
                items by box, bin, or drawer.
              </Trans>
            }
            action={{
              label: <Trans>⊕ ADD CONTAINER</Trans>,
              onClick: openCreate,
            }}
          />
        ) : (
          <div className="flex flex-col gap-sp-5">
            {groups.map((group) => (
              <div key={group.key} className="flex flex-col">
                <div className="bg-bg-panel-2 px-sp-2 py-sp-1 text-11 font-bold uppercase tracking-8 text-fg-muted">
                  {group.name}
                </div>
                <RetroTable>
                  <tbody>
                    {group.containers.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <span
                            className={`font-body text-14 ${
                              c.is_archived ? "text-fg-muted" : "text-fg-ink"
                            }`}
                          >
                            {c.name}
                          </span>
                          {c.short_code && (
                            <span className="ml-sp-2 font-mono text-11 text-fg-faint">
                              {c.short_code}
                            </span>
                          )}
                          {c.is_archived && (
                            <span className="ml-sp-2 text-11 uppercase text-fg-muted">
                              <Trans>archived</Trans>
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <span className="inline-flex items-center gap-sp-1">
                            <BevelButton
                              type="button"
                              className="!px-[8px] !py-[2px] !text-11"
                              onClick={() => openEdit(c)}
                            >
                              EDIT
                            </BevelButton>
                            <BevelButton
                              type="button"
                              variant="danger"
                              aria-label={t`Delete ${c.name}`}
                              title={t`Delete ${c.name}`}
                              className="!px-[8px] !py-[2px] !text-11"
                              onClick={() => openDelete(c)}
                            >
                              {"⌫"}
                            </BevelButton>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </RetroTable>
              </div>
            ))}
          </div>
        )}

        {/* TAX-06 delete-with-cascade confirm (pink, destructive). The count is
          fetched on open; total>0 surfaces the cascade copy with the count. */}
        <RetroConfirmDialog
          open={deleteTarget !== null}
          title={<Trans>DELETE CONTAINER?</Trans>}
          titlebarVariant="pink"
          confirmVariant="danger"
          confirmLabel={<Trans>DELETE</Trans>}
          cancelLabel={<Trans>Cancel</Trans>}
          onConfirm={confirmDelete}
          onCancel={clearDelete}
          onClose={clearDelete}
        >
          {hasItems ? (
            <span>
              <span aria-hidden="true">⚠ </span>
              {t`"${deleteTarget?.name ?? ""}" holds ${n} item${
                n === 1 ? "" : "s"
              }. Deleting it will move those items out of any container (they stay in their location) and then delete the container. This can't be undone.`}
            </span>
          ) : (
            <span>
              {t`Delete "${deleteTarget?.name ?? ""}"? This can't be undone.`}
            </span>
          )}
        </RetroConfirmDialog>

        <ContainerFormDialog
          open={form.open}
          container={form.container}
          onClose={closeForm}
        />
      </div>
    </TaxonomyTabState>
  );
}
