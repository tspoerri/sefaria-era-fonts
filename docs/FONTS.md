# Fonts

All fonts in `public/fonts/` are free and openly licensed (SIL OFL, GPL+FE/GPL, or
Ubuntu Font Licence). No paid fonts are committed to this repo. Sources: the
[Culmus Project](https://culmus.sourceforge.io/), [SIL International](https://software.sil.org/ezra/),
the Scripta Qumranica Electronica / Dead Sea Scrolls Project (University of Haifa),
and independent authors (Shlomo Orbach, David ben Or, Refoyl Finkl, Ilan Elovitz,
Nathan Gross), retrieved via the [aharonium/fonts](https://github.com/aharonium/fonts)
open-source-fonts mirror (the Open Siddur Project's font-pack mirror), plus Google Fonts
for the web-fonts loaded directly in `index.html`.

## The era × style matrix

Each era ships THREE styles, selected by the global `fontStyle` setting (default
"formal"; per-source overridable via the outline sidebar):

- **casual** — historical-casual/cursive hand: maximum historical accuracy, nikkud not required
- **formal** — historical-formal/square book hand: accuracy + readability, nikkud nice-to-have
- **accessible** — modern readability with era vibes: nikkud required

Nikkud/taamim values below are **measured** (cmap scan of the shipped file: 17 nikkud
codepoints U+05B0–05BD/05C1/05C2/05C7, 31 taamim codepoints U+0591–05AF), not upstream
claims.

### chumash
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | Hebrew Paleo Qumran | `QUMRAN.TTF` | GPL+FE (Culmus — Ancient Semitic Scripts, Yoram Gnat) | none / none | Paleo-Hebrew (ktav Ivri), modeled on the paleo-Leviticus scroll 11QpaleoLev, Qumran |
| formal | Stam Ashkenaz CLM | `StamAshkenazCLM.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / full | Sofer Stam Ashkenaz — chart pick |
| accessible | Shlomo SemiStam | `ShlomoSemiStam.ttf` | SIL OFL 1.1 (Shlomo Orbach) | full / full | Semi-STAM face built on the Ezra SIL SR sources (the file's internal name tables still read "Ezra SIL SR") |

### nach
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | 4Q417 | `4Q417kern.ttf` | SIL OFL 1.1 (Einat Tamir — Scripta Qumranica Electronica / Univ. of Haifa) | none / none | Reproduces the scribal hand of Qumran fragment 4Q417 (Musar leMevin). Credit line: "courtesy of the Dead Sea Scrolls Project, University of Haifa" |
| formal | Hebrew Square Isaiah | `HebrewSquareIsaiah.ttf` | GPL+FE (Culmus — Ancient Semitic Scripts) | none / none | Great Isaiah Scroll, Qumran (~2C BCE). Alternate: Hebrew Square Habakkuk (`HebrewSquareHabakkuk.ttf`), Habakkuk Pesher (~0 CE), also shipped |
| accessible | Makabi YG | `MakabiYG.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / **full** | Modernized Great-Isaiah-Scroll face. (Upstream describes it as vowels-only, but the shipped build scans full taamim coverage too.) |

### tannaim
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | Hebrew Square BenKosba | `HebrewSquareBenKosba.ttf` | GPL+FE (Culmus — Ancient Semitic Scripts) | none / none | Bar Kochba (Ben Kosba) letters, ~130 CE — a casual correspondence hand of the period |
| formal | Hebrew Square Habakkuk | `HebrewSquareHabakkuk.ttf` | GPL+FE (Culmus — Ancient Semitic Scripts) | none / none | Habakkuk Pesher book hand, Qumran ~0 CE — slightly pre-tannaim; the closest surviving formal book hand |
| accessible | Taamey David CLM | `TaameyDavidCLM-Medium.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / full | David face extended with full nikkud+taamim |

### amoraim
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | Hebrew Square Bet Shearim | `BETSHEAR.TTF` | GPL+FE (Culmus — Ancient Semitic Scripts) | none / none | Bet She'arim necropolis inscriptions, ~3C CE |
| formal | Keter YG | `KeterYG-Medium.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / full | **CHART-GAP** — no surviving book-hand exemplar for this era; anachronistic stand-in |
| accessible | Hadasim CLM | `HadasimCLM-Regular.otf` | GPL+FE (Culmus, Yoram Gnat) | full / full | Per the Culmus collection LICENSE the Hadasim family carries the font exception. The true Regular cut was fetched from the aharonium mirror (only Bold/oblique cuts were installed locally) |

### geonim
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | — | — | — | — | **STYLE-GAP** — no geonic cursive font exists; falls back to the formal face |
| formal | Keter Aram Tsova | `KeterAramTsova.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / full | Modeled directly on the Aleppo Codex, ~10C CE |
| accessible | Keter YG | `KeterYG-Medium.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / full | Modernized Aleppo-Codex derivative. SBL Hebrew fallback skipped, see below |

### rashi
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | Mekorot Rashi | `Mekorot-Rashi.ttf` | GPL (based on Culmus Drugulin CLM) | partial (16/17) / none | Rashi script |
| formal | Taamey Ashkenaz | `TaameyAshkenaz-Medium.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / full | Medieval Ashkenazi square manuscript hands |
| accessible | Noto Rashi Hebrew | Google Fonts `<link>` | SIL OFL 1.1 | full / full | Rashi-script letterforms with modern readability |

### rishonim
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | BenOr Rashi | `BenOrRashiRegular.otf` | Ubuntu Font Licence 1.0 (David ben Or) | full / none | Rabbinic semi-cursive (Rashi-script family) |
| formal | Shofar | `ShofarRegular.ttf` | GPL+FE (Culmus, Yoram Gnat) | full / full | **SUBSTITUTE ($ Koren)** — chart's pick, Koren Type, is paid; Shofar is a free Koren-inspired derivative (Koren itself derives from medieval Sephardi square hands) |
| accessible | David Libre | Google Fonts `<link>` | SIL OFL 1.1 | full / partial (30/31) | Modern David face |

### acharonim
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | Mashkit | `Mashkit.ttf` | GPL+FE (Refoyl Finkl) | full / none | Based on mashket (vaybertaytsh), the Ashkenazi semi-cursive print hand of the 16–19C |
| formal | Romm Vilna | `RommVilna-Regular.ttf` | SIL OFL 1.1 (Ilan Elovitz) | full / full | Evokes the square typeface of the Romm press's Vilna Shas. The local Regular build scans full nikkud+taamim (the aharonium mirror copy was reported without; the shipped file was verified directly) |
| accessible | Ezra SIL | `EzraSIL.ttf` | SIL OFL 1.1 (SIL International) | full / full | Bomberg 1524 Biblia Rabbinica style |

### acharei
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | Solitreo | `Solitreo-Regular.ttf` | SIL OFL 1.1 (Nathan Gross / the Solitreo Project) | partial (15/17) / none | Sephardic (Solitreo) cursive. The .ttf build is shipped for its nikkud; the .otf build has none |
| formal | Frank Ruehl CLM | `FrankRuehlCLM-Medium.otf` | GPL v2, **no font exception** (Culmus, Maxim Iorsh) | full / full | Digital revival of the 1908 Frank-Ruehl face |
| accessible | Frank Ruhl Libre | Google Fonts `<link>` | SIL OFL 1.1 | full / none | Libre revival of the same 1908 face |

### contemporary
| style | font | file | license | nikkud / taamim | provenance |
|---|---|---|---|---|---|
| casual | Ktav Yad CLM | `KtavYadCLM-MediumItalic.ttf` | GPL v2, **no font exception** (Culmus, Maxim Iorsh) | none / none | Modern Israeli cursive handwriting. The family only ships Italic-named cuts; MediumItalic is its regular weight |
| formal | David Libre | Google Fonts `<link>` | SIL OFL 1.1 | full / partial (30/31) | Shared with rishonim/accessible |
| accessible | Noto Sans Hebrew | Google Fonts `<link>` | SIL OFL 1.1 | full / full | Chart pick |

## Licenses

License files for every self-hosted font are committed alongside it in `public/fonts/`.
Shared texts: `GNU-GPL-v2.txt` (referenced by all GPL/GPL+FE headers), `SIL-OFL-1.1.txt`
(referenced by the OFL headers added in the matrix batch), `Ubuntu-Font-License.txt`
(BenOr Rashi), and `Ezra-SIL-OFL.txt` (Ezra SIL's own header + full OFL, pre-matrix
convention).

Per-font headers: `StamAshkenazCLM-LICENSE.txt`, `KeterYG-LICENSE.txt`,
`Shofar-LICENSE.txt`, `Mekorot-Rashi-LICENSE.txt`, `HebrewSquareIsaiah-LICENSE.txt`,
`HebrewSquareHabakkuk-LICENSE.txt`, `HebrewSquareBenKosba-LICENSE.txt`,
`HebrewPaleoQumran-LICENSE.txt`, `HebrewSquareBetShearim-LICENSE.txt`,
`4Q417-LICENSE.txt`, `MakabiYG-LICENSE.txt`, `ShlomoSemiStam-LICENSE.txt`,
`TaameyDavidCLM-LICENSE.txt`, `HadasimCLM-LICENSE.txt`, `KeterAramTsova-LICENSE.txt`,
`TaameyAshkenaz-LICENSE.txt`, `BenOrRashi-LICENSE.txt`, `Mashkit-LICENSE.txt`,
`RommVilna-LICENSE.txt`, `Solitreo-LICENSE.txt`, `FrankRuehlCLM-LICENSE.txt`,
`KtavYadCLM-LICENSE.txt`.

License notes recorded during sourcing:

- **Frank Ruehl CLM & Ktav Yad CLM are plain GPL v2** (the Culmus "Maxim Iorsh"
  collection LICENSE lists font-embedding exceptions per family; these two families'
  entries carry none). Serving unmodified files with their license via @font-face is
  fine; embedding them in distributed documents (PDF export) may place the document
  under the GPL. All other Culmus files here are GPL+FE.
- **Mashkit** ships no standalone license upstream; the aharonium mirror classifies it
  GPL+FE, recorded as such in `Mashkit-LICENSE.txt`.
- **Romm Vilna**'s upstream OFL file carries a leftover template copyright line
  ("Cinzel", Natanael Gama); the operative license is OFL 1.1 per the distributing
  repo's classification. Noted in `RommVilna-LICENSE.txt`.
- **4Q417**'s upstream LICENSE.txt is a usage README rather than a license text; the
  distributing repo classifies the SQE fonts as SIL OFL. Noted in `4Q417-LICENSE.txt`.
- **Shlomo SemiStam** is an OFL derivative of Ezra SIL SR (internal name tables
  unchanged); distributed under the non-reserved "Shlomo" name, which the OFL permits.
- **Mekorot** fonts are LPPL in the aharonium tree; the Mekorot Rashi file shipped here
  descends from Culmus Drugulin CLM and carries the GPL header recorded in
  `Mekorot-Rashi-LICENSE.txt` (pre-matrix, unchanged).

## Skipped

- **SBL Hebrew** — official download exists at [sbl-site.org/resources/fonts](https://www.sbl-site.org/resources/fonts/),
  but its license restricts free use to individual scholars/non-profit purposes and
  requires a paid license or SBL Font Foundation membership for commercial use. That
  doesn't meet this project's "free and openly licensed (OFL/GPL+FE/explicitly free)"
  bar, so it was skipped rather than shipped. Keter Aram Tsova / Keter YG cover geonim.
- **Solitreo.otf** — the OpenType build of Solitreo has zero nikkud coverage; the .ttf
  build (partial, 15/17) is shipped instead.
- (Historical) the original single-font-per-era table carried **NEEDS-FONT** flags for
  nach and tannaim until the Ancient Semitic Scripts faces landed; those flags are
  resolved and the flag now survives only in `FLAG_DESCRIPTIONS` for future gaps.

## Paid fonts needing licensed replacement

These are the chart's real picks that are commercially licensed and were deliberately
**not** downloaded or shipped. A user with a valid license can drop the real font file
into `public/fonts/`, add an `@font-face` rule in `src/fonts.css`, and update the
matching entry's `family`/`flag` in `src/lib/fonts.js`.

| chart pick | era | why it's not shipped |
|---|---|---|
| Koren Type | rishonim (formal) | Commercial font sold by Koren Publishers; Shofar is substituted for free (see table above) |
| Ariana | (chart, not currently mapped to an era key) | Commercial/proprietary Hebrew typeface |
| Mugrabi | (chart, not currently mapped to an era key) | Commercial/proprietary Hebrew typeface |
| Shalom Old Style | (chart, not currently mapped to an era key) | Commercial/proprietary Hebrew typeface |
