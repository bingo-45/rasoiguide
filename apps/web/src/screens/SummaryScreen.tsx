import { useState } from "react";
import { RecipeVisual } from "../components";
import { msg } from "../messages";
import { localText, type CookSession, type Language, type RecipeCard } from "../model";
import { formatTime } from "../utils";

export function SummaryScreen({
  recipe,
  session,
  language,
  onSaveNote,
  onCookAgain,
  onHome
}: {
  recipe: RecipeCard;
  session: CookSession;
  language: Language;
  onSaveNote: (note: string) => void;
  onCookAgain: () => void;
  onHome: () => void;
}) {
  const [note, setNote] = useState(session.note ?? "");
  const elapsed = Math.round((session.updatedAt - session.startedAt) / 1000);
  const recoveryNames = recipe.steps.flatMap((step) => step.recovery).filter((recovery) => session.recoveries.includes(recovery.id));
  return (
    <main className="summary-page" id="main-content">
      <div className="summary-hero">
        <RecipeVisual recipe={recipe} />
        <span className="completion-seal"><i>✓</i><small>Cooked offline</small></span>
      </div>
      <section className="summary-content">
        <p className="eyebrow">{localText(recipe.title, language)} · saved locally</p>
        <h1>{msg(language, "summaryTitle")}</h1>
        <p>{msg(language, "summaryNote")}</p>
        <div className="summary-stats">
          <div><small>Total time</small><strong>{formatTime(elapsed)}</strong></div>
          <div><small>Steps</small><strong>{recipe.steps.length}</strong></div>
          <div><small>Whistles</small><strong>{session.whistleCount}</strong></div>
        </div>

        <section className="summary-card">
          <div className="section-heading section-heading--compact"><h2>{msg(language, "recoveriesUsed")}</h2><span>{recoveryNames.length}</span></div>
          {recoveryNames.length ? recoveryNames.map((recovery) => (
            <div className="summary-recovery" key={recovery.id}><span>✓</span><p><strong>{localText(recovery.failure, language)}</strong><small>{localText(recovery.fix, language)}</small></p></div>
          )) : <p className="quiet-success">No fixes needed this time. The quiet kind of win.</p>}
        </section>

        {Object.keys(session.substitutions).length > 0 && (
          <section className="summary-card"><h2>Swaps used</h2>{Object.entries(session.substitutions).map(([id, value]) => <p key={id}>{value}</p>)}</section>
        )}

        <section className="note-card">
          <label htmlFor="next-time-note">{msg(language, "nextTime")}</label>
          <textarea id="next-time-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mirchi thodi kam, tadka same…" />
          <button onClick={() => onSaveNote(note)}>{msg(language, "saveNote")}</button>
        </section>
      </section>
      <div className="summary-actions glass-region">
        <button className="secondary-cta" onClick={onHome}>{msg(language, "goHome")}</button>
        <button className="primary-cta" onClick={onCookAgain}>{msg(language, "cookAgain")} →</button>
      </div>
    </main>
  );
}
