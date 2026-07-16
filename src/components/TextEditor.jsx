import { useState } from "react";
import {
  tokenizeSegments,
  rebuildSegments,
  allowedOps,
  canTrim,
  applyOp,
} from "../lib/edits.js";
import { t } from "../lib/strings.js";

// A structured word-token editor for one language column of a source's
// text (SPEC.md Wave B, item 2). NOT contenteditable — words are discrete
// clickable tokens; a contiguous range is selected (click, shift-click, or
// drag) and one of a small set of ops (trim/elide/bracket[/substitute for
// English]) is applied to it via src/lib/edits.js's pure op logic. Renders
// its own toolbar + inline "type replacement text" affordance for
// bracket/substitute.
function WordColumn({ lang, tokens, onChangeTokens, siteLang }) {
  const [sel, setSel] = useState(null); // { anchor, focus } indices into tokens
  const [dragging, setDragging] = useState(false);
  const [pendingOp, setPendingOp] = useState(null); // "bracket" | "substitute" | null
  const [pendingText, setPendingText] = useState("");
  const [notice, setNotice] = useState(null);

  const ops = allowedOps(lang);
  const hasSel = sel != null;
  const start = hasSel ? Math.min(sel.anchor, sel.focus) : -1;
  const end = hasSel ? Math.max(sel.anchor, sel.focus) : -1;
  const trimOk = hasSel && canTrim(tokens, start, end);

  function clearTransient() {
    setPendingOp(null);
    setPendingText("");
  }

  function handleMouseDown(index, e) {
    e.preventDefault();
    setDragging(true);
    setNotice(null);
    clearTransient();
    if (e.shiftKey && hasSel) {
      setSel({ anchor: sel.anchor, focus: index });
    } else {
      setSel({ anchor: index, focus: index });
    }
  }

  function handleMouseEnter(index) {
    if (!dragging || !hasSel) return;
    setSel((prev) => (prev ? { anchor: prev.anchor, focus: index } : prev));
  }

  function endDrag() {
    setDragging(false);
  }

  function errorMessage(code) {
    if (code === "trim-not-at-edge") return t("errorTrimNotAtEdge", siteLang);
    if (code === "zero-words") return t("errorZeroWords", siteLang);
    if (code === "empty-text") return t("errorEmptyText", siteLang);
    return t("errorInvalidRange", siteLang);
  }

  function commit(opType, text) {
    if (!hasSel) return;
    const result = applyOp(tokens, start, end, { type: opType, text });
    if (!result.ok) {
      setNotice(errorMessage(result.error));
      return;
    }
    setNotice(null);
    setSel(null);
    clearTransient();
    onChangeTokens(result.tokens);
  }

  function handleOpClick(opType) {
    setNotice(null);
    if (opType === "bracket" || opType === "substitute") {
      setPendingOp(opType);
      setPendingText("");
      return;
    }
    commit(opType, null);
  }

  function confirmPending() {
    commit(pendingOp, pendingText);
  }

  return (
    <div className="text-editor-column" dir={lang === "he" ? "rtl" : "ltr"}>
      <div
        className="text-editor-words"
        onMouseUp={endDrag}
        onMouseLeave={dragging ? endDrag : undefined}
      >
        {tokens.length === 0 ? <span className="text-editor-empty">—</span> : null}
        {tokens.map((tok, i) => {
          const selected = hasSel && i >= start && i <= end;
          return (
            <span
              key={i}
              className={`text-editor-word${selected ? " is-selected" : ""}`}
              onMouseDown={(e) => handleMouseDown(i, e)}
              onMouseEnter={() => handleMouseEnter(i)}
            >
              {tok.text}
            </span>
          );
        })}
      </div>

      <div className="text-editor-toolbar">
        {ops.map((opType) => (
          <button
            key={opType}
            type="button"
            disabled={!hasSel || (opType === "trim" && !trimOk)}
            onClick={() => handleOpClick(opType)}
          >
            {t(`op${opType.charAt(0).toUpperCase()}${opType.slice(1)}`, siteLang)}
          </button>
        ))}
      </div>

      {pendingOp ? (
        <div className="text-editor-pending">
          <input
            type="text"
            value={pendingText}
            placeholder={t("opTextPlaceholder", siteLang)}
            onChange={(e) => setPendingText(e.target.value)}
            autoFocus
          />
          <button type="button" onClick={confirmPending}>
            {t("opConfirm", siteLang)}
          </button>
          <button type="button" onClick={clearTransient}>
            {t("opCancel", siteLang)}
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="text-editor-notice" role="alert">
          {notice}
        </p>
      ) : (
        <p className="text-editor-hint">
          {hasSel ? "" : t("selectWordsHint", siteLang)}
        </p>
      )}
    </div>
  );
}

// Thin shell over src/lib/edits.js. Owns working-copy state (tokenized
// from heEdited/heSegments and enEdited/enSegments — always the text WITH
// nikkud/taamim as stored; display-mode strips are downstream in
// layoutSegments and don't affect editing) and Save/Cancel wiring.
export default function TextEditor({ source, siteLang, onSave, onCancel }) {
  const heOriginal = source.heEdited || source.heSegments || [];
  const enOriginal = source.enEdited || source.enSegments || [];
  const hasEn = enOriginal.some((s) => s && String(s).trim());

  const [heTokens, setHeTokens] = useState(() => tokenizeSegments(heOriginal));
  const [enTokens, setEnTokens] = useState(() => tokenizeSegments(enOriginal));

  function handleSave() {
    const heEdited = rebuildSegments(heTokens, source.heSegments.length);
    const enEdited = hasEn ? rebuildSegments(enTokens, source.enSegments.length) : source.enEdited;
    onSave({ heEdited, enEdited });
  }

  return (
    <div className="text-editor">
      <WordColumn lang="he" tokens={heTokens} onChangeTokens={setHeTokens} siteLang={siteLang} />
      {hasEn ? (
        <WordColumn lang="en" tokens={enTokens} onChangeTokens={setEnTokens} siteLang={siteLang} />
      ) : null}
      <div className="text-editor-actions">
        <button type="button" className="text-editor-save" onClick={handleSave}>
          {t("save", siteLang)}
        </button>
        <button type="button" className="text-editor-cancel" onClick={onCancel}>
          {t("cancel", siteLang)}
        </button>
      </div>
    </div>
  );
}
