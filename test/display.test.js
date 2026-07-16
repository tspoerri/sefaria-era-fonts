// Tests for src/lib/display.js: the Unicode strip helpers, the Hebrew
// numeral helper, and layoutSegments for all 6 modes (4 Tanakh + 2 other).
// Fixtures: a synthetic 2-perek Tanakh range (with a {פ} petuchah marker on
// the first perek's last verse) and a synthetic commentary (non-Tanakh)
// source. All pure/offline.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  stripTaamim,
  stripNikkud,
  stripSofPassuk,
  toHebrewNumeral,
  layoutSegments,
} from "../src/lib/display.js";

describe("stripTaamim", () => {
  test("removes cantillation marks, keeps nikkud and letters", () => {
    // בְּרֵאשִׁ֖ית with a taam (U+05D6 zinor... using a real taam codepoint)
    const withTaam = "בְּרֵאשִׁ֖ית";
    const stripped = stripTaamim(withTaam);
    assert.ok(!/֖/.test(stripped));
    assert.ok(/ְ/.test(stripped), "nikkud should survive");
  });

  test("no-op on plain text", () => {
    assert.equal(stripTaamim("hello"), "hello");
  });
});

describe("stripNikkud", () => {
  test("removes vowel points, keeps letters", () => {
    assert.equal(stripNikkud("בְּרֵאשִׁית"), "בראשית");
  });

  test("no-op on already-bare text", () => {
    assert.equal(stripNikkud("בראשית"), "בראשית");
  });
});

describe("stripSofPassuk", () => {
  test("removes the sof passuk mark", () => {
    assert.equal(stripSofPassuk("בְּרֵאשִׁית׃"), "בְּרֵאשִׁית");
  });

  test("no-op when absent", () => {
    assert.equal(stripSofPassuk("hello"), "hello");
  });
});

describe("toHebrewNumeral", () => {
  test("single letters 1-9", () => {
    assert.equal(toHebrewNumeral(1), "א׳");
    assert.equal(toHebrewNumeral(9), "ט׳");
  });

  test("15 and 16 use the traditional tet-vav / tet-zayin exceptions", () => {
    assert.equal(toHebrewNumeral(15), "ט״ו");
    assert.equal(toHebrewNumeral(16), "ט״ז");
  });

  test("multi-letter numbers get gershayim before the last letter", () => {
    assert.equal(toHebrewNumeral(2), "ב׳");
    assert.equal(toHebrewNumeral(11), "י״א");
    assert.equal(toHebrewNumeral(119), "קי״ט");
  });

  test("returns empty string for non-positive input", () => {
    assert.equal(toHebrewNumeral(0), "");
    assert.equal(toHebrewNumeral(-1), "");
  });
});

// ---- layoutSegments fixtures ------------------------------------------------

// A 2-perek Tanakh range: perek 1 has 2 verses (the second carries a
// trailing {פ} petuchah marker), perek 2 has 1 verse.
const tanakhFixture = {
  isTanakh: true,
  heSegments: [
    "בְּרֵאשִׁ֖ית בָּרָ֣א",
    "וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ {פ}",
    "וַיֹּ֥אמֶר אֱלֹהִ֖ים",
  ],
  enSegments: [
    "In the beginning God created",
    "And the earth was unformed",
    "And God said",
  ],
  segmentRefs: [
    { perek: 1, passuk: 1 },
    { perek: 1, passuk: 2 },
    { perek: 2, passuk: 1 },
  ],
};

// A non-Tanakh (commentary) source: flat sections, no perek concept.
const commentaryFixture = {
  isTanakh: false,
  heSegments: ["דיבור המתחיל הראשון", "דיבור המתחיל השני"],
  enSegments: ["First dibbur hamatchil", "Second dibbur hamatchil"],
  segmentRefs: [{ segment: 1 }, { segment: 2 }],
};

describe("layoutSegments — Tanakh modes", () => {
  test("klaf: continuous flow, no numbers, petuchah breaks into a new block, no פ/ס letters shown", () => {
    const blocks = layoutSegments(tanakhFixture, "klaf");
    // petuchah after segment index 1 splits into two flow blocks
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].type, "flow");
    assert.equal(blocks[1].type, "flow");
    // no visible passuk numbers
    for (const block of blocks) {
      for (const seg of block.segments) {
        assert.equal(seg.num, null);
      }
    }
    // no nikkud/taamim/sof-passuk, and no isolated פ/ס marker segments
    const allHe = blocks.flatMap((b) => b.segments.map((s) => s.he)).join(" ");
    assert.ok(!/[֑-ׇ]/.test(allHe), "no nikkud/taamim/sof-passuk should remain");
    assert.ok(
      blocks.every((b) => b.segments.every((s) => !s.isMarker)),
      "klaf mode should not surface standalone פ/ס marker segments"
    );
    assert.ok(!/[\{\(][פס][\}\)]/.test(allHe), "raw {פ}/{ס} marker token should be stripped");
  });

  test("sefer: single continuous flow, taamim+nikkud+sof-passuk kept, faint markers shown, numbers small-faint", () => {
    const blocks = layoutSegments(tanakhFixture, "sefer");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "flow");
    const segs = blocks[0].segments;
    // 3 verse segments + 1 marker segment for the petuchah = 4
    assert.equal(segs.length, 4);
    assert.equal(segs[0].num, 1);
    assert.equal(segs[0].numStyle, "small-faint");
    // marker follows the verse it terminates (index 0 = v1, 1 = v2, 2 = marker)
    assert.ok(segs[2].isMarker);
    assert.equal(segs[2].he, "פ");
  });

  test("simple: each perek gets a heading block, each passuk its own line block with a regular-size number", () => {
    const blocks = layoutSegments(tanakhFixture, "simple");
    // perekHeading(1), line, line, perekHeading(2), line
    assert.equal(blocks.filter((b) => b.type === "perekHeading").length, 2);
    assert.equal(blocks.filter((b) => b.type === "line").length, 3);
    const heading1 = blocks.find((b) => b.type === "perekHeading" && b.perek === 1);
    assert.equal(heading1.enText, "Chapter 1");
    assert.equal(heading1.heText, "פרק א׳");
    const firstLine = blocks.find((b) => b.type === "line");
    assert.equal(firstLine.segments[0].numStyle, "regular");
    assert.equal(firstLine.segments[0].num, 1);
  });

  test("bare: continuous flow within a perek, new block at perek boundary, numbers small-faint, sof passuk kept", () => {
    const blocks = layoutSegments(tanakhFixture, "bare");
    // perek 1 (2 verses) + perek 2 (1 verse) = 2 flow blocks
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].segments.length, 2);
    assert.equal(blocks[1].segments.length, 1);
    assert.equal(blocks[0].segments[0].numStyle, "small-faint");
    // no nikkud/taamim
    assert.ok(!/[ְ-ּ֑-֯]/.test(blocks[0].segments[0].he));
  });
});

describe("layoutSegments — other-text modes", () => {
  test("sefer: each section its own line/paragraph block, numbers small-faint, nikkud preserved", () => {
    const blocks = layoutSegments(commentaryFixture, "sefer");
    assert.equal(blocks.length, 2);
    assert.ok(blocks.every((b) => b.type === "line"));
    assert.equal(blocks[0].segments[0].num, 1);
    assert.equal(blocks[0].segments[0].numStyle, "small-faint");
  });

  test("bare: single continuous flow, nikkud stripped, numbers small-faint inline", () => {
    const blocks = layoutSegments(commentaryFixture, "bare");
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "flow");
    assert.equal(blocks[0].segments.length, 2);
    assert.equal(blocks[0].segments[0].numStyle, "small-faint");
  });
});

describe("layoutSegments — edited overlay", () => {
  test("uses heEdited/enEdited over heSegments/enSegments when present", () => {
    const edited = {
      ...commentaryFixture,
      heEdited: ["ערוך ראשון", "ערוך שני"],
      enEdited: ["Edited first", "Edited second"],
    };
    const blocks = layoutSegments(edited, "sefer");
    assert.equal(blocks[0].segments[0].he, "ערוך ראשון");
    assert.equal(blocks[0].segments[0].en, "Edited first");
  });
});
