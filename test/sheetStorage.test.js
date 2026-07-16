// Tests for src/lib/sheetStorage.js: flattening Sefaria's he/text shapes
// into segments + refs, building a new-shape source from a fetchText/
// fetchIndex response pair, and migrating an old flattened-string sheet to
// the new shape. localStorage is stubbed with an in-memory shim (no DOM in
// node:test).

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

function makeLocalStorageStub() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

globalThis.localStorage = makeLocalStorageStub();

const {
  STORAGE_KEY,
  V2_STORAGE_KEY,
  OLD_STORAGE_KEY,
  flattenSefariaText,
  buildSegmentRefs,
  alignSegments,
  isEmptyEnglish,
  formatCompDateDisplay,
  buildSourceFromResponse,
  migrateLegacySheet: migrateLegacySheetDirect,
  migrateV2ToV3,
  loadSheet,
  saveSheet,
} = await import("../src/lib/sheetStorage.js");

describe("flattenSefariaText", () => {
  test("string -> single-element array", () => {
    assert.deepEqual(flattenSefariaText("hello"), ["hello"]);
  });

  test("flat string[] -> unchanged", () => {
    assert.deepEqual(flattenSefariaText(["a", "b"]), ["a", "b"]);
  });

  test("nested string[][] (chapter-spanning range) -> flattened in order", () => {
    assert.deepEqual(
      flattenSefariaText([
        ["a1", "a2"],
        ["b1"],
      ]),
      ["a1", "a2", "b1"]
    );
  });

  test("null/undefined -> empty array", () => {
    assert.deepEqual(flattenSefariaText(null), []);
    assert.deepEqual(flattenSefariaText(undefined), []);
  });
});

describe("buildSegmentRefs", () => {
  test("single string segment gets one {perek, passuk} from sections", () => {
    assert.deepEqual(buildSegmentRefs("text", [1, 1]), [{ perek: 1, passuk: 1 }]);
  });

  test("flat string[] within one perek numbers passuk sequentially from sections[1]", () => {
    const refs = buildSegmentRefs(["v1", "v2", "v3"], [3, 5]);
    assert.deepEqual(refs, [
      { perek: 3, passuk: 5 },
      { perek: 3, passuk: 6 },
      { perek: 3, passuk: 7 },
    ]);
  });

  test("string[][] chapter-spanning range: perek increments, passuk restarts at 1 after the first perek", () => {
    const heValue = [
      ["v1", "v2"], // perek 1, starting at passuk 5 (sections = [1,5])
      ["v1", "v2", "v3"], // perek 2, restarts at passuk 1
    ];
    const refs = buildSegmentRefs(heValue, [1, 5]);
    assert.deepEqual(refs, [
      { perek: 1, passuk: 5 },
      { perek: 1, passuk: 6 },
      { perek: 2, passuk: 1 },
      { perek: 2, passuk: 2 },
      { perek: 2, passuk: 3 },
    ]);
  });

  test("non-chaptered flat text uses {segment} numbering from sections[0]", () => {
    const refs = buildSegmentRefs(["a", "b"], [2]);
    assert.deepEqual(refs, [{ segment: 2 }, { segment: 3 }]);
  });
});

describe("alignSegments", () => {
  test("pads a shorter English array with empty strings", () => {
    const aligned = alignSegments(["h1", "h2", "h3"], ["e1"]);
    assert.deepEqual(aligned, ["e1", "", ""]);
  });

  test("truncates a longer English array", () => {
    const aligned = alignSegments(["h1"], ["e1", "e2"]);
    assert.deepEqual(aligned, ["e1"]);
  });

  test("handles a plain string English value", () => {
    assert.deepEqual(alignSegments(["h1"], "e1"), ["e1"]);
  });
});

describe("isEmptyEnglish", () => {
  test("true for null, empty string, empty array, or all-whitespace segments", () => {
    assert.equal(isEmptyEnglish(null), true);
    assert.equal(isEmptyEnglish(""), true);
    assert.equal(isEmptyEnglish([]), true);
    assert.equal(isEmptyEnglish(["", "  "]), true);
  });

  test("false when any segment has real text", () => {
    assert.equal(isEmptyEnglish(["", "hello"]), false);
    assert.equal(isEmptyEnglish("hello"), false);
  });
});

describe("formatCompDateDisplay", () => {
  test("single-year compDate", () => {
    assert.equal(formatCompDateDisplay([1105]), "c. 1105");
  });

  test("range compDate", () => {
    assert.equal(formatCompDateDisplay([1075, 1105]), "c. 1075–1105");
  });

  test("null/empty/missing -> null", () => {
    assert.equal(formatCompDateDisplay(null), null);
    assert.equal(formatCompDateDisplay([]), null);
    assert.equal(formatCompDateDisplay(undefined), null);
  });
});

describe("buildSourceFromResponse", () => {
  test("builds the full new-shape source from a Tanakh response + index", () => {
    const resp = {
      ref: "Genesis 1:1",
      heRef: "בראשית א:א",
      book: "Genesis",
      categories: ["Tanakh", "Torah"],
      primary_category: "Tanakh",
      sectionNames: ["Chapter", "Verse"],
      sections: [1, 1],
      he: "בְּרֵאשִׁית",
      text: "In the beginning",
      versionTitle: "Some English Version",
    };
    const index = {
      authors: [{ en: "Moses", he: "משה" }],
      compDate: [1300],
    };
    const source = buildSourceFromResponse({
      resp,
      index,
      era: "chumash",
      unclassified: false,
    });

    assert.equal(source.ref, "Genesis 1:1");
    assert.equal(source.isTanakh, true);
    assert.deepEqual(source.heSegments, ["בְּרֵאשִׁית"]);
    assert.deepEqual(source.enSegments, ["In the beginning"]);
    assert.deepEqual(source.segmentRefs, [{ perek: 1, passuk: 1 }]);
    assert.equal(source.authorEn, "Moses");
    assert.equal(source.authorHe, "משה");
    assert.equal(source.compDateDisplay, "c. 1300");
    assert.equal(source.era, "chumash");
    assert.equal(source.titleOverride, null);
    assert.equal(source.heEdited, null);
    assert.equal(source.settingsOverride, null);
    assert.ok(source.id);
  });

  test("isTanakh is false for a Tanakh commentary (primary_category Commentary)", () => {
    const resp = {
      ref: "Rashi on Genesis 1:1:1",
      heRef: "רש\"י על בראשית א:א:א",
      categories: ["Tanakh", "Torah", "Rashi"],
      primary_category: "Commentary",
      sections: [1, 1, 1],
      he: "פירוש",
      text: "commentary",
    };
    const source = buildSourceFromResponse({ resp, index: null, era: "rashi", unclassified: false });
    assert.equal(source.isTanakh, false);
  });

  test("handles a missing index (no authors/compDate) gracefully", () => {
    const resp = {
      ref: "Some Ref",
      heRef: "הפניה",
      categories: ["Other"],
      sections: [1],
      he: "טקסט",
      text: "text",
    };
    const source = buildSourceFromResponse({ resp, index: null, era: "contemporary", unclassified: true });
    assert.equal(source.authorEn, null);
    assert.equal(source.authorHe, null);
    assert.equal(source.compDateDisplay, null);
  });
});

describe("migration: old flattened-string sheet -> new segment-preserving shape", () => {
  test("migrateLegacySheet converts sources, treating flattened he/text as a single segment", () => {
    const oldSheet = {
      title: "My Sheet",
      sources: [
        {
          id: "abc123",
          ref: "Genesis 1:1",
          heRef: "בראשית א:א",
          he: "בְּרֵאשִׁית",
          text: "In the beginning",
          era: "chumash",
          unclassified: false,
        },
      ],
    };
    const migrated = migrateLegacySheetDirect(oldSheet);
    assert.equal(migrated.title, "My Sheet");
    assert.equal(migrated.sources.length, 1);
    const s = migrated.sources[0];
    assert.equal(s.id, "abc123");
    assert.equal(s.ref, "Genesis 1:1");
    assert.deepEqual(s.heSegments, ["בְּרֵאשִׁית"]);
    assert.deepEqual(s.enSegments, ["In the beginning"]);
    assert.equal(s.isTanakh, false);
    assert.equal(s.era, "chumash");
    assert.equal(s.titleOverride, null);
    assert.equal(s.heEdited, null);
    assert.equal(s.enEdited, null);
  });

  test("migrateLegacySheet flattens array-shaped old he/text by joining with a space (matching the old render-time join)", () => {
    const oldSheet = {
      title: "Range Sheet",
      sources: [
        {
          id: "range1",
          ref: "Genesis 1:1-2",
          heRef: "בראשית א:א-ב",
          he: ["בְּרֵאשִׁית", "וְהָאָרֶץ"],
          text: ["In the beginning", "And the earth"],
          era: "chumash",
          unclassified: false,
        },
      ],
    };
    const migrated = migrateLegacySheetDirect(oldSheet);
    const s = migrated.sources[0];
    assert.deepEqual(s.heSegments, ["בְּרֵאשִׁית וְהָאָרֶץ"]);
    assert.deepEqual(s.enSegments, ["In the beginning And the earth"]);
  });

  test("migrateLegacySheet handles missing/malformed input without throwing", () => {
    assert.deepEqual(migrateLegacySheetDirect(null), { title: "Untitled Sheet", sources: [] });
    assert.deepEqual(migrateLegacySheetDirect({}), { title: "Untitled Sheet", sources: [] });
  });
});

describe("migrateV2ToV3: v2 {title, sources} -> v3 {title, author, blocks}", () => {
  test("wraps every source in a {id, type: 'source', source} block, in order", () => {
    const v2 = {
      title: "My Sheet",
      sources: [
        { id: "s1", ref: "Genesis 1:1" },
        { id: "s2", ref: "Exodus 2:1" },
      ],
    };
    const v3 = migrateV2ToV3(v2);
    assert.equal(v3.title, "My Sheet");
    assert.equal(v3.author, "");
    assert.equal(v3.blocks.length, 2);
    assert.equal(v3.blocks[0].type, "source");
    assert.equal(v3.blocks[0].source.id, "s1");
    assert.equal(v3.blocks[1].source.id, "s2");
    assert.ok(v3.blocks[0].id);
    assert.notEqual(v3.blocks[0].id, v3.blocks[1].id);
  });

  test("handles missing/malformed input without throwing", () => {
    assert.deepEqual(migrateV2ToV3(null), { title: "Untitled Sheet", author: "", blocks: [] });
    assert.deepEqual(migrateV2ToV3({}), { title: "Untitled Sheet", author: "", blocks: [] });
  });

  test("preserves an existing author field", () => {
    const v3 = migrateV2ToV3({ title: "T", author: "Tamar", sources: [] });
    assert.equal(v3.author, "Tamar");
  });
});

describe("loadSheet / saveSheet (localStorage-backed, namespaced v3 key + full migration chain)", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  test("STORAGE_KEY is namespaced (v3), distinct from the v2 and legacy keys", () => {
    assert.equal(STORAGE_KEY, "sefaria-era-fonts-sheet-v3");
    assert.equal(V2_STORAGE_KEY, "sefaria-era-fonts-sheet-v2");
    assert.equal(OLD_STORAGE_KEY, "sefaria-era-fonts-sheet");
    assert.notEqual(STORAGE_KEY, V2_STORAGE_KEY);
    assert.notEqual(V2_STORAGE_KEY, OLD_STORAGE_KEY);
  });

  test("loadSheet returns an empty default sheet when nothing is stored", () => {
    assert.deepEqual(loadSheet(), { title: "Untitled Sheet", author: "", blocks: [] });
  });

  test("saveSheet + loadSheet round-trips the v3 blocks shape", () => {
    const state = {
      title: "Round Trip",
      author: "Tamar",
      blocks: [
        {
          id: "blk-1",
          type: "source",
          source: {
            id: "x1",
            ref: "Genesis 1:1",
            heRef: "בראשית א:א",
            isTanakh: true,
            heSegments: ["a"],
            enSegments: ["b"],
            segmentRefs: [{ perek: 1, passuk: 1 }],
            era: "chumash",
          },
        },
      ],
    };
    saveSheet(state);
    const loaded = loadSheet();
    assert.equal(loaded.title, "Round Trip");
    assert.equal(loaded.author, "Tamar");
    assert.equal(loaded.blocks[0].source.id, "x1");
  });

  test("loadSheet migrates a v2-shape sheet found under V2_STORAGE_KEY when no v3 key exists", () => {
    globalThis.localStorage.setItem(
      V2_STORAGE_KEY,
      JSON.stringify({
        title: "V2 Sheet",
        sources: [{ id: "v2src", ref: "Genesis 1:1", heSegments: ["a"], enSegments: ["b"] }],
      })
    );
    const loaded = loadSheet();
    assert.equal(loaded.title, "V2 Sheet");
    assert.equal(loaded.author, "");
    assert.equal(loaded.blocks.length, 1);
    assert.equal(loaded.blocks[0].type, "source");
    assert.equal(loaded.blocks[0].source.id, "v2src");
  });

  test("loadSheet migrates an old-shape (legacy) sheet through the full legacy->v2->v3 chain when no v3/v2 key exists", () => {
    globalThis.localStorage.setItem(
      OLD_STORAGE_KEY,
      JSON.stringify({
        title: "Legacy Sheet",
        sources: [
          {
            id: "legacy1",
            ref: "Exodus 2:1",
            heRef: "שמות ב:א",
            he: "וַיֵּלֶךְ",
            text: "And he went",
            era: "chumash",
            unclassified: false,
          },
        ],
      })
    );
    const loaded = loadSheet();
    assert.equal(loaded.title, "Legacy Sheet");
    assert.equal(loaded.blocks.length, 1);
    assert.equal(loaded.blocks[0].type, "source");
    assert.deepEqual(loaded.blocks[0].source.heSegments, ["וַיֵּלֶךְ"]);
  });

  test("v3 key takes precedence over stale v2/legacy keys", () => {
    globalThis.localStorage.setItem(
      OLD_STORAGE_KEY,
      JSON.stringify({ title: "Old", sources: [] })
    );
    globalThis.localStorage.setItem(
      V2_STORAGE_KEY,
      JSON.stringify({ title: "Also Old", sources: [] })
    );
    saveSheet({ title: "New", author: "", blocks: [] });
    const loaded = loadSheet();
    assert.equal(loaded.title, "New");
  });

  test("v2 key takes precedence over a stale legacy key", () => {
    globalThis.localStorage.setItem(
      OLD_STORAGE_KEY,
      JSON.stringify({ title: "Old", sources: [] })
    );
    globalThis.localStorage.setItem(
      V2_STORAGE_KEY,
      JSON.stringify({ title: "V2 Wins", sources: [] })
    );
    const loaded = loadSheet();
    assert.equal(loaded.title, "V2 Wins");
  });
});
