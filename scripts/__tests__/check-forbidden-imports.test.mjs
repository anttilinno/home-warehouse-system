import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "check-forbidden-imports.mjs");
const FIXTURES = resolve(__dirname, "fixtures");

const runOnFixtures = () =>
  spawnSync("node", [SCRIPT, FIXTURES], { encoding: "utf8" });

test("detects a bare serwist import", () => {
  const r = runOnFixtures();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /offender-serwist\.ts.*serwist/);
});

test("detects a scoped @serwist/* import", () => {
  const r = runOnFixtures();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /offender-serwist-scoped\.ts.*@serwist\/precaching/);
});

// v3.0 reversed the ONLINE-ONLY stance, so idb / offline / sync specifiers are
// deliberately allowed again — the offline query persister imports idb-keyval.
// These assertions exist so a well-meaning re-tightening of the guard fails
// here instead of at the persister's import site.
test("does NOT flag the lifted idb / offline / sync bans", () => {
  const r = runOnFixtures();
  assert.doesNotMatch(r.stderr, /lifted-idb\.ts/);
  assert.doesNotMatch(r.stderr, /lifted-offline\.ts/);
  assert.doesNotMatch(r.stderr, /lifted-sync\.ts/);
});

test("does not flag safe fixtures", () => {
  const r = runOnFixtures();
  assert.doesNotMatch(r.stderr, /safe-tanstack\.ts/);
  assert.doesNotMatch(r.stderr, /safe-react\.ts/);
});

test("frontend/src passes the guard", () => {
  const frontendSrc = resolve(__dirname, "..", "..", "frontend", "src");
  const r = spawnSync("node", [SCRIPT, frontendSrc], { encoding: "utf8" });
  assert.equal(
    r.status,
    0,
    `Guard should pass on frontend/src. stderr=${r.stderr}`,
  );
});
