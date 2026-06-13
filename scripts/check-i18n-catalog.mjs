#!/usr/bin/env node
// D-5 guard: the extract→merge→diff manifest guard for the i18n catalog.
// Parses the en/et/ru po files and FAILS (exit 1) if:
//   - the msgid SETS diverge across locales (reports per-locale missing + orphaned), OR
//   - any et/ru entry has an empty msgstr (the header entry is excluded).
// Exits 0 on a complete, parity tree.
//
// `--only <locale>` restricts the check to ONE locale (et OR ru) vs en: only that
// locale's empty-msgstr coverage + its msgid parity against en. The third locale is
// ignored entirely, so each Wave-2 translation plan can verify its own locale before
// the sibling locale has landed (et and ru plans run in parallel).
//
// Usage:
//   node check-i18n-catalog.mjs                 # real tree: frontend2/src/locales/{en,et,ru}/messages.po
//   node check-i18n-catalog.mjs <dir>           # <dir>/en.po, <dir>/et.po, <dir>/ru.po (self-test)
//   node check-i18n-catalog.mjs [<dir>] --only et
import { readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ---- argv parsing: optional positional <dir>, optional --only <locale> ----
const argv = process.argv.slice(2);
let onlyLocale = null;
let dirArg = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--only") {
    onlyLocale = argv[i + 1];
    i++;
  } else if (!dirArg) {
    dirArg = argv[i];
  }
}
if (onlyLocale && !["et", "ru"].includes(onlyLocale)) {
  console.error(`check-i18n-catalog: --only expects "et" or "ru", got "${onlyLocale}"`);
  process.exit(1);
}

// Resolve each locale's po path. Fixture dir uses `<locale>.po`; the real tree uses
// `frontend2/src/locales/<locale>/messages.po`.
function poPath(locale) {
  if (dirArg) return resolve(dirArg, `${locale}.po`);
  return resolve(REPO_ROOT, "frontend2", "src", "locales", locale, "messages.po");
}

// ---- minimal po parser ----
// Splits on blank lines into entries; concatenates folded continuation lines.
// Returns Map<msgid, msgstr>, EXCLUDING the header entry (the one whose msgid is "").
function unquote(line) {
  // Extract the inner content of the first "..." on the line (po quoted segment).
  const m = line.match(/"((?:[^"\\]|\\.)*)"/);
  return m ? m[1] : "";
}

function parsePo(path) {
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  const entries = new Map();
  let i = 0;
  while (i < lines.length) {
    // skip blank lines + comments between entries
    while (i < lines.length && (lines[i].trim() === "" || lines[i].startsWith("#"))) i++;
    if (i >= lines.length) break;

    let msgid = null;
    let msgstr = null;
    // msgid block
    if (lines[i].startsWith("msgid ")) {
      msgid = unquote(lines[i]);
      i++;
      while (i < lines.length && lines[i].startsWith('"')) {
        msgid += unquote(lines[i]);
        i++;
      }
    }
    // msgstr block
    if (i < lines.length && lines[i].startsWith("msgstr ")) {
      msgstr = unquote(lines[i]);
      i++;
      while (i < lines.length && lines[i].startsWith('"')) {
        msgstr += unquote(lines[i]);
        i++;
      }
    }
    if (msgid !== null && msgstr !== null) {
      if (msgid === "") {
        // header entry — skip
      } else {
        entries.set(msgid, msgstr);
      }
    } else {
      // malformed / unexpected line — advance to avoid infinite loop
      i++;
    }
  }
  return entries;
}

function loadLocale(locale) {
  const path = poPath(locale);
  try {
    statSync(path);
  } catch {
    console.error(`check-i18n-catalog: po file not found for "${locale}": ${path}`);
    process.exit(1);
  }
  return parsePo(path);
}

// ---- decide which locales to load ----
const targets = onlyLocale ? [onlyLocale] : ["et", "ru"];
const en = loadLocale("en");
const enIds = new Set(en.keys());

const problems = [];

for (const locale of targets) {
  const cat = loadLocale(locale);
  const ids = new Set(cat.keys());

  // parity vs en: missing (in en, absent here) + orphaned (here, absent in en)
  for (const id of enIds) {
    if (!ids.has(id)) problems.push(`${locale}: MISSING msgid (present in en): "${id}"`);
  }
  for (const id of ids) {
    if (!enIds.has(id)) problems.push(`${locale}: ORPHANED msgid (absent in en): "${id}"`);
  }

  // empty-msgstr coverage
  for (const [id, str] of cat) {
    if (str.trim() === "") problems.push(`${locale}: empty msgstr for "${id}"`);
  }
}

// Note: in full mode, et↔ru parity is enforced transitively — each is checked
// against en, so any divergence between them surfaces as a MISSING/ORPHANED line
// on at least one locale above. No separate cross-pair pass is needed.

if (problems.length) {
  console.error("i18n catalog divergence (Phase 15 D-5 / I18N-01):");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

const scope = onlyLocale ? `en + ${onlyLocale}` : "en + et + ru";
console.log(`check-i18n-catalog: OK (${enIds.size} msgids, parity + full coverage across ${scope})`);
