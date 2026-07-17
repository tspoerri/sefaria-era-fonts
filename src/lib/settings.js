// Global chrome/display settings store. localStorage-backed, pure helpers
// so App.jsx (and future waves' sidebars) can load/save/merge without
// duplicating shape logic. See docs/ARCHITECTURE.md "Settings store" for
// the contract.

const STORAGE_KEY = "sefaria-era-fonts-settings";

// Display toggles for one source-type group (Tanakh or other). Presets
// below are named combinations; "Custom" (no matching preset) is reached by
// flipping any individual toggle away from a preset's values.
const TANAKH_KLAF = {
  nikkud: false,
  taamim: false,
  punctuation: false,
  verseLineBreaks: false,
  chapterLineBreaks: false,
  showNumbers: false,
  chapterHeadings: false,
};
const TANAKH_SEFER = {
  nikkud: true,
  taamim: true,
  punctuation: true,
  verseLineBreaks: false,
  chapterLineBreaks: false,
  showNumbers: true,
  chapterHeadings: false,
};
const TANAKH_SIMPLE = {
  nikkud: true,
  taamim: false,
  punctuation: true,
  verseLineBreaks: true,
  chapterLineBreaks: false,
  showNumbers: true,
  chapterHeadings: false,
};
export const TANAKH_PRESETS = { klaf: TANAKH_KLAF, sefer: TANAKH_SEFER, simple: TANAKH_SIMPLE };

const OTHER_SEFER = {
  nikkud: true,
  taamim: true,
  punctuation: true,
  verseLineBreaks: true,
  chapterLineBreaks: false,
  showNumbers: true,
  chapterHeadings: false,
};
const OTHER_SIMPLE = {
  nikkud: false,
  taamim: true,
  punctuation: true,
  verseLineBreaks: false,
  chapterLineBreaks: false,
  showNumbers: true,
  chapterHeadings: false,
};
export const OTHER_PRESETS = { sefer: OTHER_SEFER, simple: OTHER_SIMPLE };

// Given a presets map (TANAKH_PRESETS/OTHER_PRESETS) and a toggle object,
// returns the matching preset key or null if no preset's values match
// exactly. Mirrors the existing translationVersion preset/custom pattern
// in SettingsMenu.jsx (presetForValue), generalized to toggle objects
// instead of a string; callers here treat null as "custom".
export function presetForToggles(presets, toggles) {
  for (const key of Object.keys(presets)) {
    const preset = presets[key];
    const matches = Object.keys(preset).every((field) => preset[field] === toggles[field]);
    if (matches) return key;
  }
  return null;
}

export const DEFAULTS = {
  titleNikkud: true,
  body: {
    language: "both",
    // "sides" (EN left, HE right) | "center" — UI label "Side-by-side"/
    // "Bilingual"; internal key kept as "center" (Wave 3 item 10) so
    // existing localStorage settings don't need a migration. Renders as a
    // gutter-justified two-column layout: HE left (right-aligned), EN
    // right (left-aligned) — see styles.css .source-card-ref-center /
    // .source-card-body-center. Now shared by both the title/ref row and
    // the body (title no longer has its own language/alignment).
    alignment: "sides",
    tanakh: { ...TANAKH_SEFER },
    other: { ...OTHER_SEFER },
  },
  fontStyle: "formal", // "formal" | "casual" | "accessible" — era-font style (see src/lib/fonts.js)
  translationVersion: "Tanakh: The Holy Scriptures, published by JPS",
  showAttribution: true,
  siteLang: "en", // "en" | "he" — chrome language, not source content
  darkMode: "system", // "light" | "dark" | "system"
  keyboard: {
    layout: "alephbet", // "alephbet" | "israeli" | "qwerty" — on-screen arrangement
    physical: "original", // "original" | "israeli" | "qwerty" — hardware remap while popup is open
  },
};

function deepMerge(base, override) {
  if (!override || typeof override !== "object") return base;
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const value = override[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === "object"
    ) {
      out[key] = deepMerge(base[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULTS, parsed);
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private browsing, quota) — ignore.
  }
}

// Shallow-merges a per-source override (partial settings object, e.g. from
// the Outline sidebar's per-source controls) over the global settings. Each
// top-level section (body) is shallow-merged independently; scalar
// top-level keys (fontStyle, titleNikkud, translationVersion,
// showAttribution, siteLang, darkMode) are overridden wholesale when
// present in the override. Note: this does NOT resolve body.tanakh/
// body.other toggle overrides — those go through resolveBodyToggles()
// below via the separate settingsOverride.toggles key, since a naive
// shallow merge of body would let a single overridden toggle field wipe
// out the other 6 inherited fields in that nested object.
export function resolveSettings(global, perSourceOverride) {
  const base = global || DEFAULTS;
  if (!perSourceOverride) return base;
  const out = { ...base };
  for (const key of Object.keys(perSourceOverride)) {
    const value = perSourceOverride[key];
    if (value && typeof value === "object" && !Array.isArray(value) && base[key]) {
      out[key] = { ...base[key], ...value };
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

// Resolves the effective display toggles for one source: picks the
// tanakh/other group from global settings by source.isTanakh, then
// shallow-merges source.settingsOverride.toggles (a flat, one-level object)
// over it if present. Kept separate from resolveSettings's generic merge
// because body.tanakh/body.other are a second level of nesting that a
// one-level shallow merge can't safely handle per-field.
export function resolveBodyToggles(global, source) {
  const settings = global || DEFAULTS;
  const groupKey = source && source.isTanakh ? "tanakh" : "other";
  const base = (settings.body && settings.body[groupKey]) || DEFAULTS.body[groupKey];
  const override = source && source.settingsOverride && source.settingsOverride.toggles;
  return override ? { ...base, ...override } : base;
}

export { STORAGE_KEY };
