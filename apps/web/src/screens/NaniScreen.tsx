import { msg } from "../messages";
import type { Language } from "../model";

export function NaniScreen({ language, onBack }: { language: Language; onBack: () => void }) {
  return (
    <main className="nani-page" id="main-content">
      <header className="focus-header glass-region">
        <button onClick={onBack} aria-label={msg(language, "back")}>←</button>
        <span><small>Private family archive</small><strong>{msg(language, "naniTitle")}</strong></span>
        <span className="preview-badge">Preview</span>
      </header>
      <div className="jali-band" aria-hidden="true" />
      <section className="nani-content">
        <div className="nani-soundscape" aria-hidden="true">
          <span className="nani-roundel">न</span>
          <div className="nani-wave">{Array.from({ length: 22 }).map((_, index) => <i key={index} style={{ height: `${20 + ((index * 17) % 55)}%` }} />)}</div>
        </div>
        <p className="eyebrow">A recipe in their own voice</p>
        <h1>{msg(language, "naniTitle")}</h1>
        <p>{msg(language, "naniNote")}</p>
        <div className="nani-steps">
          <div><span>1</span><p><strong>Record together</strong><small>Long pauses and kitchen sounds are okay.</small></p></div>
          <div><span>2</span><p><strong>Shape a private draft</strong><small>Ingredients, steps and andaaz stay editable.</small></p></div>
          <div><span>3</span><p><strong>Family reviews every word</strong><small>Nothing is auto-published or machine-translated.</small></p></div>
        </div>
        <div className="scaffold-note"><span>Built, not active</span><p>{msg(language, "scaffold")}</p></div>
        <button className="secondary-cta" onClick={onBack}>{msg(language, "goHome")}</button>
      </section>
    </main>
  );
}
