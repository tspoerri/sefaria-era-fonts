import { stripNikud, fixGematriaOrder } from "./hebrewSearch.js";
import { fold } from "./fold.js";
import { parshiyot } from "./parshiyot.js";

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

  // Rewrite structural marker phrases ("daf 2 amud a", "perek 3 passuk 5",
  // "parshas Noach", ...) to the compact address form Sefaria's ref parser
  // expects, BEFORE offline lexicon matching or the /api/name fallback ever
  // sees the query — see docs/SEARCH.md and SPEC.md Wave D1.
  s = rewriteSearchMarkers(s);

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

// ----------------------------------------------------------------------------
// Structural marker parsing (SPEC.md Wave D1 / docs/SEARCH.md).
//
// Turns spoken/written marker phrases ("daf 2 amud a", "perek 3 passuk 5",
// "siman 2 seif 5", "parshas Noach") into the compact address (or resolved
// book+range) form Sefaria's own ref parser and the offline lexicon expect.
// Runs inside `normalizeSourceInput`, upstream of everything else — offline
// matching and the live /api/name fallback both only ever see the rewritten
// string, never the marker phrase.
//
// Only Arabic-digit values are handled; Hebrew-numeral (gematria) daf/perek
// values (e.g. "daf kuf-lamed") are explicitly out of scope this wave (see
// SPEC.md). Hebrew-script marker WORDS (דף/עמוד/פרק/פסוק/סימן/סעיף) ARE
// handled here too — it was cheap to add as parallel regexes in the same
// function, reusing the same Arabic-digit-only constraint — but the Hebrew
// *value* itself must still be Arabic digits.
// ----------------------------------------------------------------------------

// "a"/"aleph"/"א" -> "a"; "b"/"bet"/"beis"/"ב" -> "b"; anything else -> null
// (signals the caller to leave the phrase untouched rather than guess).
function amudLetter(token) {
  if (/^(?:a|aleph|alef|א)$/i.test(token)) return "a";
  if (/^(?:b|bet|beis|ב)$/i.test(token)) return "b";
  return null;
}

/**
 * Rewrite structural marker phrases in a (already whitespace/punctuation
 * normalized) query string. Pure string -> string; safe to call multiple
 * times (idempotent — a already-rewritten "2a" has no "daf"/"amud" left to
 * match again).
 */
export function rewriteSearchMarkers(s) {
  if (!s) return s;
  let out = s;

  // "daf N [amud a|b|aleph|beis|א|ב]" -> "Na"/"Nb"; bare "daf N" -> "N".
  // Requires a digit right after "daf"/"דף" so a bare title like "Daf Yomi"
  // (no number) is never touched. Works regardless of what precedes "daf"
  // ("Brachos daf 2 amud a" -> "Brachos 2a") since it isn't anchored.
  //
  // Uses Unicode-property lookaround (not \b) for the word-boundary check:
  // plain \b only fires at a \w/non-\w transition, and \w doesn't include
  // Hebrew letters — a bare \b before "דף" would silently fail to match at
  // all (both sides of the boundary would be "non-word" from \b's point of
  // view), so this needed a boundary rule that actually understands Hebrew.
  out = out.replace(
    /(?<![\p{L}\p{N}])(?:daf|דף)(?![\p{L}\p{N}])\s+(\d+)(?:\s+(?<![\p{L}\p{N}])(?:amud|עמוד)(?![\p{L}\p{N}])\s+([a-zA-Zא-ב]+))?/giu,
    (full, n, amud) => {
      if (!amud) return n;
      const letter = amudLetter(amud);
      return letter ? `${n}${letter}` : full;
    }
  );

  // Bare "N amud a|b" (no "daf"/"דף" keyword) -> "Na"/"Nb", e.g.
  // "Brachos 2 amud a" -> "Brachos 2a". Only fires with a real amud letter;
  // an unrecognized word after "amud" is left alone.
  out = out.replace(
    /(\d+)\s+(?<![\p{L}\p{N}])(?:amud|עמוד)(?![\p{L}\p{N}])\s+([a-zA-Zא-ב]+)/giu,
    (full, n, amud) => {
      const letter = amudLetter(amud);
      return letter ? `${n}${letter}` : full;
    }
  );

  // "perek N [passuk/pasuk/posuk M]" -> "N:M" / bare "perek N" -> "N".
  out = out.replace(
    /(?<![\p{L}\p{N}])(?:perek|פרק)(?![\p{L}\p{N}])\s+(\d+)(?:\s+(?<![\p{L}\p{N}])(?:p[ao]s+uk|פסוק)(?![\p{L}\p{N}])\s+(\d+))?/giu,
    (_, n, m) => (m ? `${n}:${m}` : n)
  );

  // "siman N [seif/se'if/sif M]" -> "N:M" / bare "siman N" -> "N".
  out = out.replace(
    /(?<![\p{L}\p{N}])(?:siman|סימן)(?![\p{L}\p{N}])\s+(\d+)(?:\s+(?<![\p{L}\p{N}])(?:se'?if|sif|סעיף)(?![\p{L}\p{N}])\s+(\d+))?/giu,
    (_, n, m) => (m ? `${n}:${m}` : n)
  );

  // "parsha(s|t)? NAME" / "parashat NAME" -> "Book range", looked up in the
  // 54-entry table (src/lib/parshiyot.js), fold()-matched so folk spellings
  // ("parshas Noach", "parshat Vayeitzei") resolve. Only fires when the
  // marker leads the WHOLE query (not embedded mid-sentence) — that's the
  // shape every spec example uses, and it keeps this rule from accidentally
  // firing on an unrelated query that happens to contain "parsha" somewhere.
  out = rewriteParshaMarker(out);

  return out;
}

const PARSHA_LEAD = /^(?:parshas|parshat|parashat|parasha|parsha)\s+(.+)$/i;

// A lighter, non-lossy normalization (lowercase + strip apostrophes/
// hyphens/whitespace only — no consonant-class folding or vowel deletion)
// used ONLY to break a fold()-key collision (see below). Two different
// parsha names can legitimately fold to the same short key (e.g. "Vaera"
// and "Behar" both -> "br" — fold.js's phonetic reduction is coarse by
// design, see its short-key-collision note in nameSearch.js), so exact
// fold-key equality alone isn't safe enough to resolve to a specific
// book+range without a tiebreak; getting this wrong would put the wrong
// text on someone's sheet.
function lightNormalize(s) {
  return s.toLowerCase().replace(/['’]/g, "").replace(/[-\s]+/g, "");
}

function rewriteParshaMarker(s) {
  const m = s.match(PARSHA_LEAD);
  if (!m) return s;
  const rawName = m[1].trim();
  const nameKey = fold(rawName);
  if (!nameKey) return s;

  const candidates = parshiyot.filter((p) => fold(p.name) === nameKey);
  if (candidates.length === 0) return s;
  if (candidates.length === 1) return `${candidates[0].book} ${candidates[0].range}`;

  // Fold-key collision — fall back to the lighter normalization to
  // disambiguate; if that STILL doesn't pick a unique candidate, refuse to
  // guess rather than risk resolving to the wrong parsha.
  const lightKey = lightNormalize(rawName);
  const exact = candidates.find((p) => lightNormalize(p.name) === lightKey);
  return exact ? `${exact.book} ${exact.range}` : s;
}
