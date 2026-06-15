import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SWATCHES } from "./ColorSwatchPicker";

// Single-source-of-truth guard: every swatch hex must equal the CSS var it
// claims to mirror in tokens.css. Before this test the palette was duplicated
// by hand and had already drifted ("Deep mint" → #1e6b43 vs the AA-nudged
// --accent-mint-deep #1a5e3a). Parsing tokens.css here makes that impossible.
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

describe("ColorSwatchPicker palette stays in sync with tokens.css", () => {
  it.each(SWATCHES)("$label ($token) matches its CSS var", (swatch) => {
    expect(swatch.hex.toLowerCase()).toBe(token(swatch.token));
  });
});
