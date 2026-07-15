import { useEffect, useRef, useState } from "react";
import { fetchNameSuggestionsRobust } from "../api/sefaria.js";
import { normalizeSourceInput, splitTitleAndAddress } from "../lib/inputNormalize.js";

const DEBOUNCE_MS = 200;

export default function AddSource({ onAdd, busy, error }) {
  const [ref, setRef] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pendingAddress, setPendingAddress] = useState("");

  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function scheduleSuggestions(value) {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const normalized = normalizeSourceInput(value);
    const { title, address } = splitTitleAndAddress(normalized);
    if (title.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const results = await fetchNameSuggestionsRobust(title, {
          signal: controller.signal,
          rawQuery: value,
        });
        setPendingAddress(address);
        setSuggestions(results);
        setOpen(results.length > 0);
        setHighlight(-1);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, DEBOUNCE_MS);
  }

  function handleChange(e) {
    const value = e.target.value;
    setRef(value);
    scheduleSuggestions(value);
  }

  function selectSuggestion(suggestion) {
    setRef(suggestion.title + pendingAddress);
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
  }

  function submit(value) {
    const cleaned = normalizeSourceInput(value);
    if (!cleaned || busy) return;
    onAdd(cleaned);
    setRef("");
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (open && highlight >= 0 && suggestions[highlight]) {
      submit(suggestions[highlight].title);
      return;
    }
    submit(ref);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlight(-1);
    } else if (e.key === "Tab" && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      selectSuggestion(suggestions[highlight]);
    }
  }

  return (
    <div className="add-source" ref={containerRef}>
      <form className="add-source-row" onSubmit={handleSubmit} autoComplete="off">
        <div className="add-source-combobox">
          <input
            type="text"
            value={ref}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Genesis 1:1 · Brachot 2a · Rashi al Bereshit · בראשית א:א · a pasted Sefaria link"
            disabled={busy}
            aria-label="Source reference"
            aria-autocomplete="list"
            aria-expanded={open}
            role="combobox"
          />
          {open && suggestions.length > 0 ? (
            <ul className="add-source-suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={s.title}
                  role="option"
                  aria-selected={i === highlight}
                  className={i === highlight ? "is-highlighted" : ""}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  {s.title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="submit" disabled={busy || !ref.trim()}>
          {busy ? <span className="spinner" aria-hidden="true" /> : "Add"}
        </button>
      </form>
      {error ? (
        <p className="add-source-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
