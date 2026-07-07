import { Trans, useLingui } from "@lingui/react/macro";
import { BevelButton, PixelIcon, RetroBadge } from "@/components/retro";
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
      <td className="actions text-right" onClick={(e) => e.stopPropagation()}>
        <span className="inline-flex gap-sp-1">
          {!archived && (
            <BevelButton onClick={() => onMove(entry)}>
              <Trans>MOVE</Trans>
            </BevelButton>
          )}
          {archived ? (
            <BevelButton variant="mint" onClick={() => onRestore(entry.id)}>
              <Trans>RESTORE</Trans>
            </BevelButton>
          ) : (
            <>
              <BevelButton onClick={() => onNavigateEdit(entry.id)}>
                <Trans>EDIT</Trans>
              </BevelButton>
              <BevelButton onClick={() => onArchive(entry.id)}>
                <Trans>ARCHIVE</Trans>
              </BevelButton>
            </>
          )}
          <BevelButton
            aria-label={t`Movement history`}
            title={t`Movement history`}
            onClick={() => onMovements(entry.id)}
          >
            <PixelIcon name="repeat" size={16} />
          </BevelButton>
          {!archived && (
            <BevelButton
              aria-label={t`Repairs`}
              title={t`Repairs`}
              onClick={() => onRepairs(entry.id)}
            >
              <PixelIcon name="tool-case" size={16} />
            </BevelButton>
          )}
          {!archived && (
            <BevelButton
              aria-label={t`Maintenance`}
              title={t`Maintenance`}
              onClick={() => onMaintenance(entry.id)}
            >
              <PixelIcon name="reload" size={16} />
            </BevelButton>
          )}
        </span>
      </td>
    </tr>
  );
}
