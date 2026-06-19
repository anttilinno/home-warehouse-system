import { Trans, useLingui } from "@lingui/react/macro";
import type { StatusPillVariant } from "@/components/retro";
import { RetroEmptyState, RetroTable, StatusPill } from "@/components/retro";
import type { ImportJob, ImportJobStatus } from "@/lib/api/importJobs";

// Phase 14 Plan 05 (SYS-04) — the /imports history section: the import-jobs
// activity table with its loading / error / empty / table switch. Extracted
// verbatim from ImportsPage to lift those four view branches (and the job row
// map) out of the page body. Owns the status-pill mapping and the date helper.

const STATUS_VARIANT: Record<ImportJobStatus, StatusPillVariant> = {
  pending: "info",
  processing: "info",
  completed: "ok",
  failed: "danger",
  cancelled: "warn",
};

const STATUS_LABEL: Record<ImportJobStatus, React.ReactNode> = {
  completed: <Trans>Completed</Trans>,
  failed: <Trans>Failed</Trans>,
  processing: <Trans>Processing</Trans>,
  cancelled: <Trans>Cancelled</Trans>,
  pending: <Trans>Pending</Trans>,
};

function StatusBadge({ status }: Readonly<{ status: ImportJobStatus }>) {
  const variant = STATUS_VARIANT[status] ?? "info";
  return (
    <StatusPill variant={variant}>
      {STATUS_LABEL[status] ?? <Trans>Pending</Trans>}
    </StatusPill>
  );
}

function isoDate(value?: string): string {
  return value ? value.slice(0, 10) : "—";
}

export function ImportHistory({
  jobs,
  isLoading,
  isError,
}: Readonly<{ jobs: ImportJob[]; isLoading: boolean; isError: boolean }>) {
  const { t } = useLingui();

  if (isLoading) {
    return (
      <p className="p-sp-2 font-mono text-13 text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  }

  if (isError) {
    return (
      <p className="p-sp-2 text-13 font-semibold text-danger">
        <Trans>Couldn't load import history. Try again.</Trans>
      </p>
    );
  }

  if (jobs.length === 0) {
    return (
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
    );
  }

  return (
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
            <td className="font-mono text-fg-muted">{job.entity_type}</td>
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
              <span className="text-ok-deep">{job.success_count}</span>
              <span className="text-fg-muted"> / </span>
              <span
                className={
                  job.error_count > 0 ? "text-danger" : "text-fg-muted"
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
  );
}
