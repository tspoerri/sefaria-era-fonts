# HANDOFF

**Next action:** `git push origin main`. Everything in this batch (Waves 1-3)
was already live-verified against the real Sefaria API in this session —
network egress was NOT blocked this time (earlier sessions' sandboxes had
blocked it; this one didn't) — so the push is the only thing left. After
pushing, a normal-use spot check is still worthwhile: try a Gemara/Rishon
source (not just Genesis) through the four Tanakh display modes plus the new
"Side-by-side" alignment, and try the mobile tap-elide flow on an actual
touch device (only viewport-width + browser matchMedia were exercised here).

## Current state (2026-07-16, Waves 1-3 feature batch, on top of the v2 batch)

Three more waves landed on `main` on top of the v2 batch (all local, NOT
pushed): Wave 1 search/address parsing (`7a20e39`), Wave 2 fetch safety &
sheet ops (`44f1c59`), Wave 3 RTL/alignment/elision (`f2bded9`). `npm test`:
382 pass / 0 fail / 3 pre-existing skips. `npm run build`: clean.

### Wave 1 — search & address parsing (`7a20e39`)
Refinements to source-reference parsing/suggestions (see docs/SEARCH.md for
the offline-lexicon + fold algorithm this builds on).

### Wave 2 — fetch safety & sheet ops (`44f1c59`)
- **Huge-fetch guard** (`src/lib/fetchGuard.js`): estimates segment count
  before fetching; a warning dialog blocks adding references that would
  produce a very long sheet, with an explicit "add anyway."
- **Clear-all confirm**: destructive action gated behind a confirm dialog.
- **Sheet import** (`src/lib/sheetImport.js`, `ImportSheet.jsx`): paste a
  Sefaria sheet URL/ID, imports its supported sources as blocks.

### Wave 3 — RTL/alignment & elision (`f2bded9`)
- **Item 8 — Hebrew keyboard RTL**: the alef-bet on-screen layout now
  renders right-to-left (א top-right, matching a real Hebrew keyboard);
  `keyboardLayouts.js#getLayoutDir` decides this per layout. Israeli/QWERTY
  layouts stay LTR (they draw a physical keyboard's key *positions*, not an
  alphabet chart).
- **Item 9 — first-word-driven input direction**: every free-text field
  (sheet title/author, AddSource's ref combobox, heading/text block inputs,
  TextEditor's bracket/substitute field) now sets `dir` from the first
  typed word's script (`src/lib/textDir.js#detectDir`), re-evaluating on
  every keystroke — delete the first word and the field flips to match
  whatever's now first.
- **Item 10 — "center" alignment redefined as a bilingual gutter layout**:
  Hebrew occupies the left half (right-aligned), English the right half
  (left-aligned), straight edges down the middle. Applies to both the
  title-bar and body alignment settings. UI label renamed "Side-by-side"
  (EN)/"זה לצד זה" (HE); the internal settings key is still `"center"` —
  no migration needed, it was never part of the sheet-content storage
  schema (see `src/lib/settings.js`, not `sheetStorage.js`).
- **Item 11 — English elision + mobile tap-select**: English range elision
  was *already* implemented (`OPS_EN` already listed `"elide"` — the SPEC
  note calling it Hebrew-only was stale); added an explicit regression test
  instead of new logic. Added a genuinely new tap-start/tap-end selection
  mode (`edits.js#nextTapSelection`, pure logic) for coarse-pointer/narrow
  (<768px) viewports where drag-select doesn't work, with larger word hit
  targets — replaces the mouse-drag handlers when active, doesn't touch them
  otherwise.

## What the app now has (cumulative, v2 + Waves 1-3)
- **Settings menu** (gear, top right): per-section language (both/he/en),
  alignment (sides/side-by-side), title-bar nikkud, Tanakh display mode
  (klaf/sefer/simple/bare) + other-text mode (sefer/bare), translation
  version (default JPS 1985 w/ fallback), attribution toggle, reset-all-mods.
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
  per-source settings overrides (inherit-global aware), reset, delete;
  collapses to hamburger <768px; hidden in print.
- **Delete guard**: undo toast (7s, restores position); card ✕ moved to
  ghost corner button away from ↑/↓.
- **Attribution**: era/font badges gone; cards tag author · c. date (from
  index authors/compDate). Era still picks the font.
- **Search markers**: daf/amud, perek/passuk, siman/seif, parsha (54-entry
  table, fold-matched with collision tiebreak), Hebrew-script markers too;
  digits only.
- **Fetch safety & sheet ops**: huge-fetch confirm guard, clear-all confirm,
  Sefaria sheet import.
- **Free-text direction**: input fields track the first word's script live.
- **Bilingual "side-by-side" alignment**: gutter-justified HE-left/EN-right
  layout, title bar and body.

## Open questions / for Tamar
- Live-verified this session (Genesis 1:1, both alignment modes, English
  elide, tap-select) but only a narrow slice — worth trying a longer/denser
  text (a Gemara daf, a Rishon with footnotes) through all four Tanakh/
  other-text display modes and both alignment modes before calling the
  whole batch done.
- Mobile tap-select was verified via a narrow browser viewport
  (`matchMedia("(max-width: 768px)")` branch), not an actual touchscreen —
  worth a real-device check for touch-event edge cases (e.g. does a
  scroll-swipe starting on a word ever get misread as a tap).
- **Hebrew numerals in markers** ("daf kuf") deliberately out of scope.
- Bare parsha names without a "parsha" marker deliberately don't rewrite.
- Phonetic keyboard single-key choices documented in keyboardLayouts.js
  comments (e.g. ט on t, ת on f) — tweak if they feel wrong in use.
- Title & text editors can be open at once (harmless; UX pass if it annoys).
- The "side-by-side" gutter layout hasn't been checked against very
  short/very long mismatched HE/EN content (e.g. HE present but EN blank
  for a segment) — should degrade gracefully since it's flex-based, but
  wasn't specifically exercised.

## Resume command
cd ~/Documents/Projects/sefaria-era-fonts && cat HANDOFF.md
npm test && npm run build && git push origin main
npm run dev   # then the live spot-checks above
