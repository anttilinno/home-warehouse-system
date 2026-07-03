import { describe, expect, it } from "vitest";
import { generateShortCode } from "./shortCode";

describe("generateShortCode", () => {
  it("returns an 8-char base62 code", () => {
    expect(generateShortCode()).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it("is unique across 1000 calls", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateShortCode));
    expect(codes.size).toBe(1000);
  });
});
