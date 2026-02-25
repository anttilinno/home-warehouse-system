/**
 * Tests for useTableSort hook
 *
 * Verifies:
 * - Sort direction cycling: asc -> desc -> null -> asc
 * - Column switching resets to asc
 * - Number, string (case-insensitive), and date string sorting
 * - Null/undefined values pushed to end
 * - getSortDirection returns correct direction for active column
 * - Empty data and default sort parameters
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableSort } from "../use-table-sort";

interface TestItem {
  name: string;
  count: number;
  date: string;
}

const data: TestItem[] = [
  { name: "Banana", count: 5, date: "2024-03-01" },
  { name: "apple", count: 10, date: "2024-01-15" },
  { name: "Cherry", count: 1, date: "2024-02-20" },
];

describe("useTableSort", () => {
  describe("sort direction cycling", () => {
    it("returns original order when no sort is applied", () => {
      const { result } = renderHook(() => useTableSort(data));

      expect(result.current.sortConfig).toEqual({
        key: null,
        direction: "asc",
      });
      expect(result.current.sortedData).toEqual(data);
    });

    it("cycles through asc -> desc -> null on same column", () => {
      const { result } = renderHook(() => useTableSort(data));

      // First click: asc
      act(() => {
        result.current.requestSort("count");
      });
      expect(result.current.sortConfig).toEqual({
        key: "count",
        direction: "asc",
      });
      expect(result.current.sortedData.map((d) => d.count)).toEqual([1, 5, 10]);

      // Second click: desc
      act(() => {
        result.current.requestSort("count");
      });
      expect(result.current.sortConfig).toEqual({
        key: "count",
        direction: "desc",
      });
      expect(result.current.sortedData.map((d) => d.count)).toEqual([10, 5, 1]);

      // Third click: null (reset to original order)
      act(() => {
        result.current.requestSort("count");
      });
      expect(result.current.sortConfig).toEqual({
        key: null,
        direction: null,
      });
      expect(result.current.sortedData).toEqual(data);
    });

    it("resets to asc when switching to a different column", () => {
      const { result } = renderHook(() => useTableSort(data));

      // Sort by count desc
      act(() => {
        result.current.requestSort("count");
      });
      act(() => {
        result.current.requestSort("count");
      });
      expect(result.current.sortConfig.direction).toBe("desc");

      // Switch to name -> resets to asc
      act(() => {
        result.current.requestSort("name");
      });
      expect(result.current.sortConfig).toEqual({
        key: "name",
        direction: "asc",
      });
    });
  });

  describe("sorting by data type", () => {
    it("sorts strings case-insensitively", () => {
      const { result } = renderHook(() => useTableSort(data));

      act(() => {
        result.current.requestSort("name");
      });

      expect(result.current.sortedData.map((d) => d.name)).toEqual([
        "apple",
        "Banana",
        "Cherry",
      ]);
    });

    it("sorts date strings chronologically", () => {
      const { result } = renderHook(() => useTableSort(data));

      act(() => {
        result.current.requestSort("date");
      });

      expect(result.current.sortedData.map((d) => d.date)).toEqual([
        "2024-01-15",
        "2024-02-20",
        "2024-03-01",
      ]);
    });
  });

  describe("null/undefined handling", () => {
    it("pushes null and undefined values to end when sorting ascending", () => {
      const dataWithNulls = [
        { name: "B", count: null as unknown as number },
        { name: "A", count: 3 },
        { name: "C", count: undefined as unknown as number },
        { name: "D", count: 1 },
      ];

      const { result } = renderHook(() => useTableSort(dataWithNulls));

      act(() => {
        result.current.requestSort("count");
      });

      const counts = result.current.sortedData.map((d) => d.count);
      // Non-null values sorted ascending first
      expect(counts[0]).toBe(1);
      expect(counts[1]).toBe(3);
      // Null/undefined values pushed to end by the comparator
      expect(counts[2]).toBeNull();
      expect(counts[3]).toBeUndefined();
    });
  });

  describe("getSortDirection", () => {
    it("returns direction for the active sort column and null for others", () => {
      const { result } = renderHook(() => useTableSort(data));

      act(() => {
        result.current.requestSort("count");
      });

      expect(result.current.getSortDirection("count")).toBe("asc");
      expect(result.current.getSortDirection("name")).toBeNull();
      expect(result.current.getSortDirection("date")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty data", () => {
      const { result } = renderHook(() => useTableSort<TestItem>([]));

      act(() => {
        result.current.requestSort("count");
      });

      expect(result.current.sortedData).toEqual([]);
    });

    it("applies default sort key and direction on mount", () => {
      const { result } = renderHook(() =>
        useTableSort(data, "count", "desc")
      );

      expect(result.current.sortConfig).toEqual({
        key: "count",
        direction: "desc",
      });
      expect(result.current.sortedData.map((d) => d.count)).toEqual([10, 5, 1]);
    });
  });
});
