// Pure data + mapping functions for the Hebrew keyboard popup (Wave D2).
// No DOM/React here — src/components/HebrewKeyboard.jsx consumes this.
//
// Three concepts:
//   - HEBREW_LETTERS / FINALS: the alphabet, base letters + sofit (final)
//     forms, used to build the "alephbet" on-screen grid and to check
//     reachability.
//   - On-screen LAYOUTS ("alephbet" | "israeli" | "qwerty"): what the popup
//     draws — rows of keys, each key showing a Hebrew char to insert (plus
//     an optional shift-char for the phonetic "qwerty" layout's finals).
//   - Physical PHYSICAL_MAPS ("original" | "israeli" | "qwerty"): what a
//     real keydown gets remapped to while the popup is open.
//
// "israeli" reuses the same table (SI-1452) for both on-screen and physical
// use — the on-screen grid literally *is* a drawing of that keyboard.
// "qwerty" is a single phonetic table (a-z -> Hebrew letter) shared by both
// on-screen and physical use; finals are reached via Shift on the same key.

// 22 base letters, alphabetical (Sefaria/standard order).
export const HEBREW_LETTERS = [
  "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ",
  "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת",
];

// base letter -> sofit (final) form, for the 5 letters that have one.
export const FINALS = {
  כ: "ך",
  מ: "ם",
  נ: "ן",
  פ: "ף",
  צ: "ץ",
};

export const FINAL_LETTERS = Object.values(FINALS);

// All 27 distinct glyphs (22 base + 5 finals).
export const ALL_LETTERS = [...HEBREW_LETTERS, ...FINAL_LETTERS];

// --- SI-1452 (standard Israeli physical keyboard) -------------------------
// Full mapping for every key SI-1452 assigns a Hebrew letter or punctuation
// to. Used verbatim both as the physical remap table and as the source for
// the "israeli" on-screen layout (drawn in the same row shape).
export const SI1452 = {
  q: "/", w: "'", e: "ק", r: "ר", t: "א", y: "ט", u: "ו", i: "ן", o: "ם", p: "פ",
  a: "ש", s: "ד", d: "ג", f: "כ", g: "ע", h: "י", j: "ח", k: "ל", l: "ך", ";": "ף",
  z: "ז", x: "ס", c: "ב", v: "ה", b: "נ", n: "מ", m: "צ", ",": "ת", ".": "ץ",
};

// --- Phonetic ("qwerty") mapping -------------------------------------------
// Single-key assignments, chosen for a Latin-keyboard-shaped grid. Where the
// obvious phonetic key was already taken by an earlier letter, the next
// most sensible free key was used (documented per-letter below). Finals are
// reached with Shift on the same base-consonant key (Shift+M -> ם, etc.),
// matching SPEC.md's example.
//
//   a -> א (alef)         b -> ב (bet)          g -> ג (gimel)
//   d -> ד (dalet)        h -> ה (hey)          v -> ו (vav)
//   z -> ז (zayin)        x -> ח (het; "Ch/X" -> x, ch already free elsewhere)
//   t -> ט (tet)          y -> י (yod)          k -> כ (kaf; "K/C" -> k)
//   l -> ל (lamed)        m -> מ (mem)          n -> נ (nun)
//   s -> ס (samekh)       e -> ע (ayin; vowel-ish letter -> free "e" key)
//   p -> פ (pe)           c -> צ (tzadi; "Tz" -> c, since t/k were taken)
//   q -> ק (qof)          r -> ר (resh)
//   w -> ש (shin; "Sh" -> w, since s was taken by samekh)
//   f -> ת (tav; "T" was taken by tet, so tav gets the next free key)
export const QWERTY_PHONETIC = {
  a: "א", b: "ב", g: "ג", d: "ד", h: "ה", v: "ו", z: "ז", x: "ח",
  t: "ט", y: "י", k: "כ", l: "ל", m: "מ", n: "נ", s: "ס", e: "ע",
  p: "פ", c: "צ", q: "ק", r: "ר", w: "ש", f: "ת",
};

// Shift+key -> final letter, for the base letters that have one. Keyed by
// the same physical key as QWERTY_PHONETIC (k/m/n/p/c hold כ/מ/נ/פ/צ).
export const QWERTY_SHIFT_FINALS = {
  k: "ך", m: "ם", n: "ן", p: "ף", c: "ץ",
};

// Row shape shared by the "israeli" and "qwerty" on-screen layouts (drawn
// as a QWERTY-shaped grid regardless of which table backs it).
const QWERTY_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", "."],
];

// How many alephbet-grid keys per row.
const ALEPHBET_ROW_SIZE = 7;

// --- On-screen layouts ------------------------------------------------------
// Each row is an array of key descriptors: { key (unique React key + the
// physical key it's drawn at, for israeli/qwerty), char (glyph inserted on
// a plain click), shiftChar (glyph inserted when Shift is held, if any) }.

function alephbetRows() {
  const keys = HEBREW_LETTERS.flatMap((letter) =>
    FINALS[letter] ? [letter, FINALS[letter]] : [letter]
  );
  const rows = [];
  for (let i = 0; i < keys.length; i += ALEPHBET_ROW_SIZE) {
    rows.push(
      keys.slice(i, i + ALEPHBET_ROW_SIZE).map((letter) => ({ key: letter, char: letter }))
    );
  }
  return rows;
}

function israeliRows() {
  return QWERTY_ROWS.map((row) =>
    row
      .filter((key) => SI1452[key])
      .map((key) => ({ key, char: SI1452[key] }))
  );
}

function qwertyRows() {
  return QWERTY_ROWS.map((row) =>
    row
      .filter((key) => QWERTY_PHONETIC[key])
      .map((key) => ({
        key,
        char: QWERTY_PHONETIC[key],
        shiftChar: QWERTY_SHIFT_FINALS[key] || null,
      }))
  );
}

export const LAYOUTS = ["alephbet", "israeli", "qwerty"];
export const PHYSICAL_MODES = ["original", "israeli", "qwerty"];

// Returns rows of key descriptors for the given on-screen layout name.
export function getLayoutRows(layout) {
  if (layout === "israeli") return israeliRows();
  if (layout === "qwerty") return qwertyRows();
  return alephbetRows();
}

// Visual direction the on-screen grid should render in (Wave 3 item 8).
// "alephbet" is a right-to-left alphabet chart — HEBREW_LETTERS is already
// alef-first, so rendering its rows with dir="rtl" puts א in the top-right
// corner and lets each row run right-to-left, matching a real Hebrew
// keyboard's visual convention. "israeli"/"qwerty" instead draw a picture of
// a physical QWERTY-shaped keyboard (same key positions the table maps
// from), so they stay left-to-right regardless of which glyphs sit on them.
export function getLayoutDir(layout) {
  return layout === "alephbet" ? "rtl" : "ltr";
}

// Maps a single lowercased keyboard-event key to the Hebrew character it
// should produce under the given physical mapping mode, or null if the key
// isn't remapped (mode is "original", or the key has no mapping).
// `shiftKey` only matters for "qwerty" (selects the final-letter variant).
export function mapPhysicalKey(physical, key, shiftKey) {
  if (!key || key.length !== 1) return null;
  const lower = key.toLowerCase();
  if (physical === "israeli") {
    return SI1452[lower] || null;
  }
  if (physical === "qwerty") {
    if (shiftKey && QWERTY_SHIFT_FINALS[lower]) return QWERTY_SHIFT_FINALS[lower];
    return QWERTY_PHONETIC[lower] || null;
  }
  return null;
}
