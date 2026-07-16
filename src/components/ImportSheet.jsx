import { useState } from "react";
import { t } from "../lib/strings.js";

// SPEC.md Wave 2 item 7 -- a small "paste a Sefaria sheet URL/ID" form,
// deliberately separate from AddSource (different shape of input, no
// suggestions dropdown, its own busy/error state in App.jsx) so neither gets
// harder to read carrying the other's concerns.
export default function ImportSheet({ onImport, busy, error, siteLang }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    onImport(value.trim());
    setValue("");
  }

  return (
    <div className="import-sheet">
      <form className="import-sheet-row" onSubmit={handleSubmit} autoComplete="off">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("importSheetPlaceholder", siteLang)}
          disabled={busy}
          aria-label={t("importSheetPlaceholder", siteLang)}
        />
        <button type="submit" disabled={busy || !value.trim()}>
          {busy ? <span className="spinner" aria-hidden="true" /> : t("importSheetButton", siteLang)}
        </button>
      </form>
      {error ? (
        <p className="import-sheet-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
