// Chrome (UI) string dictionary for the two site languages. Only covers
// chrome strings — NOT source text content, which always renders in
// whatever language(s) the per-source/global display settings pick.
// Usage: `t(key, siteLang)` or `t(key, siteLang, {name: "..."})` for the one
// interpolated string (attribution tag).

export const STRINGS = {
  en: {
    sheetTitlePlaceholder: "Untitled Sheet",
    print: "Print / Export",
    addSourcePlaceholder:
      "Genesis 1:1 · Brachot 2a · Rashi al Bereshit · בראשית א:א · a pasted Sefaria link",
    add: "Add",
    settings: "Settings",
    settingsClose: "Close settings",
    titleBarSection: "Source title bar",
    bodySection: "Source text",
    language: "Language",
    languageBoth: "Both",
    languageHebrew: "Hebrew",
    languageEnglish: "English",
    alignment: "Alignment",
    alignmentSides: "Sides (EN left, HE right)",
    alignmentCenter: "Center",
    nikkud: "Nikkud",
    tanakhMode: "Tanakh display mode",
    otherMode: "Other-text display mode",
    modeKlaf: "Klaf (scroll)",
    modeSefer: "Sefer (book)",
    modeSimple: "Simple",
    modeBare: "Bare",
    translationVersion: "Translation version",
    versionJps: "JPS 1985 (default)",
    versionSefariaDefault: "Sefaria default",
    versionCustom: "Custom version title…",
    versionCustomPlaceholder: "Exact Sefaria version title",
    showAttribution: "Show attribution",
    resetAll: "Reset all title/text modifications",
    resetAllConfirm:
      "This will discard every title and text edit on every source in this sheet. Continue?",
    darkModeLight: "Light mode (click for dark)",
    darkModeDark: "Dark mode (click for system)",
    darkModeSystem: "System theme (click for light)",
    siteLanguageToggle: "Switch site language to Hebrew",
    siteLanguageToggleHe: "Switch site language to English",
    keyboardStub: "Hebrew keyboard",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    noSources: "No sources yet — add one above.",
  },
  he: {
    sheetTitlePlaceholder: "דף מקורות ללא שם",
    print: "הדפסה / ייצוא",
    addSourcePlaceholder: "בראשית א:א · ברכות ב. · רש\"י על בראשית · Genesis 1:1",
    add: "הוסף",
    settings: "הגדרות",
    settingsClose: "סגור הגדרות",
    titleBarSection: "שורת כותרת המקור",
    bodySection: "טקסט המקור",
    language: "שפה",
    languageBoth: "שתיהן",
    languageHebrew: "עברית",
    languageEnglish: "אנגלית",
    alignment: "יישור",
    alignmentSides: "צדדים (אנגלית משמאל, עברית מימין)",
    alignmentCenter: "מרכז",
    nikkud: "ניקוד",
    tanakhMode: "מצב תצוגת תנ\"ך",
    otherMode: "מצב תצוגת טקסטים אחרים",
    modeKlaf: "קלף (מגילה)",
    modeSefer: "ספר",
    modeSimple: "פשוט",
    modeBare: "חשוף",
    translationVersion: "גרסת תרגום",
    versionJps: "JPS 1985 (ברירת מחדל)",
    versionSefariaDefault: "ברירת המחדל של ספריא",
    versionCustom: "כותרת גרסה מותאמת אישית…",
    versionCustomPlaceholder: "כותרת גרסה מדויקת בספריא",
    showAttribution: "הצג ייחוס",
    resetAll: "אפס את כל שינויי הכותרות/הטקסט",
    resetAllConfirm:
      "פעולה זו תבטל כל עריכת כותרת וטקסט בכל מקור בדף זה. להמשיך?",
    darkModeLight: "מצב בהיר (לחץ למצב כהה)",
    darkModeDark: "מצב כהה (לחץ למצב מערכת)",
    darkModeSystem: "ערכת נושא של המערכת (לחץ למצב בהיר)",
    siteLanguageToggle: "עבור לשפת ממשק עברית",
    siteLanguageToggleHe: "עבור לשפת ממשק אנגלית",
    keyboardStub: "מקלדת עברית",
    moveUp: "הזז למעלה",
    moveDown: "הזז למטה",
    remove: "הסר",
    noSources: "אין עדיין מקורות — הוסף אחד למעלה.",
  },
};

export function t(key, siteLang, vars) {
  const dict = STRINGS[siteLang] || STRINGS.en;
  let str = dict[key] != null ? dict[key] : STRINGS.en[key] != null ? STRINGS.en[key] : key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), vars[k]);
    }
  }
  return str;
}
