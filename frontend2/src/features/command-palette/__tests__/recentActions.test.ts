import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addRecent, getRecent, type RecentEntry } from "../recentActions";

// TUI-05 / §4 — the localStorage MRU backing the palette "Recent" group. Mirrors
// scan-history.ts: safe-parse (never throws on stale data), de-dup by id, cap 10,
// newest first. Storage key "hws-palette-recent". (T-16-04: tamperable store →
// read-side must drop malformed entries.)

const KEY = "hws-palette-recent";

function makeEntry(id: string): RecentEntry {
  return { id, kind: "route", label: `Label ${id}`, to: `/x/${id}` };
}

describe("recentActions MRU", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns [] when the key is missing", () => {
    expect(getRecent()).toEqual([]);
  });

  it("returns [] on malformed JSON (never throws)", () => {
    localStorage.setItem(KEY, "{not json");
    expect(getRecent()).toEqual([]);
  });

  it("returns [] when the payload is not an array", () => {
    localStorage.setItem(KEY, JSON.stringify({ id: "x" }));
    expect(getRecent()).toEqual([]);
  });

  it("drops malformed entries but keeps valid ones", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: "good", kind: "item", label: "Good" },
        { nope: true },
        { id: 5, kind: "item", label: "bad-id" },
        null,
      ]),
    );
    const recent = getRecent();
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe("good");
  });

  it("prepends new entries newest-first", () => {
    addRecent(makeEntry("a"));
    addRecent(makeEntry("b"));
    const recent = getRecent();
    expect(recent.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("de-dups by id, moving the re-added entry to the top", () => {
    addRecent(makeEntry("a"));
    addRecent(makeEntry("b"));
    addRecent(makeEntry("a"));
    const recent = getRecent();
    expect(recent.map((r) => r.id)).toEqual(["a", "b"]);
    expect(recent).toHaveLength(2);
  });

  it("caps the list at 10 (newest kept, oldest dropped)", () => {
    for (let i = 0; i < 15; i += 1) {
      addRecent(makeEntry(String(i)));
    }
    const recent = getRecent();
    expect(recent).toHaveLength(10);
    // newest is "14", oldest kept is "5" (0..4 dropped).
    expect(recent[0].id).toBe("14");
    expect(recent[recent.length - 1].id).toBe("5");
  });

  it("persists under the hws-palette-recent key", () => {
    addRecent(makeEntry("a"));
    expect(localStorage.getItem(KEY)).not.toBeNull();
    const raw = JSON.parse(localStorage.getItem(KEY) as string);
    expect(Array.isArray(raw)).toBe(true);
    expect(raw[0].id).toBe("a");
  });
});
