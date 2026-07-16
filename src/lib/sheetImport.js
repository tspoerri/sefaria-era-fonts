// SPEC.md Wave 2 item 7 -- importing a Sefaria sheet. Pure/testable pieces
// only: parsing a pasted sheet URL/ID down to a bare numeric id, and
// classifying a raw sheet-source-node's JSON shape into a block descriptor
// our blocks model understands. The actual network call (GET
// /api/sheets/{id}) lives in src/api/sefaria.js's fetchSheet; resolving a
// "source" descriptor into a full font-classified source block still needs
// the same fetchText/fetchIndex/classifyEra pipeline every other add goes
// through, so that part is orchestrated in App.jsx, not here.

// Accepts a bare numeric id ("12345"), a full sheet URL
// ("https://www.sefaria.org/sheets/12345", with or without a trailing
// ".1"/query string/fragment), or a partial path ("sheets/12345"). Returns
// the bare id string, or null if nothing that looks like a sheet id can be
// found.
export function parseSheetIdFromInput(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // Bare id, optionally with a ".N" node-anchor suffix.
  const bareMatch = s.match(/^(\d+)(?:\.\d+)?$/);
  if (bareMatch) return bareMatch[1];

  // Anywhere a "/sheets/<id>" path segment appears (full URL, path only, or
  // with a leading slash), pull the numeric id back out. Sefaria also
  // accepts the un-namespaced form "sheet/<id>" -- match both.
  const pathMatch = s.match(/\bsheets?\/(\d+)/i);
  if (pathMatch) return pathMatch[1];

  return null;
}

// Minimal HTML->plain-text conversion for sheet node content, which Sefaria
// stores as HTML (outsideText/comment are typically "<p>...</p>" wrapped,
// sometimes with <b>/<i>/<br> inline). Our text/heading blocks are plain
// textareas/inputs, not rich text, so this strips tags rather than
// preserving formatting -- good enough for a prototype import. Collapses
// <br>/<p>/<div> boundaries to newlines, decodes the handful of entities
// Sefaria's editor actually emits, and trims the result.
export function stripHtml(html) {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// Classifies one raw sheet-source-node into a block descriptor:
//   {type: "source", ref}   -- resolve via the normal fetch pipeline
//   {type: "text", text}    -- outsideText or comment, HTML stripped
//   {type: "heading", text} -- header node
//   null                    -- unsupported node type (media, etc.) -- drop
//                              it silently, never invent a new block type
//                              and never throw.
// Field names follow Sefaria's public sheet JSON: a source node carries a
// `ref` string; a free-text node carries `outsideText` (HTML string); a
// comment node carries `comment` (HTML string); a section-header node
// carries `type: "header"` with a `title` (string, or {en, he}); a media
// node carries a `media` field. Detection is duck-typed on whichever field
// is actually present rather than trusting `node.type`, since sheet JSON is
// inconsistent about setting it for every node kind.
export function classifySheetNode(node) {
  if (!node || typeof node !== "object") return null;

  if (typeof node.media === "string" && node.media) return null; // unsupported, drop silently

  if (typeof node.ref === "string" && node.ref.trim()) {
    return { type: "source", ref: node.ref.trim() };
  }

  if (typeof node.outsideText === "string" && node.outsideText.trim()) {
    const text = stripHtml(node.outsideText);
    return text ? { type: "text", text } : null;
  }

  if (typeof node.comment === "string" && node.comment.trim()) {
    const text = stripHtml(node.comment);
    return text ? { type: "text", text } : null;
  }

  if (node.type === "header" || typeof node.title === "string" || (node.title && typeof node.title === "object")) {
    const raw =
      typeof node.title === "string"
        ? node.title
        : node.title && (node.title.en || node.title.he);
    const text = stripHtml(raw || "");
    return text ? { type: "heading", text } : null;
  }

  return null;
}

// Maps a whole sheet's `sources` array into an ordered list of block
// descriptors, dropping unsupported nodes (classifySheetNode returning
// null) rather than inserting a gap or throwing.
export function mapSheetToBlockDescriptors(sheetSources) {
  if (!Array.isArray(sheetSources)) return [];
  return sheetSources.map(classifySheetNode).filter(Boolean);
}
