import { describe, it, expect } from "vitest";
import {
  formatDateToken,
  formatTimeToken,
  formatNumberToken,
  formatMonthYearToken,
  DEFAULT_FORMAT_TOKENS,
} from "./tokens";

// A fixed UTC instant: 2026-06-13T14:32:00Z. All assertions below assume UTC
// decomposition (getUTC*), matching MovementsPanel's existing convention, so the
// rendered day/time never shifts with the runner's local timezone.
const ISO = "2026-06-13T14:32:00Z";

describe("formatDateToken", () => {
  it("renders YYYY-MM-DD", () => {
    expect(formatDateToken(ISO, "YYYY-MM-DD")).toBe("2026-06-13");
  });
  it("renders DD/MM/YYYY", () => {
    expect(formatDateToken(ISO, "DD/MM/YYYY")).toBe("13/06/2026");
  });
  it("renders MM/DD/YYYY", () => {
    expect(formatDateToken(ISO, "MM/DD/YYYY")).toBe("06/13/2026");
  });
  it("renders DD.MM.YYYY", () => {
    expect(formatDateToken(ISO, "DD.MM.YYYY")).toBe("13.06.2026");
  });
  it("falls back to YYYY-MM-DD shape for an unknown token", () => {
    expect(formatDateToken(ISO, "bogus")).toBe("2026-06-13");
  });
  it("falls back to YYYY-MM-DD shape for an undefined token", () => {
    expect(formatDateToken(ISO)).toBe("2026-06-13");
  });
  it("passes through an invalid ISO unchanged", () => {
    expect(formatDateToken("not-a-date", "DD/MM/YYYY")).toBe("not-a-date");
  });
});

describe("formatTimeToken", () => {
  it("renders 24-hour HH:mm", () => {
    expect(formatTimeToken(ISO, "HH:mm")).toBe("14:32");
  });
  it("renders 12-hour h:mm A (PM)", () => {
    expect(formatTimeToken(ISO, "h:mm A")).toBe("2:32 PM");
  });
  it("renders midnight as 12:xx AM in h:mm A", () => {
    expect(formatTimeToken("2026-06-13T00:05:00Z", "h:mm A")).toBe("12:05 AM");
  });
  it("falls back to HH:mm for an undefined token", () => {
    expect(formatTimeToken(ISO)).toBe("14:32");
  });
  it("passes through an invalid ISO unchanged", () => {
    expect(formatTimeToken("not-a-date", "HH:mm")).toBe("not-a-date");
  });
});

describe("formatNumberToken", () => {
  it("groups with space + comma decimal", () => {
    expect(
      formatNumberToken(1234567.89, { thousand: " ", decimal: "," }),
    ).toBe("1 234 567,89");
  });
  it("groups with comma + period decimal", () => {
    expect(
      formatNumberToken(1234567.89, { thousand: ",", decimal: "." }),
    ).toBe("1,234,567.89");
  });
  it("renders an integer with no decimal portion", () => {
    expect(
      formatNumberToken(1234567, { thousand: ".", decimal: "," }),
    ).toBe("1.234.567");
  });
  it("renders no grouping when thousand is empty", () => {
    expect(formatNumberToken(1234567.89, { thousand: "", decimal: "." })).toBe(
      "1234567.89",
    );
  });
  it("uses defaults when seps are omitted", () => {
    expect(formatNumberToken(1234567.89)).toBe("1 234 567,89");
  });
  it("does not throw on NaN and returns a safe string", () => {
    expect(() => formatNumberToken(NaN)).not.toThrow();
    expect(formatNumberToken(NaN)).toBe("");
  });
  it("preserves a leading minus sign on negatives", () => {
    expect(
      formatNumberToken(-1234.5, { thousand: " ", decimal: "," }),
    ).toBe("-1 234,5");
  });
});

describe("formatMonthYearToken", () => {
  it("derives the YYYY-MM month/year slice from an ISO month string", () => {
    expect(formatMonthYearToken("2026-06")).toBe("2026-06");
  });
  it("passes through an invalid input unchanged", () => {
    expect(formatMonthYearToken("not-a-date")).toBe("not-a-date");
  });
});

describe("DEFAULT_FORMAT_TOKENS", () => {
  it("matches the RegionalFormatsPage defaults", () => {
    expect(DEFAULT_FORMAT_TOKENS).toEqual({
      date_format: "YYYY-MM-DD",
      time_format: "HH:mm",
      thousand_separator: " ",
      decimal_separator: ",",
    });
  });
});
