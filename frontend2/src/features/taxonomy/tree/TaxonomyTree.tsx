import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { useLingui } from "@lingui/react/macro";
import { ChevronRight, ChevronDown } from "../icons";
import { TreeNode, type TreeNodeItem } from "./TreeNode";
import type { TreeNode as TreeNodeData } from "./buildTree";

export interface TaxonomyTreeProps<T extends TreeNodeItem> {
  roots: TreeNodeData<T>[];
  archivedRoots?: TreeNodeData<T>[];
  showArchived: boolean;
  onEdit: (item: T) => void;
  onArchive: (item: T) => void;
  onRestore: (item: T) => void;
  activeEditId?: string | null;
}

interface FlatEntry<T extends TreeNodeItem> {
  node: TreeNodeData<T>;
  parentId: string | null;
}

function flattenVisible<T extends TreeNodeItem>(
  roots: TreeNodeData<T>[],
  expandedIds: Set<string>,
): FlatEntry<T>[] {
  const result: FlatEntry<T>[] = [];
  const walk = (nodes: TreeNodeData<T>[], parentId: string | null) => {
    for (const n of nodes) {
      result.push({ node: n, parentId });
      if (expandedIds.has(n.node.id) && n.children.length) {
        walk(n.children, n.node.id);
      }
    }
  };
  walk(roots, null);
  return result;
}

export function TaxonomyTree<T extends TreeNodeItem>({
  roots,
  archivedRoots = [],
  showArchived,
  onEdit,
  onArchive,
  onRestore,
  activeEditId,
}: TaxonomyTreeProps<T>) {
  const { t } = useLingui();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const showArchivedInline = showArchived;
  const archivedExpanded = showArchivedInline || archivedSectionOpen;

  // Build one combined flat list for keyboard nav (active + optional archived section rows)
  const activeFlat = useMemo(
    () => flattenVisible(roots, expandedIds),
    [roots, expandedIds],
  );
  const archivedFlat = useMemo(
    () =>
      archivedExpanded ? flattenVisible(archivedRoots, expandedIds) : [],
    [archivedRoots, archivedExpanded, expandedIds],
  );
  const visibleIds = useMemo(
    () => [...activeFlat, ...archivedFlat].map((f) => f.node.node.id),
    [activeFlat, archivedFlat],
  );

  const onFocus = useCallback((id: string) => setFocusedId(id), []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLLIElement>, id: string) => {
      const idx = visibleIds.indexOf(id);
      if (idx === -1) return;

      const findNode = (nid: string): TreeNodeData<T> | null => {
        const entries = [...activeFlat, ...archivedFlat];
        return entries.find((e) => e.node.node.id === nid)?.node ?? null;
      };
      const findParent = (nid: string): string | null => {
        const entries = [...activeFlat, ...archivedFlat];
        return entries.find((e) => e.node.node.id === nid)?.parentId ?? null;
      };

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = visibleIds[idx + 1];
          if (next) setFocusedId(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = visibleIds[idx - 1];
          if (prev) setFocusedId(prev);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const n = findNode(id);
          if (!n || n.children.length === 0) break;
          if (!expandedIds.has(id)) {
            onToggle(id);
          } else {
            setFocusedId(n.children[0].node.id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const n = findNode(id);
          if (!n) break;
          if (expandedIds.has(id) && n.children.length > 0) {
            onToggle(id);
          } else {
            const parent = findParent(id);
            if (parent) setFocusedId(parent);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          if (visibleIds[0]) setFocusedId(visibleIds[0]);
          break;
        }
        case "End": {
          e.preventDefault();
          if (visibleIds.length > 0)
            setFocusedId(visibleIds[visibleIds.length - 1]);
          break;
        }
        case "Enter": {
          e.preventDefault();
          const n = findNode(id);
          if (n) onEdit(n.node);
          break;
        }
        default:
          break;
      }
    },
    [activeFlat, archivedFlat, expandedIds, onEdit, onToggle, visibleIds],
  );

  return (
    <ul role="tree" className="flex flex-col gap-[2px]">
      {activeFlat.map(({ node }) => (
        <TreeNode
          key={node.node.id}
          node={node}
          isExpanded={expandedIds.has(node.node.id)}
          expandedIds={expandedIds}
          focusedId={focusedId}
          onToggle={onToggle}
          onFocus={onFocus}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
          onKeyDown={handleKeyDown}
          activeEditId={activeEditId}
        />
      ))}

      {!showArchivedInline && archivedRoots.length > 0 && (
        <li
          role="treeitem"
          aria-expanded={archivedSectionOpen}
          className="flex items-center min-h-[44px] lg:min-h-[36px] gap-sm mt-md border-t border-retro-gray pt-sm"
        >
          <button
            type="button"
            onClick={() => setArchivedSectionOpen((v) => !v)}
            aria-label={
              archivedSectionOpen
                ? t`Collapse ARCHIVED`
                : t`Expand ARCHIVED`
            }
            className="inline-flex items-center gap-sm text-[12px] font-bold uppercase font-mono text-retro-gray cursor-pointer"
          >
            {archivedSectionOpen ? (
              <ChevronDown size={16} aria-hidden="true" />
            ) : (
              <ChevronRight size={16} aria-hidden="true" />
            )}
            {t`ARCHIVED`} ({archivedRoots.length})
          </button>
        </li>
      )}

      {archivedFlat.map(({ node }) => (
        <TreeNode
          key={`archived-${node.node.id}`}
          node={node}
          isExpanded={expandedIds.has(node.node.id)}
          expandedIds={expandedIds}
          focusedId={focusedId}
          onToggle={onToggle}
          onFocus={onFocus}
          onEdit={onEdit}
          onArchive={onArchive}
          onRestore={onRestore}
          onKeyDown={handleKeyDown}
          activeEditId={activeEditId}
        />
      ))}
    </ul>
  );
}
