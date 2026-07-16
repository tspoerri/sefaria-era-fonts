import { useEffect, useRef, useState } from "react";
import { searchTitles, resolveSelection, offlineSearch } from "../lib/nameSearch.js";
import { normalizeSourceInput, splitTitleAndAddress, splitBulkRefs } from "../lib/inputNormalize.js";
import { detectDir } from "../lib/textDir.js";

// Fallback/API paths (Hebrew live fallback, Latin 0-hit/lexicon-loading
// fallback) are debounced so a fast typist doesn't fan out a request per
// keystroke; offline lexicon matching (see nameSearch.offlineSearch) needs
// no network and runs synchronously on every keystroke instead — when it
// already has a confident answer, the debounced call below is skipped
// entirely, so zero requests go out while typing a known Latin title.
const DEBOUNCE_MS = 250;

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

  // The debounced/authoritative path: Hebrew (always live), or Latin when
  // offline matching couldn't give a confident synchronous answer (lexicon
  // still loading, or a genuine zero-hit that needs Sefaria's own fuzzy
  // fallback). At most one request fires per debounce window.
  function scheduleSuggestions(normalized, rawValue) {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const results = await searchTitles(normalized, {
          signal: controller.signal,
          rawQuery: rawValue,
        });
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

    const normalized = normalizeSourceInput(value);
    const { title, address } = splitTitleAndAddress(normalized);
    setPendingAddress(address);

    if (title.trim().length < 2) {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // Synchronous, network-free lexicon lookup, tried on every keystroke.
    // Returns null when it can't answer offline (Hebrew text, or the
    // lexicon asset hasn't finished loading yet) — only then do we fall
    // back to the debounced live path.
    const immediate = offlineSearch(normalized);
    if (immediate !== null) {
      setSuggestions(immediate);
      setOpen(immediate.length > 0);
      setHighlight(-1);
      if (immediate.length > 0) {
        // Confident offline answer already in hand — no need for a live
        // fallback call this keystroke.
        clearTimeout(debounceRef.current);
        abortRef.current?.abort();
        return;
      }
    }

    scheduleSuggestions(normalized, value);
  }

  // The only network call in the Latin happy path: resolves the picked
  // suggestion (+ any pending address) to Sefaria's canonical ref. A bare
  // parsha suggestion (SPEC.md Wave 1 item 1) carries its own resolved
  // `address` (the book range) rather than relying on whatever address the
  // user actually typed, so that takes precedence when present.
  async function selectSuggestion(suggestion) {
    setOpen(false);
    setHighlight(-1);
    setSuggestions([]);
    const address = suggestion.address !== undefined ? suggestion.address : pendingAddress;
    const resolved = await resolveSelection(suggestion.title, address);
    setRef(resolved);
  }

  // Handles both a single resolved ref and a bulk pipe-separated submission
  // ("Genesis 1:1 | Rashi on Genesis 1:1 | ברכות יב.", SPEC.md Wave 1 item
  // 4) — each piece is split off the RAW value and normalized
  // independently, so a trailing address on one item can never bleed into
  // the next item's title. `onAdd` is called with a plain string for a
  // single item (unchanged contract) or an array for a bulk submission.
  function submit(value) {
    if (!value || busy) return;
    const items = splitBulkRefs(value);
    if (items.length > 1) {
      const normalizedItems = items.map((item) => normalizeSourceInput(item)).filter(Boolean);
      if (normalizedItems.length === 0) return;
      onAdd(normalizedItems);
    } else {
      const cleaned = normalizeSourceInput(value);
      if (!cleaned) return;
      onAdd(cleaned);
    }
    setRef("");
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (open && suggestions.length > 0) {
      // Enter picks whichever suggestion is highlighted, defaulting to the
      // top one so pressing Enter on the first match doesn't force the user
      // to arrow-down to it first.
      const picked = suggestions[highlight >= 0 ? highlight : 0];
      setOpen(false);
      setHighlight(-1);
      setSuggestions([]);
      const address = picked.address !== undefined ? picked.address : pendingAddress;
      const resolved = await resolveSelection(picked.title, address);
      submit(resolved);
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
            dir={detectDir(ref) || undefined}
          />
          {open && suggestions.length > 0 ? (
            <ul className="add-source-suggestions" role="listbox">
              {suggestions.map((s, i) => {
                // Suggestions with their own resolved `address` (e.g. a
                // bare parsha match) already bake it into `display`; for
                // everything else, append whatever address the user typed
                // so they can see it was parsed correctly (SPEC.md Wave 1
                // item 2), e.g. "Genesis" + " 1:1" -> "Genesis 1:1".
                const addressSuffix = s.address === undefined && pendingAddress ? pendingAddress.trim() : "";
                return (
                  <li
                    key={s.key ?? s.title}
                    role="option"
                    aria-selected={i === highlight}
                    className={i === highlight ? "is-highlighted" : ""}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(s);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    {s.display ?? s.title}
                    {addressSuffix ? ` ${addressSuffix}` : ""}
                  </li>
                );
              })}
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
