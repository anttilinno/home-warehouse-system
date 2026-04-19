import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithQueryClient } from "@/test-utils-query";
import { useScanLookup } from "../useScanLookup";
import { itemsApi, type Item } from "@/lib/api/items";
import { scanKeys, type ScanLookupStatus } from "@/lib/api/scan";
import { useAuth } from "@/features/auth/AuthContext";

// Module-level mock — default workspaceId "ws-1" so most tests get through the
// enabled-gate. Individual tests re-mock useAuth with vi.mocked(useAuth)
// .mockReturnValue(...) to exercise the disabled branch.
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: vi.fn(() => ({ workspaceId: "ws-1" })),
}));

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    workspace_id: "ws-1",
    sku: "SKU-1",
    name: "Drill",
    description: null,
    category_id: null,
    brand: null,
    model: null,
    image_url: null,
    serial_number: null,
    manufacturer: null,
    barcode: "CODE",
    is_insured: null,
    is_archived: null,
    lifetime_warranty: null,
    needs_review: null,
    warranty_details: null,
    purchased_from: null,
    min_stock_level: 0,
    short_code: "SC-1",
    created_at: "2026-04-19T00:00:00Z",
    updated_at: "2026-04-19T00:00:00Z",
    ...overrides,
  };
}

describe("useScanLookup — Phase 64 D-18 shape contract (type-gate)", () => {
  it("Test 1 (PRESERVE): ScanLookupStatus accepts all four states (D-18 full enum landed)", () => {
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

describe("useScanLookup — Phase 65 body swap (LOOK-01)", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      workspaceId: "ws-1",
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 2 (null code): status=idle, match=null, error=null, no fetch fired", async () => {
    const spy = vi.spyOn(itemsApi, "lookupByBarcode");
    const { result } = renderHookWithQueryClient(() => useScanLookup(null));
    expect(result.current.status).toBe("idle");
    expect(result.current.match).toBeNull();
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe("function");
    // Brief settle window — TanStack should not fire queryFn when enabled:false.
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 3 (no workspaceId): status=idle when useAuth returns workspaceId:null", async () => {
    vi.mocked(useAuth).mockReturnValue({
      workspaceId: null,
    } as ReturnType<typeof useAuth>);
    const spy = vi.spyOn(itemsApi, "lookupByBarcode");
    const { result } = renderHookWithQueryClient(() => useScanLookup("CODE"));
    expect(result.current.status).toBe("idle");
    expect(result.current.match).toBeNull();
    expect(result.current.error).toBeNull();
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });

  it("Test 4 (match): status loading → success, match=returned Item", async () => {
    const item = makeItem({ barcode: "CODE", name: "Drill" });
    const spy = vi
      .spyOn(itemsApi, "lookupByBarcode")
      .mockResolvedValue(item);

    const { result } = renderHookWithQueryClient(() => useScanLookup("CODE"));
    // Initial render — enabled:true but no data yet → loading.
    expect(result.current.status).toBe("loading");
    expect(result.current.match).toBeNull();

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    expect(result.current.match).toEqual(item);
    expect(result.current.error).toBeNull();
    expect(spy).toHaveBeenCalledWith("ws-1", "CODE");
  });

  it("Test 5 (not-found): status=success, match=null when lookupByBarcode resolves null", async () => {
    vi.spyOn(itemsApi, "lookupByBarcode").mockResolvedValue(null);
    const { result } = renderHookWithQueryClient(() => useScanLookup("CODE"));
    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    expect(result.current.match).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("Test 6 (error): status=error, error non-null, match=null when lookupByBarcode rejects", async () => {
    vi.spyOn(itemsApi, "lookupByBarcode").mockRejectedValue(new Error("boom"));
    const { result } = renderHookWithQueryClient(() => useScanLookup("CODE"));
    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.match).toBeNull();
  });

  it("Test 7 (refetch): refetch() triggers a re-call of lookupByBarcode", async () => {
    const item = makeItem({ barcode: "CODE" });
    const spy = vi
      .spyOn(itemsApi, "lookupByBarcode")
      .mockResolvedValue(item);

    const { result } = renderHookWithQueryClient(() => useScanLookup("CODE"));
    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    const callsAfterInitial = spy.mock.calls.length;
    expect(callsAfterInitial).toBeGreaterThanOrEqual(1);

    result.current.refetch();

    await waitFor(() => {
      expect(spy.mock.calls.length).toBe(callsAfterInitial + 1);
    });
  });

  it("Test 8 (queryKey): query is keyed by scanKeys.lookup(code)", async () => {
    vi.spyOn(itemsApi, "lookupByBarcode").mockResolvedValue(null);
    const { result, client } = renderHookWithQueryClient(() =>
      useScanLookup("CODE"),
    );
    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    const entry = client
      .getQueryCache()
      .find({ queryKey: scanKeys.lookup("CODE") });
    expect(entry).toBeDefined();
  });
});
