# Next-session prompts

Ready-to-paste prompts for the next Claude Code session on this repo. Newest
entry on top. (This file stands in for Tamar's usual
`~/Documents/Projects/next-session-prompts.md`, which lives outside the repo
and so couldn't be written from a sandboxed session — move it there if you
prefer to keep it out of the tree.)

---

## 2026-07-16 → next session: verify-live + push the lexicon search rewrite

The offline-lexicon source-search rewrite (SPEC v2) is DONE across four waves
and committed to `main` but NOT pushed. Read HANDOFF.md first. Your job is to
verify the pieces that a sandbox with blocked egress to www.sefaria.org
couldn't, then push.

1. `cat HANDOFF.md`, then `npm ci` (or `npm install`), `npm test` (expect
   76 pass / 0 fail / 3 documented skips), `npm run build` (expect clean).
2. **Live-verify (needs real Sefaria egress):**
   - Run `node scripts/build-lexicon.mjs` with NO flag — confirm it fetches
     `/api/index/titles` live and reproduces `public/lexicon.json` (should be
     byte-identical to the committed asset unless Sefaria added titles; the
     script prints stats + the minimal §L1.5 pruning it applied).
   - `npm run dev`, open the app, and add "Rashi on Bereishis 1:1": confirm it
     resolves to Rashi on Genesis 1:1 and renders in **Mekorot Rashi** script.
     Watch the network panel: after the one-time `lexicon.json` fetch, typing
     should make **zero** calls, and selecting should make exactly **one**
     `/api/name` call. Also add a nach source (e.g. a verse from Isaiah) and a
     tannaim source (a Mishnah) to confirm the new **Hebrew Square Isaiah** and
     **Hebrew Square BenKosba** fonts render real glyphs (E's Wave-1 fonts).
   - Spot-check the cold-start: on a hard refresh, the very first query may
     fire one `/api/name` fallback while the lexicon loads — confirm it degrades
     gracefully (this is SPEC-intended). If you dislike the cold-start call,
     consider preloading the lexicon on mount.
3. If all good, `git push -u origin main` (this triggers the Pages deploy). The
   commits are unsigned/"Unverified" (committer email is correct); sign them
   first if your workflow requires.
4. Optional follow-ups (see HANDOFF open questions): drop in your fuller
   folk-query corpus and extend `test/fixtures/folk-queries.json`; decide
   whether the short-key collisions ("Sotah"/"Chagigah") are worth a fold-rule
   tweak (they're documented as acceptable limitations); consider L1 Phase-2
   (Hebrew-title key supplementation) only if you find real coverage gaps.
