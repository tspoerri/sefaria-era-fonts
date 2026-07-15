// Thin client for Sefaria's public REST API. No backend, no auth.

const TEXTS_BASE = 'https://www.sefaria.org/api/texts/'
const INDEX_BASE = 'https://www.sefaria.org/api/v2/index/'

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
