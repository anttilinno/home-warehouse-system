import { Trans } from "@lingui/react/macro";
import {
  BevelButton,
  PixelIcon,
  RetroBadge,
  RetroCheckbox,
  StatusPill,
} from "@/components/retro";
import type { Item } from "@/lib/types";

export interface ItemRowActions {
  onNavigate: (id: string) => void;
  onNavigateEdit: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onRequestDelete: (item: Item) => void;
  onToggleSelect: (id: string) => void;
}

// Phase 7 refactor — one items list row. Extracted verbatim from ItemsListPage
// to lift the per-row branching (selection checkbox, photo thumbnail fallback,
// archived status pill, archived-vs-live action split) out of the page render,
// where it dominated the cyclomatic count. The mouse-only `stopPropagation`
// guards on the checkbox and action cells are preserved.
export function ItemRow({
  item,
  selected,
  onNavigate,
  onNavigateEdit,
  onArchive,
  onRestore,
  onRequestDelete,
  onToggleSelect,
}: Readonly<{ item: Item; selected: boolean } & ItemRowActions>) {
  const archived = item.is_archived ?? false;

  return (
    <tr
      aria-selected={selected}
      onClick={() => onNavigate(item.id)}
      className={`cursor-pointer ${archived ? "text-fg-muted" : ""}`}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested checkbox directly */}
      <td onClick={(e) => e.stopPropagation()}>
        <RetroCheckbox
          label=""
          aria-label={item.name}
          checked={selected}
          onChange={() => onToggleSelect(item.id)}
        />
      </td>
      <td>
        {item.primary_photo_thumbnail_url ? (
          <img
            src={item.primary_photo_thumbnail_url}
            alt=""
            className={`h-[26px] w-[26px] border border-border-ink object-cover ${archived ? "opacity-60" : ""}`}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-[26px] w-[26px] items-center justify-center border border-border-ink bg-bg-panel-2 text-fg-faint"
          >
            <PixelIcon name="image" size={16} />
          </span>
        )}
      </td>
      <td className="font-semibold">{item.name}</td>
      {/* SKU stands in for the second sort header column. */}
      <td className="mono">{item.sku}</td>
      {/* Location/Qty are not on the wire ItemResponse yet. */}
      <td className="text-fg-muted">—</td>
      <td className="mono text-right text-fg-muted">—</td>
      <td>
        {archived ? (
          <RetroBadge variant="neutral">
            <Trans>ARCHIVED</Trans>
          </RetroBadge>
        ) : (
          <StatusPill variant="ok">
            <Trans>IN STOCK</Trans>
          </StatusPill>
        )}
      </td>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: mouse-only guard to stop the row navigate; keyboard users focus the nested action buttons directly */}
      <td className="actions text-right" onClick={(e) => e.stopPropagation()}>
        {archived ? (
          <span className="inline-flex gap-sp-1">
            <BevelButton variant="mint" onClick={() => onRestore(item.id)}>
              <Trans>RESTORE</Trans>
            </BevelButton>
            <BevelButton variant="danger" onClick={() => onRequestDelete(item)}>
              <Trans>DELETE…</Trans>
            </BevelButton>
          </span>
        ) : (
          <span className="inline-flex gap-sp-1">
            <BevelButton onClick={() => onNavigateEdit(item.id)}>
              <Trans>EDIT</Trans>
            </BevelButton>
            <BevelButton onClick={() => onArchive(item.id)}>
              <Trans>ARCHIVE</Trans>
            </BevelButton>
          </span>
        )}
      </td>
    </tr>
  );
}
