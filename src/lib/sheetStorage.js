// Sheet state storage: the Wave-C blocks model ({title, author, blocks}),
// localStorage load/save, and the full migration chain down to the
// pre-Wave-A flattened-string shape. Pure/testable (no React) so App.jsx
// can stay a thin wrapper.
//
// Shape history:
//   pre-Wave-A (OLD_STORAGE_KEY "sefaria-era-fonts-sheet"):
//     { title, sources: [{ id, ref, heRef, he, text, era, unclassified }] }
//     `he`/`text` could be string | string[] | string[][] (never flattened
//     before render).
//   Wave A/B (V2_STORAGE_KEY "sefaria-era-fonts-sheet-v2"):
//     { title, sources: [<full segment-preserving source object>] } — see
//     SPEC.md "Shared data-model contracts".
//   Wave C (STORAGE_KEY "sefaria-era-fonts-sheet-v3", current):
//     { title, author, blocks: [{id, type, ...}] } — each pre-existing
//     source becomes a {id, type:"source", source} block. See SPEC.md
//     "Wave C — sheet structure".
//
// loadSheet() always migrates forward to the v3 shape; older keys are left
// in place (non-destructive) so a rollback wouldn't lose data.

import { newSourceBlock } from "./blocks.js";

export const STORAGE_KEY = "sefaria-era-fonts-sheet-v3";
export const V2_STORAGE_KEY = "sefaria-era-fonts-sheet-v2";
export const OLD_STORAGE_KEY = "sefaria-era-fonts-sheet";

export function makeSourceId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Flattens Sefaria's he/text field (string | string[] | string[][]) to a
// flat array of segment strings, in reading order. string[][] happens on
// chapter-spanning ranges — each inner array is one chapter/perek.
export function flattenSefariaText(value) {
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    if (value.length && Array.isArray(value[0])) {
      return value.flatMap((inner) => (Array.isArray(inner) ? inner : [inner]));
    }
    return value.slice();
  }
  return [String(value)];
}

// Derives {perek, passuk} (or {segment} for non-chaptered texts) for every
// flattened segment, given the API's `he` field (pre-flatten, so its shape
// tells us whether we crossed a chapter boundary) and the range's starting
// `sections` address (e.g. [1,1] for Genesis 1:1).
export function buildSegmentRefs(heValue, sections) {
  const start = Array.isArray(sections) ? sections : [];
  if (heValue == null) return [];

  if (typeof heValue === "string") {
    if (start.length >= 2) return [{ perek: start[0], passuk: start[1] }];
    if (start.length === 1) return [{ segment: start[0] }];
    return [{}];
  }

  if (Array.isArray(heValue) && heValue.length && Array.isArray(heValue[0])) {
    // Chapter-spanning range: each inner array is one perek. Perek numbers
    // increment from sections[0]; passuk numbering restarts at 1 for every
    // perek after the first (the first perek starts at sections[1]).
    const perekStart = start[0] != null ? start[0] : 1;
    const passukStart = start[1] != null ? start[1] : 1;
    const refs = [];
    heValue.forEach((inner, pIdx) => {
      const innerArr = Array.isArray(inner) ? inner : [inner];
      const basePasuk = pIdx === 0 ? passukStart : 1;
      innerArr.forEach((_, vIdx) => {
        refs.push({ perek: perekStart + pIdx, passuk: basePasuk + vIdx });
      });
    });
    return refs;
  }

  if (Array.isArray(heValue)) {
    // Flat array: a single-perek verse range, or a flat list of sections
    // for a non-chaptered text.
    if (start.length >= 2) {
      const perek = start[0];
      const passukStart = start[1];
      return heValue.map((_, i) => ({ perek, passuk: passukStart + i }));
    }
    const segStart = start.length >= 1 ? start[0] : 1;
    return heValue.map((_, i) => ({ segment: segStart + i }));
  }

  return [{}];
}

// Aligns the English segment array to the Hebrew segment count: pads with
// "" where English is missing, truncates if somehow longer.
export function alignSegments(heSegments, enValue) {
  const enFlat = flattenSefariaText(enValue);
  const out = new Array(heSegments.length);
  for (let i = 0; i < heSegments.length; i++) {
    out[i] = enFlat[i] != null ? enFlat[i] : "";
  }
  return out;
}

// True if every segment in a flattened English array is empty/whitespace —
// used to trigger the {ven} fallback refetch in src/api/sefaria.js callers.
export function isEmptyEnglish(enValue) {
  const flat = flattenSefariaText(enValue);
  return flat.every((s) => !s || !String(s).trim());
}

function firstAuthorNames(indexResponse) {
  const authors = indexResponse && indexResponse.authors;
  if (!Array.isArray(authors) || authors.length === 0) return { en: null, he: null };
  const a = authors[0];
  if (typeof a === "string") return { en: a, he: null };
  if (a && typeof a === "object") {
    return {
      en: a.en || a.name || null,
      he: a.he || null,
    };
  }
  return { en: null, he: null };
}

// "c. X" for a single-year compDate, "c. X–Y" for a range, null if unknown.
export function formatCompDateDisplay(compDate) {
  if (!Array.isArray(compDate) || compDate.length === 0) return null;
  const nums = compDate.filter((n) => typeof n === "number");
  if (nums.length === 0) return null;
  if (nums.length === 1) return `c. ${nums[0]}`;
  const start = Math.min(...nums);
  const end = Math.max(...nums);
  if (start === end) return `c. ${start}`;
  return `c. ${start}–${end}`;
}

// Builds a new-shape source object from a fetchText response + optional
// fetchIndex response + the already-computed era classification. Pure —
// used by App.jsx's handleAdd and directly testable.
export function buildSourceFromResponse({ resp, index, era, unclassified }) {
  const categories = resp.categories || [];
  const isTanakh = categories[0] === "Tanakh" && resp.primary_category !== "Commentary";
  const heSegments = flattenSefariaText(resp.he);
  const enSegments = alignSegments(heSegments, resp.text);
  const segmentRefs = buildSegmentRefs(resp.he, resp.sections);
  const { en: authorEn, he: authorHe } = firstAuthorNames(index);

  return {
    id: makeSourceId(),
    ref: resp.ref,
    heRef: resp.heRef,
    book: resp.book || null,
    isTanakh,
    sectionNames: resp.sectionNames || null,
    sections: resp.sections || null,
    heSegments,
    enSegments,
    segmentRefs,
    heVersionTitle: resp.heVersionTitle || resp.versionTitleInHebrew || null,
    enVersionTitle: resp.versionTitle || null,
    era,
    unclassified: !!unclassified,
    authorEn: authorEn || null,
    authorHe: authorHe || null,
    compDateDisplay: formatCompDateDisplay(index && index.compDate),
    titleOverride: null,
    heEdited: null,
    enEdited: null,
    settingsOverride: null,
  };
}

// Old-shape `he`/`text` were never flattened before render (SourceCard used
// to join arrays with " " at render time) — reproduce that exact join so a
// migrated source's single segment reads the same as it used to look.
function flattenLegacyJoined(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(flattenLegacyJoined).filter(Boolean).join(" ");
  }
  return String(value);
}

function migrateLegacySource(old) {
  const he = flattenLegacyJoined(old.he);
  const text = flattenLegacyJoined(old.text);
  return {
    id: old.id || makeSourceId(),
    ref: old.ref || "",
    heRef: old.heRef || "",
    book: null,
    isTanakh: false,
    sectionNames: null,
    sections: null,
    heSegments: [he],
    enSegments: [text],
    segmentRefs: [{}],
    heVersionTitle: null,
    enVersionTitle: null,
    era: old.era || "contemporary",
    unclassified: !!old.unclassified,
    authorEn: null,
    authorHe: null,
    compDateDisplay: null,
    titleOverride: null,
    heEdited: null,
    enEdited: null,
    settingsOverride: null,
  };
}

// Migrates a parsed old-shape (pre-Wave-A) sheet object to the v2 shape.
// Pure. (Kept as its own step — rather than jumping straight to v3 — so the
// legacy→v2 migration itself stays independently testable/reusable, per
// SPEC.md's "keep the legacy→v2 migration chain working".)
export function migrateLegacySheet(oldParsed) {
  const title =
    oldParsed && typeof oldParsed.title === "string" ? oldParsed.title : "Untitled Sheet";
  const sources =
    oldParsed && Array.isArray(oldParsed.sources) ? oldParsed.sources.map(migrateLegacySource) : [];
  return { title, sources };
}

// Migrates a parsed v2-shape sheet ({title, sources}) to the v3 blocks
// shape ({title, author, blocks}) — every source becomes a {id, type:
// "source", source} block, in order. Pure.
export function migrateV2ToV3(v2Parsed) {
  const title =
    v2Parsed && typeof v2Parsed.title === "string" ? v2Parsed.title : "Untitled Sheet";
  const author = v2Parsed && typeof v2Parsed.author === "string" ? v2Parsed.author : "";
  const sources = v2Parsed && Array.isArray(v2Parsed.sources) ? v2Parsed.sources : [];
  return { title, author, blocks: sources.map((source) => newSourceBlock(source)) };
}

function defaultSheet() {
  return { title: "Untitled Sheet", author: "", blocks: [] };
}

// Loads sheet state from localStorage, always returning the current (v3)
// shape: prefers STORAGE_KEY; falls back to migrating V2_STORAGE_KEY; falls
// back to migrating OLD_STORAGE_KEY through the full legacy->v2->v3 chain;
// returns a fresh empty sheet if nothing is found. Older keys are left in
// place (non-destructive).
export function loadSheet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        title: typeof parsed.title === "string" ? parsed.title : "Untitled Sheet",
        author: typeof parsed.author === "string" ? parsed.author : "",
        blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      };
    }
  } catch {
    // fall through
  }

  try {
    const v2Raw = localStorage.getItem(V2_STORAGE_KEY);
    if (v2Raw) {
      const v2Parsed = JSON.parse(v2Raw);
      return migrateV2ToV3(v2Parsed);
    }
  } catch {
    // fall through
  }

  try {
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      return migrateV2ToV3(migrateLegacySheet(oldParsed));
    }
  } catch {
    // fall through to default
  }

  return defaultSheet();
}

export function saveSheet(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (private browsing, quota) — ignore.
  }
}
