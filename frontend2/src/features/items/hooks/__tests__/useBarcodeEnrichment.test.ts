// Phase 65 Plan 65-03 — real assertions for useBarcodeEnrichment hook.
// Covers D-12 regex-gate matrix (/^\d{8,14}$/), staleTime: Infinity,
// retry: false, and D-16 silent-failure structured-log semantics.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithQueryClient } from "@/test-utils-query";
import { useBarcodeEnrichment } from "@/features/items/hooks/useBarcodeEnrichment";
import { barcodeKeys } from "@/lib/api/barcode";

function makeOkResponse(
  overrides: Partial<{
    barcode: string;
    name: string;
    brand: string | null;
    category: string | null;
    image_url: string | null;
    found: boolean;
  }> = {},
): Response {
  return new Response(
    JSON.stringify({
      barcode: "5449000000996",
      name: "Coca-Cola Classic",
      brand: "The Coca-Cola Company",
      category: null,
      image_url: null,
      found: true,
      ...overrides,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("useBarcodeEnrichment regex gate (D-12) — /^\\d{8,14}$/", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => makeOkResponse());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("code=null → enabled: false (no fetch)", () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment(null),
    );
    // enabled: false short-circuits — fetchStatus stays idle, no network call.
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('code="" → enabled: false', () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment(""),
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('code="1234567" (7 digits, below floor) → enabled: false', () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("1234567"),
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('code="12345678" (8 digits, boundary) → enabled: true', () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("12345678"),
    );
    // enabled: true — fetchStatus becomes "fetching" synchronously on first render.
    expect(result.current.fetchStatus).toBe("fetching");
  });

  it('code="123456789" (9 digits, middle of range) → enabled: true', () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("123456789"),
    );
    expect(result.current.fetchStatus).toBe("fetching");
  });

  it('code="12345678901234" (14 digits, boundary) → enabled: true', () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("12345678901234"),
    );
    expect(result.current.fetchStatus).toBe("fetching");
  });

  it('code="123456789012345" (15 digits, above ceiling) → enabled: false', () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("123456789012345"),
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('code="ABC12345678" (non-numeric) → enabled: false', () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("ABC12345678"),
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('code="5449000000996" (valid UPC) → enabled: true, fetches barcodeApi.lookup', async () => {
    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("5449000000996"),
    );
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.status).toBe("success");
    expect(result.current.data?.found).toBe(true);
    expect(result.current.data?.name).toBe("Coca-Cola Classic");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/barcode\/5449000000996($|\?)/);
  });
});

describe("useBarcodeEnrichment caching (D-12)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => makeOkResponse());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("staleTime: Infinity — second render with same code does not refetch", async () => {
    // Share a single QueryClient across two hook renders so the cache
    // hit happens on the second render.
    const { result, client, unmount } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("5449000000996"),
    );
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    unmount();

    // Second render — same code, same client. staleTime: Infinity means the
    // cached result is still fresh; queryFn must NOT be called again.
    const { result: result2 } = renderHookWithQueryClient(
      () => useBarcodeEnrichment("5449000000996"),
      { client },
    );
    // Fresh cache → no fetch at all; isFetching is false immediately.
    expect(result2.current.isFetching).toBe(false);
    expect(result2.current.data?.found).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("retry: false — network error does not auto-retry", async () => {
    fetchSpy.mockReset();
    // Silence the structured-log error channel so the test output is clean.
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    fetchSpy.mockImplementation(() =>
      Promise.reject(new Error("boom")),
    );

    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("5449000000996"),
    );
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.status).toBe("error");
    // retry: false — exactly one attempt (not the TanStack default of 4).
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});

describe("useBarcodeEnrichment silent failure (D-16)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => makeOkResponse());
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('network error → logs { kind: "upc-enrichment-fail", code, error, timestamp } then throws to TanStack (status: error)', async () => {
    fetchSpy.mockImplementation(() => Promise.reject(new Error("boom")));

    const { result, client } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("5449000000996"),
    );
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.status).toBe("error");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "upc-enrichment-fail",
        code: "5449000000996",
        error: expect.stringContaining("boom"),
        timestamp: expect.any(Number),
      }),
    );
    // D-16 cache-key contract (Test 13 rolled in): query is keyed by
    // barcodeKeys.lookup(code). Inspect cache for the queryKey triple.
    const cached = client
      .getQueryCache()
      .find({ queryKey: barcodeKeys.lookup("5449000000996") });
    expect(cached).not.toBeUndefined();
  });

  it("{ found: false } response → query resolves success with data.found === false (banner will noop-render)", async () => {
    fetchSpy.mockImplementation(async () =>
      makeOkResponse({
        barcode: "0000000000000",
        name: "",
        brand: null,
        category: null,
        image_url: null,
        found: false,
      }),
    );

    const { result } = renderHookWithQueryClient(() =>
      useBarcodeEnrichment("0000000000000"),
    );
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.status).toBe("success");
    expect(result.current.data?.found).toBe(false);
    // found: false is a successful response — the structured-log fires
    // ONLY on thrown/rejected fetches. Banner-site decides to noop-render.
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: "upc-enrichment-fail" }),
    );
  });
});
