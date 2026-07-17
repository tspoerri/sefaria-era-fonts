# HANDOFF

**Next action:** Open the app (`npm run dev`), switch the "Font style"
setting between casual/formal/accessible on a few different-era sources
(not just Genesis 1:1), and confirm the choices feel right — this batch
was live-verified for correctness (renders, no tofu, no console errors)
but not yet reviewed by Tamar for whether the actual font picks *feel*
right per era.

## Current state (2026-07-16, Wave 4: three-style era-font matrix, pushed)

Pushed to `main` as `b17c281` on top of the Wave 1-3 batch (already on
origin). `npm test`: 382 pass / 0 fail / 3 pre-existing skips. `npm run
build`: clean.

### Wave 4 — three-style era-font matrix (`b17c281`)
Replaced one-font-per-era with three options per era, per Tamar's
refined brief: **casual** = maximum historical/geographic accuracy
(novelty), nikkud not required; **formal** = accuracy + readability,
nikkud a plus; **accessible** = modern legibility + "vibes," nikkud
required. Niche/regional fonts (Ashkenazi vs. Sephardi, Qumran-fragment-
specific faces) used where they improve authenticity, especially for
casual.

- `src/lib/fonts.js`: `ERA_FONTS[era]` is now `{ casual, formal,
  accessible }`, each carrying real cmap-scanned `nikkud`/`taamim`
  coverage (`"full"|"partial"|"none"`). New `getEraFont(era, style)`
  helper falls back casual→formal (geonim has no surviving cursive
  hand — flagged `"STYLE-GAP"`, a new flag in `FLAG_DESCRIPTIONS`).
- `src/components/SourceCard.jsx`: font lookup now happens after
  `resolveSettings()` so per-source overrides apply; new
  `stripUnsupportedMarks()` strips nikkud/taamim the chosen font's
  cmap can't draw, so under-supported historical faces (e.g. Paleo
  Qumran) render clean instead of as tofu boxes.
- `src/lib/settings.js`: new `DEFAULTS.fontStyle = "formal"` (keeps
  old single-font behavior as the default look).
- `src/components/SettingsMenu.jsx` / `strings.js`: new "Font style"
  3-way selector (EN/HE labels), global setting.
- `src/components/Outline.jsx`: per-source fontStyle override support
  (subagent added this beyond the original spec — small, matches the
  existing per-source override pattern for other settings).
- 15 new font files in `public/fonts/` + license files (aharonium
  repo + Tamar's local font library), 2 new Google Fonts links in
  `index.html` (David Libre, Noto Rashi Hebrew).
- `docs/FONTS.md` rewritten around the 3-column matrix;
  `docs/ARCHITECTURE.md` era→font table updated to match.

Notable scan corrections vs. my original spec (trust the code/docs,
not my earlier claims): Makabi YG has **full** taamim (not none as
assumed); Hadasim CLM is GPL+FE (not plain GPL); Frank Ruehl CLM and
Ktav Yad CLM are plain GPL v2, **no** font exception.

## What the app now has (cumulative, v2 + Waves 1-4)
- **Font style**: casual/formal/accessible per-era font matrix (new),
  global setting + per-source override, graceful mark-stripping for
  under-supported faces.
- **Settings menu** (gear, top right): per-section language (both/he/en),
  alignment (sides/side-by-side), title-bar nikkud, Tanakh display mode
  (klaf/sefer/simple/bare) + other-text mode (sefer/bare), translation
  version (default JPS 1985 w/ fallback), attribution toggle, font
  style, reset-all-mods.
- **Icon cluster**: dark mode (light/dark/system, print stays light), site
  chrome language EN/HE (strings.js dict, flips document dir), Hebrew
  keyboard popup (3 on-screen layouts — alef-bet now RTL — 3 physical remap
  modes, reverts to original on close).
- **Data model v3**: blocks (source/heading/text/spacer) + sheet author;
  sources keep Sefaria's segment structure (heSegments/enSegments/
  segmentRefs) with non-destructive overlays (titleOverride/heEdited/
  enEdited/settingsOverride). Migration chain legacy→v2→v3 tested.
- **Editing**: inline title editing; structured word-token text editor —
  Hebrew: trim (edges only)/elide (…)/bracket; English adds substitute;
  both languages support elide; zero-word deletion impossible; reset per
  source or global; mobile-friendly tap-to-select range on narrow viewports.
- **Sidebar outline**: click-to-scroll, HTML5 drag-and-drop reorder,
  per-source settings overrides (inherit-global aware, now includes font
  style), reset, delete; collapses to hamburger <768px; hidden in print.
- **Delete guard**: undo toast (7s, restores position); card ✕ moved to
  ghost corner button away from ↑/↓.
- **Attribution**: era/font badges gone; cards tag author · c. date (from
  index authors/compDate). Era still picks the font family per style.
- **Search markers**: daf/amud, perek/passuk, siman/seif, parsha (54-entry
  table, fold-matched with collision tiebreak), Hebrew-script markers too;
  digits only.
- **Fetch safety & sheet ops**: huge-fetch confirm guard, clear-all confirm,
  Sefaria sheet import.
- **Free-text direction**: input fields track the first word's script live.
- **Bilingual "side-by-side" alignment**: gutter-justified HE-left/EN-right
  layout, title bar and body.

## Open questions / for Tamar
- **Font picks themselves are unreviewed by you** — I (Claude) verified
  the plumbing (renders, no tofu, settings UI, no console errors) across
  formal/casual/accessible on Genesis 1:1, but whether e.g. Paleo Qumran
  is the right casual pick for Chumash, or whether the Ashkenazi/Sephardi
  split lands correctly across eras, needs your eye.
- Try a Gemara/Rishon source (not just Genesis) through all three font
  styles — casual in particular may look very different on later eras
  where the "niche accuracy" font pool is thinner.
- Two license quirks worth knowing about if this ever gets redistributed
  beyond a personal prototype: Frank Ruehl CLM and Ktav Yad CLM are plain
  GPL v2 (no font exception, unlike most of the other GPL+FE fonts here).
- Carried over from the Wave 1-3 batch, still open: a longer/denser text
  through all four Tanakh/other-text display modes and both alignment
  modes; mobile tap-select on an actual touchscreen (only emulated via
  viewport width so far); Hebrew numerals in markers out of scope; bare
  parsha names without a marker don't rewrite; phonetic keyboard single-key
  choices may want tweaking; title/text editors can be open simultaneously;
  side-by-side gutter layout untested with very mismatched HE/EN lengths.

## Resume command
cd ~/Documents/Projects/sefaria-era-fonts && cat HANDOFF.md
npm run dev   # then the font-style spot-checks above
