import SourceCard from "./SourceCard.jsx";
import { t } from "../lib/strings.js";

export default function Sheet({ sources, onRemove, onMove, onUpdateSource, settings }) {
  const siteLang = (settings && settings.siteLang) || "en";

  if (!sources.length) {
    return <p className="sheet-empty">{t("noSources", siteLang)}</p>;
  }

  return (
    <div className="sheet">
      {sources.map((source, index) => (
        <SourceCard
          key={source.id}
          source={source}
          settings={settings}
          isFirst={index === 0}
          isLast={index === sources.length - 1}
          onRemove={() => onRemove(source.id)}
          onMoveUp={() => onMove(source.id, -1)}
          onMoveDown={() => onMove(source.id, 1)}
          onUpdate={(patch) => onUpdateSource(source.id, patch)}
        />
      ))}
    </div>
  );
}
