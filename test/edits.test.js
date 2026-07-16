// Tests for src/lib/edits.js: tokenization (incl. HTML-stripping),
// rebuildSegments realignment, and op semantics (trim edge-only enforcement,
// elide, bracket, substitute EN-only, zero-word rejection).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  stripHtmlToText,
  tokenizeSegments,
  rebuildSegments,
  allowedOps,
  canTrim,
  applyOp,
} from "../src/lib/edits.js";

describe("stripHtmlToText", () => {
  test("removes tags, keeps text", () => {
    assert.equal(stripHtmlToText("<span>hello</span> <i>world</i>"), " hello   world ");
  });

  test("decodes common entities", () => {
    assert.equal(stripHtmlToText("Tom &amp; Jerry"), "Tom & Jerry");
  });

  test("handles empty/null", () => {
    assert.equal(stripHtmlToText(""), "");
    assert.equal(stripHtmlToText(null), "");
  });
});

describe("tokenizeSegments", () => {
  test("splits plain segments into word tokens tagged with segIndex", () => {
    const tokens = tokenizeSegments(["hello world", "foo"]);
    assert.deepEqual(tokens, [
      { segIndex: 0, text: "hello" },
      { segIndex: 0, text: "world" },
      { segIndex: 1, text: "foo" },
    ]);
  });

  test("strips HTML markup before splitting into words", () => {
    const tokens = tokenizeSegments(["<span class='x'>הָיְתָ<sup>1</sup>ה</span> טוֹבָה"]);
    // Tags are stripped at the text level (not word-split-aware of markup);
    // the sup content ("1") disappears with its tag boundaries collapsing
    // into whitespace, so "הָיְתָ" and "ה" become separate words — this is
    // the documented tradeoff (edited segments lose inline markup).
    assert.ok(tokens.every((t) => !/[<>]/.test(t.text)));
    assert.ok(tokens.length > 0);
  });

  test("skips empty/whitespace-only segments", () => {
    const tokens = tokenizeSegments(["", "   ", "one"]);
    assert.deepEqual(tokens, [{ segIndex: 2, text: "one" }]);
  });

  test("empty input", () => {
    assert.deepEqual(tokenizeSegments([]), []);
    assert.deepEqual(tokenizeSegments(undefined), []);
  });
});

describe("rebuildSegments", () => {
  test("re-groups tokens by segIndex, joining words with a space", () => {
    const tokens = [
      { segIndex: 0, text: "hello" },
      { segIndex: 0, text: "world" },
      { segIndex: 2, text: "foo" },
    ];
    assert.deepEqual(rebuildSegments(tokens, 3), ["hello world", "", "foo"]);
  });

  test("a segment with no surviving tokens becomes an empty string", () => {
    const tokens = [{ segIndex: 1, text: "only" }];
    assert.deepEqual(rebuildSegments(tokens, 3), ["", "only", ""]);
  });

  test("out-of-range segIndex is dropped safely", () => {
    const tokens = [{ segIndex: 5, text: "stray" }];
    assert.deepEqual(rebuildSegments(tokens, 2), ["", ""]);
  });
});

describe("allowedOps", () => {
  test("Hebrew: trim/elide/bracket only, no substitute", () => {
    assert.deepEqual(allowedOps("he"), ["trim", "elide", "bracket"]);
  });

  test("English: adds substitute", () => {
    assert.deepEqual(allowedOps("en"), ["trim", "elide", "bracket", "substitute"]);
  });
});

describe("canTrim", () => {
  const tokens = tokenizeSegments(["one two three", "four five"]);

  test("allowed when selection touches the very start", () => {
    assert.equal(canTrim(tokens, 0, 1), true);
  });

  test("allowed when selection touches the very end", () => {
    assert.equal(canTrim(tokens, tokens.length - 2, tokens.length - 1), true);
  });

  test("rejected for a purely mid-text selection", () => {
    assert.equal(canTrim(tokens, 1, 2), false);
  });

  test("false on empty token list", () => {
    assert.equal(canTrim([], 0, 0), false);
  });
});

describe("applyOp: trim", () => {
  test("trims from the start", () => {
    const tokens = tokenizeSegments(["one two three"]);
    const result = applyOp(tokens, 0, 0, { type: "trim" });
    assert.equal(result.ok, true);
    assert.deepEqual(rebuildSegments(result.tokens, 1), ["two three"]);
  });

  test("trims from the end", () => {
    const tokens = tokenizeSegments(["one two three"]);
    const result = applyOp(tokens, 2, 2, { type: "trim" });
    assert.equal(result.ok, true);
    assert.deepEqual(rebuildSegments(result.tokens, 1), ["one two"]);
  });

  test("mid-text trim is rejected", () => {
    const tokens = tokenizeSegments(["one two three four"]);
    const result = applyOp(tokens, 1, 2, { type: "trim" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "trim-not-at-edge");
  });

  test("trimming every token is rejected (zero-word guard) even though it touches both edges", () => {
    const tokens = tokenizeSegments(["one two"]);
    const result = applyOp(tokens, 0, 1, { type: "trim" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "zero-words");
  });
});

describe("applyOp: elide", () => {
  test("replaces the middle range with a single ellipsis token", () => {
    const tokens = tokenizeSegments(["one two three four five"]);
    const result = applyOp(tokens, 1, 3, { type: "elide" });
    assert.equal(result.ok, true);
    assert.deepEqual(rebuildSegments(result.tokens, 1), ["one … five"]);
  });

  test("elide never reports zero words even when spanning nearly everything", () => {
    const tokens = tokenizeSegments(["one two three"]);
    const result = applyOp(tokens, 0, 2, { type: "elide" });
    assert.equal(result.ok, true);
    assert.deepEqual(rebuildSegments(result.tokens, 1), ["…"]);
  });
});

describe("applyOp: bracket", () => {
  test("replaces the range with user text wrapped in brackets", () => {
    const tokens = tokenizeSegments(["one two three"]);
    const result = applyOp(tokens, 1, 1, { type: "bracket", text: "TWO" });
    assert.equal(result.ok, true);
    assert.deepEqual(rebuildSegments(result.tokens, 1), ["one [TWO] three"]);
  });

  test("rejects empty/whitespace-only bracket text", () => {
    const tokens = tokenizeSegments(["one two three"]);
    const result = applyOp(tokens, 1, 1, { type: "bracket", text: "   " });
    assert.equal(result.ok, false);
    assert.equal(result.error, "empty-text");
  });
});

describe("applyOp: substitute (English-only semantics enforced by caller)", () => {
  test("replaces the range with typed text, no brackets", () => {
    const tokens = tokenizeSegments(["one two three"]);
    const result = applyOp(tokens, 1, 1, { type: "substitute", text: "TWO" });
    assert.equal(result.ok, true);
    assert.deepEqual(rebuildSegments(result.tokens, 1), ["one TWO three"]);
  });

  test("substitute is absent from the Hebrew allowed-ops list — UI must not offer it", () => {
    assert.equal(allowedOps("he").includes("substitute"), false);
  });

  test("rejects empty text", () => {
    const tokens = tokenizeSegments(["one two three"]);
    const result = applyOp(tokens, 1, 1, { type: "substitute", text: "" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "empty-text");
  });
});

describe("applyOp: zero-word rejection (whole-text deletion must be impossible)", () => {
  test("trimming the entire single-segment text is rejected", () => {
    const tokens = tokenizeSegments(["only text here"]);
    const result = applyOp(tokens, 0, tokens.length - 1, { type: "trim" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "zero-words");
    // Original tokens are untouched — caller keeps its working copy as-is.
    assert.equal(tokens.length, 3);
  });
});

describe("applyOp: invalid ranges", () => {
  test("out-of-bounds range is rejected", () => {
    const tokens = tokenizeSegments(["one two"]);
    assert.equal(applyOp(tokens, 0, 5, { type: "elide" }).ok, false);
    assert.equal(applyOp(tokens, -1, 1, { type: "elide" }).ok, false);
  });

  test("unknown op type is rejected", () => {
    const tokens = tokenizeSegments(["one two"]);
    const result = applyOp(tokens, 0, 0, { type: "delete-everything" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "unknown-op");
  });
});

describe("segment realignment across a multi-segment elide", () => {
  test("an elide spanning a segment boundary empties the fully-consumed segment", () => {
    const segments = ["alpha beta", "gamma delta", "epsilon"];
    const tokens = tokenizeSegments(segments);
    // tokens: alpha(0) beta(0) gamma(1) delta(1) epsilon(2)
    // elide beta..delta (indices 1..3) -> spans seg 0 (partial) and seg 1 (whole)
    const result = applyOp(tokens, 1, 3, { type: "elide" });
    assert.equal(result.ok, true);
    const rebuilt = rebuildSegments(result.tokens, segments.length);
    assert.deepEqual(rebuilt, ["alpha …", "", "epsilon"]);
  });
});
