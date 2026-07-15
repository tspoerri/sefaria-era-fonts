import { stripNikud } from "./hebrewSearch.js";

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

  // Strip wrapping punctuation left over from sentences/citations, but never
  // touch ":" or "." — both are meaningful ref separators for Sefaria.
  s = s.replace(/^[,;"'([{]+/, "").replace(/[,;"')\]}]+$/, "");

  return s.trim();
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
