import { useEffect, useRef, useState } from "react";
import { t } from "../lib/strings.js";
import { getLayoutRows, getLayoutDir, mapPhysicalKey } from "../lib/keyboardLayouts.js";

// Text fields the popup is allowed to type into: the sheet title/author
// inputs, the AddSource combobox, heading/text block inputs, and the
// title/text editors — all plain <input type="text"> or <textarea>, so a
// single selector covers every current and future text field without
// per-component wiring. Fields inside the keyboard popup itself (the
// layout/physical <select>s) are excluded via the `closest` check below.
const TARGET_SELECTOR = 'input[type="text"], input:not([type]), textarea';

function isTrackable(el) {
  if (!el || !el.matches) return false;
  if (el.disabled || el.readOnly) return false;
  if (!el.matches(TARGET_SELECTOR)) return false;
  if (el.closest && el.closest(".hebrew-keyboard")) return false;
  return true;
}

// Module-scope (not component-scope) focus tracker: it starts listening the
// moment this module is imported — i.e. before the popup ever mounts — so
// the last text field the user focused is still known even though clicking
// the ⌨ toggle button itself steals focus away from that field an instant
// before the popup (and any component-local listener) exists.
let lastTrackedTarget = null;
if (typeof document !== "undefined") {
  document.addEventListener("focusin", (e) => {
    if (isTrackable(e.target)) lastTrackedTarget = e.target;
  });
}

// Sets a text input/textarea's value via its native setter (bypassing
// React's tracked-value interception) and dispatches a real "input" event
// so the owning component's onChange still fires and React state updates.
function nativeValueSetter(el) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, "value").set;
}

function insertAtCaret(el, text) {
  const start = el.selectionStart != null ? el.selectionStart : el.value.length;
  const end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
  const nextValue = el.value.slice(0, start) + text + el.value.slice(end);
  nativeValueSetter(el).call(el, nextValue);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = start + text.length;
  el.focus();
  el.setSelectionRange(caret, caret);
}

function backspaceAtCaret(el) {
  const start = el.selectionStart != null ? el.selectionStart : el.value.length;
  const end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
  let from = start;
  let to = end;
  if (start === end) {
    if (start === 0) return;
    from = start - 1;
  }
  const nextValue = el.value.slice(0, from) + el.value.slice(to);
  nativeValueSetter(el).call(el, nextValue);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  el.setSelectionRange(from, from);
}

export default function HebrewKeyboard({ settings, onChange, onClose }) {
  const siteLang = settings.siteLang;
  const keyboard = settings.keyboard;
  const panelRef = useRef(null);
  const targetRef = useRef(lastTrackedTarget);
  // Mirrors targetRef into render state, purely so the "click into a text
  // field" hint updates live as focus moves around while the popup is open.
  const [, bumpTick] = useState(0);

  useEffect(() => {
    function handleFocusIn(e) {
      if (isTrackable(e.target)) {
        targetRef.current = e.target;
        bumpTick((n) => n + 1);
      }
    }
    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Physical hardware remap — capture-phase so it runs before the field's
  // own keydown handling, active only while this popup is mounted (i.e.
  // open) and only when a non-"original" physical mode is selected.
  // Unmounting/closing the popup always removes this listener, which is
  // exactly the "always reverts on close" behavior SPEC.md asks for.
  useEffect(() => {
    if (keyboard.physical === "original") return undefined;
    function handlePhysicalKeydown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!isTrackable(e.target)) return;
      const mapped = mapPhysicalKey(keyboard.physical, e.key, e.shiftKey);
      if (!mapped) return;
      e.preventDefault();
      insertAtCaret(e.target, mapped);
      targetRef.current = e.target;
    }
    document.addEventListener("keydown", handlePhysicalKeydown, true);
    return () => document.removeEventListener("keydown", handlePhysicalKeydown, true);
  }, [keyboard.physical]);

  function withTarget(fn) {
    const el = targetRef.current;
    if (!el || !document.contains(el)) return;
    fn(el);
  }

  function handleKeyClick(key, e) {
    const char = e.shiftKey && key.shiftChar ? key.shiftChar : key.char;
    withTarget((el) => insertAtCaret(el, char));
  }

  function handleBackspace() {
    withTarget((el) => backspaceAtCaret(el));
  }

  function handleSpace() {
    withTarget((el) => insertAtCaret(el, " "));
  }

  function guardMouseDown(e) {
    // Keep focus (and caret) on the tracked target instead of the button.
    e.preventDefault();
  }

  const rows = getLayoutRows(keyboard.layout);
  const hasTarget = !!(targetRef.current && document.contains(targetRef.current));

  return (
    <div
      className="hebrew-keyboard"
      ref={panelRef}
      role="dialog"
      aria-label={t("keyboardTitle", siteLang)}
    >
      <div className="hebrew-keyboard-header">
        <strong>{t("keyboardTitle", siteLang)}</strong>
        <button
          type="button"
          className="hebrew-keyboard-close"
          onMouseDown={guardMouseDown}
          onClick={onClose}
          aria-label={t("keyboardClose", siteLang)}
        >
          ✕
        </button>
      </div>

      <div className="hebrew-keyboard-settings">
        <label>
          {t("keyboardLayout", siteLang)}
          <select
            value={keyboard.layout}
            onChange={(e) => onChange({ keyboard: { ...keyboard, layout: e.target.value } })}
          >
            <option value="alephbet">{t("keyboardLayoutAlephbet", siteLang)}</option>
            <option value="israeli">{t("keyboardLayoutIsraeli", siteLang)}</option>
            <option value="qwerty">{t("keyboardLayoutQwerty", siteLang)}</option>
          </select>
        </label>
        <label>
          {t("keyboardPhysical", siteLang)}
          <select
            value={keyboard.physical}
            onChange={(e) => onChange({ keyboard: { ...keyboard, physical: e.target.value } })}
          >
            <option value="original">{t("keyboardPhysicalOriginal", siteLang)}</option>
            <option value="israeli">{t("keyboardPhysicalIsraeli", siteLang)}</option>
            <option value="qwerty">{t("keyboardPhysicalQwerty", siteLang)}</option>
          </select>
        </label>
      </div>

      {keyboard.layout === "qwerty" || keyboard.physical === "qwerty" ? (
        <p className="hebrew-keyboard-note">{t("keyboardShiftFinalsNote", siteLang)}</p>
      ) : null}

      {!hasTarget ? <p className="hebrew-keyboard-note">{t("keyboardNoTarget", siteLang)}</p> : null}

      <div className="hebrew-keyboard-grid" dir={getLayoutDir(keyboard.layout)}>
        {rows.map((row, i) => (
          <div className="hebrew-keyboard-row" key={i}>
            {row.map((key) => (
              <button
                key={key.key}
                type="button"
                className="hebrew-keyboard-key"
                onMouseDown={guardMouseDown}
                onClick={(e) => handleKeyClick(key, e)}
                title={key.shiftChar ? `${key.char} / ⇧ ${key.shiftChar}` : key.char}
              >
                {key.char}
              </button>
            ))}
          </div>
        ))}
        <div className="hebrew-keyboard-row hebrew-keyboard-row-controls">
          <button
            type="button"
            className="hebrew-keyboard-key hebrew-keyboard-key-wide"
            onMouseDown={guardMouseDown}
            onClick={handleSpace}
          >
            {t("keyboardSpace", siteLang)}
          </button>
          <button
            type="button"
            className="hebrew-keyboard-key hebrew-keyboard-key-wide"
            onMouseDown={guardMouseDown}
            onClick={handleBackspace}
          >
            {"⌫ " + t("keyboardBackspace", siteLang)}
          </button>
        </div>
      </div>
    </div>
  );
}
