import type { Category } from './api';

export interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;
}

export interface FlatCategoryWithDepth extends Category {
  depth: number;
}

/**
 * Build a tree structure from a flat array of categories
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const categoryMap = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // First pass: create nodes with empty children
  for (const cat of categories) {
    categoryMap.set(cat.id, { ...cat, children: [], depth: 0 });
  }

  // Second pass: build parent-child relationships
  for (const cat of categories) {
    const node = categoryMap.get(cat.id)!;
    if (cat.parent_category_id) {
      const parent = categoryMap.get(cat.parent_category_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  // Third pass: calculate depths
  function setDepth(nodes: CategoryNode[], depth: number) {
    for (const node of nodes) {
      node.depth = depth;
      setDepth(node.children, depth + 1);
    }
  }
  setDepth(roots, 0);

  // Sort children alphabetically at each level
  function sortChildren(nodes: CategoryNode[]) {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  }
  sortChildren(roots);

  return roots;
}

/**
 * Flatten a category tree with depth information (for indented selects)
 */
export function flattenWithDepth(categories: Category[]): FlatCategoryWithDepth[] {
  const tree = buildCategoryTree(categories);
  const result: FlatCategoryWithDepth[] = [];

  function traverse(nodes: CategoryNode[]) {
    for (const node of nodes) {
      result.push({
        id: node.id,
        name: node.name,
        parent_category_id: node.parent_category_id,
        description: node.description,
        created_at: node.created_at,
        depth: node.depth,
      });
      traverse(node.children);
    }
  }

  traverse(tree);
  return result;
}

/**
 * Get all descendant IDs of a category (for exclusion in dropdowns)
 */
export function getDescendantIds(categoryId: string, categories: Category[]): string[] {
  const descendants: string[] = [];
  const childMap = new Map<string, Category[]>();

  // Build parent -> children map
  for (const cat of categories) {
    if (cat.parent_category_id) {
      const children = childMap.get(cat.parent_category_id) || [];
      children.push(cat);
      childMap.set(cat.parent_category_id, children);
    }
  }

  // Recursively collect descendants
  function collect(id: string) {
    const children = childMap.get(id) || [];
    for (const child of children) {
      descendants.push(child.id);
      collect(child.id);
    }
  }

  collect(categoryId);
  return descendants;
}

/**
 * Generate indent prefix for a given depth level
 */
export function getIndentPrefix(depth: number): string {
  if (depth === 0) return '';
  return '\u00A0\u00A0'.repeat(depth) + '└ ';
}
