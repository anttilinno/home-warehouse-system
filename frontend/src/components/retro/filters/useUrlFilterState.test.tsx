import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import type { FilterDef } from "./filterDefs";
import { useUrlFilterState } from "./useUrlFilterState";

const DEFS: FilterDef[] = [
  { key: "category", label: "Category", kind: "enum", options: [] },
  {
    key: "status",
    label: "Status",
    kind: "enum",
    multi: true,
    options: [],
  },
  { key: "insured", label: "Insured", kind: "boolean" },
];

function harness(initialEntries: string[]) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({
      state: useUrlFilterState(DEFS),
      search: useLocation().search,
    }),
    { wrapper },
  );
}

describe("useUrlFilterState", () => {
  it("decodes active values from the URL", () => {
    const { result } = harness(["/items?category=c1&status=a,b&insured=1"]);
    expect(result.current.state.values).toEqual({
      category: ["c1"],
      status: ["a", "b"],
      insured: ["1"],
    });
    expect(result.current.state.hasActive).toBe(true);
  });

  it("set writes the param (multi comma-joined) and resets page=1", () => {
    const { result } = harness(["/items?page=4"]);
    act(() => result.current.state.set("status", ["a", "b"]));
    const p = new URLSearchParams(result.current.search);
    expect(p.get("status")).toBe("a,b");
    expect(p.get("page")).toBe("1");
  });

  it("set with an empty array deletes the param (chip ✕ / clear)", () => {
    const { result } = harness(["/items?category=c1"]);
    act(() => result.current.state.clear("category"));
    expect(new URLSearchParams(result.current.search).has("category")).toBe(
      false,
    );
  });

  it("clearAll wipes the search box + every def but KEEPS sort", () => {
    const { result } = harness([
      "/items?q=drill&category=c1&insured=1&sort=sku&sort_dir=desc&page=3",
    ]);
    act(() => result.current.state.clearAll());
    const p = new URLSearchParams(result.current.search);
    expect(p.has("q")).toBe(false);
    expect(p.has("category")).toBe(false);
    expect(p.has("insured")).toBe(false);
    expect(p.get("sort")).toBe("sku");
    expect(p.get("sort_dir")).toBe("desc");
    expect(p.get("page")).toBe("1");
  });

  it("hasActive is false with no def values (search term is the page's concern)", () => {
    const { result } = harness(["/items?q=drill"]);
    expect(result.current.state.hasActive).toBe(false);
  });
});
