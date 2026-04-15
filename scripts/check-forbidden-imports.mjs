#!/usr/bin/env node
// D-05 guard: blocks offline/sync/idb/serwist imports under frontend2/src/**.
// Exits 1 with a list of offenders; 0 if clean.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// Allow override for tests: first CLI arg = scan root.
const SCAN_ROOT = resolve(process.argv[2] || join(REPO_ROOT, "frontend2", "src"));

// Match only module specifiers inside `from '...'`, `from "..."`, `import('...')`, or `import("...")`
// Forbidden: exact `idb`, exact `serwist` / `@serwist/*`, or any specifier containing `offline` or `sync` (case-insensitive).
const SPECIFIER_RE = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const FORBIDDEN_EXACT = /^(?:idb|serwist|@serwist\/.+)$/i;
const FORBIDDEN_SUBSTR = /(offline|sync)/i;

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) { if (name !== "node_modules") yield* walk(p); }
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) yield p;
  }
}

const offenders = [];
for (const file of walk(SCAN_ROOT)) {
  const src = readFileSync(file, "utf8");
  SPECIFIER_RE.lastIndex = 0;
  let m;
  while ((m = SPECIFIER_RE.exec(src))) {
    const spec = m[1];
    if (FORBIDDEN_EXACT.test(spec) || FORBIDDEN_SUBSTR.test(spec)) {
      offenders.push(`${file}: imports "${spec}"`);
    }
  }
}

if (offenders.length) {
  console.error("Forbidden imports detected (Phase 56 D-05 — no offline/sync in v2.1):");
  for (const o of offenders) console.error("  - " + o);
  process.exit(1);
}
console.log(`check-forbidden-imports: OK (scanned ${SCAN_ROOT})`);
