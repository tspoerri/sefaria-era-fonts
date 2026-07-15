import { stripNikud, fixGematriaOrder } from "./hebrewSearch.js";

// Cleans up freeform/pasted source-reference input before it's sent to Sefaria.
// Handles: pasted Sefaria URLs, percent-encoding artifacts, form-encoded "+",
// underscore-as-space (Sefaria's own URL convention), smart quotes/dashes,
// invisible/zero-width characters, stray wrapping punctuation, and Hebrew
// nikud/cantillation (Sefaria's ref parser and name lookup both fail on
// vocalized text, so it must go before either endpoint sees the string).
export function normalizeSourceInput(raw) {
  if (!raw) return "";
  let s = raw.trim();
  if (!s) return "";

  // Pasted full Sefaria URL -> just the ref portion of the path.
  const urlMatch = s.match(/^(?:https?:\/\/)?(?:www\.)?sefaria\.org\/([^?#]+)/i);
  if (urlMatch) {
    s = urlMatch[1];
  }

  // Repeatedly decode percent-encoding (copy/paste from a URL bar can be
  // double-encoded); bail out if it's not valid encoding rather than throw.
  for (let i = 0; i < 3 && /%[0-9a-fA-F]{2}/.test(s); i++) {
    try {
      const decoded = decodeURIComponent(s);
      if (decoded === s) break;
      s = decoded;
    } catch {
      break;
    }
  }

  s = s.replace(/\+/g, " "); // form-encoded space
  s = s.replace(/_/g, " "); // Sefaria URL word separator
  s = stripNikud(s);

  s = s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/[​-‏‪-‮﻿]/g, "");

  s = s.replace(/\s+/g, " ").trim();

  // Sefaria denotes a verse/daf range with a bare hyphen (e.g. "Genesis
  // 1:1-5"), but people write ranges as "1:1 to 5", "1:1 through 1:5", or
  // "א:א עד ה". Collapse any of those separators to a hyphen so the range
  // reaches Sefaria in the form it expects. Restricted to spots where a
  // verse/numeral-like token sits on both sides (digit, ".", ":", or a
  // Hebrew letter optionally followed by geresh/gershayim) so ordinary
  // titles that happen to contain the word "to" (e.g. "Guide to the
  // Perplexed") are left untouched. The before-side also allows a digit
  // followed by "a"/"b" (a Talmud amud marker, e.g. "2a to 3b") — requiring
  // the digit keeps this from matching an ordinary title that happens to
  // end in "a" or "b" (e.g. "Yoma to Sukkah").
  s = s.replace(
    /([\d:.]|[א-ת][׳״]?|\d[ab])\s*(?:-|to|through|עד)\s*(?=[\d:.א-ת])/gi,
    (_, before) => before + "-"
  );

  // Strip wrapping punctuation left over from sentences/citations, but never
  // touch ":" or "." — both are meaningful ref separators for Sefaria.
  s = s.replace(/^[,;"'([{]+/, "").replace(/[,;"')\]}]+$/, "");

  s = s.trim();

  // A trailing gematria address (e.g. "א:א") is letters used as numerals,
  // not a spelled word — it can't have a homophone or malei/chaseir typo,
  // but it can still have its letters in the wrong order (e.g. "בק" instead
  // of "קב"). Fix that without touching the title portion, where the same
  // letter runs are meaningful spelling, not numerals.
  const { title, address } = splitTitleAndAddress(s);
  if (address) {
    const fixedAddress = address.replace(/[א-ת]{2,4}[׳״]?/g, (token) => fixGematriaOrder(token));
    if (fixedAddress !== address) {
      s = title + fixedAddress;
    }
  }

  return s;
}

// Sefaria's name-completion endpoint does typo-tolerant matching against
// book/work titles, but a trailing chapter:verse address (e.g. "Genessis 1",
// or a Hebrew gematria address like "א:א") throws it off — it stops treating
// the string as a title lookup. Split the trailing address token off so
// callers can query suggestions on just the title portion, then reattach the
// address to whichever suggestion the user picks. Titles that themselves
// start with a digit ("1 Samuel") are unaffected since only the *last*
// space-separated token is considered, and a trailing address is recognized
// by ASCII digits, a ":" separator (works for "1:1" and Hebrew "א:א" alike),
// or Hebrew geresh/gershayim gematria marks (e.g. "א׳", "כ״ג") — not by
// merely being a Hebrew word, so ordinary multi-word Hebrew titles are left
// intact.
export function splitTitleAndAddress(query) {
  const m = query.match(/^(.*?)(\s+(?:\d[\d:.a-z]*|\S*:\S*|[א-ת]*[׳״][א-ת]*))$/i);
  if (!m) return { title: query, address: "" };
  return { title: m[1], address: m[2] };
}
