import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime";

// DASH-02 part a: the activity-table time formatter. `now` is injected so the
// boundaries are deterministic. Under 24h → relative ("Nm ago" / "Nh ago");
// at/after 24h → an absolute "YYYY-MM-DD HH:mm" string (I18N-03: the pure default
// token shape; formatRelativeTime is a pure fn so it cannot read the user's
// preference hook — it uses DEFAULT_FORMAT_TOKENS).
const NOW = new Date("2026-06-13T12:00:00Z");

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

describe("formatRelativeTime", () => {
  it("under 60s → '<1m'", () => {
    expect(formatRelativeTime(ago(30 * SEC), NOW)).toBe("<1m");
  });

  it("5 minutes ago → '5m ago'", () => {
    expect(formatRelativeTime(ago(5 * MIN), NOW)).toBe("5m ago");
  });

  it("59 minutes ago → '59m ago' (still relative, under 24h)", () => {
    expect(formatRelativeTime(ago(59 * MIN), NOW)).toBe("59m ago");
  });

  it("3 hours ago → '3h ago'", () => {
    expect(formatRelativeTime(ago(3 * HOUR), NOW)).toBe("3h ago");
  });

  it("23 hours ago → '23h ago' (boundary: still relative)", () => {
    expect(formatRelativeTime(ago(23 * HOUR), NOW)).toBe("23h ago");
  });

  it("24 hours ago → an ABSOLUTE 'YYYY-MM-DD HH:mm' string (NOT 'ago')", () => {
    const out = formatRelativeTime(ago(24 * HOUR), NOW);
    expect(out).not.toMatch(/ago/);
    expect(out).not.toBe("<1m");
    // Default token shape: 24h before 2026-06-13T12:00Z is 2026-06-12 12:00.
    expect(out).toBe("2026-06-12 12:00");
  });

  it("much older (3 days) → absolute, NOT 'ago'", () => {
    expect(formatRelativeTime(ago(3 * 24 * HOUR), NOW)).not.toMatch(/ago/);
  });

  it("future / negative delta → '<1m' (guard against clock skew)", () => {
    expect(formatRelativeTime(ago(-5 * MIN), NOW)).toBe("<1m");
  });
});
