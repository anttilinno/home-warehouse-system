import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import {
  BevelButton,
  RetroEmptyState,
  RetroFileInput,
  RetroSelect,
  RetroTable,
  StatusPill,
  Window,
  retroToast,
} from "@/components/retro";
import type { StatusPillVariant } from "@/components/retro";
import { settingsApi } from "@/lib/api/settings";
import {
  IMPORT_ENTITY_TYPES,
  type ImportEntityType,
  type ImportJob,
  type ImportJobStatus,
} from "@/lib/api/importJobs";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { useImportJobs, useUploadImport } from "./hooks/useImportJobs";

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

const STATUS_VARIANT: Record<ImportJobStatus, StatusPillVariant> = {
  pending: "info",
  processing: "info",
  completed: "ok",
  failed: "danger",
  cancelled: "warn",
};

function StatusBadge({ status }: { status: ImportJobStatus }) {
  const variant = STATUS_VARIANT[status] ?? "info";
  return (
    <StatusPill variant={variant}>
      {status === "completed" ? (
        <Trans>Completed</Trans>
      ) : status === "failed" ? (
        <Trans>Failed</Trans>
      ) : status === "processing" ? (
        <Trans>Processing</Trans>
      ) : status === "cancelled" ? (
        <Trans>Cancelled</Trans>
      ) : (
        <Trans>Pending</Trans>
      )}
    </StatusPill>
  );
}

function isoDate(value?: string): string {
  return value ? value.slice(0, 10) : "—";
}

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

            {isLoading && (
              <p className="p-sp-2 font-mono text-13 text-fg-muted">
                <Trans>Loading…</Trans>
              </p>
            )}

            {isError && (
              <p className="p-sp-2 text-13 font-semibold text-danger">
                <Trans>Couldn't load import history. Try again.</Trans>
              </p>
            )}

            {!isLoading && !isError && jobs.length === 0 && (
              <RetroEmptyState
                eyebrow={<Trans>Imports</Trans>}
                glyph="◇"
                heading={<Trans>NO IMPORTS YET</Trans>}
                body={
                  <Trans>
                    Imported files show up here with their progress and results.
                  </Trans>
                }
              />
            )}

            {!isLoading && !isError && jobs.length > 0 && (
              <RetroTable>
                <thead>
                  <tr>
                    <th>{t`File`}</th>
                    <th>{t`Type`}</th>
                    <th>{t`Status`}</th>
                    <th>{t`Progress`}</th>
                    <th>{t`Rows`}</th>
                    <th>{t`Created`}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job: ImportJob) => (
                    <tr key={job.id}>
                      <td className="font-semibold">{job.file_name}</td>
                      <td className="font-mono text-fg-muted">
                        {job.entity_type}
                      </td>
                      <td>
                        <StatusBadge status={job.status} />
                        {job.status === "failed" && job.error_message && (
                          <span className="ml-sp-2 text-12 text-danger">
                            {job.error_message}
                          </span>
                        )}
                      </td>
                      <td className="font-mono tabular-nums text-fg-muted">
                        {job.progress}%
                      </td>
                      <td className="font-mono tabular-nums">
                        <span className="text-ok-deep">
                          {job.success_count}
                        </span>
                        <span className="text-fg-muted"> / </span>
                        <span
                          className={
                            job.error_count > 0
                              ? "text-danger"
                              : "text-fg-muted"
                          }
                        >
                          {job.error_count}
                        </span>
                      </td>
                      <td className="font-mono tabular-nums text-fg-muted">
                        {isoDate(job.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </RetroTable>
            )}
          </section>
        </div>
      </Window>
    </div>
  );
}
