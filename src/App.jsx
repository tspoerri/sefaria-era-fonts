import { useEffect, useMemo, useRef, useState } from "react";
import AddSource from "./components/AddSource.jsx";
import ImportSheet from "./components/ImportSheet.jsx";
import Sheet from "./components/Sheet.jsx";
import SettingsMenu from "./components/SettingsMenu.jsx";
import HebrewKeyboard from "./components/HebrewKeyboard.jsx";
import Outline from "./components/Outline.jsx";
import { fetchText, fetchIndex, fetchShape, fetchSheet } from "./api/sefaria.js";
import { classifyEra } from "./lib/era.js";
import { loadSheet, saveSheet, buildSourceFromResponse, isEmptyEnglish } from "./lib/sheetStorage.js";
import { loadSettings, saveSettings, DEFAULTS } from "./lib/settings.js";
import { t } from "./lib/strings.js";
import { estimateSegmentCount, isLargeFetch } from "./lib/fetchGuard.js";
import { parseSheetIdFromInput, mapSheetToBlockDescriptors } from "./lib/sheetImport.js";
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
  const [pendingLargeFetch, setPendingLargeFetch] = useState(null); // {ref, count} | null
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState(null);
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
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

  function closeKeyboard() {
    setKeyboardOpen(false);
    // Closing always reverts hardware typing to normal, regardless of what
    // physical mapping was selected while the popup was open.
    setSettings((prev) =>
      prev.keyboard.physical === "original" ? prev : { ...prev, keyboard: { ...prev.keyboard, physical: "original" } }
    );
  }

  // Resolves and adds a single ref; throws on failure so callers (bulk or
  // single) can decide how to handle it.
  async function addOneSource(ref) {
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
  }

  // Accepts either a single ref (string, unchanged contract) or a bulk
  // pipe-submission (array — see AddSource's `submit`, SPEC.md Wave 1 item
  // 4). Bulk items are resolved/added one at a time, in order; a failure on
  // one item is recorded but does NOT abort the rest, and every failure is
  // surfaced together once the whole batch finishes.
  //
  // SPEC.md Wave 2 item 5 (guard huge fetches): a single-ref submission goes
  // through the size-check/confirm gate below (handleAddSingle) instead of
  // straight to addOneSource. A bulk pipe-submission does NOT — pausing for
  // a confirm dialog per item would turn "paste ten refs" into ten modal
  // interruptions, worse UX than the guard is meant to prevent. Bulk items
  // still fetch fine either way; they just don't get the pre-flight warning.
  async function handleAdd(refOrRefs) {
    const items = Array.isArray(refOrRefs) ? refOrRefs : [refOrRefs];
    if (items.length === 1) {
      await handleAddSingle(items[0]);
      return;
    }
    setBusy(true);
    setError(null);
    const failures = [];
    for (const item of items) {
      try {
        await addOneSource(item);
      } catch (err) {
        const message = err && err.message ? err.message : "Failed to add source.";
        failures.push(`"${item}": ${message}`);
      }
    }
    if (failures.length > 0) {
      setError(failures.join(" | "));
    }
    setBusy(false);
  }

  // Single-ref add path: a cheap /api/shape pre-check (no text content
  // downloaded) estimates the segment count before committing to the full
  // fetchText() call. A large-but-unconfirmed ref surfaces the warning
  // banner and stops here (no fetch yet, no spinner left running) instead
  // of silently pulling the whole thing down or silently refusing to add
  // it. An inconclusive shape check (count === null, e.g. the shape
  // endpoint failed) is NOT treated as large — it just proceeds normally.
  async function handleAddSingle(ref) {
    setBusy(true);
    setError(null);
    setPendingLargeFetch(null);
    try {
      const shape = await fetchShape(ref);
      const count = estimateSegmentCount(shape);
      if (isLargeFetch(count)) {
        setPendingLargeFetch({ ref, count });
        setBusy(false);
        return;
      }
      await addOneSource(ref);
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to add source.");
    }
    setBusy(false);
  }

  // User confirmed a large fetch from the warning banner — proceed with the
  // normal fetch (spinner via `busy`, per SPEC.md Wave 2 item 5).
  async function handleConfirmLargeFetch() {
    if (!pendingLargeFetch) return;
    const ref = pendingLargeFetch.ref;
    setPendingLargeFetch(null);
    setBusy(true);
    setError(null);
    try {
      await addOneSource(ref);
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to add source.");
    }
    setBusy(false);
  }

  function handleCancelLargeFetch() {
    setPendingLargeFetch(null);
  }

  // SPEC.md Wave 2 item 6 — empties the sheet, but only after an explicit
  // confirmation. Reuses the same window.confirm pattern SettingsMenu's
  // "reset all" already uses (resetAllConfirm) rather than building a new
  // modal component.
  function handleClearAll() {
    if (blocks.length === 0) return;
    if (!window.confirm(t("clearAllConfirm", siteLang))) return;
    undoTimers.current.forEach((timerId) => clearTimeout(timerId));
    undoTimers.current.clear();
    setUndoStack([]);
    setBlocks([]);
  }

  // SPEC.md Wave 2 item 7 — import a Sefaria sheet by URL/ID. Source nodes
  // go through the same fetchText/fetchIndex/classifyEra pipeline as a
  // normal add (so imported sources get real era-based fonts, not whatever
  // the sheet's own snapshot text looked like); outsideText/comment/header
  // nodes become text/heading blocks directly. Unsupported nodes were
  // already dropped by mapSheetToBlockDescriptors. Per-source failures are
  // collected and reported together, same resilience pattern as bulk add —
  // one bad ref in an imported sheet shouldn't abort the whole import.
  async function handleImportSheet(rawInput) {
    setImportError(null);
    const id = parseSheetIdFromInput(rawInput);
    if (!id) {
      setImportError(t("importSheetInvalidId", siteLang));
      return;
    }
    setImportBusy(true);
    try {
      const sheetData = await fetchSheet(id);
      const descriptors = mapSheetToBlockDescriptors(sheetData && sheetData.sources);
      if (descriptors.length === 0) {
        setImportError(t("importSheetNoSupportedSources", siteLang));
        setImportBusy(false);
        return;
      }
      const failures = [];
      for (const descriptor of descriptors) {
        if (descriptor.type === "source") {
          try {
            await addOneSource(descriptor.ref);
          } catch (err) {
            const message = err && err.message ? err.message : "Failed to add source.";
            failures.push(`"${descriptor.ref}": ${message}`);
          }
        } else if (descriptor.type === "text") {
          setBlocks((prev) => [...prev, newTextBlock(descriptor.text)]);
        } else if (descriptor.type === "heading") {
          setBlocks((prev) => [...prev, newHeadingBlock(descriptor.text)]);
        }
      }
      if (failures.length > 0) {
        setImportError(failures.join(" | "));
      }
    } catch (err) {
      setImportError(err && err.message ? err.message : "Failed to import sheet.");
    }
    setImportBusy(false);
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
              className="clear-all-button"
              onClick={handleClearAll}
              disabled={blocks.length === 0}
            >
              {t("clearAll", siteLang)}
            </button>
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
              keyboardOpen={keyboardOpen}
              onToggleKeyboard={() => (keyboardOpen ? closeKeyboard() : setKeyboardOpen(true))}
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

        {keyboardOpen ? (
          <HebrewKeyboard settings={settings} onChange={updateSettings} onClose={closeKeyboard} />
        ) : null}

        <AddSource onAdd={handleAdd} busy={busy} error={error} />

        {pendingLargeFetch ? (
          <div className="large-fetch-warning" role="alert">
            <p>{t("largeFetchWarning", siteLang, { count: pendingLargeFetch.count })}</p>
            <div className="large-fetch-warning-actions">
              <button type="button" onClick={handleConfirmLargeFetch}>
                {t("largeFetchConfirm", siteLang)}
              </button>
              <button type="button" onClick={handleCancelLargeFetch}>
                {t("largeFetchCancel", siteLang)}
              </button>
            </div>
          </div>
        ) : null}

        <ImportSheet onImport={handleImportSheet} busy={importBusy} error={importError} siteLang={siteLang} />

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

function IconCluster({
  settings,
  onUpdateSettings,
  settingsOpen,
  onToggleSettings,
  keyboardOpen,
  onToggleKeyboard,
}) {
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
        onClick={onToggleKeyboard}
        aria-label={t("keyboardTitle", siteLang)}
        aria-expanded={keyboardOpen}
        title={t("keyboardTitle", siteLang)}
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
