import { useEffect, useState } from "react";
import AddSource from "./components/AddSource.jsx";
import Sheet from "./components/Sheet.jsx";
import { fetchText, fetchIndex } from "./api/sefaria.js";
import { classifyEra } from "./lib/era.js";

const STORAGE_KEY = "sefaria-era-fonts-sheet";

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { title: "Untitled Sheet", sources: [] };
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || "Untitled Sheet",
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    return { title: "Untitled Sheet", sources: [] };
  }
}

export default function App() {
  const initial = loadInitial();
  const [title, setTitle] = useState(initial.title);
  const [sources, setSources] = useState(initial.sources);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, sources }));
    } catch {
      // localStorage may be unavailable (private browsing, quota) — ignore.
    }
  }, [title, sources]);

  async function handleAdd(ref) {
    setBusy(true);
    setError(null);
    try {
      const resp = await fetchText(ref);
      let index = null;
      try {
        index = await fetchIndex(resp.indexTitle);
      } catch {
        index = null;
      }
      const { era, unclassified } = classifyEra(resp, index);
      const newSource = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ref: resp.ref,
        heRef: resp.heRef,
        he: resp.he,
        text: resp.text,
        era,
        unclassified: !!unclassified,
      };
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

  return (
    <div className="app">
      <header className="app-header">
        <input
          className="sheet-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Sheet title"
        />
        <button
          type="button"
          className="print-button"
          onClick={() => window.print()}
        >
          Print / Export
        </button>
      </header>

      <AddSource onAdd={handleAdd} busy={busy} error={error} />

      <Sheet sources={sources} onRemove={handleRemove} onMove={handleMove} />
    </div>
  );
}
