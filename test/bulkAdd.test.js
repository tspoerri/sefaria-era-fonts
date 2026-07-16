// Tests for SPEC.md Wave 1 item 4 -- bulk add: splitting a single-pipe-
// separated input into independently-normalized source queries.
// `splitBulkRefs` (src/lib/inputNormalize.js) is the pure splitting piece;
// per-item resolve/add looping with per-item failure reporting lives in
// App.jsx's `handleAdd`, which isn't unit-testable here (no React test
// harness in this repo -- see test/README-equivalent notes in other files),
// so this file pins the piece that IS pure and reusable.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { splitBulkRefs, normalizeSourceInput } from "../src/lib/inputNormalize.js";

describe("splitBulkRefs", () => {
  test("splits on a single pipe into trimmed pieces", () => {
    assert.deepEqual(splitBulkRefs("Genesis 1:1 | Rashi on Genesis 1:1"), [
      "Genesis 1:1",
      "Rashi on Genesis 1:1",
    ]);
  });

  test("splits three items, including a Hebrew Gemara daf address", () => {
    assert.deepEqual(splitBulkRefs("Genesis 1:1 | Rashi on Genesis 1:1 | ברכות יב."), [
      "Genesis 1:1",
      "Rashi on Genesis 1:1",
      "ברכות יב.",
    ]);
  });

  test("a single item with no pipe comes back as a one-element array", () => {
    assert.deepEqual(splitBulkRefs("Genesis 1:1"), ["Genesis 1:1"]);
  });

  test("empty/blank segments (stray or doubled pipes) are dropped", () => {
    assert.deepEqual(splitBulkRefs("Genesis 1:1 || Exodus 2:2"), ["Genesis 1:1", "Exodus 2:2"]);
    assert.deepEqual(splitBulkRefs("Genesis 1:1 |"), ["Genesis 1:1"]);
  });

  test("empty input returns an empty array", () => {
    assert.deepEqual(splitBulkRefs(""), []);
    assert.deepEqual(splitBulkRefs(null), []);
  });

  test("each split piece runs through normalizeSourceInput independently and correctly", () => {
    const items = splitBulkRefs("Brachos daf 2 amud a | ברכות יב. | parshas Noach");
    const normalized = items.map((item) => normalizeSourceInput(item));
    assert.deepEqual(normalized, ["Brachos 2a", "Berakhot 12a", "Genesis 6:9-11:32"]);
  });
});
