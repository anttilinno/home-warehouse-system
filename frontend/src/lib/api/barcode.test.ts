import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { barcodeApi } from "./barcode";

// SCAN-10 — barcodeApi.lookup against the GLOBAL `GET /api/barcode/:barcode`.
// Uses the shared Wave-0 MSW handler (found / not-found fixtures) registered in
// src/test/msw/handlers.ts; the encoding case adds a per-test capture handler.

describe("barcodeApi.lookup", () => {
  it("returns the product shape on a found barcode", async () => {
    const res = await barcodeApi.lookup("0123456789012");
    expect(res.found).toBe(true);
    expect(res.barcode).toBe("0123456789012");
    expect(res.name).toBe("Cordless Drill");
    expect(res.brand).toBe("Acme");
  });

  it("faithfully returns found:false for an unknown barcode", async () => {
    const res = await barcodeApi.lookup("9999999999999");
    expect(res.found).toBe(false);
    expect(res.name).toBe("");
    expect(res.barcode).toBe("9999999999999");
  });

  it("encodeURIComponent-encodes a path-injection code before interpolation (T-11-02)", async () => {
    let capturedUrl = "";
    server.use(
      http.get("/api/barcode/:barcode", ({ request, params }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          barcode: String(params.barcode),
          name: "",
          found: false,
        });
      }),
    );

    await barcodeApi.lookup("../etc/passwd");

    // The raw `../` must be percent-encoded in the request URL — no literal
    // "../" path traversal reaches the route.
    expect(capturedUrl).toContain("%2F"); // encoded slash
    expect(capturedUrl).not.toMatch(/barcode\/\.\.\//);
  });
});
