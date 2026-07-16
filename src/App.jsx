import { useEffect, useMemo, useRef, useState } from "react";
import AddSource from "./components/AddSource.jsx";
import Sheet from "./components/Sheet.jsx";
import SettingsMenu from "./components/SettingsMenu.jsx";
import Outline from "./components/Outline.jsx";
import { fetchText, fetchIndex } from "./api/sefaria.js";
import { classifyEra } from "./lib/era.js";
import { loadSheet, saveSheet, buildSourceFromResponse, isEmptyEnglish } from "./lib/sheetStorage.js";
import { loadSettings, saveSettings, DEFAULTS } from "./lib/settings.js";
import { t } from "./lib/strings.js";
import {
  newSourceBlock,
  newHeadingBlock,
  newTextBlock,
  newSpacerBlock,
  reorderBlocks,
  removeBlockAt,
  restoreBlockAt,
} from "./lib/blocks.js";

const UNDO_TIMEOUT_MS = 7000;

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
  const [author, setAuthor] = useState(initial.author || "");
  const [blocks, setBlocks] = useState(initial.blocks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const undoTimers = useRef(new Map());
  const undoIdRef = useRef(0);

  useEffect(() => {
    saveSheet({ title, author, blocks });
  }, [title, author, blocks]);

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

  // Clear any pending undo timers on unmount.
  useEffect(() => {
    const timers = undoTimers.current;
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
    };
  }, []);

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
      setBlocks((prev) => [...prev, newSourceBlock(newSource)]);
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to add source.");
    } finally {
      setBusy(false);
    }
  }

  function handleUpdateSourceBlock(blockId, patch) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId && b.type === "source" ? { ...b, source: { ...b.source, ...patch } } : b))
    );
  }

  function handleUpdateSimpleBlock(blockId, patch) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
  }

  function handleMoveBlock(blockId, direction) {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;
      return reorderBlocks(prev, index, index + direction);
    });
  }

  function handleReorder(fromIndex, toIndex) {
    setBlocks((prev) => reorderBlocks(prev, fromIndex, toIndex));
  }

  function scheduleUndoExpiry(undoId) {
    const timerId = setTimeout(() => {
      setUndoStack((prev) => prev.filter((entry) => entry.undoId !== undoId));
      undoTimers.current.delete(undoId);
    }, UNDO_TIMEOUT_MS);
    undoTimers.current.set(undoId, timerId);
  }

  // Source blocks get the delete-guard (undo toast); simple blocks (heading/
  // text/spacer) delete immediately, per SPEC.md Wave C item 3.
  function handleDeleteBlock(blockId) {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;
      const { blocks: next, removed } = removeBlockAt(prev, index);
      if (!removed) return prev;
      if (removed.block.type === "source") {
        undoIdRef.current += 1;
        const undoId = undoIdRef.current;
        setUndoStack((stack) => [...stack, { undoId, block: removed.block, index: removed.index }]);
        scheduleUndoExpiry(undoId);
      }
      return next;
    });
  }

  function handleUndo(undoId) {
    const entry = undoStack.find((e) => e.undoId === undoId);
    if (!entry) return;
    const timerId = undoTimers.current.get(undoId);
    if (timerId) {
      clearTimeout(timerId);
      undoTimers.current.delete(undoId);
    }
    setUndoStack((prev) => prev.filter((e) => e.undoId !== undoId));
    setBlocks((prev) => restoreBlockAt(prev, { block: entry.block, index: entry.index }));
  }

  function handleResetAll() {
    setBlocks((prev) =>
      prev.map((b) =>
        b.type === "source"
          ? { ...b, source: { ...b.source, titleOverride: null, heEdited: null, enEdited: null } }
          : b
      )
    );
  }

  function handleSelectBlock(blockId) {
    const el = document.getElementById(`block-${blockId}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setSidebarOpen(false);
  }

  function handleAddHeading() {
    setBlocks((prev) => [...prev, newHeadingBlock("")]);
  }

  function handleAddText() {
    setBlocks((prev) => [...prev, newTextBlock("")]);
  }

  function handleAddSpacer(size) {
    setBlocks((prev) => [...prev, newSpacerBlock(size)]);
  }

  const siteLang = settings.siteLang;
  const activeToast = undoStack.length ? undoStack[undoStack.length - 1] : null;

  return (
    <div className="app-shell">
      <Outline
        blocks={blocks}
        settings={settings}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onSelect={handleSelectBlock}
        onReorder={handleReorder}
        onUpdateBlock={handleUpdateSourceBlock}
        onDeleteBlock={handleDeleteBlock}
      />

      <div className="app">
        <header className="app-header">
          <div className="app-header-titles">
            <input
              className="sheet-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Sheet title"
              placeholder={t("sheetTitlePlaceholder", siteLang)}
            />
            <input
              className="sheet-author-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              aria-label="Sheet author"
              placeholder={t("sheetAuthorPlaceholder", siteLang)}
            />
          </div>
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

        <AddBlockControls siteLang={siteLang} onAddHeading={handleAddHeading} onAddText={handleAddText} onAddSpacer={handleAddSpacer} />

        <Sheet
          blocks={blocks}
          settings={settings}
          onRemoveSourceBlock={handleDeleteBlock}
          onMoveBlock={handleMoveBlock}
          onUpdateSourceBlock={handleUpdateSourceBlock}
          onUpdateSimpleBlock={handleUpdateSimpleBlock}
          onDeleteBlock={handleDeleteBlock}
        />
      </div>

      {activeToast ? (
        <div className="undo-toast" role="status">
          <span>{t("undoRemovedToast", siteLang)}</span>
          <button type="button" onClick={() => handleUndo(activeToast.undoId)}>
            {t("undo", siteLang)}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AddBlockControls({ siteLang, onAddHeading, onAddText, onAddSpacer }) {
  return (
    <div className="add-block-controls">
      <button type="button" onClick={onAddHeading}>
        {t("addHeading", siteLang)}
      </button>
      <button type="button" onClick={onAddText}>
        {t("addText", siteLang)}
      </button>
      <span className="add-spacer-group">
        <button type="button" onClick={() => onAddSpacer("S")}>
          {t("addSpacer", siteLang)} (S)
        </button>
        <button type="button" onClick={() => onAddSpacer("M")}>
          {t("addSpacer", siteLang)} (M)
        </button>
        <button type="button" onClick={() => onAddSpacer("L")}>
          {t("addSpacer", siteLang)} (L)
        </button>
      </span>
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
