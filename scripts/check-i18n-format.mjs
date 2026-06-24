#!/usr/bin/env node
// D-4 guard: blocks raw locale date/time formatting in frontend/src/features +
// frontend/src/components. All user-facing date/time rendering must go through the
// centralized format layer (src/lib/format/) so it honours the active i18n locale.
//
// FAILS (exit 1) on any line containing:
//   - `.toLocaleDateString(`
//   - `.toLocaleTimeString(`
//   - `.toLocaleString(`
//   - a Date `.toString()` form (narrow: `new Date(...)....toString()` / `<ident>Date.toString()`)
// EXCEPT:
//   - lines tagged `// i18n-format-ignore`
//   - files under `src/lib/format/`
//   - `*.test.*` files
// Does NOT flag `Intl.NumberFormat` (money formatting is locale-stable currency).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// Default scan roots: features + components. A single optional CLI arg overrides
// to a single root (used by the self-test against fixture dirs).
const SCAN_ROOTS = process.argv[2]
  ? [resolve(process.argv[2])]
  : [
      resolve(REPO_ROOT, "frontend", "src", "features"),
      resolve(REPO_ROOT, "frontend", "src", "components"),
    ];

// Match raw locale formatting calls.
const LOCALE_CALL_RE = /\.toLocale(?:Date|Time)?String\s*\(/;
// Narrow Date.toString() match: only when a Date construction/identifier precedes it
// on the same line. Conservative on purpose — bare `.toString()` is NOT flagged to
// avoid false positives (numbers, ids, etc.).
const DATE_TOSTRING_RE = /(?:new\s+Date\s*\([^)]*\)|[A-Za-z_$][\w$]*Date)[^;]*\.toString\s*\(\s*\)/;

const IGNORE_TAG = "// i18n-format-ignore";

function isExempt(path) {
  // Skip the centralized format layer and any test files.
  if (path.includes(`${sep}lib${sep}format${sep}`)) return true;
  if (/\.test\.[cm]?[jt]sx?$/.test(path)) return true;
  return false;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name !== "node_modules") yield* walk(p);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) {
      yield p;
    }
  }
}

const offenders = [];
for (const root of SCAN_ROOTS) {
  let exists = true;
  try {
    statSync(root);
  } catch {
    exists = false;
  }
  if (!exists) continue; // a missing default root (e.g. no components dir) is not fatal
  for (const file of walk(root)) {
    if (isExempt(file)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(IGNORE_TAG)) continue;
      if (LOCALE_CALL_RE.test(line) || DATE_TOSTRING_RE.test(line)) {
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      }
    }
  }
}

if (offenders.length) {
  console.error(
    "Raw locale date/time formatting detected (Phase 15 D-4 — route through src/lib/format/):",
  );
  for (const o of offenders) console.error("  - " + o);
  console.error(
    "\nFix: use the centralized format helpers, or tag the line `// i18n-format-ignore` if intentional.",
  );
  process.exit(1);
}
console.log(`check-i18n-format: OK (scanned ${SCAN_ROOTS.join(", ")})`);
