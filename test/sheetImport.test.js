// Tests for SPEC.md Wave 2 item 7 -- importing a Sefaria sheet. Covers the
// pure pieces: sheet-id parsing from a pasted URL/ID, HTML->plain-text
// stripping, and node classification/mapping into block descriptors.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  parseSheetIdFromInput,
  stripHtml,
  classifySheetNode,
  mapSheetToBlockDescriptors,
} from "../src/lib/sheetImport.js";

describe("parseSheetIdFromInput", () => {
  test("a bare numeric id", () => {
    assert.equal(parseSheetIdFromInput("12345"), "12345");
  });

  test("a full sheet URL", () => {
    assert.equal(parseSheetIdFromInput("https://www.sefaria.org/sheets/12345"), "12345");
  });

  test("a full sheet URL with a node anchor and query string", () => {
    assert.equal(
      parseSheetIdFromInput("https://www.sefaria.org/sheets/12345.3?lang=bi"),
      "12345"
    );
  });

  test("a bare id with a node-anchor suffix", () => {
    assert.equal(parseSheetIdFromInput("12345.3"), "12345");
  });

  test("a partial path", () => {
    assert.equal(parseSheetIdFromInput("sheets/12345"), "12345");
  });

  test("whitespace around the input is trimmed", () => {
    assert.equal(parseSheetIdFromInput("  12345  "), "12345");
  });

  test("unparseable input returns null", () => {
    assert.equal(parseSheetIdFromInput("Genesis 1:1"), null);
    assert.equal(parseSheetIdFromInput(""), null);
    assert.equal(parseSheetIdFromInput(null), null);
    assert.equal(parseSheetIdFromInput("https://www.sefaria.org/Genesis.1.1"), null);
  });
});

describe("stripHtml", () => {
  test("strips tags and decodes common entities", () => {
    assert.equal(stripHtml("<p>Hello &amp; welcome</p>"), "Hello & welcome");
  });

  test("converts <br> and block-closing tags to newlines", () => {
    assert.equal(stripHtml("<p>Line one<br>Line two</p>"), "Line one\nLine two");
  });

  test("collapses runs of blank lines", () => {
    assert.equal(stripHtml("<div>A</div><div></div><div></div><div>B</div>"), "A\n\nB");
  });

  test("empty/null input", () => {
    assert.equal(stripHtml(""), "");
    assert.equal(stripHtml(null), "");
  });
});

describe("classifySheetNode", () => {
  test("a source node (has `ref`)", () => {
    assert.deepEqual(classifySheetNode({ ref: "Genesis 1:1", heRef: "בראשית א:א" }), {
      type: "source",
      ref: "Genesis 1:1",
    });
  });

  test("an outsideText node", () => {
    assert.deepEqual(classifySheetNode({ outsideText: "<p>Some notes</p>" }), {
      type: "text",
      text: "Some notes",
    });
  });

  test("a comment node", () => {
    assert.deepEqual(classifySheetNode({ comment: "<p>My comment</p>" }), {
      type: "text",
      text: "My comment",
    });
  });

  test("a header node with a string title", () => {
    assert.deepEqual(classifySheetNode({ type: "header", title: "Section One" }), {
      type: "heading",
      text: "Section One",
    });
  });

  test("a header node with an {en, he} title object", () => {
    assert.deepEqual(
      classifySheetNode({ type: "header", title: { en: "Section One", he: "קטע א" } }),
      { type: "heading", text: "Section One" }
    );
  });

  test("a media node is dropped (unsupported)", () => {
    assert.equal(classifySheetNode({ media: "https://example.com/image.png" }), null);
  });

  test("an empty/blank outsideText is dropped", () => {
    assert.equal(classifySheetNode({ outsideText: "  " }), null);
  });

  test("an unrecognized node shape is dropped, not invented as a new type", () => {
    assert.equal(classifySheetNode({ node: 9, someUnknownField: true }), null);
  });

  test("null/non-object input is dropped", () => {
    assert.equal(classifySheetNode(null), null);
    assert.equal(classifySheetNode(undefined), null);
  });
});

describe("mapSheetToBlockDescriptors", () => {
  test("maps a mixed sources array, skipping unsupported nodes, preserving order", () => {
    const sources = [
      { type: "header", title: "Intro" },
      { ref: "Genesis 1:1" },
      { outsideText: "<p>Some free text</p>" },
      { media: "https://example.com/x.png" },
      { comment: "<p>A comment</p>" },
    ];
    assert.deepEqual(mapSheetToBlockDescriptors(sources), [
      { type: "heading", text: "Intro" },
      { type: "source", ref: "Genesis 1:1" },
      { type: "text", text: "Some free text" },
      { type: "text", text: "A comment" },
    ]);
  });

  test("non-array input returns an empty array", () => {
    assert.deepEqual(mapSheetToBlockDescriptors(null), []);
    assert.deepEqual(mapSheetToBlockDescriptors(undefined), []);
  });

  test("empty sources array returns an empty array", () => {
    assert.deepEqual(mapSheetToBlockDescriptors([]), []);
  });
});
