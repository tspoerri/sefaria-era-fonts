import { useState } from "react";
import { t } from "../lib/strings.js";
import { blockLabel } from "../lib/blocks.js";

// Reads a per-source settings-override field, "" meaning "inherit from
// global" (the field is simply absent from the override object). Pass
// section === null for scalar top-level keys (e.g. fontStyle).
function overrideValue(source, section, field) {
  const holder = section === null
    ? source.settingsOverride
    : source.settingsOverride && source.settingsOverride[section];
  const value = holder && holder[field];
  return value === undefined || value === null ? "" : String(value);
}

// Writes (or clears, for value === "") a single settings-override field,
// pruning empty section/root objects back down to null so an all-inherited
// source has settingsOverride === null again (matches the "reset" contract).
// Pass section === null for scalar top-level keys (e.g. fontStyle).
function withOverride(source, section, field, value, coerceBool) {
  const current = source.settingsOverride || {};
  const next = { ...current };
  if (section === null) {
    if (value === "") {
      delete next[field];
    } else {
      next[field] = coerceBool ? value === "true" : value;
    }
    return Object.keys(next).length === 0 ? null : next;
  }
  const sectionObj = { ...(current[section] || {}) };
  if (value === "") {
    delete sectionObj[field];
  } else {
    sectionObj[field] = coerceBool ? value === "true" : value;
  }
  if (Object.keys(sectionObj).length === 0) {
    delete next[section];
  } else {
    next[section] = sectionObj;
  }
  return Object.keys(next).length === 0 ? null : next;
}

function OverrideSelect({ label, siteLang, value, options, onChange }) {
  return (
    <label className="outline-override-field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("outlineUseGlobal", siteLang)}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SourceSettingsPanel({ source, siteLang, onUpdate }) {
  function patch(section, field, value, coerceBool) {
    onUpdate({ settingsOverride: withOverride(source, section, field, value, coerceBool) });
  }

  const languageOptions = [
    { value: "both", label: t("languageBoth", siteLang) },
    { value: "he", label: t("languageHebrew", siteLang) },
    { value: "en", label: t("languageEnglish", siteLang) },
  ];
  const alignmentOptions = [
    { value: "sides", label: t("alignmentSides", siteLang) },
    { value: "center", label: t("alignmentCenter", siteLang) },
  ];
  const fontStyleOptions = [
    { value: "formal", label: t("fontStyleFormal", siteLang) },
    { value: "casual", label: t("fontStyleCasual", siteLang) },
    { value: "accessible", label: t("fontStyleAccessible", siteLang) },
  ];

  function boolOptions(labelKey) {
    return [
      { value: "true", label: t(labelKey, siteLang) + ": on" },
      { value: "false", label: t(labelKey, siteLang) + ": off" },
    ];
  }

  return (
    <div className="outline-settings-panel">
      <OverrideSelect
        label={t("fontStyle", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, null, "fontStyle")}
        options={fontStyleOptions}
        onChange={(v) => patch(null, "fontStyle", v)}
      />
      <OverrideSelect
        label={t("language", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "body", "language")}
        options={languageOptions}
        onChange={(v) => patch("body", "language", v)}
      />
      <OverrideSelect
        label={t("nikkud", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "toggles", "nikkud")}
        options={boolOptions("nikkud")}
        onChange={(v) => patch("toggles", "nikkud", v, true)}
      />
      <OverrideSelect
        label={t("taamim", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "toggles", "taamim")}
        options={boolOptions("taamim")}
        onChange={(v) => patch("toggles", "taamim", v, true)}
      />
      <OverrideSelect
        label={t("punctuation", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "toggles", "punctuation")}
        options={boolOptions("punctuation")}
        onChange={(v) => patch("toggles", "punctuation", v, true)}
      />
      <OverrideSelect
        label={t("alignment", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "body", "alignment")}
        options={alignmentOptions}
        onChange={(v) => patch("body", "alignment", v)}
      />
      <OverrideSelect
        label={t("verseLineBreaks", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "toggles", "verseLineBreaks")}
        options={boolOptions("verseLineBreaks")}
        onChange={(v) => patch("toggles", "verseLineBreaks", v, true)}
      />
      <OverrideSelect
        label={t("chapterLineBreaks", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "toggles", "chapterLineBreaks")}
        options={boolOptions("chapterLineBreaks")}
        onChange={(v) => patch("toggles", "chapterLineBreaks", v, true)}
      />
      <OverrideSelect
        label={t("chapterVerseNumbers", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "toggles", "showNumbers")}
        options={boolOptions("chapterVerseNumbers")}
        onChange={(v) => patch("toggles", "showNumbers", v, true)}
      />
      <OverrideSelect
        label={t("chapterHeadings", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "toggles", "chapterHeadings")}
        options={boolOptions("chapterHeadings")}
        onChange={(v) => patch("toggles", "chapterHeadings", v, true)}
      />
      <OverrideSelect
        label={t("titleNikkud", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, null, "titleNikkud")}
        options={boolOptions("titleNikkud")}
        onChange={(v) => patch(null, "titleNikkud", v, true)}
      />

      <button
        type="button"
        className="outline-reset-modifications"
        onClick={() => onUpdate({ titleOverride: null, heEdited: null, enEdited: null })}
      >
        {t("outlineResetModifications", siteLang)}
      </button>
    </div>
  );
}

const TYPE_LABEL_KEY = { source: "typeSource", heading: "typeHeading", text: "typeText", spacer: "typeSpacer" };

export default function Outline({
  blocks,
  settings,
  open,
  onToggle,
  onSelect,
  onReorder,
  onUpdateBlock,
  onDeleteBlock,
}) {
  const siteLang = (settings && settings.siteLang) || "en";
  const [expandedId, setExpandedId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { index, position: "before" | "after" }

  function handleDragStart(index, e) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(index));
    } catch {
      // some browsers require this to enable drag; ignore failures
    }
  }

  function handleDragOver(index, e) {
    e.preventDefault();
    if (dragIndex == null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
    setDropTarget({ index, position });
  }

  function handleDrop(e) {
    e.preventDefault();
    if (dragIndex != null && dropTarget) {
      const mapped = dropTarget.index > dragIndex ? dropTarget.index - 1 : dropTarget.index;
      const toIndex = dropTarget.position === "after" ? mapped + 1 : mapped;
      if (toIndex !== dragIndex) onReorder(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDropTarget(null);
  }

  return (
    <>
      <button
        type="button"
        className="outline-hamburger"
        onClick={onToggle}
        aria-label={open ? t("outlineToggleClose", siteLang) : t("outlineToggleOpen", siteLang)}
        aria-expanded={open}
      >
        {"☰"}
      </button>
      {open ? <div className="outline-backdrop" onClick={onToggle} /> : null}
      <aside className={`outline${open ? " is-open" : ""}`} aria-label={t("outlineTitle", siteLang)}>
        <div className="outline-header">
          <span className="outline-title">{t("outlineTitle", siteLang)}</span>
        </div>
        {blocks.length === 0 ? (
          <p className="outline-empty">{t("outlineEmpty", siteLang)}</p>
        ) : (
          <ul className="outline-list" onDrop={handleDrop}>
            {blocks.map((block, index) => {
              const label = blockLabel(block, siteLang) || t(TYPE_LABEL_KEY[block.type] || "typeText", siteLang);
              const isSource = block.type === "source";
              const isExpanded = isSource && expandedId === block.id;
              const showBefore = dropTarget && dropTarget.index === index && dropTarget.position === "before";
              const showAfter = dropTarget && dropTarget.index === index && dropTarget.position === "after";
              return (
                <li
                  key={block.id}
                  className={`outline-row${dragIndex === index ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDragEnd={handleDragEnd}
                >
                  {showBefore ? <div className="outline-drop-indicator" /> : null}
                  <div className="outline-row-main">
                    <span className="outline-drag-handle" title={t("outlineDragHandle", siteLang)} aria-hidden="true">
                      {"⋮⋮"}
                    </span>
                    <button
                      type="button"
                      className={`outline-row-label outline-type-${block.type}`}
                      onClick={() => onSelect(block.id)}
                    >
                      <span className="outline-type-tag">{t(TYPE_LABEL_KEY[block.type], siteLang)}</span>
                      <span className="outline-label-text">{label || "—"}</span>
                    </button>
                    {isSource ? (
                      <button
                        type="button"
                        className="outline-expand"
                        onClick={() => setExpandedId(isExpanded ? null : block.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? t("outlineCollapse", siteLang) : t("outlineExpand", siteLang)}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="outline-row-delete"
                      onClick={() => onDeleteBlock(block.id)}
                      aria-label={t("outlineDelete", siteLang)}
                      title={t("outlineDelete", siteLang)}
                    >
                      {"✕"}
                    </button>
                  </div>
                  {isExpanded ? (
                    <SourceSettingsPanel
                      source={block.source}
                      siteLang={siteLang}
                      onUpdate={(patch) => onUpdateBlock(block.id, patch)}
                    />
                  ) : null}
                  {showAfter ? <div className="outline-drop-indicator" /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </>
  );
}
