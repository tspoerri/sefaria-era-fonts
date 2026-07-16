// Tests for SPEC.md Wave D1 — structural marker parsing in
// src/lib/inputNormalize.js (`rewriteSearchMarkers`, exercised both directly
// and through the full `normalizeSourceInput` pipeline it's wired into) and
// the 54-parsha table in src/lib/parshiyot.js. All pure/offline: no network,
// no lexicon fixture needed.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { normalizeSourceInput, rewriteSearchMarkers } from "../src/lib/inputNormalize.js";
import { parshiyot } from "../src/lib/parshiyot.js";

describe("parshiyot table", () => {
  test("has exactly 54 entries", () => {
    assert.equal(parshiyot.length, 54);
  });

  test("every entry has a name, book, and range", () => {
    for (const p of parshiyot) {
      assert.equal(typeof p.name, "string");
      assert.ok(p.name.length > 0);
      assert.equal(typeof p.book, "string");
      assert.match(p.range, /^\d+:\d+-\d+:\d+$|^\d+:\d+-\d+$/);
    }
  });

  test("first and last entries are Bereshit and V'Zot HaBerachah", () => {
    assert.equal(parshiyot[0].name, "Bereshit");
    assert.deepEqual(
      { book: parshiyot[0].book, range: parshiyot[0].range },
      { book: "Genesis", range: "1:1-6:8" }
    );
    const last = parshiyot[parshiyot.length - 1];
    assert.equal(last.name, "V'Zot HaBerachah");
    assert.deepEqual({ book: last.book, range: last.range }, { book: "Deuteronomy", range: "33:1-34:12" });
  });

  test("Noach spans the standard Genesis 6:9-11:32 range", () => {
    const noach = parshiyot.find((p) => p.name === "Noach");
    assert.deepEqual({ book: noach.book, range: noach.range }, { book: "Genesis", range: "6:9-11:32" });
  });
});

describe("daf/amud rewriting", () => {
  test("'daf N amud a' -> 'Na'", () => {
    assert.equal(rewriteSearchMarkers("Brachos daf 2 amud a"), "Brachos 2a");
  });

  test("'daf N amud b' -> 'Nb'", () => {
    assert.equal(rewriteSearchMarkers("Brachos daf 2 amud b"), "Brachos 2b");
  });

  test("'daf N amud aleph/bet' spelled-out variants resolve to a/b", () => {
    assert.equal(rewriteSearchMarkers("Brachos daf 2 amud aleph"), "Brachos 2a");
    assert.equal(rewriteSearchMarkers("Brachos daf 2 amud bet"), "Brachos 2b");
  });

  test("bare 'daf N' (no amud) -> 'N'", () => {
    assert.equal(rewriteSearchMarkers("Brachos daf 2"), "Brachos 2");
  });

  test("bare 'N amud b' (no 'daf' keyword) -> 'Nb'", () => {
    assert.equal(rewriteSearchMarkers("Brachos 2 amud b"), "Brachos 2b");
  });

  test("'Daf Yomi' (no number) is NOT rewritten", () => {
    assert.equal(rewriteSearchMarkers("Daf Yomi"), "Daf Yomi");
  });

  test("plain 'daf' with no trailing number anywhere in the string is left alone", () => {
    assert.equal(rewriteSearchMarkers("What is a daf anyway"), "What is a daf anyway");
  });
});

describe("perek/passuk rewriting", () => {
  test("'perek N passuk M' -> 'N:M'", () => {
    assert.equal(rewriteSearchMarkers("Bereshit perek 1 passuk 1"), "Bereshit 1:1");
  });

  test("accepts 'pasuk' and 'posuk' spelling variants", () => {
    assert.equal(rewriteSearchMarkers("Bereshit perek 1 pasuk 3"), "Bereshit 1:3");
    assert.equal(rewriteSearchMarkers("Bereshit perek 1 posuk 3"), "Bereshit 1:3");
  });

  test("bare 'perek N' (no passuk) -> 'N'", () => {
    assert.equal(rewriteSearchMarkers("Bereshit perek 3"), "Bereshit 3");
  });

  test("'perek' with no number is left alone", () => {
    assert.equal(rewriteSearchMarkers("Ein Yaakov perek Chelek"), "Ein Yaakov perek Chelek");
  });
});

describe("siman/seif rewriting", () => {
  test("'siman N seif M' -> 'N:M'", () => {
    assert.equal(rewriteSearchMarkers("Orach Chaim siman 2 seif 5"), "Orach Chaim 2:5");
  });

  test("accepts se'if and sif spelling variants", () => {
    assert.equal(rewriteSearchMarkers("Orach Chaim siman 2 se'if 5"), "Orach Chaim 2:5");
    assert.equal(rewriteSearchMarkers("Orach Chaim siman 2 sif 5"), "Orach Chaim 2:5");
  });

  test("bare 'siman N' (no seif) -> 'N'", () => {
    assert.equal(rewriteSearchMarkers("Orach Chaim siman 5"), "Orach Chaim 5");
  });
});

describe("parsha rewriting", () => {
  test("'parshas Noach' -> 'Genesis 6:9-11:32'", () => {
    assert.equal(rewriteSearchMarkers("parshas Noach"), "Genesis 6:9-11:32");
  });

  test("'parshat Vayeitzei' (folk spelling) resolves via fold() to Vayetzei's range", () => {
    assert.equal(rewriteSearchMarkers("parshat Vayeitzei"), "Genesis 28:10-32:3");
  });

  test("'parashat' marker form works", () => {
    assert.equal(rewriteSearchMarkers("parashat Bo"), "Exodus 10:1-13:16");
  });

  test("two-word parsha names ('Ki Tisa') resolve correctly", () => {
    assert.equal(rewriteSearchMarkers("parshas Ki Tisa"), "Exodus 30:11-34:35");
  });

  test("a fold()-key collision (Vaera/Behar both fold to 'br') resolves to the right one, not the first alphabetically/positionally", () => {
    assert.equal(rewriteSearchMarkers("parshas Vaera"), "Exodus 6:2-9:35");
    assert.equal(rewriteSearchMarkers("parshat Behar"), "Leviticus 25:1-26:2");
  });

  test("bare parsha name without a marker word is OUT of scope -- left untouched", () => {
    assert.equal(rewriteSearchMarkers("Noach"), "Noach");
  });

  test("an unrecognized name after the marker is left untouched", () => {
    assert.equal(rewriteSearchMarkers("parshas Zzzznotreal"), "parshas Zzzznotreal");
  });
});

describe("Hebrew-script markers (documented as handled where cheap)", () => {
  test("דף N עמוד א -> Na", () => {
    assert.equal(rewriteSearchMarkers("דף 2 עמוד א"), "2a");
  });

  test("פרק N פסוק M -> N:M", () => {
    assert.equal(rewriteSearchMarkers("פרק 1 פסוק 1"), "1:1");
  });

  test("סימן N סעיף M -> N:M", () => {
    assert.equal(rewriteSearchMarkers("סימן 2 סעיף 5"), "2:5");
  });
});

describe("negative cases -- ordinary titles must survive untouched", () => {
  test("'Guide to the Perplexed' is untouched (no marker words at all)", () => {
    assert.equal(rewriteSearchMarkers("Guide to the Perplexed"), "Guide to the Perplexed");
  });

  test("a plain title with no markers passes through rewriteSearchMarkers unchanged", () => {
    assert.equal(rewriteSearchMarkers("Mishneh Torah"), "Mishneh Torah");
  });

  test("empty string is a no-op", () => {
    assert.equal(rewriteSearchMarkers(""), "");
  });
});

describe("wired into normalizeSourceInput (runs before offline matching/API fallback)", () => {
  test("'Brachos daf 2 amud a' normalizes end-to-end to 'Brachos 2a'", () => {
    assert.equal(normalizeSourceInput("Brachos daf 2 amud a"), "Brachos 2a");
  });

  test("'parshas Noach' normalizes end-to-end to the resolved book+range", () => {
    assert.equal(normalizeSourceInput("parshas Noach"), "Genesis 6:9-11:32");
  });

  test("'Daf Yomi' still passes through normalizeSourceInput untouched", () => {
    assert.equal(normalizeSourceInput("Daf Yomi"), "Daf Yomi");
  });
});
