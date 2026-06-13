import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, "..", "check-i18n-catalog.mjs");
const FIX = resolve(__dirname, "fixtures-i18n-catalog");

// Build a temp dir containing en.po/et.po/ru.po sourced from the named fixtures,
// so the guard sees canonical <locale>.po names while fixtures stay descriptive.
function tree({ en, et, ru }) {
  const dir = mkdtempSync(join(tmpdir(), "i18n-cat-"));
  if (en) copyFileSync(join(FIX, en), join(dir, "en.po"));
  if (et) copyFileSync(join(FIX, et), join(dir, "et.po"));
  if (ru) copyFileSync(join(FIX, ru), join(dir, "ru.po"));
  return dir;
}

function run(dir, extra = []) {
  return spawnSync("node", [SCRIPT, dir, ...extra], { encoding: "utf8" });
}

test("complete parity tree exits 0", () => {
  const dir = tree({ en: "en.po", et: "et-complete.po", ru: "ru-complete.po" });
  const r = run(dir);
  assert.equal(r.status, 0, `expected exit 0. stderr=${r.stderr}`);
});

test("empty msgstr in et fails (exit 1) and names the msgid + locale", () => {
  const dir = tree({ en: "en.po", et: "et-empty.po", ru: "ru-complete.po" });
  const r = run(dir);
  assert.equal(r.status, 1, `expected exit 1. stderr=${r.stderr}`);
  assert.match(r.stderr, /et/);
  assert.match(r.stderr, /Borrow \{count\} items/);
});

test("missing msgid in ru fails (exit 1) and names the divergence", () => {
  const dir = tree({ en: "en.po", et: "et-complete.po", ru: "ru-missing-msgid.po" });
  const r = run(dir);
  assert.equal(r.status, 1, `expected exit 1. stderr=${r.stderr}`);
  assert.match(r.stderr, /ru/);
  assert.match(r.stderr, /Borrow \{count\} items/);
});

test("header entry (msgid \"\") is never an empty-translation failure", () => {
  // Complete tree passes precisely because the header's empty msgstr is excluded.
  const dir = tree({ en: "en.po", et: "et-complete.po", ru: "ru-complete.po" });
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stderr, /empty msgstr/i);
});

test("--only et passes on complete et even with no ru", () => {
  const dir = tree({ en: "en.po", et: "et-complete.po" });
  const r = run(dir, ["--only", "et"]);
  assert.equal(r.status, 0, `expected exit 0. stderr=${r.stderr}`);
});

test("--only et fails on empty et", () => {
  const dir = tree({ en: "en.po", et: "et-empty.po" });
  const r = run(dir, ["--only", "et"]);
  assert.equal(r.status, 1, `expected exit 1. stderr=${r.stderr}`);
  assert.match(r.stderr, /Borrow \{count\} items/);
});
