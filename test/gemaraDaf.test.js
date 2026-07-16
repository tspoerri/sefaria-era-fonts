// Tests for SPEC.md Wave 1 item 3 -- Gemara daf-amud addressing in
// src/lib/inputNormalize.js (`normalizeSourceInput`, exercised end-to-end)
// and its supporting pieces: gematria-numeral-to-number conversion
// (src/lib/hebrewSearch.js `gematriaToNumber`) and the Talmud tractate table
// (src/lib/tractates.js). All pure/offline.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { normalizeSourceInput } from "../src/lib/inputNormalize.js";
import { gematriaToNumber } from "../src/lib/hebrewSearch.js";
import { isTractateTitle, tractateEnglishName, tractates } from "../src/lib/tractates.js";

describe("gematriaToNumber", () => {
  test("single letter (יב's components) sum correctly", () => {
    assert.equal(gematriaToNumber("י"), 10);
    assert.equal(gematriaToNumber("ב"), 2);
  });

  test("multi-letter numerals sum to the right value regardless of the avoid-Divine-Name convention", () => {
    assert.equal(gematriaToNumber("יב"), 12); // 10 + 2
    assert.equal(gematriaToNumber("טו"), 15); // 9 + 6 (avoids י+ה)
    assert.equal(gematriaToNumber("טז"), 16); // 9 + 7 (avoids י+ו)
    assert.equal(gematriaToNumber("קעו"), 176); // 100 + 70 + 6 -- Bava Batra's last daf
  });

  test("empty/non-numeral input is 0", () => {
    assert.equal(gematriaToNumber(""), 0);
    assert.equal(gematriaToNumber("abc"), 0);
  });
});

describe("tractates table", () => {
  test("has 37 tractates (the Bavli tractates with Gemara)", () => {
    assert.equal(tractates.length, 37);
  });

  test("isTractateTitle matches both the English and Hebrew name", () => {
    assert.ok(isTractateTitle("Berakhot"));
    assert.ok(isTractateTitle("berakhot")); // case-insensitive English
    assert.ok(isTractateTitle("ברכות"));
  });

  test("isTractateTitle rejects a non-tractate title", () => {
    assert.equal(isTractateTitle("Genesis"), false);
    assert.equal(isTractateTitle("Rashi on Genesis"), false);
  });

  test("tractateEnglishName resolves either script to the canonical English title", () => {
    assert.equal(tractateEnglishName("ברכות"), "Berakhot");
    assert.equal(tractateEnglishName("berakhot"), "Berakhot");
    assert.equal(tractateEnglishName("Genesis"), null);
  });
});

describe("Gemara daf address rewriting end-to-end (normalizeSourceInput)", () => {
  test("dot -> amud a", () => {
    assert.equal(normalizeSourceInput("ברכות יב."), "Berakhot 12a");
  });

  test("colon + explicit א -> amud a", () => {
    assert.equal(normalizeSourceInput("ברכות יב:א"), "Berakhot 12a");
  });

  test("colon + explicit ב -> amud b", () => {
    assert.equal(normalizeSourceInput("ברכות יב:ב"), "Berakhot 12b");
  });

  test("bare colon (no letter) -> amud b, per convention", () => {
    assert.equal(normalizeSourceInput("ברכות יב:"), "Berakhot 12b");
  });

  test("bare numeral (no punctuation or letter) -> defaults to amud a", () => {
    assert.equal(normalizeSourceInput("ברכות יב"), "Berakhot 12a");
  });

  test("works for a different tractate (Bava Kamma)", () => {
    assert.equal(normalizeSourceInput("בבא קמא ג."), "Bava Kamma 3a");
  });

  test("does NOT activate on a Latin '12:2' style address, even on a tractate title", () => {
    assert.equal(normalizeSourceInput("Berakhot 12:2"), "Berakhot 12:2");
  });

  test("does NOT activate when the title is not a Talmud tractate (plain Hebrew chapter:verse)", () => {
    assert.equal(normalizeSourceInput("בראשית א:א"), "בראשית א:א");
  });

  test("does NOT activate when the address has more than one gematria number (looks like chapter:verse, not daf)", () => {
    assert.equal(normalizeSourceInput("ברכות יב:ג"), "ברכות יב:ג");
  });
});
