# HANDOFF

**Next action:** Run `npm run dev`, open http://localhost:5173, and decide which flagged font gaps to fill first (see docs/FONTS.md — nach and tannaim placeholders are the weakest).

## Current state (2026-07-15, added source-search autocomplete)
- Rebuilt `AddSource` as a debounced combobox backed by Sefaria's own
  `/api/name/{query}` endpoint (src/api/sefaria.js:`fetchNameSuggestions`),
  which already does typo-tolerant, transliteration-aware, Hebrew+English
  title matching — no client-side fuzzy-matching library needed.
- src/lib/inputNormalize.js: `normalizeSourceInput` strips pasted-URL
  wrapping (extracts the ref path from a sefaria.org URL, drops the query
  string), repeated percent-decoding, `+`/`_` as spaces, smart quotes/dashes,
  NBSP, zero-width/directional marks, and stray wrapping punctuation.
  `splitTitleAndAddress` peels a trailing chapter:verse token (e.g. "1:1" off
  "Genessis 1:1") before querying suggestions, since the name API's typo
  tolerance only works well against title text, not title+address combined —
  discovered by testing "Genessis 1" live (returned garbage until split).
  The address is reattached when a suggestion is picked.
  Verified live: typo "Genessis 1:1" -> Genesis 1:1 (Stam Ashkenaz CLM);
  pasted URL `sefaria.org/Mishnah_Berakhot.1.1?lang=bi` -> Mishnah Berakhot
  1:1 (Keter YG); Hebrew `רש"י על בראשית א:א` -> Rashi on Genesis 1:1
  (Mekorot Rashi). Keyboard nav (arrows/enter/escape/tab) and
  click-outside-to-close work; free-typing without picking a suggestion
  still submits as before.
  Bug found + fixed during verification: the address-split regex only
  recognized ASCII-digit-led trailing tokens, so a Hebrew gematira address
  like "א:א" (no ASCII digits) wasn't split off — the suggestion click
  silently dropped it, adding "Rashi on Genesis" (the whole book) instead of
  1:1. Fixed by also splitting on a trailing token containing ":" or Hebrew
  geresh/gershayim marks (א׳, כ״ג), not just ASCII-digit-led ones.
- src/lib/hebrewSearch.js (new): `stripNikud` removes the vowel-point/
  cantillation combining-mark block (֑-ׇ) — confirmed live that
  both Sefaria's texts and name APIs 404/return-junk on vocalized text, so
  this now runs inside `normalizeSourceInput` before either endpoint sees
  the string. `generateHebrewVariants` builds alternate spellings from a
  hand-built confusable-letter map (homophone groups: א/ע, ב/ו, כ/ח/ק, ת/ט,
  ס/ש; plus adjacent-key pairs on the standard Israeli keyboard layout,
  row-by-row). `fetchNameSuggestionsRobust` (src/api/sefaria.js) tries the
  direct query first and only fires off the (capped at 6) variant queries in
  parallel when the direct query returns fewer than 3 results and the text
  is Hebrew — keeps the common case to one API call. Verified live: "טלמוד
  בבלי" (ת typo'd as ט) returns empty from Sefaria directly but resolves to
  Talmud-related results through the fallback; curl-verified the same for
  "כומש" (כ/ח confusion) vs. חומש.
- Added `.claude/launch.json` (`npm run dev` on 5173) so the browser preview
  tool can start the dev server directly.

## Prior state (2026-07-15, overnight build COMPLETE and verified)
- Working prototype at commit "Working scaffold…". `npm install && npm run dev` → localhost:5173.
- Verified live in the browser: Genesis 1:1 (Chumash → Stam Ashkenaz CLM, real STAM
  letterforms with tagin), Rashi on Genesis 1:1 (→ Mekorot Rashi script), Mishneh Torah
  (Rishonim → Shofar, ⚠ Koren substitute), Mishnah Berakhot (Tannaim → Keter YG ⚠),
  Shulchan Arukh OC (Acharonim → Ezra SIL) — five visibly distinct era fonts on one sheet.
  All font files load (200s), no console errors, localStorage persistence works across reload.
- Era classifier verified against the live Sefaria API: index era codes T/A/RI/AH/CO
  confirmed by curl; GN trusted from Sefaria's schema (no live GN example found).
  compDate is an array `[year]` or `[start,end]` — classifier uses max ≥1800 for acharei.
  Tanakh commentaries are distinguished via `primary_category === "Commentary"`.
- Not a Sefaria fork (documented decision in docs/ARCHITECTURE.md): the monolith is
  Django+Mongo+users; the public API + a Vite SPA proves the concept in ~10 files.
- Fixed during integration: English translations rendered Sefaria's HTML tags as literal
  text → now sanitized + rendered as HTML in SourceCard.jsx (same sanitizer as Hebrew).
- Deviation from brief: no separate Fable subagent for mapping/architecture — the
  orchestrating session was Fable with the chart already in context, so it wrote
  docs/ARCHITECTURE.md directly; 3 parallel Sonnet agents built scaffold/fonts/UI.

## Open questions
- Paid/missing fonts (all flagged in docs/FONTS.md and in-UI with ⚠):
  - Rishonim: real pick is Koren Type ($) — shipped Shofar (free, Koren-derived per chart).
  - Nach: no free Isaiah-scroll font found — sharing Stam Ashkenaz CLM (NEEDS-FONT).
  - Tannaim: Ben Kosba not freely available — Keter YG placeholder (NEEDS-FONT).
  - Amoraim: genuine chart gap (no surviving exemplar) — Keter YG (CHART-GAP).
  - SBL Hebrew skipped: license is scholar/non-commercial, didn't clear the free bar.
- Acharei-vs-Acharonim split via compDate≥1800 works but is crude (Tanya 1796 → acharonim).
- Untested era paths: geonim (GN) and a true acharei (e.g. Mishnah Berurah) — try
  "Mishnah Berurah 1:1" and a Geonic text next session.
- Browser-automation note: React controlled inputs need a native-setter + input-event
  dispatch when driving the form programmatically (plain form_input worked pre-reload only).

## Resume command
cd ~/Documents/Projects/sefaria-era-fonts && cat HANDOFF.md && npm run dev
