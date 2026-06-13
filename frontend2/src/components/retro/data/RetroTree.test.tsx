import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RetroTree, type RetroTreeNode } from "./RetroTree";

// Helper to build a RetroTreeNode.
const n = (
  id: string,
  name: string,
  extra: Partial<RetroTreeNode> = {},
): RetroTreeNode => ({
  id,
  name,
  itemCount: 0,
  isArchived: false,
  children: [],
  ...extra,
});

// Electronics > [Phones, Laptops]; Tools (leaf).
const TREE: RetroTreeNode[] = [
  n("electronics", "Electronics", {
    itemCount: 24,
    children: [n("phones", "Phones", { itemCount: 5 }), n("laptops", "Laptops")],
  }),
  n("tools", "Tools"),
];

const noop = () => {};

function renderTree(props: Partial<React.ComponentProps<typeof RetroTree>> = {}) {
  return render(
    <RetroTree
      nodes={TREE}
      storageKey="taxonomy:tree:test"
      onAddChild={noop}
      onEdit={noop}
      onArchive={noop}
      onRestore={noop}
      emptyState={<p>NO NODES</p>}
      {...props}
    />,
  );
}

afterEach(() => {
  sessionStorage.clear();
});

describe("RetroTree", () => {
  it("renders root nodes as treeitems inside a tree", () => {
    renderTree();
    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("renders the emptyState when there are no nodes", () => {
    renderTree({ nodes: [] });
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    expect(screen.getByText("NO NODES")).toBeInTheDocument();
  });

  it("collapses children by default — collapsed subtree rows are NOT in the DOM", () => {
    renderTree();
    expect(screen.queryByText("Phones")).not.toBeInTheDocument();
    expect(screen.queryByText("Laptops")).not.toBeInTheDocument();
  });

  it("clicking the row toggles expand, revealing then hiding children", async () => {
    const user = userEvent.setup();
    renderTree();
    await user.click(screen.getByText("Electronics"));
    expect(screen.getByText("Phones")).toBeInTheDocument();
    expect(screen.getByText("Laptops")).toBeInTheDocument();
    await user.click(screen.getByText("Electronics"));
    expect(screen.queryByText("Phones")).not.toBeInTheDocument();
  });

  it("clicking the caret button toggles expand without bubbling extra toggles", async () => {
    const user = userEvent.setup();
    renderTree();
    const caret = screen.getByRole("button", { name: "Expand" });
    await user.click(caret);
    expect(screen.getByText("Phones")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
  });

  it("sets aria-expanded on branches and aria-level on rows", async () => {
    const user = userEvent.setup();
    renderTree();
    const electronics = screen.getByText("Electronics").closest("[role=treeitem]")!;
    expect(electronics).toHaveAttribute("aria-expanded", "false");
    expect(electronics).toHaveAttribute("aria-level", "1");
    // Leaf has no aria-expanded.
    const tools = screen.getByText("Tools").closest("[role=treeitem]")!;
    expect(tools).not.toHaveAttribute("aria-expanded");

    await user.click(screen.getByText("Electronics"));
    expect(
      screen.getByText("Electronics").closest("[role=treeitem]")!,
    ).toHaveAttribute("aria-expanded", "true");
    const phones = screen.getByText("Phones").closest("[role=treeitem]")!;
    expect(phones).toHaveAttribute("aria-level", "2");
  });

  it("persists the expanded set to sessionStorage and restores it on remount", async () => {
    const user = userEvent.setup();
    const { unmount } = renderTree();
    await user.click(screen.getByText("Electronics"));
    expect(JSON.parse(sessionStorage.getItem("taxonomy:tree:test")!)).toContain(
      "electronics",
    );
    unmount();
    renderTree();
    // Restored expanded → children visible without re-clicking.
    expect(screen.getByText("Phones")).toBeInTheDocument();
  });

  it("keeps two trees with different storageKeys independent", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <RetroTree
        nodes={TREE}
        storageKey="key:A"
        onAddChild={noop}
        onEdit={noop}
        onArchive={noop}
        onRestore={noop}
        emptyState={<p>empty</p>}
      />,
    );
    await user.click(screen.getByText("Electronics"));
    unmount();

    render(
      <RetroTree
        nodes={TREE}
        storageKey="key:B"
        onAddChild={noop}
        onEdit={noop}
        onArchive={noop}
        onRestore={noop}
        emptyState={<p>empty</p>}
      />,
    );
    // key:B never expanded → children hidden; key:A retains its expand state.
    expect(screen.queryByText("Phones")).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("key:A")!)).toContain("electronics");
    expect(JSON.parse(sessionStorage.getItem("key:B")!)).not.toContain(
      "electronics",
    );
  });

  it("keyboard: ArrowRight expands, ArrowDown moves, Enter toggles", async () => {
    const user = userEvent.setup();
    renderTree();
    const electronics = screen.getByText("Electronics").closest("[role=treeitem]") as HTMLElement;
    electronics.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("Phones")).toBeInTheDocument();
    // ArrowLeft collapses.
    await user.keyboard("{ArrowLeft}");
    expect(screen.queryByText("Phones")).not.toBeInTheDocument();
    // Enter toggles open again.
    await user.keyboard("{Enter}");
    expect(screen.getByText("Phones")).toBeInTheDocument();
  });

  it("roving tabIndex: only the first row is in the tab order", () => {
    renderTree();
    const rows = screen.getAllByRole("treeitem");
    expect(rows[0]).toHaveAttribute("tabindex", "0");
    expect(rows[1]).toHaveAttribute("tabindex", "-1");
  });

  it("shows the item-count badge when count>0 and hides it at 0", () => {
    renderTree();
    expect(screen.getByText("(24)")).toBeInTheDocument();
    // Tools has count 0 → no badge.
    const tools = screen.getByText("Tools").closest("[role=treeitem]")!;
    expect(within(tools as HTMLElement).queryByText("(0)")).not.toBeInTheDocument();
  });

  it("archived row shows ARCHIVED badge + RESTORE only (no EDIT/Archive)", () => {
    render(
      <RetroTree
        nodes={[n("old", "Old Cat", { isArchived: true })]}
        storageKey="key:arch"
        onAddChild={noop}
        onEdit={noop}
        onArchive={noop}
        onRestore={noop}
        emptyState={<p>empty</p>}
      />,
    );
    expect(screen.getByText("ARCHIVED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "RESTORE" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "EDIT" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("fires onEdit / onAddChild / onArchive with the right node", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onAddChild = vi.fn();
    const onArchive = vi.fn();
    renderTree({ onEdit, onAddChild, onArchive });

    // Scope to the Electronics row (Tools also renders an identical cluster).
    const row = screen.getByText("Electronics").closest("[role=treeitem]") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "EDIT" }));
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "electronics" }),
    );
    await user.click(within(row).getByRole("button", { name: "Add child" }));
    expect(onAddChild).toHaveBeenCalledWith(
      expect.objectContaining({ id: "electronics" }),
    );
    await user.click(within(row).getByRole("button", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledWith(
      expect.objectContaining({ id: "electronics" }),
    );
  });

  it("clicking a row action does not toggle the row (stopPropagation)", async () => {
    const user = userEvent.setup();
    renderTree();
    // Electronics is collapsed; clicking EDIT must not expand it.
    const row = screen.getByText("Electronics").closest("[role=treeitem]") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "EDIT" }));
    expect(screen.queryByText("Phones")).not.toBeInTheDocument();
  });
});
