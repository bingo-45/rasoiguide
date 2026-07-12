import { useMemo, useState } from "react";
import { RecipeListCard } from "../components";
import { recipes } from "../data/recipes";
import { msg } from "../messages";
import type { Language } from "../model";

const suggestions = ["aloo", "tamatar", "dal", "chawal", "gobhi", "jeera", "besan", "lauki"];

export function PantryScreen({ language, onOpen }: { language: Language; onOpen: (id: string) => void }) {
  const [value, setValue] = useState("");
  const [items, setItems] = useState<string[]>(["dal", "tamatar", "jeera"]);
  const add = (item = value) => {
    const clean = item.trim().toLowerCase();
    if (clean && !items.includes(clean)) setItems((current) => [...current, clean]);
    setValue("");
  };
  const ranked = useMemo(() => recipes.map((recipe) => {
    const ingredientNames = recipe.ingredients.flatMap((ingredient) => [ingredient.name.en, ingredient.name.hi, ingredient.name["hi-Latn"]]).join(" ").toLowerCase();
    const matched = items.filter((item) => ingredientNames.includes(item));
    return { recipe, missing: Math.max(0, recipe.ingredients.length - matched.length), matched: matched.length };
  }).sort((a, b) => b.matched - a.matched || a.missing - b.missing), [items]);

  return (
    <main className="page pantry-page" id="main-content">
      <section className="pantry-intro">
        <p className="eyebrow">Ingredient-first · fully offline</p>
        <h1>{msg(language, "pantryTitle")}</h1>
        <p>{msg(language, "pantryNote")}</p>
      </section>
      <section className="pantry-builder">
        <div className="pantry-input-row">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            placeholder="lauki, besan, tamatar…"
            aria-label={msg(language, "addIngredient")}
          />
          <button onClick={() => add()} disabled={!value.trim()}>{msg(language, "addIngredient")}</button>
        </div>
        <div className="pantry-chips">
          {items.map((item) => <button key={item} onClick={() => setItems((current) => current.filter((value) => value !== item))}>{item} <span>×</span></button>)}
        </div>
        <div className="suggestion-row">
          <small>Quick add</small>
          {suggestions.filter((item) => !items.includes(item)).slice(0, 5).map((item) => <button key={item} onClick={() => add(item)}>+ {item}</button>)}
        </div>
      </section>
      <section className="pantry-results">
        <div className="section-heading section-heading--compact"><h2>Closest matches</h2><span>{ranked.length}</span></div>
        {ranked.map(({ recipe, missing, matched }) => (
          <div className="pantry-result" key={recipe.id}>
            <div className="match-bar"><span style={{ width: `${Math.max(8, (matched / recipe.ingredients.length) * 100)}%` }} /></div>
            <div className="match-label">{missing === 0 ? msg(language, "canMake") : msg(language, "missingCount", { count: missing })}</div>
            <RecipeListCard recipe={recipe} language={language} onOpen={() => onOpen(recipe.id)} />
            {missing > 0 && <p className="substitution-hint">Missing items are checked against authored swaps before cooking starts.</p>}
          </div>
        ))}
      </section>
    </main>
  );
}
