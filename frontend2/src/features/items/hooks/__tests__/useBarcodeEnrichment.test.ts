// Phase 65 Wave 0 scaffold (Plan 65-01 Task 2). Hook body lands in
// Plan 65-03. Scaffold documents the full regex-gate matrix + staleTime
// + silent-fail expectations so Plan 65-03 turns todos into real
// renderHookWithQueryClient assertions.
import { describe, it } from "vitest";

describe("useBarcodeEnrichment regex gate (D-12) — /^\\d{8,14}$/", () => {
  it.todo("code=null → enabled: false (no fetch)");
  it.todo("code=\"\" → enabled: false");
  it.todo("code=\"1234567\" (7 digits, below floor) → enabled: false");
  it.todo("code=\"12345678\" (8 digits, boundary) → enabled: true");
  it.todo("code=\"123456789\" (9 digits, middle of range) → enabled: true");
  it.todo("code=\"12345678901234\" (14 digits, boundary) → enabled: true");
  it.todo("code=\"123456789012345\" (15 digits, above ceiling) → enabled: false");
  it.todo("code=\"ABC12345678\" (non-numeric) → enabled: false");
  it.todo("code=\"5449000000996\" (valid UPC) → enabled: true, fetches barcodeApi.lookup");
});

describe("useBarcodeEnrichment caching (D-12)", () => {
  it.todo("staleTime: Infinity — second render with same code does not refetch");
  it.todo("retry: false — network error does not auto-retry");
});

describe("useBarcodeEnrichment silent failure (D-16)", () => {
  it.todo("network error → logs { kind: \"upc-enrichment-fail\", code, error, timestamp } then throws to TanStack (status: error)");
  it.todo("{ found: false } response → query resolves success with data.found === false (banner will noop-render)");
});
