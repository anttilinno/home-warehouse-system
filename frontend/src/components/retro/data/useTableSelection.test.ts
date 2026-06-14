import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTableSelection } from "./useTableSelection";

interface Row {
  id: string;
  name: string;
}

const rowsAZ: Row[] = [
  { id: "a", name: "Apple" },
  { id: "b", name: "Banana" },
  { id: "c", name: "Cherry" },
  { id: "d", name: "Date" },
  { id: "e", name: "Elderberry" },
];

// A click event shape that only needs the modifier flags onRowClick reads.
function click(
  mods: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean } = {},
) {
  return {
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    ...mods,
  } as Pick<
    React.MouseEvent,
    "shiftKey" | "metaKey" | "ctrlKey"
  > as React.MouseEvent;
}

describe("useTableSelection", () => {
  it("plain click selects a single id, clears any prior selection, sets the anchor", () => {
    const { result } = renderHook(() => useTableSelection(rowsAZ));

    act(() => result.current.onRowClick("b", click()));
    expect([...result.current.selected]).toEqual(["b"]);

    // A second plain click clears the first and selects only the new id.
    act(() => result.current.onRowClick("d", click()));
    expect([...result.current.selected]).toEqual(["d"]);
  });

  it("Shift+Click after an anchor range-selects between anchor and target by current order", () => {
    const { result } = renderHook(() => useTableSelection(rowsAZ));

    act(() => result.current.onRowClick("b", click())); // anchor = b
    act(() => result.current.onRowClick("d", click({ shiftKey: true })));

    // Range b..d inclusive, regardless of click direction.
    expect(new Set(result.current.selected)).toEqual(new Set(["b", "c", "d"]));
  });

  it("Shift+Click works upward (target before anchor)", () => {
    const { result } = renderHook(() => useTableSelection(rowsAZ));

    act(() => result.current.onRowClick("d", click())); // anchor = d
    act(() => result.current.onRowClick("b", click({ shiftKey: true })));

    expect(new Set(result.current.selected)).toEqual(new Set(["b", "c", "d"]));
  });

  it("THE critical test: a selected range survives a re-sort/re-filter (id-keyed, not index-keyed)", () => {
    let rows = rowsAZ;
    const { result, rerender } = renderHook(() => useTableSelection(rows));

    act(() => result.current.onRowClick("b", click())); // anchor = b
    act(() => result.current.onRowClick("d", click({ shiftKey: true })));
    expect(new Set(result.current.selected)).toEqual(new Set(["b", "c", "d"]));

    // Re-sort the rows into a completely different order (reverse) and rerender.
    rows = [...rowsAZ].reverse();
    rerender();

    // The SAME ids stay selected — the range did not "jump" to new positions.
    expect(new Set(result.current.selected)).toEqual(new Set(["b", "c", "d"]));
  });

  it("Ctrl/Cmd+Click toggles an id in/out and moves the anchor to it", () => {
    const { result } = renderHook(() => useTableSelection(rowsAZ));

    act(() => result.current.onRowClick("b", click())); // selected {b}
    act(() => result.current.onRowClick("d", click({ metaKey: true })));
    expect(new Set(result.current.selected)).toEqual(new Set(["b", "d"]));

    // Ctrl toggles the same id back out.
    act(() => result.current.onRowClick("d", click({ ctrlKey: true })));
    expect(new Set(result.current.selected)).toEqual(new Set(["b"]));

    // Anchor moved to the last ctrl/meta target: a shift-range now extends from it.
    act(() => result.current.onRowClick("b", click())); // anchor = b
    act(() => result.current.onRowClick("c", click({ metaKey: true }))); // anchor = c, {b,c}
    act(() => result.current.onRowClick("e", click({ shiftKey: true }))); // range c..e
    expect(new Set(result.current.selected)).toEqual(
      new Set(["b", "c", "d", "e"]),
    );
  });

  it("clear() empties the Set and nulls the anchor", () => {
    const { result } = renderHook(() => useTableSelection(rowsAZ));

    act(() => result.current.onRowClick("b", click()));
    act(() => result.current.onRowClick("d", click({ shiftKey: true })));
    expect(result.current.selected.size).toBe(3);

    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);

    // After clear, a shift+click has no anchor → behaves as a plain single select.
    act(() => result.current.onRowClick("c", click({ shiftKey: true })));
    expect([...result.current.selected]).toEqual(["c"]);
  });

  it("Shift+Click with no prior anchor behaves as a plain single select (no crash)", () => {
    const { result } = renderHook(() => useTableSelection(rowsAZ));

    act(() => result.current.onRowClick("c", click({ shiftKey: true })));
    expect([...result.current.selected]).toEqual(["c"]);
  });
});
