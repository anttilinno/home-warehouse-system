import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "check-forbidden-imports.mjs");
const FIXTURES = resolve(__dirname, "fixtures");

test("detects idb import", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /offender-idb\.ts.*idb/);
});

test("detects offline in specifier", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  assert.match(r.stderr, /offender-offline\.ts.*offline-sync/);
});

test("detects sync in specifier", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  assert.match(r.stderr, /offender-sync\.ts.*sync-manager/);
});

test("does not flag safe fixtures", () => {
  const r = spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });
  assert.doesNotMatch(r.stderr, /safe-tanstack\.ts/);
  assert.doesNotMatch(r.stderr, /safe-react\.ts/);
});

test("frontend2/src passes the guard", () => {
  const frontendSrc = resolve(__dirname, "..", "..", "frontend2", "src");
  const r = spawnSync("node", [SCRIPT, frontendSrc], { encoding: "utf8" });
  assert.equal(r.status, 0, `Guard should pass on frontend2/src. stderr=${r.stderr}`);
});
