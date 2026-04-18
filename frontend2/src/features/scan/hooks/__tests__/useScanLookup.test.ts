import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScanLookup } from "../useScanLookup";
import type { ScanLookupStatus } from "@/lib/api/scan";

describe("useScanLookup (Phase 64 stub — D-01 + D-18)", () => {
  it("returns idle result when called with null (stub ignores input)", () => {
    const { result } = renderHook(() => useScanLookup(null));
    expect(result.current.status).toBe("idle");
    expect(result.current.match).toBe(null);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.refetch).toBe("function");
  });

  it("returns the same idle shape when called with a real-looking code string", () => {
    const { result } = renderHook(() => useScanLookup("ABC-123"));
    expect(result.current.status).toBe("idle");
    expect(result.current.match).toBe(null);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.refetch).toBe("function");
  });

  it("returns the same idle shape when called with an empty string", () => {
    const { result } = renderHook(() => useScanLookup(""));
    expect(result.current.status).toBe("idle");
    expect(result.current.match).toBe(null);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.refetch).toBe("function");
  });

  it("exposes a refetch that is a no-op (does not throw when invoked)", () => {
    const { result } = renderHook(() => useScanLookup("anything"));
    expect(() => result.current.refetch()).not.toThrow();
    // Still idle after refetch — Phase 64 stub ignores refetch calls.
    expect(result.current.status).toBe("idle");
    expect(result.current.match).toBe(null);
  });

  it("ScanLookupStatus accepts all four states (D-18 full enum landed)", () => {
    // Compile-time type assertions that double as a runtime sentinel.
    const idle: ScanLookupStatus = "idle";
    const loading: ScanLookupStatus = "loading";
    const success: ScanLookupStatus = "success";
    const error: ScanLookupStatus = "error";
    const all = [idle, loading, success, error];
    expect(all).toHaveLength(4);
    expect(new Set(all).size).toBe(4);
  });
});
