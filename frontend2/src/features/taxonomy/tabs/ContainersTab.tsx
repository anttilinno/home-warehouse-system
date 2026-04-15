import { useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Plus, Pencil, Archive, Undo2 } from "../icons";
import {
  RetroPanel,
  RetroButton,
  RetroEmptyState,
  RetroCheckbox,
  RetroCombobox,
  RetroBadge,
  HazardStripe,
  type RetroOption,
} from "@/components/retro";
import { useAuth } from "@/features/auth/AuthContext";
import { useContainersByLocation } from "../hooks/useContainersByLocation";
import { useLocationsTree } from "../hooks/useLocationsTree";
import {
  useArchiveContainer,
  useDeleteContainer,
  useRestoreContainer,
} from "../hooks/useContainerMutations";
import {
  EntityPanel,
  type EntityPanelHandle,
} from "../panel/EntityPanel";
import {
  ArchiveDeleteFlow,
  type ArchiveDeleteFlowHandle,
} from "../actions/ArchiveDeleteFlow";
import type { Container } from "@/lib/api/containers";

export function ContainersTab() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [filterLocationId, setFilterLocationId] = useState<string>("");
  const [archiveTarget, setArchiveTarget] = useState<Container | null>(null);

  const entityPanelRef = useRef<EntityPanelHandle>(null);
  const archiveFlowRef = useRef<ArchiveDeleteFlowHandle>(null);

  const locationsQuery = useLocationsTree(false);
  const containersQuery = useContainersByLocation({
    locationId: filterLocationId || undefined,
    showArchived: true,
  });

  const archiveMutation = useArchiveContainer();
  const deleteMutation = useDeleteContainer();
  const restoreMutation = useRestoreContainer();

  const locations = locationsQuery.items;
  const locationOptions: RetroOption[] = useMemo(
    () =>
      locations.map((l) => ({
        value: l.id,
        label: l.short_code ? `${l.name} (${l.short_code})` : l.name,
      })),
    [locations],
  );
  const filterOptions: RetroOption[] = useMemo(
    () => [{ value: "", label: t`All locations` }, ...locationOptions],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationOptions, t],
  );

  const containers = containersQuery.items;
  const filteredContainers = useMemo(
    () => (showArchived ? containers : containers.filter((c) => !c.is_archived)),
    [containers, showArchived],
  );
  const archivedCount = useMemo(
    () => containers.filter((c) => c.is_archived).length,
    [containers],
  );

  // Group filtered containers by location_id preserving location order
  const grouped = useMemo(() => {
    const m = new Map<string, Container[]>();
    for (const c of filteredContainers) {
      const arr = m.get(c.location_id) ?? [];
      arr.push(c);
      m.set(c.location_id, arr);
    }
    return m;
  }, [filteredContainers]);

  if (authLoading) return null;

  const handleNew = () => {
    if (locations.length === 0) return;
    entityPanelRef.current?.open("create");
  };
  const handleEdit = (item: Container) => {
    entityPanelRef.current?.open("edit", item);
  };
  const handleArchive = (item: Container) => {
    setArchiveTarget(item);
    archiveFlowRef.current?.open();
  };
  const handleRestore = (item: Container) => {
    restoreMutation.mutate(item.id);
  };

  const hasLocations = locations.length > 0;
  const isEmpty =
    containersQuery.isSuccess && filteredContainers.length === 0;

  return (
    <div className="flex flex-col gap-md">
      <div className="flex items-center justify-between gap-md flex-wrap">
        <div className="flex items-center gap-md flex-wrap">
          <div className="min-w-[240px]">
            <RetroCombobox
              options={filterOptions}
              value={filterLocationId}
              onChange={(v) => setFilterLocationId(v)}
              placeholder={t`Filter by location…`}
            />
          </div>
          <RetroCheckbox
            label={`${t`Show archived`} (${archivedCount})`}
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
        </div>
        <div className="flex flex-col items-end gap-xs">
          <RetroButton
            variant="primary"
            onClick={handleNew}
            disabled={!hasLocations}
          >
            <Plus size={14} aria-hidden="true" />
            {t`+ NEW CONTAINER`}
          </RetroButton>
          {!hasLocations && (
            <span className="text-[12px] text-retro-gray">
              {t`Create a location first.`}
            </span>
          )}
        </div>
      </div>

      {workspaceId && containersQuery.isPending && (
        <RetroPanel>
          <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
        </RetroPanel>
      )}

      {workspaceId && containersQuery.isError && (
        <RetroPanel>
          <HazardStripe className="mb-md" />
          <p className="text-retro-red mb-md">
            {t`Could not load containers.`}
          </p>
          <RetroButton
            variant="primary"
            onClick={() => containersQuery.refetch()}
          >
            {t`Retry`}
          </RetroButton>
        </RetroPanel>
      )}

      {workspaceId && isEmpty && (
        <RetroEmptyState
          title={t`NO CONTAINERS YET`}
          body={t`Containers belong to a location. Create a location first, then add containers inside it.`}
          action={
            <RetroButton
              variant="primary"
              onClick={handleNew}
              disabled={!hasLocations}
            >
              {t`+ NEW CONTAINER`}
            </RetroButton>
          }
        />
      )}

      {workspaceId && containersQuery.isSuccess && filteredContainers.length > 0 && (
        <div className="flex flex-col gap-lg">
          {locations
            .filter((loc) => grouped.has(loc.id))
            .map((loc) => {
              const rows = grouped.get(loc.id) ?? [];
              return (
                <div key={loc.id} className="flex flex-col gap-sm">
                  <h3 className="uppercase tracking-wider font-sans text-[14px] font-semibold text-retro-ink">
                    {loc.name}
                  </h3>
                  <RetroPanel>
                    <ul className="flex flex-col">
                      {rows.map((c) => {
                        const archived = c.is_archived;
                        return (
                          <li
                            key={c.id}
                            className={`flex items-center gap-sm min-h-[44px] lg:min-h-[36px] ${archived ? "line-through text-retro-gray" : "text-retro-ink"}`}
                          >
                            {c.short_code && (
                              <span className="font-mono text-[12px] text-retro-gray min-w-[80px]">
                                {c.short_code}
                              </span>
                            )}
                            <span className="flex-1 font-sans text-[14px]">
                              {c.name}
                            </span>
                            {archived && (
                              <RetroBadge
                                variant="neutral"
                                className="font-mono"
                              >
                                {t`ARCHIVED`}
                              </RetroBadge>
                            )}
                            <div className="flex items-center gap-xs">
                              <button
                                type="button"
                                aria-label={t`Edit ${c.name}`}
                                onClick={() => handleEdit(c)}
                                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
                              >
                                <Pencil size={14} aria-hidden="true" />
                                <span className="hidden lg:inline">{t`EDIT`}</span>
                              </button>
                              {!archived ? (
                                <button
                                  type="button"
                                  aria-label={t`Archive ${c.name}`}
                                  onClick={() => handleArchive(c)}
                                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
                                >
                                  <Archive size={14} aria-hidden="true" />
                                  <span className="hidden lg:inline">{t`ARCHIVE`}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={t`Restore ${c.name}`}
                                  onClick={() => handleRestore(c)}
                                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
                                >
                                  <Undo2 size={14} aria-hidden="true" />
                                  <span className="hidden lg:inline">{t`RESTORE`}</span>
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </RetroPanel>
                </div>
              );
            })}
        </div>
      )}

      <EntityPanel
        kind="container"
        ref={entityPanelRef}
        locationOptions={locationOptions}
      />
      <ArchiveDeleteFlow
        ref={archiveFlowRef}
        entityKind="container"
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
