# sefaria-era-fonts

A prototype source-sheet builder: add sources by ref, and each one renders
its Hebrew text in a font matching the era in which that text was written —
Chumash, Nach, Tannaim, Amoraim, Geonim, Rashi, Rishonim, Acharonim,
Acharei, or Contemporary. The font-to-era mapping comes from an independent
research chart cataloging historical Hebrew script styles per era; see
`docs/ARCHITECTURE.md` for the full mapping table.

This is an overnight prototype, not a production tool: plain JS (no
TypeScript), no backend, no auth, no persistence beyond the browser's
localStorage.

## Quickstart

```
npm install
npm run dev
```

Then open the printed local URL. Type a ref into the input (e.g.
`Genesis 1:1`, `Mishnah Berakhot 1:1`, `Rashi on Genesis 1:1`,
`Shulchan Arukh, Orach Chayim 1:1`) and click Add. Use the up/down arrows
to reorder sources, the ✕ to remove one, and "Print / Export" (browser
print-to-PDF) to export the sheet.

## How era classification works

Each added source is fetched from the Sefaria API and run through a
priority-ordered classifier (`src/lib/era.js`): Rashi commentary and
Tanakh books are recognized directly from the ref/category; Mishnah,
Tosefta, and halachic midrash map to Tannaim; Talmud and aggadic midrash
map to Amoraim; everything else falls back to a Sefaria index lookup for
that work's composition era code. Anything that still can't be resolved
is labeled Contemporary and flagged "unclassified" on its card. Full
details and the exact priority order live in `docs/ARCHITECTURE.md`.

## Font licensing

No paid fonts are included in this repo. Every era in the research chart
that calls for a paid font has been substituted with a free (OFL/GPL+FE or
Google Fonts) alternative — most notably, the chart's true Rishonim pick,
**Koren Type** (a paid commercial font), is substituted here with **Culmus
Shofar**, a free Koren-inspired derivative. Several other eras (Nach,
Tannaim, and possibly Rashi) use flagged placeholder fonts because no free
font matching the chart's exemplar could be found — these are marked with
a ⚠ badge in the UI. See `docs/FONTS.md` for the full per-era licensing
breakdown and source links.

## Data source

This prototype calls Sefaria's public, CORS-enabled REST API
(`https://www.sefaria.org/api/...`) directly from the browser. It is an
independent project and is **not affiliated with or endorsed by Sefaria**.
