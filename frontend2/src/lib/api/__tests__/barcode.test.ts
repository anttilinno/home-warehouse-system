// Phase 65 Plan 65-03 — real assertions for LOOK-03 enrichment client.
// Covers D-11 URL shape (encodeURIComponent defense) + barcodeKeys factory
// triple (all / lookups() / lookup(code)).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { barcodeApi, barcodeKeys } from "@/lib/api/barcode";

describe("barcodeApi.lookup (D-11)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          barcode: "5449000000996",
          name: "Coca-Cola Classic",
          brand: "The Coca-Cola Company",
          category: null,
          image_url: null,
          found: true,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("D-11: calls GET /barcode/{encodeURIComponent(code)} (public, unauth path — no wsId prefix)", async () => {
    const result = await barcodeApi.lookup("5449000000996");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    // URL should end with /barcode/5449000000996 (no wsId prefix — public endpoint)
    expect(String(url)).toMatch(/\/barcode\/5449000000996($|\?)/);
    // Defense: no /workspaces/ prefix (not workspace-scoped)
    expect(String(url)).not.toContain("/workspaces/");
    expect(init.method).toBe("GET");
    // Passes through the BarcodeProduct response shape
    expect(result).toEqual({
      barcode: "5449000000996",
      name: "Coca-Cola Classic",
      brand: "The Coca-Cola Company",
      category: null,
      image_url: null,
      found: true,
    });
  });

  it("D-11: passes through the BarcodeProduct response shape", async () => {
    // Separate test — encodeURIComponent defense on non-numeric content.
    // Even though the /^\d{8,14}$/ gate in useBarcodeEnrichment prevents this
    // from reaching the helper at runtime, the helper itself must not be
    // exploitable if the gate is ever loosened (defense in depth).
    await barcodeApi.lookup("abc def");

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/barcode\/abc%20def($|\?)/);
  });
});

describe("barcodeKeys factory (D-11)", () => {
  it('barcodeKeys.all equals ["barcode"]', () => {
    expect(barcodeKeys.all).toEqual(["barcode"]);
  });

  it('barcodeKeys.lookups() equals ["barcode", "lookup"]', () => {
    expect(barcodeKeys.lookups()).toEqual(["barcode", "lookup"]);
  });

  it('barcodeKeys.lookup("5449000000996") equals ["barcode", "lookup", "5449000000996"]', () => {
    expect(barcodeKeys.lookup("5449000000996")).toEqual([
      "barcode",
      "lookup",
      "5449000000996",
    ]);
  });
});
