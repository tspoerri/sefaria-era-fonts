# Fonts

All fonts in `public/fonts/` are free and openly licensed (SIL OFL or GPL+FE/GPL).
No paid fonts are committed to this repo. Source: [Culmus Project](https://culmus.sourceforge.io/)
fonts and [SIL International](https://software.sil.org/ezra/)'s Ezra SIL, retrieved via the
[aharonium/fonts](https://github.com/aharonium/fonts) open-source-fonts mirror (a GitHub
mirror of the Culmus/Open Siddur-adjacent font collections), plus Google Fonts for the two
web-fonts loaded directly in `index.html`.

| era | font shipped | file | license | flag / note |
|---|---|---|---|---|
| chumash | Stam Ashkenaz CLM | `public/fonts/StamAshkenazCLM.ttf` | GPL+FE (Culmus Project, Yoram Gnat) | — matches chart pick |
| nach | Stam Ashkenaz CLM (shared) | `public/fonts/StamAshkenazCLM.ttf` | GPL+FE | **NEEDS-FONT** — no free Dead Sea Scroll / Isaiah-Habakkuk-style font found; reusing the Chumash font as placeholder |
| tannaim | Keter YG (placeholder) | `public/fonts/KeterYG-Medium.ttf` | GPL+FE (Culmus Project, Yoram Gnat) | **NEEDS-FONT** — Ben Kosba / Bar Kokhba-letters style not freely available |
| amoraim | Keter YG | `public/fonts/KeterYG-Medium.ttf` | GPL+FE | **CHART-GAP** — chart has no surviving exemplar for this era; closest free font used anachronistically |
| geonim | Keter YG | `public/fonts/KeterYG-Medium.ttf` | GPL+FE | matches chart pick (Aleppo Codex tradition); SBL Hebrew fallback skipped, see below |
| rashi | Mekorot Rashi | `public/fonts/Mekorot-Rashi.ttf` | GPL (based on Culmus Drugulin CLM) | matches chart intent (free Rashi-script font) |
| rishonim | Shofar | `public/fonts/ShofarRegular.ttf` | GPL+FE (Culmus Project, Yoram Gnat) | **SUBSTITUTE ($ Koren)** — chart's real pick, Koren Type, is paid; Shofar is a free Koren-inspired derivative |
| acharonim | Ezra SIL | `public/fonts/EzraSIL.ttf` | SIL Open Font License 1.1 | matches chart pick (Bomberg 1524 style) |
| acharei | Frank Ruhl Libre | Google Fonts `<link>` (index.html) | SIL Open Font License 1.1 | matches chart pick — no local file needed |
| contemporary | Noto Sans Hebrew | Google Fonts `<link>` (index.html) | SIL Open Font License 1.1 | matches chart pick — no local file needed |

License files for every self-hosted font are committed alongside it in `public/fonts/`:
`StamAshkenazCLM-LICENSE.txt`, `KeterYG-LICENSE.txt`, `Shofar-LICENSE.txt`,
`Mekorot-Rashi-LICENSE.txt`, `Ezra-SIL-OFL.txt`, plus the shared `GNU-GPL-v2.txt` text
referenced by the Culmus Project's GPL+FE licenses.

## Skipped

- **SBL Hebrew** — official download exists at [sbl-site.org/resources/fonts](https://www.sbl-site.org/resources/fonts/),
  but its license restricts free use to individual scholars/non-profit purposes and
  requires a paid license or SBL Font Foundation membership for commercial use. That
  doesn't meet this project's "free and openly licensed (OFL/GPL+FE/explicitly free)"
  bar, so it was skipped rather than shipped. `geonim` in `src/lib/fonts.js` notes this;
  Keter YG alone covers that era.

## Paid fonts needing licensed replacement

These are the chart's real picks that are commercially licensed and were deliberately
**not** downloaded or shipped. A user with a valid license can drop the real font file
into `public/fonts/`, add an `@font-face` rule in `src/fonts.css`, and update the
matching entry's `family`/`flag` in `src/lib/fonts.js`.

| chart pick | era | why it's not shipped |
|---|---|---|
| Koren Type | rishonim | Commercial font sold by Koren Publishers; Shofar is substituted for free (see table above) |
| Ariana | (chart, not currently mapped to an era key) | Commercial/proprietary Hebrew typeface |
| Mugrabi | (chart, not currently mapped to an era key) | Commercial/proprietary Hebrew typeface |
| Shalom Old Style | (chart, not currently mapped to an era key) | Commercial/proprietary Hebrew typeface |
