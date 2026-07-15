# HANDOFF

**Next action:** Check which of package.json / src/api/sefaria.js / src/lib/era.js / src/lib/fonts.js / src/fonts.css / src/App.jsx / src/components/ exist; finish any missing piece per docs/ARCHITECTURE.md, then `npm install && npm run dev` and verify a Tanach verse and a Rishon render in different fonts.

## Current state (updated mid-build — if the build finished, a later version of this file replaced this text)
- NOTE: this ran locally in a long-running session, not as a cloud routine — there is no
  remote to `git pull` from; everything is on this machine.
- docs/ARCHITECTURE.md is the authoritative spec: stack decision (Vite+React SPA on the
  public Sefaria API, NO fork of the Django monolith), era-classification algorithm, and
  the era→font table derived from the Ktav Ashuri font chart artifact
  (https://claude.ai/code/artifact/445bc177-627c-4dd7-b7e7-12163a84dfb7 — fetched
  successfully via WebFetch, full contents extracted).
- Three parallel Sonnet subagents were dispatched to write: (A) scaffold + API client +
  era classifier, (B) free-font acquisition + fonts.css + src/lib/fonts.js + docs/FONTS.md,
  (C) UI components + styles + README. Integration/verification not yet done.
- Deviation from brief: no separate Fable subagent was spawned for the mapping/architecture —
  the orchestrating session is Fable and already had the chart in context, so it wrote
  docs/ARCHITECTURE.md directly (cheaper, same judgment).

## Open questions
- Paid fonts needing licensed copies or substitutes: Koren Type ($, the chart's true
  Rishonim pick — substituted with free Culmus Shofar, which the chart itself notes is
  Koren-derived). Nach (Isaiah-scroll) and Tannaim (Ben Kosba) have no confirmed free
  fonts — placeholders flagged NEEDS-FONT. Amoraim is a genuine chart gap (no surviving
  exemplar) — Keter YG used, flagged CHART-GAP.
- Sefaria index `era` codes (T/A/GN/RI/AH/CO) were to be verified against the live API by
  agent A — confirm src/lib/era.js matches reality.
- Not yet decided: whether "acharei" detection via compDate ≥ 1800 actually works with
  Sefaria's compDate format.

## Resume command
cd ~/Documents/Projects/sefaria-era-fonts && cat HANDOFF.md docs/ARCHITECTURE.md && ls src src/components public/fonts
