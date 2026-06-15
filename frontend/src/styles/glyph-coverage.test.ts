import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// TOKEN-05 (coverage half). Repo-resident supply-chain guard: asserts the
// IBM Plex Mono data face still ships the woff2 subsets that Estonian +
// Russian glyphs route through, and that the face is actually wired in
// globals.css with the tabular-nums "no column drift" baseline.
//
// This is the AUTOMATABLE half of TOKEN-05. Perceived column drift is a
// documented MANUAL verification (02-VALIDATION.md) — deliberately NOT a
// brittle pixel/screenshot test here (02-RESEARCH.md Open Question 1).
//
// Pure-Node Vitest (mirrors tokens.test.ts): readFileSync + process.cwd()
// (= frontend2 package root = vitest cwd; import.meta.url is http-scheme
// under jsdom, so resolve from cwd instead).

const plexMonoFilesDir = join(
  process.cwd(),
  "node_modules/@fontsource/ibm-plex-mono/files",
);
const silkscreenDir = join(
  process.cwd(),
  "node_modules/@fontsource/silkscreen",
);

const globalsCss = readFileSync(
  join(process.cwd(), "src/styles/globals.css"),
  "utf8",
);

describe("TOKEN-05: IBM Plex Mono ships the data-column glyph subsets", () => {
  const plexMonoFiles = readdirSync(plexMonoFilesDir);

  it("ships a cyrillic woff2 subset (Russian glyphs route through it)", () => {
    const hasCyrillic = plexMonoFiles.some((f) =>
      /^ibm-plex-mono-cyrillic-\d+-normal\.woff2$/.test(f),
    );
    expect(hasCyrillic).toBe(true);
  });

  it("ships a latin-ext woff2 subset (Estonian õäöüšž route through it)", () => {
    const hasLatinExt = plexMonoFiles.some((f) =>
      /^ibm-plex-mono-latin-ext-\d+-normal\.woff2$/.test(f),
    );
    expect(hasLatinExt).toBe(true);
  });

  it("documents Silkscreen as latin-only display-only (no cyrillic subset)", () => {
    // Silkscreen is the pixel display face (titlebars/headings, >=16px upper).
    // It correctly ships NO cyrillic subset — running data is IBM Plex Mono's
    // job. Assert that absence so a future bump that quietly added a cyrillic
    // Silkscreen subset (and tempted misuse for data) is visible.
    const silkscreenFilesDir = join(silkscreenDir, "files");
    if (existsSync(silkscreenFilesDir)) {
      const silkscreenFiles = readdirSync(silkscreenFilesDir);
      const hasCyrillic = silkscreenFiles.some((f) =>
        /silkscreen-cyrillic/.test(f),
      );
      expect(hasCyrillic).toBe(false);
    } else {
      // No files/ dir at all is also a valid "no cyrillic subset" state.
      expect(existsSync(silkscreenFilesDir)).toBe(false);
    }
  });
});

describe("TOKEN-05: the data face is wired, not merely installed", () => {
  it("globals.css imports the ibm-plex-mono 400 weight CSS (pulls the subsets)", () => {
    expect(globalsCss).toContain("@fontsource/ibm-plex-mono/400.css");
  });

  it("globals.css declares tabular-nums on the mono data class (no column drift)", () => {
    // The "no column drift" baseline guarantee for numeric data columns.
    expect(globalsCss).toContain("font-variant-numeric: tabular-nums");
  });
});
