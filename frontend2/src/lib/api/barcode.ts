import { get } from "@/lib/api";

// Barcode product-prefill lookup (SCAN-10).
//
// The backend `GET /api/barcode/{barcode}` route is GLOBAL — NOT ws-scoped
// (verified `barcode/handler.go:12,42-49`; param {barcode}, minLen 8 maxLen 14).
// It proxies external product DBs (OpenFoodFacts / OpenProductsDB) and returns
// the shape below; `found:false` (with name "") means the product is unknown so
// the caller suppresses the suggestion banner.
//
// The scanned `code` is user-controlled, so it is `encodeURIComponent`-escaped
// before interpolation into the path (threat T-11-02 / Pitfall 5) — a code
// carrying `../` cannot escape the route.

export interface ProductResponse {
  barcode: string;
  /** Product name; "" when not found. */
  name: string;
  brand?: string;
  category?: string;
  image_url?: string;
  /** false → product unknown; caller suppresses the banner. */
  found: boolean;
}

export const barcodeApi = {
  /**
   * Look up product metadata for a barcode via the GLOBAL `/barcode/{code}`
   * route. The code is `encodeURIComponent`-encoded before interpolation.
   */
  lookup(code: string): Promise<ProductResponse> {
    return get<ProductResponse>(`/barcode/${encodeURIComponent(code)}`);
  },
};
