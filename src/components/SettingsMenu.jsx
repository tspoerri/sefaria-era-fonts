import { useEffect, useRef, useState } from "react";
import { t } from "../lib/strings.js";
import { DEFAULTS } from "../lib/settings.js";

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

  function patchTitleBar(patch) {
    onChange({ titleBar: { ...settings.titleBar, ...patch } });
  }

  function patchBody(patch) {
    onChange({ body: { ...settings.body, ...patch } });
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
          <h3>{t("titleBarSection", siteLang)}</h3>
          <label>
            {t("language", siteLang)}
            <select
              value={settings.titleBar.language}
              onChange={(e) => patchTitleBar({ language: e.target.value })}
            >
              <option value="both">{t("languageBoth", siteLang)}</option>
              <option value="he">{t("languageHebrew", siteLang)}</option>
              <option value="en">{t("languageEnglish", siteLang)}</option>
            </select>
          </label>
          {settings.titleBar.language === "both" ? (
            <label>
              {t("alignment", siteLang)}
              <select
                value={settings.titleBar.alignment}
                onChange={(e) => patchTitleBar({ alignment: e.target.value })}
              >
                <option value="sides">{t("alignmentSides", siteLang)}</option>
                <option value="center">{t("alignmentCenter", siteLang)}</option>
              </select>
            </label>
          ) : null}
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.titleBar.nikkud}
              onChange={(e) => patchTitleBar({ nikkud: e.target.checked })}
            />
            {t("nikkud", siteLang)}
          </label>
        </section>

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
          <label>
            {t("tanakhMode", siteLang)}
            <select
              value={settings.body.modeTanakh}
              onChange={(e) => patchBody({ modeTanakh: e.target.value })}
            >
              <option value="klaf">{t("modeKlaf", siteLang)}</option>
              <option value="sefer">{t("modeSefer", siteLang)}</option>
              <option value="simple">{t("modeSimple", siteLang)}</option>
              <option value="bare">{t("modeBare", siteLang)}</option>
            </select>
          </label>
          <label>
            {t("otherMode", siteLang)}
            <select
              value={settings.body.modeOther}
              onChange={(e) => patchBody({ modeOther: e.target.value })}
            >
              <option value="sefer">{t("modeSefer", siteLang)}</option>
              <option value="bare">{t("modeBare", siteLang)}</option>
            </select>
          </label>
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

          <button type="button" className="settings-reset-all" onClick={handleResetAll}>
            {t("resetAll", siteLang)}
          </button>
        </section>
      </div>
    </div>
  );
}
