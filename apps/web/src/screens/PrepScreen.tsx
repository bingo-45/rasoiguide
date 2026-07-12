import { useState } from "react";
import { Sheet } from "../components";
import { msg } from "../messages";
import { localText, type CookSession, type Ingredient, type Preferences, type RecipeCard } from "../model";
import { householdMeasure } from "../utils";

export function PrepScreen({
  recipe,
  session,
  preferences,
  onBack,
  onToggle,
  onSubstitute,
  onBegin
}: {
  recipe: RecipeCard;
  session: CookSession;
  preferences: Preferences;
  onBack: () => void;
  onToggle: (id: string) => void;
  onSubstitute: (id: string, name: string) => void;
  onBegin: (skip?: boolean) => void;
}) {
  const [missing, setMissing] = useState<Ingredient>();
  const language = preferences.language;
  const remaining = recipe.ingredients.length - session.checkedIngredients.length;
  return (
    <main className="prep-page" id="main-content">
      <header className="focus-header glass-region">
        <button onClick={onBack} aria-label={msg(language, "back")}>←</button>
        <span><small>{localText(recipe.title, language)}</small><strong>{msg(language, "prepTitle")}</strong></span>
        <span className="prep-count">{session.checkedIngredients.length}/{recipe.ingredients.length}</span>
      </header>
      <div className="jali-band" aria-hidden="true" />
      <section className="prep-intro">
        <p className="eyebrow">Mise en place</p>
        <h1>{msg(language, "prepTitle")}</h1>
        <p>{msg(language, "prepNote")}</p>
        <div className="prep-progress" aria-label={`${session.checkedIngredients.length} of ${recipe.ingredients.length} ready`}>
          <span style={{ width: `${(session.checkedIngredients.length / recipe.ingredients.length) * 100}%` }} />
        </div>
      </section>
      <section className="prep-list" aria-label="Ingredient checklist">
        {recipe.ingredients.map((ingredient) => {
          const checked = session.checkedIngredients.includes(ingredient.id);
          const substitution = session.substitutions[ingredient.id];
          const measure = householdMeasure(ingredient, recipe.servingsBase, recipe.servingsBase, preferences.katoriMl);
          return (
            <article className={`prep-row${checked ? " is-ready" : ""}`} key={ingredient.id}>
              <button className="prep-check" onClick={() => onToggle(ingredient.id)} aria-pressed={checked}>
                <span className="check-box" aria-hidden="true">{checked ? "✓" : ""}</span>
                <span className="prep-item-copy">
                  <strong>{substitution ?? localText(ingredient.name, language)}</strong>
                  <small>{substitution ? `Instead of ${localText(ingredient.name, language)}` : localText(ingredient.prep, language)}</small>
                </span>
                <span className="prep-quantity"><strong>{measure.andaaz}</strong><small>{measure.canonical}</small></span>
              </button>
              {ingredient.substitutions?.length ? (
                <button className="missing-action" onClick={() => setMissing(ingredient)}>{msg(language, "missing")}</button>
              ) : null}
            </article>
          );
        })}
      </section>
      <div className="prep-footer glass-region">
        <span className={remaining === 0 ? "is-ready" : ""}>{remaining === 0 ? "Ready to light the stove" : msg(language, "remaining", { count: remaining })}</span>
        <button className="primary-cta" disabled={remaining > 0} onClick={() => onBegin(false)}>{msg(language, "begin")} <b>→</b></button>
        <button className="skip-action" onClick={() => onBegin(true)}>{msg(language, "skipPrep")}</button>
      </div>

      {missing && (
        <Sheet title={msg(language, "substituteTitle")} eyebrow={localText(missing.name, language)} onClose={() => setMissing(undefined)}>
          <div className="substitution-list">
            {missing.substitutions?.map((substitution) => (
              <button
                key={substitution.name.en}
                onClick={() => {
                  onSubstitute(missing.id, localText(substitution.name, language));
                  setMissing(undefined);
                }}
              >
                <span><strong>{localText(substitution.name, language)}</strong><small>{substitution.ratio}</small></span>
                <p>{localText(substitution.note, language)}</p>
                <b>{msg(language, "applySwap")} →</b>
              </button>
            ))}
          </div>
          <button className="sheet-cancel" onClick={() => setMissing(undefined)}>{msg(language, "cancel")}</button>
        </Sheet>
      )}
    </main>
  );
}
