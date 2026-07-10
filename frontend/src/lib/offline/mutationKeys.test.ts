import { describe, expect, it } from "vitest";
import { MK } from "./mutationKeys";

describe("MK", () => {
  it("each key is a stable two-segment tuple, matching mutationDefaults' registration keys", () => {
    expect(MK.itemCreate).toEqual(["items", "create"]);
    expect(MK.containerCreate).toEqual(["containers", "create"]);
    expect(MK.locationCreate).toEqual(["locations", "create"]);
    expect(MK.inventoryQuantity).toEqual(["inventory", "quantity"]);
    expect(MK.inventoryCreate).toEqual(["inventory", "create"]);
  });

  it("returns the same array reference across accesses — a persisted mutation resumes by matching this key, not a closure", () => {
    expect(MK.itemCreate).toBe(MK.itemCreate);
  });

  it("keeps every key distinct so mutationDefaults registrations don't collide", () => {
    const keys = Object.values(MK).map((k) => k.join("/"));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
