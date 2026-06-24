#!/usr/bin/env node
// POL-04 guard: per-chunk bundle-size budget enforcement.
// Reads frontend/bundle-budget.json (gzip-byte ceilings), measures the gzipped
// size of every *.js in a dist assets dir, buckets each file by filename prefix
// into a logical chunk, and FAILS (exit 1) if any bucket exceeds its ceiling.
// Prints a `chunk: cur/budget (Δ <signed bytes vs budget>)` delta report.
//
// Bucketing rules (filename prefix -> logical chunk):
//   index-*.js     -> main
//   charts-*.js    -> charts
//   scanner-*.js   -> scanner
//   palette-*.js   -> palette
//   messages-*.js  -> messages
//   anything else (e.g. *Page-*.js) -> ignored, never an error.
//
// messages is PER-LOCALE: the en/et/ru catalogs are alternates (only one loads
// at a time), so the bucket value is the LARGEST single messages-*.js gz size,
// NOT the sum. Every other bucket sums same-prefix files (defensive; normally one).
// A budgeted chunk with no matching file = 0 bytes (under budget) — noted, never
// a crash (lazy chunks can legitimately be absent).
//
// Usage:
//   node check-bundle-budget.mjs              # real build: frontend/dist/assets
//   node check-bundle-budget.mjs <dir>        # measure <dir>/*.js (self-test)
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// The manifest path is FIXED (always the committed repo manifest), independent of
// the measured dir.
const MANIFEST_PATH = resolve(REPO_ROOT, "frontend", "bundle-budget.json");

// Optional positional arg: a directory of *.js files to measure. Default = the
// real vite build output.
const dirArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
const ASSETS_DIR = dirArg ? resolve(dirArg) : resolve(REPO_ROOT, "frontend", "dist", "assets");

// filename prefix -> logical chunk key. Order does not matter (prefixes disjoint).
const PREFIX_TO_CHUNK = [
  ["index-", "main"],
  ["charts-", "charts"],
  ["scanner-", "scanner"],
  ["palette-", "palette"],
  ["messages-", "messages"],
];

function chunkForFile(name) {
  for (const [prefix, chunk] of PREFIX_TO_CHUNK) {
    if (name.startsWith(prefix)) return chunk;
  }
  return null; // unbudgeted (e.g. *Page-*.js) — ignored
}

// ---- load manifest ----
let budgets;
try {
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  budgets = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_")) continue; // _comment etc.
    budgets[k] = v;
  }
} catch (err) {
  console.error(`check-bundle-budget: cannot read manifest ${MANIFEST_PATH}: ${err.message}`);
  process.exit(1);
}

// ---- measure assets ----
let files = [];
try {
  files = readdirSync(ASSETS_DIR).filter((f) => f.endsWith(".js"));
} catch (err) {
  console.error(`check-bundle-budget: cannot read assets dir ${ASSETS_DIR}: ${err.message}`);
  process.exit(1);
}

// Per-chunk accumulator. For "messages" we keep the MAX single file; everything
// else sums. Track which buckets actually saw a file (for the missing-chunk note).
const measured = {};
const seen = {};
for (const chunk of Object.keys(budgets)) {
  measured[chunk] = 0;
  seen[chunk] = false;
}

for (const name of files) {
  const chunk = chunkForFile(name);
  if (!chunk || !(chunk in budgets)) continue; // ignored / unbudgeted
  const gz = gzipSync(readFileSync(resolve(ASSETS_DIR, name))).length;
  seen[chunk] = true;
  if (chunk === "messages") {
    measured[chunk] = Math.max(measured[chunk], gz); // per-locale: largest single
  } else {
    measured[chunk] += gz; // sum same-prefix (normally one file)
  }
}

// ---- delta report + verdict ----
const over = [];
const lines = [];
for (const chunk of Object.keys(budgets)) {
  const cur = measured[chunk];
  const budget = budgets[chunk];
  const delta = cur - budget; // signed: negative = headroom, positive = overage
  const sign = delta >= 0 ? "+" : "";
  const note = seen[chunk] ? "" : "  (no matching file — counted as 0)";
  lines.push(`  ${chunk}: ${cur}/${budget} (${sign}${delta})${note}`);
  if (delta > 0) over.push(chunk);
}

console.log(`check-bundle-budget: measuring ${ASSETS_DIR}`);
for (const line of lines) console.log(line);

if (over.length) {
  console.error(`check-bundle-budget: OVER BUDGET (POL-04): ${over.join(", ")}`);
  for (const chunk of over) {
    const delta = measured[chunk] - budgets[chunk];
    console.error(`  - ${chunk}: ${measured[chunk]}/${budgets[chunk]} (+${delta} bytes over)`);
  }
  process.exit(1);
}

console.log(`check-bundle-budget: OK — all ${Object.keys(budgets).length} chunks within budget.`);
