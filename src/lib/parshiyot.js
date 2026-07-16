// The 54 weekly Torah portions (parshiyot), in Torah-reading order, with the
// book and Jewish-numbering chapter:verse range each one spans. Used by
// `rewriteSearchMarkers` (src/lib/inputNormalize.js) to turn a typed
// "parshas NAME" / "parshat NAME" search into the ref Sefaria understands
// (e.g. "parshas Noach" -> "Genesis 6:9-11:32"). `name` is matched via
// fold() (src/lib/fold.js), so Ashkenazi/Sephardi/folk spellings
// ("Vayeitzei" for "Vayetzei") resolve to the same entry without needing a
// second alias field.
//
// Ranges follow the standard Jewish chapter:verse numbering (as used by
// Sefaria itself and by Artscroll/Koren/Chabad calendars) — this matters at
// a handful of boundaries where Christian Bible numbering shifts by a verse
// (e.g. Ki Tavo/Nitzavim split at Deuteronomy 29:8/29:9, not 29:9/29:10).
export const parshiyot = [
  // Bereshit (Genesis) — 12
  { name: "Bereshit", book: "Genesis", range: "1:1-6:8" },
  { name: "Noach", book: "Genesis", range: "6:9-11:32" },
  { name: "Lech Lecha", book: "Genesis", range: "12:1-17:27" },
  { name: "Vayera", book: "Genesis", range: "18:1-22:24" },
  { name: "Chayei Sarah", book: "Genesis", range: "23:1-25:18" },
  { name: "Toldot", book: "Genesis", range: "25:19-28:9" },
  { name: "Vayetzei", book: "Genesis", range: "28:10-32:3" },
  { name: "Vayishlach", book: "Genesis", range: "32:4-36:43" },
  { name: "Vayeshev", book: "Genesis", range: "37:1-40:23" },
  { name: "Miketz", book: "Genesis", range: "41:1-44:17" },
  { name: "Vayigash", book: "Genesis", range: "44:18-47:27" },
  { name: "Vayechi", book: "Genesis", range: "47:28-50:26" },

  // Shemot (Exodus) — 11
  { name: "Shemot", book: "Exodus", range: "1:1-6:1" },
  { name: "Vaera", book: "Exodus", range: "6:2-9:35" },
  { name: "Bo", book: "Exodus", range: "10:1-13:16" },
  { name: "Beshalach", book: "Exodus", range: "13:17-17:16" },
  { name: "Yitro", book: "Exodus", range: "18:1-20:23" },
  { name: "Mishpatim", book: "Exodus", range: "21:1-24:18" },
  { name: "Terumah", book: "Exodus", range: "25:1-27:19" },
  { name: "Tetzaveh", book: "Exodus", range: "27:20-30:10" },
  { name: "Ki Tisa", book: "Exodus", range: "30:11-34:35" },
  { name: "Vayakhel", book: "Exodus", range: "35:1-38:20" },
  { name: "Pekudei", book: "Exodus", range: "38:21-40:38" },

  // Vayikra (Leviticus) — 10
  { name: "Vayikra", book: "Leviticus", range: "1:1-5:26" },
  { name: "Tzav", book: "Leviticus", range: "6:1-8:36" },
  { name: "Shmini", book: "Leviticus", range: "9:1-11:47" },
  { name: "Tazria", book: "Leviticus", range: "12:1-13:59" },
  { name: "Metzora", book: "Leviticus", range: "14:1-15:33" },
  { name: "Achrei Mot", book: "Leviticus", range: "16:1-18:30" },
  { name: "Kedoshim", book: "Leviticus", range: "19:1-20:27" },
  { name: "Emor", book: "Leviticus", range: "21:1-24:23" },
  { name: "Behar", book: "Leviticus", range: "25:1-26:2" },
  { name: "Bechukotai", book: "Leviticus", range: "26:3-27:34" },

  // Bamidbar (Numbers) — 10
  { name: "Bamidbar", book: "Numbers", range: "1:1-4:20" },
  { name: "Nasso", book: "Numbers", range: "4:21-7:89" },
  { name: "Beha'alotcha", book: "Numbers", range: "8:1-12:16" },
  { name: "Sh'lach", book: "Numbers", range: "13:1-15:41" },
  { name: "Korach", book: "Numbers", range: "16:1-18:32" },
  { name: "Chukat", book: "Numbers", range: "19:1-22:1" },
  { name: "Balak", book: "Numbers", range: "22:2-25:9" },
  { name: "Pinchas", book: "Numbers", range: "25:10-30:1" },
  { name: "Matot", book: "Numbers", range: "30:2-32:42" },
  { name: "Masei", book: "Numbers", range: "33:1-36:13" },

  // Devarim (Deuteronomy) — 11
  { name: "Devarim", book: "Deuteronomy", range: "1:1-3:22" },
  { name: "Vaetchanan", book: "Deuteronomy", range: "3:23-7:11" },
  { name: "Eikev", book: "Deuteronomy", range: "7:12-11:25" },
  { name: "Re'eh", book: "Deuteronomy", range: "11:26-16:17" },
  { name: "Shoftim", book: "Deuteronomy", range: "16:18-21:9" },
  { name: "Ki Teitzei", book: "Deuteronomy", range: "21:10-25:19" },
  { name: "Ki Tavo", book: "Deuteronomy", range: "26:1-29:8" },
  { name: "Nitzavim", book: "Deuteronomy", range: "29:9-30:20" },
  { name: "Vayeilech", book: "Deuteronomy", range: "31:1-30" },
  { name: "Ha'azinu", book: "Deuteronomy", range: "32:1-52" },
  { name: "V'Zot HaBerachah", book: "Deuteronomy", range: "33:1-34:12" },
];
