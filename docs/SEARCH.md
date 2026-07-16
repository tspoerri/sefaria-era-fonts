# Source Search Architecture

The durable home for everything about how the "add source" combobox turns
typed/pasted text into a Sefaria ref: the offline lexicon pipeline, the
phonetic fold algorithm, the runtime match/fallback logic, and the live-API
findings that shaped all of it. See `docs/ARCHITECTURE.md` for how this fits
into the app as a whole (data flow, era classification, fonts).

## 1. Pipeline overview

```
scripts/build-lexicon.mjs               (build time, run rarely)
  fetches GET /api/index/titles
    -> for each Latin-script title: fold(title)  [src/lib/fold.js]
    -> first-occurrence-wins per folded key (TOC rank = priority)
    -> prune (only if over budget; §4 below)
    -> emit public/lexicon.json  { keys: [], titles: [], ranks: [] }
       (committed asset, ASCII-sorted keys, 45,019 entries as of 2026-07-16)

src/lib/nameSearch.js                   (runtime, per keystroke)
  loadLexicon() fetches public/lexicon.json once per session, caches it
    -> matchLatinOffline(lexicon, title): fold() the query with the SAME
       fold.js, binary-search the keys array -> ranked suggestions
       (zero network calls once the lexicon has loaded)
    -> 0 offline hits (or lexicon not loaded yet) -> exactly one direct
       /api/name fallback call (no variant fan-out)

resolveSelection(title, address)        (on suggestion pick / submit)
  -> exactly one /api/name call to resolve the corrected title (+ reattached
     address) to Sefaria's canonical ref

App.fetchText(ref)                      (on add)
  -> GET /api/texts/{ref} -> era classification -> font rendering
```

Hebrew-script queries never touch the lexicon; they keep the pre-existing
live `/api/name` + confusable-variant-fallback path unchanged (`src/lib/
hebrewSearch.js`, `searchHebrewTitles` in `nameSearch.js`) — see §5 and §6.

Total network calls for a full Latin query-to-add flow, once the lexicon has
loaded: **one** (`/api/name` at selection, via `resolveSelection`). While the
lexicon is still loading, or on a genuine 0-hit, one extra direct `/api/name`
call covers the gap.

## 2. The fold algorithm (`src/lib/fold.js`)

`fold(title)` collapses a Latin-script Sefaria title string down to a coarse
phonetic "skeleton" key, so that Ashkenazi and Sephardi spellings of the same
name (and abbreviations, and diacritic variants) land on the same key. It is
imported directly by both the build script and the runtime matcher, so
build-time keys and query-time keys can never drift apart.

**Rule order is pinned** — this is not just a convenient implementation
order, reordering these passes changes results:

1. Lowercase; Unicode-NFD-decompose; strip combining marks (diacritics).
2. Remove apostrophes/hyphens/periods; collapse whitespace.
3. Whole-token roman-numeral <-> arabic-numeral normalization (must run
   before vowel deletion, or a bare "ii"/"iii" token would delete to nothing).
4. Ordered consonant-class folding passes, digraphs before singles.
5. Delete vowels.
6. Strip anything left outside the final key alphabet.

### Fold-rule table

| Rule | What folds together | Why |
|---|---|---|
| Diacritic stripping | NFD-decompose + strip U+0300-U+036F combining marks (ṭ, ç, è, ô, …) | Foreign-language and transliterated titles ("Soṭah", "Genèse") carry precomposed accents that must not create a separate key from the unaccented form. |
| Apostrophes/hyphens/periods | `'` `'` `'` `-` `.` deleted outright (not replaced with a space) | These are typographic noise in titles ("Ohr Ha-Chaim" / "Ohr HaChaim" / "Or Ha'Chaim") that must not split or separate tokens. |
| Roman numeral tokens | Whole tokens `i`/`ii`/`iii` -> `1`/`2`/`3` | So "II Kings", "2 Kings" agree on a key wherever the numeral occupies the same token position — titles are never reordered to force a match. |
| Shin (`sh` -> `$`) | Isolated into its own class first | Must run before the standalone-h and sav/tav rules below, or e.g. "Shabbat" would lose its `sh` to the standalone-h deletion rule and land on the wrong key. |
| Tzadi (`tz`/`ts`/`z` -> `z`) | Collapses the tzadi-family spellings | Ashkenazi/Sephardi and transliteration-scheme variance on tzadi ("Tzion"/"Tsion"/"Zion"). |
| Kaf/kuf/qof family (`ch`/`kh`/`ck`/`q`/`k` -> `k`, plus `c` before a/o/u -> `k`) | Collapses the guttural/k-sound family | Ashkenazi "ch"/"kh" transliterations of khaf/kuf/qof all represent the same consonant Sephardi transliteration renders as "k"/"q". Plain `c` before e/i, or word-final `c`, is deliberately left alone — the spec only calls out the a/o/u case. |
| Fey/vet/vav/bet family (`ph`/`f`/`v`/`w`/`b` -> `b`) | Collapses the labial/fricative family | Ashkenazi soft-vet ("Bereishis" bet) vs. Sephardi "v" spellings, plus "ph"/"f" digraph variance (e.g. "Sefer"/"Sepher"), are all the same underlying letter. |
| Standalone-h deletion | Delete any `h` left after the digraph passes above have consumed `sh`/`ch`/`kh`/`ph` | Leftover `h`s are pure matres-lectionis/vowel-carriers with no independent consonant value: "Ohr"/"Or" -> `r`, "Sotah"/"Sota" -> `tt`, "HaChaim"/"Hachayim" -> `km`. |
| Sav/tav (`th`/`t`/`s` -> `t`) | Collapses the Ashkenazi sav/Sephardi tav distinction | "Shabbos"/"Shabbat" both -> `...t`. (The `th` alternative can never actually fire in practice since standalone `h` is already deleted by the prior rule — kept anyway because the spec pins it as an explicit literal step.) |
| Vowel deletion (`a`/`e`/`i`/`o`/`u` removed) | Only vowels; `y`/`j`/`g`/`d`/`l`/`m`/`n`/`p`/`r` (and any un-folded leftover like a plain `c`/`x`) pass through untouched | Vowel spelling is the least stable part of a transliteration; consonant skeletons carry the identifying signal. `y` is deliberately kept (not treated as a vowel) so "Yeshayohu" -> `y$yh` still matches "Yishayahu". |
| Final alphabet strip (`[^a-z$0-9 ,]` removed) | Strips anything outside the folded consonant classes, digits, space, comma | Comma is deliberately *kept* — the build script's pruning rule (§4, rule i) compares folded pre-comma prefixes for "deep node" titles like "Shulchan Arukh, Orach Chayim", and needs the same `fold()` to produce a comma-bearing key for that comparison to work. |

## 3. Lexicon JSON shape (`public/lexicon.json`)

```json
{
  "keys":   [ "br$t", "br$tmilh", ... ],
  "titles": [ "Bereshit", "Brachot Milah", ... ],
  "ranks":  [ 0, 214, ... ]
}
```

Three parallel arrays, same length, aligned by index:

- `keys[i]` — the `fold()`-ed phonetic skeleton key, **ASCII-sorted overall**
  so the array is binary-searchable (exact match via one binary search,
  prefix range via two: lower-bound and upper-bound).
- `titles[i]` — the representative raw Sefaria title string for `keys[i]`
  (the first-occurring title in the source `/api/index/titles` `books[]`
  array that folds to this key — i.e. TOC-order priority wins ties).
- `ranks[i]` — that title's index in the original `books[]` array (TOC
  order; lower = appears earlier = higher priority/popularity).

Example: `keys[0] === "br$t"` -> `titles[0] === "Bereshit"`, `ranks[0] === 0`.

Only non-Hebrew-codepoint title strings are folded in. Sefaria's title list
also contains a small number of strings with at least one Hebrew-script
codepoint (letters, nikud, cantillation, geresh/gershayim) — 56 of them in
the 2026-07-15 snapshot. Most of those are actually *mixed* Latin+Hebrew
strings (e.g. a Siddur path ending in a Hebrew phrase), so the discriminator
for exclusion is "contains a Hebrew codepoint," not "has no Latin letter."
These titles are skipped from the lexicon entirely and keep the app's
separate, always-live Hebrew search path (`src/lib/hebrewSearch.js`) — see §5.

As of 2026-07-16 the shipped asset has **45,019 keys/titles/ranks** — folded
from the snapshot's 66,569 Latin titles into 47,144 raw keys, then trimmed to
45,019 by minimal rule-(i) pruning to fit the gzip budget (§4).

## 4. Regeneration

```
node scripts/build-lexicon.mjs
```

Default mode: fetches the live title list from
`https://www.sefaria.org/api/index/titles` (global `fetch`, Node >= 18, no
dependency) and writes `public/lexicon.json`.

Offline mode, for any sandbox that blocks egress to www.sefaria.org:

```
node scripts/build-lexicon.mjs --titles-file /path/to/titles-raw.json
```

The file must be the exact JSON body `GET /api/index/titles` returns:
`{ "books": [ ...title strings... ] }`.

`--out /path/to/output.json` overrides the default `public/lexicon.json`
write location (mainly useful for testing).

**When to rerun:** rarely. Sefaria adds new titles to its index slowly; this
is not a build step that needs to run on every deploy. Rerun only when a
newly-added Sefaria work needs to be searchable offline, or if the fold
algorithm itself changes (in which case *all* keys need to be regenerated to
stay consistent with the runtime matcher).

### Size budget and pruning (§L1.5)

Budget: `public/lexicon.json` must stay **≤ 5 MB raw / ≤ 600 KB gzipped**
(checked against the real `gzip -6` output, i.e. what GitHub Pages/nginx
actually serves — the build script shells out to the system `gzip` binary
rather than estimating). Pruning only ever runs if the asset is over budget.

**2026-07-16 orchestrator adjudication — pruning is MINIMAL, not wholesale.**
SPEC.md §L1.5 says prune "ONLY by these safe rules, in order, UNTIL UNDER"
budget. That is a stop-as-soon-as-under condition, not "drop every eligible
entry." Dropping every eligible entry would gut offline coverage — the
project's core value proposition — for no reason once the budget is already
met. Each rule computes its full *eligible* set but only actually removes
entries from it, **least-popular-first** (highest/latest TOC rank first,
i.e. lowest-priority titles go first), re-measuring real gzip size after each
small batch and stopping the instant the target is met:

- **Rule (i) — deep-node alt-spelling dedupe.** Eligible: comma-containing
  entries ("deep node" titles, e.g. "Shulchan Arukh, Orach Chayim") whose
  pre-comma base title already has its own lexicon entry at the same folded
  key — i.e. the base work is already independently searchable, so *some*
  deep-node spelling combinations for it are redundant (the deep node itself
  still resolves via the single `/api/name` call once the base title is
  matched). Applied first, and normally sufficient on its own.
- **Rule (ii) — foreign-diacritic titles.** Eligible: entries whose
  *original* (unfolded) title string matches `/[àâäéèêëîïôöûüç]/i` (e.g.
  "Genèse"). Only even consulted if rule (i)'s entire eligible set wasn't
  enough.
- Abbreviations (e.g. "Gen.") and Ashkenazi/Sephardi spelling variants (e.g.
  "Bereishis", "Kesubos", "Shabbos") are **never** pruned by either rule.

**At the 2026-07-15 snapshot, rule (i) does fire — minimally.** The raw fold
yields **47,144 keys** at gzip-6 **603 KB**, just over the 600 KB budget. Rule
(i) finds **35,944** eligible comma deep-node entries and drops only the
**2,125** least-popular of them (descending TOC rank), bringing the asset to
**45,019 keys** at gzip-6 **571 KB** — comfortably under budget. Rule (ii) is
not needed. The build is deterministic: rerunning produces a byte-identical
`public/lexicon.json`. (Wholesale rule (i) would instead drop all 35,944 and
leave only ~11,200 keys — rejected per the adjudication above.) Record the
actual eligible/pruned counts here again if a future snapshot changes them.

## 5. The fallback path

For a Latin-script query: offline lexicon match first
(`matchLatinOffline`), and if that returns **zero hits** — or the lexicon
hasn't finished loading yet — exactly **one** direct `/api/name` call as a
fallback. There is **no variant fan-out** for Latin queries anymore (see §6
for why the old fan-out approach was retired in favor of the fold table).

For a Hebrew-script query, the pre-existing live path is unchanged: try the
direct `/api/name` call first; only fan out to confusable-letter variants
(`generateHebrewVariants`, `src/lib/hebrewSearch.js`) if the direct call
returns fewer than 3 results **and** the raw typed text has no nikud (nikud
strongly implies the text was pasted from a correctly-spelled source, so a
typo-tolerant fallback would be pointless). This gating is preserved
byte-for-byte in behavior from the original `fetchNameSuggestionsRobust`.
This path stays a live per-keystroke fan-out (unlike the retired Latin one)
because the Hebrew-codepoint title list is tiny — only 56 strings in
Sefaria's whole title index (§3 above) — so building a Hebrew lexicon asset
wasn't worth it.

## 6. Preserved live-API findings

These findings came from live testing against Sefaria's public API during
the original `AddSource` build and the L2 rewrite verification. They explain
*why* the search code is shaped the way it is, and are preserved here (moved
from a comment block that used to sit at the top of `src/lib/nameSearch.js`,
and from `HANDOFF.md`'s 2026-07-15 entry) so future work doesn't accidentally
re-break a case that was fixed once already.

- **Nikud breaks both endpoints.** A pasted, vocalized string like
  "בְּרֵאשִׁית" 404s on `/api/texts` and returns junk from `/api/name`, where
  the unvocalized "בראשית" resolves fine on both. Nikud/cantillation must be
  stripped before either endpoint ever sees the string —
  `normalizeSourceInput` (`src/lib/inputNormalize.js`) does this
  unconditionally, upstream of everything else.

- **Address-split discovery.** Sefaria's name-completion endpoint does
  typo-tolerant matching against book/work *titles*, but a trailing
  chapter:verse address thrown in with the title (e.g. "Genessis 1", "Rashi
  on Bereishis 1:1") throws its fuzzy matcher off — confirmed live by testing
  "Genessis 1" until split: it returned garbage as one string, but resolved
  correctly once the address was split off and queried as the title alone.
  `splitTitleAndAddress` (`src/lib/inputNormalize.js`) performs this split;
  `nameSearch.js` always folds/matches the title part only, then reattaches
  the address at selection time via `resolveSelection`.

- **Gershayim/geresh bug** (found + fixed during v1 verification): the
  address-split regex originally only recognized ASCII-digit-led trailing
  tokens, so a Hebrew gematria address like "א:א" (no ASCII digits) wasn't
  split off — selecting a suggestion silently dropped it, adding the whole
  book instead of the specific verse. Fixed in `splitTitleAndAddress` to also
  split on a trailing token containing `:` or Hebrew geresh/gershayim marks
  (א׳, כ״ג), not just ASCII-digit-led ones. Kept here as a cautionary note
  for anyone touching address splitting again: test a gematria address
  specifically, not just "1:1".

- **Fuzzy-match findings that motivated retiring the old variant fan-out.**
  The original Latin-side approach (`translitVariants.js`, now deleted —
  subsumed by `fold.js`'s phonetic-skeleton classes) generated Ashkenazi ->
  canonical spelling variants and fired them at the API. Live testing showed
  a bad Ashkenazi-spelled *compound* query (e.g. "Rashi on Beraishis",
  "Tosafos on Brachos") routinely came back from `/api/name` with 3-10
  *irrelevant* fuzzy-matched refs (e.g. "Rashi on Amos", "Onkelos Exodus")
  rather than an empty result — so a "direct result count < 3" gate would
  almost never have fired for exactly the compound-title queries that needed
  fixing. This is why the Latin path is offline lexicon matching first
  (deterministic, no fuzz) with the live call only as a last-resort 0-hit
  fallback, rather than trying to out-guess Sefaria's fuzzy ranker with more
  variants. Re-verified live on 2026-07-16: raw "Rashi on Bereishis 1:1"
  against `/api/name` still returns `is_ref: false` and ten unrelated "Rashi
  on ___" completions — confirming the live endpoint alone still can't
  resolve this query; the offline lexicon match ("Rashi on Bereshit") is
  what makes it resolvable, via `resolveSelection` querying the corrected
  title once selected.

- **Hebrew fallback gating is preserved unchanged** (see §5) — deliberately
  kept as a live, per-keystroke fan-out rather than migrated to an offline
  table, because the Hebrew-codepoint title list is only 56 strings; building
  a Hebrew lexicon asset for that few entries wasn't worth it. The lexicon
  (`public/lexicon.json`) is Latin-only by construction (§3).

## 7. Known-N/A book/commentary combos

*(Stub — no concrete entries recorded yet.)*

Some book/commentary combinations may not exist as valid Sefaria refs at all
(e.g. a commentary that was never written on a given book), which would make
a "why doesn't this resolve" investigation a waste of time re-litigating a
combination that's expected to fail. Per SPEC.md §6, cataloguing such
combinations is out of scope for this pass, but this is the place such a
list belongs once one exists. When adding an entry, record: the exact query
tried, why it's expected to be N/A (not a bug), and the date/session it was
confirmed.

## 8. Orchestrator adjudications (2026-07-16)

- **(a) Pruning is minimal, not wholesale.** See §4 — each of the two safe
  pruning rules drops entries least-popular-first, only until the real gzip
  size is back under the target budget, never the entire eligible set.
- **(b) The Hebrew path is preserved unchanged; the lexicon is Latin-only.**
  No attempt was made to fold Hebrew titles into `public/lexicon.json` or to
  change `searchHebrewTitles`'s live fan-out behavior — see §5/§6.
- **(c) The lexicon is fetched via `import.meta.env.BASE_URL`.** Vite's
  configured base path is `/sefaria-era-fonts/` in the GitHub Pages build and
  `/` in dev; a bare `/lexicon.json` fetch would 404 once deployed under the
  Pages base path, so `lexiconUrl()` in `nameSearch.js` prefixes with
  `import.meta.env.BASE_URL` instead.
