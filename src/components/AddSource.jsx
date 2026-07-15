import { useState } from "react";

export default function AddSource({ onAdd, busy, error }) {
  const [ref, setRef] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = ref.trim();
    if (!trimmed || busy) return;
    onAdd(trimmed);
    setRef("");
  }

  return (
    <form className="add-source" onSubmit={handleSubmit}>
      <div className="add-source-row">
        <input
          type="text"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Genesis 1:1 · Mishnah Berakhot 1:1 · Rashi on Genesis 1:1 · Shulchan Arukh, Orach Chayim 1:1"
          disabled={busy}
          aria-label="Source reference"
        />
        <button type="submit" disabled={busy || !ref.trim()}>
          {busy ? <span className="spinner" aria-hidden="true" /> : "Add"}
        </button>
      </div>
      {error ? (
        <p className="add-source-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
