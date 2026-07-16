// SPEC.md Wave 2 item 5 -- guard against pulling a huge text (whole sefer,
// whole perek of commentary) down in one shot. Sefaria's /api/shape/<ref>
// endpoint (src/api/sefaria.js fetchShape) returns per-node segment-COUNT
// metadata without the text content itself, so a ref's size can be
// estimated cheaply before ever calling fetchText(). Pure/testable — no
// network here, just parsing whatever shape JSON came back.
//
// Shape responses vary with the ref:
//   - a single flat node (e.g. one chapter of a simple text): {length: N, ...}
//   - a whole-book ref, or any ref spanning multiple chapters/nodes: an
//     array of node shapes, each recursively holding either a numeric
//     `length`, a `chapters` array (talmud-style "N segments per daf/perek"
//     wrappers -- entries are numbers OR nested node shapes), or a `nodes`
//     array (schema/complex texts, e.g. a commentary with named sections).
// estimateSegmentCount walks whatever comes back and sums every segment
// count it finds, so an unfamiliar/ambiguous shape degrades gracefully to
// "some number" rather than throwing. Returns null only when the shape
// carries no usable size info at all (including shape === null, i.e. the
// fetchShape() call itself failed) -- callers should treat null as "unknown
// size" and fall back to fetching normally rather than blocking the user.
export const LARGE_FETCH_THRESHOLD = 40;

export function estimateSegmentCount(shape) {
  if (shape == null) return null;
  let found = false;
  let total = 0;

  function walk(node) {
    if (node == null) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;
    if (typeof node.length === "number") {
      total += node.length;
      found = true;
      return; // a numeric `length` is a leaf-level segment count
    }
    if (Array.isArray(node.chapters)) {
      node.chapters.forEach((c) => {
        if (typeof c === "number") {
          total += c;
          found = true;
        } else {
          walk(c);
        }
      });
      return;
    }
    if (Array.isArray(node.nodes)) {
      node.nodes.forEach(walk);
    }
  }

  walk(shape);
  return found ? total : null;
}

// True only when the count is a known number over the threshold -- an
// unknown (null) count is never treated as "large" here, per the
// never-silently-refuse/never-silently-stall rule: an inconclusive shape
// check should let the fetch proceed normally, not block it.
export function isLargeFetch(segmentCount, threshold = LARGE_FETCH_THRESHOLD) {
  return typeof segmentCount === "number" && segmentCount > threshold;
}
