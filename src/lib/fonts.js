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
    family: '"Stam Ashkenaz CLM", serif',
    source:
      "No free Dead Sea Scroll / Isaiah-Habakkuk-scroll-style font was found; sharing Stam Ashkenaz CLM (Culmus Project, public/fonts/StamAshkenazCLM.ttf) as a placeholder.",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: "NEEDS-FONT",
  },
  tannaim: {
    family: '"Keter YG", serif',
    source:
      "No free Ben Kosba / Bar Kokhba-letters-style font was found; using Keter YG (Culmus Project, public/fonts/KeterYG-Medium.ttf) as a placeholder.",
    license: "GPL+FE (GNU GPL v2 with font exception)",
    flag: "NEEDS-FONT",
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
