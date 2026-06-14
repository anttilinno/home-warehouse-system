import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import {
  BevelButton,
  RetroBadge,
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
  const queryClient = useQueryClient();
  const { currentWorkspaceId, workspaces } = useWorkspace();
  const [confirmClear, setConfirmClear] = useState(false);

  const role = workspaces?.find((w) => w.id === currentWorkspaceId)?.role;
  const canExport = role != null && ADMIN_ROLES.has(role);

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
      {/* 1. CACHED DATA — client-only clear */}
      <section className="flex flex-col gap-sp-2 border-b border-table-rule pb-sp-4">
        <h2 className="font-display text-[12px] uppercase tracking-[0.06em] text-fg-muted">
          <Trans>Cached data</Trans>
        </h2>
        <p className="text-[13px] text-fg-ink">
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
        <h2 className="font-display text-[12px] uppercase tracking-[0.06em] text-fg-muted">
          <Trans>Export</Trans>
        </h2>
        <p className="text-[13px] text-fg-ink">
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
          <p className="text-[12px] text-warn-deep">
            <Trans>Exporting a workspace backup requires admin rights.</Trans>
          </p>
        )}
      </section>

      {/* 3. IMPORT — pointer to Phase-14 imports (COMING SOON: no route yet) */}
      <section className="flex flex-col gap-sp-2 pt-sp-4">
        <h2 className="font-display text-[12px] uppercase tracking-[0.06em] text-fg-muted">
          <Trans>Import</Trans>
        </h2>
        <div className="flex items-center justify-between gap-sp-3">
          <p className="text-[13px] text-fg-ink">
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
