import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deriveShortCode } from "../actions/shortCode";

describe("deriveShortCode", () => {
  beforeEach(() => {
    // Deterministic suffix: Math.random() => 0.5 => floor(100 + 450) = 550
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns PREFIX-NNN for typical multi-word input", () => {
    expect(deriveShortCode("Garage Shelf 1")).toMatch(/^GAR-\d{3}$/);
  });

  it("upper-cases single-char inputs and pads suffix to 3 digits", () => {
    const result = deriveShortCode("x");
    expect(result).toMatch(/^X-\d{3}$/);
    expect(result).toHaveLength(5);
  });

  it("returns empty string for empty input", () => {
    expect(deriveShortCode("")).toBe("");
  });

  it("returns empty string when only non-alphanumerics remain", () => {
    expect(deriveShortCode("  !!@#")).toBe("");
  });

  it("strips non-alphanumerics and keeps first 3 alphanumerics", () => {
    // '1-2-3 test' -> stripped '123test' -> prefix '123'
    expect(deriveShortCode("1-2-3 test")).toMatch(/^123-\d{3}$/);
  });

  it("always returns an uppercase prefix", () => {
    const out = deriveShortCode("abc");
    const prefix = out.split("-")[0];
    expect(prefix).toBe(prefix.toUpperCase());
    expect(prefix).toBe("ABC");
  });
});
