import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ScanHistoryEntry } from "@/lib/scanner";

// Stub @/lib/scanner. scan-history.ts is already covered by Plan 03; this is a
// unit test of the hook, not of the underlying module.
const getScanHistoryMock = vi.fn<() => ScanHistoryEntry[]>();
const addToScanHistoryMock = vi.fn<(e: Omit<ScanHistoryEntry, "timestamp">) => void>();
const removeFromScanHistoryMock = vi.fn<(code: string) => void>();
const clearScanHistoryMock = vi.fn<() => void>();

vi.mock("@/lib/scanner", () => ({
  getScanHistory: (...args: unknown[]) => getScanHistoryMock(...(args as [])),
  addToScanHistory: (e: Omit<ScanHistoryEntry, "timestamp">) =>
    addToScanHistoryMock(e),
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
