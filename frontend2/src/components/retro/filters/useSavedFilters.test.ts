import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSavedFilters } from "./useSavedFilters";

const KEY = "test-saved-filters";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useSavedFilters", () => {
  it("saveFilter persists a {id,name,filters,createdAt} preset to localStorage; reading back returns it", () => {
    const { result } = renderHook(() => useSavedFilters({ storageKey: KEY }));

    act(() => {
      result.current.saveFilter("Low stock", { qtyLt: 5 });
    });

    expect(result.current.savedFilters).toHaveLength(1);
    const preset = result.current.savedFilters[0];
    expect(preset.name).toBe("Low stock");
    expect(preset.filters).toEqual({ qtyLt: 5 });
    expect(preset.id).toBeTruthy();
    expect(preset.createdAt).toBeTruthy();

    // Persisted to localStorage under the storageKey.
    const raw = localStorage.getItem(KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("Low stock");
  });

  it("applyFilter calls the onApplyFilter callback with the preset's filters", () => {
    const onApplyFilter = vi.fn();
    const { result } = renderHook(() =>
      useSavedFilters({ storageKey: KEY, onApplyFilter }),
    );

    let id = "";
    act(() => {
      id = result.current.saveFilter("Cat: tools", { category: "tools" }).id;
    });

    act(() => {
      result.current.applyFilter(id);
    });

    expect(onApplyFilter).toHaveBeenCalledWith({ category: "tools" });
  });

  it("setAsDefault marks one preset isDefault; getDefaultFilter returns it; a new default clears the prior", () => {
    const { result } = renderHook(() => useSavedFilters({ storageKey: KEY }));

    let aId = "";
    let bId = "";
    act(() => {
      aId = result.current.saveFilter("A", { a: 1 }).id;
      bId = result.current.saveFilter("B", { b: 2 }).id;
    });

    act(() => {
      result.current.setAsDefault(aId);
    });
    expect(result.current.getDefaultFilter()?.id).toBe(aId);

    // Switching the default to B clears A's default flag.
    act(() => {
      result.current.setAsDefault(bId);
    });
    expect(result.current.getDefaultFilter()?.id).toBe(bId);
    const aStill = result.current.savedFilters.find((f) => f.id === aId);
    expect(aStill?.isDefault).toBeFalsy();
  });

  it("deleteFilter removes a preset", () => {
    const { result } = renderHook(() => useSavedFilters({ storageKey: KEY }));

    let id = "";
    act(() => {
      id = result.current.saveFilter("Temp", {}).id;
    });
    expect(result.current.savedFilters).toHaveLength(1);

    act(() => {
      result.current.deleteFilter(id);
    });
    expect(result.current.savedFilters).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toHaveLength(0);
  });

  it("tolerates a malformed (non-JSON) localStorage payload — resets to [] without throwing", () => {
    localStorage.setItem(KEY, "{not valid json");

    const { result } = renderHook(() => useSavedFilters({ storageKey: KEY }));

    expect(result.current.savedFilters).toEqual([]);
  });

  it("tolerates a wrong-shape payload (valid JSON but not an array) — resets to []", () => {
    localStorage.setItem(KEY, JSON.stringify({ not: "an array" }));

    const { result } = renderHook(() => useSavedFilters({ storageKey: KEY }));

    expect(result.current.savedFilters).toEqual([]);
  });
});
