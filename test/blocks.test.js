// Tests for src/lib/blocks.js: block constructors, reorder logic, and the
// delete-guard undo-stack restore-at-position helpers.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  makeBlockId,
  newSourceBlock,
  newHeadingBlock,
  newTextBlock,
  newSpacerBlock,
  reorderBlocks,
  removeBlockAt,
  restoreBlockAt,
  blockLabel,
  SPACER_SIZES,
} from "../src/lib/blocks.js";

describe("block constructors", () => {
  test("makeBlockId returns unique ids", () => {
    const a = makeBlockId();
    const b = makeBlockId();
    assert.notEqual(a, b);
  });

  test("newSourceBlock wraps a source with type 'source'", () => {
    const source = { id: "s1", ref: "Genesis 1:1" };
    const block = newSourceBlock(source);
    assert.equal(block.type, "source");
    assert.equal(block.source, source);
    assert.ok(block.id);
  });

  test("newHeadingBlock / newTextBlock default to empty text", () => {
    assert.equal(newHeadingBlock().text, "");
    assert.equal(newHeadingBlock("Intro").text, "Intro");
    assert.equal(newTextBlock().text, "");
    assert.equal(newTextBlock("Some notes").text, "Some notes");
  });

  test("newSpacerBlock defaults to size M and rejects invalid sizes", () => {
    assert.equal(newSpacerBlock().size, "M");
    assert.equal(newSpacerBlock("S").size, "S");
    assert.equal(newSpacerBlock("L").size, "L");
    assert.equal(newSpacerBlock("XL").size, "M");
    assert.deepEqual(SPACER_SIZES, ["S", "M", "L"]);
  });
});

describe("reorderBlocks", () => {
  const blocks = () => [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  test("moves a block forward", () => {
    const next = reorderBlocks(blocks(), 0, 2);
    assert.deepEqual(
      next.map((b) => b.id),
      ["b", "c", "a", "d"]
    );
  });

  test("moves a block backward", () => {
    const next = reorderBlocks(blocks(), 3, 0);
    assert.deepEqual(
      next.map((b) => b.id),
      ["d", "a", "b", "c"]
    );
  });

  test("same from/to index is a no-op (returns original reference)", () => {
    const original = blocks();
    const next = reorderBlocks(original, 1, 1);
    assert.equal(next, original);
  });

  test("out-of-range indices are a no-op", () => {
    const original = blocks();
    assert.equal(reorderBlocks(original, -1, 2), original);
    assert.equal(reorderBlocks(original, 0, 99), original);
    assert.equal(reorderBlocks(original, 99, 0), original);
  });

  test("does not mutate the input array", () => {
    const original = blocks();
    const copy = original.map((b) => ({ ...b }));
    reorderBlocks(original, 0, 2);
    assert.deepEqual(original, copy);
  });
});

describe("removeBlockAt / restoreBlockAt (delete-guard undo stack)", () => {
  const blocks = () => [{ id: "a" }, { id: "b" }, { id: "c" }];

  test("removeBlockAt removes the block and returns a {block, index} record", () => {
    const { blocks: next, removed } = removeBlockAt(blocks(), 1);
    assert.deepEqual(
      next.map((b) => b.id),
      ["a", "c"]
    );
    assert.equal(removed.block.id, "b");
    assert.equal(removed.index, 1);
  });

  test("removeBlockAt on an out-of-range index is a no-op with removed: null", () => {
    const original = blocks();
    const { blocks: next, removed } = removeBlockAt(original, 99);
    assert.equal(next, original);
    assert.equal(removed, null);
  });

  test("restoreBlockAt re-inserts a removed block at its original position", () => {
    const { blocks: afterRemove, removed } = removeBlockAt(blocks(), 1);
    const restored = restoreBlockAt(afterRemove, removed);
    assert.deepEqual(
      restored.map((b) => b.id),
      ["a", "b", "c"]
    );
  });

  test("restoreBlockAt clamps to the current length if the array shrank further", () => {
    const { blocks: afterRemove, removed } = removeBlockAt(blocks(), 2); // removes "c" at index 2
    // simulate another deletion happening while the undo toast was showing
    const shrunkFurther = afterRemove.slice(0, 1); // only "a" left
    const restored = restoreBlockAt(shrunkFurther, removed);
    assert.deepEqual(
      restored.map((b) => b.id),
      ["a", "c"]
    );
  });

  test("restoreBlockAt is a no-op for a null/empty removed record", () => {
    const original = blocks();
    assert.equal(restoreBlockAt(original, null), original);
  });

  test("round-trips through multiple remove/restore cycles preserving original order", () => {
    let current = blocks();
    const removedFirst = removeBlockAt(current, 0);
    current = removedFirst.blocks;
    const removedSecond = removeBlockAt(current, 0); // removes "b" (now at index 0)
    current = removedSecond.blocks;
    assert.deepEqual(current.map((b) => b.id), ["c"]);

    // Undo the most recent deletion first (LIFO), then the earlier one.
    current = restoreBlockAt(current, removedSecond.removed);
    current = restoreBlockAt(current, removedFirst.removed);
    assert.deepEqual(current.map((b) => b.id), ["a", "b", "c"]);
  });
});

describe("blockLabel", () => {
  test("source block: prefers EN titleOverride/ref for siteLang en", () => {
    const block = newSourceBlock({ ref: "Genesis 1:1", heRef: "בראשית א:א" });
    assert.equal(blockLabel(block, "en"), "Genesis 1:1");
  });

  test("source block: prefers HE titleOverride/heRef for siteLang he", () => {
    const block = newSourceBlock({ ref: "Genesis 1:1", heRef: "בראשית א:א" });
    assert.equal(blockLabel(block, "he"), "בראשית א:א");
  });

  test("source block: titleOverride wins over ref/heRef", () => {
    const block = newSourceBlock({
      ref: "Genesis 1:1",
      heRef: "בראשית א:א",
      titleOverride: { en: "Custom Title", he: null },
    });
    assert.equal(blockLabel(block, "en"), "Custom Title");
  });

  test("heading/text blocks use their own text", () => {
    assert.equal(blockLabel(newHeadingBlock("Section One"), "en"), "Section One");
    assert.equal(blockLabel(newTextBlock("Some notes"), "en"), "Some notes");
  });

  test("text block label is truncated past 40 chars", () => {
    const long = "x".repeat(60);
    const label = blockLabel(newTextBlock(long), "en");
    assert.ok(label.length <= 41);
    assert.ok(label.endsWith("…"));
  });

  test("spacer block is labeled by size", () => {
    assert.equal(blockLabel(newSpacerBlock("L"), "en"), "L");
  });
});
