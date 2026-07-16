// Pure text-transform + layout helpers for rendering a source's segments
// per the active display-mode settings. See SPEC.md "Display modes" for the
// full mode semantics this implements. Nothing here touches the DOM or
// localStorage — everything is a pure function over strings/arrays so it's
// unit-testable offline.

// ---- Unicode strip helpers -------------------------------------------------

// Cantillation marks (taamim): U+0591-05AF plus meteg U+05BD.
const TAAMIM_RE = /[\u0591-\u05AF\u05BD]/g;
// Nikkud (vowel points): U+05B0-05BC, U+05BF, U+05C1, U+05C2, U+05C7.
const NIKKUD_RE = /[\u05B0-\u05BC\u05BF\u05C1\u05C2\u05C7]/g;
// Sof passuk: U+05C3.
const SOF_PASSUK_RE = /[\u05C3]/g;

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
// (also seen as (פ)/(ס)). Detect + strip a trailing marker, reporting which
// kind it was so callers can decide how to render the break.
const MARKER_RE = /[\{\(]\s*([פס])\s*[\}\)]\s*$/;

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

// ---- Segment processing per mode -------------------------------------------

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

// ---- Mode implementations ---------------------------------------------------

function layoutTanakhKlaf(source) {
  const he = heArr(source);
  const en = enArr(source);
  const refs = source.segmentRefs || [];
  const opts = { stripTaamim: true, stripNikkud: true, keepSofPassuk: false };

  const blocks = [];
  let current = { type: "flow", segments: [] };
  for (let i = 0; i < he.length; i++) {
    const { he: h, en: e, breakType } = processSegment(he[i], en[i], opts);
    current.segments.push({ he: h, en: e, num: null, numStyle: "none" });
    if (breakType === "petuchah") {
      if (current.segments.length) blocks.push(current);
      current = { type: "flow", segments: [] };
    } else if (breakType === "setumah") {
      current.segments.push({
        he: "",
        en: "",
        num: null,
        numStyle: "none",
        isGap: true,
      });
    }
  }
  if (current.segments.length) blocks.push(current);
  return blocks;
}

function layoutTanakhSefer(source) {
  const he = heArr(source);
  const en = enArr(source);
  const refs = source.segmentRefs || [];
  const opts = { stripTaamim: false, stripNikkud: false, keepSofPassuk: true };

  const block = { type: "flow", segments: [] };
  for (let i = 0; i < he.length; i++) {
    const ref = segRef(refs, i);
    const { he: h, en: e, breakType } = processSegment(he[i], en[i], opts);
    block.segments.push({ he: h, en: e, num: segNum(ref), numStyle: "small-faint" });
    if (breakType === "petuchah" || breakType === "setumah") {
      block.segments.push({
        he: breakType === "petuchah" ? "פ" : "ס",
        en: "",
        num: null,
        numStyle: "faint-marker",
        isMarker: true,
      });
    }
  }
  return block.segments.length ? [block] : [];
}

function layoutTanakhSimple(source) {
  const he = heArr(source);
  const en = enArr(source);
  const refs = source.segmentRefs || [];
  const opts = { stripTaamim: true, stripNikkud: false, keepSofPassuk: true };

  const blocks = [];
  let currentPerek = null;
  for (let i = 0; i < he.length; i++) {
    const ref = segRef(refs, i);
    const perek = segPerek(ref);
    if (perek != null && perek !== currentPerek) {
      currentPerek = perek;
      blocks.push({
        type: "perekHeading",
        perek,
        heText: `פרק ${toHebrewNumeral(perek)}`,
        enText: `Chapter ${perek}`,
      });
    }
    const { he: h, en: e } = processSegment(he[i], en[i], opts);
    blocks.push({
      type: "line",
      segments: [{ he: h, en: e, num: segNum(ref), numStyle: "regular" }],
    });
  }
  return blocks;
}

function layoutTanakhBare(source) {
  const he = heArr(source);
  const en = enArr(source);
  const refs = source.segmentRefs || [];
  const opts = { stripTaamim: true, stripNikkud: true, keepSofPassuk: true };

  const blocks = [];
  let currentPerek = null;
  let current = null;
  for (let i = 0; i < he.length; i++) {
    const ref = segRef(refs, i);
    const perek = segPerek(ref);
    if (perek !== currentPerek) {
      currentPerek = perek;
      if (current && current.segments.length) blocks.push(current);
      current = { type: "flow", segments: [] };
    }
    const { he: h, en: e } = processSegment(he[i], en[i], opts);
    current.segments.push({ he: h, en: e, num: segNum(ref), numStyle: "small-faint" });
  }
  if (current && current.segments.length) blocks.push(current);
  return blocks;
}

function layoutOtherSefer(source) {
  const he = heArr(source);
  const en = enArr(source);
  const refs = source.segmentRefs || [];
  const opts = { stripTaamim: false, stripNikkud: false, keepSofPassuk: true };

  const blocks = [];
  for (let i = 0; i < he.length; i++) {
    const ref = segRef(refs, i);
    const { he: h, en: e } = processSegment(he[i], en[i], opts);
    blocks.push({
      type: "line",
      segments: [{ he: h, en: e, num: segNum(ref), numStyle: "small-faint" }],
    });
  }
  return blocks;
}

function layoutOtherBare(source) {
  const he = heArr(source);
  const en = enArr(source);
  const refs = source.segmentRefs || [];
  const opts = { stripTaamim: false, stripNikkud: true, keepSofPassuk: true };

  const block = { type: "flow", segments: [] };
  for (let i = 0; i < he.length; i++) {
    const ref = segRef(refs, i);
    const { he: h, en: e } = processSegment(he[i], en[i], opts);
    block.segments.push({ he: h, en: e, num: segNum(ref), numStyle: "small-faint" });
  }
  return block.segments.length ? [block] : [];
}

// layoutSegments(source, mode) -> array of render blocks:
//   { type: "perekHeading", perek, heText, enText }
//   { type: "line", segments: [{he, en, num, numStyle}] }
//   { type: "flow", segments: [{he, en, num, numStyle, isMarker?, isGap?}] }
//
// `mode` is one of "klaf"|"sefer"|"simple"|"bare" for source.isTanakh, or
// "sefer"|"bare" for non-Tanakh sources. Uses heEdited/enEdited (Wave B
// overlay) in preference to heSegments/enSegments when present. Unknown
// modes fall back to "sefer" (the most information-preserving mode).
export function layoutSegments(source, mode) {
  if (!source) return [];
  if (source.isTanakh) {
    switch (mode) {
      case "klaf":
        return layoutTanakhKlaf(source);
      case "simple":
        return layoutTanakhSimple(source);
      case "bare":
        return layoutTanakhBare(source);
      case "sefer":
      default:
        return layoutTanakhSefer(source);
    }
  }
  switch (mode) {
    case "bare":
      return layoutOtherBare(source);
    case "sefer":
    default:
      return layoutOtherSefer(source);
  }
}
