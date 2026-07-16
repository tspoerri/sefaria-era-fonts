// Pure op logic for the Wave B constrained text editor (SPEC.md "Wave B —
// content editing", item 2). No React, no DOM — everything is a function
// over plain data so it's unit-testable offline; src/components/TextEditor.jsx
// is a thin shell that calls into here.
//
// Model: a source's heSegments/enSegments (flat string arrays, one entry per
// verse/section, possibly containing Sefaria HTML markup) are tokenized to a
// flat list of word tokens, each tagged with the segment index it came from.
// Ops (trim/elide/bracket/substitute) operate on a contiguous range of that
// flat token list and replace it with zero or one replacement tokens.
// rebuildSegments() re-groups tokens by segIndex to produce the segment-
// aligned heEdited/enEdited arrays Wave A's layoutSegments() already knows
// how to render (a segment with no surviving tokens becomes "").
//
// HTML note: tokenizing strips tags first (Sefaria segments can contain
// <span>/<i>/<sup> etc. markup) — editing operates on the plain-text
// content only. This means a segment that has been edited (heEdited/
// enEdited overlay set) loses its original inline markup; that's an
// accepted tradeoff per SPEC.md, not a bug.

// ---- HTML stripping (text-level tokenization only) -------------------------

const TAG_RE = /<[^>]+>/g;
const ENTITY_MAP = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function stripHtmlToText(html) {
  if (!html) return "";
  const noTags = String(html).replace(TAG_RE, " ");
  return noTags.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === "#") {
      const cp = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTITY_MAP[code.toLowerCase()] || m;
  });
}

// ---- Tokenization ------------------------------------------------------

// Flattens an array of segment strings (HTML allowed) into a flat list of
// word tokens: [{ segIndex, text }], in reading order. Whitespace-only or
// empty segments contribute no tokens.
export function tokenizeSegments(segments) {
  const tokens = [];
  (segments || []).forEach((seg, segIndex) => {
    const plain = stripHtmlToText(seg).trim();
    if (!plain) return;
    plain
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word) => tokens.push({ segIndex, text: word }));
  });
  return tokens;
}

// Re-groups a flat token list back into a segment-aligned array of length
// segCount (words within a segment joined with a single space; segments
// with no surviving tokens become "").
export function rebuildSegments(tokens, segCount) {
  const out = new Array(segCount).fill("");
  const bySeg = new Map();
  for (const tok of tokens) {
    if (!bySeg.has(tok.segIndex)) bySeg.set(tok.segIndex, []);
    bySeg.get(tok.segIndex).push(tok.text);
  }
  for (const [segIndex, words] of bySeg.entries()) {
    if (segIndex >= 0 && segIndex < segCount) out[segIndex] = words.join(" ");
  }
  return out;
}

// ---- Ops -----------------------------------------------------------------

export const OPS_HE = ["trim", "elide", "bracket"];
export const OPS_EN = ["trim", "elide", "bracket", "substitute"];

export function allowedOps(lang) {
  return lang === "en" ? OPS_EN.slice() : OPS_HE.slice();
}

// Trim is only legal when the selection touches the very start of the
// first segment (start === 0 of the whole token list) or the very end of
// the last segment (end === tokens.length - 1) — never a mid-text removal.
export function canTrim(tokens, start, end) {
  if (!tokens || !tokens.length) return false;
  if (start < 0 || end < start || end >= tokens.length) return false;
  return start === 0 || end === tokens.length - 1;
}

// Applies op to tokens[start..end] (inclusive). Returns
// { ok: true, tokens: nextTokens } or { ok: false, error: "<code>" }.
// error codes: "invalid-range" | "trim-not-at-edge" | "empty-text" | "zero-words" | "unknown-op"
export function applyOp(tokens, start, end, op) {
  if (!Array.isArray(tokens) || start == null || end == null) {
    return { ok: false, error: "invalid-range" };
  }
  if (start < 0 || end < start || end >= tokens.length) {
    return { ok: false, error: "invalid-range" };
  }

  const type = op && op.type;
  const segIndex = tokens[start].segIndex;
  let replacement;

  if (type === "trim") {
    if (!canTrim(tokens, start, end)) return { ok: false, error: "trim-not-at-edge" };
    replacement = [];
  } else if (type === "elide") {
    replacement = [{ segIndex, text: "…" }];
  } else if (type === "bracket") {
    const text = (op.text || "").trim();
    if (!text) return { ok: false, error: "empty-text" };
    replacement = [{ segIndex, text: `[${text}]` }];
  } else if (type === "substitute") {
    const text = (op.text || "").trim();
    if (!text) return { ok: false, error: "empty-text" };
    replacement = [{ segIndex, text }];
  } else {
    return { ok: false, error: "unknown-op" };
  }

  const next = tokens.slice(0, start).concat(replacement, tokens.slice(end + 1));
  if (next.length === 0) return { ok: false, error: "zero-words" };
  return { ok: true, tokens: next };
}
