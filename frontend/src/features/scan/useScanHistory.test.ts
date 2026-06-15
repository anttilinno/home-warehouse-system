// useScanHistory — React wrapper over lib/scanner/scan-history (state-backed,
// no render loop). Tests assert add/clear/refire reflect localStorage.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScanHistory } from "./useScanHistory";

const KEY = "hws-scan-history";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useScanHistory", () => {
  it("reads existing history on mount", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { code: "AAA", format: "qr_code", entityType: "unknown", timestamp: 1 },
      ]),
    );
    const { result } = renderHook(() => useScanHistory());
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].code).toBe("AAA");
  });

  it("add() persists to localStorage and refreshes entries (newest first)", () => {
    const { result } = renderHook(() => useScanHistory());

    act(() => {
      result.current.add({
        code: "BBB",
        format: "ean_13",
        entityType: "unknown",
      });
    });

    expect(result.current.entries[0].code).toBe("BBB");
    const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(stored[0].code).toBe("BBB");
  });

  it("clear() empties both state and localStorage", () => {
    const { result } = renderHook(() => useScanHistory());
    act(() => {
      result.current.add({
        code: "CCC",
        format: "qr_code",
        entityType: "unknown",
      });
    });
    expect(result.current.entries).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.entries).toHaveLength(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("refire(entry) returns the stored {code, format} for the funnel", () => {
    const { result } = renderHook(() => useScanHistory());
    const entry = {
      code: "DDD",
      format: "code_128",
      entityType: "unknown" as const,
      timestamp: 5,
    };

    let out: { code: string; format: string } | undefined;
    act(() => {
      out = result.current.refire(entry);
    });

    expect(out).toEqual({ code: "DDD", format: "code_128" });
  });

  it("does not re-read localStorage on every render (state-backed)", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { code: "EEE", format: "qr_code", entityType: "unknown", timestamp: 1 },
      ]),
    );
    const { result, rerender } = renderHook(() => useScanHistory());
    const first = result.current.entries;
    rerender();
    // Same array reference across a no-op rerender → not re-reading every render.
    expect(result.current.entries).toBe(first);
  });
});
