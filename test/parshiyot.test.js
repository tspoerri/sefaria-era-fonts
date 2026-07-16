// Tests for SPEC.md Wave 1 item 1 -- bare (no marker keyword) parsha
// detection in src/lib/parshiyot.js (`resolveParshaByName`,
// `findParshaMentions`), and the ambiguity-surfacing / display-address wiring
// it feeds in src/lib/nameSearch.js (`mergeParshaSuggestions`). All pure and
// offline: no network, no lexicon fixture needed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parshiyot, resolveParshaByName, findParshaMentions } from "../src/lib/parshiyot.js";
import { mergeParshaSuggestions } from "../src/lib/nameSearch.js";

describe("resolveParshaByName -- table-driven over all 54 parshiyot", () => {
  for (const p of parshiyot) {
    test(`bare "${p.name}" resolves to ${p.book} ${p.range}`, () => {
      const match = resolveParshaByName(p.name);
      assert.ok(match, `expected a match for "${p.name}"`);
      assert.equal(match.name, p.name);
      assert.equal(match.book, p.book);
      assert.equal(match.range, p.range);
    });
  }

  test("an unrecognized name resolves to null", () => {
    assert.equal(resolveParshaByName("Zzzznotreal"), null);
  });

  test("empty string resolves to null", () => {
    assert.equal(resolveParshaByName(""), null);
  });

  test("folk spelling resolves via fold() ('Vayeitzei' -> Vayetzei)", () => {
    const match = resolveParshaByName("Vayeitzei");
    assert.equal(match.name, "Vayetzei");
  });

  test("a fold-key collision (Vaera/Behar both fold to 'br') resolves to the right one", () => {
    assert.equal(resolveParshaByName("Vaera").name, "Vaera");
    assert.equal(resolveParshaByName("Behar").name, "Behar");
  });
});

describe("findParshaMentions -- position-independent bare detection", () => {
  test("bare name as the whole query (the common case) is found", () => {
    const found = findParshaMentions("Noach");
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "Noach");
  });

  test("two-word parsha name as the whole query is found as a unit", () => {
    const found = findParshaMentions("Ki Tisa");
    assert.ok(found.some((p) => p.name === "Ki Tisa"));
  });

  test("a name at the START of a longer query is found", () => {
    const found = findParshaMentions("Noach story");
    assert.ok(found.some((p) => p.name === "Noach"));
  });

  test("a name at the END of a longer query is found", () => {
    const found = findParshaMentions("this week's Noach");
    assert.ok(found.some((p) => p.name === "Noach"));
  });

  test("a name in the MIDDLE of a longer query is found", () => {
    const found = findParshaMentions("reading Noach this week");
    assert.ok(found.some((p) => p.name === "Noach"));
  });

  test("no mention anywhere returns an empty array", () => {
    assert.deepEqual(findParshaMentions("Guide to the Perplexed"), []);
  });

  test("empty/whitespace-only input returns an empty array", () => {
    assert.deepEqual(findParshaMentions(""), []);
    assert.deepEqual(findParshaMentions("   "), []);
  });

  test("de-duplicates by name (doesn't return the same parsha twice)", () => {
    const found = findParshaMentions("Noach Noach");
    assert.equal(found.filter((p) => p.name === "Noach").length, 1);
  });
});

describe("mergeParshaSuggestions -- ambiguity: offer BOTH rather than guessing", () => {
  test("adds a parsha match in front of existing (book-title) suggestions, not in place of them", () => {
    const bookSuggestion = { title: "Genesis", key: "Genesis", isPrimary: true, display: "Genesis" };
    const merged = mergeParshaSuggestions("Bereshit", [bookSuggestion]);
    assert.ok(merged.some((s) => s.key === "parsha:Bereshit"), "expected a parsha suggestion");
    assert.ok(merged.some((s) => s.key === "Genesis"), "expected the book suggestion to survive alongside it");
  });

  test("a parsha suggestion resolves to Sefaria's canonical book + range as its own address", () => {
    const merged = mergeParshaSuggestions("Noach", []);
    const parshaEntry = merged.find((s) => s.key === "parsha:Noach");
    assert.ok(parshaEntry);
    assert.equal(parshaEntry.title, "Genesis");
    assert.equal(parshaEntry.address, " 6:9-11:32");
    assert.match(parshaEntry.display, /Noach/);
    assert.match(parshaEntry.display, /Genesis 6:9-11:32/);
  });

  test("no parsha mention leaves the other suggestions untouched", () => {
    const others = [{ title: "Mishneh Torah", key: "Mishneh Torah", isPrimary: true, display: "Mishneh Torah" }];
    assert.deepEqual(mergeParshaSuggestions("Mishneh Torah", others), others);
  });

  test("respects maxResults after merging", () => {
    const others = [
      { title: "A", key: "A", display: "A" },
      { title: "B", key: "B", display: "B" },
      { title: "C", key: "C", display: "C" },
    ];
    const merged = mergeParshaSuggestions("Noach", others, 2);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].key, "parsha:Noach");
  });
});
