import { type ReactNode, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, Popover, RetroBadge } from "@/components/retro";
import type { Condition, Inventory, InventoryStatus } from "@/lib/types";
import { InlineEditCell } from "./InlineEditCell";

// Phase 7b refactor — one inventory list row. Extracted verbatim from
// InventoryListPage to lift the per-row archived/action branching (the EDIT vs
// RESTORE split, the four `!archived &&` action guards, the inline-edit commit
// closures) out of the page's render, where it dominated the cyclomatic count.
// The mouse-only `stopPropagation` guards on the editable cells are preserved —
// they stop the row-navigate without trapping keyboard focus (a11y biome-ignores
// move with the markup).
export function InventoryRow({
  entry,
  name,
  onNavigateItem,
  onNavigateEdit,
  onMove,
  onArchive,
  onRestore,
  onSetQuantity,
  onSetStatus,
  onSetCondition,
  onMovements,
  onRepairs,
  onMaintenance,
}: Readonly<{
  entry: Inventory;
  name: string | undefined;
  onNavigateItem: (itemId: string) => void;
  onNavigateEdit: (id: string) => void;
  onMove: (entry: Inventory) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onSetQuantity: (id: string, quantity: number) => void;
  onSetStatus: (id: string, status: InventoryStatus) => void;
  onSetCondition: (entry: Inventory, condition: Condition) => void;
  onMovements: (id: string) => void;
  onRepairs: (id: string) => void;
  onMaintenance: (id: string) => void;
}>) {
  const { t } = useLingui();
  const archived = entry.is_archived;
  const expiry = entry.expiration_date ?? entry.warranty_expires;
  const label = name ?? t`this entry`;

  return (
    <tr
      onClick={() => onNavigateItem(entry.item_id)}
      className={`cursor-pointer ${archived ? "text-fg-muted" : ""}`}
    >
      <td className="font-semibold">
        {name ?? <span className="text-fg-muted">—</span>}
      </td>
      <td className="text-fg-muted">—</td>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested inline-edit control directly */}
      <td className="text-right" onClick={(e) => e.stopPropagation()}>
        <InlineEditCell
          field="quantity"
          value={entry.quantity}
          itemName={label}
          disabled={archived}
          onCommit={(quantity) => onSetQuantity(entry.id, quantity)}
        />
      </td>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested inline-edit control directly */}
      <td onClick={(e) => e.stopPropagation()}>
        {archived && (
          <RetroBadge variant="neutral">
            <Trans>ARCHIVED</Trans>
          </RetroBadge>
        )}{" "}
        <InlineEditCell
          field="status"
          value={entry.status}
          itemName={label}
          disabled={archived}
          onCommit={(status) => onSetStatus(entry.id, status)}
        />
      </td>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested inline-edit control directly */}
      <td onClick={(e) => e.stopPropagation()}>
        <InlineEditCell
          field="condition"
          value={entry.condition}
          itemName={label}
          disabled={archived}
          onCommit={(condition) => onSetCondition(entry, condition)}
        />
      </td>
      <td className="mono text-fg-muted">
        {expiry ? expiry.slice(0, 10) : "—"}
      </td>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested action buttons directly */}
      <td
        className="actions text-right max-md:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* One inline action (MOVE, or RESTORE when archived) plus a ⋯ menu:
            five beveled buttons per row overflowed the table (sketch-findings:
            heavy per-row bevels are borderline at table density). Row tap
            still opens the item. */}
        <span className="inline-flex gap-sp-1">
          {archived ? (
            <BevelButton variant="mint" onClick={() => onRestore(entry.id)}>
              <Trans>RESTORE</Trans>
            </BevelButton>
          ) : (
            <BevelButton onClick={() => onMove(entry)}>
              <Trans>MOVE</Trans>
            </BevelButton>
          )}
          <RowMenu
            label={t`More actions for ${label}`}
            actions={[
              ...(archived
                ? []
                : [
                    {
                      key: "edit",
                      label: <Trans>EDIT</Trans>,
                      run: () => onNavigateEdit(entry.id),
                    },
                    {
                      key: "archive",
                      label: <Trans>ARCHIVE</Trans>,
                      run: () => onArchive(entry.id),
                    },
                  ]),
              {
                key: "movements",
                label: <Trans>Movement history</Trans>,
                run: () => onMovements(entry.id),
              },
              ...(archived
                ? []
                : [
                    {
                      key: "repairs",
                      label: <Trans>Repairs</Trans>,
                      run: () => onRepairs(entry.id),
                    },
                    {
                      key: "maintenance",
                      label: <Trans>Maintenance</Trans>,
                      run: () => onMaintenance(entry.id),
                    },
                  ]),
            ]}
          />
        </span>
      </td>
    </tr>
  );
}

// The ⋯ trigger + Popover menu, same idiom as the ItemDetailPage title-bar menu.
function RowMenu({
  label,
  actions,
}: Readonly<{
  label: string;
  actions: { key: string; label: ReactNode; run: () => void }[];
}>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <BevelButton
        ref={ref}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">⋯</span>
      </BevelButton>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        role="menu"
        minWidth={180}
      >
        <div className="flex flex-col gap-sp-1 px-sp-1 py-sp-1">
          {actions.map((a) => (
            <BevelButton
              key={a.key}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                a.run();
              }}
            >
              {a.label}
            </BevelButton>
          ))}
        </div>
      </Popover>
    </>
  );
}
