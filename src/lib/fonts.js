// Era -> font matrix, derived from the Ktav Ashuri font-era research chart
// (see docs/ARCHITECTURE.md "Era -> font" table and docs/FONTS.md for full
// licensing/provenance detail on every shipped file).
//
// Each era maps THREE styles:
//   casual     — historical-casual/cursive hand: maximum historical accuracy,
//                nikkud not required. May be null (see "STYLE-GAP").
//   formal     — historical-formal/square book hand: accuracy + readability,
//                nikkud nice-to-have.
//   accessible — modern readability with era vibes: nikkud REQUIRED.
//
// Every style entry is { family, source, license, flag, nikkud, taamim }.
// `family` is a full CSS font-family stack ending in a generic fallback
// (serif/sans-serif) so it's safe to drop directly into a style rule.
// `flag` is one of the FLAG_DESCRIPTIONS keys, or null if the chart's
// intended font (or a license-clean equivalent) is what's actually shipped.
// `nikkud`/`taamim` are "full" | "partial" | "none" — measured by scanning
// the shipped file's cmap (17 nikkud codepoints U+05B0-05BD/05C1/05C2/05C7;
// 31 taamim codepoints U+0591-05AF), not taken from upstream claims.

export const FLAG_DESCRIPTIONS = {
  "NEEDS-FONT":
    "No free/openly-licensed font could be found for this era's chart pick, so a placeholder font borrowed from a neighboring era is used instead.",
  "CHART-GAP":
    "The Ktav Ashuri chart has no surviving exemplar for this era; the closest available font is used as an anachronistic stand-in.",
  "SUBSTITUTE":
    "The chart's authentic pick is a paid font. A free, stylistically related font is substituted here; a user with a license for the real font can swap it in by editing this file.",
  "STYLE-GAP":
    "No historical font exists for this style in this era; falls back to the formal face.",
};

export const ERA_FONTS = {
  chumash: {
    casual: {
      family: '"Hebrew Paleo Qumran", serif',
      source:
        "Hebrew Paleo Qumran (Culmus Project — Yoram Gnat, Ancient Semitic Scripts collection, public/fonts/QUMRAN.TTF), paleo-Hebrew (ktav Ivri) script modeled on the paleo-Leviticus scroll 11QpaleoLev, Qumran.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "none",
      taamim: "none",
    },
    formal: {
      family: '"Stam Ashkenaz CLM", serif',
      source: "Culmus Project — Yoram Gnat, Sofer Stam Ashkenaz (public/fonts/StamAshkenazCLM.ttf)",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
    accessible: {
      family: '"Shlomo SemiStam", serif',
      source:
        "Shlomo SemiStam (Shlomo Orbach, public/fonts/ShlomoSemiStam.ttf), a semi-STAM face built on the Ezra SIL SR sources under the OFL.",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
  nach: {
    casual: {
      family: '"4Q417", serif',
      source:
        "4Q417 (Einat Tamir — Scripta Qumranica Electronica / Dead Sea Scrolls Project, University of Haifa, public/fonts/4Q417kern.ttf), reproducing the scribal hand of Qumran fragment 4Q417.",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "none",
      taamim: "none",
    },
    formal: {
      family: '"Hebrew Square Isaiah", serif',
      source:
        "Hebrew Square Isaiah (Culmus Project — Yoram Gnat, Ancient Semitic Scripts collection, public/fonts/HebrewSquareIsaiah.ttf), modeled on the Great Isaiah Scroll, Qumran (~2C BCE). " +
        "Hebrew Square Habakkuk (public/fonts/HebrewSquareHabakkuk.ttf), modeled on the Habakkuk Commentary/Pesher, Qumran (~0 CE), is also shipped as a stylistic alternate from the same collection.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "none",
      taamim: "none",
    },
    accessible: {
      family: '"Makabi YG", serif',
      source:
        "Makabi YG (Culmus Project — Yoram Gnat, public/fonts/MakabiYG.ttf), a modernized Great-Isaiah-Scroll face with nikkud (the shipped build scans full taamim coverage too).",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
  tannaim: {
    casual: {
      family: '"Hebrew Square BenKosba", serif',
      source:
        "Hebrew Square BenKosba (Culmus Project — Yoram Gnat, Ancient Semitic Scripts collection, public/fonts/HebrewSquareBenKosba.ttf), modeled on the Bar Kochba (Ben Kosba) letters, ~130 CE — a casual correspondence hand of the tannaitic period.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "none",
      taamim: "none",
    },
    formal: {
      family: '"Hebrew Square Habakkuk", serif',
      source:
        "Hebrew Square Habakkuk (Culmus Project — Yoram Gnat, Ancient Semitic Scripts collection, public/fonts/HebrewSquareHabakkuk.ttf), modeled on the Habakkuk Commentary/Pesher book hand, Qumran ~0 CE — slightly pre-tannaim, the closest surviving formal book hand.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "none",
      taamim: "none",
    },
    accessible: {
      family: '"Taamey David CLM", serif',
      source:
        "Taamey David CLM (Culmus Project — Yoram Gnat, public/fonts/TaameyDavidCLM-Medium.ttf), the David face extended with full nikkud and taamim.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
  amoraim: {
    casual: {
      family: '"Hebrew Square Bet Shearim", serif',
      source:
        "Hebrew Square Bet Shearim (Culmus Project — Yoram Gnat, Ancient Semitic Scripts collection, public/fonts/BETSHEAR.TTF), modeled on inscriptions from the Bet She'arim necropolis, ~3C CE.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "none",
      taamim: "none",
    },
    formal: {
      family: '"Keter YG", serif',
      source:
        "Chart has no surviving book-hand exemplar for this era; using Keter YG (Culmus Project, public/fonts/KeterYG-Medium.ttf) as the closest (anachronistic) available font.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: "CHART-GAP",
      nikkud: "full",
      taamim: "full",
    },
    accessible: {
      family: '"Hadasim CLM", serif',
      source:
        "Hadasim CLM (Culmus Project — Yoram Gnat, public/fonts/HadasimCLM-Regular.otf), with full nikkud and taamim.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
  geonim: {
    // No geonic cursive font exists — casual is a STYLE-GAP; getEraFont()
    // falls back to the formal face.
    casual: null,
    formal: {
      family: '"Keter Aram Tsova", serif',
      source:
        "Keter Aram Tsova (Culmus Project — Yoram Gnat, public/fonts/KeterAramTsova.ttf), modeled directly on the Aleppo Codex, ~10C CE.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
    accessible: {
      family: '"Keter YG", serif',
      source:
        "Keter YG (Culmus Project, public/fonts/KeterYG-Medium.ttf), a modernized Aleppo-Codex derivative. SBL Hebrew fallback was skipped (see docs/FONTS.md).",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
  rashi: {
    casual: {
      family: '"Mekorot Rashi", serif',
      source: "Mekorot Rashi (public/fonts/Mekorot-Rashi.ttf), based on the Culmus Drugulin CLM font.",
      license: "GPL (GNU GPL v2)",
      flag: null,
      nikkud: "partial",
      taamim: "none",
    },
    formal: {
      family: '"Taamey Ashkenaz", serif',
      source:
        "Taamey Ashkenaz (Culmus Project — Yoram Gnat, public/fonts/TaameyAshkenaz-Medium.ttf), based on medieval Ashkenazi square manuscript hands, full nikkud and taamim.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
    accessible: {
      family: '"Noto Rashi Hebrew", serif',
      source:
        "Noto Rashi Hebrew (Google Fonts, loaded via <link> in index.html) — Rashi-script letterforms with full nikkud and taamim.",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
  rishonim: {
    casual: {
      family: '"BenOr Rashi", serif',
      source:
        "BenOr Rashi (David ben Or, public/fonts/BenOrRashiRegular.otf), a rabbinic semi-cursive (Rashi-script family) face with full nikkud, no taamim.",
      license: "Ubuntu Font Licence 1.0",
      flag: null,
      nikkud: "full",
      taamim: "none",
    },
    formal: {
      family: '"Shofar", serif',
      source:
        "Chart's authentic pick is Koren Type (paid, not shippable; Koren itself derives from medieval Sephardi square hands). Substituting Shofar (Culmus Project, public/fonts/ShofarRegular.ttf), a free Koren-inspired derivative.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: "SUBSTITUTE",
      nikkud: "full",
      taamim: "full",
    },
    accessible: {
      family: '"David Libre", serif',
      source: "David Libre (Google Fonts, loaded via <link> in index.html).",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "partial",
    },
  },
  acharonim: {
    casual: {
      family: '"Mashkit", serif',
      source:
        "Mashkit (Refoyl Finkl, public/fonts/Mashkit.ttf), based on mashket (vaybertaytsh), the Ashkenazi semi-cursive print hand of the 16-19C.",
      license: "GPL+FE (GNU GPL v2 with font exception)",
      flag: null,
      nikkud: "full",
      taamim: "none",
    },
    formal: {
      family: '"Romm Vilna", serif',
      source:
        "Romm Vilna (Ilan Elovitz, public/fonts/RommVilna-Regular.ttf), evoking the square typeface of the Romm press's Vilna Shas. The shipped Regular build scans full nikkud and taamim.",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
    accessible: {
      family: '"Ezra SIL", serif',
      source:
        "Ezra SIL (SIL International, public/fonts/EzraSIL.ttf), modeled on the Bomberg 1524 Biblia Rabbinica typeface.",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
  acharei: {
    casual: {
      family: '"Solitreo", serif',
      source:
        "Solitreo (Nathan Gross / the Solitreo Project, public/fonts/Solitreo-Regular.ttf), Sephardic (Solitreo) cursive. The .ttf build is shipped for its partial nikkud; the .otf build has none.",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "partial",
      taamim: "none",
    },
    formal: {
      family: '"Frank Ruehl CLM", serif',
      source:
        "Frank Ruehl CLM (Culmus Project — Maxim Iorsh, public/fonts/FrankRuehlCLM-Medium.otf), digital revival of the 1908 Frank-Ruehl face, full nikkud and taamim.",
      license: "GPL (GNU GPL v2, no font exception)",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
    accessible: {
      family: '"Frank Ruhl Libre", serif',
      source: "Frank Ruhl Libre (Google Fonts, loaded via <link> in index.html), a revival of the 1908 Frank-Ruhl face.",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "none",
    },
  },
  contemporary: {
    casual: {
      family: '"Ktav Yad CLM", serif',
      source:
        "Ktav Yad CLM (Culmus Project — Maxim Iorsh, public/fonts/KtavYadCLM-MediumItalic.ttf), modern Israeli cursive handwriting. The family only ships Italic-named cuts; MediumItalic is its regular weight.",
      license: "GPL (GNU GPL v2, no font exception)",
      flag: null,
      nikkud: "none",
      taamim: "none",
    },
    formal: {
      family: '"David Libre", serif',
      source: "David Libre (Google Fonts, loaded via <link> in index.html; shared with rishonim/accessible).",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "partial",
    },
    accessible: {
      family: '"Noto Sans Hebrew", sans-serif',
      source: "Noto Sans Hebrew (Google Fonts, loaded via <link> in index.html).",
      license: "SIL Open Font License 1.1",
      flag: null,
      nikkud: "full",
      taamim: "full",
    },
  },
};

// Resolves an era + fontStyle ("casual" | "formal" | "accessible") to a
// style entry. Falls back through the era's other styles when the
// requested style has no font (e.g. geonim casual, a STYLE-GAP):
// formal first (the default look), then accessible, then casual; unknown
// eras land on contemporary/accessible as the last-resort face.
export function getEraFont(era, style) {
  const eraEntry = ERA_FONTS[era];
  if (eraEntry) {
    if (eraEntry[style]) return eraEntry[style];
    for (const fallback of ["formal", "accessible", "casual"]) {
      if (eraEntry[fallback]) return eraEntry[fallback];
    }
  }
  return ERA_FONTS.contemporary.accessible;
}
