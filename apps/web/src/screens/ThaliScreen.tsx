import { useMemo, useState } from "react";
import { scheduleThali, type ThaliRecipe } from "@rasoiguide/scheduler";
import { RecipeVisual } from "../components";
import { recipes } from "../data/recipes";
import { msg } from "../messages";
import { localText, type Language } from "../model";
import { formatTime } from "../utils";

interface TimelineItem {
  recipeId: string;
  step: number;
  label: string;
  start: number;
  duration: number;
  attention: "active" | "passive";
}

function buildPreviewTimeline(ids: string[]): TimelineItem[] {
  const selected = ids.map((id) => recipes.find((item) => item.id === id)).filter(Boolean) as typeof recipes;
  if (!selected.length) return [];
  const inputs: ThaliRecipe[] = selected.map((recipe) => ({
    id: recipe.id,
    label: recipe.title.en,
    steps: recipe.steps.map((step, index) => ({
      id: step.id,
      label: step.text.en,
      durationSec: step.durationSec ?? 90,
      attention: step.attention,
      dependsOn: index === 0 ? [] : [recipe.steps[index - 1]!.id]
    }))
  }));
  const plan = scheduleThali(inputs, 3 * 60 * 60);
  const earliest = Math.min(...plan.steps.map((step) => step.startSec));
  return plan.steps.map((scheduled) => {
    const recipe = selected.find((item) => item.id === scheduled.dishId)!;
    const index = recipe.steps.findIndex((step) => step.id === scheduled.stepId);
    return {
      recipeId: scheduled.dishId,
      step: index + 1,
      label: scheduled.label ?? recipe.steps[index]!.text.en,
      start: scheduled.startSec - earliest,
      duration: scheduled.durationSec,
      attention: scheduled.attention
    };
  }).sort((a, b) => a.start - b.start);
}

export function ThaliScreen({
  language,
  selectedIds,
  onSelection,
  onBack,
  onOpenRecipe
}: {
  language: Language;
  selectedIds: string[];
  onSelection: (ids: string[]) => void;
  onBack: () => void;
  onOpenRecipe: (id: string) => void;
}) {
  const [planned, setPlanned] = useState(true);
  const [focusId, setFocusId] = useState(selectedIds[0] ?? "dal-tadka");
  const timeline = useMemo(() => buildPreviewTimeline(selectedIds), [selectedIds]);
  const selected = selectedIds.map((id) => recipes.find((recipe) => recipe.id === id)).filter(Boolean) as typeof recipes;
  const maxEnd = Math.max(...timeline.map((item) => item.start + item.duration), 1);
  const now = Math.min(maxEnd * 0.28, 480);

  const toggle = (id: string) => {
    const exists = selectedIds.includes(id);
    const next = exists ? selectedIds.filter((item) => item !== id) : selectedIds.length < 3 ? [...selectedIds, id] : selectedIds;
    onSelection(next);
    if (!next.includes(focusId)) setFocusId(next[0] ?? "dal-tadka");
    setPlanned(false);
  };

  return (
    <main className="thali-page" id="main-content">
      <header className="focus-header glass-region">
        <button onClick={onBack} aria-label={msg(language, "back")}>←</button>
        <span><small>Cook up to three dishes</small><strong>{msg(language, "thaliTitle")}</strong></span>
        <span className="thali-count">{selectedIds.length}/3</span>
      </header>
      <div className="jali-band" aria-hidden="true" />

      <section className="thali-intro">
        <p className="eyebrow">One cook · one finish time</p>
        <h1>{msg(language, "thaliTitle")}</h1>
        <p>{msg(language, "thaliNote")}</p>
      </section>

      <section className="thali-picker" aria-label="Choose dishes">
        {recipes.map((recipe) => {
          const active = selectedIds.includes(recipe.id);
          return (
            <button key={recipe.id} className={active ? "is-selected" : ""} onClick={() => toggle(recipe.id)} aria-pressed={active}>
              <RecipeVisual recipe={recipe} compact />
              <span><strong>{localText(recipe.title, language)}</strong><small>{recipe.timeMin} min</small></span>
              <i>{active ? "✓" : "+"}</i>
            </button>
          );
        })}
      </section>
      {!planned && <button className="plan-button primary-cta" disabled={selectedIds.length < 2} onClick={() => setPlanned(true)}>Build my shared timeline →</button>}

      {planned && selected.length >= 2 && (
        <>
          <section className="master-timeline">
            <div className="section-heading section-heading--compact">
              <div><p className="eyebrow">Dinner together</p><h2>Master timeline</h2></div>
              <span>{formatTime(maxEnd)} total</span>
            </div>
            <div className="timeline-ruler">
              <span>Now</span><span>10m</span><span>20m</span><span>Ready</span>
            </div>
            <div className="timeline-canvas">
              <span className="timeline-now" style={{ left: `${(now / maxEnd) * 100}%` }}><i />Now</span>
              {selected.map((recipe) => (
                <div className="timeline-lane" key={recipe.id}>
                  <strong>{localText(recipe.title, language)}</strong>
                  <div>
                    {timeline.filter((item) => item.recipeId === recipe.id).map((item) => (
                      <span
                        key={`${item.recipeId}-${item.step}`}
                        className={`timeline-block timeline-block--${item.attention}`}
                        style={{ left: `${(item.start / maxEnd) * 100}%`, width: `${Math.max(3, (item.duration / maxEnd) * 100)}%` }}
                        title={`Step ${item.step}: ${item.label}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="timeline-legend"><span><i className="active" />Hands-on</span><span><i className="passive" />Cooking quietly</span></div>
          </section>

          <section className="dish-lanes">
            {selected.map((recipe, index) => {
              const focused = focusId === recipe.id;
              const nextEvent = timeline.find((event) => event.recipeId === recipe.id && event.start + event.duration > now) ?? timeline.find((event) => event.recipeId === recipe.id);
              return (
                <article className={`dish-lane-card${focused ? " is-focused" : ""}`} key={recipe.id}>
                  <button className="dish-lane-main" onClick={() => setFocusId(recipe.id)}>
                    <span className="dish-order">{index + 1}</span>
                    <span className="dish-lane-copy">
                      <small>{focused ? msg(language, "activeNow") : nextEvent?.attention === "passive" ? msg(language, "simmering") : msg(language, "comingNext")}</small>
                      <strong>{localText(recipe.title, language)}</strong>
                      <span>{nextEvent ? localText(recipe.steps[nextEvent.step - 1]!.text, language) : "Ready to serve"}</span>
                    </span>
                    <span className="dish-time">{nextEvent ? formatTime(nextEvent.duration) : "✓"}</span>
                  </button>
                  {focused && (
                    <div className="focused-dish-actions">
                      <button onClick={() => onOpenRecipe(recipe.id)}>Open recipe</button>
                      <button onClick={() => {
                        const next = selected[(index + 1) % selected.length];
                        if (next) setFocusId(next.id);
                      }}>{msg(language, "switchDish")} →</button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <div className="thali-voice glass-region">
            <span className="listening-dot" />
            <span><small>Namespaced voice</small><strong>{localText(recipes.find((recipe) => recipe.id === focusId)!.title, language)}: “Aanch dheemi karo”</strong></span>
          </div>
        </>
      )}
    </main>
  );
}
