'use client';

import { useState } from 'react';
import { useThemedClasses } from '@/lib/themed';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';

// Generic tree node interface
export interface TreeNode {
  id: string;
  name: string;
  description?: string | null;
  children: TreeNode[];
  depth: number;
}

interface TreeViewProps<T extends TreeNode> {
  items: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onAddChild?: (parentId: string) => void;
  expandedByDefault?: boolean;
  disabled?: boolean;
}

interface TreeNodeComponentProps<T extends TreeNode> {
  node: T;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onAddChild?: (parentId: string) => void;
  expandedByDefault?: boolean;
  disabled?: boolean;
  isRetro?: boolean;
}

function TreeNodeComponent<T extends TreeNode>({
  node,
  onEdit,
  onDelete,
  onAddChild,
  expandedByDefault = true,
  disabled = false,
  isRetro = false,
}: TreeNodeComponentProps<T>) {
  const [isExpanded, setIsExpanded] = useState(expandedByDefault);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-2 transition-colors",
          isRetro ? "hover:bg-muted/30" : "rounded-md hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${node.depth * 1.5 + 0.5}rem` }}
      >
        {/* Expand/Collapse Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "p-0.5",
            !hasChildren && "invisible",
            isRetro ? "hover:bg-muted" : "rounded hover:bg-muted"
          )}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isRetro ? (
            <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} className="h-4 w-4 text-muted-foreground" />
          ) : isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Node Name & Description */}
        <div className="flex-1 min-w-0">
          <span className={cn(
            "text-foreground",
            isRetro ? "retro-body font-bold" : "font-medium"
          )}>{node.name}</span>
          {node.description && (
            <span className={cn(
              "ml-2 text-muted-foreground truncate",
              isRetro ? "retro-body" : "text-sm"
            )}>
              — {node.description}
            </span>
          )}
        </div>

        {/* Action Buttons - hidden when disabled (viewer role) */}
        {!disabled && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAddChild && (
              <button
                type="button"
                onClick={() => onAddChild(node.id)}
                className={cn(
                  "text-muted-foreground hover:text-foreground flex items-center justify-center",
                  isRetro ? "w-7 h-7 hover:bg-muted border-2 border-transparent hover:border-border" : "p-1.5 rounded hover:bg-muted"
                )}
                title="Add child"
              >
                {isRetro ? <Icon name="Plus" className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(node)}
                className={cn(
                  "text-muted-foreground hover:text-foreground flex items-center justify-center",
                  isRetro ? "w-7 h-7 hover:bg-muted border-2 border-transparent hover:border-border" : "p-1.5 rounded hover:bg-muted"
                )}
                title="Edit"
              >
                {isRetro ? <Icon name="Pencil" className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node)}
                className={cn(
                  "text-muted-foreground hover:text-destructive flex items-center justify-center",
                  isRetro ? "w-7 h-7 hover:bg-muted border-2 border-transparent hover:border-border" : "p-1.5 rounded hover:bg-muted"
                )}
                title="Delete"
              >
                {isRetro ? <Icon name="Trash2" className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child as T}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              expandedByDefault={expandedByDefault}
              disabled={disabled}
              isRetro={isRetro}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView<T extends TreeNode>({
  items,
  onEdit,
  onDelete,
  onAddChild,
  expandedByDefault = true,
  disabled = false,
}: TreeViewProps<T>) {
  const classes = useThemedClasses();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "divide-y divide-border",
      classes.isRetro ? "border-4 border-border" : "border border-border rounded-lg"
    )}>
      {items.map((item) => (
        <TreeNodeComponent
          key={item.id}
          node={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          expandedByDefault={expandedByDefault}
          disabled={disabled}
          isRetro={classes.isRetro}
        />
      ))}
    </div>
  );
}
