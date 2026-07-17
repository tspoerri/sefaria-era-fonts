# HANDOFF

**Next action:** Commit the display-mode refactor (7 toggles replacing mode strings) and the updated docs.

## Current state (2026-07-17, Wave 5: display-mode refactor, ready to commit)

Refactor code-complete and live-verified in browser; documentation updated.
Work UNCOMMITTED on `main`. `npm test`: 405 pass / 0 fail. `npm run build`: clean.

### Wave 5 — display-mode refactor (display toggles, not mode strings)
Replaced mode strings (`klaf|sefer|simple|bare` for Tanakh, `sefer|bare` for
other) with 7 independent boolean toggles: `nikkud, taamim, punctuation,
verseLineBreaks, chapterLineBreaks, showNumbers, chapterHeadings`. This
simplifies the UI/settings surface and decouples behavior from historical
mode names.

- `src/lib/display.js`: `layoutSegments(source, toggles)` now takes a 7-key
  toggle object instead of a mode string. Presets exist in settings (`TANAKH_PRESETS`
  / `OTHER_PRESETS`) mapping named choices to toggle combinations. All output
  block/segment shapes unchanged.
- `src/lib/settings.js`: `DEFAULTS` restructured. `titleBar` section gone;
  `titleNikkud` is now a scalar at the root. `body` now nests per-language toggles:
  `body.tanakh` and `body.other` each hold the 7 toggles. `TANAKH_PRESETS`
  and `OTHER_PRESETS` exported for the settings UI. New `resolveBodyToggles`
  function handles per-source toggle overrides (flat, not nested under `body`).
  Old saved settings (pre-Wave-5) with `titleBar`/`modeTanakh`/`modeOther` keys
  silently become inert cruft under `deepMerge`; display preferences reset to
  new defaults on first load (text unaffected).
- Petuchah/setumah markers now always parse (never user-toggleable). Previously
  broke on live-API markup wrapper. Now tolerates `<span class="mam-spi-pe">{פ}</span>`.
- `docs/ARCHITECTURE.md`: settings-store section rewritten around new DEFAULTS shape;
  display-mode pipeline rewritten around `layoutSegments(source, toggles)` with
  preset tables (Tanakh 3-preset / Other 2-preset).
- All UI (settings, per-source override panel) adapted but visual/behavior
  equivalence preserved: same Tanakh modes, same other-text modes, same output layout.

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
- **Settings migration:** Old saved sheets' display settings (pre-Wave-5)
  silently reset to new defaults. Text is unaffected, but any custom display
  preferences (mode strings, etc.) are lost. This is intentional (non-destructive
  deep merge discards unknown keys), but worth knowing if sheets from earlier
  versions are opened.
- Carried over from prior waves: a longer/denser text through all three
  Tanakh presets and both Other presets, and both alignment modes; mobile
  tap-select on an actual touchscreen (only emulated via viewport width so
  far); Hebrew numerals in markers out of scope; bare parsha names without a
  marker don't rewrite; phonetic keyboard single-key choices may want tweaking;
  title/text editors can be open simultaneously; side-by-side gutter layout
  untested with very mismatched HE/EN lengths.

## Resume command
cd ~/Documents/Projects/sefaria-era-fonts
git status     # verify the display.js, settings.js, and ARCHITECTURE.md changes are there
npm test       # should still pass 405
npm run dev    # test the presets in the UI before committing
