# HANDOFF

**Next action:** `git push origin main`, then live-verify against real Sefaria
(sandbox egress was blocked all session): add "Genesis 1" and check the four
Tanakh display modes (Klaf/Sefer/Simple/Bare) against real API text — nikkud/
taamim strips, petuchah/setumah breaks, passuk numbering — and confirm the JPS
1985 English version arrives (`ven` param) with graceful fallback for texts
JPS doesn't cover (e.g. a Gemara).

## Current state (2026-07-16, v2 feature-batch session)

The whole 10-item feature batch landed on `main` in six commits (all local,
NOT pushed): display-echo suggestions (`13c93ca`), Wave D1 search markers
(`e615323`), Wave A settings/display model (`a7b0803`), Wave B constrained
editing (`ac1dff3`), Wave C blocks/sidebar (`0a3226c`), Wave D2 Hebrew
keyboard (`31d966d`), plus a docs truth-up commit after those. `npm test`:
239 pass / 0 fail / 3 pre-existing skips. `npm run build`: clean.

What the app now has:
- **Settings menu** (gear, top right): per-section language (both/he/en),
  alignment (sides/center), title-bar nikkud, Tanakh display mode
  (klaf/sefer/simple/bare) + other-text mode (sefer/bare), translation
  version (default JPS 1985 w/ fallback), attribution toggle, reset-all-mods.
- **Icon cluster**: dark mode (light/dark/system, print stays light), site
  chrome language EN/HE (strings.js dict, flips document dir), Hebrew
  keyboard popup (3 on-screen layouts, 3 physical remap modes, reverts to
  original on close).
- **Data model v3**: blocks (source/heading/text/spacer) + sheet author;
  sources keep Sefaria's segment structure (heSegments/enSegments/
  segmentRefs) with non-destructive overlays (titleOverride/heEdited/
  enEdited/settingsOverride). Migration chain legacy→v2→v3 tested.
- **Editing**: inline title editing; structured word-token text editor —
  Hebrew: trim (edges only)/elide (…)/bracket; English adds substitute;
  zero-word deletion impossible; reset per source or global.
- **Sidebar outline**: click-to-scroll, HTML5 drag-and-drop reorder,
  per-source settings overrides (inherit-global aware), reset, delete;
  collapses to hamburger <768px; hidden in print.
- **Delete guard**: undo toast (7s, restores position); card ✕ moved to
  ghost corner button away from ↑/↓.
- **Attribution**: era/font badges gone; cards tag author · c. date (from
  index authors/compDate). Era still picks the font.
- **Search markers**: daf/amud, perek/passuk, siman/seif, parsha (54-entry
  table, fold-matched with collision tiebreak), Hebrew-script markers too;
  digits only.

## Open questions / for Tamar
- **Not verifiable in-sandbox** (www.sefaria.org egress blocked): everything
  listed under "Next action"; also authors/compDate coverage quality across
  index records (attribution tag may be sparse for some texts), and the
  `ven=` JPS fetch (mechanism tested via code/tests only).
- **Hebrew numerals in markers** ("daf kuf") deliberately out of scope.
- Bare parsha names without a "parsha" marker deliberately don't rewrite.
- Phonetic keyboard single-key choices documented in keyboardLayouts.js
  comments (e.g. ט on t, ת on f) — tweak if they feel wrong in use.
- Title & text editors can be open at once (harmless; UX pass if it annoys).

## Resume command
cd ~/Documents/Projects/sefaria-era-fonts && cat HANDOFF.md
npm test && npm run dev   # then the live checks above, then git push origin main
