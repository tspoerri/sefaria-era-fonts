// Tests for src/lib/settings.js: defaults, localStorage load/save, and the
// shallow-merge `resolveSettings` used to layer a per-source override (Wave
// C) over the global settings object. All offline; localStorage is stubbed
// with a tiny in-memory shim since node:test has no DOM.

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

function makeLocalStorageStub() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

globalThis.localStorage = makeLocalStorageStub();

const {
  loadSettings,
  saveSettings,
  DEFAULTS,
  resolveSettings,
  TANAKH_PRESETS,
  OTHER_PRESETS,
  presetForToggles,
  resolveBodyToggles,
} = await import("../src/lib/settings.js");

describe("DEFAULTS", () => {
  test("has the documented shape", () => {
    assert.equal(DEFAULTS.titleNikkud, true);
    assert.equal(DEFAULTS.body.language, "both");
    assert.equal(DEFAULTS.body.alignment, "sides");
    assert.deepEqual(DEFAULTS.body.tanakh, TANAKH_PRESETS.sefer);
    assert.deepEqual(DEFAULTS.body.other, OTHER_PRESETS.sefer);
    assert.equal(DEFAULTS.showAttribution, true);
    assert.equal(DEFAULTS.siteLang, "en");
    assert.equal(DEFAULTS.darkMode, "system");
    assert.equal(DEFAULTS.keyboard.layout, "alephbet");
    assert.equal(DEFAULTS.keyboard.physical, "original");
  });
});

describe("presetForToggles", () => {
  test("matches each named Tanakh preset", () => {
    assert.equal(presetForToggles(TANAKH_PRESETS, TANAKH_PRESETS.klaf), "klaf");
    assert.equal(presetForToggles(TANAKH_PRESETS, TANAKH_PRESETS.sefer), "sefer");
    assert.equal(presetForToggles(TANAKH_PRESETS, TANAKH_PRESETS.simple), "simple");
  });

  test("matches each named Other preset", () => {
    assert.equal(presetForToggles(OTHER_PRESETS, OTHER_PRESETS.sefer), "sefer");
    assert.equal(presetForToggles(OTHER_PRESETS, OTHER_PRESETS.simple), "simple");
  });

  test("returns null when no preset matches exactly", () => {
    const custom = { ...TANAKH_PRESETS.sefer, nikkud: false };
    assert.equal(presetForToggles(TANAKH_PRESETS, custom), null);
  });
});

describe("loadSettings / saveSettings", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  test("returns DEFAULTS when nothing is stored", () => {
    const loaded = loadSettings();
    assert.deepEqual(loaded, DEFAULTS);
  });

  test("round-trips a saved partial settings object, merged over DEFAULTS", () => {
    saveSettings({ darkMode: "dark", body: { tanakh: { ...TANAKH_PRESETS.klaf } } });
    const loaded = loadSettings();
    assert.equal(loaded.darkMode, "dark");
    assert.deepEqual(loaded.body.tanakh, TANAKH_PRESETS.klaf);
    // untouched nested fields survive the merge
    assert.deepEqual(loaded.body.other, DEFAULTS.body.other);
    assert.equal(loaded.titleNikkud, DEFAULTS.titleNikkud);
  });

  test("round-trips a saved keyboard override, merged over DEFAULTS", () => {
    saveSettings({ keyboard: { physical: "israeli" } });
    const loaded = loadSettings();
    assert.equal(loaded.keyboard.physical, "israeli");
    // untouched nested field survives the merge
    assert.equal(loaded.keyboard.layout, DEFAULTS.keyboard.layout);
  });

  test("falls back to DEFAULTS on corrupt JSON", () => {
    globalThis.localStorage.setItem("sefaria-era-fonts-settings", "{not json");
    const loaded = loadSettings();
    assert.deepEqual(loaded, DEFAULTS);
  });
});

describe("resolveSettings", () => {
  test("returns the global settings unchanged when there is no override", () => {
    const resolved = resolveSettings(DEFAULTS, null);
    assert.equal(resolved, DEFAULTS);
  });

  test("shallow-merges a per-source body override over the global settings", () => {
    const resolved = resolveSettings(DEFAULTS, { body: { language: "he" } });
    assert.equal(resolved.body.language, "he");
    // sibling fields in the same section are preserved from the base
    assert.equal(resolved.body.alignment, DEFAULTS.body.alignment);
    assert.equal(resolved.body.tanakh, DEFAULTS.body.tanakh);
    // untouched top-level sections are preserved
    assert.equal(resolved.titleNikkud, DEFAULTS.titleNikkud);
  });

  test("overrides a scalar top-level field wholesale", () => {
    const resolved = resolveSettings(DEFAULTS, { showAttribution: false });
    assert.equal(resolved.showAttribution, false);
  });
});

describe("resolveBodyToggles", () => {
  test("picks the tanakh group when source.isTanakh is true", () => {
    const resolved = resolveBodyToggles(DEFAULTS, { isTanakh: true });
    assert.deepEqual(resolved, DEFAULTS.body.tanakh);
  });

  test("picks the other group when source.isTanakh is false", () => {
    const resolved = resolveBodyToggles(DEFAULTS, { isTanakh: false });
    assert.deepEqual(resolved, DEFAULTS.body.other);
  });

  test("a per-field override wins, untouched fields still inherit", () => {
    const source = {
      isTanakh: true,
      settingsOverride: { toggles: { nikkud: false } },
    };
    const resolved = resolveBodyToggles(DEFAULTS, source);
    assert.equal(resolved.nikkud, false);
    // untouched fields still inherit from the base group
    assert.equal(resolved.taamim, DEFAULTS.body.tanakh.taamim);
    assert.equal(resolved.showNumbers, DEFAULTS.body.tanakh.showNumbers);
    assert.equal(resolved.chapterHeadings, DEFAULTS.body.tanakh.chapterHeadings);
  });

  test("falls back to DEFAULTS body group when global settings is missing", () => {
    const resolved = resolveBodyToggles(null, { isTanakh: false });
    assert.deepEqual(resolved, DEFAULTS.body.other);
  });
});
