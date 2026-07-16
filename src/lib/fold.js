// Phonetic-skeleton folding for Latin-script Sefaria titles.
//
// Sefaria's title index (`GET /api/index/titles`) is a flat list of every
// string its ref parser recognizes: canonical titles, Ashkenazi/Sephardi
// spelling variants ("Bereishis"/"Bereshit"), abbreviations ("Gen."),
// diacritic variants ("Soṭah"), and foreign-language titles ("Genèse"). This
// module collapses any such string down to a coarse phonetic key ("skeleton")
// so that two spellings of the same underlying name land on the same key,
// letting the app match user input to a real title offline instead of
// fanning out guesses to the API (see docs/SEARCH.md and SPEC.md §2-L1/L2).
//
// THIS FILE IS THE SINGLE SOURCE OF TRUTH for the fold algorithm.
// scripts/build-lexicon.mjs imports it directly to build public/lexicon.json,
// and the runtime search path imports it to fold user queries — so build-time
// keys and query-time keys can never drift apart.
//
// Rule order below is pinned exactly (this is NOT just a convenient
// implementation order — reordering these passes changes results):
//   1. Lowercase; Unicode-NFD-decompose; strip combining marks (diacritics).
//   2. Remove apostrophes/hyphens/periods; collapse whitespace.
//   3. Whole-token roman-numeral <-> arabic-numeral normalization (must run
//      before vowel deletion below, or "ii"/"iii" would delete to nothing).
//   4. Ordered consonant-class folding passes, digraphs before singles.
//   5. Delete vowels.
//   6. Strip anything left outside the final key alphabet.

// Combining Diacritical Marks block (U+0300-U+036F): everything NFD peels
// off of a precomposed accented letter (ṭ -> t + combining dot below, ç -> c
// + combining cedilla, è -> e + combining grave, etc).
const COMBINING_MARKS = /[\u0300-\u036f]/g;

// Straight apostrophe, right single quote, left single quote, hyphen,
// period — deleted outright (not replaced with a space), per spec step 2.
// Hyphen is placed last in the class so it reads as a literal char, not a
// range.
const APOSTROPHES_HYPHENS_PERIODS = /['‘’.-]/g;

const WHITESPACE_RUN = /\s+/g;

// Roman-numeral tokens fold to the arabic form (bidirectionally: whichever
// form a title uses, the key ends up arabic), so "II Kings", "2 Kings", and
// "Kings 2" can agree on a key where the title list actually pairs them —
// note this only helps when the numeral sits in the same token position;
// per spec we never reorder tokens to force a match.
const NUMERAL_TOKEN_TO_ARABIC = { i: "1", ii: "2", iii: "3" };

function normalizeNumeralTokens(s) {
  if (!s) return s;
  return s
    .split(" ")
    .map((token) => NUMERAL_TOKEN_TO_ARABIC[token] || token)
    .join(" ");
}

/**
 * Fold a Latin-script title string down to its phonetic-skeleton key.
 * Only meaningful for Latin-script input — Hebrew-codepoint titles keep
 * the app's existing Hebrew search path (see hebrewSearch.js) and should
 * never be passed through here.
 */
export function fold(title) {
  if (!title) return "";

  // 1. Lowercase, NFD-decompose, strip combining marks.
  let s = title.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "");

  // 2. Remove apostrophes/hyphens/periods; collapse whitespace to single
  //    spaces and trim.
  s = s.replace(APOSTROPHES_HYPHENS_PERIODS, "");
  s = s.replace(WHITESPACE_RUN, " ").trim();

  // 3. Numeral normalization on whole tokens, done here (before consonant/
  //    vowel folding) even though it's spec step 4 — it has to run before
  //    vowel deletion or a bare "ii"/"iii" token would disappear entirely.
  s = normalizeNumeralTokens(s);

  // 4. Consonant-class folding, ordered passes, digraphs before singles.

  // a. Shin stays its own class ($) — done first so later passes can't eat
  //    its h or s (e.g. "Shabbat" must not lose its sh to the standalone-h
  //    or sav/tav rules below).
  s = s.replace(/sh/g, "$");

  // b. Tzadi (tz/ts) and z collapse to one class.
  s = s.replace(/tz|ts|z/g, "z");

  // c. Kaf/kuf/qof-family digraphs, plus c before a/o/u, collapse to k.
  //    (Plain c before e/i, or word-final c, is left as a literal "c" —
  //    the spec only calls out the a/o/u case.)
  s = s.replace(/ch|kh|ck|q|k/g, "k");
  s = s.replace(/c(?=[aou])/g, "k");

  // d. Fey/vet/vav/bet family collapses to b.
  s = s.replace(/ph|f|v|w|b/g, "b");

  // e. Standalone-h rule: passes (a)-(d) already consumed every h that was
  //    part of a recognized digraph (sh, ch, kh, ph); delete whatever h is
  //    left over — these are pure matres/vowel-carriers with no consonant
  //    value of their own ("Ohr"/"Or" -> r, "Sotah"/"Sota" -> tt,
  //    "HaChaim"/"Hachayim" -> km).
  s = s.replace(/h/g, "");

  //    Then fold the Ashkenazi sav <-> tav distinction: "Shabbos"/"Shabbat"
  //    both -> ...t. (Note: because every h was just deleted above, the
  //    "th" alternative below can never actually fire — it's kept only
  //    because the spec pins this as a literal, explicit step.)
  s = s.replace(/th|t|s/g, "t");

  // f. Delete vowels only. y/j/g/d/l/m/n/p/r (and any other surviving
  //    Latin letter, e.g. an un-folded "c" or "x") pass through untouched
  //    — nothing to do for them here, since they're simply not in the
  //    vowel set below. (Prototype kept y: "Yeshayohu" -> "y$yh" matches
  //    "Yishayahu".)
  s = s.replace(/[aeiou]/g, "");

  // g. Strip anything left outside the final key alphabet: folded
  //    consonant classes, digits, space, and comma. Comma is kept — the
  //    build script's pruning rule compares folded pre-comma prefixes, and
  //    the same fold() must produce that comma-bearing key.
  s = s.replace(/[^a-z$0-9 ,]/g, "");

  return s;
}
