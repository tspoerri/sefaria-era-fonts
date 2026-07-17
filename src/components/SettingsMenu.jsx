import { useEffect, useRef, useState } from "react";
import { t } from "../lib/strings.js";
import { DEFAULTS, TANAKH_PRESETS, OTHER_PRESETS, presetForToggles } from "../lib/settings.js";

const TOGGLE_FIELDS = [
  "nikkud",
  "taamim",
  "punctuation",
  "verseLineBreaks",
  "chapterLineBreaks",
  "showNumbers",
  "chapterHeadings",
];

const TOGGLE_LABEL_KEYS = {
  nikkud: "nikkud",
  taamim: "taamim",
  punctuation: "punctuation",
  verseLineBreaks: "verseLineBreaks",
  chapterLineBreaks: "chapterLineBreaks",
  showNumbers: "chapterVerseNumbers",
  chapterHeadings: "chapterHeadings",
};

const VERSION_PRESETS = {
  jps: DEFAULTS.translationVersion,
  sefariaDefault: "",
};

function presetForValue(value) {
  if (value === VERSION_PRESETS.jps) return "jps";
  if (value === VERSION_PRESETS.sefariaDefault) return "sefariaDefault";
  return "custom";
}

export default function SettingsMenu({ settings, onChange, onClose, onResetAll }) {
  const siteLang = settings.siteLang;
  const panelRef = useRef(null);
  const [customVersion, setCustomVersion] = useState(
    presetForValue(settings.translationVersion) === "custom" ? settings.translationVersion : ""
  );

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  function patchBody(patch) {
    onChange({ body: { ...settings.body, ...patch } });
  }

  function patchTanakh(patch) {
    patchBody({ tanakh: { ...settings.body.tanakh, ...patch } });
  }

  function patchOther(patch) {
    patchBody({ other: { ...settings.body.other, ...patch } });
  }

  function handleTanakhPreset(preset) {
    if (preset === "custom") return;
    patchBody({ tanakh: { ...TANAKH_PRESETS[preset] } });
  }

  function handleOtherPreset(preset) {
    if (preset === "custom") return;
    patchBody({ other: { ...OTHER_PRESETS[preset] } });
  }

  function handleVersionPreset(preset) {
    if (preset === "jps") onChange({ translationVersion: VERSION_PRESETS.jps });
    else if (preset === "sefariaDefault") onChange({ translationVersion: VERSION_PRESETS.sefariaDefault });
    else onChange({ translationVersion: customVersion });
  }

  function handleResetAll() {
    if (window.confirm(t("resetAllConfirm", siteLang))) {
      onResetAll();
    }
  }

  const selectedPreset = presetForValue(settings.translationVersion);
  const tanakhPreset = presetForToggles(TANAKH_PRESETS, settings.body.tanakh) || "custom";
  const otherPreset = presetForToggles(OTHER_PRESETS, settings.body.other) || "custom";

  return (
    <div className="settings-menu-overlay">
      <div className="settings-menu" ref={panelRef} role="dialog" aria-label={t("settings", siteLang)}>
        <button
          type="button"
          className="settings-menu-close"
          onClick={onClose}
          aria-label={t("settingsClose", siteLang)}
        >
          ✕
        </button>

        <section className="settings-section">
          <h3>{t("bodySection", siteLang)}</h3>
          <label>
            {t("language", siteLang)}
            <select
              value={settings.body.language}
              onChange={(e) => patchBody({ language: e.target.value })}
            >
              <option value="both">{t("languageBoth", siteLang)}</option>
              <option value="he">{t("languageHebrew", siteLang)}</option>
              <option value="en">{t("languageEnglish", siteLang)}</option>
            </select>
          </label>
          {settings.body.language === "both" ? (
            <label>
              {t("alignment", siteLang)}
              <select
                value={settings.body.alignment}
                onChange={(e) => patchBody({ alignment: e.target.value })}
              >
                <option value="sides">{t("alignmentSides", siteLang)}</option>
                <option value="center">{t("alignmentCenter", siteLang)}</option>
              </select>
            </label>
          ) : null}
          <label>
            {t("fontStyle", siteLang)}
            <select
              value={settings.fontStyle}
              onChange={(e) => onChange({ fontStyle: e.target.value })}
            >
              <option value="formal">{t("fontStyleFormal", siteLang)}</option>
              <option value="casual">{t("fontStyleCasual", siteLang)}</option>
              <option value="accessible">{t("fontStyleAccessible", siteLang)}</option>
            </select>
          </label>
        </section>

        <section className="settings-section">
          <h3>{t("tanachSection", siteLang)}</h3>
          <label>
            <select value={tanakhPreset} onChange={(e) => handleTanakhPreset(e.target.value)}>
              <option value="klaf">{t("presetKlaf", siteLang)}</option>
              <option value="sefer">{t("presetSefer", siteLang)}</option>
              <option value="simple">{t("presetSimple", siteLang)}</option>
              <option value="custom">{t("presetCustom", siteLang)}</option>
            </select>
          </label>
          {TOGGLE_FIELDS.map((field) => (
            <label className="settings-checkbox" key={field}>
              <input
                type="checkbox"
                checked={settings.body.tanakh[field]}
                onChange={(e) => patchTanakh({ [field]: e.target.checked })}
              />
              {t(TOGGLE_LABEL_KEYS[field], siteLang)}
            </label>
          ))}
        </section>

        <section className="settings-section">
          <h3>{t("otherSection", siteLang)}</h3>
          <label>
            <select value={otherPreset} onChange={(e) => handleOtherPreset(e.target.value)}>
              <option value="sefer">{t("presetSefer", siteLang)}</option>
              <option value="simple">{t("presetSimple", siteLang)}</option>
              <option value="custom">{t("presetCustom", siteLang)}</option>
            </select>
          </label>
          {TOGGLE_FIELDS.map((field) => (
            <label className="settings-checkbox" key={field}>
              <input
                type="checkbox"
                checked={settings.body.other[field]}
                onChange={(e) => patchOther({ [field]: e.target.checked })}
              />
              {t(TOGGLE_LABEL_KEYS[field], siteLang)}
            </label>
          ))}
        </section>

        <section className="settings-section">
          <label>
            {t("translationVersion", siteLang)}
            <select value={selectedPreset} onChange={(e) => handleVersionPreset(e.target.value)}>
              <option value="jps">{t("versionJps", siteLang)}</option>
              <option value="sefariaDefault">{t("versionSefariaDefault", siteLang)}</option>
              <option value="custom">{t("versionCustom", siteLang)}</option>
            </select>
          </label>
          {selectedPreset === "custom" ? (
            <input
              type="text"
              className="settings-custom-version"
              value={customVersion}
              placeholder={t("versionCustomPlaceholder", siteLang)}
              onChange={(e) => {
                setCustomVersion(e.target.value);
                onChange({ translationVersion: e.target.value });
              }}
            />
          ) : null}

          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.showAttribution}
              onChange={(e) => onChange({ showAttribution: e.target.checked })}
            />
            {t("showAttribution", siteLang)}
          </label>

        </section>

        <section className="settings-section">
          <h3>{t("sourceTitleSection", siteLang)}</h3>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.titleNikkud}
              onChange={(e) => onChange({ titleNikkud: e.target.checked })}
            />
            {t("titleNikkud", siteLang)}
          </label>

          <button type="button" className="settings-reset-all" onClick={handleResetAll}>
            {t("resetAll", siteLang)}
          </button>
        </section>
      </div>
    </div>
  );
}
