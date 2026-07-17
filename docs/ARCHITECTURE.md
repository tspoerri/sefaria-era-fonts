# Architecture & Era Mapping

## Decision
No fork of Sefaria-Project (Django+React monolith, needs Mongo, users, auth — massive overkill).
Instead: **Vite + React SPA, no backend**, calling Sefaria's public CORS-enabled REST API
(https://developers.sefaria.org) client-side. Sheet state lives in React state +
localStorage. Export = print stylesheet (browser print-to-PDF).

## Stack
- Vite + React 18, plain JS (no TS — overnight prototype)
- No CSS framework; one `styles.css` + one `fonts.css`
- Fonts: Google Fonts `<link>` where available; free (OFL/GPL+FE) font files committed
  to `public/fonts/` and loaded via `@font-face` otherwise. NO paid fonts — substitutes
  flagged in `docs/FONTS.md` and in `src/lib/fonts.js`.

## Data flow
1. User types a ref ("Genesis 1:1", "Rashi on Genesis 1:1", "Mishnah Berakhot 1:1").
2. `GET https://www.sefaria.org/api/texts/{ref}?context=0&commentary=0&pad=0`
   → `{ he, text, ref, heRef, categories, primary_category, type, book, indexTitle }`.
3. Era classifier (below) maps the response (+ one optional index lookup) to an era key.
4. `src/lib/fonts.js` maps era key → CSS font stack; SourceCard renders Hebrew in it.

## Era classification (src/lib/era.js)
Era keys: `chumash | nach | tannaim | amoraim | geonim | rashi | rishonim | acharonim | acharei | contemporary`

Priority order:
1. `indexTitle` starts with `"Rashi on"` → `rashi` (chart has a dedicated Rashi-script row).
2. `categories[0] === "Tanakh"` and NOT a commentary → book ∈ {Genesis, Exodus, Leviticus,
   Numbers, Deuteronomy} → `chumash`, else `nach`.
3. `categories` contains `"Mishnah"` or `"Tosefta"` or `"Midrash Halakhah"`(Sifra/Sifrei/Mekhilta) → `tannaim`.
4. `categories[0] === "Talmud"` (Bavli or Yerushalmi, non-commentary) → `amoraim`.
5. `categories[0] === "Midrash"` → `amoraim` (aggadic midrash default; good enough for v1).
6. Otherwise (Commentary, Halakhah, Responsa, Kabbalah, Chasidut, Musar, Liturgy…):
   fetch `GET /api/v2/index/{indexTitle}` and read its `era` code —
   Sefaria era codes: `T`→tannaim, `A`→amoraim, `GN`→geonim, `RI`→rishonim,
   `AH`→acharonim, `CO`→contemporary. **Verify codes against live API during build.**
   Map `acharei` bucket: Sefaria has no separate code for it; treat `AH` works with
   `compDate` ≥ 1800 as `acharei` if compDate present, else `acharonim`.
7. No era resolvable → `contemporary` + `unclassified: true` badge on the card.

Cache index lookups in a Map (module-level) to avoid refetching per source.

## Era → font matrix (src/lib/fonts.js) — from the Ktav Ashuri chart

Each era now maps THREE styles, selected by the global `fontStyle` setting
("formal" default; per-source overridable):
- **casual** — historical-casual/cursive hand (max accuracy, nikkud not required; may be null → STYLE-GAP fallback to formal)
- **formal** — historical-formal/square book hand
- **accessible** — modern readability with era vibes (nikkud required)

| era | casual | formal | accessible |
|---|---|---|---|
| chumash | Hebrew Paleo Qumran (paleo-Hebrew, 11QpaleoLev) | Stam Ashkenaz CLM | Shlomo SemiStam |
| nach | 4Q417 (Qumran fragment hand) | Hebrew Square Isaiah (+ Habakkuk alternate) | Makabi YG |
| tannaim | Hebrew Square BenKosba (Bar Kochba letters) | Hebrew Square Habakkuk (~0 CE, slightly pre-tannaim) | Taamey David CLM |
| amoraim | Hebrew Square Bet Shearim (necropolis inscriptions) | Keter YG — CHART-GAP | Hadasim CLM |
| geonim | — STYLE-GAP (falls back to formal) | Keter Aram Tsova (Aleppo Codex) | Keter YG |
| rashi | Mekorot Rashi | Taamey Ashkenaz (medieval Ashkenazi square) | Noto Rashi Hebrew (Google) |
| rishonim | BenOr Rashi | Shofar — SUBSTITUTE ($ Koren) | David Libre (Google) |
| acharonim | Mashkit (mashket/vaybertaytsh) | Romm Vilna (Vilna Shas) | Ezra SIL |
| acharei | Solitreo (Sephardic cursive) | Frank Ruehl CLM (1908) | Frank Ruhl Libre (Google) |
| contemporary | Ktav Yad CLM (Israeli handwriting) | David Libre (Google) | Noto Sans Hebrew (Google) |

Every style entry in `fonts.js` carries `{ family, source, license, flag, nikkud, taamim }`
(nikkud/taamim: "full" | "partial" | "none", from cmap scans of the shipped files) so the
UI can show a small ⚠ on substituted/placeholder fonts. `getEraFont(era, style)` resolves
an entry with fallback casual→formal→accessible (geonim casual is null) and lands on
contemporary/accessible for unknown eras.

## File layout
```
index.html  package.json  vite.config.js
src/main.jsx  src/App.jsx
src/api/sefaria.js       # fetchText(ref, {ven}), fetchIndex(title), fetchNameRaw, tiny cache
src/lib/era.js           # classify(apiResponse) → {era, unclassified?}
src/lib/fonts.js         # ERA_FONTS map + flags
src/lib/fold.js          # Latin-script phonetic-skeleton fold (search key algorithm)
src/lib/nameSearch.js    # offline lexicon match + live fallback; searchTitles/resolveSelection
src/lib/hebrewSearch.js  # nikud stripping, Hebrew confusable-variant fallback, gematria helpers
src/lib/inputNormalize.js  # normalizeSourceInput, splitTitleAndAddress, rewriteSearchMarkers
src/lib/parshiyot.js     # the 54 weekly Torah portions {name, book, range}, for parsha markers
src/lib/sheetStorage.js  # sheet state load/save + full legacy→v2→v3 migration chain
src/lib/blocks.js        # blocks-model helpers: create/reorder/remove/restore/label
src/lib/settings.js      # global settings store: DEFAULTS, load/save, resolveSettings
src/lib/display.js       # layoutSegments() + Unicode strip helpers + Hebrew numeral helper
src/lib/edits.js         # constrained text-editor op logic (trim/elide/bracket/substitute)
src/lib/strings.js       # chrome i18n dict (EN/HE) + t(key, siteLang, vars?)
src/lib/keyboardLayouts.js  # on-screen keyboard layouts + physical hardware remap tables
src/components/AddSource.jsx    # ref/title search combobox
src/components/Sheet.jsx        # renders the blocks array (source/heading/text/spacer)
src/components/SourceCard.jsx   # one source: title bar, attribution tag, body, title/text editors
src/components/TextEditor.jsx   # word-token editor UI for the constrained edit model
src/components/Outline.jsx      # sidebar: block list, drag-reorder, per-source settings, delete
src/components/SettingsMenu.jsx # global settings panel (gear icon)
src/components/HebrewKeyboard.jsx  # on-screen Hebrew keyboard popup + physical remap wiring
src/styles.css  src/fonts.css
public/fonts/            # committed free font files
public/lexicon.json      # prebuilt offline title-search index (see docs/SEARCH.md)
scripts/build-lexicon.mjs  # regenerates public/lexicon.json from Sefaria's title index
docs/ARCHITECTURE.md  docs/FONTS.md  docs/SEARCH.md
README.md  CLAUDE.md  HANDOFF.md
```

(`src/lib/translitVariants.js` and the old per-keystroke API-fan-out search
path it supported were removed in Wave 2 of the search rewrite — subsumed by
the offline lexicon + fold-table approach above.)

## Search architecture

Source-search (the "add source" combobox: typing/pasting a ref and picking a
suggestion) has its own dedicated document — see **[docs/SEARCH.md](SEARCH.md)**
for the offline lexicon pipeline, the fold algorithm and its rule table, the
`public/lexicon.json` shape and regeneration instructions, the live-fallback
path, and the preserved live-API findings (nikud stripping, address-split
discovery, the gershayim/geresh bug, and why the Hebrew path stays a live
fan-out while the Latin path is offline-first).

## Sheet state (`src/lib/sheetStorage.js`)

The sheet is `{title, author, blocks: [...]}`, localStorage key
`sefaria-era-fonts-sheet-v3`. `loadSheet()` always returns this current (v3)
shape, migrating forward through a three-generation key chain — older keys
are left in place (non-destructive), so a rollback wouldn't lose data:

1. `sefaria-era-fonts-sheet` (pre-Wave-A, "OLD"): `{title, sources: [{id,
   ref, heRef, he, text, era, unclassified}]}`, where `he`/`text` were never
   flattened before render (SourceCard used to join arrays with `" "` at
   render time). `migrateLegacySource` reproduces that exact join so a
   migrated source reads the same as it used to.
2. `sefaria-era-fonts-sheet-v2` ("V2", Wave A/B): `{title, sources:
   [<segment-preserving source object>]}` — see below.
3. `sefaria-era-fonts-sheet-v3` (current, Wave C): `{title, author, blocks:
   [{id, type, ...}]}` — every pre-existing source becomes a `{id,
   type:"source", source}` block via `migrateV2ToV3`.

`loadSheet()` tries v3 first, then v2 (migrated), then legacy (migrated
legacy→v2→v3 in one pass) — the legacy→v2 step (`migrateLegacySheet`) is kept
as its own function so it stays independently testable. `saveSheet(state)`
always writes the current v3 shape.

### Blocks model (`src/lib/blocks.js`)

A block is one of:
```js
{ id, type: "source", source }   // a segment-preserving source object
{ id, type: "heading", text }
{ id, type: "text", text }
{ id, type: "spacer", size }     // size ∈ "S" | "M" | "L"
```
Pure helpers: `newSourceBlock`/`newHeadingBlock`/`newTextBlock`/
`newSpacerBlock` (id generation), `reorderBlocks(blocks, from, to)`,
`removeBlockAt(blocks, index)` (returns `{blocks, removed: {block, index}}`
for the undo stack), `restoreBlockAt(blocks, removed)`, and
`blockLabel(block, siteLang)` for the sidebar outline (sources by displayed
title honoring `titleOverride`, headings/text by their own text truncated to
40 chars, spacer by its size letter).

App.jsx owns an in-memory undo stack (`undoStack`, keyed by an incrementing
`undoId`, one `setTimeout` per entry via `undoTimers`): removing a **source**
block pushes `{block, index}` onto the stack and shows a toast for 7s
(`UNDO_TIMEOUT_MS`) with an Undo button that calls `restoreBlockAt`; removing
a heading/text/spacer block deletes immediately with no undo (per Wave C
item 3 — only sources get the delete guard).

### Source object (segment-preserving)

```js
{
  id, ref, heRef,
  book,                 // index title, e.g. "Rashi on Genesis"
  isTanakh,              // primary_category === "Tanakh" && primary_category !== "Commentary"
  sectionNames, sections,   // from the API response, as-is
  heSegments, enSegments,   // flat, aligned string arrays (enSegments padded with "" where missing)
  segmentRefs,           // aligned array of {perek, passuk} or {segment} numbers
  heVersionTitle, enVersionTitle,
  era, unclassified,
  authorEn, authorHe,    // first entry of the index's `authors`, or null
  compDateDisplay,       // "c. X" or "c. X–Y" from the index's compDate, or null
  // ---- user-edit overlay (null = untouched) ----
  titleOverride,         // {en, he} (either may be null) or null
  heEdited, enEdited,    // edited segment arrays, or null
  settingsOverride,      // partial settings object with flat toggles, or null
}
```

`buildSourceFromResponse({resp, index, era, unclassified})` in
`sheetStorage.js` builds this from a `fetchText` response plus an optional
`fetchIndex` response. `flattenSefariaText` flattens the API's `he`/`text`
(`string | string[] | string[][]`) into a flat segment array in reading
order (each inner array of a `string[][]` chapter-spanning range becomes one
chapter's segments). `buildSegmentRefs` derives `{perek, passuk}` (or
`{segment}` for non-chaptered texts) for every flattened segment from the
pre-flatten `he` shape plus the range's starting `sections` address —
passuk numbering restarts at 1 for every chapter after the first.
`alignSegments` pads/truncates the English array to match the Hebrew
segment count. `heSegments`/`enSegments` (and `ref`/`heRef`) are never
mutated by edits; SourceCard prefers `heEdited`/`enEdited` when present and
falls back to the originals.

## Settings store (`src/lib/settings.js`)

localStorage key `sefaria-era-fonts-settings`. `DEFAULTS`:
```js
{
  titleNikkud: true,   // title-bar nikkud display (scalar, not nested)
  body: {
    language: "both",  // "both" | "he" | "en"
    alignment: "sides", // "sides" | "side-by-side"
    tanakh: {
      nikkud: true, taamim: true, punctuation: true,
      verseLineBreaks: false, chapterLineBreaks: false, showNumbers: true, chapterHeadings: false
    },
    other: {
      nikkud: true, taamim: true, punctuation: true,
      verseLineBreaks: true, chapterLineBreaks: false, showNumbers: true, chapterHeadings: false
    }
  },
  fontStyle: "formal",     // "formal" | "casual" | "accessible" — era-font style
  translationVersion: "Tanakh: The Holy Scriptures, published by JPS",
  showAttribution: true,
  siteLang: "en",         // "en" | "he" — chrome language, not source content
  darkMode: "system",      // "light" | "dark" | "system"
  keyboard: { layout: "alephbet", physical: "original" },
}
```
`loadSettings()` deep-merges saved JSON over `DEFAULTS` (so a settings blob
saved before a new key was added still gets that key's default);
`saveSettings(next)` writes the whole object. `resolveSettings(global,
perSourceOverride)` shallow-merges a source's `settingsOverride` over the
global settings, one section at a time, or wholesale for scalar top-level
keys — this is what `SourceCard` calls to get its "effective" settings.
`resolveBodyToggles(globalSettings, source)` handles the per-source toggle
override merge: it selects `tanakh` or `other` from `body` based on
`source.isTanakh`, then shallow-merges `source.settingsOverride.toggles`
(flat, not nested under `body`) over it. This exists because per-source
toggles live flat to prevent a single-toggle override from wiping the other
six. Per-source panel reads/writes via `withOverride` (which prunes empty
objects back to `null` so an all-inherited source has `settingsOverride === null` again).

## Display-mode pipeline (`src/lib/display.js`)

Pure, unit-tested text transforms + layout. `layoutSegments(source, toggles)`
takes a source and a 7-key toggle object `{nikkud, taamim, punctuation,
verseLineBreaks, chapterLineBreaks, showNumbers, chapterHeadings}` and returns
an array of render blocks: `{type: "perekHeading", perek, heText, enText}`,
`{type: "line", segments: [{he, en, num, numStyle, isMarker?, isGap?}]}`, or
`{type: "flow", segments: [{...}]}`. It uses `heEdited`/`enEdited` in preference
to `heSegments`/`enSegments` when present.

**Toggles and presets.** The 7 toggles control text decoration + structural layout:
- **nikkud** — include Hebrew vowel marks (U+05B0–05BC, 05BF, 05C1, 05C2, 05C7)
- **taamim** — include cantillation marks (U+0591–05AF + meteg U+05BD)
- **punctuation** — include sof passuk (U+05C3); always on for non-Tanakh
- **verseLineBreaks** — each verse/passuk is its own `line` block
- **chapterLineBreaks** — each chapter is its own `line` block (moot if verseLineBreaks)
- **showNumbers** — render segment/perek/passuk numbers inline
- **chapterHeadings** — render perek headings (Tanakh only; only when
  chapterLineBreaks is off and verseLineBreaks is off)

Presets (`TANAKH_PRESETS` / `OTHER_PRESETS` in `src/lib/settings.js`) combine
toggles into named, user-facing choices:

**Tanakh presets** (toggles: nikkud/taamim/punctuation/verseLineBreaks/chapterLineBreaks/showNumbers/chapterHeadings):
- **klaf** `F F F F F F F` — archival-minimal: strips all marks, no line breaks, no numbers
- **sefer** `T T T F F T F` — book text: keeps marks, one flow block, inline verse numbers
- **simple** `T F T T F T F` — readable: nikkud + sof passuk, verse per line, chapter headings

**Other-text presets**:
- **sefer** `T T T T F T F` — book text: keeps marks, section per line, inline section numbers
- **simple** `F T T F F T F` — readable (formerly "bare"): strips nikkud, section per flow block

**Derived rules** (not toggled):
- `numStyle` derives from `showNumbers` and `chapterHeadings`: no numbers → `"none"`;
  numbers on + chapter headings → `"regular"`; otherwise → `"small-faint"`.
- **Petuchah/setumah markers** (פ/ס) are always parsed (never user-toggleable).
  `extractTrailingMarker` strips trailing `{פ}`/`{ס}` or `(פ)`/`(ס)` (tolerates
  live-API wrapper markup like `<span class="mam-spi-pe">{פ}</span>`), normalizes
  stray `<br>` tags to spaces. When `showNumbers` is off, markers render as a
  silent `isGap` segment (petuchah forces a new `flow` block; setumah inserts
  an invisible inline gap). When on, render as an inline `isMarker` segment
  holding the letter (פ or ס), styled `faint-marker`.
- **verseLineBreaks on** makes `chapterLineBreaks` and `chapterHeadings` moot
  (every verse is already its own line).
- Title bar language/alignment inherit from `body.*`; title bar's only separate
  setting is `titleNikkud`.

`toHebrewNumeral(n)` converts an integer to Hebrew numerals for chapter
headings (e.g. 1→א׳, 15→ט״ו, 16→ט״ז, 119→קי״ט — traditional 15/16 exceptions
avoid spelling the Tetragrammaton; geresh for single letter, gershayim
before the last letter otherwise).

English segments follow the same block structure (same `numStyle` per segment)
and are never nikkud-stripped — only `<br>` normalization applies. `SourceCard`
renders `HebrewBlocks`/`EnglishBlocks` from the same `layoutSegments()` output,
independently deciding which language column(s) to show per the effective
`body.language` setting.

## Attribution tags

The old era badge + font-name caption were removed entirely. When
`showAttribution` is on and the source has an author and/or `compDateDisplay`,
`SourceCard` renders a small tag next to the title bar: author (site-language
preferred, i.e. `authorHe`/`authorEn` or the reverse, falling back to
whichever exists) and date joined with " · " (author only, date only, or
neither — whichever fields are present). Era still exclusively drives
`fontFamily`, now via `getEraFont(era, fontStyle)` (`src/lib/fonts.js`).

## Constrained edit model (`src/lib/edits.js`)

`TextEditor.jsx` is a thin shell around pure op logic operating on a flat,
per-language token list, not on the segment strings directly.
`tokenizeSegments(segments)` strips HTML tags (`stripHtmlToText` — Sefaria
segments can carry `<span>`/`<i>`/`<sup>` markup; only the plain-text content
is tokenized, decoding numeric/named entities) and splits each segment's text
on whitespace into `{segIndex, text}` tokens, in reading order.
`rebuildSegments(tokens, segCount)` re-groups the (possibly edited) token
list back into a segment-aligned array (words within a segment joined with a
single space; a segment with no surviving tokens becomes `""`).

Allowed ops: `OPS_HE = ["trim", "elide", "bracket"]`, `OPS_EN` adds
`"substitute"`. `applyOp(tokens, start, end, op)` replaces the inclusive
`[start, end]` token range and returns `{ok: true, tokens}` or `{ok: false,
error}`:
- **trim** — only legal when the range touches the very start of the token
  list or the very end (`canTrim`); replaces with nothing. Any other range
  → `"trim-not-at-edge"`.
- **elide** — replaces the range with a single `"…"` token.
- **bracket** — replaces with a single `"[user text]"` token; empty text →
  `"empty-text"`.
- **substitute** (English only) — like bracket but without brackets.
- Any op that would leave zero tokens overall → `"zero-words"` (whole-text
  deletion is impossible by construction).

Editing operates on the text *with* nikkud/taamim as stored — the strip
passes in `layoutSegments()` are downstream and apply the same way to edited
text as to original text (elision's plain `"…"` and bracket's `[...]`
brackets are all ASCII, so they survive nikkud/taamim strips unchanged).
Save writes `heEdited`/`enEdited`; Cancel discards the working copy; "Reset
text" (SourceCard) nulls both overlay fields. Because tokenization strips
markup first, a segment that goes through the editor loses its original
inline HTML — an accepted tradeoff, not a bug.

Title editing (`TitleEditor` in `SourceCard.jsx`) is separate and much
simpler: plain EN/HE text inputs seeded from the override (if set) or the
original `ref`/`heRef`, with a per-field ↺ reset button shown only when that
field has an override; Save writes `titleOverride` (or `null` if both
fields match the originals), Cancel discards.

## Dark mode, site language, i18n (`src/lib/strings.js`)

`STRINGS = {en: {...}, he: {...}}` is a flat chrome-string dictionary (UI
labels/buttons/placeholders only — never source text content, which always
renders in whatever language(s) the display settings pick).
`t(key, siteLang, vars?)` looks up `key` in the active language, falling
back to English if the key or language is missing, with `{name}`-style
`{...}` interpolation for vars. Toggling `siteLang` (the EN/עב icon-cluster
button in `App.jsx`) also flips `document.documentElement.dir`
(`"rtl"`/`"ltr"`) and `.lang`.

Dark mode (`settings.darkMode`, one of `"light"|"dark"|"system"`) cycles via
the sun/moon icon-cluster button; `applyDarkModeClass` in `App.jsx` resolves
`"system"` against `window.matchMedia("(prefers-color-scheme: dark)")` and
sets `data-theme` on `document.documentElement` for CSS custom properties to
key off, with a `matchMedia` change listener kept live only while
`darkMode === "system"`. `@media print` in `styles.css` forces light mode
regardless of `data-theme` so exports never print dark.

## Hebrew keyboard (`src/lib/keyboardLayouts.js`, `HebrewKeyboard.jsx`)

A popup panel toggled by the ⌨ icon-cluster button, wired into any tracked
text `<input>`/`<textarea>` on the page (search box, sheet title/author,
heading/text block inputs, title/text editors) via a module-scope
`focusin` listener that starts tracking the moment the module loads — this
is necessary because clicking the toggle button itself steals focus away
from the field a component-local listener would otherwise catch too late.
Insertion (`insertAtCaret`/`backspaceAtCaret`) goes through the input's
native value setter plus a dispatched `"input"` event, so React's own
`onChange` still fires normally.

Two independent settings live under `settings.keyboard`:
- **`layout`** (on-screen arrangement, `getLayoutRows(layout)`):
  `"alephbet"` — the 22 base letters + 5 sofit forms in alphabetical-ish
  rows of 7; `"israeli"` — the SI-1452 standard Israeli keyboard, drawn in
  QWERTY row shape; `"qwerty"` — a phonetic a→א/b→ב/... mapping, also drawn
  in QWERTY row shape, with finals reached via Shift on the same key
  (Shift+M → ם, etc. — `QWERTY_SHIFT_FINALS`).
- **`physical`** (hardware remap while the popup is open, `mapPhysicalKey`):
  `"original"` (no remap), `"israeli"` (same SI-1452 table), `"qwerty"`
  (same phonetic table + shift-finals). A capture-phase `keydown` listener
  is attached only while the popup is mounted and `physical !== "original"`;
  it `preventDefault()`s and inserts the mapped character for any tracked,
  unmodified (no ctrl/meta/alt) single-character key.

Closing the popup (✕, Escape, or the toggle button) always resets
`settings.keyboard.physical` back to `"original"` (`closeKeyboard()` in
`App.jsx`) — the physical remap can never outlive the popup being open. The
panel also shows on-screen Space/Backspace keys and a note about the
Shift-for-finals convention when either the layout or the physical mode is
`"qwerty"`.
