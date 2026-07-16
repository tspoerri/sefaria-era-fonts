// Tests for src/lib/nameSearch.js's offline matching + address-splitting
// contract (SPEC.md §T). All offline: `matchLatinOffline` is pure (takes a
// lexicon object, no I/O) and `splitTitleAndAddress` (inputNormalize.js) is
// pure. The real committed public/lexicon.json is used for the
// numbered-book and zero-hit cases (it's the fixture, per SPEC.md §T); a
// small synthetic lexicon is used for the ranking-order case so the
// exact-vs-prefix-tier and rank-ascending ordering can be pinned exactly,
// independent of anything about the real data.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { matchLatinOffline } from "../src/lib/nameSearch.js";
import { splitTitleAndAddress } from "../src/lib/inputNormalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const lexicon = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "public", "lexicon.json"), "utf8")
);

describe("splitTitleAndAddress", () => {
  test("splits a plain chapter:verse address off an ASCII title", () => {
    assert.deepEqual(splitTitleAndAddress("Genesis 1:1"), {
      title: "Genesis",
      address: " 1:1",
    });
  });

  test("splits a numbered-book title's trailing address correctly ('Melachim 2 3:4')", () => {
    // The book-number token ("2") stays attached to the title, not the
    // address -- only the final "3:4" token is a ref address.
    assert.deepEqual(splitTitleAndAddress("Melachim 2 3:4"), {
      title: "Melachim 2",
      address: " 3:4",
    });
  });

  test("splits a Hebrew gematria address (gershayim) off a Hebrew title", () => {
    const result = splitTitleAndAddress('רש"י על בראשית א:א');
    assert.equal(result.title, 'רש"י על בראשית');
    assert.equal(result.address, " א:א");
  });

  test("does NOT split a title that merely contains the word 'to' ('Guide to the Perplexed')", () => {
    assert.deepEqual(splitTitleAndAddress("Guide to the Perplexed"), {
      title: "Guide to the Perplexed",
      address: "",
    });
  });
});

describe("matchLatinOffline ranking order", () => {
  // Synthetic lexicon: "Genesis" and "Genessah" both fold to the exact key
  // "gntt" (an invented pair, chosen only to exercise the exact tier with
  // two entries at different TOC ranks); "Genesis Introduction" folds to
  // "gntt ntrdctn", a key-prefix (not exact) match.
  const lex = {
    keys: ["gntt", "gntt", "gntt ntrdctn"],
    titles: ["Genesis", "Genessah", "Genesis Introduction"],
    ranks: [100, 5, 1],
  };

  test("exact-key hits rank before prefix-only hits, regardless of rank", () => {
    const results = matchLatinOffline(lex, "Genesis", 10);
    const titles = results.map((r) => r.title);
    // Both exact hits (Genesis, Genessah) must precede the prefix hit
    // (Genesis Introduction) even though its rank (1) is lower than both.
    assert.equal(titles[2], "Genesis Introduction");
    assert.ok(titles.indexOf("Genesis") < titles.indexOf("Genesis Introduction"));
    assert.ok(titles.indexOf("Genessah") < titles.indexOf("Genesis Introduction"));
  });

  test("within the same tier, lower TOC rank sorts first", () => {
    const results = matchLatinOffline(lex, "Genesis", 10);
    // "Genessah" (rank 5) must come before "Genesis" (rank 100) -- both are
    // exact-tier hits, so tie-break is purely on ascending rank.
    const titles = results.map((r) => r.title);
    assert.ok(titles.indexOf("Genessah") < titles.indexOf("Genesis"));
  });

  test("exact-tier hits are flagged isPrimary; prefix-tier hits are not", () => {
    const results = matchLatinOffline(lex, "Genesis", 10);
    const byTitle = Object.fromEntries(results.map((r) => [r.title, r]));
    assert.equal(byTitle["Genesis"].isPrimary, true);
    assert.equal(byTitle["Genessah"].isPrimary, true);
    assert.equal(byTitle["Genesis Introduction"].isPrimary, false);
  });
});

describe("numbered-book cases (real lexicon)", () => {
  test("'Melachim 2' (after address split) matches the Melachim II family", () => {
    const { title } = splitTitleAndAddress("Melachim 2 3:4");
    const results = matchLatinOffline(lexicon, title.trim(), 5);
    const titles = results.map((r) => r.title);
    assert.ok(
      titles.includes("Melachim II"),
      `expected "Melachim II" in results, got: ${JSON.stringify(titles)}`
    );
  });

  test("bare 'Melachim 2' matches 'Melachim II' as the top hit", () => {
    const results = matchLatinOffline(lexicon, "Melachim 2", 3);
    assert.equal(results[0]?.title, "Melachim II");
  });
});

describe("zero-hit behavior", () => {
  test("a nonsense Latin query returns an empty array, not null/undefined", () => {
    const results = matchLatinOffline(lexicon, "Zzzzqqx", 8);
    assert.deepEqual(results, []);
  });

  test("an empty/blank title folds to '' and short-circuits to []", () => {
    assert.deepEqual(matchLatinOffline(lexicon, "", 8), []);
    assert.deepEqual(matchLatinOffline(lexicon, "   ", 8), []);
  });

  // "Genessis" (doubled 's') is a real example of a query that legitimately
  // gets 0 offline hits -- it's a typo, not a phonetic/spelling variant, so
  // it doesn't fold onto Genesis's key. Confirms the pure-offline contract
  // that nameSearch.js's searchLatinTitles relies on: 0 offline hits is the
  // caller's signal to fall back to exactly one live /api/name call.
  //
  // We deliberately do NOT attempt to mock fetchNameRaw / the live fallback
  // here: node:test's `mock.module` (which would let us stub the
  // ../src/api/sefaria.js import) is not available in this Node runtime
  // without the --experimental-test-module-mocks flag, and this project's
  // test script is fixed to plain `node --test` with no flags (SPEC.md
  // hard constraint: zero new deps / no non-default flags). Rather than add
  // a flag or a mocking dependency, we assert the contract at the boundary
  // that's actually unit-testable offline (matchLatinOffline returning []
  // on 0 hits) and leave the live-fallback path itself to be exercised by
  // the app / manual verification, as SPEC.md §T anticipates.
  test("0 offline hits (e.g. a typo like 'Genessis') signals the caller to fall back live", () => {
    const results = matchLatinOffline(lexicon, "Genessis", 8);
    assert.deepEqual(results, []);
  });
});
