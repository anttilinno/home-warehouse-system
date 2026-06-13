import { describe, expect, it } from "vitest";
import { buildTree } from "./buildTree";

// Mirrors the two real call sites: categories nest via parent_category_id,
// locations via parent_location (Pitfall 6 — DIFFERENT keys, same util).
interface Cat {
  id: string;
  name: string;
  parent_category_id?: string;
}
interface Loc {
  id: string;
  name: string;
  parent_location?: string;
}

const cat = (id: string, name: string, parent?: string): Cat => ({
  id,
  name,
  parent_category_id: parent,
});
const loc = (id: string, name: string, parent?: string): Loc => ({
  id,
  name,
  parent_location: parent,
});

describe("buildTree", () => {
  it("returns [] for empty input", () => {
    expect(buildTree([] as Cat[], (c) => c.parent_category_id)).toEqual([]);
  });

  it("nests a 2-level tree by parent id (categories case)", () => {
    const rows = [cat("a", "Alpha"), cat("a1", "Alpha child", "a")];
    const roots = buildTree(rows, (c) => c.parent_category_id);
    expect(roots).toHaveLength(1);
    expect(roots[0].node.id).toBe("a");
    expect(roots[0].depth).toBe(0);
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].node.id).toBe("a1");
    expect(roots[0].children[0].depth).toBe(1);
  });

  it("nests a 3-level tree with correct depth at each level", () => {
    const rows = [
      cat("a", "Alpha"),
      cat("a1", "Beta", "a"),
      cat("a1x", "Gamma", "a1"),
    ];
    const roots = buildTree(rows, (c) => c.parent_category_id);
    const lvl1 = roots[0].children[0];
    const lvl2 = lvl1.children[0];
    expect(roots[0].depth).toBe(0);
    expect(lvl1.depth).toBe(1);
    expect(lvl2.depth).toBe(2);
    expect(lvl2.node.id).toBe("a1x");
  });

  it("surfaces an orphan (parent id not in the set) at ROOT, not dropped (Pitfall 7)", () => {
    const rows = [
      cat("a", "Alpha"),
      cat("orphan", "Orphan", "archived-parent-not-in-set"),
    ];
    const roots = buildTree(rows, (c) => c.parent_category_id);
    expect(roots).toHaveLength(2);
    expect(roots.map((r) => r.node.id).sort()).toEqual(["a", "orphan"]);
  });

  it("alpha-sorts each level by name (roots and children)", () => {
    const rows = [
      cat("z", "Zebra"),
      cat("a", "Apple"),
      cat("m", "Mango"),
      cat("zc", "Yak", "z"),
      cat("za", "Ant", "z"),
    ];
    const roots = buildTree(rows, (c) => c.parent_category_id);
    expect(roots.map((r) => r.node.name)).toEqual(["Apple", "Mango", "Zebra"]);
    const zebra = roots.find((r) => r.node.id === "z")!;
    expect(zebra.children.map((c) => c.node.name)).toEqual(["Ant", "Yak"]);
  });

  it("works with the locations accessor (parent_location, NOT parent_location_id)", () => {
    const rows = [loc("garage", "Garage"), loc("shelf", "Shelf", "garage")];
    const roots = buildTree(rows, (l) => l.parent_location);
    expect(roots).toHaveLength(1);
    expect(roots[0].node.id).toBe("garage");
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].node.id).toBe("shelf");
  });

  it("treats a wrong-field accessor as no nesting (guards Pitfall 6 regression)", () => {
    const rows = [loc("garage", "Garage"), loc("shelf", "Shelf", "garage")];
    // Accessing the categories field on a location yields undefined → all roots.
    const roots = buildTree(rows, (l) => (l as { parent_category_id?: string }).parent_category_id);
    expect(roots).toHaveLength(2);
  });
});
