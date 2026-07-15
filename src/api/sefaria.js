// Thin client for Sefaria's public REST API. No backend, no auth.

import { generateHebrewVariants, hasNikud, isHebrewText } from '../lib/hebrewSearch.js'
import { generateTranslitVariants } from '../lib/translitVariants.js'

const TEXTS_BASE = 'https://www.sefaria.org/api/texts/'
const INDEX_BASE = 'https://www.sefaria.org/api/v2/index/'
const NAME_BASE = 'https://www.sefaria.org/api/name/'

// Fetch a text segment/range by ref, e.g. "Genesis 1:1" or "Rashi on Genesis 1:1".
// Returns the raw API response: { he, text, ref, heRef, categories, primary_category,
// type, book, indexTitle, ... }. `he`/`text` may be a string (single segment) or an
// array of strings (range) — callers normalize as needed.
export async function fetchText(ref) {
  const url = `${TEXTS_BASE}${encodeURIComponent(ref)}?context=0&commentary=0&pad=0`
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

// Autocomplete/typo-correction for the "add source" box, backed by Sefaria's
// own name-resolution index — it already knows common transliteration
// variants (e.g. "Brachot" -> "Berakhot") and tolerates minor misspellings
// (e.g. "Genessis" -> "Genesis"), in both Hebrew and English. Returns at most
// 8 deduped ref-type suggestions: { title, key, isPrimary }. Never throws;
// returns [] on any failure so it can be wired straight into an input's
// onChange without extra guarding. Pass an AbortSignal to cancel stale
// requests from a fast typist.
export async function fetchNameSuggestions(query, { signal } = {}) {
  const trimmed = (query || '').trim()
  if (trimmed.length < 2) return []

  const url = `${NAME_BASE}${encodeURIComponent(trimmed)}?ref_only=0`
  let res
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    if (err && err.name === 'AbortError') throw err
    return []
  }

  if (!res.ok) return []

  let data
  try {
    data = await res.json()
  } catch {
    return []
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
  return suggestions
}

const MAX_SUGGESTIONS = 8

function mergeSuggestions(lists) {
  const seen = new Set()
  const merged = []
  for (const list of lists) {
    for (const s of list) {
      if (seen.has(s.title)) continue
      seen.add(s.title)
      merged.push(s)
      if (merged.length >= MAX_SUGGESTIONS) return merged
    }
  }
  return merged
}

// Same as fetchNameSuggestions, but for queries that come up short it also
// tries alternate spellings, in whichever direction matches the script:
// - Hebrew queries get letter-level variants built from commonly
//   confused/omitted letters (see src/lib/hebrewSearch.js) — e.g. a query
//   spelled with "כ" where the real title uses "ח" (both sound "kh") still
//   surfaces a match.
// - Latin/romanized queries get Ashkenazi -> Sephardi/canonical spelling
//   variants (see src/lib/translitVariants.js) — e.g. "Beraishis" or "Rashi
//   on Shemos" still surfaces "Bereishit"/"Rashi on Shemot", which Sefaria's
//   own name index doesn't resolve on its own.
// The direct query always runs first and its results are never displaced;
// variants only fill in gaps, merged in after direct's own results.
// `rawQuery` is the pre-normalization input, used only to check whether the
// user pasted in vocalized Hebrew text (nikud) — if so, it's almost
// certainly copied from a correctly-spelled source rather than typed, so the
// Hebrew typo fallback is skipped.
//
// The Hebrew and Latin branches use different triggers for the fallback.
// Hebrew: only bother once direct comes up short (< 3 results) — Sefaria's
// index handles most Hebrew spelling fine, and letter-swap variants are
// numerous enough that firing them on every keystroke would be wasteful.
// Latin: always run variants alongside direct, regardless of direct's
// count. This looks redundant but isn't: live testing against Sefaria's API
// showed that a bad Ashkenazi-spelled query (e.g. "Rashi on Beraishis",
// "Tosafos on Brachos") routinely comes back with 3-10 *irrelevant*
// fuzzy-matched refs (e.g. "Rashi on Amos", "Onkelos Exodus") — so a
// `direct.length < 3` gate would almost never fire for exactly the
// compound-title queries this fallback exists to fix. mergeSuggestions
// still keeps direct's results first, so this can't push a good direct
// match down or out.
export async function fetchNameSuggestionsRobust(query, { signal, rawQuery } = {}) {
  const trimmed = (query || '').trim()
  const direct = await fetchNameSuggestions(trimmed, { signal })

  let variants = []
  if (isHebrewText(trimmed)) {
    if (direct.length >= 3 || hasNikud(rawQuery || '')) return direct
    variants = generateHebrewVariants(trimmed)
  } else if (/[a-z]/i.test(trimmed)) {
    variants = generateTranslitVariants(trimmed)
  }

  if (variants.length === 0) return direct

  const variantResults = await Promise.all(
    variants.map((v) => fetchNameSuggestions(v, { signal }))
  )

  // mergeSuggestions fills greedily from the first list up to
  // MAX_SUGGESTIONS, so if direct alone already has a full 8 results —
  // which happens even when every one of them is an irrelevant fuzzy match,
  // as seen with "Rashi on Beraishis" et al above — variant results would
  // never get a slot. Cap direct's contribution here so there's always room
  // left for a correct variant match to surface; direct's best (first, per
  // Sefaria's own ranking) results still lead.
  return mergeSuggestions([direct.slice(0, 5), ...variantResults])
}
