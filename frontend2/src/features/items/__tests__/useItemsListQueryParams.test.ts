import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { createElement, type ReactNode } from "react";
import { useItemsListQueryParams } from "../filters/useItemsListQueryParams";

function wrapperFor(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries }, children);
  };
}

describe("useItemsListQueryParams — read", () => {
  it("returns defaults when URL is empty", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor(["/items"]),
    });
    expect(result.current[0]).toEqual({
      q: "",
      category: null,
      sort: "name",
      sortDir: "asc",
      archived: false,
      page: 1,
    });
  });

  it("parses all filter params from URL", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor([
        "/items?q=drill&category=cat-1&sort=created_at&dir=desc&archived=1&page=3",
      ]),
    });
    expect(result.current[0]).toEqual({
      q: "drill",
      category: "cat-1",
      sort: "created_at",
      sortDir: "desc",
      archived: true,
      page: 3,
    });
  });
});

describe("useItemsListQueryParams — write", () => {
  it("page is reset when a non-page filter changes (Pitfall 8)", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor(["/items?page=5"]),
    });
    expect(result.current[0].page).toBe(5);
    act(() => {
      result.current[1]({ q: "drill" });
    });
    expect(result.current[0].page).toBe(1);
    expect(result.current[0].q).toBe("drill");
  });

  it("explicit page update is preserved", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor(["/items"]),
    });
    act(() => {
      result.current[1]({ page: 3 });
    });
    expect(result.current[0].page).toBe(3);
  });

  it("setting q to empty deletes the URL key", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor(["/items?q=drill"]),
    });
    act(() => {
      result.current[1]({ q: "" });
    });
    expect(result.current[0].q).toBe("");
  });

  it("setting category to null deletes the URL key", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor(["/items?category=cat-1"]),
    });
    act(() => {
      result.current[1]({ category: null });
    });
    expect(result.current[0].category).toBeNull();
  });

  it("setting archived to false deletes the URL key", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor(["/items?archived=1"]),
    });
    act(() => {
      result.current[1]({ archived: false });
    });
    expect(result.current[0].archived).toBe(false);
  });
});

describe("useItemsListQueryParams — clearFilters", () => {
  it("removes q/category/archived/page but preserves sort/dir", () => {
    const { result } = renderHook(() => useItemsListQueryParams(), {
      wrapper: wrapperFor([
        "/items?q=drill&category=cat-1&archived=1&sort=created_at&dir=desc&page=3",
      ]),
    });
    act(() => {
      result.current[2]();
    });
    const state = result.current[0];
    expect(state.q).toBe("");
    expect(state.category).toBeNull();
    expect(state.archived).toBe(false);
    expect(state.page).toBe(1);
    // sort + dir preserved
    expect(state.sort).toBe("created_at");
    expect(state.sortDir).toBe("desc");
  });
});
