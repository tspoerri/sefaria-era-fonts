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
| nach | Hebrew Square Isaiah | `public/fonts/HebrewSquareIsaiah.ttf` | GPL+FE (Culmus Project — Ancient Semitic Scripts, Yoram Gnat) | matches chart intent — modeled on the Great Isaiah Scroll, Qumran (~2C BCE); resolves prior **NEEDS-FONT** flag. Alternate: Hebrew Square Habakkuk (`public/fonts/HebrewSquareHabakkuk.ttf`, same license), modeled on the Habakkuk Commentary/Pesher, Qumran (~0 CE), also shipped |
| tannaim | Hebrew Square BenKosba | `public/fonts/HebrewSquareBenKosba.ttf` | GPL+FE (Culmus Project — Ancient Semitic Scripts, Yoram Gnat) | matches chart intent — modeled on the Bar Kochba (Ben Kosba) letters, ~130 CE; resolves prior **NEEDS-FONT** flag |
| amoraim | Keter YG | `public/fonts/KeterYG-Medium.ttf` | GPL+FE | **CHART-GAP** — chart has no surviving exemplar for this era; closest free font used anachronistically |
| geonim | Keter YG | `public/fonts/KeterYG-Medium.ttf` | GPL+FE | matches chart pick (Aleppo Codex tradition); SBL Hebrew fallback skipped, see below |
| rashi | Mekorot Rashi | `public/fonts/Mekorot-Rashi.ttf` | GPL (based on Culmus Drugulin CLM) | matches chart intent (free Rashi-script font) |
| rishonim | Shofar | `public/fonts/ShofarRegular.ttf` | GPL+FE (Culmus Project, Yoram Gnat) | **SUBSTITUTE ($ Koren)** — chart's real pick, Koren Type, is paid; Shofar is a free Koren-inspired derivative |
| acharonim | Ezra SIL | `public/fonts/EzraSIL.ttf` | SIL Open Font License 1.1 | matches chart pick (Bomberg 1524 style) |
| acharei | Frank Ruhl Libre | Google Fonts `<link>` (index.html) | SIL Open Font License 1.1 | matches chart pick — no local file needed |
| contemporary | Noto Sans Hebrew | Google Fonts `<link>` (index.html) | SIL Open Font License 1.1 | matches chart pick — no local file needed |

License files for every self-hosted font are committed alongside it in `public/fonts/`:
`StamAshkenazCLM-LICENSE.txt`, `KeterYG-LICENSE.txt`, `Shofar-LICENSE.txt`,
`Mekorot-Rashi-LICENSE.txt`, `Ezra-SIL-OFL.txt`, `HebrewSquareIsaiah-LICENSE.txt`,
`HebrewSquareHabakkuk-LICENSE.txt`, `HebrewSquareBenKosba-LICENSE.txt`, plus the shared
`GNU-GPL-v2.txt` text referenced by the Culmus Project's GPL+FE licenses.

The three "Hebrew Square" fonts (Isaiah, Habakkuk, BenKosba) come from the same Culmus
Project author (Yoram Gnat) as Stam Ashkenaz CLM and Keter YG, under the same GPL+FE
license, but from a different sub-package: "Ancient Semitic Scripts" v0.06-1
(mirrored at [aharonium/fonts](https://github.com/aharonium/fonts), also described at
[culmus.sourceforge.io/ancient](https://culmus.sourceforge.io/ancient/index.html)). That
collection ships period-accurate square-script faces modeled directly on Dead Sea Scrolls
exemplars (Great Isaiah Scroll, Habakkuk Commentary/Pesher) and the Bar Kochba/Ben Kosba
letters — a direct hit for the `nach` and `tannaim` chart intents that were previously
unfulfilled. cmap coverage of the full Hebrew block (U+05D0–U+05EA, all 27 letter forms
including finals) was confirmed via `fc-query` on all three files; live in-browser render
verification is deferred to Wave 4.

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
