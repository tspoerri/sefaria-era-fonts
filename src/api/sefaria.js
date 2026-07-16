// Thin client for Sefaria's public REST API. No backend, no auth.
//
// Search POLICY (offline lexicon matching, Hebrew fallback gating, live-API
// findings) lives in src/lib/nameSearch.js, not here — this file is pure
// transport. See nameSearch.js's top comment block for the preserved
// live-API knowledge that used to live in this file's comments (geresh/
// gershayim address-split discovery, nikud stripping, fuzzy-match findings).

const TEXTS_BASE = 'https://www.sefaria.org/api/texts/'
const INDEX_BASE = 'https://www.sefaria.org/api/v2/index/'
const NAME_BASE = 'https://www.sefaria.org/api/name/'
const SHAPE_BASE = 'https://www.sefaria.org/api/shape/'
const SHEETS_BASE = 'https://www.sefaria.org/api/sheets/'

// Fetch a text segment/range by ref, e.g. "Genesis 1:1" or "Rashi on Genesis 1:1".
// Returns the raw API response: { he, text, ref, heRef, categories, primary_category,
// type, book, indexTitle, ... }. `he`/`text` may be a string (single segment) or an
// array of strings (range) — callers normalize as needed.
//
// `options.ven`, when given a non-empty string, requests a specific English
// version by title (`&ven=<encoded title>`). Sefaria falls back to its
// default version's Hebrew when the version doesn't cover a ref (or returns
// an empty English string) — callers wanting a guaranteed-populated English
// side should check the response and refetch without `ven` themselves (see
// src/lib/sheetStorage.js isEmptyEnglish + App.jsx handleAdd).
export async function fetchText(ref, options = {}) {
  const { ven } = options
  let url = `${TEXTS_BASE}${encodeURIComponent(ref)}?context=0&commentary=0&pad=0`
  if (ven) {
    url += `&ven=${encodeURIComponent(ven)}`
  }
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error(`Could not reach Sefaria for "${ref}". Check your connection and try again.`)
  }

  if (!res.ok) {
    throw new Error(`Sefaria couldn't find "${ref}". Check the reference and try again.`)
  }

  const data = await res.json()
  if (data && data.error) {
    throw new Error(`Sefaria error for "${ref}": ${data.error}`)
  }

  return data
}

// Cache index lookups so repeated sources from the same work don't refetch.
const indexCache = new Map()

// Fetch index metadata for a work title, e.g. "Rashi on Genesis". Returns the raw
// API response (includes `era`, `compDate`, `categories`, ...), or null on any
// failure (missing book, network error, etc.) — this lookup is a best-effort
// fallback in the era classifier, so it never throws.
export async function fetchIndex(indexTitle) {
  if (indexCache.has(indexTitle)) {
    return indexCache.get(indexTitle)
  }

  let result = null
  try {
    const url = `${INDEX_BASE}${encodeURIComponent(indexTitle)}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      if (!data.error) {
        result = data
      }
    }
  } catch (err) {
    result = null
  }

  indexCache.set(indexTitle, result)
  return result
}

// SPEC.md Wave 2 item 5 (guard huge fetches): Sefaria's /api/shape/<ref>
// endpoint returns per-node segment-COUNT metadata without the text content
// itself, so a resolved ref's size can be estimated cheaply before ever
// calling fetchText(). Returns the raw JSON (its shape varies with the ref —
// see src/lib/fetchGuard.js's estimateSegmentCount for how it's parsed), or
// null on any failure (missing ref, network error, unexpected response) —
// like fetchIndex, this is a best-effort pre-check, so it never throws;
// callers that get null back should fall back to just fetching normally
// rather than blocking the user on an unknown size.
export async function fetchShape(ref) {
  try {
    const url = `${SHAPE_BASE}${encodeURIComponent(ref)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data && data.error) return null
    return data
  } catch (err) {
    return null
  }
}

// SPEC.md Wave 2 item 7 (import a Sefaria sheet): fetches a sheet's raw JSON
// by numeric id. Unlike fetchIndex/fetchShape this throws on failure (an
// explicit user-initiated import should surface an error, not fail silent) —
// same contract as fetchText.
export async function fetchSheet(id) {
  const url = `${SHEETS_BASE}${encodeURIComponent(id)}`
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error(`Could not reach Sefaria to import sheet "${id}". Check your connection and try again.`)
  }

  if (!res.ok) {
    throw new Error(`Sefaria couldn't find sheet "${id}".`)
  }

  const data = await res.json()
  if (data && data.error) {
    throw new Error(`Sefaria error importing sheet "${id}": ${data.error}`)
  }

  return data
}

// Thin wrapper around Sefaria's name-resolution/autocomplete endpoint, used
// by src/lib/nameSearch.js as its one live-call primitive (both for the
// Hebrew fallback path and the Latin 0-hit/loading fallback and selection-
// time resolve). Returns:
//   - `suggestions`: at most 8 deduped ref-type completions,
//     `{ title, key, isPrimary }`
//   - `ref`: the canonical ref string Sefaria resolved the full query to
//     (e.g. "Rashi on Genesis 1:1"), or null if the query didn't resolve to
//     a single ref (`is_ref` false/absent) — this is what
//     `nameSearch.resolveSelection` reads to get the canonical ref at
//     selection time.
// Never throws (except to propagate an AbortError so callers can distinguish
// a deliberate cancel from any other failure); returns an empty/null shape
// on any other failure so it's safe to call without extra guarding.
export async function fetchNameRaw(query, { signal } = {}) {
  const trimmed = (query || '').trim()
  if (trimmed.length < 2) return { suggestions: [], ref: null }

  const url = `${NAME_BASE}${encodeURIComponent(trimmed)}?ref_only=0`
  let res
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if (err && err.name === 'AbortError') throw err
    return { suggestions: [], ref: null }
  }

  if (!res.ok) return { suggestions: [], ref: null }

  let data
  try {
    data = await res.json()
  } catch {
    return { suggestions: [], ref: null }
  }

  const objects = Array.isArray(data.completion_objects) ? data.completion_objects : []
  const seen = new Set()
  const suggestions = []
  for (const obj of objects) {
    if (obj.type !== 'ref' || !obj.title || seen.has(obj.title)) continue
    seen.add(obj.title)
    suggestions.push({ title: obj.title, key: obj.key, isPrimary: !!obj.is_primary })
    if (suggestions.length >= 8) break
  }

  const ref = data && data.is_ref && data.ref ? data.ref : null
  return { suggestions, ref }
}
