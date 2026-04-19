// Phase 65 LOOK-03 enrichment client — calls the backend's public
// /barcode/{code} passthrough (OpenFoodFacts + OpenProductsDB). The
// endpoint is unauthenticated by design (no wsId — not workspace-scoped).
// Frontend gating lives in useBarcodeEnrichment's /^\d{8,14}$/ regex; the
// helper itself just builds the URL with encodeURIComponent defense
// (T-65-03-01: injection mitigation in defense-in-depth with the hook gate).
import { get } from "@/lib/api";

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
  found: boolean;
}

export const barcodeApi = {
  lookup: (code: string) =>
    get<BarcodeProduct>(`/barcode/${encodeURIComponent(code)}`),
};

export const barcodeKeys = {
  all: ["barcode"] as const,
  lookups: () => [...barcodeKeys.all, "lookup"] as const,
  lookup: (code: string) => [...barcodeKeys.lookups(), code] as const,
};
