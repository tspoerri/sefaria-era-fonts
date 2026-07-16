import SourceCard from "./SourceCard.jsx";
import { t } from "../lib/strings.js";
import { SPACER_SIZES } from "../lib/blocks.js";
import { detectDir } from "../lib/textDir.js";

function BlockControls({ siteLang, isFirst, isLast, onMoveUp, onMoveDown, onDelete }) {
  return (
    <div className="block-controls">
      <button type="button" onClick={onMoveUp} disabled={isFirst} aria-label={t("moveUp", siteLang)}>
        {"↑"}
      </button>
      <button type="button" onClick={onMoveDown} disabled={isLast} aria-label={t("moveDown", siteLang)}>
        {"↓"}
      </button>
      <button
        type="button"
        className="block-delete"
        onClick={onDelete}
        aria-label={t("deleteBlock", siteLang)}
        title={t("deleteBlock", siteLang)}
      >
        {"✕"}
      </button>
    </div>
  );
}

function HeadingBlock({ block, siteLang, isFirst, isLast, onChangeText, onMoveUp, onMoveDown, onDelete }) {
  return (
    <div className="sheet-block heading-block" id={`block-${block.id}`}>
      <input
        type="text"
        className="heading-block-input"
        value={block.text}
        placeholder={t("headingPlaceholder", siteLang)}
        onChange={(e) => onChangeText(e.target.value)}
        dir={detectDir(block.text) || undefined}
      />
      <BlockControls
        siteLang={siteLang}
        isFirst={isFirst}
        isLast={isLast}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
      />
    </div>
  );
}

function TextBlock({ block, siteLang, isFirst, isLast, onChangeText, onMoveUp, onMoveDown, onDelete }) {
  return (
    <div className="sheet-block text-block" id={`block-${block.id}`}>
      <textarea
        className="text-block-input"
        value={block.text}
        placeholder={t("textBlockPlaceholder", siteLang)}
        onChange={(e) => onChangeText(e.target.value)}
        rows={3}
        dir={detectDir(block.text) || undefined}
      />
      <BlockControls
        siteLang={siteLang}
        isFirst={isFirst}
        isLast={isLast}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
      />
    </div>
  );
}

function SpacerBlock({ block, siteLang, isFirst, isLast, onChangeSize, onMoveUp, onMoveDown, onDelete }) {
  return (
    <div className={`sheet-block spacer-block spacer-block-${block.size}`} id={`block-${block.id}`}>
      <select value={block.size} onChange={(e) => onChangeSize(e.target.value)} className="spacer-size-select">
        {SPACER_SIZES.map((size) => (
          <option key={size} value={size}>
            {t(`spacerSize${size}`, siteLang)}
          </option>
        ))}
      </select>
      <BlockControls
        siteLang={siteLang}
        isFirst={isFirst}
        isLast={isLast}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
      />
    </div>
  );
}

export default function Sheet({
  blocks,
  settings,
  onRemoveSourceBlock,
  onMoveBlock,
  onUpdateSourceBlock,
  onUpdateSimpleBlock,
  onDeleteBlock,
}) {
  const siteLang = (settings && settings.siteLang) || "en";

  if (!blocks.length) {
    return <p className="sheet-empty">{t("noSources", siteLang)}</p>;
  }

  return (
    <div className="sheet">
      {blocks.map((block, index) => {
        const isFirst = index === 0;
        const isLast = index === blocks.length - 1;

        if (block.type === "source") {
          return (
            <div className="sheet-block source-block" id={`block-${block.id}`} key={block.id}>
              <SourceCard
                source={block.source}
                settings={settings}
                isFirst={isFirst}
                isLast={isLast}
                onRemove={() => onRemoveSourceBlock(block.id)}
                onMoveUp={() => onMoveBlock(block.id, -1)}
                onMoveDown={() => onMoveBlock(block.id, 1)}
                onUpdate={(patch) => onUpdateSourceBlock(block.id, patch)}
              />
            </div>
          );
        }

        if (block.type === "heading") {
          return (
            <HeadingBlock
              key={block.id}
              block={block}
              siteLang={siteLang}
              isFirst={isFirst}
              isLast={isLast}
              onChangeText={(text) => onUpdateSimpleBlock(block.id, { text })}
              onMoveUp={() => onMoveBlock(block.id, -1)}
              onMoveDown={() => onMoveBlock(block.id, 1)}
              onDelete={() => onDeleteBlock(block.id)}
            />
          );
        }

        if (block.type === "text") {
          return (
            <TextBlock
              key={block.id}
              block={block}
              siteLang={siteLang}
              isFirst={isFirst}
              isLast={isLast}
              onChangeText={(text) => onUpdateSimpleBlock(block.id, { text })}
              onMoveUp={() => onMoveBlock(block.id, -1)}
              onMoveDown={() => onMoveBlock(block.id, 1)}
              onDelete={() => onDeleteBlock(block.id)}
            />
          );
        }

        if (block.type === "spacer") {
          return (
            <SpacerBlock
              key={block.id}
              block={block}
              siteLang={siteLang}
              isFirst={isFirst}
              isLast={isLast}
              onChangeSize={(size) => onUpdateSimpleBlock(block.id, { size })}
              onMoveUp={() => onMoveBlock(block.id, -1)}
              onMoveDown={() => onMoveBlock(block.id, 1)}
              onDelete={() => onDeleteBlock(block.id)}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
