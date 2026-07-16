// The 37 tractates of the Babylonian Talmud that have Gemara (i.e.
// excluding Avot and Kinnim, and the Gemara-less Mishnah-only tractates),
// with their canonical Sefaria English title and standard (unvocalized)
// Hebrew name. Used by `rewriteGemaraDafAddress` (src/lib/inputNormalize.js,
// SPEC.md Wave 1 item 3) to gate Hebrew daf-amud address parsing: it only
// activates when the query's title portion resolves to one of these.
//
// English titles match Sefaria's canonical index titles exactly (needed for
// the output ref to resolve, e.g. "Berakhot 12a").
export const tractates = [
  { en: "Berakhot", he: "ברכות" },
  { en: "Shabbat", he: "שבת" },
  { en: "Eruvin", he: "עירובין" },
  { en: "Pesachim", he: "פסחים" },
  { en: "Rosh Hashanah", he: "ראש השנה" },
  { en: "Yoma", he: "יומא" },
  { en: "Sukkah", he: "סוכה" },
  { en: "Beitzah", he: "ביצה" },
  { en: "Taanit", he: "תענית" },
  { en: "Megillah", he: "מגילה" },
  { en: "Moed Katan", he: "מועד קטן" },
  { en: "Chagigah", he: "חגיגה" },
  { en: "Yevamot", he: "יבמות" },
  { en: "Ketubot", he: "כתובות" },
  { en: "Nedarim", he: "נדרים" },
  { en: "Nazir", he: "נזיר" },
  { en: "Sotah", he: "סוטה" },
  { en: "Gittin", he: "גיטין" },
  { en: "Kiddushin", he: "קידושין" },
  { en: "Bava Kamma", he: "בבא קמא" },
  { en: "Bava Metzia", he: "בבא מציעא" },
  { en: "Bava Batra", he: "בבא בתרא" },
  { en: "Sanhedrin", he: "סנהדרין" },
  { en: "Makkot", he: "מכות" },
  { en: "Shevuot", he: "שבועות" },
  { en: "Avodah Zarah", he: "עבודה זרה" },
  { en: "Horayot", he: "הוריות" },
  { en: "Zevachim", he: "זבחים" },
  { en: "Menachot", he: "מנחות" },
  { en: "Chullin", he: "חולין" },
  { en: "Bekhorot", he: "בכורות" },
  { en: "Arakhin", he: "ערכין" },
  { en: "Temurah", he: "תמורה" },
  { en: "Keritot", he: "כריתות" },
  { en: "Meilah", he: "מעילה" },
  { en: "Tamid", he: "תמיד" },
  { en: "Niddah", he: "נדה" },
];

// Trailing punctuation ("."/":" left over from an un-split address token,
// or a stray geresh/gershayim) is stripped before comparing, so callers
// don't need to pre-clean the title portion themselves.
function cleanTitle(title) {
  return (title || "").trim().replace(/[.:״׳]+$/, "").trim();
}

/**
 * True if `title` names a Talmud Bavli tractate with Gemara, matched
 * case-insensitively against the canonical English title or exactly
 * against the standard Hebrew name (Hebrew has no case).
 */
export function isTractateTitle(title) {
  const cleaned = cleanTitle(title).toLowerCase();
  if (!cleaned) return false;
  return tractates.some((t) => t.en.toLowerCase() === cleaned || t.he === cleanTitle(title));
}

/** Canonical Sefaria English title for a tractate name (English or Hebrew), or null. */
export function tractateEnglishName(title) {
  const cleanedEn = cleanTitle(title).toLowerCase();
  const cleanedRaw = cleanTitle(title);
  const match = tractates.find((t) => t.en.toLowerCase() === cleanedEn || t.he === cleanedRaw);
  return match ? match.en : null;
}
