#!/usr/bin/env node
// Design-system guard: blocks NEW arbitrary typography utilities in *.tsx so
// the token scale in src/styles/tokens.css stays the single source of truth.
// Bans  text-[<n>px]  and  tracking-[<n>em]  — use text-12 / tracking-8 etc.
// (See scripts/codemod-type-tokens.mjs for the original migration.)
// Exits 1 with the offender list; 0 if clean.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SCAN_ROOT = resolve(
  process.argv[2] || join(REPO_ROOT, "frontend", "src"),
);

try {
  statSync(SCAN_ROOT);
} catch {
  console.error(`check-arbitrary-typography: scan root not found: ${SCAN_ROOT}`);
  process.exit(1);
}

// Precise: only digit+px font sizes and Nem letter-spacing. Regex literals such
// as /text-[a-z-]/ in tests do not match and are intentionally not flagged.
const BANNED = [
  { re: /text-\[\d+px\]/g, hint: "use the text-<px> scale (e.g. text-12)" },
  {
    re: /tracking-\[[\d.]+em\]/g,
    hint: "use the tracking-<hundredths> scale (e.g. tracking-8)",
  },
];

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

const offenders = [];
for (const file of walk(SCAN_ROOT)) {
  const src = readFileSync(file, "utf8");
  for (const { re, hint } of BANNED) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      offenders.push(`${file}: "${m[0]}" — ${hint}`);
    }
  }
}

if (offenders.length) {
  console.error("Arbitrary typography utilities detected (tokenise them):");
  for (const o of offenders) console.error("  - " + o);
  process.exit(1);
}
console.log(`check-arbitrary-typography: OK (scanned ${SCAN_ROOT})`);
