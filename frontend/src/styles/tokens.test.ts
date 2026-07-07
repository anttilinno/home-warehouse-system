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

// Dark-block parser: scope the (non-global) regex to the `[data-theme="dark"]{…}`
// substring so a dark override of a token resolves to the DARK value, not the
// first (:root) occurrence. Tokens NOT overridden in the dark block (pastels,
// fg-on-accent) are read from :root via token() — they deliberately don't flip.
const darkStart = tokensCss.indexOf('[data-theme="dark"]');
const darkBlock = darkStart === -1 ? "" : tokensCss.slice(darkStart);

function darkToken(name: string): string {
  const match = darkBlock.match(
    new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`),
  );
  if (!match) {
    throw new Error(`token --${name} not found in [data-theme="dark"] block`);
  }
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

describe("dark-mode tokens meet WCAG AA (>= 4.5:1)", () => {
  // [fg, bg] where each entry is [tokenName, scope]; "dark" reads the
  // [data-theme="dark"] override, "root" reads the non-flipping :root value
  // (pastels + on-accent stay light in dark mode by design).
  type Ref = [name: string, scope: "dark" | "root"];
  const get = ([name, scope]: Ref) =>
    scope === "dark" ? darkToken(name) : token(name);

  const pairs: Array<[fg: Ref, bg: Ref]> = [
    // Body + secondary text on the dark surfaces.
    [
      ["fg-ink", "dark"],
      ["bg-panel", "dark"],
    ],
    [
      ["fg-ink", "dark"],
      ["bg-desktop", "dark"],
    ],
    [
      ["fg-ink", "dark"],
      ["bg-panel-2", "dark"],
    ],
    [
      ["fg-muted", "dark"],
      ["bg-panel", "dark"],
    ],
    [
      ["fg-muted", "dark"],
      ["bg-desktop", "dark"],
    ],
    // Light deep companions as colored text on the dark panel.
    [
      ["accent-blue-deep", "dark"],
      ["bg-panel", "dark"],
    ],
    [
      ["accent-mint-deep", "dark"],
      ["bg-panel", "dark"],
    ],
    [
      ["warn-deep", "dark"],
      ["bg-panel", "dark"],
    ],
    // NOTE: accent-pink-deep/bg-panel and danger/danger-bg are NOT here — the 2a
    // Solarized mock pins those exact hexes at ~4.2:1 (just under AA). Design
    // fidelity wins; they get a documented near-AA floor below.
    // On-accent ink (NON-flipping) on each (NON-flipping) pastel — the chrome
    // and selected-row contract.
    [
      ["fg-on-accent", "root"],
      ["titlebar-blue", "root"],
    ],
    [
      ["fg-on-accent", "root"],
      ["titlebar-pink", "root"],
    ],
    [
      ["fg-on-accent", "root"],
      ["titlebar-mint", "root"],
    ],
    [
      ["fg-on-accent", "root"],
      ["titlebar-butter", "root"],
    ],
  ];

  it.each(pairs)("%s on %s", (fg, bg) => {
    expect(contrastRatio(get(fg), get(bg))).toBeGreaterThanOrEqual(AA);
  });

  // Design-fidelity exception: the 2a Solarized mock pins accent-pink-deep
  // (#dd6ea6) and danger (#e35f6b) on their dark surfaces at ~4.2:1 — just under
  // AA. The visual match to the approved mock takes precedence, but the pair
  // must still clear this near-AA floor so a future edit can't quietly regress
  // it to unreadable. If you raise the floor to 4.5, re-derive the two hexes.
  const NEAR_AA = 4.1;
  const exceptions: Array<[fg: Ref, bg: Ref]> = [
    [
      ["accent-pink-deep", "dark"],
      ["bg-panel", "dark"],
    ],
    [
      ["danger", "dark"],
      ["danger-bg", "dark"],
    ],
  ];
  it.each(exceptions)("%s on %s (mock exception, >= 4.1)", (fg, bg) => {
    const ratio = contrastRatio(get(fg), get(bg));
    expect(ratio).toBeGreaterThanOrEqual(NEAR_AA);
    expect(ratio).toBeLessThan(AA); // if this fails, promote it back into `pairs`
  });
});

// State fills (selection/active/online) must stay VISIBLE against the surface
// they sit on — a lower bar than text AA. The AA text-pair guards above cannot
// catch a state fill that vanishes into its background (the terminal-revision
// bug: --titlebar-blue went #131317, invisible on the #0b0b0e dark panels).
describe("state fills are distinguishable from their surface (>= 1.3:1)", () => {
  type Ref = [name: string, scope: "dark" | "root"];
  const get = ([name, scope]: Ref) =>
    scope === "dark" ? darkToken(name) : token(name);

  const FILL_MIN = 1.3;
  const fillPairs: Array<[label: string, fill: Ref, surface: Ref]> = [
    [
      "selection-fill vs bg-panel (light)",
      ["selection-fill", "root"],
      ["bg-panel", "root"],
    ],
    [
      "selection-fill vs bg-panel (dark)",
      ["selection-fill", "dark"],
      ["bg-panel", "dark"],
    ],
    [
      "selection-fill vs table-stripe (light)",
      ["selection-fill", "root"],
      ["table-stripe", "root"],
    ],
    [
      "selection-fill vs table-stripe (dark)",
      ["selection-fill", "dark"],
      ["table-stripe", "dark"],
    ],
    [
      "status-online vs bg-panel-2 (dark)",
      ["status-online", "dark"],
      ["bg-panel-2", "dark"],
    ],
    // Selected row (selection-fill) vs hovered row (info-bg) must not collide
    // in dark — a multi-select where both read identical is ambiguous.
    [
      "selection-fill vs info-bg (dark)",
      ["selection-fill", "dark"],
      ["info-bg", "dark"],
    ],
  ];

  it.each(fillPairs)("%s", (_label, fill, surface) => {
    expect(contrastRatio(get(fill), get(surface))).toBeGreaterThanOrEqual(
      FILL_MIN,
    );
  });
});

describe("text painted on the state fills meets WCAG AA (>= 4.5:1)", () => {
  type Ref = [name: string, scope: "dark" | "root"];
  const get = ([name, scope]: Ref) =>
    scope === "dark" ? darkToken(name) : token(name);

  const textPairs: Array<[label: string, fg: Ref, bg: Ref]> = [
    [
      "fg-ink on selection-fill (dark)",
      ["fg-ink", "dark"],
      ["selection-fill", "dark"],
    ],
    [
      "fg-on-accent on selection-fill (light)",
      ["fg-on-accent", "root"],
      ["selection-fill", "root"],
    ],
    [
      "selection-text-fg on selection-text-bg (light)",
      ["selection-text-fg", "root"],
      ["selection-text-bg", "root"],
    ],
    [
      "selection-text-fg on selection-text-bg (dark)",
      ["selection-text-fg", "dark"],
      ["selection-text-bg", "dark"],
    ],
  ];

  it.each(textPairs)("%s", (_label, fg, bg) => {
    expect(contrastRatio(get(fg), get(bg))).toBeGreaterThanOrEqual(AA);
  });
});
