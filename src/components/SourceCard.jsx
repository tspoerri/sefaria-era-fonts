import { useState } from "react";
import { getEraFont } from "../lib/fonts.js";
import { layoutSegments, stripNikkud, stripTaamim } from "../lib/display.js";
import { resolveSettings } from "../lib/settings.js";
import { t } from "../lib/strings.js";
import TextEditor from "./TextEditor.jsx";

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

// Fonts without nikkud/taamim glyphs (fontEntry.nikkud/taamim === "none",
// from the cmap scans recorded in src/lib/fonts.js) would render Sefaria's
// pointed text as tofu boxes — strip whatever marks the active face can't
// draw before handing blocks to HebrewBlocks. "partial" coverage is left
// alone (mostly-complete faces degrade gracefully).
function stripUnsupportedMarks(blocks, fontEntry) {
  const dropNikkud = fontEntry.nikkud === "none";
  const dropTaamim = dropNikkud || fontEntry.taamim === "none";
  if (!dropTaamim) return blocks;
  const clean = (s) => {
    if (!s) return s;
    let out = stripTaamim(s);
    if (dropNikkud) out = stripNikkud(out);
    return out;
  };
  return blocks.map((block) => {
    if (block.type === "perekHeading") return { ...block, heText: clean(block.heText) };
    if (!block.segments) return block;
    return { ...block, segments: block.segments.map((seg) => ({ ...seg, he: clean(seg.he) })) };
  });
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

function TitleEditor({ source, siteLang, onUpdate, onClose }) {
  const originalEn = source.ref || "";
  const originalHe = source.heRef || "";
  const overrideEn = source.titleOverride && source.titleOverride.en != null ? source.titleOverride.en : null;
  const overrideHe = source.titleOverride && source.titleOverride.he != null ? source.titleOverride.he : null;
  const [enDraft, setEnDraft] = useState(overrideEn != null ? overrideEn : originalEn);
  const [heDraft, setHeDraft] = useState(overrideHe != null ? overrideHe : originalHe);

  function writeOverride(en, he) {
    onUpdate({ titleOverride: en == null && he == null ? null : { en, he } });
  }

  function handleResetField(field) {
    if (field === "en") {
      setEnDraft(originalEn);
      writeOverride(null, overrideHe);
    } else {
      setHeDraft(originalHe);
      writeOverride(overrideEn, null);
    }
  }

  function handleSave() {
    const en = enDraft !== originalEn ? enDraft : null;
    const he = heDraft !== originalHe ? heDraft : null;
    writeOverride(en, he);
    onClose();
  }

  return (
    <div className="title-editor">
      <label>
        {t("titleEnLabel", siteLang)}
        <span className="title-editor-row">
          <input type="text" value={enDraft} onChange={(e) => setEnDraft(e.target.value)} dir="ltr" />
          {overrideEn != null ? (
            <button
              type="button"
              className="title-editor-reset"
              onClick={() => handleResetField("en")}
              aria-label={t("resetField", siteLang)}
              title={t("resetField", siteLang)}
            >
              ↺
            </button>
          ) : null}
        </span>
      </label>
      <label>
        {t("titleHeLabel", siteLang)}
        <span className="title-editor-row">
          <input type="text" value={heDraft} onChange={(e) => setHeDraft(e.target.value)} dir="rtl" />
          {overrideHe != null ? (
            <button
              type="button"
              className="title-editor-reset"
              onClick={() => handleResetField("he")}
              aria-label={t("resetField", siteLang)}
              title={t("resetField", siteLang)}
            >
              ↺
            </button>
          ) : null}
        </span>
      </label>
      <div className="title-editor-actions">
        <button type="button" onClick={handleSave}>
          {t("save", siteLang)}
        </button>
        <button type="button" onClick={onClose}>
          {t("cancel", siteLang)}
        </button>
      </div>
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
  onUpdate,
}) {
  const { era, error } = source;
  const effective = resolveSettings(settings, source.settingsOverride);
  const fontEntry = getEraFont(era, effective.fontStyle);
  const siteLang = (settings && settings.siteLang) || "en";
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingText, setEditingText] = useState(false);

  const hasHe = (source.heSegments || []).some((s) => s && s.trim());
  const hasEn = (source.enSegments || source.enEdited || []).some((s) => s && s.trim());
  const hasTextEdits = !!(source.heEdited || source.enEdited);

  let titleLang = effective.titleBar.language;
  if (!hasHe && titleLang !== "en") titleLang = hasEn ? "en" : titleLang;
  if (!hasEn && titleLang === "en") titleLang = "he";

  let bodyLang = effective.body.language;
  if (!hasHe && bodyLang !== "en") bodyLang = hasEn ? "en" : bodyLang;
  if (!hasEn && bodyLang === "en") bodyLang = "he";

  const titleEn =
    source.titleOverride && source.titleOverride.en != null ? source.titleOverride.en : source.ref;
  let titleHe =
    source.titleOverride && source.titleOverride.he != null ? source.titleOverride.he : source.heRef;
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
          <span className="source-card-ref-langs">
            {titleLang !== "he" ? <span className="source-card-ref-en">{titleEn}</span> : null}
            {titleLang !== "en" ? (
              <span className="source-card-ref-he" dir="rtl">
                {titleHe}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="source-card-title-edit"
            onClick={() => setEditingTitle((v) => !v)}
            aria-label={t("editTitle", siteLang)}
            title={t("editTitle", siteLang)}
          >
            ✎
          </button>
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
        </div>
      </div>

      <button
        type="button"
        className="source-card-remove"
        onClick={onRemove}
        aria-label={t("remove", siteLang)}
        title={t("remove", siteLang)}
      >
        ✕
      </button>

      {editingTitle ? (
        <TitleEditor
          source={source}
          siteLang={siteLang}
          onUpdate={onUpdate}
          onClose={() => setEditingTitle(false)}
        />
      ) : null}

      {error ? (
        <p className="source-card-error">{error}</p>
      ) : (
        <>
          <div className="source-card-text-controls">
            <button type="button" onClick={() => setEditingText((v) => !v)}>
              {t("editText", siteLang)}
            </button>
            {hasTextEdits ? (
              <button
                type="button"
                onClick={() => onUpdate({ heEdited: null, enEdited: null })}
              >
                {t("resetText", siteLang)}
              </button>
            ) : null}
          </div>

          {editingText ? (
            <TextEditor
              source={source}
              siteLang={siteLang}
              onSave={(patch) => {
                onUpdate(patch);
                setEditingText(false);
              }}
              onCancel={() => setEditingText(false)}
            />
          ) : (
            <div className={`source-card-body source-card-body-${effective.body.alignment}`}>
              {bodyLang !== "he" ? <EnglishBlocks blocks={blocks} /> : null}
              {bodyLang !== "en" ? (
                <HebrewBlocks
                  blocks={stripUnsupportedMarks(blocks, fontEntry)}
                  fontFamily={fontEntry.family}
                />
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
