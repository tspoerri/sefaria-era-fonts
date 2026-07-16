// Era -> font mapping, derived from the Ktav Ashuri font-era research chart
// (see docs/ARCHITECTURE.md "Era -> font" table and docs/FONTS.md for full
// licensing/provenance detail on every shipped file).
//
// Every entry is { family, source, license, flag }.
// `family` is a full CSS font-family stack ending in a generic fallback
// (serif/sans-serif) so it's safe to drop directly into a style rule.
// `flag` is one of the FLAG_DESCRIPTIONS keys, or null if the chart's
// intended font (or a license-clean equivalent) is what's actually shipped.

export const FLAG_DESCRIPTIONS = {
  "NEEDS-FONT":
    "No free/openly-licensed font could be found for this era's chart pick, so a placeholder font borrowed from a neighboring era is used instead.",
  "CHART-GAP":
    "The Ktav Ashuri chart has no surviving exemplar for this era; the closest available font is used as an anachronistic stand-in.",
  "SUBSTITUTE":
    "The chart's authentic pick is a paid font. A free, stylistically related font is substituted here; a user with a license for the real font can swap it in by editing this file.",
};

export const ERA_FONTS = {
  chumash: {
    family: '"Stam Ashkenaz CLM", serif',
    source: "Culmus Project — Yoram Gnat, Sofer Stam Ashkenaz (public/fonts/StamAshkenazCLM.ttf)",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: null,
  },
  nach: {
    family: '"Hebrew Square Isaiah", serif',
    source:
      "Hebrew Square Isaiah (Culmus Project — Yoram Gnat, Ancient Semitic Scripts collection, public/fonts/HebrewSquareIsaiah.ttf), modeled on the Great Isaiah Scroll, Qumran (~2C BCE). " +
      "Hebrew Square Habakkuk (public/fonts/HebrewSquareHabakkuk.ttf), modeled on the Habakkuk Commentary/Pesher, Qumran (~0 CE), is also shipped as a stylistic alternate from the same collection.",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: null,
  },
  tannaim: {
    family: '"Hebrew Square BenKosba", serif',
    source:
      "Hebrew Square BenKosba (Culmus Project — Yoram Gnat, Ancient Semitic Scripts collection, public/fonts/HebrewSquareBenKosba.ttf), modeled on the Bar Kochba (Ben Kosba) letters, ~130 CE.",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: null,
  },
  amoraim: {
    family: '"Keter YG", serif',
    source:
      "Chart has no surviving exemplar for this era; using Keter YG (Culmus Project, public/fonts/KeterYG-Medium.ttf) as the closest (anachronistic) available font.",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: "CHART-GAP",
  },
  geonim: {
    family: '"Keter YG", serif',
    source:
      "Keter YG (Culmus Project, public/fonts/KeterYG-Medium.ttf), modeled on the Aleppo Codex tradition, per chart. SBL Hebrew fallback was skipped (see docs/FONTS.md).",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: null,
  },
  rashi: {
    family: '"Mekorot Rashi", serif',
    source: "Mekorot Rashi (public/fonts/Mekorot-Rashi.ttf), based on the Culmus Drugulin CLM font.",
    license: "GPL (GNU GPL v2)",
    flag: null,
  },
  rishonim: {
    family: '"Shofar", serif',
    source:
      "Chart's authentic pick is Koren Type (paid, not shippable). Substituting Shofar (Culmus Project, public/fonts/ShofarRegular.ttf), a free Koren-inspired derivative.",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: "SUBSTITUTE",
  },
  acharonim: {
    family: '"Ezra SIL", serif',
    source: "Ezra SIL (SIL International, public/fonts/EzraSIL.ttf), modeled on the Bomberg 1524 Biblia Rabbinica typeface.",
    license: "SIL Open Font License 1.1",
    flag: null,
  },
  acharei: {
    family: '"Frank Ruhl Libre", serif',
    source: "Frank Ruhl Libre (Google Fonts, loaded via <link> in index.html), a revival of the 1908 Frank-Ruhl face.",
    license: "SIL Open Font License 1.1",
    flag: null,
  },
  contemporary: {
    family: '"Noto Sans Hebrew", sans-serif',
    source: "Noto Sans Hebrew (Google Fonts, loaded via <link> in index.html).",
    license: "SIL Open Font License 1.1",
    flag: null,
  },
};
