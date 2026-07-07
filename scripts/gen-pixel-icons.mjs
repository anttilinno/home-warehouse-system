import { readFileSync, writeFileSync } from "node:fs";
const dir = "frontend/node_modules/pixelarticons/svg";
// name → pixelarticons file (v2.2.0)
const map = {
  "app-windows": "app-windows",
  "chart-bar-big": "chart-bar-big",
  archive: "archive",
  "grid-3x3": "grid-3x3",
  clock: "clock",
  "map-pin": "map-pin",
  folder: "folder",
  bookmark: "bookmark",
  download: "download",
  users: "users",
  camera: "camera",
  check: "check",
  bulletlist: "bulletlist",
  heart: "heart",
  trash: "trash",
  upload: "upload",
  reload: "reload",
  "settings-2": "settings-2",
  zap: "zap",
  image: "image",
  // Chrome sweep (pictograph-glyph replacement): CTAs, toolbars, empty states.
  plus: "plus",
  search: "search",
  menu: "menu",
  "chevron-down": "chevron-down",
  "chevron-up": "chevron-up",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  pencil: "pencil",
  attachment: "attachment",
  file: "file",
  cancel: "cancel",
  "tool-case": "tool-case",
  repeat: "repeat",
  bell: "bell",
  "plus-box": "plus-box",
  "minus-box": "minus-box",
  minus: "minus",
};
const out = {};
for (const [name, file] of Object.entries(map)) {
  const svg = readFileSync(`${dir}/${file}.svg`, "utf8");
  const ds = [...svg.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]);
  if (!ds.length) throw new Error(`no paths in ${file}`);
  out[name] = ds;
}
const body =
  `// AUTO-GENERATED from pixelarticons@2.2.0 svgs — do not edit by hand.\n` +
  `// Regenerate (from repo root): node scripts/gen-pixel-icons.mjs (paths use the 24x24 grid,\n` +
  `// fill inherits currentColor). Only the ${Object.keys(out).length} icons the\n` +
  `// retro-OS chrome uses (sidebar nav + CTAs, toolbars, empty states) are\n` +
  `// bundled here — no runtime fetch, no CDN.\n` +
  `export type PixelIconName = ${Object.keys(out)
    .map((k) => `"${k}"`)
    .join(" | ")};\n\n` +
  `export const PIXEL_ICON_PATHS: Record<PixelIconName, readonly string[]> = ${JSON.stringify(
    out,
    null,
    2,
  )};\n`;
writeFileSync("frontend/src/components/retro/pixelIconPaths.ts", body);
console.log(`wrote ${Object.keys(out).length} icons`);
