import { describe, expect, it } from "vitest";
import {
  INVALIDATION_MAP,
  KNOWN_EVENT_TYPES,
  prefixesFor,
} from "./invalidationMap";

// EventSource matches event names EXACTLY, and SSEProvider registers exactly one
// addEventListener per KNOWN_EVENT_TYPES entry. So a backend `type` missing from
// that list is never delivered to the browser at all — no error, no warning, the
// UI just never refreshes. A map row without a listener is equally dead. These
// tests pin both halves of the contract.

describe("KNOWN_EVENT_TYPES", () => {
  // Regression: these were published by the backend but had no listener, so the
  // events were silently dropped. maintenance.* / wishlist.* had been dropped
  // since those features landed; loan.deleted and inventory.moved arrived with
  // the approval-pipeline entity events and the MOVE activity mapping.
  it.each([
    "inventory.moved",
    "loan.deleted",
    "maintenance.created",
    "maintenance.updated",
    "maintenance.completed",
    "wishlist.created",
    "wishlist.updated",
  ])("listens for %s", (eventType) => {
    expect(KNOWN_EVENT_TYPES).toContain(eventType);
  });

  it("has no duplicate entries (a duplicate registers two listeners)", () => {
    expect(new Set(KNOWN_EVENT_TYPES).size).toBe(KNOWN_EVENT_TYPES.length);
  });
});

describe("INVALIDATION_MAP", () => {
  it.each([
    ["maintenance", ["maintenance"]],
    ["wishlist", ["wishlist"]],
  ])("invalidates %s queries", (entityType, expectedPrefix) => {
    expect(prefixesFor(entityType)).toEqual([expectedPrefix]);
  });

  // A row whose entity never appears in KNOWN_EVENT_TYPES can never fire: the
  // dispatcher only runs from a registered listener.
  it("every mapped entity has at least one event listener", () => {
    const orphans = Object.keys(INVALIDATION_MAP).filter(
      (entity) =>
        !KNOWN_EVENT_TYPES.some((type) => type.startsWith(`${entity}.`)),
    );
    expect(orphans).toEqual([]);
  });

  it("lowercases the uppercase ITEM outlier", () => {
    expect(prefixesFor("ITEM")).toEqual([["items"]]);
  });

  it("is a forward-compatible no-op for unknown entity types", () => {
    expect(prefixesFor("nonesuch")).toEqual([]);
  });
});
