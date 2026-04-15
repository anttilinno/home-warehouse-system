/**
 * Pure tree-building utilities for taxonomy features (categories, locations).
 *
 * buildTree transforms a flat list of items with parent references into a
 * nested TreeNode[] with correct depth values regardless of input order.
 *
 * collectDescendantIds walks a TreeNode subtree and returns a Set containing
 * the root's id plus all descendant ids — used to mask a node's descendants
 * from parent-picker menus (prevents cyclic parents).
 */

export interface TreeNode<T> {
  node: T;
  children: TreeNode<T>[];
  depth: number;
}

export function buildTree<T extends { id: string }>(
  items: T[],
  parentOf: (t: T) => string | null | undefined,
): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  items.forEach((n) => byId.set(n.id, { node: n, children: [], depth: 0 }));

  const roots: TreeNode<T>[] = [];
  for (const n of items) {
    const pid = parentOf(n) ?? null;
    const self = byId.get(n.id)!;
    if (pid && byId.has(pid)) {
      const parent = byId.get(pid)!;
      parent.children.push(self);
    } else {
      roots.push(self);
    }
  }

  // Second pass: walk roots to assign depth correctly regardless of input order.
  const assignDepth = (node: TreeNode<T>, d: number) => {
    node.depth = d;
    node.children.forEach((c) => assignDepth(c, d + 1));
  };
  roots.forEach((r) => assignDepth(r, 0));

  return roots;
}

export function collectDescendantIds(root: TreeNode<{ id: string }>): Set<string> {
  const ids = new Set<string>();
  const stack: TreeNode<{ id: string }>[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    ids.add(cur.node.id);
    cur.children.forEach((c) => stack.push(c));
  }
  return ids;
}
