# HANDOFF

**Next action:** Run `npm run dev`, open http://localhost:5173, and decide which flagged font gaps to fill first (see docs/FONTS.md — nach and tannaim placeholders are the weakest).

## Current state (2026-07-15, overnight build COMPLETE and verified)
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
