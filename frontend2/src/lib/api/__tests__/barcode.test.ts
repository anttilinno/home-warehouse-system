// Phase 65 Wave 0 scaffold (Plan 65-01 Task 2). barcode.ts is created
// in Plan 65-03; this file uses it.todo until then. DO NOT import from
// @/lib/api/barcode — the module does not yet exist and the import
// would break collection. Re-enable the import in Plan 65-03.
import { describe, it } from "vitest";

describe("barcodeApi.lookup (D-11)", () => {
  it.todo("D-11: calls GET /barcode/{encodeURIComponent(code)} (public, unauth path — no wsId prefix)");
  it.todo("D-11: passes through the BarcodeProduct response shape");
});

describe("barcodeKeys factory (D-11)", () => {
  it.todo("barcodeKeys.all equals [\"barcode\"]");
  it.todo("barcodeKeys.lookups() equals [\"barcode\", \"lookup\"]");
  it.todo("barcodeKeys.lookup(\"5449000000996\") equals [\"barcode\", \"lookup\", \"5449000000996\"]");
});
