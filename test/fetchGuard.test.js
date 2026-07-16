// Tests for SPEC.md Wave 2 item 5 -- guard huge fetches. Pure parsing of
// /api/shape responses; no network involved.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { estimateSegmentCount, isLargeFetch, LARGE_FETCH_THRESHOLD } from "../src/lib/fetchGuard.js";

describe("estimateSegmentCount", () => {
  test("null/undefined shape -> null (unknown)", () => {
    assert.equal(estimateSegmentCount(null), null);
    assert.equal(estimateSegmentCount(undefined), null);
  });

  test("a flat single-node shape with a numeric length", () => {
    assert.equal(estimateSegmentCount({ length: 31 }), 31);
  });

  test("a shape with no usable length/chapters/nodes fields -> null", () => {
    assert.equal(estimateSegmentCount({ book: "Genesis", ambiguous: false }), null);
  });

  test("a whole-book shape: an array of per-chapter node shapes, summed", () => {
    const shape = [{ length: 31 }, { length: 25 }, { length: 24 }];
    assert.equal(estimateSegmentCount(shape), 80);
  });

  test("a shape with a `chapters` array of raw numbers, summed", () => {
    const shape = { chapters: [31, 25, 24] };
    assert.equal(estimateSegmentCount(shape), 80);
  });

  test("a `chapters` array mixing numbers and nested node shapes", () => {
    const shape = { chapters: [31, { length: 25 }, 24] };
    assert.equal(estimateSegmentCount(shape), 80);
  });

  test("a schema/complex-text shape with a `nodes` array, walked recursively", () => {
    const shape = { nodes: [{ length: 10 }, { chapters: [5, 5] }] };
    assert.equal(estimateSegmentCount(shape), 20);
  });

  test("a single small chapter shape", () => {
    assert.equal(estimateSegmentCount({ length: 5 }), 5);
  });
});

describe("isLargeFetch", () => {
  test("above the default threshold (40) is large", () => {
    assert.equal(isLargeFetch(41), true);
    assert.equal(isLargeFetch(1000), true);
  });

  test("at or below the default threshold is not large", () => {
    assert.equal(isLargeFetch(40), false);
    assert.equal(isLargeFetch(1), false);
    assert.equal(isLargeFetch(0), false);
  });

  test("an unknown (null) count is never treated as large", () => {
    assert.equal(isLargeFetch(null), false);
  });

  test("a custom threshold is honored", () => {
    assert.equal(isLargeFetch(10, 5), true);
    assert.equal(isLargeFetch(4, 5), false);
  });

  test("LARGE_FETCH_THRESHOLD is 40 per SPEC.md", () => {
    assert.equal(LARGE_FETCH_THRESHOLD, 40);
  });
});
