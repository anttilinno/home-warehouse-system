#!/usr/bin/env node
// ONE-OFF codemod (frontend-audit-fixes): migrate arbitrary typography
// utilities to the centralised token scale defined in src/styles/tokens.css.
//   text-[14px]      -> text-14
//   text-sm          -> text-14   (collapse the lone Tailwind-default size in
//                                   use into the single numeric scale)
//   tracking-[0.08em]-> tracking-8 (hundredths of em)
// Idempotent: re-running is a no-op. Scans *.tsx (incl. tests, so className
// assertions migrate in lockstep). The regex only matches digit+px / Nem, so
// regex-literal strings like /text-[a-z-]/ in tests are never touched.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCAN_ROOT = resolve(
  process.argv[2] || join(__dirname, "..", "frontend", "src"),
);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name !== "node_modules") yield* walk(p);
    } else if (name.endsWith(".tsx")) {
      yield p;
    }
  }
}

function transform(src) {
  return src
    .replace(/text-\[(\d+)px\]/g, (_, px) => `text-${px}`)
    .replace(/\btext-sm\b/g, "text-14")
    .replace(
      /tracking-\[([\d.]+)em\]/g,
      (_, em) => `tracking-${Math.round(parseFloat(em) * 100)}`,
    );
}

let changed = 0;
for (const file of walk(SCAN_ROOT)) {
  const src = readFileSync(file, "utf8");
  const out = transform(src);
  if (out !== src) {
    writeFileSync(file, out);
    changed++;
  }
}
console.log(`codemod-type-tokens: rewrote ${changed} file(s)`);
