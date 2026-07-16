// Detects the writing direction implied by the FIRST word of free-text
// user input (Wave 3 item 9): a Hebrew-script first word -> "rtl", a
// Latin-script first word -> "ltr". Digit/punctuation-only "words" carry no
// script signal, so the caller gets `null` (meaning: no opinion yet — keep
// whatever direction the field already has, typically inherited from the
// document). Callers re-run this on every keystroke so alignment tracks the
// first word live, including reverting to the default once the first word
// is deleted.

// Hebrew block: U+0590-05FF (same range display.js's strip helpers use).
const HEBREW_RE = new RegExp("[\\u0590-\\u05FF]");
const LATIN_RE = /[A-Za-z]/;

export function detectDir(text) {
  if (!text) return null;
  const trimmed = String(text).trimStart();
  if (!trimmed) return null;
  const firstWord = trimmed.split(/\s+/)[0];
  if (HEBREW_RE.test(firstWord)) return "rtl";
  if (LATIN_RE.test(firstWord)) return "ltr";
  return null;
}
