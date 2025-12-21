'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import type { CategoryNode } from '@/lib/category-utils';

interface TreeViewProps {
  items: CategoryNode[];
  onEdit?: (item: CategoryNode) => void;
  onDelete?: (item: CategoryNode) => void;
  onAddChild?: (parentId: string) => void;
  expandedByDefault?: boolean;
}

interface TreeNodeProps {
  node: CategoryNode;
  onEdit?: (item: CategoryNode) => void;
  onDelete?: (item: CategoryNode) => void;
  onAddChild?: (parentId: string) => void;
  expandedByDefault?: boolean;
}

function TreeNode({ node, onEdit, onDelete, onAddChild, expandedByDefault = true }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(expandedByDefault);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
        style={{ paddingLeft: `${node.depth * 1.5 + 0.5}rem` }}
      >
        {/* Expand/Collapse Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`p-0.5 rounded hover:bg-muted ${!hasChildren ? 'invisible' : ''}`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Category Name & Description */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-foreground">{node.name}</span>
          {node.description && (
            <span className="ml-2 text-sm text-muted-foreground truncate">
              — {node.description}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddChild && (
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Add subcategory"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(node)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(node)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              expandedByDefault={expandedByDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({
  items,
  onEdit,
  onDelete,
  onAddChild,
  expandedByDefault = true,
}: TreeViewProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="border border-border rounded-lg divide-y divide-border">
      {items.map((item) => (
        <TreeNode
          key={item.id}
          node={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          expandedByDefault={expandedByDefault}
        />
      ))}
    </div>
  );
}
