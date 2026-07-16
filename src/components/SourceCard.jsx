import { ERA_FONTS } from "../lib/fonts.js";
import { layoutSegments, stripNikkud } from "../lib/display.js";
import { resolveSettings } from "../lib/settings.js";
import { t } from "../lib/strings.js";

// Minimal sanitizer: strips <script>/<style> tags entirely, removes any
// on* event-handler attributes, and drops Sefaria's footnote markup
// (<sup> markers and <i class="footnote">...</i> spans) so the reading
// text isn't cluttered with citation apparatus.
function sanitizeHtml(html) {
  if (!html) return "";
  let out = html;

  out = out.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "");
  out = out.replace(
    /<i[^>]*\bclass=["'][^"']*footnote[^"']*["'][^>]*>[\s\S]*?<\/i>/gi,
    ""
  );
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return out;
}

function sanitizeArray(arr) {
  return (arr || []).map(sanitizeHtml);
}

function numClass(numStyle) {
  if (numStyle === "small-faint") return "seg-num seg-num-faint";
  if (numStyle === "regular") return "seg-num";
  if (numStyle === "faint-marker") return "seg-marker";
  return "";
}

function HebrewBlocks({ blocks, fontFamily }) {
  return (
    <div className="source-hebrew" dir="rtl" style={{ fontFamily }}>
      {blocks.map((block, bi) => {
        if (block.type === "perekHeading") {
          return (
            <div className="perek-heading" key={bi}>
              {block.heText}
            </div>
          );
        }
        if (block.type === "line") {
          const seg = block.segments[0];
          return (
            <p className="segment-line" key={bi}>
              {seg.num != null ? <sup className={numClass(seg.numStyle)}>{seg.num}</sup> : null}
              <span dangerouslySetInnerHTML={{ __html: seg.he }} />
            </p>
          );
        }
        // flow
        return (
          <div className="segment-flow" key={bi}>
            {block.segments.map((seg, si) => {
              if (seg.isGap) {
                return <span className="setumah-gap" key={si} />;
              }
              if (seg.isMarker) {
                return (
                  <span className="seg-marker" key={si}>
                    {" "}
                    {seg.he}{" "}
                  </span>
                );
              }
              return (
                <span key={si}>
                  {seg.num != null ? (
                    <sup className={numClass(seg.numStyle)}>{seg.num}</sup>
                  ) : null}
                  <span dangerouslySetInnerHTML={{ __html: seg.he }} />{" "}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function EnglishBlocks({ blocks }) {
  return (
    <div className="source-english" dir="ltr">
      {blocks.map((block, bi) => {
        if (block.type === "perekHeading") {
          return (
            <div className="perek-heading" key={bi}>
              {block.enText}
            </div>
          );
        }
        if (block.type === "line") {
          const seg = block.segments[0];
          if (!seg.en) return null;
          return (
            <p className="segment-line" key={bi}>
              {seg.num != null ? <sup className={numClass(seg.numStyle)}>{seg.num}</sup> : null}
              <span dangerouslySetInnerHTML={{ __html: seg.en }} />
            </p>
          );
        }
        const nonEmpty = block.segments.filter((s) => s.en);
        if (!nonEmpty.length) return null;
        return (
          <div className="segment-flow" key={bi}>
            {nonEmpty.map((seg, si) => (
              <span key={si}>
                {seg.num != null ? (
                  <sup className={numClass(seg.numStyle)}>{seg.num}</sup>
                ) : null}
                <span dangerouslySetInnerHTML={{ __html: seg.en }} />{" "}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function SourceCard({
  source,
  settings,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
}) {
  const { era, error } = source;
  const fontEntry = ERA_FONTS[era] || ERA_FONTS.contemporary;
  const effective = resolveSettings(settings, source.settingsOverride);
  const siteLang = (settings && settings.siteLang) || "en";

  const hasHe = (source.heSegments || []).some((s) => s && s.trim());
  const hasEn = (source.enSegments || source.enEdited || []).some((s) => s && s.trim());

  let titleLang = effective.titleBar.language;
  if (!hasHe && titleLang !== "en") titleLang = hasEn ? "en" : titleLang;
  if (!hasEn && titleLang === "en") titleLang = "he";

  let bodyLang = effective.body.language;
  if (!hasHe && bodyLang !== "en") bodyLang = hasEn ? "en" : bodyLang;
  if (!hasEn && bodyLang === "en") bodyLang = "he";

  const titleEn = source.titleOverride ? source.titleOverride.en : source.ref;
  let titleHe = source.titleOverride ? source.titleOverride.he : source.heRef;
  if (!effective.titleBar.nikkud) titleHe = stripNikkud(titleHe || "");

  const mode = source.isTanakh ? effective.body.modeTanakh : effective.body.modeOther;
  const sanitizedSource = {
    ...source,
    heSegments: sanitizeArray(source.heEdited || source.heSegments),
    enSegments: sanitizeArray(source.enEdited || source.enSegments),
    heEdited: null,
    enEdited: null,
  };
  const blocks = error ? [] : layoutSegments(sanitizedSource, mode);

  const attributionAuthor =
    siteLang === "he" ? source.authorHe || source.authorEn : source.authorEn || source.authorHe;
  const attributionParts = [attributionAuthor, source.compDateDisplay].filter(Boolean);
  const attributionText = attributionParts.join(" · ");

  return (
    <div className="source-card">
      <div className="source-card-header">
        <div className={`source-card-ref source-card-ref-${effective.titleBar.alignment}`}>
          {titleLang !== "he" ? <span className="source-card-ref-en">{titleEn}</span> : null}
          {titleLang !== "en" ? (
            <span className="source-card-ref-he" dir="rtl">
              {titleHe}
            </span>
          ) : null}
        </div>
        {effective.showAttribution && attributionText ? (
          <span className="source-attribution-tag">{attributionText}</span>
        ) : null}
        <div className="source-card-controls">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={t("moveUp", siteLang)}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={t("moveDown", siteLang)}
          >
            ↓
          </button>
          <button
            type="button"
            className="source-card-remove"
            onClick={onRemove}
            aria-label={t("remove", siteLang)}
          >
            ✕
          </button>
        </div>
      </div>

      {error ? (
        <p className="source-card-error">{error}</p>
      ) : (
        <div className={`source-card-body source-card-body-${effective.body.alignment}`}>
          {bodyLang !== "he" ? <EnglishBlocks blocks={blocks} /> : null}
          {bodyLang !== "en" ? (
            <HebrewBlocks blocks={blocks} fontFamily={fontEntry.family} />
          ) : null}
        </div>
      )}
    </div>
  );
}
