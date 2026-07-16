// Tests for src/lib/keyboardLayouts.js: mapping-table integrity for the
// Hebrew keyboard popup (Wave D2). Pure data/functions — no DOM needed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  HEBREW_LETTERS,
  FINALS,
  FINAL_LETTERS,
  ALL_LETTERS,
  SI1452,
  QWERTY_PHONETIC,
  QWERTY_SHIFT_FINALS,
  LAYOUTS,
  PHYSICAL_MODES,
  getLayoutRows,
  mapPhysicalKey,
} from "../src/lib/keyboardLayouts.js";

function flatChars(rows) {
  return rows.flat().map((k) => k.char);
}

function flatShiftChars(rows) {
  return rows.flat().flatMap((k) => (k.shiftChar ? [k.shiftChar] : []));
}

describe("alphabet data", () => {
  test("22 base letters, 5 finals, 27 total distinct glyphs", () => {
    assert.equal(HEBREW_LETTERS.length, 22);
    assert.equal(Object.keys(FINALS).length, 5);
    assert.equal(FINAL_LETTERS.length, 5);
    assert.equal(ALL_LETTERS.length, 27);
    assert.equal(new Set(ALL_LETTERS).size, 27);
  });
});

describe("on-screen layouts: every letter reachable", () => {
  for (const layout of LAYOUTS) {
    test(`"${layout}" layout reaches all 22 base letters`, () => {
      const rows = getLayoutRows(layout);
      const chars = new Set([...flatChars(rows), ...flatShiftChars(rows)]);
      for (const letter of HEBREW_LETTERS) {
        assert.ok(chars.has(letter), `${layout} is missing base letter ${letter}`);
      }
    });

    test(`"${layout}" layout reaches all 5 final letters`, () => {
      const rows = getLayoutRows(layout);
      const chars = new Set([...flatChars(rows), ...flatShiftChars(rows)]);
      for (const final of FINAL_LETTERS) {
        assert.ok(chars.has(final), `${layout} is missing final letter ${final}`);
      }
    });
  }

  test("alephbet layout has no duplicate keys", () => {
    const chars = flatChars(getLayoutRows("alephbet"));
    assert.equal(new Set(chars).size, chars.length);
  });

  test("israeli on-screen layout has no duplicate keys", () => {
    const chars = flatChars(getLayoutRows("israeli"));
    assert.equal(new Set(chars).size, chars.length);
  });

  test("qwerty on-screen base chars have no duplicate collisions", () => {
    const chars = flatChars(getLayoutRows("qwerty"));
    assert.equal(new Set(chars).size, chars.length);
  });

  test("qwerty on-screen shift chars (finals) have no duplicate collisions", () => {
    const shiftChars = flatShiftChars(getLayoutRows("qwerty"));
    assert.equal(new Set(shiftChars).size, shiftChars.length);
    // and none collide with a base char on a *different* key
    const baseChars = new Set(flatChars(getLayoutRows("qwerty")));
    for (const s of shiftChars) {
      assert.ok(!baseChars.has(s), `shift char ${s} collides with a base char`);
    }
  });
});

describe("SI-1452 physical mapping spot checks", () => {
  test("documented key examples from SPEC.md", () => {
    assert.equal(SI1452.q, "/");
    assert.equal(SI1452.w, "'");
    assert.equal(SI1452.e, "ק");
    assert.equal(SI1452.r, "ר");
    assert.equal(SI1452.t, "א");
    assert.equal(SI1452.y, "ט");
    assert.equal(SI1452.u, "ו");
    assert.equal(SI1452.i, "ן");
    assert.equal(SI1452.o, "ם");
    assert.equal(SI1452.p, "פ");
    assert.equal(SI1452.a, "ש");
    assert.equal(SI1452[";"], "ף");
    assert.equal(SI1452.z, "ז");
    assert.equal(SI1452[","], "ת");
    assert.equal(SI1452["."], "ץ");
  });

  test("covers all 27 glyphs with no duplicate target letters", () => {
    const letters = Object.values(SI1452).filter((c) => ALL_LETTERS.includes(c));
    assert.equal(new Set(letters).size, letters.length);
    for (const letter of ALL_LETTERS) {
      assert.ok(letters.includes(letter), `SI1452 is missing ${letter}`);
    }
  });

  test("mapPhysicalKey('israeli', ...) matches the table, case-insensitively", () => {
    assert.equal(mapPhysicalKey("israeli", "t", false), "א");
    assert.equal(mapPhysicalKey("israeli", "T", false), "א");
    assert.equal(mapPhysicalKey("israeli", "1", false), null);
  });
});

describe("phonetic (qwerty) physical mapping", () => {
  test("base letters have no duplicate collisions", () => {
    const values = Object.values(QWERTY_PHONETIC);
    assert.equal(new Set(values).size, values.length);
  });

  test("covers all 22 base letters", () => {
    const values = new Set(Object.values(QWERTY_PHONETIC));
    for (const letter of HEBREW_LETTERS) {
      assert.ok(values.has(letter), `QWERTY_PHONETIC is missing ${letter}`);
    }
  });

  test("finals are reachable via shift on the base consonant's key", () => {
    for (const [key, final] of Object.entries(QWERTY_SHIFT_FINALS)) {
      const base = QWERTY_PHONETIC[key];
      assert.ok(base, `shift-final key ${key} has no base mapping`);
      assert.equal(FINALS[base], final, `${key}: base ${base} should have final ${final}`);
    }
    // every base letter that has a final is reachable via shift somewhere
    for (const [base, final] of Object.entries(FINALS)) {
      const key = Object.entries(QWERTY_PHONETIC).find(([, v]) => v === base)[0];
      assert.equal(QWERTY_SHIFT_FINALS[key], final);
    }
  });

  test("mapPhysicalKey('qwerty', ...) plain vs shift", () => {
    assert.equal(mapPhysicalKey("qwerty", "m", false), "מ");
    assert.equal(mapPhysicalKey("qwerty", "m", true), "ם");
    assert.equal(mapPhysicalKey("qwerty", "a", false), "א");
    assert.equal(mapPhysicalKey("qwerty", "a", true), "א"); // no final for alef -> falls back to base
  });
});

describe("mapPhysicalKey with 'original' mode", () => {
  test("never remaps", () => {
    assert.equal(mapPhysicalKey("original", "t", false), null);
    assert.equal(mapPhysicalKey("original", "q", false), null);
  });
});

describe("PHYSICAL_MODES / LAYOUTS", () => {
  test("expected values present", () => {
    assert.deepEqual(LAYOUTS, ["alephbet", "israeli", "qwerty"]);
    assert.deepEqual(PHYSICAL_MODES, ["original", "israeli", "qwerty"]);
  });
});
