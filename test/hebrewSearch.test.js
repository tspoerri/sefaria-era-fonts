// Pins existing behavior of src/lib/hebrewSearch.js (nikud stripping,
// Hebrew-text detection, gematria-order fixing, confusable-variant
// generation) plus the geresh/gershayim address-split behavior in
// src/lib/inputNormalize.js's `splitTitleAndAddress` that depends on it --
// so a future refactor of either file can't silently break the Hebrew
// search path (SPEC.md §T). All pure functions, fully offline.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  stripNikud,
  hasNikud,
  isHebrewText,
  generateHebrewVariants,
  isValidGematriaOrder,
  fixGematriaOrder,
} from "../src/lib/hebrewSearch.js";
import { splitTitleAndAddress } from "../src/lib/inputNormalize.js";

describe("stripNikud", () => {
  test("removes vowel points from a vocalized title", () => {
    assert.equal(stripNikud("בְּרֵאשִׁית"), "בראשית");
  });

  test("is a no-op on already-unvocalized text", () => {
    assert.equal(stripNikud("בראשית"), "בראשית");
  });

  test("is a no-op on Latin text", () => {
    assert.equal(stripNikud("Genesis"), "Genesis");
  });
});

describe("hasNikud", () => {
  test("true for vocalized text", () => {
    assert.equal(hasNikud("בְּרֵאשִׁית"), true);
  });

  test("false for unvocalized Hebrew text", () => {
    assert.equal(hasNikud("בראשית"), false);
  });

  test("false for Latin text", () => {
    assert.equal(hasNikud("Genesis"), false);
  });
});

describe("isHebrewText", () => {
  test("true when the string contains Hebrew letters", () => {
    assert.equal(isHebrewText("בראשית"), true);
  });

  test("true for a mixed Hebrew+address string", () => {
    assert.equal(isHebrewText('רש"י על בראשית א:א'), true);
  });

  test("false for pure Latin text", () => {
    assert.equal(isHebrewText("Genesis"), false);
    assert.equal(isHebrewText("Genesis 1:1"), false);
  });
});

describe("splitTitleAndAddress -- Hebrew geresh/gershayim addresses", () => {
  test("peels a colon-separated gematria address ('א:א')", () => {
    assert.deepEqual(splitTitleAndAddress("בראשית א:א"), {
      title: "בראשית",
      address: " א:א",
    });
  });

  test("peels a gershayim-marked gematria address ('כ״ג')", () => {
    assert.deepEqual(splitTitleAndAddress("בראשית כ״ג"), {
      title: "בראשית",
      address: " כ״ג",
    });
  });

  test("peels an address off a compound Hebrew title ('רש\"י על בראשית א:א')", () => {
    const result = splitTitleAndAddress('רש"י על בראשית א:א');
    assert.equal(result.title, 'רש"י על בראשית');
    assert.equal(result.address, " א:א");
  });

  test("does not split a bare multi-word Hebrew title with no address", () => {
    assert.deepEqual(splitTitleAndAddress("שולחן ערוך"), {
      title: "שולחן ערוך",
      address: "",
    });
  });
});

describe("isValidGematriaOrder / fixGematriaOrder", () => {
  test("detects an out-of-order token ('בק', value 2 then 100)", () => {
    assert.equal(isValidGematriaOrder("בק"), false);
  });

  test("accepts a correctly descending-value token ('קב', value 100 then 2)", () => {
    assert.equal(isValidGematriaOrder("קב"), true);
  });

  test("fixes an out-of-order token: 'בק' -> 'קב'", () => {
    assert.equal(fixGematriaOrder("בק"), "קב");
  });

  test("leaves an already-valid token untouched", () => {
    assert.equal(fixGematriaOrder("קב"), "קב");
  });

  test("leaves a single-letter token untouched (nothing to reorder)", () => {
    assert.equal(fixGematriaOrder("א"), "א");
  });
});

describe("generateHebrewVariants", () => {
  test("includes a כ/ח (kaf/ches) mid-word confusable swap", () => {
    const variants = generateHebrewVariants("מכות", 20);
    assert.ok(
      variants.includes("מחות"),
      `expected a כ->ח swap variant among: ${JSON.stringify(variants)}`
    );
  });

  test("never includes the original title itself", () => {
    const variants = generateHebrewVariants("מכות", 20);
    assert.ok(!variants.includes("מכות"));
  });

  test("is capped at the requested maxVariants for a long title", () => {
    // A long title has many possible single-letter swaps/insertions --
    // confirm the generator actually stops at the cap rather than
    // returning everything it could generate.
    const longTitle = "אבגדהוזחטיכלמנסעפצקרשת";
    const variants = generateHebrewVariants(longTitle, 6);
    assert.equal(variants.length, 6);
  });

  test("returns no variants for an empty title", () => {
    assert.deepEqual(generateHebrewVariants("", 6), []);
  });
});
