// Romanized-title spelling variants for Sefaria's name-autocomplete fallback.
// Sefaria's own name index already knows a lot of Ashkenazi/Sephardi
// transliteration pairs (e.g. "Brachot" -> "Berakhot"), but its lexicon has
// two gaps: it doesn't cover the "ai"-for-tsere folk spelling at all, and it
// never cross-products a rewrite into a compound title like "Rashi on X" or
// "Mishnah X" — the sub-title has to already be a known spelling on its own.
// This module rewrites a query in the Ashkenazi -> Sephardi/canonical
// direction using a handful of cheap, linguistically-motivated substitutions,
// word by word, so compound titles get fixed too.

// "ai" is a common folk-phonetic spelling of the tsere vowel (the sound
// usually romanized "ei", as in "Bereishit") — English readers see the
// Hebrew letter combination and reach for the more familiar "ai" digraph.
// Applies anywhere in a word, not just once. Word-final "aim"/"ayim" is left
// alone — that's a genuine diphthong (Chaim, Shamayim), not the folk-spelled
// tsere, and rewriting it corrupts names like "HaChaim" mid-compound.
function applyR1(word) {
  return word.replace(/ai(?!m$)/gi, "ei");
}

// Whole-word spellings that no positional rule can derive: transliteration
// choices (Ohr/Or, Dovid/David) or vowel swaps particular to one name
// (Nechamiah/Nechemiah). Matched case-insensitively; only fires on an exact
// whole-word match so it doesn't clobber substrings.
const SPECIAL_WORDS = {
  ohr: "Or",
  dovid: "David",
  nechamiah: "Nechemiah",
};

function applySpecialWords(word) {
  const replacement = SPECIAL_WORDS[word.toLowerCase()];
  return replacement || word;
}

// Word-final sav vs. tav: Ashkenazi pronunciation devoices word-final tav
// with no dagesh to an "s" sound (sav), while Sephardi/Modern Hebrew
// pronounces the same letter "t" (tav) — hence Bereishis/Bereishit,
// Shemos/Shemot, Tosafos/Tosafot. This only fires when the "s" is preceded
// by a vowel, which is what distinguishes it from a genuine English plural
// ("Kings", "Judges", "Psalms") where the final "s" follows a consonant.
function applyR2(word) {
  const match = word.match(/^(.*[aeiouAEIOU])([sS])$/);
  if (!match) return word;
  const replacement = match[2] === "S" ? "T" : "t";
  return word.slice(0, -1) + replacement;
}

// Bet with a dagesh is "b"; bet without one is "v" — the same letter, two
// sounds depending on context, and romanizers frequently pick the "b" form
// even where a vowel on both sides means it should soften to "v"
// (Kesubos/Kesuvos, and Avraham-style names generally).
function applyR3(word) {
  return word.replace(/([aeiouAEIOU])([bB])([aeiouAEIOU])/g, (_, before, b, after) => {
    return before + (b === "B" ? "V" : "v") + after;
  });
}

// A second, distinct word-final sav/tav pattern: "os" endings (typically
// transliterating a holam + sav) go to "at", not "ot" — Shabbos -> Shabbat,
// not "Shabbot". Kept separate from R2 because the two rules disagree on the
// vowel of the output and both are worth trying as independent variants.
function applyR4(word) {
  if (word.length <= 2) return word;
  if (!/os$/i.test(word)) return word;
  const suffix = /OS$/.test(word) ? "AT" : "at";
  return word.slice(0, -2) + suffix;
}

// Splits on whitespace, keeping the separators, so rules can be applied
// per-word (needed for compound titles like "Rashi on Beraishis") while the
// surrounding structure of the query is preserved untouched.
function mapWords(query, wordFn) {
  return query
    .split(/(\s+)/)
    .map((token) => (/[a-zA-Z]/.test(token) ? wordFn(token) : token))
    .join("");
}

// Cheap digraph swaps: each of these romanizes the same Hebrew sound two
// common ways, independent of the sav/tav and bet/vet distinctions above.
// "ch"/"kh" both stand for chaf/ches; "tz"/"ts" both stand for tzadi; "ei" is
// also just sometimes flattened to a bare "e". Applied whole-query rather
// than word-by-word since there's no positional restriction, and each swap
// is offered as its own separate variant rather than combined.
const DIGRAPH_SWAPS = [
  [/ch/gi, "kh"],
  [/kh/gi, "ch"],
  [/tz/gi, "ts"],
  [/ts/gi, "tz"],
  [/ei/gi, "e"],
];

function canonicalWord(word) {
  return applyR3(applyR2(applyR1(word)));
}

// Generate alternate romanized spellings of a query title, in the
// Ashkenazi -> Sephardi/canonical direction, for use as a fallback when
// Sefaria's own name index comes up short on a Latin-script query. The
// first, highest-value variant applies R1+R2+R3 together across every word
// in the query — this is what's needed to rescue a compound title that
// requires more than one rewrite at once, e.g. "Rashi on Beraishis" ->
// "Rashi on Bereishit". The rest are single-rule variants, useful when only
// one of the substitutions is actually right for a given title. Never
// includes the original query. Capped at `maxVariants` so a query doesn't
// fan out into an unbounded number of API calls.
export function generateTranslitVariants(query, maxVariants = 6) {
  const variants = new Set();

  const canonical = mapWords(query, canonicalWord);
  if (canonical !== query) variants.add(canonical);

  for (const wordFn of [applyR1, applyR2, applyR3, applyR4]) {
    if (variants.size >= maxVariants) break;
    const variant = mapWords(query, wordFn);
    if (variant !== query) variants.add(variant);
  }

  for (const [pattern, replacement] of DIGRAPH_SWAPS) {
    if (variants.size >= maxVariants) break;
    const variant = query.replace(pattern, replacement);
    if (variant !== query) variants.add(variant);
  }

  variants.delete(query);
  return [...variants].slice(0, maxVariants);
}
