# sefaria-era-fonts

Prototype source-sheet builder (à la Sefaria's) where each source's Hebrew renders in a
font matching the era it was written in — Chumash in STAM script, Gemara in an
Aleppo-Codex-derived face, Rashi in Rashi script, Rishonim in a Koren-like face, etc.
Era assignments come from Tamar's Ktav Ashuri font-era research chart
(artifact 445bc177-627c-4dd7-b7e7-12163a84dfb7 on claude.ai).

## Structure
- **Not a Sefaria fork.** Vite + React SPA, no backend; fetches texts client-side from the
  public Sefaria API (www.sefaria.org/api). Sheet state in localStorage; export = print CSS.
- docs/ARCHITECTURE.md — authoritative spec: era-classification algorithm + era→font table.
- docs/FONTS.md — what font each era ships, licenses, and which are placeholders/substitutes.
- src/api/sefaria.js (API client) · src/lib/era.js (classifier) · src/lib/fonts.js (era→font
  map with flags) · src/components/ (AddSource, Sheet, SourceCard).
- public/fonts/ — committed free fonts only (OFL / GPL+FE). NO paid fonts (Koren etc.) —
  substitutes are flagged; a licensed user can drop in real files and edit fonts.js.

## Run
npm install && npm run dev  → http://localhost:5173

## Conventions
- Plain JS, no TypeScript. No CSS framework. Keep deps to react/react-dom/vite.
- Era keys: chumash nach tannaim amoraim geonim rashi rishonim acharonim acharei contemporary.
- Never add a font without recording its license in docs/FONTS.md.
- Read HANDOFF.md at session start; update it at session end (Tamar's standing workflow).
