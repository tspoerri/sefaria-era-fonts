// Maps a Sefaria text response (+ optional index response) to an era key.
// See docs/ARCHITECTURE.md "Era classification" for the priority-ordered spec.
// Verified against the live Sefaria API (2026-07):
//   - texts response: categories, primary_category, indexTitle, book, type all present.
//   - Tanakh commentaries (e.g. "Rashi on Genesis") have categories[0] === "Tanakh" too,
//     so "not a commentary" is checked via primary_category !== "Commentary", not categories[0].
//   - /api/v2/index/{title} era codes confirmed live: T (Mishnah, e.g. compDate [190,230]),
//     A (Talmud Bavli, compDate [450,550]), RI (Rashi/Rambam/Guide, various), AH (Shulchan
//     Arukh, Tanya), CO (Peninei Halakhah, compDate [1998,2002]). GN (Geonim) is documented
//     in Sefaria's era schema but no live example was found during verification — trusted
//     per spec.
//   - compDate is an array: either a single year [y] or a range [start, end].
//   - A missing/unknown index title returns HTTP 200 with { error: "..." }, not a 404 —
//     fetchIndex() in src/api/sefaria.js already treats that as a null result.

const CHUMASH_BOOKS = new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'])

const TANNAIM_CATEGORIES = new Set(['Mishnah', 'Tosefta', 'Midrash Halakhah'])

const ERA_CODE_MAP = {
  T: 'tannaim',
  A: 'amoraim',
  GN: 'geonim',
  RI: 'rishonim',
  AH: 'acharonim',
  CO: 'contemporary',
}

export const ERA_LABELS = {
  chumash: 'Chumash (Torah)',
  nach: 'Nach (Prophets & Writings)',
  tannaim: 'Tannaim (Mishnah/Tosefta, ~10–220 CE)',
  amoraim: 'Amoraim (Talmud, ~200–500 CE)',
  geonim: 'Geonim (~600–1000 CE)',
  rashi: 'Rashi (1040–1105)',
  rishonim: 'Rishonim (~1000–1500 CE)',
  acharonim: 'Acharonim (~1500–1800 CE)',
  acharei: "Acharei Acharonim (post-1800)",
  contemporary: 'Contemporary',
}

function maxCompDate(compDate) {
  if (!Array.isArray(compDate) || compDate.length === 0) return null
  const nums = compDate.filter((n) => typeof n === 'number')
  if (nums.length === 0) return null
  return Math.max(...nums)
}

export function classifyEra(textResponse, indexResponse) {
  const categories = (textResponse && textResponse.categories) || []
  const primaryCategory = textResponse && textResponse.primary_category
  const indexTitle = (textResponse && textResponse.indexTitle) || ''
  const book = textResponse && textResponse.book

  // 1. Rashi's commentary gets its own dedicated script row.
  if (indexTitle.startsWith('Rashi on')) {
    return { era: 'rashi', unclassified: false }
  }

  // 2. Tanakh (not a commentary on Tanakh) → chumash or nach.
  if (categories[0] === 'Tanakh' && primaryCategory !== 'Commentary') {
    if (CHUMASH_BOOKS.has(book)) {
      return { era: 'chumash', unclassified: false }
    }
    return { era: 'nach', unclassified: false }
  }

  // 3. Mishnah / Tosefta / Midrash Halakhah → tannaim.
  if (categories.some((c) => TANNAIM_CATEGORIES.has(c))) {
    return { era: 'tannaim', unclassified: false }
  }

  // 4. Talmud (Bavli or Yerushalmi, non-commentary) → amoraim.
  if (categories[0] === 'Talmud') {
    return { era: 'amoraim', unclassified: false }
  }

  // 5. Midrash (aggadic default) → amoraim.
  if (categories[0] === 'Midrash') {
    return { era: 'amoraim', unclassified: false }
  }

  // 6. Everything else: consult the index's era code.
  if (indexResponse && indexResponse.era) {
    const code = indexResponse.era
    const mapped = ERA_CODE_MAP[code]
    if (mapped) {
      if (code === 'AH') {
        const latest = maxCompDate(indexResponse.compDate)
        if (latest !== null && latest >= 1800) {
          return { era: 'acharei', unclassified: false }
        }
      }
      return { era: mapped, unclassified: false }
    }
  }

  // 7. No era resolvable.
  return { era: 'contemporary', unclassified: true }
}
