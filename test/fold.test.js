// Tests for src/lib/fold.js (the phonetic-skeleton folder) plus the folk-
// spelling smoke corpus for src/lib/nameSearch.js's offline matcher.
//
// Everything here runs fully offline: `fold` is pure, and
// `matchLatinOffline` (nameSearch.js) is a pure function over an already-
// loaded lexicon object -- we load the real committed public/lexicon.json
// once and pass it in directly, exactly as SPEC.md §T prescribes ("the
// lexicon asset itself is the fixture; no network in tests").

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fold } from "../src/lib/fold.js";
import { matchLatinOffline } from "../src/lib/nameSearch.js";
import { splitTitleAndAddress } from "../src/lib/inputNormalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const lexicon = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "public", "lexicon.json"), "utf8")
);
const folkQueries = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "folk-queries.json"), "utf8")
);

describe("fold() -- §L1 smoke pairs", () => {
  test("Bereishis / Bereshit fold to the same key", () => {
    assert.equal(fold("Bereishis"), fold("Bereshit"));
  });

  test("Shabbos / Shabbat fold to the same key", () => {
    assert.equal(fold("Shabbos"), fold("Shabbat"));
  });

  test("Ohr HaChaim / Or HaChaim fold to the same key", () => {
    assert.equal(fold("Ohr HaChaim"), fold("Or HaChaim"));
  });

  test("Kesubos / Ketubot fold to the same key", () => {
    assert.equal(fold("Kesubos"), fold("Ketubot"));
  });
});

describe("public/lexicon.json fixture sanity", () => {
  test("has the expected parallel-array shape and is non-trivially sized", () => {
    assert.ok(Array.isArray(lexicon.keys));
    assert.ok(Array.isArray(lexicon.titles));
    assert.ok(Array.isArray(lexicon.ranks));
    assert.equal(lexicon.keys.length, lexicon.titles.length);
    assert.equal(lexicon.keys.length, lexicon.ranks.length);
    assert.ok(lexicon.keys.length > 1000, "lexicon should have thousands of entries");
  });

  test("keys are ASCII-sorted (binary-search precondition)", () => {
    for (let i = 1; i < lexicon.keys.length; i++) {
      assert.ok(
        lexicon.keys[i - 1] <= lexicon.keys[i],
        `keys not sorted at index ${i}: ${JSON.stringify(lexicon.keys[i - 1])} > ${JSON.stringify(lexicon.keys[i])}`
      );
    }
  });
});

describe("folk-spelling corpus (test/fixtures/folk-queries.json)", () => {
  // Stand-in for SPEC.md §T's referenced "HANDOFF.md 141-query" set, which
  // does not exist in this repo -- see the corpus file's own header comment
  // for what this smaller, hand-verified set covers instead.
  test("corpus fixture is representative-sized", () => {
    assert.ok(
      Array.isArray(folkQueries.entries) && folkQueries.entries.length >= 25,
      "expected a representative-sized folk-spelling corpus"
    );
  });

  for (const entry of folkQueries.entries) {
    const { query, expected, skip, note } = entry;
    const title = `"${query}" -> top-3 contains "${expected}"${note ? ` (${note})` : ""}`;

    if (skip) {
      test(title, { skip: true }, () => {});
      continue;
    }

    test(title, () => {
      const { title: titlePart } = splitTitleAndAddress(query);
      const results = matchLatinOffline(lexicon, titlePart.trim(), 3);
      const titles = results.map((r) => r.title);
      assert.ok(
        titles.includes(expected),
        `expected "${expected}" in top-3 for query "${query}", got: ${JSON.stringify(titles)}`
      );
    });
  }
});
