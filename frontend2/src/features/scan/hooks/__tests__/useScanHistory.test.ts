import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ScanHistoryEntry } from "@/lib/scanner";

// Stub @/lib/scanner. scan-history.ts is already covered by Plan 03; this is a
// unit test of the hook, not of the underlying module.
const getScanHistoryMock = vi.fn<() => ScanHistoryEntry[]>();
const addToScanHistoryMock = vi.fn<(e: Omit<ScanHistoryEntry, "timestamp">) => void>();
const updateScanHistoryMock =
  vi.fn<
    (
      code: string,
      patch: Partial<
        Pick<ScanHistoryEntry, "entityType" | "entityId" | "entityName">
      >,
    ) => void
  >();
const removeFromScanHistoryMock = vi.fn<(code: string) => void>();
const clearScanHistoryMock = vi.fn<() => void>();

vi.mock("@/lib/scanner", () => ({
  getScanHistory: (...args: unknown[]) => getScanHistoryMock(...(args as [])),
  addToScanHistory: (e: Omit<ScanHistoryEntry, "timestamp">) =>
    addToScanHistoryMock(e),
  updateScanHistory: (
    code: string,
    patch: Partial<
      Pick<ScanHistoryEntry, "entityType" | "entityId" | "entityName">
    >,
  ) => updateScanHistoryMock(code, patch),
  removeFromScanHistory: (c: string) => removeFromScanHistoryMock(c),
  clearScanHistory: () => clearScanHistoryMock(),
}));

import { useScanHistory } from "../useScanHistory";

function makeEntry(code: string, timestamp = 1_700_000_000_000): ScanHistoryEntry {
  return {
    code,
    format: "qr_code",
    entityType: "unknown",
    timestamp,
  };
}

describe("useScanHistory (D-04 single API surface)", () => {
  beforeEach(() => {
    getScanHistoryMock.mockReset();
    addToScanHistoryMock.mockReset();
    updateScanHistoryMock.mockReset();
    removeFromScanHistoryMock.mockReset();
    clearScanHistoryMock.mockReset();
    getScanHistoryMock.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initial render calls getScanHistory() once and hydrates entries from it", () => {
    const seed = [makeEntry("SEED-1"), makeEntry("SEED-2")];
    getScanHistoryMock.mockReturnValue(seed);
    const { result } = renderHook(() => useScanHistory());
    expect(getScanHistoryMock).toHaveBeenCalledTimes(1);
    expect(result.current.entries).toEqual(seed);
  });

  it("add() delegates to addToScanHistory then re-reads storage into entries", () => {
    getScanHistoryMock.mockReturnValueOnce([]);
    const { result } = renderHook(() => useScanHistory());
    expect(result.current.entries).toEqual([]);

    const added = [makeEntry("NEW")];
    getScanHistoryMock.mockReturnValueOnce(added);

    act(() => {
      result.current.add({
        code: "NEW",
        format: "qr_code",
        entityType: "unknown",
      });
    });

    expect(addToScanHistoryMock).toHaveBeenCalledTimes(1);
    expect(addToScanHistoryMock).toHaveBeenCalledWith({
      code: "NEW",
      format: "qr_code",
      entityType: "unknown",
    });
    expect(result.current.entries).toEqual(added);
  });

  it("remove() delegates to removeFromScanHistory then re-reads storage into entries", () => {
    const initial = [makeEntry("A"), makeEntry("B")];
    getScanHistoryMock.mockReturnValueOnce(initial);
    const { result } = renderHook(() => useScanHistory());
    expect(result.current.entries).toEqual(initial);

    const afterRemove = [makeEntry("B")];
    getScanHistoryMock.mockReturnValueOnce(afterRemove);

    act(() => {
      result.current.remove("A");
    });

    expect(removeFromScanHistoryMock).toHaveBeenCalledWith("A");
    expect(result.current.entries).toEqual(afterRemove);
  });

  it("clear() delegates to clearScanHistory and sets entries to []", () => {
    const initial = [makeEntry("A"), makeEntry("B")];
    getScanHistoryMock.mockReturnValueOnce(initial);
    const { result } = renderHook(() => useScanHistory());
    expect(result.current.entries).toEqual(initial);

    act(() => {
      result.current.clear();
    });

    expect(clearScanHistoryMock).toHaveBeenCalledTimes(1);
    expect(result.current.entries).toEqual([]);
  });

  it("window 'storage' event (cross-tab write) re-reads getScanHistory into entries", () => {
    getScanHistoryMock.mockReturnValueOnce([]);
    const { result } = renderHook(() => useScanHistory());
    expect(getScanHistoryMock).toHaveBeenCalledTimes(1);

    const crossTab = [makeEntry("FROM-OTHER-TAB")];
    getScanHistoryMock.mockReturnValueOnce(crossTab);

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "hws-scan-history" }));
    });

    // One call on mount + one call from the storage event handler.
    expect(getScanHistoryMock).toHaveBeenCalledTimes(2);
    expect(result.current.entries).toEqual(crossTab);
  });

  it("unmount removes the same 'storage' listener it added (no leak)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useScanHistory());

    const addStorageCalls = addSpy.mock.calls.filter(([evt]) => evt === "storage");
    expect(addStorageCalls).toHaveLength(1);
    const addedHandler = addStorageCalls[0][1];

    unmount();

    const removeStorageCalls = removeSpy.mock.calls.filter(
      ([evt]) => evt === "storage",
    );
    expect(removeStorageCalls).toHaveLength(1);
    expect(removeStorageCalls[0][1]).toBe(addedHandler);
  });
});

describe("useScanHistory.update (D-22)", () => {
  beforeEach(() => {
    getScanHistoryMock.mockReset();
    addToScanHistoryMock.mockReset();
    updateScanHistoryMock.mockReset();
    removeFromScanHistoryMock.mockReset();
    clearScanHistoryMock.mockReset();
    getScanHistoryMock.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1 (happy path): update() merges patch; entries reflect the merged entry", () => {
    const initial = [makeEntry("X")];
    getScanHistoryMock.mockReturnValueOnce(initial);
    const { result } = renderHook(() => useScanHistory());
    expect(result.current.entries).toEqual(initial);

    const merged: ScanHistoryEntry = {
      code: "X",
      format: "qr_code",
      entityType: "item",
      entityId: "item-123",
      entityName: "Drill",
      timestamp: 1_700_000_000_000,
    };
    getScanHistoryMock.mockReturnValueOnce([merged]);

    act(() => {
      result.current.update("X", {
        entityType: "item",
        entityId: "item-123",
        entityName: "Drill",
      });
    });

    expect(updateScanHistoryMock).toHaveBeenCalledTimes(1);
    expect(updateScanHistoryMock).toHaveBeenCalledWith("X", {
      entityType: "item",
      entityId: "item-123",
      entityName: "Drill",
    });
    expect(result.current.entries).toEqual([merged]);
  });

  it("Test 2 (noop-if-missing): update() on unknown code leaves entries unchanged", () => {
    const initial = [makeEntry("X")];
    getScanHistoryMock.mockReturnValueOnce(initial);
    const { result } = renderHook(() => useScanHistory());
    expect(result.current.entries).toEqual(initial);

    // Module-layer noop-if-missing is already covered; here we assert the hook
    // propagates a getScanHistory() re-read that returns the unchanged array.
    getScanHistoryMock.mockReturnValueOnce(initial);

    act(() => {
      result.current.update("nonexistent-code", { entityType: "item" });
    });

    expect(updateScanHistoryMock).toHaveBeenCalledWith("nonexistent-code", {
      entityType: "item",
    });
    expect(result.current.entries).toEqual(initial);
  });

  it("Test 3 (no re-introduce): update() never calls addToScanHistory", () => {
    getScanHistoryMock.mockReturnValue([makeEntry("X")]);
    const { result } = renderHook(() => useScanHistory());

    act(() => {
      result.current.update("X", { entityType: "item" });
    });
    act(() => {
      result.current.update("anything-else", { entityType: "item" });
    });

    expect(addToScanHistoryMock).not.toHaveBeenCalled();
  });

  it("Test 4 (typeof): returned object exposes update as a function", () => {
    const { result } = renderHook(() => useScanHistory());
    expect(typeof result.current.update).toBe("function");
  });

  it("Test 5 (referential stability): update keeps identity across renders (useCallback wrap)", () => {
    const { result, rerender } = renderHook(() => useScanHistory());
    const firstRef = result.current.update;
    rerender();
    const secondRef = result.current.update;
    expect(secondRef).toBe(firstRef); // useCallback enforces stable identity
  });
});
