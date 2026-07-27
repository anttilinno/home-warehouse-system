import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shortCodesApi, shortCodeEntityPath } from "./shortCodes";

// Mirrors the items.test.ts fetch-stub pattern so the exact URL shape is
// asserted (path-injection guard, no case normalization).

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const MATCH = {
  entity_type: "location" as const,
  entity_id: "loc-1",
  name: "Garage shelf B",
};

describe("shortCodesApi.resolve", () => {
  it("resolves a code, preserving case", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MATCH));

    await expect(shortCodesApi.resolve("ws-1", "7F3K2A")).resolves.toEqual(
      MATCH,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/ws-1/short-codes/7F3K2A",
    );
  });

  it("returns null on 404 (unknown or foreign-workspace code)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "short code not found" }, 404),
    );

    await expect(shortCodesApi.resolve("ws-1", "ZZZZ99")).resolves.toBeNull();
  });

  it("rethrows a 500", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500));

    await expect(shortCodesApi.resolve("ws-1", "7F3K2A")).rejects.toThrow();
  });

  it("escapes a path-traversal code", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(MATCH));

    await shortCodesApi.resolve("ws-1", "../../items");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/ws-1/short-codes/..%2F..%2Fitems",
    );
  });
});

describe("shortCodeEntityPath", () => {
  it("maps each entity type onto a v3 route", () => {
    expect(shortCodeEntityPath({ ...MATCH, entity_type: "item" })).toBe(
      "/items/loc-1",
    );
    expect(shortCodeEntityPath(MATCH)).toBe(
      "/taxonomy?tab=locations&focus=loc-1",
    );
    expect(shortCodeEntityPath({ ...MATCH, entity_type: "container" })).toBe(
      "/taxonomy?tab=containers&focus=loc-1",
    );
  });
});
