# Architecture & Era Mapping

## Decision
No fork of Sefaria-Project (Django+React monolith, needs Mongo, users, auth — massive overkill).
Instead: **Vite + React SPA, no backend**, calling Sefaria's public CORS-enabled REST API
(https://developers.sefaria.org) client-side. Sheet state lives in React state +
localStorage. Export = print stylesheet (browser print-to-PDF).

## Stack
- Vite + React 18, plain JS (no TS — overnight prototype)
- No CSS framework; one `styles.css` + one `fonts.css`
- Fonts: Google Fonts `<link>` where available; free (OFL/GPL+FE) font files committed
  to `public/fonts/` and loaded via `@font-face` otherwise. NO paid fonts — substitutes
  flagged in `docs/FONTS.md` and in `src/lib/fonts.js`.

## Data flow
1. User types a ref ("Genesis 1:1", "Rashi on Genesis 1:1", "Mishnah Berakhot 1:1").
2. `GET https://www.sefaria.org/api/texts/{ref}?context=0&commentary=0&pad=0`
   → `{ he, text, ref, heRef, categories, primary_category, type, book, indexTitle }`.
3. Era classifier (below) maps the response (+ one optional index lookup) to an era key.
4. `src/lib/fonts.js` maps era key → CSS font stack; SourceCard renders Hebrew in it.

## Era classification (src/lib/era.js)
Era keys: `chumash | nach | tannaim | amoraim | geonim | rashi | rishonim | acharonim | acharei | contemporary`

Priority order:
1. `indexTitle` starts with `"Rashi on"` → `rashi` (chart has a dedicated Rashi-script row).
2. `categories[0] === "Tanakh"` and NOT a commentary → book ∈ {Genesis, Exodus, Leviticus,
   Numbers, Deuteronomy} → `chumash`, else `nach`.
3. `categories` contains `"Mishnah"` or `"Tosefta"` or `"Midrash Halakhah"`(Sifra/Sifrei/Mekhilta) → `tannaim`.
4. `categories[0] === "Talmud"` (Bavli or Yerushalmi, non-commentary) → `amoraim`.
5. `categories[0] === "Midrash"` → `amoraim` (aggadic midrash default; good enough for v1).
6. Otherwise (Commentary, Halakhah, Responsa, Kabbalah, Chasidut, Musar, Liturgy…):
   fetch `GET /api/v2/index/{indexTitle}` and read its `era` code —
   Sefaria era codes: `T`→tannaim, `A`→amoraim, `GN`→geonim, `RI`→rishonim,
   `AH`→acharonim, `CO`→contemporary. **Verify codes against live API during build.**
   Map `acharei` bucket: Sefaria has no separate code for it; treat `AH` works with
   `compDate` ≥ 1800 as `acharei` if compDate present, else `acharonim`.
7. No era resolvable → `contemporary` + `unclassified: true` badge on the card.

Cache index lookups in a Map (module-level) to avoid refetching per source.

## Era → font (src/lib/fonts.js) — from the Ktav Ashuri chart
| era | chart's pick | what we ship | flag |
|---|---|---|---|
| chumash | Stam Ashkenaz (Reconstructs, Kesav Beis Yosef) | Stam Ashkenaz CLM (Culmus, GPL+FE) | — |
| nach | Isaiah/Habakkuk scroll fonts (Reconstructs) | **no free DSS font found** → share Stam Ashkenaz CLM | NEEDS-FONT |
| tannaim | Ben Kosba (Reconstructs, Bar Kokhba letters) | **not freely available** → Keter YG placeholder | NEEDS-FONT |
| amoraim | — chart gap, no exemplar survives — | Keter YG (closest, anachronistic) | CHART-GAP |
| geonim | Keter Aram Tzova / Keter YG / SBL Hebrew | Keter YG (free; Aleppo Codex); fallback SBL Hebrew | — |
| rashi | Mekor Rashi YG / BenOr Rashi (Reconstructs) | Mekorot Rashi (free) if obtainable, else flag | maybe NEEDS-FONT |
| rishonim | Koren Type $ (Reconstructs) | Shofar (Culmus, GPL+FE — Koren-inspired, chart-approved derivative) | SUBSTITUTE ($ Koren) |
| acharonim | Ezra SIL (Reconstructs, Bomberg 1524) | Ezra SIL (SIL OFL, free) | — |
| acharei | Frank Ruhl Libre (Reconstructs, 1908) | Frank Ruhl Libre (Google Fonts) | — |
| contemporary | Noto Sans / Rubik / Heebo | Noto Sans Hebrew (Google Fonts) | — |

Every entry in `fonts.js` carries `{ family, source, license, flag? }` so the UI can show
a small ⚠ on substituted/placeholder fonts.

## File layout
```
index.html  package.json  vite.config.js
src/main.jsx  src/App.jsx
src/api/sefaria.js       # fetchText(ref), fetchIndex(title), fetchNameRaw, tiny cache
src/lib/era.js           # classify(apiResponse) → {era, unclassified?}
src/lib/fonts.js         # ERA_FONTS map + flags
src/lib/fold.js          # Latin-script phonetic-skeleton fold (search key algorithm)
src/lib/nameSearch.js    # offline lexicon match + live fallback; searchTitles/resolveSelection
src/lib/hebrewSearch.js  # nikud stripping, Hebrew confusable-variant fallback, gematria helpers
src/lib/inputNormalize.js  # normalizeSourceInput, splitTitleAndAddress
src/components/AddSource.jsx  SourceCard.jsx  Sheet.jsx
src/styles.css  src/fonts.css
public/fonts/            # committed free font files
public/lexicon.json      # prebuilt offline title-search index (see docs/SEARCH.md)
scripts/build-lexicon.mjs  # regenerates public/lexicon.json from Sefaria's title index
docs/ARCHITECTURE.md  docs/FONTS.md  docs/SEARCH.md
README.md  CLAUDE.md  HANDOFF.md
```

(`src/lib/translitVariants.js` and the old per-keystroke API-fan-out search
path it supported were removed in Wave 2 of the search rewrite — subsumed by
the offline lexicon + fold-table approach above.)

## Search architecture

Source-search (the "add source" combobox: typing/pasting a ref and picking a
suggestion) has its own dedicated document — see **[docs/SEARCH.md](SEARCH.md)**
for the offline lexicon pipeline, the fold algorithm and its rule table, the
`public/lexicon.json` shape and regeneration instructions, the live-fallback
path, and the preserved live-API findings (nikud stripping, address-split
discovery, the gershayim/geresh bug, and why the Hebrew path stays a live
fan-out while the Latin path is offline-first).

## Sheet features (v1 scope)
Add by ref, remove, reorder (up/down buttons fine), sheet title, localStorage persistence,
print stylesheet for export. Nothing else.
