// NOTE: Created as a Rule 3 deviation (blocking dep) by Plan 58-02.
// Plan 58-01 (wave 1 parallel) owns this file canonically — on merge, Plan 01's
// version will replace this one. Spec is identical per 58-RESEARCH §Pattern 1.

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
      self.depth = parent.depth + 1;
      parent.children.push(self);
    } else {
      roots.push(self);
    }
  }
  return roots;
}
