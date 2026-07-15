# SPEC: sefaria-era-fonts improvement session (orchestrator: Opus)

Written 2026-07-15 (v2 — lexicon architecture). Supersedes BOTH the earlier
single-agent transliteration brief AND v1 of this spec (whose Workstream A patched
the runtime variant-guessing pipeline). Search quality is the project's core value
proposition — Sefaria's own source-sheet builder's worst pain point is its search —
so this spec replaces the guess-and-fan-out autocomplete with an offline
lexicon/phonetic-key architecture. Delete this file when all waves are done and
HANDOFF.md is updated.

---

## 0. Role and operating rules for the orchestrator (Opus)

You are the ORCHESTRATOR. Your job is sequencing, briefing subagents, reviewing
their reports, resolving conflicts, and committing verified waves. You do NOT do
read-heavy or mechanical work inline — Opus tokens are scarce (Tamar's standing
rule).

- **Delegate everything executable.** Default subagent model: `sonnet`. Use
  `haiku` for purely mechanical tasks (file moves, .DS_Store cleanup, running a
  prewritten test script and pasting results). Reserve your own inline work for:
  reading subagent reports, adjudicating spec deviations, writing/refining
  briefs, git commits, and the final HANDOFF/docs review.
- **Subagents must not spawn further agents.** Say so in every brief.
- **Every subagent brief must be self-contained**: absolute file paths, the
  relevant excerpt of this spec (don't say "see SPEC.md §L1" — paste the text),
  expected report format, and the instruction to return full results in its
  final message.
- **Keep your own context lean**: subagents report conclusions + minimal
  evidence (pass/fail tables, diff summaries), not full file dumps.
- **Parallelize only disjoint-file work** (wave plan §4). Two agents must never
  hold edits to the same file in the same wave.
- **Git checkpoints**: commit at the end of each VERIFIED wave with a message
  listing what was verified. Do NOT push — `.github/workflows/deploy.yml`
  deploys Pages on push; Tamar pushes after her own review. Never force-ops.
- **On failure**: if a subagent reports a fix genuinely can't work, record it
  and move on — do not let it hack around the spec. You adjudicate deviations;
  minor ones (helper naming, code shape) are fine, behavioral ones (ranking,
  API-call budget, license bar, fold-rule semantics) are not.
- **Session end** (Tamar's standing workflow): update HANDOFF.md (next action
  at top, current state, open questions, resume command), append a
  ready-to-paste next-session prompt to
  `~/Documents/Projects/next-session-prompts.md`.

---

## 1. Project snapshot

- Vite + React 18 SPA, **plain JS, no TypeScript, no CSS framework**. Runtime
  deps limited to react/react-dom/vite. `node:test` is the only allowed test
  runner (zero new runtime deps). Build scripts under `scripts/` may use plain
  Node ≥18 (global `fetch`), no new package.json dependencies.
- No backend. Client fetches from the public Sefaria API
  (`https://www.sefaria.org/api/...`). Sheet state in localStorage.
- Layout: `src/api/sefaria.js` (API client + current autocomplete orchestration),
  `src/lib/era.js` (era classifier), `src/lib/fonts.js` (era→font map),
  `src/lib/hebrewSearch.js` (Hebrew-input handling: nikud stripping, geresh/
  gershayim address split, confusable letters), `src/lib/inputNormalize.js`,
  `src/lib/translitVariants.js` (Ashkenazi→canonical spelling-variant generator
  — being RETIRED by this spec, see §2-L2), `src/components/` (AddSource,
  Sheet, SourceCard), `public/fonts/`, `docs/ARCHITECTURE.md`, `docs/FONTS.md`.
- Era keys: chumash nach tannaim amoraim geonim rashi rishonim acharonim
  acharei contemporary.
- **Working tree is dirty**: `src/api/sefaria.js` modified,
  `src/lib/translitVariants.js` and `SPEC.md` untracked. Wave 0 snapshot-commits
  everything as-is before any agent touches a file.

### 1.1 External resources available this session

- **hebrew-toolkit translit engine** (additional working directory, READ-ONLY):
  `/Users/tamar/Documents/Projects/hebrew-toolkit/src/lib/translit/`
  (`engine.ts`, `styles.ts`, `stress.ts`, `types.ts` — TypeScript, depends on
  `havarotjs`). Never edit these files; never import them into the SPA bundle.
  Uses in this session:
  1. `styles.ts` consonant tables (styles `000_simple_sefardi` and
     `010_simple_ashkenazi`) are the AUTHORITY for the consonant-class fold
     table in §2-L1: any two Latin renderings of the same Hebrew consonant
     across those two styles belong to the same fold class.
  2. Optional (Phase-2 only, see §2-L1 step 6): the engine can transliterate
     unpointed Hebrew (`allowNoNiqqud: true` degrades to consonants — which is
     exactly a skeleton) to generate keys for Hebrew-only alternate titles.
     Run via `npx tsx` from a scratch script; nothing TS ships in this repo.
- **Sefaria MCP connector** is attached to this session (tools
  `mcp__…__list-endpoints / search-endpoints / get-endpoint / execute-request`).
  Use it for spot-checking API responses and endpoint semantics during review.
  Build scripts and the app itself use plain `fetch` — the MCP is a session
  convenience, not a dependency.

### 1.2 Validated groundwork (do not re-derive — measured live 2026-07-15)

- `GET https://www.sefaria.org/api/index/titles` returns
  `{"books": [ ...66,625 strings... ]}` — every title string Sefaria's ref
  parser recognizes: canonical titles, alternates ("Bereishis", "Koheles",
  "Kethuvoth", "N'darim"), abbreviations ("Gen.", "Git."), diacritic variants
  ("Soṭah"), foreign-language titles ("Genèse"). 56 entries contain Hebrew
  codepoints; 66,569 are Latin-script. ~55k contain commas (complex-node
  titles like "Shulchan Arukh, Orach Chayim"). Raw payload ≈3.1 MB.
- The list is FLAT (no variant→canonical mapping), but that doesn't matter:
  every string in it resolves via one `GET /api/name/{string}` call, and is a
  valid ref prefix. Matching user input to ANY recognized string offline, then
  making a single API call, replaces the entire variant fan-out.
- List order tracks TOC order (Tanakh first, then Talmud, …). First-occurrence
  index is a usable popularity/priority rank.
- **Prototype result** (Python, same fold rules as §2-L1): 66,569 Latin strings
  fold to 49,028 unique skeleton keys; key→representative JSON ≈4 MB raw,
  ≈523 KB gzipped. A 14-query folk-spelling smoke test hit 14/14 titles
  offline — including compound "Rashi on Bereishis" → "Rashi on Bereshit" —
  with one ranking artifact ("Ohr HaChaim") fixed by the standalone-h rule in
  §2-L1 step 3e.

---

## 2. Workstreams

### L1 — Lexicon build script + committed data asset  (model: sonnet)

**Goal.** A rerunnable script that snapshots Sefaria's title inventory, folds
it into a phonetic-skeleton index, and emits a static JSON asset the app
lazy-loads. The asset is committed; the script is committed; the raw 3 MB
snapshot is NOT committed.

**Deliverables.**
- `scripts/build-lexicon.mjs` — plain Node ≥18, no deps, run manually
  (`node scripts/build-lexicon.mjs`). Fetches `/api/index/titles`, writes
  `public/lexicon.json` and prints stats (entry counts, gzip estimate).
- `public/lexicon.json` — the committed asset (Vite serves and gzips it).
- `src/lib/fold.js` — the fold function as a runtime ES module (shared
  algorithm; the build script imports THIS file so build-time and runtime
  folding can never drift).

**Fold algorithm (`fold.js`) — pin these semantics exactly, in this order:**
1. Lowercase; Unicode NFD; strip all combining marks (kills ṭ/’ diacritics).
2. Remove apostrophes (' ’ ‘), hyphens, periods. Collapse whitespace.
3. Consonant-class folding via ordered regex passes (digraphs before singles):
   a. `sh` → `$` (shin stays its own class — do this first so later rules
      can't eat its h or s).
   b. `tz|ts|z` → `z`.
   c. `ch|kh|q|ck|k`, and `c` before a/o/u → `k`.
   d. `ph|f|v|w|b` → `b`.
   e. **Standalone-h rule**: after (a)–(d) have consumed digraph h's, delete
      every remaining `h` (matres/vowel-carriers: "Ohr"/"Or" → `r`,
      "Sotah"/"Sota" → `tt`, "HaChaim"/"Hachayim" → `km`). Then `th|t|s` → `t`
      (Ashkenazi sav ↔ tav fold: "Shabbos"/"Shabbat" → `$bbt`).
   f. Delete vowels `[aeiou]` and `y` when intervocalic-ish is NOT attempted —
      keep it simple: delete `[aeiou]` only; keep `y` `j` `g` `d` `l` `m` `n`
      `p` `r` as-is. (Prototype kept `y`: "Yeshayohu" → `y$yh` matched
      "Yishayahu". Do the same.)
   g. Strip any remaining char not in `[a-z$0-9 ,]`.
4. **Numeral normalization**, applied to whole tokens before folding: map
   token `1`↔`i`, `2`↔`ii`, `3`↔`iii` bidirectionally by emitting the arabic
   form in the key (so "II Kings", "2 Kings", "Kings 2" keys agree where the
   title list has them; trailing/leading position is preserved as-is — do NOT
   try to reorder tokens).
5. Build the index: for each Latin title string, `key = fold(title)`; keep per
   key the FIRST-occurring title (TOC-order priority) as `{ key → [title,
   rank] }`. Also emit the sorted key array (for binary-search prefix lookup)
   — choose a compact JSON shape, e.g. parallel arrays; document it in a
   header comment in the script AND in docs/SEARCH.md (§D).
   Size budget: `public/lexicon.json` ≤ 5 MB raw / ≤ 600 KB gzipped. If over,
   prune ONLY by these safe rules, in order, until under: (i) drop entries
   whose title contains a comma AND whose pre-comma base already has an entry
   with the same pre-comma key (deep node alt-spellings); (ii) drop
   non-Hebrew-transliteration foreign titles matching `[àâäéèêëîïôöûüç]` in
   the ORIGINAL string (Genèse etc. — note NFD-stripping happens at fold time,
   so test the original). Never prune abbreviations or Ashkenazi variants.
6. **Phase 2 — only if Wave 3 testing shows coverage gaps** (orchestrator
   decides): supplement keys from Hebrew alternate titles by transliterating
   them with the hebrew-toolkit engine (`010_simple_ashkenazi`, via `npx tsx`
   scratch script in the scratchpad — output merged by rerunning
   build-lexicon with a `--extra-keys file.json` flag). Do not build this
   speculatively.

**Verification (L1).**
- Rerun-idempotence: running the script twice produces byte-identical output.
- Stats printed match §1.2 magnitudes (±20%: ~49k keys).
- Smoke assertions inside the script (fail loudly): `fold('Bereishis') ===
  fold('Bereshit')`, `fold('Shabbos') === fold('Shabbat')`, `fold('Ohr
  HaChaim') === fold('Or HaChaim')`, `fold('Kesubos') === fold('Ketubot')`,
  and lexicon lookup of each returns a title.

### L2 — Runtime matcher: rewrite autocomplete around the lexicon  (model: sonnet, after L1)

**Goal.** Replace the per-keystroke API fan-out (`fetchNameSuggestionsRobust` +
`generateTranslitVariants`) with offline lexicon matching. One API call at
selection time; zero API calls while typing (after the one-time lexicon fetch).

**Deliverables.**
- New `src/lib/nameSearch.js` — all search policy lives here:
  - `loadLexicon()`: lazy `fetch('/lexicon.json')` on first search keystroke;
    module-level promise cache (never fetched twice per session). While
    loading, fall back to a single direct `/api/name/{q}` call so first
    keystrokes aren't dead.
  - `searchTitles(query)`: split a trailing ref address off the query first
    (reuse the EXISTING address/geresh/gershayim logic — check
    `src/lib/hebrewSearch.js` and `src/lib/inputNormalize.js` for what's
    already there; do not reimplement). Fold the title part with
    `fold()` (§L1). Match: exact-key hits first, then key-prefix hits
    (binary search over the sorted key array), then per-word-prefix hits for
    multiword queries. Rank: exact > prefix > word-prefix, then ascending
    TOC rank, then shorter title. Return ≤8 suggestions shaped exactly like
    the current suggestion objects so `AddSource.jsx` needs minimal change.
  - `resolveSelection(title, address)`: ONE `GET /api/name/{title address}`
    (or `/api/name/{title}` when no address) to get canonical ref +
    completions; this is the only network call in the happy path.
  - Fallback: if offline matching returns 0 hits, one direct
    `/api/name/{query}` call (Sefaria's own fuzzy covers what the snapshot
    doesn't — new books, typos beyond folding). NO variant fan-out.
- `src/api/sefaria.js` slimmed to pure transport: `fetchText`, `fetchIndex`,
  and a thin `fetchNameRaw(q)` used by nameSearch. DELETE
  `fetchNameSuggestionsRobust` and `mergeSuggestions` (git history keeps
  them). Preserve the live-API findings currently in its comments by MOVING
  them into docs/SEARCH.md (coordinate with §D — L2 leaves them in a code
  comment block at top of nameSearch.js; D relocates).
- DELETE `src/lib/translitVariants.js` (the fold table subsumes R1–R4,
  SPECIAL_WORDS, DIGRAPH_SWAPS). If any AddSource path imports it, rewire.
- Hebrew-script input keeps its existing path (`hebrewSearch.js`) UNCHANGED —
  lexicon matching applies to Latin-script input only (only 56 Hebrew strings
  exist in the title list; not worth switching).
- `AddSource.jsx`: keep debounce (≥250 ms) for the fallback/API paths, but
  offline matching may run per keystroke undebounced. Verify no path can
  issue more than 1 API request per debounce window.

**Verification (L2).**
- Offline: node smoke script asserting the §L1 folk-spelling set plus:
  "Melachim 2 3:4" → suggestion for II Melachim with address "3:4";
  "Melachim 2:5" handled per the CURRENT documented behavior (check
  HANDOFF.md / existing comments for the chosen disambiguation; preserve it);
  "Rashi on Bereishis 1:1" → "Rashi on Bereshit" + address "1:1";
  "Mishnah Brachos" → Mishnah Berakhot-family hit.
- Live (≥150 ms between calls): re-run the ~25 previously-failing queries and
  the 8-query regression set from HANDOFF.md through the real UI path
  (`searchTitles` + `resolveSelection`), report a pass/fail table.
- Request budget: instrument temporarily (counter in scratch, not committed)
  and show: typing a full query end-to-end = ≤1 lexicon fetch + ≤1 name call.
- `npm run build` passes; lexicon fetch works under `npm run dev` (Vite serves
  public/ at root) AND under the Pages base path — use a relative or
  `import.meta.env.BASE_URL`-prefixed URL, not a bare `/lexicon.json`.

### T — Durable test suite  (model: sonnet, after L2)

`node --test`, zero new deps, all OFFLINE (fixtures only — the lexicon asset
itself is the fixture; no network in tests):
- `test/fold.test.js` — every §L1 smoke pair, plus the full folk-spelling
  corpus from HANDOFF.md's 141-query live test (encode as
  `test/fixtures/folk-queries.json`: query → expected canonical title;
  mark known-N/A entries skipped). Assert top-3 offline suggestions contain
  the expected title.
- `test/nameSearch.test.js` — address splitting, ranking order, numbered-book
  cases, zero-hit fallback signalling (mock `fetchNameRaw`).
- `test/hebrewSearch.test.js` — pin existing Hebrew-path behavior (nikud
  stripping, geresh address split, confusables) so L2's refactor can't have
  silently broken it.
- Add `"test": "node --test"` to package.json scripts.

### D — Documentation truth-up  (model: haiku, after L2)

- `docs/ARCHITECTURE.md`: fix the stale file-layout section (add
  hebrewSearch.js, inputNormalize.js, nameSearch.js, fold.js, lexicon asset;
  remove translitVariants.js); add a short "Search architecture" section
  pointing to docs/SEARCH.md.
- NEW `docs/SEARCH.md`: the durable home for search knowledge — lexicon
  pipeline diagram (build script → asset → runtime match → single name call),
  the fold-rule table with the WHY for each class (Ashkenazi/Sephardi
  correspondences), the lexicon JSON shape, regeneration instructions
  (`node scripts/build-lexicon.mjs`, when to rerun: rarely — Sefaria adds
  titles slowly), the fallback path, and the live-API findings relocated from
  the old sefaria.js comments and HANDOFF.md (geresh split, nikud, N/A combo
  list).
- CLAUDE.md: one line under Structure pointing at docs/SEARCH.md.

### E — Font-gap hunt: nach + tannaim  (model: sonnet with WebSearch, Wave 1, disjoint)

Unchanged from v1: find OFL/GPL+FE faces to replace the flagged placeholder
fonts for the `nach` and `tannaim` eras (see docs/FONTS.md flags). Hard
license bar — if nothing qualifies, deliver a written survey of near-misses
instead of a font. Verify the rashi font's license file is present and
correct. Any font added: license text committed alongside, docs/FONTS.md row,
browser-preview verification that it actually renders Hebrew in a SourceCard.

### F — Era-classifier loose ends  (model: haiku, Wave 1, disjoint)

Unchanged from v1: live-test the geonim (`GN` era code) and true acharei
(e.g. Mishnah Berurah) classification paths against real API index responses.
REPORT ONLY — no era.js redesign; trivial mapping fixes allowed with
before/after evidence.

### G — Repo hygiene  (model: haiku, Wave 1, disjoint)

Unchanged from v1: remove committed `.DS_Store` files, ensure .gitignore
covers them. Add `scripts/` scratch outputs and the raw titles snapshot to
.gitignore if the L1 script writes any intermediates.

---

## 3. Explicitly retired from v1

- v1 Workstream A (runtime regex-variant patches: R1 guard, applySpecialWords
  wiring, f↔ph digraph, compound-resolution fallback, maxVariants bump) —
  entirely subsumed by L1's fold table + L2's matcher. Do NOT land any of it.
  The partial work already in the dirty tree gets snapshot-committed in
  Wave 0 for history, then deleted by L2.
- v1 Workstream C (extract nameSearch.js as a pure move) — L2 does the
  extraction as part of the rewrite.

---

## 4. Wave plan

- **Wave 0** (orchestrator inline): `git add -A && git commit` snapshot of the
  dirty tree ("pre-lexicon snapshot: v1 spec + partial variant work").
- **Wave 1** (parallel, disjoint files): **L1** ∥ **E** ∥ **F** ∥ **G**.
  Gate: L1 verification passes (idempotence + smoke asserts). Commit.
- **Wave 2**: **L2** (touches sefaria.js, nameSearch.js, fold.js imports,
  AddSource.jsx, deletes translitVariants.js). Gate: L2 offline + live
  verification tables reviewed by orchestrator. Commit.
- **Wave 3** (parallel, disjoint): **T** ∥ **D**. Gate: `npm test` green.
  Commit. (Phase-2 of L1 triggers here only if T's corpus shows coverage
  gaps traced to missing keys, not to fold-rule bugs.)
- **Wave 4** (orchestrator inline): `npm test` + `npm run build` + browser
  smoke test via the preview tools (type "Rashi on Bereishis 1:1", add the
  source, confirm it renders in Rashi script; check the network panel shows
  one lexicon fetch + one name call). Final commit. Update HANDOFF.md +
  next-session-prompts.md. Do not push.

---

## 5. Hard constraints (repeat in every brief)

- Plain JS in this repo. No TypeScript, no new package.json deps (`node:test`
  and Node ≥18 built-ins only). hebrew-toolkit files are read-only reference.
- Fonts: OFL/GPL+FE only, license text committed alongside, docs/FONTS.md row
  required. NO paid fonts.
- Live Sefaria API testing: ≥150 ms between calls; scratch test scripts live
  in the session scratchpad, never committed.
- Never push. Never touch `.github/workflows/`. No era.js semantic changes
  beyond trivial mapping fixes with evidence (F).
- Preserve existing code comments' knowledge — relocate, don't delete
  (L2 → D handoff).
- `public/lexicon.json` ≤ 5 MB raw / ≤ 600 KB gzipped (prune per §L1.5).

## 6. Out of scope

Sheet-builder features, UI redesign, TS migration, backend/proxy, service
workers or IndexedDB caching of the lexicon (module cache is enough for a
prototype), acharei/acharonim boundary redesign, known-N/A book/commentary
combos (keep the list in docs/SEARCH.md), transliteration of user-facing
TEXT (the engine's phonetic output is not a display feature here — search
keys only).
