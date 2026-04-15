import { describe, it, expect } from "vitest";
import { buildTree, collectDescendantIds, type TreeNode } from "../tree/buildTree";

interface Node {
  id: string;
  parent?: string | null;
  name?: string;
}

const parentOf = (n: Node) => n.parent ?? null;

describe("buildTree", () => {
  it("returns [] for empty input", () => {
    expect(buildTree<Node>([], parentOf)).toEqual([]);
  });

  it("returns a single root with depth 0", () => {
    const items: Node[] = [{ id: "a" }];
    const tree = buildTree(items, parentOf);
    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe("a");
    expect(tree[0].children).toEqual([]);
    expect(tree[0].depth).toBe(0);
  });

  it("nests a parent-child relationship with correct depth", () => {
    const items: Node[] = [
      { id: "a" },
      { id: "b", parent: "a" },
    ];
    const tree = buildTree(items, parentOf);
    expect(tree).toHaveLength(1);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].node.id).toBe("b");
    expect(tree[0].children[0].depth).toBe(1);
  });

  it("builds a 3-level chain with depths 0/1/2", () => {
    const items: Node[] = [
      { id: "a" },
      { id: "b", parent: "a" },
      { id: "c", parent: "b" },
    ];
    const tree = buildTree(items, parentOf);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].children[0].depth).toBe(2);
    expect(tree[0].children[0].children[0].node.id).toBe("c");
  });

  it("computes correct depth regardless of input order (child before parent)", () => {
    const items: Node[] = [
      { id: "c", parent: "b" },
      { id: "b", parent: "a" },
      { id: "a" },
    ];
    const tree = buildTree(items, parentOf);
    // Find root 'a'
    const rootA = tree.find((t) => t.node.id === "a")!;
    expect(rootA.depth).toBe(0);
    expect(rootA.children[0].node.id).toBe("b");
    expect(rootA.children[0].depth).toBe(1);
    expect(rootA.children[0].children[0].node.id).toBe("c");
    expect(rootA.children[0].children[0].depth).toBe(2);
  });

  it("treats orphans (missing parent) as roots", () => {
    const items: Node[] = [
      { id: "a" },
      { id: "b", parent: "does-not-exist" },
    ];
    const tree = buildTree(items, parentOf);
    const ids = tree.map((t) => t.node.id).sort();
    expect(ids).toEqual(["a", "b"]);
    expect(tree.every((t) => t.depth === 0)).toBe(true);
  });

  it("preserves sibling order from input", () => {
    const items: Node[] = [
      { id: "p" },
      { id: "c1", parent: "p" },
      { id: "c2", parent: "p" },
      { id: "c3", parent: "p" },
    ];
    const tree = buildTree(items, parentOf);
    expect(tree[0].children.map((c) => c.node.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("handles multiple disjoint roots", () => {
    const items: Node[] = [
      { id: "r1" },
      { id: "r2" },
      { id: "r1c", parent: "r1" },
    ];
    const tree = buildTree(items, parentOf);
    expect(tree).toHaveLength(2);
  });
});

describe("collectDescendantIds", () => {
  it("returns a Set with only the node id for a leaf", () => {
    const leaf: TreeNode<{ id: string }> = {
      node: { id: "leaf" },
      children: [],
      depth: 0,
    };
    const ids = collectDescendantIds(leaf);
    expect(ids).toEqual(new Set(["leaf"]));
  });

  it("returns a Set including root and all descendants", () => {
    const items: Node[] = [
      { id: "a" },
      { id: "b", parent: "a" },
      { id: "c", parent: "b" },
      { id: "d", parent: "a" },
    ];
    const tree = buildTree(items, parentOf);
    const ids = collectDescendantIds(tree[0]);
    expect(ids).toEqual(new Set(["a", "b", "c", "d"]));
  });
});
