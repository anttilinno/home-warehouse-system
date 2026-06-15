import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  RetroTable,
  RetroEmptyState,
  RetroBadge,
  type RetroBadgeVariant,
} from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { MyChangeDTO } from "@/lib/api/myChanges";
import { useMyChanges } from "./hooks/useMyChanges";

// Phase 14 Plan 02 — SYS-02 /my-changes. A read-only activity table of the
// authenticated user's OWN recent mutations (GET /my-pending-changes — open to
// all roles, NO 403 gate). Mirrors LoansListPage's outer Window shell without
// tabs/filters/bulk. Server strings render into the table; React escapes them
// (no raw HTML — trust boundary). Empty → a calm RetroEmptyState; error → a
// calm danger line (retry:false in the hook prevents a retry-storm).

// Short entity id for the Entity cell — a UUID truncated to its head, full id
// in the title attr. Avoids a wide column while staying disambiguable.
function shortId(id?: string | null): string {
  if (!id) return "";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function isoDate(value?: string): string {
  return value ? value.slice(0, 10) : "—";
}

// action → pastel variant (create=ok, update=info, delete=danger).
const ACTION_VARIANT: Record<MyChangeDTO["action"], RetroBadgeVariant> = {
  create: "ok",
  update: "info",
  delete: "danger",
};

// status → pastel variant (approved=ok, rejected=danger, pending=warn).
const STATUS_VARIANT: Record<MyChangeDTO["status"], RetroBadgeVariant> = {
  pending: "warn",
  approved: "ok",
  rejected: "danger",
};

export function MyChangesPage() {
  const { t } = useLingui();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();
  const { rows, isLoading, isError } = useMyChanges();

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  const showEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`MY CHANGES — ${workspaceName}`}>
        {isLoading && (
          <p className="p-sp-4 font-mono text-13 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-13 font-semibold text-danger">
            <Trans>Couldn't load your changes. Try again.</Trans>
          </p>
        )}

        {showEmpty && (
          <div className="p-sp-4">
            <RetroEmptyState
              eyebrow={<Trans>My changes</Trans>}
              glyph="◇"
              heading={<Trans>No changes yet</Trans>}
              body={
                <Trans>
                  You haven't requested any changes in this workspace.
                </Trans>
              }
            />
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <RetroTable>
            <thead>
              <tr>
                <th>{t`Entity`}</th>
                <th>{t`Action`}</th>
                <th>{t`Status`}</th>
                <th>{t`Requested`}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((change) => (
                <tr key={change.id}>
                  <td className="font-semibold">
                    {change.entity_type}
                    {change.entity_id && (
                      <span
                        className="ml-sp-2 font-mono text-12 font-normal text-fg-muted"
                        title={change.entity_id}
                      >
                        {shortId(change.entity_id)}
                      </span>
                    )}
                  </td>
                  <td>
                    <RetroBadge variant={ACTION_VARIANT[change.action]}>
                      {change.action}
                    </RetroBadge>
                  </td>
                  <td>
                    <RetroBadge variant={STATUS_VARIANT[change.status]}>
                      {change.status}
                    </RetroBadge>
                  </td>
                  <td className="font-mono tabular-nums text-fg-muted">
                    {isoDate(change.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </RetroTable>
        )}
      </Window>
    </div>
  );
}
