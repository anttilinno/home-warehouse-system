import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { BevelButton } from "../BevelButton";
import { RetroBadge } from "../RetroBadge";
import { getSet, saveSet } from "@/features/taxonomy/lib/safeSessionStorage";

// Phase 10 Plan 01 — recursive Tree atom (data family, alongside RetroTabs).
// The central net-new component for the Taxonomy phase; shared by the
// Categories and Locations tabs. Consumers adapt their domain rows into the
// RetroTreeNode shape (typically via buildTree → a small map). The tree only
// EMITS row actions; the page owns the dialogs.
//
// Expand state persists per `storageKey` (e.g. "taxonomy:tree:categories") to
// sessionStorage via safeSessionStorage — two trees with different keys keep
// INDEPENDENT expand state. A11y follows the W3C APG tree pattern (role=tree/
// treeitem, aria-expanded, aria-level, roving tabIndex, ↑/↓/→/←/Enter/Space).

const INDENT_PX = 20;

export interface RetroTreeNode {
  id: string;
  name: string;
  itemCount: number;
  isArchived: boolean;
  children: RetroTreeNode[];
}

export interface RetroTreeProps {
  nodes: RetroTreeNode[];
  /** sessionStorage key, e.g. "taxonomy:tree:categories". */
  storageKey: string;
  /** Open the create form with this node pre-selected as the parent. */
  onAddChild: (node: RetroTreeNode) => void;
  onEdit: (node: RetroTreeNode) => void;
  /** Archive (categories/locations) — opens the usage-warning confirm. */
  onArchive: (node: RetroTreeNode) => void;
  /** Restore an archived node. */
  onRestore: (node: RetroTreeNode) => void;
  /** Shown when there are no nodes (consumer-supplied RetroEmptyState). */
  emptyState: ReactNode;
}

// A row in document order, carrying depth for indentation + a11y level.
interface FlatRow {
  node: RetroTreeNode;
  depth: number;
}

// Flatten only the VISIBLE rows (collapsed subtrees omitted from the DOM).
function flatten(
  nodes: RetroTreeNode[],
  expanded: Set<string>,
  depth: number,
  out: FlatRow[],
): FlatRow[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children.length > 0 && expanded.has(node.id)) {
      flatten(node.children, expanded, depth + 1, out);
    }
  }
  return out;
}

export function RetroTree({
  nodes,
  storageKey,
  onAddChild,
  onEdit,
  onArchive,
  onRestore,
  emptyState,
}: RetroTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(getSet(storageKey)),
  );
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Persist on every toggle. `expanded` is the only dep — never put non-stable
  // values here (render-loop guard, Pitfall 1).
  useEffect(() => {
    saveSet(storageKey, [...expanded]);
  }, [expanded, storageKey]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expand(id: string) {
    setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  function collapse(id: string) {
    setExpanded((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  if (nodes.length === 0) return <>{emptyState}</>;

  const rows = flatten(nodes, expanded, 0, []);

  function focusRow(id: string) {
    rowRefs.current.get(id)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, row: FlatRow) {
    const { node } = row;
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const idx = rows.findIndex((r) => r.node.id === node.id);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = rows[idx + 1];
        if (next) focusRow(next.node.id);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = rows[idx - 1];
        if (prev) focusRow(prev.node.id);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (hasChildren && !isOpen) expand(node.id);
        else if (hasChildren && isOpen) {
          const first = node.children[0];
          if (first) focusRow(first.id);
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (hasChildren && isOpen) collapse(node.id);
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        if (hasChildren) toggle(node.id);
        break;
      }
    }
  }

  return (
    <div role="tree" className="flex flex-col">
      {rows.map((row, i) => {
        const { node, depth } = row;
        const hasChildren = node.children.length > 0;
        const isOpen = expanded.has(node.id);
        const isFirst = i === 0;

        return (
          <div
            key={node.id}
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={hasChildren ? isOpen : undefined}
            aria-selected={false}
            tabIndex={isFirst ? 0 : -1}
            ref={(el) => {
              if (el) rowRefs.current.set(node.id, el);
              else rowRefs.current.delete(node.id);
            }}
            onKeyDown={(e) => onKeyDown(e, row)}
            onClick={() => hasChildren && toggle(node.id)}
            className="group flex cursor-default items-center gap-sp-1 py-[3px] pr-sp-2 hover:bg-bg-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-[-2px]"
          >
            {/* Indent guides: one 1px sand rule per depth level. */}
            {Array.from(
              { length: depth },
              (_, d) => `${node.id}-guide-${d}`,
            ).map((guideKey) => (
              <span
                key={guideKey}
                aria-hidden
                className="self-stretch border-l border-table-rule"
                style={{ width: INDENT_PX }}
              />
            ))}

            {/* Disclosure caret / leaf glyph. */}
            {hasChildren ? (
              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={isOpen ? "Collapse" : "Expand"}
                title={isOpen ? "Collapse" : "Expand"}
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(node.id);
                }}
                className="w-[12px] shrink-0 text-center text-12 leading-none text-fg-ink"
              >
                {isOpen ? "▾" : "▸"}
              </button>
            ) : (
              <span
                aria-hidden
                className="w-[12px] shrink-0 text-center text-12 leading-none text-fg-faint"
              >
                {"·"}
              </span>
            )}

            {/* Name (archived → muted). */}
            <span
              className={`truncate font-body text-14 ${
                node.isArchived ? "text-fg-muted" : "text-fg-ink"
              }`}
            >
              {node.name}
            </span>

            {/* Item-count badge — hidden at 0 (avoid "(0)" noise). */}
            {node.itemCount > 0 && (
              <RetroBadge variant="neutral" className="font-mono">
                ({node.itemCount})
              </RetroBadge>
            )}

            {node.isArchived && (
              <RetroBadge variant="neutral">ARCHIVED</RetroBadge>
            )}

            {/* Row actions — reveal on hover/focus; always rendered for
                keyboard reach. Cluster stops propagation so it never toggles
                the row. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: stops row-click propagation only, not an interactive control */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops row-click propagation only, not an interactive control */}
            <div
              className="ml-auto flex items-center gap-sp-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              {node.isArchived ? (
                <BevelButton
                  type="button"
                  variant="mint"
                  tabIndex={-1}
                  className="!px-[8px] !py-[2px] !text-11"
                  onClick={() => onRestore(node)}
                >
                  RESTORE
                </BevelButton>
              ) : (
                <>
                  <BevelButton
                    type="button"
                    tabIndex={-1}
                    className="!px-[8px] !py-[2px] !text-11"
                    onClick={() => onEdit(node)}
                  >
                    EDIT
                  </BevelButton>
                  <BevelButton
                    type="button"
                    tabIndex={-1}
                    aria-label="Add child"
                    title="Add child"
                    className="!px-[8px] !py-[2px] !text-11"
                    onClick={() => onAddChild(node)}
                  >
                    {"⊕"}
                  </BevelButton>
                  <BevelButton
                    type="button"
                    tabIndex={-1}
                    aria-label="Archive"
                    title="Archive"
                    className="!px-[8px] !py-[2px] !text-11"
                    onClick={() => onArchive(node)}
                  >
                    {"⌫"}
                  </BevelButton>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
