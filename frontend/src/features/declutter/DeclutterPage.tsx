import { Trans, useLingui } from "@lingui/react/macro";
import { useCallback, useMemo, useState } from "react";
import {
  BevelButton,
  PixelIcon,
  RetroBadge,
  type RetroBadgeVariant,
  RetroConfirmDialog,
  RetroEmptyState,
  RetroSelect,
  RetroTable,
  retroToast,
  Window,
} from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { DeclutterGroupBy, DeclutterItem } from "@/lib/api/declutter";
import { formatCents } from "@/lib/utils/money";
import { declutterToCsvBlob, triggerCsvDownload } from "./declutterCsv";
import { useDeclutter, useMarkUsed } from "./hooks/useDeclutter";

// Phase 14 Plan 04 (DECL-01/02) — the /declutter page. An unused-inventory
// analysis table with a score badge + group_by grouping (DECL-01), a
// client-built CSV export and a per-row mark-used (DECL-02). Mirrors
// LoansListPage's max-w container + Window chrome.
//
// Identity note (T-14-13): the per-row "Mark used" action sends row.id — the
// INVENTORY row id (the mark-used path param) — NEVER item_id.
//
// Money note (T-14-12): purchase_price is CENTS and currency_code may be null;
// formatCents is null-safe (a null currency falls back to EUR, never crashes).

const GROUP_VALUES: DeclutterGroupBy[] = ["none", "category", "location"];

/** Score → badge variant: danger (high → declutter soonest) → warn → neutral. */
function scoreVariant(score: number): RetroBadgeVariant {
  if (score >= 70) return "danger";
  if (score >= 40) return "warn";
  return "neutral";
}

interface GroupedRows {
  key: string;
  label: string | null;
  rows: DeclutterItem[];
}

/**
 * Bucket rows by the active grouping. The server already orders by the group
 * key, so this preserves order and emits one section per contiguous group.
 * groupBy="none" → a single null-label section.
 */
function groupRows(
  rows: DeclutterItem[],
  groupBy: DeclutterGroupBy,
): GroupedRows[] {
  if (groupBy === "none") {
    return [{ key: "all", label: null, rows }];
  }
  const out: GroupedRows[] = [];
  const indexByKey = new Map<string, number>();
  for (const row of rows) {
    const label =
      groupBy === "category"
        ? (row.category_name ?? "Uncategorized")
        : (row.location_name ?? "No location");
    const key = `${groupBy}:${label}`;
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = out.length;
      indexByKey.set(key, idx);
      out.push({ key, label, rows: [] });
    }
    out[idx].rows.push(row);
  }
  return out;
}

export function DeclutterPage() {
  const { t } = useLingui();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  const [groupBy, setGroupBy] = useState<DeclutterGroupBy>("none");

  const { rows, isLoading, isError } = useDeclutter({ groupBy });
  const markUsed = useMarkUsed();

  // The inventory row pending a "mark used" confirm (null = closed).
  const [pendingUse, setPendingUse] = useState<DeclutterItem | null>(null);

  const groups = useMemo(() => groupRows(rows, groupBy), [rows, groupBy]);

  const groupLabel = useCallback(
    (value: DeclutterGroupBy): string => {
      if (value === "category") {
        return t`By category`;
      }
      if (value === "location") {
        return t`By location`;
      }
      return t`No grouping`;
    },
    [t],
  );

  const exportCsv = useCallback(() => {
    if (rows.length === 0) {
      retroToast.error(t`Nothing to export.`);
      return;
    }
    triggerCsvDownload(declutterToCsvBlob(rows), "declutter.csv");
  }, [rows, t]);

  const confirmUse = useCallback(() => {
    if (pendingUse) {
      // row.id is the INVENTORY row id (the mark-used path param), NOT item_id.
      markUsed.mutate(pendingUse.id);
    }
    setPendingUse(null);
  }, [pendingUse, markUsed]);

  const showEmpty = !isLoading && !isError && rows.length === 0;

  function renderRow(row: DeclutterItem) {
    return (
      <tr key={row.id}>
        <td className="font-semibold">
          {row.item_name || "—"}
          {row.item_sku && (
            <span className="ml-sp-2 font-mono text-12 text-fg-muted">
              {row.item_sku}
            </span>
          )}
        </td>
        <td>{row.location_name || "—"}</td>
        <td>{row.category_name || "—"}</td>
        <td className="font-mono tabular-nums text-fg-muted">
          {row.days_unused}
        </td>
        <td>
          <RetroBadge variant={scoreVariant(row.score)}>{row.score}</RetroBadge>
        </td>
        <td className="font-mono tabular-nums text-fg-muted">
          {row.purchase_price == null
            ? "—"
            : formatCents(row.purchase_price, row.currency_code ?? undefined)}
        </td>
        <td className="actions text-right">
          <BevelButton onClick={() => setPendingUse(row)}>
            <Trans>Mark used</Trans>
          </BevelButton>
        </td>
      </tr>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`DECLUTTER — ${workspaceName}`}>
        <div className="flex flex-wrap items-end justify-between gap-sp-2 p-sp-3">
          <div className="w-[200px]">
            <RetroSelect
              label={t`Group by`}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as DeclutterGroupBy)}
            >
              {GROUP_VALUES.map((value) => (
                <option key={value} value={value}>
                  {groupLabel(value)}
                </option>
              ))}
            </RetroSelect>
          </div>
          <BevelButton
            onClick={exportCsv}
            disabled={rows.length === 0}
            aria-disabled={rows.length === 0 || undefined}
          >
            <PixelIcon name="download" size={16} /> <Trans>EXPORT CSV</Trans>
          </BevelButton>
        </div>

        {isLoading && (
          <p className="p-sp-4 font-mono text-13 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-13 font-semibold text-danger">
            <Trans>Couldn't load the declutter analysis. Try again.</Trans>
          </p>
        )}

        {showEmpty && (
          <div className="p-sp-4">
            <RetroEmptyState
              eyebrow={<Trans>Declutter</Trans>}
              glyph="trash"
              heading={<Trans>NOTHING TO DECLUTTER</Trans>}
              body={
                <Trans>
                  Every tracked item has been used recently. Items that sit
                  unused will surface here with a declutter score.
                </Trans>
              }
            />
          </div>
        )}

        {!isLoading && !isError && rows.length > 0 && (
          <div className="px-sp-3 pb-sp-3">
            {groups.map((group) => (
              <div key={group.key} className="mb-sp-3">
                {group.label && (
                  <h2 className="mb-sp-1 text-12 font-bold uppercase tracking-8 text-fg-muted">
                    {group.label}
                  </h2>
                )}
                <RetroTable>
                  <thead>
                    <tr>
                      <th>{t`Item`}</th>
                      <th>{t`Location`}</th>
                      <th>{t`Category`}</th>
                      <th>{t`Days unused`}</th>
                      <th>{t`Score`}</th>
                      <th>{t`Price`}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>{group.rows.map(renderRow)}</tbody>
                </RetroTable>
              </div>
            ))}
          </div>
        )}
      </Window>

      <RetroConfirmDialog
        open={pendingUse !== null}
        title={<Trans>MARK USED?</Trans>}
        confirmLabel={<Trans>Mark used</Trans>}
        confirmVariant="mint"
        titlebarVariant="butter"
        onConfirm={confirmUse}
        onCancel={() => setPendingUse(null)}
        onClose={() => setPendingUse(null)}
      >
        <Trans>
          Mark {pendingUse?.item_name ?? t`this item`} as used now? It will drop
          off the declutter list.
        </Trans>
      </RetroConfirmDialog>
    </div>
  );
}
