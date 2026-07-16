// All source-search policy for the "add source" combobox lives in this
// module: offline phonetic-skeleton matching against public/lexicon.json for
// Latin-script queries (see src/lib/fold.js), plus the pre-existing live
// Hebrew fallback path. It replaces the old per-keystroke API fan-out
// (`fetchNameSuggestionsRobust` + `generateTranslitVariants`, both now
// deleted — git history keeps them) with: zero network calls while typing a
// Latin query once the lexicon asset has loaded, and exactly one
// `/api/name` call at selection time (see `resolveSelection`).
//
// Search architecture, fold rules, and the preserved live-API findings now
// live in docs/SEARCH.md.

import { fold } from "./fold.js";
import { splitTitleAndAddress } from "./inputNormalize.js";
import { isHebrewText, hasNikud, generateHebrewVariants } from "./hebrewSearch.js";
import { fetchNameRaw } from "../api/sefaria.js";

const MAX_SUGGESTIONS = 8;

// ----------------------------------------------------------------------------
// Lexicon loading: lazy-fetched at most once per session, module-level
// promise cache. `import.meta.env.BASE_URL` is Vite's configured base path
// ('/sefaria-era-fonts/' in the GitHub Pages build, '/' in dev) — a bare
// '/lexicon.json' would 404 once deployed under the Pages base path.
// ----------------------------------------------------------------------------

let lexiconPromise = null;
let lexiconData = null; // set once the fetch resolves with a valid shape

function lexiconUrl() {
  const base =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
  return base + "lexicon.json";
}

function isValidLexiconShape(data) {
  return (
    !!data &&
    Array.isArray(data.keys) &&
    Array.isArray(data.titles) &&
    Array.isArray(data.ranks) &&
    data.keys.length === data.titles.length &&
    data.keys.length === data.ranks.length
  );
}

// Never throws — a failed/missing lexicon just means the Latin path keeps
// falling back to the live direct call (see `searchLatinTitles`), same as
// before this module existed.
export function loadLexicon() {
  if (!lexiconPromise) {
    lexiconPromise = fetch(lexiconUrl())
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isValidLexiconShape(data)) {
          lexiconData = data;
          return data;
        }
        return null;
      })
      .catch(() => null);
  }
  return lexiconPromise;
}

// Exposed for tests / diagnostics only; app code should go through
// `loadLexicon()` / `searchTitles()`.
export function getCachedLexicon() {
  return lexiconData;
}

// ----------------------------------------------------------------------------
// Pure offline matching. Takes an already-loaded lexicon object
// ({ keys, titles, ranks }, see public/lexicon.json / scripts/build-lexicon.mjs)
// and a title string — no fetch, no import.meta, no module-level state. This
// is what makes it possible to smoke-test the real matching logic in plain
// Node against the real public/lexicon.json (see the L2 verification script).
// ----------------------------------------------------------------------------

function lowerBound(keys, target) {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (keys[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pushUniqueIndex(tier, idx, titles, seenTitles) {
  const t = titles[idx];
  if (seenTitles.has(t)) return;
  seenTitles.add(t);
  tier.push(idx);
}

function rankTier(tier, titles, ranks) {
  return tier
    .map((i) => ({ i, rank: ranks[i], len: titles[i].length }))
    .sort((a, b) => a.rank - b.rank || a.len - b.len)
    .map(({ i }) => i);
}

// A candidate key matches a multiword query as a "word-prefix" hit if every
// query word is a prefix of some word in the candidate, in the same relative
// order (a subsequence match) — this is deliberately weaker than the
// contiguous whole-string prefix tier above it, so it can bridge a query
// that's missing a connector word the real title has (e.g. matching a
// candidate that has "on"/"al" where the user's query doesn't), at the cost
// of being tried only when the stronger tiers haven't already filled the
// result budget.
function matchesWordPrefixSubsequence(key, queryWords) {
  const candWords = key.split(" ");
  let ci = 0;
  for (const qw of queryWords) {
    let found = false;
    while (ci < candWords.length) {
      if (candWords[ci].startsWith(qw)) {
        found = true;
        ci++;
        break;
      }
      ci++;
    }
    if (!found) return false;
  }
  return true;
}

function wordPrefixCandidates(lexicon, queryWords, seenTitles, maxResults) {
  const { keys, titles, ranks } = lexicon;
  const matches = [];
  for (let i = 0; i < keys.length; i++) {
    if (seenTitles.has(titles[i])) continue;
    if (matchesWordPrefixSubsequence(keys[i], queryWords)) {
      matches.push({ i, rank: ranks[i], len: titles[i].length });
    }
  }
  matches.sort((a, b) => a.rank - b.rank || a.len - b.len);
  const result = [];
  for (const m of matches) {
    if (result.length >= maxResults) break;
    if (seenTitles.has(titles[m.i])) continue;
    seenTitles.add(titles[m.i]);
    result.push(m.i);
  }
  return result;
}

/**
 * Match a Latin-script title string against a loaded lexicon object. Pure
 * function: no I/O, no module state. Priority: exact-key hits, then
 * key-prefix hits, then (for multiword queries only) per-word-prefix hits;
 * each tier internally sorted by ascending TOC rank then shorter title.
 * Returns at most `maxResults` suggestions shaped `{ title, key, isPrimary }`
 * — `key` is set to `title` (offline hits don't know Sefaria's canonical
 * book key; `resolveSelection` gets the real canonical ref at selection
 * time) and `isPrimary` is true only for exact-key hits.
 */
export function matchLatinOffline(lexicon, title, maxResults = MAX_SUGGESTIONS) {
  if (!isValidLexiconShape(lexicon) || lexicon.keys.length === 0) return [];
  const key = fold(title);
  if (!key) return [];

  const { keys, titles, ranks } = lexicon;
  const n = keys.length;
  const seenTitles = new Set();
  const exactTier = [];
  const prefixTier = [];

  let idx = lowerBound(keys, key);
  while (idx < n && keys[idx] === key) {
    pushUniqueIndex(exactTier, idx, titles, seenTitles);
    idx++;
  }
  while (idx < n && keys[idx].startsWith(key)) {
    pushUniqueIndex(prefixTier, idx, titles, seenTitles);
    idx++;
  }

  let wordPrefixTier = [];
  const queryWords = key.split(" ").filter(Boolean);
  if (exactTier.length + prefixTier.length < maxResults && queryWords.length > 1) {
    wordPrefixTier = wordPrefixCandidates(lexicon, queryWords, seenTitles, maxResults);
  }

  const orderedIdx = [
    ...rankTier(exactTier, titles, ranks),
    ...rankTier(prefixTier, titles, ranks),
    ...wordPrefixTier,
  ];
  const exactSet = new Set(exactTier);

  return orderedIdx.slice(0, maxResults).map((i) => ({
    title: titles[i],
    key: titles[i],
    isPrimary: exactSet.has(i),
  }));
}

// Synchronous, network-free lookup for the current search text, using
// whatever lexicon state is cached so far. Returns:
//   - an array (possibly empty) if the query is Latin-script AND the
//     lexicon has finished loading — this is authoritative for the Latin
//     path with zero network cost, callable straight from an onChange
//     handler once per keystroke.
//   - `null` if the caller should fall back to the async `searchTitles`
//     path instead: the text is Hebrew (different, live-only path) or the
//     lexicon hasn't loaded yet.
export function offlineSearch(query, maxResults = MAX_SUGGESTIONS) {
  const trimmed = (query || "").trim();
  if (trimmed.length < 2) return [];
  const { title } = splitTitleAndAddress(trimmed);
  const titlePart = title.trim();
  if (titlePart.length < 2) return [];
  if (isHebrewText(titlePart)) return null;
  if (!lexiconData) return null;
  return matchLatinOffline(lexiconData, titlePart, maxResults);
}

// ----------------------------------------------------------------------------
// Live-call helpers and orchestration.
// ----------------------------------------------------------------------------

async function fetchSuggestionsOnly(query, { signal } = {}) {
  const { suggestions } = await fetchNameRaw(query, { signal });
  return suggestions;
}

function mergeSuggestions(lists, maxResults = MAX_SUGGESTIONS) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const s of list) {
      if (seen.has(s.title)) continue;
      seen.add(s.title);
      merged.push(s);
      if (merged.length >= maxResults) return merged;
    }
  }
  return merged;
}

// Hebrew branch, moved byte-for-byte in behavior from the old
// `fetchNameSuggestionsRobust` (src/api/sefaria.js, now deleted) — see the
// "Hebrew fallback gating" note in the preserved-knowledge block above for
// why this stays a live per-keystroke fan-out rather than an offline table.
async function searchHebrewTitles(title, { signal, rawQuery } = {}) {
  const direct = await fetchSuggestionsOnly(title, { signal });
  if (direct.length >= 3 || hasNikud(rawQuery || "")) return direct;

  const variants = generateHebrewVariants(title);
  if (variants.length === 0) return direct;

  const variantResults = await Promise.all(
    variants.map((v) => fetchSuggestionsOnly(v, { signal }))
  );
  // Cap direct's contribution so a full-but-irrelevant direct result set
  // can't crowd out a correct variant match — see preserved-knowledge notes.
  return mergeSuggestions([direct.slice(0, 5), ...variantResults]);
}

// Latin branch: offline lexicon match first; while the lexicon is still
// loading, or when it comes up with zero hits, exactly one direct
// `/api/name` call as a fallback. No variant fan-out — the fold table
// already covers what the old translitVariants.js fan-out was for.
async function searchLatinTitles(title, { signal } = {}) {
  loadLexicon(); // kick off the one-time fetch; safe to call every time

  if (lexiconData) {
    const offline = matchLatinOffline(lexiconData, title);
    if (offline.length > 0) return offline;
    return fetchSuggestionsOnly(title, { signal });
  }

  // Lexicon not loaded yet (or failed to load) — single direct fallback so
  // the very first keystrokes of a session aren't dead.
  return fetchSuggestionsOnly(title, { signal });
}

/**
 * Main entry point for the "add source" combobox. Splits a trailing ref
 * address off `query` (reusing the existing `splitTitleAndAddress` — see
 * inputNormalize.js; never reimplemented here), then dispatches on script:
 * Hebrew keeps the existing live fallback path unchanged; Latin runs
 * offline lexicon matching with a live 0-hit/loading fallback. Returns at
 * most 8 suggestions shaped `{ title, key, isPrimary }`.
 *
 * `rawQuery` should be the PRE-normalization input value (before nikud
 * stripping) — only used by the Hebrew branch to detect pasted vocalized
 * text, same as the old `fetchNameSuggestionsRobust` contract.
 */
export async function searchTitles(query, { signal, rawQuery } = {}) {
  const trimmed = (query || "").trim();
  if (trimmed.length < 2) return [];

  const { title } = splitTitleAndAddress(trimmed);
  const titlePart = title.trim();
  if (titlePart.length < 2) return [];

  if (isHebrewText(titlePart)) {
    return searchHebrewTitles(titlePart, { signal, rawQuery: rawQuery ?? trimmed });
  }
  return searchLatinTitles(titlePart, { signal });
}

/**
 * The only network call in the Latin happy path: resolve a picked
 * suggestion (+ optional trailing address, already including its own
 * leading whitespace per `splitTitleAndAddress`) to Sefaria's canonical
 * ref via a single `/api/name` call. Falls back to the plain
 * title+address string (still a fully valid ref for Sefaria's own
 * `/api/texts`) if the call fails or doesn't resolve to a ref.
 */
export async function resolveSelection(title, address = "") {
  const query = address ? `${title}${address}` : title;
  try {
    const { ref } = await fetchNameRaw(query);
    if (ref) return ref;
  } catch {
    // fall through to the constructed fallback below
  }
  return query;
}
