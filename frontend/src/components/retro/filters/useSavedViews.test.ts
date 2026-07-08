import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ALL_VIEW_ID,
  snapshotIsEmpty,
  toViewSnapshot,
  useSavedViews,
  viewDiff,
} from "./useSavedViews";

afterEach(() => localStorage.clear());

describe("toViewSnapshot", () => {
  it("keeps filter params and drops q/sort/page", () => {
    const p = new URLSearchParams(
      "category=c1&insured=1&terms=drill,angle&q=live&sort=name&sort_dir=asc&page=3",
    );
    expect(toViewSnapshot(p)).toEqual({
      category: "c1",
      insured: "1",
      terms: "drill,angle",
    });
  });

  it("drops empty values", () => {
    expect(toViewSnapshot(new URLSearchParams("category="))).toEqual({});
  });
});

describe("viewDiff", () => {
  it("is order-insensitive across multi-value + term lists", () => {
    expect(viewDiff({ terms: "drill,angle" }, { terms: "angle,drill" })).toBe(
      false,
    );
    expect(viewDiff({ cat: "a,b" }, { cat: "b,a" })).toBe(false);
  });

  it("ignores empty-string keys", () => {
    expect(viewDiff({ category: "c1", x: "" }, { category: "c1" })).toBe(false);
  });

  it("detects a real difference", () => {
    expect(viewDiff({ category: "c1" }, { category: "c2" })).toBe(true);
    expect(viewDiff({ terms: "drill" }, {})).toBe(true);
  });
});

describe("snapshotIsEmpty", () => {
  it("treats blank/absent values as empty", () => {
    expect(snapshotIsEmpty({})).toBe(true);
    expect(snapshotIsEmpty({ a: "" })).toBe(true);
    expect(snapshotIsEmpty({ a: "x" })).toBe(false);
  });
});

const OPTS = {
  storageKey: "views/v2",
  legacyKey: "filters/v1",
};

describe("useSavedViews", () => {
  it("migrates v1 presets (stripping q/sort) and deletes the v1 key", () => {
    localStorage.setItem(
      "filters/v1",
      JSON.stringify([
        {
          id: "old",
          name: "Insured tools",
          filters: { category: "c1", insured: "1", q: "x", sort: "name" },
          createdAt: "2020-01-01",
        },
      ]),
    );
    const { result } = renderHook(() =>
      useSavedViews({ ...OPTS, current: {} }),
    );
    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].snapshot).toEqual({
      category: "c1",
      insured: "1",
    });
    expect(localStorage.getItem("filters/v1")).toBeNull();
  });

  it("saves, updates, and deletes views; tracks the active view", () => {
    const { result, rerender } = renderHook(
      ({ current }) => useSavedViews({ ...OPTS, current }),
      {
        initialProps: { current: { category: "c1" } as Record<string, string> },
      },
    );

    let saved!: { id: string };
    act(() => {
      saved = result.current.saveView("Tools");
    });
    // Exact match → active + clean.
    expect(result.current.activeViewId).toBe(saved.id);
    expect(result.current.isDirty).toBe(false);

    // Drift the current state off the saved snapshot → dirty, still "active".
    rerender({ current: { category: "c2" } });
    expect(result.current.activeViewId).toBe(saved.id);
    expect(result.current.isDirty).toBe(true);

    // Update folds the new state into the view → clean again.
    act(() => result.current.updateView(saved.id));
    expect(result.current.isDirty).toBe(false);

    // Delete falls back to ALL.
    act(() => result.current.deleteView(saved.id));
    expect(result.current.views).toHaveLength(0);
    expect(result.current.activeViewId).toBe(ALL_VIEW_ID);
  });

  it("is not dirty on an empty current with no active view", () => {
    const { result } = renderHook(() =>
      useSavedViews({ ...OPTS, current: {} }),
    );
    expect(result.current.activeViewId).toBe(ALL_VIEW_ID);
    expect(result.current.isDirty).toBe(false);
  });
});
