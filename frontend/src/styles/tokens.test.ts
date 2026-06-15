import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WCAG AA regression guard for the retro-os pastel palette (D-06, revised
// 2026-06-11). Token values are PARSED from tokens.css — editing a hex there
// that breaks AA fails this test; there is no duplicated palette to drift.
// Pure WCAG 2.x formula, no DOM.

// import.meta.url is http-scheme under the jsdom environment, so resolve
// from the package root (vitest cwd) instead.
const tokensCss = readFileSync(
  join(process.cwd(), "src/styles/tokens.css"),
  "utf8",
);

function token(name: string): string {
  const match = tokensCss.match(
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`),
  );
  if (!match) throw new Error(`token --${name} not found in tokens.css`);
  return match[1].toLowerCase();
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe("retro-os pastel tokens meet WCAG AA (>= 4.5:1)", () => {
  const pairs: Array<[fgToken: string, bgToken: string]> = [
    ["fg-ink", "bg-panel"],
    ["fg-ink", "bg-desktop"],
    ["fg-muted", "bg-panel"],
    ["fg-muted", "bg-desktop"],
    ["fg-ink", "titlebar-blue"],
    ["fg-ink", "titlebar-pink"],
    ["fg-ink", "titlebar-mint"],
    ["fg-ink", "titlebar-butter"],
    ["accent-blue-deep", "bg-panel"],
    ["accent-pink-deep", "bg-panel"],
    ["accent-mint-deep", "bg-panel"],
    ["warn-deep", "bg-panel"],
    ["accent-blue-deep", "bg-desktop"],
    ["accent-pink-deep", "bg-desktop"],
    ["danger", "danger-bg"],
  ];

  it.each(pairs)("%s on %s", (fgToken, bgToken) => {
    expect(
      contrastRatio(token(fgToken), token(bgToken)),
    ).toBeGreaterThanOrEqual(AA);
  });

  it("sanity: formula reproduces the canonical black/white ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
});
