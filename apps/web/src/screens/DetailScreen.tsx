import { useState } from "react";
import { JaliBand, RecipeVisual } from "../components";
import { msg } from "../messages";
import { localText, type RecipeCard, type Preferences } from "../model";
import { householdMeasure } from "../utils";

export function DetailScreen({
  recipe,
  preferences,
  onBack,
  onStart,
  onAddThali
}: {
  recipe: RecipeCard;
  preferences: Preferences;
  onBack: () => void;
  onStart: () => void;
  onAddThali: () => void;
}) {
  const [servings, setServings] = useState(recipe.servingsBase);
  const language = preferences.language;
  return (
    <main className="detail-page" id="main-content">
      <div className="detail-hero">
        <RecipeVisual recipe={recipe} />
        <button className="floating-back glass-region" onClick={onBack} aria-label={msg(language, "back")}>←</button>
        <span className="detail-offline glass-region"><i /> {msg(language, "readyOffline")}</span>
      </div>
      <JaliBand />
      <div className="detail-content">
        <p className="eyebrow">{localText(recipe.region, language)} · {msg(language, "minutes", { count: recipe.timeMin })}</p>
        <h1 lang={language === "hi" ? "hi" : "en"}>{localText(recipe.title, language)}</h1>
        <p className="headnote">{localText(recipe.headnote, language)}</p>

        <section className="serving-panel">
          <div>
            <small>{msg(language, "servings")}</small>
            <strong>{msg(language, "forPeople", { count: servings })}</strong>
          </div>
          <div className="serving-control" role="group" aria-label={msg(language, "servings")}>
            <button onClick={() => setServings((value) => Math.max(1, value - 1))} aria-label="Fewer servings">−</button>
            <span>{servings}</span>
            <button onClick={() => setServings((value) => Math.min(12, value + 1))} aria-label="More servings">+</button>
          </div>
        </section>

        <section className="before-panel">
          <div className="section-heading section-heading--compact">
            <h2>{msg(language, "beforeBegin")}</h2>
            <span className="difficulty-label">{localText(recipe.difficulty, language)}</span>
          </div>
          <div className="before-grid">
            <div><span className="before-symbol before-symbol--time" /><small>Time</small><strong>{recipe.timeMin} min</strong></div>
            <div><span className="before-symbol before-symbol--stove" /><small>Stove</small><strong>{preferences.stove}</strong></div>
            <div><span className="before-symbol before-symbol--pot" /><small>{msg(language, "cookware")}</small><strong>{localText(recipe.cookware, language)}</strong></div>
          </div>
          <div className="offline-readiness">
            <span className="readiness-check">✓</span>
            <span><strong>{msg(language, "readyOffline")}</strong><small>{msg(language, "voiceOnline")}</small></span>
          </div>
        </section>

        <section className="ingredients-section">
          <div className="section-heading section-heading--compact">
            <h2>Ingredients</h2>
            <span>{recipe.ingredients.length} items</span>
          </div>
          <div className="ingredient-preview-list">
            {recipe.ingredients.map((ingredient) => {
              const measure = householdMeasure(ingredient, servings, recipe.servingsBase, preferences.katoriMl);
              return (
                <div className="ingredient-preview" key={ingredient.id}>
                  <span className="ingredient-dot" />
                  <span><strong>{localText(ingredient.name, language)}</strong><small>{localText(ingredient.prep, language)}</small></span>
                  <span className="ingredient-qty"><strong>{measure.andaaz}</strong><small>{measure.canonical}</small></span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <div className="detail-actions glass-region">
        <button className="secondary-cta" onClick={onAddThali}>{msg(language, "addThali")}</button>
        <button className="primary-cta" onClick={onStart}>{msg(language, "startCooking")} <span>→</span></button>
      </div>
    </main>
  );
}
