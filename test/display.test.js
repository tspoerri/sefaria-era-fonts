// Tests for src/lib/display.js: the Unicode strip helpers, the Hebrew
// numeral helper, and layoutSegments(source, toggles) — the toggle-based
// replacement for the old mode-string layout functions. See
// docs/ARCHITECTURE.md "Display toggles" and src/lib/settings.js
// (TANAKH_PRESETS/OTHER_PRESETS) for the toggle contract.
//
// Fixtures: a synthetic 2-perek Tanakh range (with a {פ} petuchah marker on
// the first perek's last verse), a synthetic single-perek range with a {ס}
// setumah marker, a synthetic commentary (non-Tanakh) source, and a pair of
// structurally-identical Tanakh/non-Tanakh sources for the isTanakh
// invariance check. All pure/offline.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  stripTaamim,
  stripNikkud,
  stripSofPassuk,
  toHebrewNumeral,
  layoutSegments,
} from "../src/lib/display.js";
import { TANAKH_PRESETS, OTHER_PRESETS } from "../src/lib/settings.js";

describe("stripTaamim", () => {
  test("removes cantillation marks, keeps nikkud and letters", () => {
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

// A single-perek range with a {ס} setumah marker on the middle verse.
const setumahFixture = {
  isTanakh: true,
  heSegments: ["וְאֵ֗לֶּה שְׁמוֹת֙", "בְּנֵ֣י יִשְׂרָאֵ֔ל {ס}", "הַבָּאִ֖ים מִצְרָ֑יְמָה"],
  enSegments: ["And these are the names", "of the sons of Israel", "who came to Egypt"],
  segmentRefs: [
    { perek: 1, passuk: 1 },
    { perek: 1, passuk: 2 },
    { perek: 1, passuk: 3 },
  ],
};

// A non-Tanakh (commentary) source: flat sections, no perek concept.
const commentaryFixture = {
  isTanakh: false,
  heSegments: ["דיבור המתחיל הראשון", "דיבור המתחיל השני"],
  enSegments: ["First dibbur hamatchil", "Second dibbur hamatchil"],
  segmentRefs: [{ segment: 1 }, { segment: 2 }],
};

// Structurally identical Tanakh vs. non-Tanakh sources (same numeric
// perek/passuk values, just under the other ref-key names) for the
// isTanakh-invariance check.
const invarianceTanakh = {
  isTanakh: true,
  heSegments: ["אאא", "בבב", "גגג"],
  enSegments: ["aaa", "bbb", "ccc"],
  segmentRefs: [
    { perek: 1, passuk: 1 },
    { perek: 1, passuk: 2 },
    { perek: 2, passuk: 1 },
  ],
};
const invarianceOther = {
  isTanakh: false,
  heSegments: ["אאא", "בבב", "גגג"],
  enSegments: ["aaa", "bbb", "ccc"],
  segmentRefs: [
    { section: 1, segment: 1 },
    { section: 1, segment: 2 },
    { section: 2, segment: 1 },
  ],
};

describe("layoutSegments — Tanakh presets", () => {
  test("klaf: continuous flow, no numbers, petuchah splits into a new block, no פ/ס letters shown", () => {
    const blocks = layoutSegments(tanakhFixture, TANAKH_PRESETS.klaf);
    // petuchah after segment index 1 splits into two flow blocks
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].type, "flow");
    assert.equal(blocks[1].type, "flow");
    for (const block of blocks) {
      for (const seg of block.segments) {
        assert.equal(seg.numStyle, "none");
      }
    }
    const allHe = blocks.flatMap((b) => b.segments.map((s) => s.he)).join(" ");
    assert.ok(!/[֑-ׇ]/.test(allHe), "no nikkud/taamim/sof-passuk should remain");
    assert.ok(
      blocks.every((b) => b.segments.every((s) => !s.isMarker)),
      "klaf preset should not surface standalone פ/ס marker segments"
    );
    assert.ok(!/[\{\(][פס][\}\)]/.test(allHe), "raw {פ}/{ס} marker token should be stripped");
  });

  test("sefer: single continuous flow, taamim+nikkud+sof-passuk kept, inline faint markers, numbers small-faint", () => {
    const blocks = layoutSegments(tanakhFixture, TANAKH_PRESETS.sefer);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "flow");
    const segs = blocks[0].segments;
    // 3 verse segments + 1 marker segment for the petuchah = 4
    assert.equal(segs.length, 4);
    assert.equal(segs[0].num, 1);
    assert.equal(segs[0].numStyle, "small-faint");
    assert.ok(segs[2].isMarker);
    assert.equal(segs[2].he, "פ");
  });

  test("simple: verse-per-line, letter-style inline marker (no chapterHeadings), numbers small-faint", () => {
    const blocks = layoutSegments(tanakhFixture, TANAKH_PRESETS.simple);
    // TANAKH_PRESETS.simple has chapterHeadings: false, so no heading blocks
    assert.equal(blocks.filter((b) => b.type === "perekHeading").length, 0);
    // v1, v2, marker(פ), v3 = 4 line blocks
    assert.equal(blocks.filter((b) => b.type === "line").length, 4);
    assert.equal(blocks.length, 4);
    assert.equal(blocks[0].segments[0].num, 1);
    assert.equal(blocks[0].segments[0].numStyle, "small-faint");
    assert.ok(blocks[2].segments[0].isMarker);
    assert.equal(blocks[2].segments[0].he, "פ");
  });
});

describe("layoutSegments — other-text presets", () => {
  test("sefer: verse-per-line, numbers small-faint, nikkud/taamim preserved", () => {
    const blocks = layoutSegments(commentaryFixture, OTHER_PRESETS.sefer);
    assert.equal(blocks.length, 2);
    assert.ok(blocks.every((b) => b.type === "line"));
    assert.equal(blocks[0].segments[0].num, 1);
    assert.equal(blocks[0].segments[0].numStyle, "small-faint");
  });

  test("simple: single continuous flow, nikkud stripped, numbers small-faint inline", () => {
    const blocks = layoutSegments(commentaryFixture, OTHER_PRESETS.simple);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, "flow");
    assert.equal(blocks[0].segments.length, 2);
    assert.equal(blocks[0].segments[0].numStyle, "small-faint");
    assert.ok(!/[ְ-ּ]/.test(blocks[0].segments[0].he), "nikkud should be stripped");
  });
});

describe("layoutSegments — verse+chapter interaction", () => {
  test("verseLineBreaks + chapterHeadings: heading inserted before first line of each new chapter, including the first", () => {
    const toggles = {
      nikkud: true,
      taamim: true,
      punctuation: true,
      verseLineBreaks: true,
      chapterLineBreaks: false,
      showNumbers: true,
      chapterHeadings: true,
    };
    const blocks = layoutSegments(tanakhFixture, toggles);
    assert.equal(blocks[0].type, "perekHeading");
    assert.equal(blocks[0].perek, 1);
    assert.equal(blocks[0].heText, "פרק א׳");
    assert.equal(blocks[0].enText, "Chapter 1");
    const headingIdxForPerek2 = blocks.findIndex((b) => b.type === "perekHeading" && b.perek === 2);
    assert.ok(headingIdxForPerek2 > 0, "second chapter heading should appear before its first line");
    // the line immediately after the perek-2 heading is the perek-2 verse
    assert.equal(blocks[headingIdxForPerek2 + 1].type, "line");
    assert.equal(blocks.filter((b) => b.type === "perekHeading").length, 2);
  });

  test("verseLineBreaks true, chapterLineBreaks/chapterHeadings both false: no heading blocks at all", () => {
    const toggles = {
      nikkud: true,
      taamim: true,
      punctuation: true,
      verseLineBreaks: true,
      chapterLineBreaks: false,
      showNumbers: true,
      chapterHeadings: false,
    };
    const blocks = layoutSegments(tanakhFixture, toggles);
    assert.equal(blocks.filter((b) => b.type === "perekHeading").length, 0);
  });
});

describe("layoutSegments — chapter-heading insertion with verseLineBreaks false", () => {
  test("flow layout: heading before the very first block, and again at the chapter boundary (with a block split)", () => {
    const toggles = {
      nikkud: true,
      taamim: true,
      punctuation: true,
      verseLineBreaks: false,
      chapterLineBreaks: false,
      showNumbers: false,
      chapterHeadings: true,
    };
    const blocks = layoutSegments(tanakhFixture, toggles);
    // heading(1), flow(v1,v2), heading(2), flow(v3)
    assert.equal(blocks.length, 4);
    assert.equal(blocks[0].type, "perekHeading");
    assert.equal(blocks[0].perek, 1);
    assert.equal(blocks[1].type, "flow");
    assert.equal(blocks[2].type, "perekHeading");
    assert.equal(blocks[2].perek, 2);
    assert.equal(blocks[3].type, "flow");
  });

  test("chapterLineBreaks true, chapterHeadings false: block split at chapter boundary, no heading blocks", () => {
    const toggles = {
      nikkud: true,
      taamim: true,
      punctuation: true,
      verseLineBreaks: false,
      chapterLineBreaks: true,
      showNumbers: true,
      chapterHeadings: false,
    };
    const blocks = layoutSegments(tanakhFixture, toggles);
    assert.equal(blocks.filter((b) => b.type === "perekHeading").length, 0);
    assert.equal(blocks.filter((b) => b.type === "flow").length, 2);
  });
});

describe("layoutSegments — gap-vs-letter marker style", () => {
  const baseToggles = {
    nikkud: true,
    taamim: true,
    punctuation: true,
    verseLineBreaks: false,
    chapterLineBreaks: false,
    chapterHeadings: false,
  };

  test("petuchah splits the flow block only in gap-style (showNumbers off)", () => {
    const gapBlocks = layoutSegments(tanakhFixture, { ...baseToggles, showNumbers: false });
    assert.equal(gapBlocks.length, 2, "gap-style petuchah forces a block split");
    assert.ok(
      gapBlocks.every((b) => b.segments.every((s) => !s.isMarker)),
      "gap-style should not surface an inline marker segment"
    );

    const letterBlocks = layoutSegments(tanakhFixture, { ...baseToggles, showNumbers: true });
    assert.equal(letterBlocks.length, 1, "letter-style petuchah does not split the block");
    assert.ok(letterBlocks[0].segments.some((s) => s.isMarker && s.he === "פ"));
  });

  test("markers wrapped in live-API markup are detected and stripped", () => {
    // The live API returns e.g. `<span class="mam-spi-pe">{פ}</span><br>`.
    const wrapped = {
      ...tanakhFixture,
      heSegments: tanakhFixture.heSegments.map((s) =>
        s.replace(/\{פ\}/, '<span class="mam-spi-pe">{פ}</span><br>')
      ),
    };
    const blocks = layoutSegments(wrapped, { ...baseToggles, showNumbers: false });
    assert.equal(blocks.length, 2, "wrapped petuchah still forces a block split");
    const allHe = blocks.flatMap((b) => b.segments.map((s) => s.he)).join(" ");
    assert.ok(!/[\{\(][פס][\}\)]/.test(allHe), "marker token should be stripped");
    assert.ok(!/<\/?span/i.test(allHe), "marker wrapper markup should be stripped");
  });

  test("setumah: gap-style inserts an invisible isGap segment; letter-style inserts an inline isMarker segment", () => {
    const gapBlocks = layoutSegments(setumahFixture, { ...baseToggles, showNumbers: false });
    assert.equal(gapBlocks.length, 1, "setumah in gap-style does not split the block (unlike petuchah)");
    const gapSegs = gapBlocks[0].segments;
    assert.ok(gapSegs.some((s) => s.isGap && s.he === ""), "expected an invisible gap segment");
    assert.ok(gapSegs.every((s) => !s.isMarker));

    const letterBlocks = layoutSegments(setumahFixture, { ...baseToggles, showNumbers: true });
    assert.equal(letterBlocks.length, 1);
    const letterSegs = letterBlocks[0].segments;
    assert.ok(letterSegs.some((s) => s.isMarker && s.he === "ס"), "expected an inline ס marker segment");
    assert.ok(letterSegs.every((s) => !s.isGap));
  });

  test("verseLineBreaks true: setumah gap-style inserts a separate gap line block; letter-style inserts a marker line block", () => {
    const gapBlocks = layoutSegments(setumahFixture, { ...baseToggles, verseLineBreaks: true, showNumbers: false });
    // v1, v2, gap-line, v3
    assert.equal(gapBlocks.length, 4);
    assert.ok(gapBlocks[2].segments[0].isGap);

    const letterBlocks = layoutSegments(setumahFixture, { ...baseToggles, verseLineBreaks: true, showNumbers: true });
    // v1, v2, marker-line, v3
    assert.equal(letterBlocks.length, 4);
    assert.ok(letterBlocks[2].segments[0].isMarker);
    assert.equal(letterBlocks[2].segments[0].he, "ס");
  });
});

describe("layoutSegments — numStyle combinations", () => {
  const combos = [
    { showNumbers: false, chapterHeadings: false, expected: "none" },
    { showNumbers: false, chapterHeadings: true, expected: "none" },
    { showNumbers: true, chapterHeadings: false, expected: "small-faint" },
    { showNumbers: true, chapterHeadings: true, expected: "regular" },
  ];

  for (const { showNumbers, chapterHeadings, expected } of combos) {
    test(`showNumbers=${showNumbers}, chapterHeadings=${chapterHeadings} -> numStyle "${expected}"`, () => {
      const toggles = {
        nikkud: true,
        taamim: true,
        punctuation: true,
        verseLineBreaks: true,
        chapterLineBreaks: false,
        showNumbers,
        chapterHeadings,
      };
      const blocks = layoutSegments(tanakhFixture, toggles);
      const lineBlocks = blocks.filter((b) => b.type === "line" && !b.segments[0].isMarker && !b.segments[0].isGap);
      assert.ok(lineBlocks.length > 0);
      for (const block of lineBlocks) {
        assert.equal(block.segments[0].numStyle, expected);
      }
    });
  }
});

describe("layoutSegments — isTanakh invariance", () => {
  test("same toggles produce structurally identical output for Tanakh and non-Tanakh sources", () => {
    const toggles = {
      nikkud: true,
      taamim: true,
      punctuation: true,
      verseLineBreaks: true,
      chapterLineBreaks: false,
      showNumbers: true,
      chapterHeadings: true,
    };
    const tanakhBlocks = layoutSegments(invarianceTanakh, toggles);
    const otherBlocks = layoutSegments(invarianceOther, toggles);
    assert.deepEqual(tanakhBlocks, otherBlocks);
  });

  test("same toggles produce structurally identical output in flow (non-verseLineBreaks) layout too", () => {
    const toggles = {
      nikkud: false,
      taamim: false,
      punctuation: false,
      verseLineBreaks: false,
      chapterLineBreaks: true,
      showNumbers: false,
      chapterHeadings: false,
    };
    const tanakhBlocks = layoutSegments(invarianceTanakh, toggles);
    const otherBlocks = layoutSegments(invarianceOther, toggles);
    assert.deepEqual(tanakhBlocks, otherBlocks);
  });
});

describe("layoutSegments — edited overlay", () => {
  test("uses heEdited/enEdited over heSegments/enSegments when present", () => {
    const edited = {
      ...commentaryFixture,
      heEdited: ["ערוך ראשון", "ערוך שני"],
      enEdited: ["Edited first", "Edited second"],
    };
    const blocks = layoutSegments(edited, OTHER_PRESETS.sefer);
    assert.equal(blocks[0].segments[0].he, "ערוך ראשון");
    assert.equal(blocks[0].segments[0].en, "Edited first");
  });
});
