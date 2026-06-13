import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import {
  addToScanHistory,
  clearScanHistory,
  getScanHistory,
  updateScanHistory,
} from "./scan-history";

// SCAN-06 / SCAN-07 — last-10 deduped scan history in localStorage under
// `hws-scan-history`, tolerant of stale/malformed legacy data (T-11-03).

const KEY = "hws-scan-history";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

function fakeItem(over: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    workspace_id: "ws-1",
    sku: "SKU-1",
    name: "Cordless Drill",
    min_stock_level: 0,
    short_code: "abc123",
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
    ...over,
  };
}

describe("scan-history — add / dedup / cap", () => {
  it("addToScanHistory prepends newest-first with a timestamp", () => {
    addToScanHistory({ code: "AAA", format: "qr_code", entityType: "unknown" });
    const history = getScanHistory();
    expect(history).toHaveLength(1);
    expect(history[0].code).toBe("AAA");
    expect(typeof history[0].timestamp).toBe("number");
  });

  it("de-dupes by code, moving a re-scanned code to the top", () => {
    addToScanHistory({ code: "AAA", format: "qr_code", entityType: "unknown" });
    addToScanHistory({ code: "BBB", format: "qr_code", entityType: "unknown" });
    addToScanHistory({ code: "AAA", format: "qr_code", entityType: "unknown" });

    const codes = getScanHistory().map((h) => h.code);
    expect(codes).toEqual(["AAA", "BBB"]); // AAA deduped to front, length 2
  });

  it("caps the list at 10 (slice(0,10))", () => {
    for (let i = 0; i < 15; i += 1) {
      addToScanHistory({
        code: `CODE-${i}`,
        format: "qr_code",
        entityType: "unknown",
      });
    }
    const history = getScanHistory();
    expect(history).toHaveLength(10);
    // Newest (CODE-14) first; oldest retained is CODE-5.
    expect(history[0].code).toBe("CODE-14");
    expect(history[9].code).toBe("CODE-5");
  });
});

describe("scan-history — clear", () => {
  it("clearScanHistory empties the key", () => {
    addToScanHistory({ code: "AAA", format: "qr_code", entityType: "unknown" });
    clearScanHistory();
    expect(getScanHistory()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("scan-history — malformed tolerance (T-11-03)", () => {
  it("returns [] (never throws) on non-JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(() => getScanHistory()).not.toThrow();
    expect(getScanHistory()).toEqual([]);
  });

  it("returns [] on a non-array payload", () => {
    localStorage.setItem(KEY, JSON.stringify({ code: "x" }));
    expect(getScanHistory()).toEqual([]);
  });

  it("filters out malformed entries, keeping valid ones", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { code: "GOOD", format: "qr_code", entityType: "unknown", timestamp: 1 },
        { code: 123, timestamp: 2 }, // bad code type
        { format: "qr_code", timestamp: 3 }, // missing code
        { code: "NOTS", format: "qr_code" }, // missing timestamp
        null,
      ]),
    );
    const history = getScanHistory();
    expect(history).toHaveLength(1);
    expect(history[0].code).toBe("GOOD");
  });
});

describe("scan-history — updateScanHistory", () => {
  it("refines the matched entry to entityType:item with id + name", () => {
    addToScanHistory({ code: "AAA", format: "qr_code", entityType: "unknown" });
    updateScanHistory("AAA", fakeItem({ id: "item-9", name: "Drill" }));

    const entry = getScanHistory()[0];
    expect(entry.entityType).toBe("item");
    expect(entry.entityId).toBe("item-9");
    expect(entry.entityName).toBe("Drill");
  });

  it("marks the entry unknown when the lookup resolved to null", () => {
    addToScanHistory({
      code: "AAA",
      format: "qr_code",
      entityType: "item",
      entityId: "stale",
      entityName: "Stale",
    });
    updateScanHistory("AAA", null);

    const entry = getScanHistory()[0];
    expect(entry.entityType).toBe("unknown");
    expect(entry.entityId).toBeUndefined();
    expect(entry.entityName).toBeUndefined();
  });

  it("no-ops when no entry matches the code", () => {
    addToScanHistory({ code: "AAA", format: "qr_code", entityType: "unknown" });
    updateScanHistory("ZZZ", fakeItem());
    const entry = getScanHistory()[0];
    expect(entry.code).toBe("AAA");
    expect(entry.entityType).toBe("unknown");
  });
});
