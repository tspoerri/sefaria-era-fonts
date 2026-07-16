// Tests for src/lib/textDir.js: first-word-driven direction detection for
// free-text inputs (Wave 3 item 9).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectDir } from "../src/lib/textDir.js";

describe("detectDir", () => {
  test("empty/null/whitespace-only input is inconclusive", () => {
    assert.equal(detectDir(""), null);
    assert.equal(detectDir(null), null);
    assert.equal(detectDir(undefined), null);
    assert.equal(detectDir("   "), null);
  });

  test("Hebrew first word -> rtl", () => {
    assert.equal(detectDir("בראשית ברא"), "rtl");
  });

  test("Latin first word -> ltr", () => {
    assert.equal(detectDir("Genesis 1:1"), "ltr");
  });

  test("only the first word matters, even if later words are the other script", () => {
    assert.equal(detectDir("Genesis בראשית"), "ltr");
    assert.equal(detectDir("בראשית Genesis"), "rtl");
  });

  test("digits/punctuation-only first word is inconclusive (null)", () => {
    assert.equal(detectDir("123 Genesis"), null);
    assert.equal(detectDir("— hello"), null);
  });

  test("leading whitespace is ignored when finding the first word", () => {
    assert.equal(detectDir("   שלום"), "rtl");
  });

  test("re-evaluates as the first word changes (deleting the first word flips it)", () => {
    const withFirstWord = "Genesis בראשית";
    const afterDeletingFirstWord = "בראשית"; // user deleted "Genesis "
    assert.equal(detectDir(withFirstWord), "ltr");
    assert.equal(detectDir(afterDeletingFirstWord), "rtl");
  });
});
