import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { BevelButton, StatusPill } from "@/components/retro";
import { inventoryApi } from "@/lib/api/inventory";
import { usePickerOptions } from "@/features/inventory/hooks/usePickerOptions";
import { MoveDialog } from "@/features/inventory/components/MoveDialog";
import {
  CONDITION_LABEL,
  CONDITION_VARIANT,
  STATUS_LABEL,
  STATUS_VARIANT,
} from "@/features/inventory/inventoryEnums";
import type { Inventory } from "@/lib/types";

// Phase 7b Plan 05 — the real per-item inventory panel (INV-08). Replaces the
// Phase 7 `InventoryPanelStub` AT THE EXACT side-rail slot (UI-SPEC §7) without
// relayout: same `aria-label="Inventory"` named region, swapped contents.
//
// Backed by `GET /inventory/by-item/{item_id}` (bare { items } unwrap — Pitfall
// 1). Populated state: an `IN STOCK {total}` summary (client-summed quantities)
// + one row per entry (×qty + Status/Condition pills + location/container path +
// optional expiry chip + MOVE/EDIT actions). Empty state KEEPS the stub's
// recessed `bg-bg-panel-2 bevel-sunken` visual, now with an `⊕ ADD ENTRY` CTA.
//
// MOVE reuses the §4 MoveDialog (Plan 03) — location-only relocate, no new write
// path. EDIT links to `/inventory/{id}/edit`. ⊕ ADD prefills the entry form with
// this item (`?item={itemId}`, mirroring the Phase 7 `?barcode=` prefill idiom).

export interface InventoryPanelProps {
  wsId: string;
  itemId: string;
}

// Bevel-styled <Link>: BevelButton is a plain <button> (no polymorphic `as`),
// so navigational affordances (ADD / EDIT) reuse its bevel chrome on an anchor
// to stay real links (right-click/open-in-tab + role="link" for the spec).
const BEVEL_LINK =
  "inline-flex cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink px-[8px] py-[2px] font-body text-[11px] font-semibold uppercase tracking-[0.04em] bg-bg-panel text-fg-ink bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed";

/** Format an RFC3339 date to a days-ahead chip (UI-SPEC §5 near/past rule). */
function expiryChip(iso: string): {
  label: string;
  past: boolean;
  title: string;
} | null {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  // Normalize both to UTC midnight so a same-day expiry reads `in 0d`.
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const t1 = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  const days = Math.round((t1 - t0) / msPerDay);
  const past = days < 0;
  const label = past ? `⚠ −${Math.abs(days)}d` : `in ${days}d`;
  return { label, past, title: iso };
}

export function InventoryPanel({ wsId, itemId }: InventoryPanelProps) {
  const entriesQuery = useQuery({
    queryKey: ["inventory", wsId, "by-item", itemId],
    queryFn: () => inventoryApi.byItem(wsId, itemId),
    enabled: Boolean(wsId) && Boolean(itemId),
  });

  // Reuse the picker-options hook for location/container name resolution — it is
  // already cached workspace-wide, so the move dialog and the panel share it.
  const { locations, containers } = usePickerOptions();

  const entries = useMemo(
    () => entriesQuery.data ?? [],
    [entriesQuery.data],
  );

  // Local move-target: the entry currently being relocated (null = dialog closed).
  const [moveEntry, setMoveEntry] = useState<Inventory | null>(null);

  const total = useMemo(
    () => entries.reduce((sum, e) => sum + e.quantity, 0),
    [entries],
  );

  const newHref = `/inventory/new?item=${itemId}`;

  function locationLabel(id?: string): string | undefined {
    if (!id) return undefined;
    return locations.find((o) => o.id === id)?.label;
  }
  function containerLabel(id?: string): string | undefined {
    if (!id) return undefined;
    return containers.find((o) => o.id === id)?.label;
  }

  // ── Loading: a quiet recessed strip (no flash of an "IN STOCK 0" header).
  if (entriesQuery.isLoading) {
    return (
      <section
        aria-label="Inventory"
        className="flex flex-col items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 bevel-sunken px-sp-4 py-sp-5 text-center"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          <Trans>INVENTORY</Trans>
        </p>
        <p className="font-mono text-[12px] text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      </section>
    );
  }

  // ── Empty state: keep the stub's recessed visual + a new ⊕ ADD ENTRY CTA.
  if (entries.length === 0) {
    return (
      <section
        aria-label="Inventory"
        className="flex flex-col items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 bevel-sunken px-sp-4 py-sp-5 text-center"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          <Trans>INVENTORY</Trans>
        </p>
        <span
          aria-hidden="true"
          className="text-[32px] leading-none text-fg-faint"
        >
          ◇
        </span>
        <p className="text-[14px] text-fg-muted">
          <Trans>No stock entries yet.</Trans>
        </p>
        <Link to={newHref} className={BEVEL_LINK}>
          <Trans>⊕ ADD ENTRY</Trans>
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-label="Inventory"
      className="flex flex-col gap-sp-3 border-2 border-border-ink bg-bg-panel-2 p-sp-3"
    >
      {/* Header: INVENTORY eyebrow + ⊕ ADD. */}
      <div className="flex items-center justify-between gap-sp-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          <Trans>INVENTORY</Trans>
        </p>
        <Link to={newHref} className={BEVEL_LINK}>
          <Trans>⊕ ADD</Trans>
        </Link>
      </div>

      {/* IN STOCK total summary. */}
      <div className="flex items-baseline gap-sp-2 border-b-2 border-border-ink pb-sp-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          <Trans>IN STOCK</Trans>
        </span>
        <span className="font-display text-[16px] font-bold text-fg-ink">
          {total}
        </span>
      </div>

      {/* Entry rows. */}
      <ul className="flex flex-col gap-sp-2">
        {entries.map((entry) => {
          const loc = locationLabel(entry.location_id);
          const ct = containerLabel(entry.container_id);
          const path = loc
            ? ct
              ? `${loc} / ${ct}`
              : loc
            : "—";
          const expiryIso = entry.expiration_date ?? entry.warranty_expires;
          const chip = expiryIso ? expiryChip(expiryIso) : null;
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-sp-2 border-2 border-border-ink bg-bg-panel p-sp-3"
            >
              {/* Line 1: qty + status + condition pills. */}
              <div className="flex flex-wrap items-center gap-sp-1">
                <span className="font-mono text-[14px] font-semibold tabular-nums text-fg-ink">
                  ×{entry.quantity}
                </span>
                <StatusPill variant={STATUS_VARIANT[entry.status]}>
                  {STATUS_LABEL[entry.status]}
                </StatusPill>
                <StatusPill variant={CONDITION_VARIANT[entry.condition]}>
                  {CONDITION_LABEL[entry.condition]}
                </StatusPill>
              </div>

              {/* Line 2: location / container path. */}
              <p
                data-testid={`entry-path-${entry.id}`}
                className={`text-[14px] ${loc ? "text-fg-ink" : "text-fg-muted"}`}
              >
                {loc ? (
                  <Link
                    to={`/locations/${entry.location_id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {path}
                  </Link>
                ) : (
                  path
                )}
              </p>

              {/* Line 3 (conditional): expiry / warranty chip. */}
              {chip && (
                <span
                  title={chip.title}
                  className={`w-fit rounded-chip px-[6px] py-[1px] font-mono text-[11px] ${
                    chip.past
                      ? "bg-danger-bg text-danger"
                      : "bg-titlebar-butter text-fg-ink"
                  }`}
                >
                  {chip.label}
                </span>
              )}

              {/* Row actions: MOVE + EDIT. */}
              <div className="flex items-center gap-sp-1">
                <BevelButton
                  className="!px-[8px] !py-[2px] !text-[11px]"
                  onClick={() => setMoveEntry(entry)}
                >
                  <Trans>MOVE</Trans>
                </BevelButton>
                <Link
                  to={`/inventory/${entry.id}/edit`}
                  className={BEVEL_LINK}
                >
                  <Trans>EDIT</Trans>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Move dialog (whole-entry relocate) — Plan 03 §4. */}
      {moveEntry && (
        <MoveDialog
          open
          onClose={() => setMoveEntry(null)}
          entry={moveEntry}
          locationOptions={locations}
          containerOptions={containers}
        />
      )}
    </section>
  );
}
