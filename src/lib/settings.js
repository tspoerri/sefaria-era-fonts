// Global chrome/display settings store. localStorage-backed, pure helpers
// so App.jsx (and future waves' sidebars) can load/save/merge without
// duplicating shape logic. See SPEC.md "Settings store" for the contract.

const STORAGE_KEY = "sefaria-era-fonts-settings";

export const DEFAULTS = {
  titleBar: {
    language: "both", // "both" | "he" | "en"
    // "sides" (EN left, HE right) | "center" — UI label "Side-by-side"/
    // "Bilingual"; internal key kept as "center" (Wave 3 item 10) so
    // existing localStorage settings don't need a migration. Renders as a
    // gutter-justified two-column layout: HE left (right-aligned), EN
    // right (left-aligned) — see styles.css .source-card-ref-center /
    // .source-card-body-center.
    alignment: "sides",
    nikkud: true,
  },
  body: {
    language: "both",
    alignment: "sides", // see titleBar.alignment above — same "sides"|"center" semantics
    modeTanakh: "sefer", // "klaf" | "sefer" | "simple" | "bare"
    modeOther: "sefer", // "sefer" | "bare"
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
// Wave C's sidebar per-source controls) over the global settings. Each
// top-level section (titleBar/body) is shallow-merged independently; scalar
// top-level keys (translationVersion, showAttribution, siteLang, darkMode)
// are overridden wholesale when present in the override.
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

export { STORAGE_KEY };
