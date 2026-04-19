// Phase 65 LOOK-03 — external UPC enrichment hook. Calls
// barcodeApi.lookup(code) via TanStack Query. Gated by /^\d{8,14}$/ so
// QR URLs and short alphanumeric codes never hit the public endpoint
// (T-65-03-02: upstream DoS mitigation).
// Silent-failure: infinite session cache + no auto-retry + structured
// console.error on queryFn throw (D-16 observability).
//
// D-15: the consumer (ItemFormPage / UpcSuggestionBanner) is responsible
// for rendering the banner only when data?.found === true — this hook
// does not filter found:false responses.
import { useQuery } from "@tanstack/react-query";
import {
  barcodeApi,
  barcodeKeys,
  type BarcodeProduct,
} from "@/lib/api/barcode";

const NUMERIC_8_TO_14 = /^\d{8,14}$/;

export function useBarcodeEnrichment(code: string | null) {
  return useQuery<BarcodeProduct>({
    queryKey: barcodeKeys.lookup(code ?? ""),
    queryFn: async () => {
      try {
        return await barcodeApi.lookup(code!);
      } catch (err) {
        console.error({
          kind: "upc-enrichment-fail",
          code,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        });
        throw err;
      }
    },
    enabled: !!code && NUMERIC_8_TO_14.test(code),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
