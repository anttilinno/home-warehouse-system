import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "check-i18n-format.mjs");
const FIXTURES = resolve(__dirname, "fixtures-i18n-format");

test("flags raw toLocale* offender (exit 1)", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}. stderr=${r.stderr}`);
  assert.match(r.stderr, /offender-tolocale\.tsx/);
});

test("does NOT flag the clean fixture", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  assert.doesNotMatch(r.stderr, /clean\.tsx/);
});

test("does NOT flag a line tagged // i18n-format-ignore", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  // ignored.tsx has only an ignore-tagged line + Intl.NumberFormat — never flagged.
  assert.doesNotMatch(r.stderr, /ignored\.tsx/);
});

test("does NOT flag Intl.NumberFormat", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  assert.doesNotMatch(r.stderr, /NumberFormat/);
});

test("passes (exit 0) on a fixtures-only dir with no offenders", () => {
  // Negative control: a dir containing only the clean+ignored fixtures must pass.
  // (We deliberately do NOT assert the REAL frontend2 tree here: 15-01's render-site
  //  routing is NOT merged in this isolated Wave-1 worktree, so the real-tree run
  //  exits 1 BY DESIGN. The orchestrator runs the real-tree guard post-merge.)
  const CLEAN_DIR = resolve(__dirname, "fixtures-i18n-format", "clean-subset");
  const r = spawnSync("node", [SCRIPT, CLEAN_DIR], { encoding: "utf8" });
  assert.equal(r.status, 0, `Guard should pass on clean-only dir. stderr=${r.stderr}`);
});
