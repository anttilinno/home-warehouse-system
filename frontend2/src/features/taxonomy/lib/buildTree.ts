// Phase 10 Plan 01 — generic flat→nested tree builder. Parity port of legacy
// `buildCategoryTree` (frontend/.../categories/page.tsx:84-110), generalized
// over the parent-id field name because categories nest via
// `parent_category_id` but locations nest via `parent_location` (Pitfall 6 —
// field-name divergence). Call sites pass the accessor:
//   buildTree(categories, (c) => c.parent_category_id)
//   buildTree(locations,  (l) => l.parent_location)   // ⚠ NOT parent_location_id
//
// Orphan handling (Pitfall 7): a row whose parent id is NOT present in the set
// (e.g. parent archived/missing) surfaces at ROOT rather than vanishing.

export interface TreeNode<T> {
  node: T;
  children: TreeNode<T>[];
  depth: number;
}

export function buildTree<T extends { id: string; name: string }>(
  rows: T[],
  parentIdOf: (row: T) => string | null | undefined,
): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  rows.forEach((r) => byId.set(r.id, { node: r, children: [], depth: 0 }));

  const roots: TreeNode<T>[] = [];
  rows.forEach((r) => {
    const self = byId.get(r.id)!;
    const pid = parentIdOf(r);
    const parent = pid ? byId.get(pid) : undefined;
    if (parent) parent.children.push(self);
    else roots.push(self); // orphan (parent archived/missing) → surfaces at root
  });

  // depth + alphabetical sort per level (legacy sortTree).
  const walk = (nodes: TreeNode<T>[], depth: number) => {
    nodes.sort((a, b) => a.node.name.localeCompare(b.node.name));
    nodes.forEach((n) => {
      n.depth = depth;
      walk(n.children, depth + 1);
    });
  };
  walk(roots, 0);
  return roots;
}
