import SourceCard from "./SourceCard.jsx";

export default function Sheet({ sources, onRemove, onMove }) {
  if (!sources.length) {
    return <p className="sheet-empty">No sources yet — add one above.</p>;
  }

  return (
    <div className="sheet">
      {sources.map((source, index) => (
        <SourceCard
          key={source.id}
          source={source}
          isFirst={index === 0}
          isLast={index === sources.length - 1}
          onRemove={() => onRemove(source.id)}
          onMoveUp={() => onMove(source.id, -1)}
          onMoveDown={() => onMove(source.id, 1)}
        />
      ))}
    </div>
  );
}
