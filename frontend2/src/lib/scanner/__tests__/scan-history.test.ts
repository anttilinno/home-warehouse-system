/**
 * Unit tests for lib/scanner/scan-history.ts
 *
 * Covers SCAN-06 behaviors at the module layer:
 * - localStorage key "hws-scan-history" preservation
 * - getScanHistory: empty / corrupt / type-guarded
 * - addToScanHistory: dedupe-to-top (D-03), 10-entry cap
 * - removeFromScanHistory, clearScanHistory
 * - createHistoryEntry: not-found branch shape
 * - formatScanTime: "Just now", "N min ago", "N hr ago", locale date
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

const SCAN_HISTORY_KEY = "hws-scan-history";

function makeFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn(),
    _store: store,
  };
}

describe("lib/scanner/scan-history", () => {
  let fakeStorage: ReturnType<typeof makeFakeStorage>;

  beforeEach(async () => {
    vi.resetModules();
    fakeStorage = makeFakeStorage();
    vi.stubGlobal("localStorage", fakeStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Test 1: getScanHistory returns [] when no hws-scan-history key exists", async () => {
    const mod = await import("../scan-history");
    expect(mod.getScanHistory()).toEqual([]);
  });

  it("Test 2: getScanHistory returns [] when the key holds non-array JSON", async () => {
    fakeStorage._store.set(SCAN_HISTORY_KEY, JSON.stringify({ corrupt: true }));
    const mod = await import("../scan-history");
    expect(mod.getScanHistory()).toEqual([]);
  });

  it("Test 2b: getScanHistory returns [] when the key holds invalid JSON", async () => {
    fakeStorage._store.set(SCAN_HISTORY_KEY, "not-json-at-all{");
    const mod = await import("../scan-history");
    expect(mod.getScanHistory()).toEqual([]);
  });

  it("Test 3: getScanHistory filters out entries missing code or timestamp", async () => {
    const mixed = [
      { code: "ok-1", format: "qr_code", entityType: "unknown", timestamp: 1 },
      { code: "missing-ts", format: "qr_code", entityType: "unknown" },
      { format: "qr_code", entityType: "unknown", timestamp: 2 }, // missing code
      { code: "ok-2", format: "qr_code", entityType: "unknown", timestamp: 3 },
    ];
    fakeStorage._store.set(SCAN_HISTORY_KEY, JSON.stringify(mixed));
    const mod = await import("../scan-history");
    const out = mod.getScanHistory();
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.code)).toEqual(["ok-1", "ok-2"]);
  });

  it("Test 4: addToScanHistory writes an entry with a timestamp close to Date.now()", async () => {
    const mod = await import("../scan-history");
    const before = Date.now();
    mod.addToScanHistory({ code: "CODE-A", format: "qr_code", entityType: "unknown" });
    const after = Date.now();
    const entries = mod.getScanHistory();
    expect(entries).toHaveLength(1);
    expect(entries[0].code).toBe("CODE-A");
    expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(entries[0].timestamp).toBeLessThanOrEqual(after);
  });

  it("Test 5: adding the same code twice yields ONE entry, moved to position 0 (dedupe-to-top, D-03)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
    const mod = await import("../scan-history");

    mod.addToScanHistory({ code: "A", format: "qr_code", entityType: "unknown" });
    vi.advanceTimersByTime(1000);
    mod.addToScanHistory({ code: "B", format: "qr_code", entityType: "unknown" });
    const tsBeforeDupe = Date.now();
    vi.advanceTimersByTime(1000);
    mod.addToScanHistory({ code: "A", format: "qr_code", entityType: "unknown" });

    const entries = mod.getScanHistory();
    expect(entries.map((e) => e.code)).toEqual(["A", "B"]);
    // Re-added A must have a newer timestamp than the prior B
    expect(entries[0].timestamp).toBeGreaterThan(tsBeforeDupe);
  });

  it("Test 6: adding 11 distinct codes caps the list at 10 (oldest dropped)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
    const mod = await import("../scan-history");

    for (let i = 1; i <= 11; i++) {
      mod.addToScanHistory({
        code: `CODE-${i}`,
        format: "qr_code",
        entityType: "unknown",
      });
      vi.advanceTimersByTime(10);
    }
    const entries = mod.getScanHistory();
    expect(entries).toHaveLength(10);
    // Newest first → most recent = CODE-11, oldest kept = CODE-2 (CODE-1 dropped)
    expect(entries[0].code).toBe("CODE-11");
    expect(entries.at(-1)?.code).toBe("CODE-2");
    expect(entries.map((e) => e.code)).not.toContain("CODE-1");
  });

  it("Test 7: removeFromScanHistory removes only the matching code; others intact", async () => {
    const mod = await import("../scan-history");
    mod.addToScanHistory({ code: "A", format: "qr_code", entityType: "unknown" });
    mod.addToScanHistory({ code: "B", format: "qr_code", entityType: "unknown" });
    mod.addToScanHistory({ code: "C", format: "qr_code", entityType: "unknown" });

    mod.removeFromScanHistory("B");
    const out = mod.getScanHistory();
    expect(out.map((e) => e.code).sort()).toEqual(["A", "C"]);
  });

  it("Test 8: clearScanHistory empties the key so getScanHistory returns []", async () => {
    const mod = await import("../scan-history");
    mod.addToScanHistory({ code: "A", format: "qr_code", entityType: "unknown" });
    expect(mod.getScanHistory()).toHaveLength(1);
    mod.clearScanHistory();
    expect(mod.getScanHistory()).toEqual([]);
  });

  it("Test 9: createHistoryEntry returns legacy shape with entityType='unknown' for not_found match", async () => {
    const mod = await import("../scan-history");
    const entry = mod.createHistoryEntry("XYZ", "qr_code", {
      type: "not_found",
      code: "XYZ",
    });
    expect(entry).toEqual({
      code: "XYZ",
      format: "qr_code",
      entityType: "unknown",
    });
    // entityId / entityName MUST be absent (not just undefined) in not_found branch
    expect("entityId" in entry).toBe(false);
    expect("entityName" in entry).toBe(false);
  });

  it("Test 9b: createHistoryEntry populates entityId/entityName for a found match", async () => {
    const mod = await import("../scan-history");
    const entry = mod.createHistoryEntry("ABC", "ean_13", {
      type: "item",
      entity: { id: "i-1", name: "Hex Bolts" },
    });
    expect(entry).toEqual({
      code: "ABC",
      format: "ean_13",
      entityType: "item",
      entityId: "i-1",
      entityName: "Hex Bolts",
    });
  });

  it("Test 10a: formatScanTime returns 'Just now' for Date.now()", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
    const mod = await import("../scan-history");
    expect(mod.formatScanTime(Date.now())).toBe("Just now");
  });

  it("Test 10b: formatScanTime returns 'N min ago' for ~N minutes ago", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
    const mod = await import("../scan-history");
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    expect(mod.formatScanTime(fiveMinAgo)).toBe("5 min ago");
  });

  it("Test 10c: formatScanTime returns 'N hr ago' for ~N hours ago", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
    const mod = await import("../scan-history");
    const threeHrAgo = Date.now() - 3 * 60 * 60 * 1000;
    expect(mod.formatScanTime(threeHrAgo)).toBe("3 hr ago");
  });

  it("Test 10d: formatScanTime uses locale date for entries > 24 hours old", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
    const mod = await import("../scan-history");
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const formatted = mod.formatScanTime(twoDaysAgo);
    // Should not be a relative string
    expect(formatted).not.toMatch(/^(Just now|\d+ min ago|\d+ hr ago)$/);
    // Should contain a numeric day (locale-dependent formatting; don't over-assert)
    expect(formatted.length).toBeGreaterThan(0);
  });
});
