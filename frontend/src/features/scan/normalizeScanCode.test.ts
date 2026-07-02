import { describe, expect, it } from "vitest";
import { normalizeScanCode } from "./normalizeScanCode";

describe("normalizeScanCode", () => {
  it("strips the s.go shortlink host to the bare code", () => {
    expect(normalizeScanCode("s.go/ABCD")).toBe("ABCD");
    expect(normalizeScanCode("https://s.go/AB12cd")).toBe("AB12cd");
    expect(normalizeScanCode("http://www.s.go/WXYZ")).toBe("WXYZ");
  });

  it("tolerates a trailing slash, uppercase host and surrounding whitespace", () => {
    expect(normalizeScanCode("S.GO/abcd/")).toBe("abcd");
    expect(normalizeScanCode("  s.go/BOX9  ")).toBe("BOX9");
  });

  it("passes non-shortlink payloads through untouched", () => {
    // Product EAN barcode.
    expect(normalizeScanCode("5449000000996")).toBe("5449000000996");
    // Already-bare code (manual entry).
    expect(normalizeScanCode("BOX9")).toBe("BOX9");
    // Some other URL / QR payload.
    expect(normalizeScanCode("https://example.com/x")).toBe(
      "https://example.com/x",
    );
    // s.go but the code fails the 4-12 rule → not a valid shortlink, left raw.
    expect(normalizeScanCode("s.go/AB")).toBe("s.go/AB");
  });
});
