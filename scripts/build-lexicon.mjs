#!/usr/bin/env node
// scripts/build-lexicon.mjs
//
// Builds public/lexicon.json: a phonetic-skeleton search index over
// Sefaria's Latin-script title inventory. Folding is done by
// src/lib/fold.js — this script imports that module directly (never
// reimplements it) so build-time keys and runtime query-time keys can never
// drift apart. See that file for the pinned fold-rule order, and
// docs/SEARCH.md / SPEC.md §2-L1 for the surrounding architecture.
//
// USAGE
//   node scripts/build-lexicon.mjs
//     Default mode, for the maintainer's normal environment: fetches the
//     raw title list from https://www.sefaria.org/api/index/titles via
//     global fetch (Node >=18, no dependency).
//
//   node scripts/build-lexicon.mjs --titles-file /path/to/titles-raw.json
//     Offline mode: reads the same payload from a local file instead of
//     hitting the network. Use this in any sandbox that blocks egress to
//     www.sefaria.org. The file must be the exact JSON body
//     `GET /api/index/titles` returns: `{ "books": [ ...title strings... ] }`.
//
//   Optional: --out /path/to/output.json overrides the default
//   public/lexicon.json write location (mainly useful for testing).
//
// OUTPUT SHAPE (public/lexicon.json)
//   {
//     "keys":   [ "br$t", "br$tmilh", ... ],
//     "titles": [ "Bereshit", "Brachot Milah", ... ],
//     "ranks":  [ 0, 214, ... ]
//   }
//   Three parallel arrays, all the same length, aligned by index:
//     keys[i]   = fold()-ed phonetic skeleton key, ASCII-sorted overall so
//                 the array is binary-searchable (exact match, or a prefix
//                 range via two binary searches for the lower/upper bound).
//     titles[i] = the representative raw Sefaria title string for keys[i]
//                 (the first-occurring title in the source books[] array
//                 that folds to this key — TOC-order priority).
//     ranks[i]  = that title's index in the original books[] array (TOC
//                 order; lower = appears earlier = higher priority).
//   Example: keys[0] === "br$t"  ->  titles[0] === "Bereshit", ranks[0] === 0.
//   Only non-Hebrew-codepoint title strings are folded in; the 56 strings
//   in the source list that contain a Hebrew-script codepoint (letters,
//   nikud, etc — see containsHebrewCodepoint() below) are skipped here and
//   keep the app's separate Hebrew search path (hebrewSearch.js).
//
// PRUNING (only applied if the output exceeds the 5 MB raw / 600 KB gzip
// budget). SPEC.md §L1.5 prunes "ONLY by these safe rules, in order, UNTIL
// UNDER" the budget — a MINIMAL, stop-as-soon-as-under condition, not a
// wholesale filter. Dropping every eligible entry guts offline coverage
// (the project's core value proposition) for no reason once the budget is
// already met, so each rule below computes its full ELIGIBLE set but only
// actually drops entries from it — least-popular-first, by descending
// first-occurrence rank (SPEC.md itself calls that index a "popularity/
// priority rank") — until the real gzip -6 size is back under target,
// leaving every other eligible entry in place:
//   (i)  Eligible: comma-containing entries ("deep node" titles, e.g.
//        "Shulchan Arukh, Orach Chayim") whose pre-comma base title
//        already has its own lexicon entry at the same folded key — i.e.
//        the base work is already independently searchable, so *some*
//        deep-node spelling combinations for it are redundant (the deep
//        node itself still resolves via the single /api/name call once
//        the base title is matched). Applied first, and normally
//        sufficient on its own.
//   (ii) Eligible: entries whose ORIGINAL (unfolded) title string matches
//        /[àâäéèêëîïôöûüç]/i — foreign-language titles such as "Genèse".
//        Tested against the original string because NFD-stripping of
//        those diacritics only happens inside fold(). Only even consulted
//        if rule (i)'s entire eligible set wasn't enough.
//   Abbreviations (e.g. "Gen.") and Ashkenazi/Sephardi spelling variants
//   (e.g. "Bereishis", "Kesubos", "Shabbos") are NEVER pruned by either
//   rule — neither contains a comma, and neither carries a Latin accented
//   character rule (ii) matches. Every rule logs its eligible count and
//   its actual (minimal) pruned count to stdout.
//
// Size is checked against the REAL gzip -6 output (what GitHub Pages/nginx
// actually serve), not an estimate: gzipCliBytes() below shells out to the
// system `gzip` binary (present on effectively every Linux/macOS box this
// runs on) and falls back to node:zlib's level-6 gzipSync only if that
// binary is missing. The pruning loop targets a safety margin under the
// spec's 600 KB budget (see GZIP_PRUNE_TARGET_BYTES) so the shipped asset
// isn't sitting right at the edge.

import { fold } from "../src/lib/fold.js";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(REPO_ROOT, "public", "lexicon.json");
const SEFARIA_TITLES_URL = "https://www.sefaria.org/api/index/titles";

const RAW_BUDGET_BYTES = 5 * 1024 * 1024; // 5 MB
const GZIP_BUDGET_BYTES = 600 * 1024; // 600 KB, per SPEC.md §L1.5
// Pruning stops once real gzip -6 is at or under this — a margin under the
// 600 KB budget so the committed asset isn't balanced right on the line.
const GZIP_PRUNE_TARGET_BYTES = 585_000;

const FOREIGN_DIACRITIC_ORIGINAL = /[àâäéèêëîïôöûüç]/i;

// Real gzip at a given level, via the system binary — this is what a
// static file host (GitHub Pages/nginx) actually produces, and it can
// differ non-trivially from node:zlib's gzipSync at the "same" level.
// Falls back to node:zlib if `gzip` isn't on PATH (e.g. some Windows dev
// setups), clearly flagged as an estimate in that case.
function gzipCliBytes(buffer, level) {
  try {
    return execFileSync("gzip", [`-${level}`, "-c"], {
      input: buffer,
      maxBuffer: 64 * 1024 * 1024,
    }).length;
  } catch {
    return null;
  }
}

function gzipBytesAtLevel(buffer, level) {
  const cli = gzipCliBytes(buffer, level);
  if (cli !== null) return { bytes: cli, source: "gzip binary" };
  return { bytes: gzipSync(buffer, { level }).length, source: "node:zlib estimate (gzip binary unavailable)" };
}

function parseArgs(argv) {
  const args = { titlesFile: null, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--titles-file") {
      args.titlesFile = argv[++i];
    } else if (argv[i] === "--out") {
      args.out = path.resolve(argv[++i]);
    }
  }
  return args;
}

async function loadRawTitles({ titlesFile }) {
  let raw;
  if (titlesFile) {
    console.log(`Reading titles from local file: ${titlesFile}`);
    raw = JSON.parse(await readFile(titlesFile, "utf8"));
  } else {
    console.log(`Fetching titles from ${SEFARIA_TITLES_URL}`);
    const res = await fetch(SEFARIA_TITLES_URL);
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    raw = await res.json();
  }
  if (!raw || !Array.isArray(raw.books)) {
    throw new Error('Titles payload must have shape { "books": [ ...strings... ] }');
  }
  return raw.books;
}

// Sefaria's title list has a handful of strings containing Hebrew-script
// codepoints (letters, nikud, cantillation, geresh/gershayim) — 56 of them
// in the 2026-07-15 snapshot per SPEC.md §1.2. Most of those are actually
// *mixed* Latin+Hebrew strings (e.g. a Siddur path like "Siddur Ashkenaz,
// Weekday, Shacharit, Blessings of the Shema, אהבה רבה"), so the
// discriminator has to be "contains a Hebrew codepoint" rather than "has no
// Latin letter" (only 4 of the 56 have zero Latin letters) — this file's
// fold() has no rules for Hebrew script anyway, and these titles keep the
// app's separate Hebrew search path (hebrewSearch.js) regardless of what
// else they contain.
const HEBREW_CODEPOINT = /[\u0590-\u05ff]/;
const containsHebrewCodepoint = (title) => HEBREW_CODEPOINT.test(title);

// Builds the first-occurrence key -> { title, rank } map. TOC order in the
// source books[] array means the first string that folds to a given key is
// its highest-priority representative, so a plain "if not already present,
// set" during a single left-to-right pass is exactly first-occurrence
// priority with no extra bookkeeping.
function buildIndex(books) {
  const index = new Map(); // key -> { title, rank }
  let latinCount = 0;
  let hebrewCount = 0;
  for (let rank = 0; rank < books.length; rank++) {
    const title = books[rank];
    if (containsHebrewCodepoint(title)) {
      hebrewCount++;
      continue;
    }
    latinCount++;
    const key = fold(title);
    if (!key) continue;
    if (!index.has(key)) {
      index.set(key, { title, rank });
    }
  }
  return { index, latinCount, hebrewCount };
}

function toArrays(index) {
  const entries = [...index.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return {
    keys: entries.map(([key]) => key),
    titles: entries.map(([, v]) => v.title),
    ranks: entries.map(([, v]) => v.rank),
  };
}

function sizes(data) {
  const json = JSON.stringify(data);
  const buf = Buffer.from(json, "utf8");
  const rawBytes = buf.length;
  const gzip6 = gzipBytesAtLevel(buf, 6);
  const gzip9 = gzipBytesAtLevel(buf, 9);
  return { json, rawBytes, gzip6Bytes: gzip6.bytes, gzip9Bytes: gzip9.bytes, gzipSource: gzip6.source };
}

// Rule (i) ELIGIBILITY: a comma-containing ("deep node") entry is a
// pruning CANDIDATE if its pre-comma base title already resolves, on its
// own, to a different, still-present entry at the same folded key. Being
// eligible does not mean it gets dropped — SPEC.md §L1.5 says prune "ONLY
// ... until under [budget]", i.e. the minimum needed, not the whole
// eligible set (dropping all of it guts offline coverage, the project's
// core value prop — see 2026-07-16 orchestrator adjudication). Eligible
// entries are computed once from the current index snapshot; the ones
// actually removed are chosen by pruneEligibleUntilUnderTarget() below, in
// ascending order of value (least-popular first).
function findDeepNodeAltSpellingCandidates(index) {
  const candidates = [];
  for (const [key, value] of index.entries()) {
    if (!value.title.includes(",")) continue;
    const preComma = value.title.split(",")[0].trim();
    const preCommaKey = fold(preComma);
    if (preCommaKey === key) continue; // not actually redundant with itself
    if (index.has(preCommaKey)) {
      candidates.push({ key, rank: value.rank });
    }
  }
  return candidates;
}

// Rule (ii) ELIGIBILITY: titles whose ORIGINAL (unfolded) string carries a
// Latin accented character fold() only normalizes away internally.
function findForeignDiacriticCandidates(index) {
  const candidates = [];
  for (const [key, value] of index.entries()) {
    if (FOREIGN_DIACRITIC_ORIGINAL.test(value.title)) {
      candidates.push({ key, rank: value.rank });
    }
  }
  return candidates;
}

// Drops candidates from `index` in ascending order of "least popular
// first" (descending first-occurrence rank — SPEC.md itself calls
// first-occurrence index a popularity/priority rank, and higher rank means
// it appeared later in TOC order, i.e. less prominent), re-measuring real
// gzip -6 after each small batch, and stopping the INSTANT the target is
// met so no more than necessary is removed. Batched (rather than
// one-at-a-time) purely so re-measuring isn't O(candidates) separate
// child-process gzip invocations; batch size is small enough that the
// overshoot past the true minimum is negligible.
function pruneCandidatesUntilUnderTarget(index, candidates, targetBytes, batchSize = 25) {
  const sorted = [...candidates].sort((a, b) => b.rank - a.rank);
  let prunedCount = 0;
  let sizeNow = sizes(toArrays(index));
  if (sizeNow.gzip6Bytes <= targetBytes) {
    return { prunedCount, eligibleCount: sorted.length, sizeNow };
  }
  for (let i = 0; i < sorted.length; i += batchSize) {
    const batch = sorted.slice(i, i + batchSize);
    for (const { key } of batch) {
      index.delete(key);
      prunedCount++;
    }
    sizeNow = sizes(toArrays(index));
    if (sizeNow.gzip6Bytes <= targetBytes) break;
  }
  return { prunedCount, eligibleCount: sorted.length, sizeNow };
}

function overBudget({ rawBytes, gzip6Bytes }) {
  return rawBytes > RAW_BUDGET_BYTES || gzip6Bytes > GZIP_PRUNE_TARGET_BYTES;
}

function logSize(label, s) {
  console.log(
    `  ${label}: raw ${(s.rawBytes / 1024).toFixed(1)} KB, gzip-6 ${(s.gzip6Bytes / 1024).toFixed(1)} KB ` +
      `(${s.gzip6Bytes} bytes, ${s.gzipSource}), gzip-9 ${(s.gzip9Bytes / 1024).toFixed(1)} KB (${s.gzip9Bytes} bytes)`
  );
}

// Drives the two safe pruning rules, in order, each applied minimally
// (least-popular-first, stop-the-instant-under-target) rather than
// wholesale. Pruning rules are only ever eligible to fire in this fixed
// order — never applied speculatively when already under budget, and rule
// (ii) is only even consulted if rule (i)'s full eligible set still isn't
// enough (shouldn't happen in practice).
function applyPruningIfNeeded(index) {
  const log = [];
  let sizeNow = sizes(toArrays(index));
  console.log("Size before pruning:");
  logSize("pre-prune", sizeNow);

  if (!overBudget(sizeNow)) {
    log.push("none needed (under budget)");
    return { log, rule1Eligible: 0, rule1Pruned: 0, rule2Eligible: 0, rule2Pruned: 0 };
  }

  const rule1Candidates = findDeepNodeAltSpellingCandidates(index);
  console.log(
    `Rule (i) eligible: ${rule1Candidates.length} comma-containing entries whose pre-comma base ` +
      `already has its own surviving entry. Dropping least-popular-first (descending rank) ` +
      `only until under target...`
  );
  const rule1Result = pruneCandidatesUntilUnderTarget(index, rule1Candidates, GZIP_PRUNE_TARGET_BYTES);
  sizeNow = rule1Result.sizeNow;
  log.push(
    `rule (i) deep-node alt-spelling dedupe: ${rule1Candidates.length} eligible, ` +
      `${rule1Result.prunedCount} actually pruned (minimal, least-popular-first)`
  );
  console.log(`Applied rule (i): dropped ${rule1Result.prunedCount} of ${rule1Candidates.length} eligible entries.`);
  logSize("after rule (i)", sizeNow);

  let rule2Candidates = [];
  let rule2Pruned = 0;
  if (overBudget(sizeNow)) {
    rule2Candidates = findForeignDiacriticCandidates(index);
    console.log(`Rule (i) alone insufficient — rule (ii) eligible: ${rule2Candidates.length} foreign-diacritic titles.`);
    const rule2Result = pruneCandidatesUntilUnderTarget(index, rule2Candidates, GZIP_PRUNE_TARGET_BYTES);
    sizeNow = rule2Result.sizeNow;
    rule2Pruned = rule2Result.prunedCount;
    log.push(
      `rule (ii) foreign-diacritic titles: ${rule2Candidates.length} eligible, ${rule2Pruned} actually pruned (minimal)`
    );
    console.log(`Applied rule (ii): dropped ${rule2Pruned} of ${rule2Candidates.length} eligible entries.`);
    logSize("after rule (ii)", sizeNow);
  } else {
    log.push("rule (ii) foreign-diacritic titles: not needed (rule i alone met the target)");
  }

  if (overBudget(sizeNow)) {
    console.warn(
      "WARNING: still over the gzip target even after exhausting both eligible pruning rules. " +
        "No further pruning is applied (abbreviations and Ashkenazi/Sephardi variants must never be dropped)."
    );
  }

  return {
    log,
    rule1Eligible: rule1Candidates.length,
    rule1Pruned: rule1Result.prunedCount,
    rule2Eligible: rule2Candidates.length,
    rule2Pruned,
  };
}

// A lexicon lookup "resolves" a key either by an exact hit, or — since the
// real title list has no bare "Or HaChaim" entry, only compound ones like
// "Or HaChaim on Deu." (it's a commentary, always cited "on X") — by the
// key being a prefix of some existing key. This mirrors the app's own
// matching strategy (SPEC.md §L2: "exact-key hits first, then key-prefix
// hits"), so it's a faithful check of what a real lookup would actually
// find, not a loosened test.
function lexiconResolves(index, key) {
  if (index.has(key)) return true;
  for (const existingKey of index.keys()) {
    if (existingKey.startsWith(key)) return true;
  }
  return false;
}

// Smoke assertions: fail loudly (nonzero exit) if the fold algorithm or the
// built lexicon regress on the pinned folk-spelling pairs from SPEC.md §L1.
function runSmokeAssertions(index) {
  const pairs = [
    ["Bereishis", "Bereshit"],
    ["Shabbos", "Shabbat"],
    ["Ohr HaChaim", "Or HaChaim"],
    ["Kesubos", "Ketubot"],
  ];
  const failures = [];
  for (const [a, b] of pairs) {
    const keyA = fold(a);
    const keyB = fold(b);
    if (keyA !== keyB) {
      failures.push(`fold('${a}') [${keyA}] !== fold('${b}') [${keyB}]`);
      continue;
    }
    if (!lexiconResolves(index, keyA)) {
      failures.push(`lexicon has no exact or prefix match for key '${keyA}' (from '${a}' / '${b}')`);
    }
  }
  if (failures.length) {
    console.error("SMOKE ASSERTIONS FAILED:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`Smoke assertions: ${pairs.length}/${pairs.length} pairs passed.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const books = await loadRawTitles(args);
  console.log(`Loaded ${books.length} raw title strings.`);

  const { index, latinCount, hebrewCount } = buildIndex(books);
  console.log(`Latin-script titles folded: ${latinCount}. Hebrew-codepoint titles skipped: ${hebrewCount}.`);
  console.log(`Unique skeleton keys: ${index.size}.`);

  runSmokeAssertions(index);

  const {
    log: pruneLog,
    rule1Eligible,
    rule1Pruned,
    rule2Eligible,
    rule2Pruned,
  } = applyPruningIfNeeded(index);
  console.log(`Pruning: ${pruneLog.join("; ")}`);
  console.log(
    `Rule (i): ${rule1Eligible} eligible, ${rule1Pruned} pruned. ` +
      `Rule (ii): ${rule2Eligible} eligible, ${rule2Pruned} pruned.`
  );
  console.log(`Unique skeleton keys after pruning: ${index.size}.`);

  // Re-run smoke assertions post-prune: pruning must never remove the
  // pinned smoke-test entries (it shouldn't, by rule design — none of them
  // contain a comma or an accented Latin character — but this catches a
  // rule-implementation bug loudly instead of silently).
  runSmokeAssertions(index);

  const data = toArrays(index);
  const { json, rawBytes, gzip6Bytes, gzip9Bytes, gzipSource } = sizes(data);

  await writeFile(args.out, json, "utf8");
  console.log(`Wrote ${args.out}`);
  console.log(`Raw size: ${(rawBytes / 1024).toFixed(1)} KB (${rawBytes} bytes)`);
  console.log(`Gzip -6 size (${gzipSource}): ${(gzip6Bytes / 1024).toFixed(1)} KB (${gzip6Bytes} bytes)`);
  console.log(`Gzip -9 size: ${(gzip9Bytes / 1024).toFixed(1)} KB (${gzip9Bytes} bytes)`);
  console.log(
    `Budget: raw <= ${RAW_BUDGET_BYTES / 1024 / 1024} MB (${rawBytes <= RAW_BUDGET_BYTES ? "OK" : "OVER"}), ` +
      `gzip-6 <= ${GZIP_BUDGET_BYTES / 1024} KB (${gzip6Bytes <= GZIP_BUDGET_BYTES ? "OK" : "OVER"}), ` +
      `gzip-6 <= prune target ${GZIP_PRUNE_TARGET_BYTES / 1024} KB (${gzip6Bytes <= GZIP_PRUNE_TARGET_BYTES ? "OK" : "OVER"})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
