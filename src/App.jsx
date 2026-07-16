import { useEffect, useMemo, useRef, useState } from "react";
import AddSource from "./components/AddSource.jsx";
import Sheet from "./components/Sheet.jsx";
import SettingsMenu from "./components/SettingsMenu.jsx";
import { fetchText, fetchIndex } from "./api/sefaria.js";
import { classifyEra } from "./lib/era.js";
import { loadSheet, saveSheet, buildSourceFromResponse, isEmptyEnglish } from "./lib/sheetStorage.js";
import { loadSettings, saveSettings, DEFAULTS } from "./lib/settings.js";
import { t } from "./lib/strings.js";

function applyDarkModeClass(darkMode) {
  const root = document.documentElement;
  let effective = darkMode;
  if (darkMode === "system") {
    effective =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  }
  root.setAttribute("data-theme", effective);
}

export default function App() {
  const initial = useMemo(() => loadSheet(), []);
  const [title, setTitle] = useState(initial.title);
  const [sources, setSources] = useState(initial.sources);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    saveSheet({ title, sources });
  }, [title, sources]);

  useEffect(() => {
    saveSettings(settings);
    applyDarkModeClass(settings.darkMode);
    document.documentElement.dir = settings.siteLang === "he" ? "rtl" : "ltr";
    document.documentElement.lang = settings.siteLang;
  }, [settings]);

  useEffect(() => {
    if (settings.darkMode !== "system") return undefined;
    const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (!mq) return undefined;
    const handler = () => applyDarkModeClass("system");
    mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler);
    };
  }, [settings.darkMode]);

  function updateSettings(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  async function handleAdd(ref) {
    setBusy(true);
    setError(null);
    try {
      const ven = settings.translationVersion && settings.translationVersion.trim();
      let resp = await fetchText(ref, ven ? { ven } : {});
      if (ven && isEmptyEnglish(resp.text)) {
        // Requested version doesn't cover this ref (or has no English) —
        // fall back to Sefaria's default version.
        resp = await fetchText(ref);
      }

      let index = null;
      try {
        index = await fetchIndex(resp.indexTitle);
      } catch {
        index = null;
      }
      const { era, unclassified } = classifyEra(resp, index);
      const newSource = buildSourceFromResponse({ resp, index, era, unclassified });
      setSources((prev) => [...prev, newSource]);
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to add source.");
    } finally {
      setBusy(false);
    }
  }

  function handleRemove(id) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function handleUpdateSource(id, patch) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function handleMove(id, direction) {
    setSources((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function handleResetAll() {
    setSources((prev) =>
      prev.map((s) => ({ ...s, titleOverride: null, heEdited: null, enEdited: null }))
    );
  }

  const siteLang = settings.siteLang;

  return (
    <div className="app">
      <header className="app-header">
        <input
          className="sheet-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Sheet title"
          placeholder={t("sheetTitlePlaceholder", siteLang)}
        />
        <div className="app-header-actions">
          <button
            type="button"
            className="print-button"
            onClick={() => window.print()}
          >
            {t("print", siteLang)}
          </button>
          <IconCluster
            settings={settings}
            onUpdateSettings={updateSettings}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsOpen((v) => !v)}
          />
        </div>
      </header>

      {settingsOpen ? (
        <SettingsMenu
          settings={settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
          onResetAll={handleResetAll}
        />
      ) : null}

      <AddSource onAdd={handleAdd} busy={busy} error={error} />

      <Sheet
        sources={sources}
        onRemove={handleRemove}
        onMove={handleMove}
        onUpdateSource={handleUpdateSource}
        settings={settings}
      />
    </div>
  );
}

function IconCluster({ settings, onUpdateSettings, settingsOpen, onToggleSettings }) {
  const siteLang = settings.siteLang;

  function cycleDarkMode() {
    const next =
      settings.darkMode === "light" ? "dark" : settings.darkMode === "dark" ? "system" : "light";
    onUpdateSettings({ darkMode: next });
  }

  function toggleSiteLang() {
    onUpdateSettings({ siteLang: settings.siteLang === "en" ? "he" : "en" });
  }

  const darkIcon = settings.darkMode === "light" ? "☀️" : settings.darkMode === "dark" ? "\u{1F319}" : "\u{1F5A5}️";
  const darkLabel =
    settings.darkMode === "light"
      ? t("darkModeLight", siteLang)
      : settings.darkMode === "dark"
      ? t("darkModeDark", siteLang)
      : t("darkModeSystem", siteLang);

  return (
    <div className="icon-cluster">
      <button
        type="button"
        className="icon-button"
        onClick={cycleDarkMode}
        aria-label={darkLabel}
        title={darkLabel}
      >
        {darkIcon}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={toggleSiteLang}
        aria-label={
          settings.siteLang === "en"
            ? t("siteLanguageToggle", siteLang)
            : t("siteLanguageToggleHe", siteLang)
        }
        title={settings.siteLang === "en" ? "EN / עב" : "עב / EN"}
      >
        {settings.siteLang === "en" ? "EN" : "עב"}
      </button>
      <button
        type="button"
        className="icon-button"
        disabled
        aria-label="Hebrew keyboard"
        title="Hebrew keyboard (coming soon)"
      >
        {"⌨️"}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={onToggleSettings}
        aria-label={t("settings", siteLang)}
        aria-expanded={settingsOpen}
        title={t("settings", siteLang)}
      >
        {"⚙️"}
      </button>
    </div>
  );
}
