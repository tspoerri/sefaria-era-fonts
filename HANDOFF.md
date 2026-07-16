# HANDOFF

**Next action:** This session's git credentials turned out to be **push-blocked
(403)** — `git push` to `origin/main` was attempted and rejected, so the four
commits below could NOT be pushed from here as originally planned. Instead
they were delivered to Tamar as a git bundle
(`search-rewrite-waves-1-4.bundle`, contains `e435362..269d630`). To land
them:
```
cd ~/path/to/sefaria-era-fonts   # your existing local clone
git fetch /path/to/search-rewrite-waves-1-4.bundle main:search-rewrite
git merge --ff-only search-rewrite
git push origin main
```
Use the explicit `main:search-rewrite` refspec — the bundle only contains
`refs/heads/main`, no `HEAD` ref, so a bare `git clone`/`git fetch` on it
fails with "couldn't find remote ref HEAD". Pushing triggers the Pages
deploy (`.github/workflows/deploy.yml`). Then run the ONE check that
couldn't run in this sandbox: open the app in a browser and add "Rashi on
Bereishis 1:1" — confirm it resolves to Rashi on Genesis, renders in
**Mekorot Rashi** script, and the network panel shows exactly **one**
`lexicon.json` fetch + **one** `/api/name` call (see "Not verifiable
in-sandbox" below for why this was deferred).

## Current state (2026-07-16, search-rewrite session — lexicon architecture)

The guess-and-fan-out autocomplete is gone; source search is now an offline
phonetic-skeleton lexicon with a single name call at selection. Full search
docs live in **docs/SEARCH.md**. Delivered across four waves (all committed,
NOT pushed):

- **Wave 0** (`0930965`, pre-existing): dirty-tree snapshot.
- **Wave 1** (`e435362`):
  - `src/lib/fold.js` — the shared `fold()` phonetic-skeleton algorithm (single
    source of truth, imported by both build + runtime).
  - `scripts/build-lexicon.mjs` — rerunnable, plain Node, no deps. Default
    fetches `/api/index/titles`; `--titles-file` reads a local snapshot (used
    here because this sandbox blocks egress to www.sefaria.org).
  - `public/lexicon.json` — the committed asset. 47,144 raw keys → minimal
    §L1.5 rule-(i) pruning drops the 2,125 least-popular deep-nodes → **45,019
    keys**, raw 3.7 MB, gzip-6 **571 KB** (≤600 KB budget). Idempotent
    (byte-identical rebuild).
  - Fonts (E): nach/tannaim NEEDS-FONT flags **cleared** with genuinely-free
    GPL+FE faces — Hebrew Square Isaiah (Great Isaiah Scroll) + Habakkuk
    alternate for nach, Hebrew Square BenKosba (Bar Kochba letters) for
    tannaim (Culmus "Ancient Semitic Scripts", Yoram Gnat). License text
    committed alongside each; docs/FONTS.md + fonts.js + fonts.css updated.
  - Era classifier (F): GN→geonim and AH+compDate≥1800→acharei confirmed live
    via the Sefaria connector; no code change needed.
- **Wave 2** (`3d212ea`): `src/lib/nameSearch.js` (all search policy: offline
  match, one name call at selection, base-URL-aware lexicon fetch); sefaria.js
  slimmed to transport (`fetchText`/`fetchIndex`/`fetchNameRaw`);
  `translitVariants.js` deleted; AddSource rewired (sync offline match per
  keystroke, 250ms debounce only for fallback/API). Hebrew path preserved
  unchanged (hebrewSearch.js byte-identical).
- **Wave 3** (`024a0a1`): test suite `test/` (`npm test` = 79 tests, 76 pass,
  0 fail, 3 documented skips); docs truth-up (new docs/SEARCH.md,
  ARCHITECTURE.md file-layout fixed, CLAUDE.md pointer).
- **Wave 4** (this commit): `npm test` green, `npm run build` passes, browser
  smoke of the warm offline path passed (see below). HANDOFF +
  next-session-prompt.md written; SPEC.md deleted (its work is done).

### Verified this session
- `npm test` → 76 pass / 0 fail / 3 skip. `npm run build` → clean.
- Independent offline smoke (real lexicon): folk spellings → canonical titles
  (Bereishis→Bereshit, Shabbos→Shabbat, Kesubos→Kethuvoth, Rashi on
  Bereishis→Rashi on Bereshit, Melachim 2 3:4→Melachim II + addr "3:4",
  Mishnah Brachos→Mishna Berakhot).
- Live `/api/name` resolution 8/8 via the Sefaria connector (resolveSelection
  logic is sound).
- **Browser smoke (headless Chromium, built app under the Pages base path):**
  lexicon.json fetched exactly once; after warm-up, typing the full
  "Rashi on Bereishis 1:1" produced **zero** network calls and the top
  suggestion **"Rashi on Bereshit"** in the real DOM. Bare `/lexicon.json`
  404s while `/sefaria-era-fonts/lexicon.json` 200s — confirms the
  `import.meta.env.BASE_URL` fetch is required and correct. New fonts serve 200.

## Open questions / for Tamar

- **Push + sign.** Commits are unpushed — originally by design (session was
  told never to push), and it turned out this session's git credentials are
  push-blocked (403) anyway, so pushing from here wasn't an option even at
  Wave 4. Delivered as a bundle instead — see "Next action" above. They show
  as GitHub "Unverified" (no GPG signature; committer email is correct
  `noreply@anthropic.com`) — sign them if your workflow requires it, e.g.
  `git rebase --exec 'git commit --amend --no-edit -S' origin/main` after
  merging the bundle in. Nothing in this session touched `.github/workflows/`.
- **Not verifiable in-sandbox (egress to www.sefaria.org is policy-blocked
  here, 403).** Three things need your live browser: (1) the cold-start FIRST
  query on a fresh page can fall through to one `/api/name` call while the
  3.7 MB lexicon is still loading — this is the spec's intended "first
  keystrokes aren't dead" fallback; confirm it behaves gracefully with real
  egress. (2) `resolveSelection`'s name call at selection + the full
  add→fetchText→**Rashi-script render**. (3) E's new nach/tannaim fonts
  rendering actual glyphs in a SourceCard (files serve 200; glyph render not
  visually confirmed). The build script also could not be run against LIVE
  Sefaria here — it was run via a MCP-obtained title snapshot; rerun
  `node scripts/build-lexicon.mjs` (no flag) once in an egress-enabled env to
  confirm the live path and refresh the asset.
- **Missing test corpus.** SPEC referenced a "141-query" / "8-query
  regression" set "from HANDOFF.md" that does NOT exist in this repo. T built
  a 38-entry stand-in (`test/fixtures/folk-queries.json`). If you have the
  fuller corpus, drop it in and extend the fixture.
- **Known offline limitations (documented, not bugs):** "Genessis 1:1"
  (doubled-letter typo — 0 offline hits, resolved only by the live fallback);
  "Sotah"/"Chagigah" (short fold-key collisions land on unrelated titles in
  the top-3). The phonetic skeleton is deliberately coarse; the live fallback
  + Sefaria's own matching cover these. Also note several bare English titles
  (Rambam, Berakhot, Isaiah…) aren't standalone entries in Sefaria's title
  index — they exist only inside compound titles.
- **L1 Phase-2 (Hebrew-title key supplementation via the hebrew-toolkit
  engine) was NOT done** — the toolkit wasn't available in this environment,
  and Wave-3 testing showed no coverage gaps traceable to missing keys (the
  skips are fold collisions/typos, not missing Hebrew keys). Left available if
  you want deeper coverage; not required.
- **Possible future tweak:** preload the lexicon on app mount (not lazily on
  first keystroke) to eliminate the cold-start fallback entirely. Current
  behavior matches SPEC §L2 as written.

## Resume command
cd sefaria-era-fonts && cat HANDOFF.md
# merge the delivered bundle (see "Next action" above), then:
npm test && npm run dev
# then browser-verify "Rashi on Bereishis 1:1" renders in Rashi script,
# and git push origin main when the four commits look good.
