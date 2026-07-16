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

const { loadSettings, saveSettings, DEFAULTS, resolveSettings } = await import(
  "../src/lib/settings.js"
);

describe("DEFAULTS", () => {
  test("has the documented shape", () => {
    assert.equal(DEFAULTS.titleBar.language, "both");
    assert.equal(DEFAULTS.titleBar.alignment, "sides");
    assert.equal(DEFAULTS.titleBar.nikkud, true);
    assert.equal(DEFAULTS.body.language, "both");
    assert.equal(DEFAULTS.body.modeTanakh, "sefer");
    assert.equal(DEFAULTS.body.modeOther, "sefer");
    assert.equal(DEFAULTS.showAttribution, true);
    assert.equal(DEFAULTS.siteLang, "en");
    assert.equal(DEFAULTS.darkMode, "system");
    assert.equal(DEFAULTS.keyboard.layout, "alephbet");
    assert.equal(DEFAULTS.keyboard.physical, "original");
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
    saveSettings({ darkMode: "dark", body: { modeTanakh: "klaf" } });
    const loaded = loadSettings();
    assert.equal(loaded.darkMode, "dark");
    assert.equal(loaded.body.modeTanakh, "klaf");
    // untouched nested fields survive the merge
    assert.equal(loaded.body.modeOther, DEFAULTS.body.modeOther);
    assert.equal(loaded.titleBar.language, DEFAULTS.titleBar.language);
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

  test("shallow-merges a per-source titleBar override over the global settings", () => {
    const resolved = resolveSettings(DEFAULTS, { titleBar: { language: "he" } });
    assert.equal(resolved.titleBar.language, "he");
    // sibling fields in the same section are preserved from the base
    assert.equal(resolved.titleBar.alignment, DEFAULTS.titleBar.alignment);
    assert.equal(resolved.titleBar.nikkud, DEFAULTS.titleBar.nikkud);
    // untouched top-level sections are preserved
    assert.equal(resolved.body, DEFAULTS.body);
  });

  test("overrides a scalar top-level field wholesale", () => {
    const resolved = resolveSettings(DEFAULTS, { showAttribution: false });
    assert.equal(resolved.showAttribution, false);
  });
});
