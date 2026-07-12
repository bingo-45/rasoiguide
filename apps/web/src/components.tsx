import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { msg, type MessageKey } from "./messages";
import { localText, type Language, type RecipeCard, type View } from "./model";
import { displayNumber, formatTime } from "./utils";

interface TextContext {
  language: Language;
  numerals?: boolean;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark${compact ? " brand-mark--compact" : ""}`} aria-hidden="true">
      <span className="brand-mark__steam brand-mark__steam--one" />
      <span className="brand-mark__steam brand-mark__steam--two" />
      <span className="brand-mark__pot" />
    </span>
  );
}

export function AppHeader({
  language,
  online,
  canInstall,
  onInstall,
  onHome
}: {
  language: Language;
  online: boolean;
  canInstall: boolean;
  onInstall: () => void;
  onHome: () => void;
}) {
  return (
    <>
      <header className="app-header glass-region">
        <button className="brand-button" onClick={onHome} aria-label={msg(language, "library")}>
          <BrandMark compact />
          <span>
            <strong>{msg(language, "appName")}</strong>
            <small>{msg(language, "appTagline")}</small>
          </span>
        </button>
        <div className="header-actions">
          <span className={`network-state ${online ? "is-online" : "is-offline"}`}>
            <i aria-hidden="true" /> {msg(language, online ? "online" : "offline")}
          </span>
          {canInstall && (
            <button className="text-action" onClick={onInstall}>
              {msg(language, "install")}
            </button>
          )}
        </div>
      </header>
      <JaliBand />
    </>
  );
}

export function JaliBand() {
  return <div className="jali-band" aria-hidden="true" />;
}

export function BottomNav({ view, language, navigate }: { view: View; language: Language; navigate: (view: View) => void }) {
  const items: Array<{ view: View; key: MessageKey; mark: string }> = [
    { view: "library", key: "library", mark: "R" },
    { view: "pantry", key: "pantry", mark: "P" },
    { view: "settings", key: "settings", mark: "S" }
  ];
  return (
    <nav className="bottom-nav glass-region" aria-label="Primary">
      {items.map((item) => (
        <button
          key={item.view}
          className={view === item.view ? "is-active" : ""}
          onClick={() => navigate(item.view)}
          aria-current={view === item.view ? "page" : undefined}
        >
          <span className="nav-roundel" aria-hidden="true">{item.mark}</span>
          <span>{msg(language, item.key)}</span>
        </button>
      ))}
    </nav>
  );
}

export function RecipeVisual({ recipe, stage, compact = false, photo, caption, preferThumb = false }: { recipe: RecipeCard; stage?: string; compact?: boolean; photo?: string; caption?: string; preferThumb?: boolean }) {
  const photoId = photo ?? recipe.photo;
  const style = {
    "--food-light": recipe.palette[0],
    "--food-dark": recipe.palette[1]
  } as CSSProperties;
  if (photoId) {
    const fullSrc = `${import.meta.env.BASE_URL}photos/${photoId}.jpg`;
    const thumbSrc = `${import.meta.env.BASE_URL}photos/thumbs/${photoId}.jpg`;
    const useThumb = compact || preferThumb;
    return (
      <figure className={`recipe-photo${compact ? " recipe-photo--compact" : ""}`} style={style}>
        <img
          src={useThumb ? thumbSrc : fullSrc}
          alt={`${recipe.title.en}: ${caption ?? stage ?? "finished dish"}`}
          loading={compact ? "lazy" : "eager"}
          decoding="async"
          onError={(event) => {
            const image = event.currentTarget;
            // Thumbs are derived assets; fall back to the full photo before giving up.
            if (useThumb && image.src.includes("/thumbs/")) {
              image.src = fullSrc;
              return;
            }
            (image.parentElement as HTMLElement).classList.add("is-missing");
          }}
        />
        <span className="recipe-photo__sheen" aria-hidden="true" />
        {!compact && <figcaption className="stage-label">{caption ?? `Real photo · ${stage ?? "finished dish"}`}</figcaption>}
      </figure>
    );
  }
  return (
    <div className={`recipe-visual${compact ? " recipe-visual--compact" : ""}`} style={style} role="img" aria-label={`${recipe.title.en}: ${stage ?? "finished stage"}`}>
      <span className="recipe-visual__cloth" />
      <span className="recipe-visual__bowl">
        <span className="recipe-visual__food" />
        <span className="recipe-visual__garnish recipe-visual__garnish--one" />
        <span className="recipe-visual__garnish recipe-visual__garnish--two" />
        <span className="recipe-visual__garnish recipe-visual__garnish--three" />
      </span>
      <span className="recipe-visual__spoon" />
      {!compact && <span className="stage-label">Stage reference · {stage ?? "finish"}</span>}
    </div>
  );
}

export function RecipeListCard({ recipe, language, onOpen }: { recipe: RecipeCard; language: Language; onOpen: () => void }) {
  return (
    <article className="recipe-card">
      <button className="recipe-card__main" onClick={onOpen} aria-label={localText(recipe.title, language)}>
        <RecipeVisual recipe={recipe} compact />
        <span className="recipe-card__body">
          <span className="recipe-card__eyebrow">{localText(recipe.region, language)}</span>
          <strong lang={language === "hi" ? "hi" : "en"}>{localText(recipe.title, language)}</strong>
          <span className="recipe-card__meta">
            {msg(language, "minutes", { count: recipe.timeMin })} · {localText(recipe.difficulty, language)}
          </span>
          <span className="tag-row">
            {recipe.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
          </span>
        </span>
        <span className="card-arrow" aria-hidden="true">→</span>
      </button>
    </article>
  );
}

export function StepRoundel({ number, context }: { number: number; context: TextContext }) {
  return (
    <span className="step-roundel" aria-label={`Step ${number}`}>
      {displayNumber(number, context.language, Boolean(context.numerals))}
    </span>
  );
}

export function TimerBadge({
  total,
  remaining,
  completed,
  context
}: {
  total: number;
  remaining: number;
  completed: boolean;
  context: TextContext;
}) {
  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const style = { "--timer-progress": `${progress * 360}deg` } as CSSProperties;
  return (
    <div className={`timer-badge glass-region${completed ? " is-complete" : ""}`} style={style} role="timer" aria-live={completed ? "assertive" : "off"}>
      <span>{displayNumber(formatTime(remaining), context.language, Boolean(context.numerals))}</span>
      <small>{completed ? "CHECK" : "TIMER"}</small>
    </div>
  );
}

export function VoicePill({ state, language }: { state: string; language: Language }) {
  let key: MessageKey = "voiceOff";
  if (state === "armed" || state === "capturing") key = "listening";
  if (state === "speaking") key = "speaking";
  if (state === "resolving" || state === "transcribing") key = "resolving";
  if (state === "error") key = "noMic";
  return (
    <div className={`voice-pill glass-region voice-pill--${state}`} role="status" aria-live="polite">
      <span className="voice-state-mark" aria-hidden="true">
        {state === "capturing" ? (
          <span className="waveform"><i /><i /><i /><i /><i /></span>
        ) : state === "resolving" || state === "transcribing" ? (
          <span className="state-spinner" />
        ) : state === "speaking" ? (
          <span className="speaker-mark"><i /></span>
        ) : (
          <span className="listening-dot" />
        )}
      </span>
      <span>{msg(language, key)}</span>
      {state === "speaking" && <span className="mic-muted" aria-label="microphone muted">MIC ×</span>}
    </div>
  );
}

export function HeardChip({ transcript, intent, language }: { transcript: string; intent: string; language: Language }) {
  return <div className="heard-chip" role="status">{msg(language, "heard", { transcript, intent })}</div>;
}

export function Sheet({
  title,
  eyebrow,
  onClose,
  children,
  className = ""
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`bottom-sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-heading">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function CookButton({ children, className = "", onClick, disabled, ariaLabel }: { children: ReactNode; className?: string; onClick?: MouseEventHandler<HTMLButtonElement>; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button className={`cook-button ${className}`} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
