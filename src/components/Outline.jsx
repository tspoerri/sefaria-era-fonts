import { useState } from "react";
import { t } from "../lib/strings.js";
import { blockLabel } from "../lib/blocks.js";

// Reads a per-source settings-override field, "" meaning "inherit from
// global" (the field is simply absent from the override object).
function overrideValue(source, section, field) {
  const value = source.settingsOverride && source.settingsOverride[section] && source.settingsOverride[section][field];
  return value === undefined || value === null ? "" : String(value);
}

// Writes (or clears, for value === "") a single settings-override field,
// pruning empty section/root objects back down to null so an all-inherited
// source has settingsOverride === null again (matches the "reset" contract).
function withOverride(source, section, field, value, coerceBool) {
  const current = source.settingsOverride || {};
  const sectionObj = { ...(current[section] || {}) };
  if (value === "") {
    delete sectionObj[field];
  } else {
    sectionObj[field] = coerceBool ? value === "true" : value;
  }
  const next = { ...current };
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
  const nikkudOptions = [
    { value: "true", label: t("nikkud", siteLang) + ": on" },
    { value: "false", label: t("nikkud", siteLang) + ": off" },
  ];
  const tanakhModeOptions = [
    { value: "klaf", label: t("modeKlaf", siteLang) },
    { value: "sefer", label: t("modeSefer", siteLang) },
    { value: "simple", label: t("modeSimple", siteLang) },
    { value: "bare", label: t("modeBare", siteLang) },
  ];
  const otherModeOptions = [
    { value: "sefer", label: t("modeSefer", siteLang) },
    { value: "bare", label: t("modeBare", siteLang) },
  ];

  return (
    <div className="outline-settings-panel">
      <p className="outline-settings-heading">{t("titleBarSection", siteLang)}</p>
      <OverrideSelect
        label={t("language", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "titleBar", "language")}
        options={languageOptions}
        onChange={(v) => patch("titleBar", "language", v)}
      />
      <OverrideSelect
        label={t("alignment", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "titleBar", "alignment")}
        options={alignmentOptions}
        onChange={(v) => patch("titleBar", "alignment", v)}
      />
      <OverrideSelect
        label={t("nikkud", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "titleBar", "nikkud")}
        options={nikkudOptions}
        onChange={(v) => patch("titleBar", "nikkud", v, true)}
      />

      <p className="outline-settings-heading">{t("bodySection", siteLang)}</p>
      <OverrideSelect
        label={t("language", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "body", "language")}
        options={languageOptions}
        onChange={(v) => patch("body", "language", v)}
      />
      <OverrideSelect
        label={t("alignment", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "body", "alignment")}
        options={alignmentOptions}
        onChange={(v) => patch("body", "alignment", v)}
      />
      <OverrideSelect
        label={t("tanakhMode", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "body", "modeTanakh")}
        options={tanakhModeOptions}
        onChange={(v) => patch("body", "modeTanakh", v)}
      />
      <OverrideSelect
        label={t("otherMode", siteLang)}
        siteLang={siteLang}
        value={overrideValue(source, "body", "modeOther")}
        options={otherModeOptions}
        onChange={(v) => patch("body", "modeOther", v)}
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
