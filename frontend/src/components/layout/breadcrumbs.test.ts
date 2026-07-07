import { describe, expect, it } from "vitest";
import { buildCrumbs } from "./breadcrumbs";

// Assert the crumb SHAPE (chain length + `to` link targets) — the labels are
// opaque <Trans> nodes, but the prefix-matching + link wiring is the risky bit.
describe("buildCrumbs", () => {
  const tos = (path: string, search = "") =>
    buildCrumbs(path, search).map((c) => c.to);

  it("dashboard root → OVERVIEW › (leaf)", () => {
    expect(tos("/")).toEqual(["/", undefined]);
  });

  it("list route → group link + section leaf (no link)", () => {
    expect(tos("/items")).toEqual(["/items", undefined]);
    expect(tos("/wishlist")).toEqual(["/maintenance/due", undefined]);
  });

  it("detail/new/edit → group + section links + modifier leaf", () => {
    expect(tos("/items/123")).toEqual(["/items", "/items", undefined]);
    expect(tos("/items/new")).toEqual(["/items", "/items", undefined]);
    expect(tos("/items/123/edit")).toEqual(["/items", "/items", undefined]);
  });

  it("longest-prefix wins (/maintenance/due, not a shorter prefix)", () => {
    expect(buildCrumbs("/maintenance/due")).toHaveLength(2);
    expect(tos("/maintenance/due")).toEqual(["/maintenance/due", undefined]);
  });

  it("settings subpage → SYSTEM › SETTINGS › subpage", () => {
    expect(tos("/settings/members")).toEqual([
      "/settings",
      "/settings",
      undefined,
    ]);
    expect(tos("/settings")).toEqual(["/settings", undefined]);
  });

  it("taxonomy leaf reads the ?tab (2 crumbs, group-linked)", () => {
    expect(tos("/taxonomy", "?tab=locations")).toEqual(["/items", undefined]);
  });

  it("unknown path falls back to the OVERVIEW root", () => {
    expect(tos("/nope")).toEqual(["/"]);
  });
});
