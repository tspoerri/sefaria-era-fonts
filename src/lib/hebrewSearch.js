// Vowel points (nikud) and cantillation marks live in this combining-mark
// block. Sefaria's ref parser and name-lookup both fail on vocalized text
// (a pasted "בְּרֵאשִׁית" 404s where "בראשית" resolves fine), so this must be
// stripped before anything is sent to either endpoint.
const NIKUD_RANGE = /[֑-ׇ]/g;
const HAS_NIKUD = /[֑-ׇ]/;

export function stripNikud(text) {
  return text.replace(NIKUD_RANGE, "");
}

// A title pasted in with nikud/cantillation was almost certainly copied from
// a real, correctly-spelled text rather than hand-typed, so it's unlikely to
// contain a letter-confusion typo — callers use this to skip the fuzzy
// variant fallback in that case.
export function hasNikud(text) {
  return HAS_NIKUD.test(text);
}

export function isHebrewText(text) {
  return /[א-ת]/.test(text);
}

// Hebrew letters that are commonly confused with each other regardless of
// where they fall in a word: sound-alikes (once nikud/dagesh is stripped,
// the letters that distinguish "hard" from "soft" pronunciation are gone),
// look-alikes, and glyphs that share (or neighbor) a physical key on the
// standard Hebrew keyboard.
const ANY_POSITION_PAIRS = [
  ["ק", "כ"], // kuf/kaf, sound-alike
  ["ת", "ט"], // taf/tes, sound-alike
  ["א", "ע"], // alef/ayin, both silent/glottal
  ["ח", "ו"], // ches / vav-yud key, same key
  ["ח", "י"], // ches / vav-yud key, same key
  ["ף", ":"], // final pey / colon, same key
  ["ף", ";"], // final pey / semicolon, same key
  [".", "/"], // period / slash, same key
  ["ץ", "."], // final tzadi / period, same key
  ["ת", ","], // taf / comma, same key
];

// These sound-alikes only actually get confused mid-word or at the end of a
// word — Hebrew speakers don't misspell the *first* letter of a word this
// way, so applying the swap there would generate variants no one would
// actually type.
const NOT_AT_WORD_START_PAIRS = [
  ["ת", "ש"], // taf/shin
  ["ת", "ס"], // taf/samech
  ["ב", "ו"], // beis/vav
];

// Kaf/ches is confused only strictly mid-word — unlike the pairs above,
// Hebrew speakers also never make this swap at the *end* of a word either.
const MID_WORD_ONLY_PAIRS = [["כ", "ח"]];

// A weaker, position-specific confusion: alef and hei look and sound
// distinct mid-word, but at the end of a word (where hei often marks a
// silent feminine ending) they're occasionally mixed up. Applied only to
// the last character of a title, not letters generally.
const END_OF_WORD_CONFUSABLE_PAIRS = [
["א", "ה"],
 ["ק", "ך"], // kuf / final kaf, look-alike
 ["ך", "ח"], // final kaf / ches, look-alike
];

// Adjacent-key pairs on the standard Israeli (QWERTY-mapped) keyboard, read
// off each physical row left to right — a generic fallback alongside the
// specific same-key pairs above, for typos where the finger just lands one
// key off.
const KEYBOARD_ROWS = ["/'קראטוןםפ", "שדגכעיחלך", "זסבהנמצתץ"];

function buildConfusableMap(pairs) {
  const map = new Map();
  const add = (a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  for (const [a, b] of pairs) {
    add(a, b);
    add(b, a);
  }
  return map;
}

function keyboardRowPairs() {
  const pairs = [];
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i < row.length - 1; i++) {
      pairs.push([row[i], row[i + 1]]);
    }
  }
  return pairs;
}

const ANY_POSITION_CONFUSABLE = buildConfusableMap([...ANY_POSITION_PAIRS, ...keyboardRowPairs()]);
const NOT_AT_WORD_START_CONFUSABLE = buildConfusableMap(NOT_AT_WORD_START_PAIRS);
const MID_WORD_ONLY_CONFUSABLE = buildConfusableMap(MID_WORD_ONLY_PAIRS);
const END_OF_WORD_CONFUSABLE_LETTERS = buildConfusableMap(END_OF_WORD_CONFUSABLE_PAIRS);

// Which alternatives apply to the letter at `index` depends on its position
// in the word — see the position-restricted pair lists above.
function confusablesAt(ch, index, length) {
  const isStart = index === 0;
  const isEnd = index === length - 1;
  const result = new Set(ANY_POSITION_CONFUSABLE.get(ch) || []);
  if (!isStart) {
    for (const alt of NOT_AT_WORD_START_CONFUSABLE.get(ch) || []) result.add(alt);
  }
  if (!isStart && !isEnd) {
    for (const alt of MID_WORD_ONLY_CONFUSABLE.get(ch) || []) result.add(alt);
  }
  return result;
}

// Vav and yud are the two letters most often dropped, inserted, or doubled
// mid-word (malei vs. chaser spelling variants are endemic in Hebrew), so
// they get dedicated insertion/deletion/doubling variants in addition to the
// single-letter confusable swaps below. Only mid-word positions are touched
// (not the first or last letter) per how these errors actually occur.
function generateVavYudVariants(title, budget) {
  const variants = new Set();
  for (let i = 1; i < title.length - 1 && variants.size < budget; i++) {
    const ch = title[i];
    if (ch === "ו" || ch === "י") {
      // Omitted: drop this letter.
      variants.add(title.slice(0, i) + title.slice(i + 1));
      // Doubled/undoubled: toggle a repeat of the same letter.
      if (title[i + 1] === ch) {
        variants.add(title.slice(0, i) + title.slice(i + 1));
      } else {
        variants.add(title.slice(0, i + 1) + ch + title.slice(i + 1));
      }
    }
  }
  for (let i = 1; i < title.length && variants.size < budget; i++) {
    // Inserted: a vav/yud that shouldn't be there, at each mid-word gap.
    variants.add(title.slice(0, i) + "ו" + title.slice(i));
    if (variants.size >= budget) break;
    variants.add(title.slice(0, i) + "י" + title.slice(i));
  }
  variants.delete(title);
  return variants;
}

// Alef and ayin are both silent (or near-silent) in most pronunciations, so
// — unlike the deliberate vav/yud insertion/doubling above — they
// occasionally just get dropped entirely from the middle of a word. This is
// rarer than vav/yud omission, so it's a plain deletion, not a full
// insert/double generator.
function generateAlefAyinOmissionVariants(title, budget) {
  const variants = new Set();
  for (let i = 1; i < title.length - 1 && variants.size < budget; i++) {
    const ch = title[i];
    if (ch === "א" || ch === "ע") {
      variants.add(title.slice(0, i) + title.slice(i + 1));
    }
  }
  variants.delete(title);
  return variants;
}

// Generate alternate spellings of a Hebrew title by swapping one letter at a
// time for a commonly-confused alternative, plus vav/yud and alef/ayin
// omission/insertion/doubling variants. Confusable swaps are
// position-aware (see confusablesAt) since several pairs are only ever
// confused mid-word or never at the start of a word. Capped so a long title
// doesn't fan out into dozens of API calls — this is a fallback for when
// the direct query already came up short, not the primary path.
export function generateHebrewVariants(title, maxVariants = 6) {
  const variants = new Set();
  for (let i = 0; i < title.length && variants.size < maxVariants; i++) {
    const alternatives = confusablesAt(title[i], i, title.length);
    for (const alt of alternatives) {
      if (variants.size >= maxVariants) break;
      variants.add(title.slice(0, i) + alt + title.slice(i + 1));
    }
  }
  if (title.length > 0 && variants.size < maxVariants) {
    const lastIndex = title.length - 1;
    const endAlternatives = END_OF_WORD_CONFUSABLE_LETTERS.get(title[lastIndex]);
    if (endAlternatives) {
      for (const alt of endAlternatives) {
        if (variants.size >= maxVariants) break;
        variants.add(title.slice(0, lastIndex) + alt);
      }
    }
  }
  for (const v of generateVavYudVariants(title, maxVariants)) {
    if (variants.size >= maxVariants) break;
    variants.add(v);
  }
  for (const v of generateAlefAyinOmissionVariants(title, maxVariants)) {
    if (variants.size >= maxVariants) break;
    variants.add(v);
  }
  variants.delete(title);
  return [...variants];
}

// Gematria (Hebrew letters used as numerals, e.g. an address like "כ״א" for
// 21) is a different kind of text from a book title: the letters aren't
// spelling a word, so none of the homophone/look-alike/malei-chaseir
// machinery above applies to it — callers should never run
// generateHebrewVariants over a gematria address. What *can* go wrong is
// the letter order: gematria is conventionally written from the largest
// place value down to the smallest (e.g. 21 is "כא", kaf-20 then alef-1,
// never "אכ"). These helpers detect and correct that specific typo without
// changing the numeral's value.
const GEMATRIA_VALUES = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
  // Final forms carry the same value as their base letter here — the rare
  // "sofit gematria" convention (500-900) isn't relevant to sheet addresses.
  ך: 20, ם: 40, ן: 50, ף: 80, ץ: 90,
};

function gematriaLetterValues(token) {
  return [...token].filter((ch) => GEMATRIA_VALUES[ch] !== undefined).map((ch) => GEMATRIA_VALUES[ch]);
}

// Converts a gematria numeral token (Hebrew letters used as numerals, e.g.
// "יב" = 10+2 = 12) to its numeric value. Gematria value is a straight sum
// of each letter's place value regardless of order — unlike
// `fixGematriaOrder` above (which only *reorders* letters and never
// computes a number), this actually resolves the numeral, which is what a
// Gemara daf address ("יב." -> daf 12) needs. Geresh/gershayim marks and any
// non-numeral character are ignored. Returns 0 for a token with no
// recognized numeral letters at all (callers should treat that as "not a
// valid daf address").
export function gematriaToNumber(token) {
  return gematriaLetterValues(token || "").reduce((sum, v) => sum + v, 0);
}

export function isValidGematriaOrder(token) {
  const values = gematriaLetterValues(token);
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) return false;
  }
  return true;
}

// Reorders the numeral letters in a gematria token to descending place
// value (e.g. "בק" -> "קב"), leaving anything that isn't a plain
// out-of-order numeral (too short, already valid, or not gematria at all)
// untouched. Any geresh/gershayim in the token is preserved in its
// conventional position (after a single letter, or before the last letter
// of a multi-letter number).
export function fixGematriaOrder(token) {
  if (isValidGematriaOrder(token)) return token;
  const letters = [...token].filter((ch) => GEMATRIA_VALUES[ch] !== undefined);
  if (letters.length < 2) return token;
  const sorted = [...letters].sort((a, b) => GEMATRIA_VALUES[b] - GEMATRIA_VALUES[a]);
  const hasGershayim = /[״]/.test(token);
  const hasGeresh = !hasGershayim && /[׳]/.test(token);
  const last = sorted[sorted.length - 1];
  const rest = sorted.slice(0, -1).join("");
  return rest + (hasGershayim ? "״" : "") + last + (hasGeresh ? "׳" : "");
}
