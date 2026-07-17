// Pure text-transform + layout helpers for rendering a source's segments
// per the active display toggles. See docs/ARCHITECTURE.md "Display
// toggles" for the full semantics this implements. Nothing here touches
// the DOM or localStorage — everything is a pure function over
// strings/arrays so it's unit-testable offline.
//
// Note: settings.body.alignment ("sides" | "center") is a separate,
// orthogonal axis handled entirely in CSS (styles.css
// .source-card-ref-*/.source-card-body-*) and SourceCard.jsx — it decides
// how the Hebrew/English columns this file produces are arranged
// side-by-side, not what the columns contain.

// ---- Unicode strip helpers -------------------------------------------------

// Cantillation marks (taamim): U+0591-05AF plus meteg U+05BD.
const TAAMIM_RE = /[֑-ֽ֯]/g;
// Nikkud (vowel points): U+05B0-05BC, U+05BF, U+05C1, U+05C2, U+05C7.
const NIKKUD_RE = /[ְ-ׇּֿׁׂ]/g;
// Sof passuk: U+05C3.
const SOF_PASSUK_RE = /[׃]/g;

export function stripTaamim(s) {
  if (!s) return s || "";
  return s.replace(TAAMIM_RE, "");
}

export function stripNikkud(s) {
  if (!s) return s || "";
  return s.replace(NIKKUD_RE, "");
}

export function stripSofPassuk(s) {
  if (!s) return s || "";
  return s.replace(SOF_PASSUK_RE, "");
}

// ---- Hebrew numeral helper -------------------------------------------------

const HEBREW_NUMERAL_TABLE = [
  [400, "ת"],
  [300, "ש"],
  [200, "ר"],
  [100, "ק"],
  [90, "צ"],
  [80, "פ"],
  [70, "ע"],
  [60, "ס"],
  [50, "נ"],
  [40, "מ"],
  [30, "ל"],
  [20, "כ"],
  [10, "י"],
  [9, "ט"],
  [8, "ח"],
  [7, "ז"],
  [6, "ו"],
  [5, "ה"],
  [4, "ד"],
  [3, "ג"],
  [2, "ב"],
  [1, "א"],
];

// int -> Hebrew numeral, e.g. 1 -> "א׳", 15 -> "ט״ו", 16 -> "ט״ז", 119 -> "קי״ט".
// Handles the traditional 15/16 exceptions (avoiding letter combos that spell
// the Tetragrammaton); geresh (׳) for single-letter numbers, gershayim (״)
// before the final letter otherwise. Only meaningful for positive integers.
export function toHebrewNumeral(num) {
  if (!Number.isFinite(num) || num <= 0) return "";
  if (num === 15) return "ט״ו";
  if (num === 16) return "ט״ז";

  let n = Math.floor(num);
  const letters = [];
  while (n >= 400) {
    letters.push("ת");
    n -= 400;
  }
  for (const [value, letter] of HEBREW_NUMERAL_TABLE) {
    while (n >= value) {
      letters.push(letter);
      n -= value;
    }
  }
  if (letters.length === 0) return "";
  if (letters.length === 1) return letters[0] + "׳"; // geresh
  return letters.slice(0, -1).join("") + "״" + letters[letters.length - 1]; // gershayim before last
}

// ---- Petuchah/setumah + <br> handling --------------------------------------

// Petuchah/setumah markers arrive inside segment text as trailing {פ}/{ס}
// (also seen as (פ)/(ס)). The live API wraps them in markup, e.g.
// `<span class="mam-spi-pe">{פ}</span>`, so the wrapper is matched and
// stripped along with the marker.
const MARKER_RE = /(?:<[a-z][^>]*>)?\s*[\{\(]\s*([פס])\s*[\}\)]\s*(?:<\/[a-z][^>]*>)?\s*$/i;

function extractTrailingMarker(he) {
  if (!he) return { text: he || "", breakType: null };
  const stripped = he.replace(/<br\s*\/?>/gi, " ");
  const match = stripped.match(MARKER_RE);
  if (!match) return { text: stripped, breakType: null };
  const breakType = match[1] === "פ" ? "petuchah" : "setumah";
  return { text: stripped.slice(0, match.index).trimEnd(), breakType };
}

function stripBr(s) {
  if (!s) return s || "";
  return s.replace(/<br\s*\/?>/gi, " ").trim();
}

// ---- Segment processing ----------------------------------------------------

function processSegment(heRaw, enRaw, opts) {
  const { text: extractedHe, breakType } = extractTrailingMarker(heRaw);
  let he = extractedHe;
  if (opts.stripTaamim) he = stripTaamim(he);
  if (opts.stripNikkud) he = stripNikkud(he);
  if (!opts.keepSofPassuk) he = stripSofPassuk(he);
  he = he.trim();
  const en = stripBr(enRaw);
  return { he, en, breakType };
}

function segRef(refs, i) {
  return (refs && refs[i]) || {};
}

function segNum(ref) {
  if (ref.passuk != null) return ref.passuk;
  if (ref.segment != null) return ref.segment;
  return null;
}

function segPerek(ref) {
  if (ref.perek != null) return ref.perek;
  if (ref.section != null) return ref.section;
  return null;
}

function heArr(source) {
  return source.heEdited || source.heSegments || [];
}

function enArr(source) {
  return source.enEdited || source.enSegments || [];
}

// perekHeading block for a given chapter number, e.g. "פרק ב׳"/"Chapter 2".
function perekHeadingBlock(perek) {
  return {
    type: "perekHeading",
    perek,
    heText: `פרק ${toHebrewNumeral(perek)}`,
    enText: `Chapter ${perek}`,
  };
}

function markerSegment(breakType, style) {
  return {
    he: breakType === "petuchah" ? "פ" : "ס",
    en: "",
    num: null,
    numStyle: "faint-marker",
    isMarker: true,
  };
}

function gapSegment() {
  return { he: "", en: "", num: null, numStyle: "none", isGap: true };
}

// layoutSegments(source, toggles) -> array of render blocks:
//   { type: "perekHeading", perek, heText, enText }
//   { type: "line", segments: [{he, en, num, numStyle}] }
//   { type: "flow", segments: [{he, en, num, numStyle, isMarker?, isGap?}] }
//
// `toggles` is { nikkud, taamim, punctuation, verseLineBreaks,
// chapterLineBreaks, showNumbers, chapterHeadings } (see
// src/lib/settings.js TANAKH_PRESETS/OTHER_PRESETS for named combinations).
// Uses heEdited/enEdited (overlay) in preference to heSegments/enSegments
// when present. Works identically for Tanakh and non-Tanakh sources —
// segPerek/segNum already read both ref shapes generically, so no
// source.isTanakh branch is needed here.
//
// Petuchah/setumah (פ/ס open/closed parsha markers) are always-on
// background logic, not user-toggleable: marker *style* is derived from
// `showNumbers` — off => a silent structural break (gap-style: petuchah
// forces a new flow block, setumah inserts an invisible isGap segment,
// matching the old "klaf" mode's parchment-scroll look); on => an inline
// faint פ/ס marker segment without splitting the surrounding block
// (matching the old "sefer" mode). This uniformly covers combinations that
// previously (silently) dropped markers altogether.
export function layoutSegments(source, toggles) {
  if (!source) return [];
  const he = heArr(source);
  const en = enArr(source);
  const refs = source.segmentRefs || [];
  const opts = {
    stripTaamim: !toggles.taamim,
    stripNikkud: !toggles.nikkud,
    keepSofPassuk: !!toggles.punctuation,
  };
  const numStyle = !toggles.showNumbers ? "none" : toggles.chapterHeadings ? "regular" : "small-faint";
  const gapStyle = !toggles.showNumbers;

  const blocks = [];

  if (toggles.verseLineBreaks) {
    let currentPerek = null;
    for (let i = 0; i < he.length; i++) {
      const ref = segRef(refs, i);
      const perek = segPerek(ref);
      if (toggles.chapterHeadings && perek != null && perek !== currentPerek) {
        blocks.push(perekHeadingBlock(perek));
      }
      currentPerek = perek;
      const { he: h, en: e, breakType } = processSegment(he[i], en[i], opts);
      blocks.push({ type: "line", segments: [{ he: h, en: e, num: segNum(ref), numStyle }] });
      if (breakType) {
        if (gapStyle) {
          if (breakType === "setumah") {
            blocks.push({ type: "line", segments: [gapSegment()] });
          }
          // petuchah in gap-style is already a full line break (the next
          // verse starts its own "line" block); nothing extra to insert.
        } else {
          blocks.push({ type: "line", segments: [markerSegment(breakType)] });
        }
      }
    }
    return blocks;
  }

  // Flowing (non-line) layout: one or more "flow" blocks, split at chapter
  // boundaries when chapterLineBreaks or chapterHeadings is on, and (in
  // gap-style only) at every petuchah.
  let currentPerek = null;
  let current = null;
  const startNewBlock = () => {
    if (current && current.segments.length) blocks.push(current);
    current = { type: "flow", segments: [] };
  };
  startNewBlock();

  for (let i = 0; i < he.length; i++) {
    const ref = segRef(refs, i);
    const perek = segPerek(ref);
    const chapterChanged = perek != null && perek !== currentPerek && currentPerek !== null;
    if (chapterChanged && (toggles.chapterLineBreaks || toggles.chapterHeadings)) {
      startNewBlock();
      if (toggles.chapterHeadings) blocks.push(perekHeadingBlock(perek));
    } else if (currentPerek === null && toggles.chapterHeadings && perek != null) {
      blocks.push(perekHeadingBlock(perek));
    }
    currentPerek = perek;

    const { he: h, en: e, breakType } = processSegment(he[i], en[i], opts);
    current.segments.push({ he: h, en: e, num: segNum(ref), numStyle });

    if (breakType) {
      if (gapStyle) {
        if (breakType === "petuchah") {
          startNewBlock();
        } else {
          current.segments.push(gapSegment());
        }
      } else {
        current.segments.push(markerSegment(breakType));
      }
    }
  }
  if (current && current.segments.length) blocks.push(current);
  return blocks;
}
