import { useMemo, useState } from "react";
import { BrandMark, RecipeListCard, RecipeVisual } from "../components";
import { recipes } from "../data/recipes";
import { msg } from "../messages";
import { localText, type CookSession, type Language } from "../model";

export function LibraryScreen({
  language,
  session,
  onResume,
  onOpen,
  onThali,
  onNani
}: {
  language: Language;
  session?: CookSession;
  onResume: () => void;
  onOpen: (id: string) => void;
  onThali: () => void;
  onNani: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const filtered = useMemo(() => recipes.filter((recipe) => {
    const haystack = `${recipe.title.en} ${recipe.title.hi} ${recipe.title["hi-Latn"]} ${recipe.tags.join(" ")} ${recipe.ingredients.map((item) => `${item.name.en} ${item.name.hi} ${item.name["hi-Latn"]}`).join(" ")}`.toLowerCase();
    const tagMatch = filter === "all" || recipe.tags.includes(filter);
    return tagMatch && haystack.includes(query.trim().toLowerCase());
  }), [filter, query]);
  const featured = recipes[0]!;
  const resumeRecipe = session && !session.completed ? recipes.find((recipe) => recipe.id === session.recipeId) : undefined;

  return (
    <main className="page library-page" id="main-content">
      <section className="library-intro">
        <div className="intro-copy">
          <p className="eyebrow">Offline-first · हिंदी + Hinglish</p>
          <h1>{msg(language, "greeting")}</h1>
          <p>{msg(language, "greetingNote")}</p>
        </div>
        <div className="intro-mark" aria-hidden="true"><BrandMark /></div>
      </section>

      {resumeRecipe && session && (
        <button className="resume-banner" onClick={onResume}>
          <span className="resume-progress" style={{ "--resume": `${((session.stepIndex + 1) / resumeRecipe.steps.length) * 100}%` } as React.CSSProperties} />
          <span>
            <small>{msg(language, "resume")}</small>
            <strong>{msg(language, "resumeAt", { dish: localText(resumeRecipe.title, language), step: session.stepIndex + 1 })}</strong>
          </span>
          <span className="resume-arrow" aria-hidden="true">→</span>
        </button>
      )}

      <section className="search-panel" aria-label="Recipe search">
        <label className="search-field">
          <span className="search-mark" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={msg(language, "searchPlaceholder")} />
        </label>
        <button className="voice-search-button" onClick={() => setQuery("lauki besan")}>
          <span className="ptt-mark" aria-hidden="true"><i /></span>
          {msg(language, "voiceSearch")}
        </button>
      </section>

      <section className="featured-recipe">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tonight’s steady choice</p>
            <h2>{msg(language, "everyday")}</h2>
          </div>
          <span className="offline-seal"><i /> {msg(language, "readyOffline")}</span>
        </div>
        <button className="editorial-card" onClick={() => onOpen(featured.id)}>
          <RecipeVisual recipe={featured} preferThumb />
          <span className="editorial-card__copy">
            <span className="editorial-kicker">{localText(featured.region, language)} · {msg(language, "minutes", { count: featured.timeMin })}</span>
            <strong>{localText(featured.title, language)}</strong>
            <span>{localText(featured.headnote, language)}</span>
            <span className="editorial-action">See recipe <b aria-hidden="true">→</b></span>
          </span>
        </button>
      </section>

      <section className="recipe-library">
        <div className="filter-heading">
          <h2>{msg(language, "library")}</h2>
          <span>{filtered.length}</span>
        </div>
        <div className="filter-row" role="group" aria-label={msg(language, "filters")}>
          {["all", "satvik", "vrat", "festival", "non-veg"].map((tag) => (
            <button key={tag} className={filter === tag ? "is-active" : ""} onClick={() => setFilter(tag)}>
              {msg(language, (tag === "non-veg" ? "nonveg" : tag) as "all" | "satvik" | "vrat" | "festival" | "nonveg")}
            </button>
          ))}
        </div>
        <div className="recipe-list">
          {(showAll || query || filter !== "all" ? filtered : filtered.slice(0, 9)).map((recipe) => <RecipeListCard key={recipe.id} recipe={recipe} language={language} onOpen={() => onOpen(recipe.id)} />)}
          {!showAll && !query && filter === "all" && filtered.length > 9 && (
            <button className="show-all-card" onClick={() => setShowAll(true)}>
              <strong>+{filtered.length - 9}</strong>
              <span>{language === "en" ? "See every dish" : language === "hi" ? "सारी डिशें देखें" : "Saari dishes dekho"}</span>
            </button>
          )}
          {!filtered.length && (
            <div className="empty-state">
              <span className="empty-katori" aria-hidden="true" />
              <h3>No exact match yet</h3>
              <p>Try one ingredient at a time, or open Pantry for closest matches.</p>
            </div>
          )}
        </div>
      </section>

      <section className="two-up-actions">
        <button className="thali-callout" onClick={onThali}>
          <span className="thali-plates" aria-hidden="true"><i /><i /><i /></span>
          <span><small>Cook together</small><strong>{msg(language, "thaliTitle")}</strong></span>
          <b aria-hidden="true">→</b>
        </button>
        <button className="nani-callout" onClick={onNani}>
          <span className="sound-rings" aria-hidden="true"><i /><i /><i /></span>
          <span><small>Coming next</small><strong>{msg(language, "naniTitle")}</strong></span>
          <b aria-hidden="true">→</b>
        </button>
      </section>
    </main>
  );
}
