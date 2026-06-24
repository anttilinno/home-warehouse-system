import { describe, expect, it } from "vitest";
import { generateShortCode } from "./generateShortCode";

describe("generateShortCode", () => {
  it("returns 8 lowercase hex chars (within the schema's 4-8 rule)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode();
      expect(code).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("is effectively unique across calls (no collision in a small batch)", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateShortCode()),
    );
    expect(codes.size).toBe(200);
  });
});
