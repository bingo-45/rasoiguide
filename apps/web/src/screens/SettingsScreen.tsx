import { useState } from "react";
import { photoCredits } from "../data/photoCredits";
import { msg } from "../messages";
import type { Language, Preferences, StoveType } from "../model";

function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (value: boolean) => void; label: string; note?: string }) {
  return (
    <label className="setting-toggle">
      <span><strong>{label}</strong>{note && <small>{note}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><b /></i>
    </label>
  );
}

export function SettingsScreen({ preferences, update }: { preferences: Preferences; update: (patch: Partial<Preferences>) => void }) {
  const language = preferences.language;
  const [creditsOpen, setCreditsOpen] = useState(false);
  return (
    <main className="page settings-page" id="main-content">
      <section className="settings-intro">
        <p className="eyebrow">Your kitchen · this device only</p>
        <h1>{msg(language, "settings")}</h1>
        <p>{msg(language, "privacyLocal")}</p>
      </section>

      <section className="settings-group">
        <h2>{msg(language, "language")}</h2>
        <div className="segmented-control segmented-control--three" role="group" aria-label={msg(language, "language")}>
          {(["en", "hi", "hi-Latn"] as Language[]).map((item) => (
            <button key={item} className={language === item ? "is-active" : ""} onClick={() => update({ language: item })}>
              {item === "en" ? "English" : item === "hi" ? "हिन्दी" : "Hinglish"}
            </button>
          ))}
        </div>
        <Toggle checked={preferences.devanagariNumerals} onChange={(value) => update({ devanagariNumerals: value })} label="हिन्दी numerals · १२३" note="Used in timers, steps and whistle counts" />
      </section>

      <section className="settings-group">
        <h2>{msg(language, "stove")}</h2>
        <div className="stove-options">
          {(["gas", "induction", "coil"] as StoveType[]).map((stove) => (
            <button key={stove} className={preferences.stove === stove ? "is-active" : ""} onClick={() => update({ stove })}>
              <span className={`stove-illustration stove-illustration--${stove}`} aria-hidden="true"><i /><b /></span>
              <span><strong>{stove[0]!.toUpperCase() + stove.slice(1)}</strong><small>{stove === "gas" ? "flame levels" : stove === "induction" ? "watt guidance" : "heat-lag notes"}</small></span>
              <i className="setting-radio">{preferences.stove === stove ? "✓" : ""}</i>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group katori-setting">
        <div className="section-heading section-heading--compact"><div><h2>{msg(language, "katori")}</h2><p>Household-measure calibration</p></div><strong>{preferences.katoriMl} ml</strong></div>
        <input type="range" min="120" max="300" step="10" value={preferences.katoriMl} onChange={(event) => update({ katoriMl: Number(event.target.value) })} />
        <div className="katori-scale"><span>Small · 120</span><span>Steel bowl · 180</span><span>Large · 300</span></div>
      </section>

      <section className="settings-group">
        <h2>{msg(language, "voicePrivacy")}</h2>
        <div className="privacy-callout"><span className="privacy-lock" aria-hidden="true"><i /></span><p>{msg(language, "webSpeechNote")}</p></div>
        <Toggle checked={preferences.onDeviceVoice} onChange={(value) => update({ onDeviceVoice: value })} label={msg(language, "onDevice")} note={msg(language, "onDeviceNote")} />
        {preferences.onDeviceVoice && (
          <div className="voice-pack-card">
            <div><small>Hindi low-end voice pack</small><strong>Vosk small · 42 MB</strong></div>
            <button>Download when on Wi-Fi</button>
          </div>
        )}
        <Toggle checked={preferences.lowBatteryMode} onChange={(value) => update({ lowBatteryMode: value })} label={msg(language, "lowBattery")} note="Stops continuous listening; every action stays reachable by touch." />
        <Toggle checked={preferences.sounds} onChange={(value) => update({ sounds: value })} label={msg(language, "sounds")} note="Timer alerts and warm spoken prompts" />
      </section>

      <section className="settings-group">
        <h2>{msg(language, "photoCredits")}</h2>
        <p className="credits-note">{msg(language, "photoCreditsNote")}</p>
        <button className="secondary-cta credits-toggle" onClick={() => setCreditsOpen((open) => !open)}>
          {creditsOpen ? "▲" : "▼"} {msg(language, "photoCredits")} · {photoCredits.length}
        </button>
        {creditsOpen && (
          <ul className="credits-list">
            {photoCredits.map((credit) => (
              <li key={credit.id}>
                <a href={credit.source} target="_blank" rel="noreferrer noopener">{credit.id}</a>
                <span>{credit.author} · {credit.license}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-group privacy-sheet-inline">
        <h2>Privacy sheet</h2>
        <dl>
          <div><dt>Account</dt><dd>None</dd></div>
          <div><dt>Analytics</dt><dd>Off</dd></div>
          <div><dt>Camera uploads</dt><dd>Never</dd></div>
          <div><dt>Cook history</dt><dd>IndexedDB on this device</dd></div>
        </dl>
      </section>
    </main>
  );
}
