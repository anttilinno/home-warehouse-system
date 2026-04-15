import { type KeyboardEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronRight, ChevronDown, Pencil, Archive, Undo2 } from "lucide-react";
import { RetroBadge } from "@/components/retro";
import type { TreeNode as TreeNodeData } from "./buildTree";

export interface TreeNodeItem {
  id: string;
  name: string;
  is_archived?: boolean;
  short_code?: string;
}

export interface TreeNodeProps<T extends TreeNodeItem> {
  node: TreeNodeData<T>;
  isExpanded: boolean;
  expandedIds: Set<string>;
  focusedId: string | null;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
  onEdit: (item: T) => void;
  onArchive: (item: T) => void;
  onRestore: (item: T) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLLIElement>, id: string) => void;
  activeEditId?: string | null;
}

export function TreeNode<T extends TreeNodeItem>({
  node,
  isExpanded,
  expandedIds,
  focusedId,
  onToggle,
  onFocus,
  onEdit,
  onArchive,
  onRestore,
  onKeyDown,
  activeEditId,
}: TreeNodeProps<T>) {
  const { t } = useLingui();
  const item = node.node;
  const hasChildren = node.children.length > 0;
  const archived = !!item.is_archived;
  const isActive = activeEditId === item.id;
  const isFocused = focusedId === item.id;

  // depth * 24 drives indentation per UI-SPEC
  const indent = node.depth * 24;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isFocused}
      tabIndex={isFocused ? 0 : -1}
      onFocus={() => onFocus(item.id)}
      onKeyDown={(e) => onKeyDown?.(e, item.id)}
      className={`flex items-center min-h-[44px] lg:min-h-[36px] gap-sm ${
        isActive ? "border-l-2 border-retro-amber" : ""
      }`}
      style={{ paddingInlineStart: `${indent}px` }}
      data-tree-node-id={item.id}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={
            isExpanded ? t`Collapse ${item.name}` : t`Expand ${item.name}`
          }
          onClick={() => onToggle(item.id)}
          className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </button>
      ) : (
        <span className="min-w-[44px] lg:min-w-[36px] inline-block" aria-hidden="true" />
      )}

      <span
        className={`flex-1 text-[14px] ${
          archived ? "line-through text-retro-gray" : "text-retro-ink"
        }`}
      >
        <span className="font-sans">{item.name}</span>
        {item.short_code && (
          <span className="font-mono text-[12px] ml-sm text-retro-gray">
            ({item.short_code})
          </span>
        )}
      </span>

      {archived && (
        <RetroBadge variant="neutral" className="font-mono">
          {t`ARCHIVED`}
        </RetroBadge>
      )}

      <div className="flex items-center gap-xs">
        <button
          type="button"
          aria-label={t`Edit ${item.name}`}
          onClick={() => onEdit(item)}
          disabled={isActive}
          className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer disabled:opacity-50"
        >
          <Pencil size={14} aria-hidden="true" />
          <span className="hidden lg:inline">{t`EDIT`}</span>
        </button>
        {!archived ? (
          <button
            type="button"
            aria-label={t`Archive ${item.name}`}
            onClick={() => onArchive(item)}
            className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
          >
            <Archive size={14} aria-hidden="true" />
            <span className="hidden lg:inline">{t`ARCHIVE`}</span>
          </button>
        ) : (
          <button
            type="button"
            aria-label={t`Restore ${item.name}`}
            onClick={() => onRestore(item)}
            className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer"
          >
            <Undo2 size={14} aria-hidden="true" />
            <span className="hidden lg:inline">{t`RESTORE`}</span>
          </button>
        )}
      </div>

    </li>
  );
}
