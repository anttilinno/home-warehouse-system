import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import type { User } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import {
  BevelButton,
  RetroBadge,
  RetroCheckbox,
  RetroConfirmDialog,
  Window,
  retroToast,
} from "@/components/retro";

// DataStoragePage (12-UI-SPEC §9, SETT-09) — Data & Storage. One blue Window
// with three grouped sections (border-b dividers). ONLINE-ONLY: there is no
// offline-storage surface and no offline-cache imports (CI grep guard,
// T-12-11). Sections:
//   1. CACHED DATA — clear-cache is CLIENT-ONLY: queryClient.clear() behind a
//      butter RetroConfirmDialog. No backend call (CONTEXT constraint 5).
//   2. EXPORT — the real admin-gated GET /workspaces/{wsId}/export/workspace
//      blob via settingsApi.exportWorkspace. The button is GATED on the current
//      workspace role (owner/admin); a 403 is still handled defensively
//      (Pitfall 8 / T-12-10 — the server requireAdminRole is authoritative).
//   3. IMPORT — a POINTER to the Phase-14 imports surface (A3: no inline restore
//      here). No imports route exists on this branch, so it renders as a
//      disabled butter "COMING SOON" RetroBadge instead of a dead link.

const ADMIN_ROLES = new Set(["owner", "admin"]);

export function DataStoragePage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const { currentWorkspaceId, workspaces } = useWorkspace();
  const [confirmClear, setConfirmClear] = useState(false);

  const role = workspaces?.find((w) => w.id === currentWorkspaceId)?.role;
  const canExport = role != null && ADMIN_ROLES.has(role);

  // SHOW ARCHIVED — the global, backend-synced "include archived rows" toggle.
  // READS the current value from the shared ["me"] query and WRITES via
  // PATCH /users/me/preferences. The Items and Inventory list hooks bind to the
  // same ["me"].show_archived value, so flipping it here refetches those lists.
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });
  const showArchived = me.data?.show_archived ?? false;

  const showArchivedMutation = useMutation({
    mutationFn: (next: boolean) =>
      settingsApi.updatePreferences({ show_archived: next }),
    onSuccess: (_user: User) => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      retroToast.success(t`Changes saved.`);
    },
    onError: () => {
      retroToast.error(<Trans>Couldn't save. Try again.</Trans>);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => {
      if (currentWorkspaceId == null) {
        return Promise.reject(new Error("no workspace selected"));
      }
      return settingsApi.exportWorkspace(currentWorkspaceId, "xlsx");
    },
    onError: () => {
      // Defense in depth (Pitfall 8 / T-12-10): even with the button gated, a
      // 403 (or any failure) surfaces a persistent danger toast.
      retroToast.error(<Trans>Couldn't export. Try again.</Trans>);
    },
  });

  return (
    <Window title={<Trans>Data & Storage</Trans>} bodyClassName="p-sp-4">
      {/* 0. SHOW ARCHIVED — global, backend-synced list-view preference */}
      <section className="flex flex-col gap-sp-2 border-b border-table-rule pb-sp-4">
        <h2 className="font-display text-12 uppercase tracking-6 text-fg-muted">
          <Trans>Archived items</Trans>
        </h2>
        <RetroCheckbox
          checked={showArchived}
          disabled={me.isPending || showArchivedMutation.isPending}
          onChange={(e) => showArchivedMutation.mutate(e.target.checked)}
          label={
            <span>
              <span className="font-bold">
                <Trans>Show archived items</Trans>
              </span>{" "}
              <span className="text-fg-muted">
                <Trans>
                  (include archived items and inventory in list views)
                </Trans>
              </span>
            </span>
          }
        />
      </section>

      {/* 1. CACHED DATA — client-only clear */}
      <section className="flex flex-col gap-sp-2 border-b border-table-rule py-sp-4">
        <h2 className="font-display text-12 uppercase tracking-6 text-fg-muted">
          <Trans>Cached data</Trans>
        </h2>
        <p className="text-13 text-fg-ink">
          <Trans>
            Clears locally cached lists. Your inventory data stays safe.
          </Trans>
        </p>
        <div className="flex justify-end">
          <BevelButton onClick={() => setConfirmClear(true)}>
            <Trans>Clear cached data</Trans>
          </BevelButton>
        </div>
      </section>

      {/* 2. EXPORT — real, admin-gated blob download */}
      <section className="flex flex-col gap-sp-2 border-b border-table-rule py-sp-4">
        <h2 className="font-display text-12 uppercase tracking-6 text-fg-muted">
          <Trans>Export</Trans>
        </h2>
        <p className="text-13 text-fg-ink">
          <Trans>Download a backup copy of this workspace.</Trans>
        </p>
        {canExport ? (
          <div className="flex justify-end">
            <BevelButton
              variant="primary"
              disabled={exportMutation.isPending || currentWorkspaceId == null}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? (
                <Trans>Exporting…</Trans>
              ) : (
                <Trans>Export…</Trans>
              )}
            </BevelButton>
          </div>
        ) : (
          <p className="text-12 text-warn-deep">
            <Trans>Exporting a workspace backup requires admin rights.</Trans>
          </p>
        )}
      </section>

      {/* 3. IMPORT — pointer to Phase-14 imports (COMING SOON: no route yet) */}
      <section className="flex flex-col gap-sp-2 pt-sp-4">
        <h2 className="font-display text-12 uppercase tracking-6 text-fg-muted">
          <Trans>Import</Trans>
        </h2>
        <div className="flex items-center justify-between gap-sp-3">
          <p className="text-13 text-fg-ink">
            <Trans>Bring data in from a file.</Trans>
          </p>
          <RetroBadge variant="info" aria-disabled="true">
            <Trans>Coming soon</Trans>
          </RetroBadge>
        </div>
      </section>

      <RetroConfirmDialog
        open={confirmClear}
        title={<Trans>Clear cached data</Trans>}
        titlebarVariant="butter"
        confirmVariant="primary"
        confirmLabel={<Trans>Clear cached data</Trans>}
        onCancel={() => setConfirmClear(false)}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          queryClient.clear();
          retroToast.success(<Trans>Cached data cleared.</Trans>);
        }}
      >
        <Trans>
          Clear cached data? Your inventory data stays safe — this only clears
          locally cached lists.
        </Trans>
      </RetroConfirmDialog>
    </Window>
  );
}
