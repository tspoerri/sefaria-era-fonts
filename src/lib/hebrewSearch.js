// Vowel points (nikud) and cantillation marks live in this combining-mark
// block. Sefaria's ref parser and name-lookup both fail on vocalized text
// (a pasted "בְּרֵאשִׁית" 404s where "בראשית" resolves fine), so this must be
// stripped before anything is sent to either endpoint.
const NIKUD_RANGE = /[֑-ׇ]/g;

export function stripNikud(text) {
  return text.replace(NIKUD_RANGE, "");
}

export function isHebrewText(text) {
  return /[א-ת]/.test(text);
}

// Hebrew letters that are commonly confused with each other, either because
// they sound alike (once nikud/dagesh is stripped, the letters that
// distinguish "hard" from "soft" pronunciation are gone) or because they sit
// next to each other on the standard Israeli keyboard layout. Used to
// generate alternate spellings when a direct search comes up short — e.g. a
// user typing "כ" for a title actually spelled with "ח" (both can sound
// "kh"), or hitting "ט" for the "ר" beside it on the layout's home row.
const HOMOPHONE_GROUPS = [
  ["א", "ע"], // both silent/glottal
  ["ב", "ו"], // both can sound like "v" (vet vs. vav)
  ["כ", "ח", "ק"], // kaf/chet/kuf all read as "k" or "kh"
  ["ת", "ט"], // both "t"
  ["ס", "ש"], // samech vs. sin, both "s"
];

// Adjacent-key pairs on the standard Israeli (QWERTY-mapped) keyboard, read
// off each physical row left to right.
const KEYBOARD_ROWS = ["/'קראטוןםפ", "שדגכעיחלך", "זסבהנמצתץ"];

function buildConfusableMap() {
  const map = new Map();
  const add = (a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  for (const group of HOMOPHONE_GROUPS) {
    for (const a of group) {
      for (const b of group) {
        if (a !== b) add(a, b);
      }
    }
  }
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i < row.length; i++) {
      if (i > 0) add(row[i], row[i - 1]);
      if (i < row.length - 1) add(row[i], row[i + 1]);
    }
  }
  return map;
}

const CONFUSABLE_LETTERS = buildConfusableMap();

// Generate alternate spellings of a Hebrew title by swapping one letter at a
// time for a commonly-confused alternative. Capped so a long title doesn't
// fan out into dozens of API calls — this is a fallback for when the direct
// query already came up short, not the primary path.
export function generateHebrewVariants(title, maxVariants = 6) {
  const variants = new Set();
  for (let i = 0; i < title.length && variants.size < maxVariants; i++) {
    const alternatives = CONFUSABLE_LETTERS.get(title[i]);
    if (!alternatives) continue;
    for (const alt of alternatives) {
      if (variants.size >= maxVariants) break;
      variants.add(title.slice(0, i) + alt + title.slice(i + 1));
    }
  }
  variants.delete(title);
  return [...variants];
}
