import { ERA_LABELS } from "../lib/era.js";
import { ERA_FONTS, FLAG_DESCRIPTIONS } from "../lib/fonts.js";

// Sefaria's `he`/`text` fields may be a plain string, an array of strings
// (verse ranges), or a nested array of arrays (e.g. a range spanning
// multiple chapters). Flatten everything down to a single joined string.
function flattenText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(flattenText).filter(Boolean).join(" ");
  }
  return String(value);
}

// Minimal sanitizer: strips <script>/<style> tags entirely, removes any
// on* event-handler attributes, and drops Sefaria's footnote markup
// (<sup> markers and <i class="footnote">...</i> spans) so the reading
// text isn't cluttered with citation apparatus.
function sanitizeHtml(html) {
  if (!html) return "";
  let out = html;

  // Remove script/style tags and their contents.
  out = out.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // Remove footnote markers and footnote-class italics.
  out = out.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "");
  out = out.replace(
    /<i[^>]*\bclass=["'][^"']*footnote[^"']*["'][^>]*>[\s\S]*?<\/i>/gi,
    ""
  );

  // Strip on* event-handler attributes (onclick=, onerror=, etc).
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return out;
}

export default function SourceCard({
  source,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
}) {
  const { ref, heRef, he, text, era, unclassified, error } = source;
  const fontEntry = ERA_FONTS[era] || ERA_FONTS.contemporary;
  const eraLabel = ERA_LABELS[era] || era;
  const flagDescription =
    fontEntry && fontEntry.flag ? FLAG_DESCRIPTIONS[fontEntry.flag] : null;

  const heHtml = sanitizeHtml(flattenText(he));
  const enHtml = sanitizeHtml(flattenText(text));

  return (
    <div className="source-card">
      <div className="source-card-header">
        <div className="source-card-ref">
          <span className="source-card-ref-en">{ref}</span>
          {heRef ? <span className="source-card-ref-he">{heRef}</span> : null}
        </div>
        <div className="source-card-meta">
          <span className="era-badge">
            {eraLabel}
            {unclassified ? " (unclassified)" : ""}
          </span>
          <span className="font-caption">
            {fontEntry.family}
            {flagDescription ? (
              <span
                className="flag-note"
                title={flagDescription}
                aria-label={flagDescription}
              >
                {" "}
                &#9888;
              </span>
            ) : null}
          </span>
        </div>
        <div className="source-card-controls">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move down"
          >
            ↓
          </button>
          <button type="button" onClick={onRemove} aria-label="Remove">
            ✕
          </button>
        </div>
      </div>

      {error ? (
        <p className="source-card-error">{error}</p>
      ) : (
        <div className="source-card-body">
          {heHtml ? (
            <div
              className="source-hebrew"
              dir="rtl"
              style={{ fontFamily: fontEntry.family }}
              dangerouslySetInnerHTML={{ __html: heHtml }}
            />
          ) : null}
          {enHtml ? (
            <p
              className="source-english"
              dir="ltr"
              dangerouslySetInnerHTML={{ __html: enHtml }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
