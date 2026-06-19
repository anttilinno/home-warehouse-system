import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  BevelButton,
  RetroFileInput,
  RetroSelect,
  retroToast,
  Window,
} from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import {
  IMPORT_ENTITY_TYPES,
  type ImportEntityType,
} from "@/lib/api/importJobs";
import { settingsApi } from "@/lib/api/settings";
import { useImportJobs, useUploadImport } from "./hooks/useImportJobs";
import { ImportHistory } from "./components/ImportHistory";

// Phase 14 Plan 05 (SYS-04) — the /imports page. One blue Window with three
// grouped sections (border-b dividers), mirroring DataStoragePage's admin gate
// and LoansListPage's activity-table composition:
//   1. IMPORT — a RetroSelect (the PLURAL importjob entity enum) + a
//      RetroFileInput (.csv) + an Import action calling useUploadImport, which
//      runs the ASYNC multipart POST /imports/upload (the path that CREATES the
//      job feeding the history table) and invalidates the jobs list on success.
//      Gated on ADMIN_ROLES (server requireAdminRole is authoritative — a 403
//      still surfaces a calm danger toast, Pitfall 8 / T-14-14).
//   2. EXPORT — REUSES settingsApi.exportWorkspace (the existing admin-gated
//      workspace backup blob); NOT a re-implementation (T-14-export).
//   3. HISTORY — the jobs activity-table from useImportJobs (File / Entity /
//      Status / Progress / Rows / Created). Empty → RetroEmptyState.
// ONLINE-ONLY: NO offline/sync import (FOUND-02 / lint:imports guard, T-14-16).

const ADMIN_ROLES = new Set(["owner", "admin"]);

export function ImportsPage() {
  const { t } = useLingui();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();
  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  const role = workspaces?.find((w) => w.id === wsId)?.role;
  const isAdmin = role != null && ADMIN_ROLES.has(role);

  const { jobs, isLoading, isError } = useImportJobs();

  // ── IMPORT form state.
  const [entityType, setEntityType] = useState<ImportEntityType>("items");
  const [file, setFile] = useState<File | null>(null);

  const upload = useUploadImport();

  const onImport = () => {
    if (!file) {
      retroToast.error(<Trans>Choose a CSV file first.</Trans>);
      return;
    }
    upload.mutate(
      { entityType, file },
      {
        onSuccess: () => {
          retroToast.success(
            <Trans>Import started. Watch its progress below.</Trans>,
          );
          setFile(null);
        },
        onError: () => {
          // Defense in depth (T-14-14): even with the form gated, a 403 (or any
          // failure) surfaces a calm danger toast — never a storm.
          retroToast.error(
            <Trans>Couldn't start the import. Try again.</Trans>,
          );
        },
      },
    );
  };

  // ── EXPORT reuses the existing admin-gated workspace backup blob.
  const exportMutation = useMutation({
    mutationFn: () => {
      if (wsId == null) {
        return Promise.reject(new Error("no workspace selected"));
      }
      return settingsApi.exportWorkspace(wsId, "xlsx");
    },
    onError: () => {
      retroToast.error(<Trans>Couldn't export. Try again.</Trans>);
    },
  });

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`IMPORTS — ${workspaceName}`} titlebarVariant="mint">
        <div className="p-sp-4">
          {/* 1. IMPORT — admin-gated multipart upload (the async job path). */}
          <section className="flex flex-col gap-sp-3 border-b border-table-rule pb-sp-4">
            <h2 className="font-display text-12 uppercase tracking-6 text-fg-muted">
              <Trans>Import from CSV</Trans>
            </h2>
            {isAdmin ? (
              <>
                <RetroSelect
                  label={<Trans>Data type</Trans>}
                  value={entityType}
                  onChange={(e) =>
                    setEntityType(e.target.value as ImportEntityType)
                  }
                >
                  {IMPORT_ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </RetroSelect>
                <RetroFileInput
                  label={<Trans>CSV file</Trans>}
                  accept=".csv,text/csv"
                  multiple={false}
                  maxSize={10 * 1024 * 1024}
                  onChange={(files) => setFile(files[0] ?? null)}
                />
                <div className="flex justify-end">
                  <BevelButton
                    variant="primary"
                    disabled={upload.isPending || !file}
                    onClick={onImport}
                  >
                    {upload.isPending ? (
                      <Trans>Importing…</Trans>
                    ) : (
                      <Trans>Import…</Trans>
                    )}
                  </BevelButton>
                </div>
              </>
            ) : (
              <p className="text-12 text-warn-deep">
                <Trans>Importing data requires admin rights.</Trans>
              </p>
            )}
          </section>

          {/* 2. EXPORT — reuse settingsApi.exportWorkspace (no re-implementation). */}
          <section className="flex flex-col gap-sp-2 border-b border-table-rule py-sp-4">
            <h2 className="font-display text-12 uppercase tracking-6 text-fg-muted">
              <Trans>Export</Trans>
            </h2>
            <p className="text-13 text-fg-ink">
              <Trans>Download a backup copy of this workspace.</Trans>
            </p>
            {isAdmin ? (
              <div className="flex justify-end">
                <BevelButton
                  disabled={exportMutation.isPending || wsId == null}
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
                <Trans>
                  Exporting a workspace backup requires admin rights.
                </Trans>
              </p>
            )}
          </section>

          {/* 3. HISTORY — the import-jobs activity table. */}
          <section className="flex flex-col gap-sp-2 pt-sp-4">
            <h2 className="font-display text-12 uppercase tracking-6 text-fg-muted">
              <Trans>Import history</Trans>
            </h2>

            <ImportHistory
              jobs={jobs}
              isLoading={isLoading}
              isError={isError}
            />
          </section>
        </div>
      </Window>
    </div>
  );
}
