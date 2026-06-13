import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "check-bundle-budget.mjs");

// Build a temp "dist/assets"-like dir of fixture *.js files.
// `files` is a map of filename -> byte length. We write INCOMPRESSIBLE random
// bytes so the gzip output size is ~= the raw size (predictable for budget math):
// crypto.randomBytes has no exploitable redundancy, so zlib only adds a small
// constant header/footer overhead (~20-30 bytes). Sizing fixtures a few KB clear
// of a ceiling keeps each case on the intended side of its budget.
function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), "bundle-budget-"));
  for (const [name, len] of Object.entries(files)) {
    writeFileSync(join(dir, name), randomBytes(len));
  }
  return dir;
}

function run(dir) {
  return spawnSync("node", [SCRIPT, dir], { encoding: "utf8" });
}

// Ceilings (mirror frontend2/bundle-budget.json):
//   main 215000, charts 120000, scanner 65000, palette 20000, messages 22000

test("all chunks under budget -> exit 0 with an OK summary", () => {
  const dir = tree({
    "index-abc.js": 180000,
    "charts-abc.js": 100000,
    "scanner-abc.js": 50000,
    "palette-abc.js": 12000,
    "messages-en-abc.js": 18000,
    "messages-et-abc.js": 15000,
    "messages-ru-abc.js": 14000,
  });
  const r = run(dir);
  assert.equal(r.status, 0, `expected exit 0. stderr=${r.stderr}`);
  assert.match(r.stdout, /main:/);
  assert.match(r.stdout, /OK/i);
});

test("one chunk over budget -> exit 1, names the chunk and shows a positive delta", () => {
  const dir = tree({
    "index-abc.js": 260000, // > 215000
    "charts-abc.js": 100000,
    "scanner-abc.js": 50000,
    "palette-abc.js": 12000,
    "messages-en-abc.js": 18000,
  });
  const r = run(dir);
  assert.equal(r.status, 1, `expected exit 1. stderr=${r.stderr}`);
  assert.match(r.stderr, /main/);
  // delta report includes a positive (+) signed byte overage on the offender
  assert.match(r.stderr + r.stdout, /main:.*\(\+\d+\)/);
});

test("messages bucket is per-locale (largest single), NOT additive -> three catalogs each under 22000 pass", () => {
  // 18000 + 16000 + 15000 = 49000 which would BLOW a 22000 budget if summed;
  // per-locale (max = 18000) it is comfortably under.
  const dir = tree({
    "index-abc.js": 180000,
    "messages-en-abc.js": 18000,
    "messages-et-abc.js": 16000,
    "messages-ru-abc.js": 15000,
  });
  const r = run(dir);
  assert.equal(r.status, 0, `expected exit 0 (per-locale, not sum). stderr=${r.stderr}`);
});

test("messages: bumping ONE locale over 22000 -> exit 1 (proves per-locale ceiling)", () => {
  const dir = tree({
    "index-abc.js": 180000,
    "messages-en-abc.js": 26000, // > 22000
    "messages-et-abc.js": 16000,
    "messages-ru-abc.js": 15000,
  });
  const r = run(dir);
  assert.equal(r.status, 1, `expected exit 1. stderr=${r.stderr}`);
  assert.match(r.stderr, /messages/);
});

test("missing budgeted chunk (no scanner-*.js) -> treated as 0 bytes, exit 0, noted", () => {
  const dir = tree({
    "index-abc.js": 180000,
    "charts-abc.js": 100000,
    // no scanner-*.js
    "palette-abc.js": 12000,
    "messages-en-abc.js": 18000,
  });
  const r = run(dir);
  assert.equal(r.status, 0, `expected exit 0. stderr=${r.stderr}`);
  // scanner still appears in the report at 0 bytes
  assert.match(r.stdout, /scanner:\s*0\//);
});

test("unbudgeted files (*Page-*.js) are ignored, never error", () => {
  const dir = tree({
    "index-abc.js": 180000,
    "SettingsPage-abc.js": 4000,
    "ScanPage-abc.js": 3500,
    "AnalyticsPage-abc.js": 3800,
  });
  const r = run(dir);
  assert.equal(r.status, 0, `expected exit 0. stderr=${r.stderr}`);
  assert.doesNotMatch(r.stdout + r.stderr, /SettingsPage/);
});
