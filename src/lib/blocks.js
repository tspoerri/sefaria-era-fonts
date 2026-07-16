// Pure helpers for the Wave-C sheet "blocks" model. A block is one of:
//   {id, type: "source", source}   — a Wave-A/B source object
//   {id, type: "heading", text}
//   {id, type: "text", text}
//   {id, type: "spacer", size}     — size is one of SPACER_SIZES
// Reorder and delete-guard (undo stack) logic lives here, pure and
// unit-testable, so App.jsx/Outline.jsx stay thin. See SPEC.md
// "Wave C — sheet structure".

export const SPACER_SIZES = ["S", "M", "L"];

let counter = 0;
export function makeBlockId() {
  counter += 1;
  return `blk-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newSourceBlock(source) {
  return { id: makeBlockId(), type: "source", source };
}

export function newHeadingBlock(text = "") {
  return { id: makeBlockId(), type: "heading", text };
}

export function newTextBlock(text = "") {
  return { id: makeBlockId(), type: "text", text };
}

export function newSpacerBlock(size = "M") {
  return { id: makeBlockId(), type: "spacer", size: SPACER_SIZES.includes(size) ? size : "M" };
}

// Moves the block at `fromIndex` to `toIndex`, returning a new array. A
// no-op (out-of-range or same-index) returns the original array reference
// unchanged, so callers can skip a state update/save.
export function reorderBlocks(blocks, fromIndex, toIndex) {
  if (
    !Array.isArray(blocks) ||
    fromIndex < 0 ||
    fromIndex >= blocks.length ||
    toIndex < 0 ||
    toIndex >= blocks.length ||
    fromIndex === toIndex
  ) {
    return blocks;
  }
  const next = blocks.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

// Removes the block at `index`, returning the shortened array plus a
// {block, index} record suitable for pushing onto an undo stack. Returns
// `removed: null` (blocks unchanged) for an out-of-range index.
export function removeBlockAt(blocks, index) {
  if (!Array.isArray(blocks) || index < 0 || index >= blocks.length) {
    return { blocks, removed: null };
  }
  const next = blocks.slice();
  const [block] = next.splice(index, 1);
  return { blocks: next, removed: { block, index } };
}

// Re-inserts a previously-removed {block, index} record at its original
// position, clamped to the current array length in case other edits
// happened while the undo toast was showing.
export function restoreBlockAt(blocks, removed) {
  if (!Array.isArray(blocks) || !removed || !removed.block) return blocks;
  const next = blocks.slice();
  const index = Math.max(0, Math.min(removed.index, next.length));
  next.splice(index, 0, removed.block);
  return next;
}

// Sidebar label for a block: sources by their displayed title (honoring
// titleOverride, falling back through ref/heRef), headings/text by their
// own text (truncated), spacer by its size.
export function blockLabel(block, siteLang) {
  if (!block) return "";
  if (block.type === "source") {
    const s = block.source || {};
    const overrideEn = s.titleOverride && s.titleOverride.en;
    const overrideHe = s.titleOverride && s.titleOverride.he;
    if (siteLang === "he") return overrideHe || s.heRef || overrideEn || s.ref || "";
    return overrideEn || s.ref || overrideHe || s.heRef || "";
  }
  if (block.type === "heading") return block.text || "";
  if (block.type === "text") {
    const trimmed = (block.text || "").trim();
    if (!trimmed) return "";
    return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
  }
  if (block.type === "spacer") return block.size || "M";
  return "";
}
