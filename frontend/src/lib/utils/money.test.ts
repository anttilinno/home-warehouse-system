import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

// Phase 10b Plan 01 Task 1 — cents → currency display contract. formatCents is
// DISPLAY-ONLY: it never produces a value that flows back to the API (T-10b-01).
// Assertions check the numeric content + currency presence, not exact glyph
// placement, since Intl formatting varies by runtime locale data.
describe("formatCents", () => {
  it("formats EUR cents to a major-unit string with the EUR symbol", () => {
    const out = formatCents(4250, "EUR");
    expect(out).toContain("42.50");
    expect(out).toMatch(/€|EUR/);
  });

  it("formats USD cents to a major-unit string with the USD symbol", () => {
    const out = formatCents(4250, "USD");
    expect(out).toContain("42.50");
    expect(out).toMatch(/\$|USD/);
  });

  it("formats zero as a zero currency string (default EUR)", () => {
    const out = formatCents(0);
    expect(out).toContain("0.00");
    expect(out).toMatch(/€|EUR/);
  });

  it("falls back to EUR when currency is undefined", () => {
    const out = formatCents(1234, undefined);
    expect(out).toContain("12.34");
    expect(out).toMatch(/€|EUR/);
  });
});
