import { useEffect, useMemo, useRef, useState } from "react";
import { HeardChip, RecipeVisual, Sheet, StepRoundel, VoicePill } from "../components";
import { saveDishCheck } from "../db";
import { compareDishPhotos, readFileAsDataUrl, shrinkForStorage } from "../dishCheck";
import { msg } from "../messages";
import { localText, type CookSession, type Preferences, type RecipeCard, type Recovery } from "../model";
import { displayNumber, flameInstruction, formatTime } from "../utils";

export function CookingScreen({
  recipe,
  session,
  preferences,
  voiceState,
  heard,
  wakeLock,
  onBack,
  onChangeStep,
  onTimer,
  onPause,
  onWhistle,
  onRecovery,
  onComplete,
  onPushToTalkStart,
  onPushToTalkEnd,
  handsFree,
  onHandsFreeToggle,
  whistleDetectorStatus,
  onWhistleDetectorStart,
  onWhistleDetectorStop
}: {
  recipe: RecipeCard;
  session: CookSession;
  preferences: Preferences;
  voiceState: string;
  heard?: { transcript: string; intent: string; at: number };
  wakeLock: boolean;
  onBack: () => void;
  onChangeStep: (direction: 1 | -1) => void;
  onTimer: (seconds: number, stepId: string) => void;
  onPause: () => void;
  onWhistle: (delta?: number) => void;
  onRecovery: (id: string) => void;
  onComplete: () => void;
  onPushToTalkStart: () => void;
  onPushToTalkEnd: () => void;
  handsFree: boolean;
  onHandsFreeToggle: () => void;
  whistleDetectorStatus: "off" | "requesting" | "warming" | "listening" | "whistle" | "error";
  onWhistleDetectorStart: () => void;
  onWhistleDetectorStop: () => void;
}) {
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [selectedRecovery, setSelectedRecovery] = useState<Recovery>();
  const [whistleOpen, setWhistleOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [calibrated, setCalibrated] = useState(() => localStorage.getItem("rasoiguide-whistle-calibrated") === "true");
  const language = preferences.language;
  const step = recipe.steps[session.stepIndex]!;
  const isLast = session.stepIndex === recipe.steps.length - 1;
  const context = { language, numerals: preferences.devanagariNumerals };

  useEffect(() => {
    setSelectedRecovery(undefined);
    if (step.whistles) setWhistleOpen(true);
  }, [step.id, step.whistles]);

  useEffect(() => {
    const openRecovery = () => setRecoveryOpen(true);
    window.addEventListener("rasoiguide:open-recovery", openRecovery);
    return () => window.removeEventListener("rasoiguide:open-recovery", openRecovery);
  }, []);

  const timer = session.timer?.stepId === step.id ? session.timer : undefined;
  const riskLabel = step.risk === "high" ? "Stay close · high-attention step" : step.attention === "passive" ? "Hands free while this cooks" : "Active step";
  const whistleTarget = step.whistles?.count ?? 0;
  const whistleComplete = whistleTarget > 0 && session.whistleCount >= whistleTarget;
  const recoveryChoices = useMemo(() => step.recovery.slice(0, 3), [step]);
  const referencePhotoId = step.photo ?? recipe.photo;
  const timerProgress = timer && timer.totalSec > 0 ? Math.max(0, Math.min(1, timer.remainingSec / timer.totalSec)) : 0;

  return (
    <main className={`cooking-page${session.paused ? " is-paused" : ""}`} id="main-content" data-cook-session-step={session.stepIndex} data-cook-step-id={step.id}>
      <header className="cook-topbar glass-region">
        <button className="cook-back" onClick={onBack} aria-label={msg(language, "back")}>←</button>
        <div>
          <small>{localText(recipe.title, language)}</small>
          <strong>{session.paused ? msg(language, "paused") : riskLabel}</strong>
        </div>
        <div className="cook-statuses">
          <span className={`wake-state${wakeLock ? " is-held" : ""}`} title={wakeLock ? "Screen awake" : "Wake lock unavailable"}>W</span>
          <button className="pause-button" onClick={onPause}>{session.paused ? msg(language, "resumeAction") : msg(language, "pause")}</button>
        </div>
      </header>
      <div className="jali-band" aria-hidden="true" />

      {session.paused ? (
        <section className="paused-panel">
          <span className="pause-rings" aria-hidden="true"><i /><i /></span>
          <p className="eyebrow">Doorbell problem, handled</p>
          <h1>{msg(language, "paused")}</h1>
          <p>{localText(recipe.title, language)} · {msg(language, "stepOf", { current: session.stepIndex + 1, total: recipe.steps.length })}</p>
          {timer && <strong className="paused-time">{formatTime(timer.remainingSec)} remaining</strong>}
          <button className="primary-cta" onClick={onPause}>{msg(language, "resumeAction")}</button>
        </section>
      ) : (
        <>
          <section className="cooking-stage">
            <div className="step-heading">
              <StepRoundel number={step.n} context={context} />
              <div>
                <small>{msg(language, "stepOf", { current: session.stepIndex + 1, total: recipe.steps.length })}</small>
                <span className={`attention-flag attention-flag--${step.risk}`}>{riskLabel}</span>
              </div>
            </div>
            <h1 className={language === "hi" ? "hindi-copy" : ""}>{localText(step.text, language)}</h1>
            <p className="doneness-cue"><span className="cue-line" />{localText(step.cue, language)}</p>

            <div className="stage-frame-wrap">
              <RecipeVisual recipe={recipe} stage={step.stage} photo={step.photo} caption={`${msg(language, "howItShouldLook")} · ${msg(language, "realPhoto")}`} />
            </div>

            <div className="timer-panel glass-region" role="timer" aria-live={timer?.completed ? "assertive" : "off"}>
              {timer ? (
                <>
                  <span className={`timer-dial${timer.completed ? " is-complete" : ""}`} style={{ "--timer-progress": `${timerProgress * 360}deg` } as React.CSSProperties}>
                    <b>{displayNumber(formatTime(timer.remainingSec), language, Boolean(preferences.devanagariNumerals))}</b>
                  </span>
                  <div className="timer-panel__copy">
                    <strong>{timer.completed ? msg(language, "timerDone") : msg(language, "timerRunning")}</strong>
                    <small>{localText(step.cue, language)}</small>
                  </div>
                </>
              ) : (
                <>
                  {step.durationSec ? (
                    <button className="timer-main-start" onClick={() => onTimer(step.durationSec!, step.id)}>
                      <span className="timer-dial"><b>{displayNumber(formatTime(step.durationSec), language, Boolean(preferences.devanagariNumerals))}</b></span>
                      <span>{msg(language, "addTimer", { count: Math.ceil(step.durationSec / 60) })}</span>
                    </button>
                  ) : (
                    <div className="timer-panel__copy"><strong>{msg(language, "quickTimer")}</strong><small>{localText(step.cue, language)}</small></div>
                  )}
                  <div className="quick-timer-row" aria-label={msg(language, "quickTimer")}>
                    {[1, 5, 10].map((minutes) => (
                      <button key={minutes} onClick={() => onTimer(minutes * 60, step.id)}>+{minutes} {msg(language, "minShort")}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="cook-utility-rail glass-region">
              <button className="utility-item" aria-label={`${msg(language, "flame", { level: step.flame })}: ${flameInstruction(preferences.stove, step.flame, language)}`}>
                <span className="flame-mark" aria-hidden="true"><i /></span>
                <span><small>{msg(language, "flame", { level: step.flame })}</small><strong>{flameInstruction(preferences.stove, step.flame, language)}</strong></span>
              </button>
              <span className="utility-divider" />
              <button className="utility-item" onClick={() => setCheckOpen(true)}>
                <span className="camera-mark" aria-hidden="true"><i /></span>
                <span><small>{msg(language, "checkMyDish")}</small><strong>{msg(language, "referenceDish")}</strong></span>
              </button>
            </div>

            {step.cookware && <p className="cookware-note"><strong>{msg(language, "cookware")}:</strong> {localText(step.cookware, language)}</p>}

            {step.whistles && (
              <button className={`whistle-inline${whistleComplete ? " is-complete" : ""}`} onClick={() => setWhistleOpen(true)}>
                <span className="whistle-rings" aria-hidden="true"><i /><i /></span>
                <span><small>{msg(language, "whistleTitle")}</small><strong>{session.whistleCount} / {step.whistles.count} {msg(language, "whistleStatus")}</strong></span>
                <b>{whistleComplete ? "✓" : "Open"}</b>
              </button>
            )}

            <div className="voice-row">
              <VoicePill state={voiceState} language={language} />
              <button className={`hands-free-toggle glass-region${handsFree ? " is-on" : ""}`} onClick={onHandsFreeToggle} aria-pressed={handsFree}>
                <span className="ptt-mark" aria-hidden="true"><i /></span>
                <span>{msg(language, "handsFree")} {handsFree ? "ON" : "OFF"}</span>
              </button>
            </div>
            {heard && Date.now() - heard.at < 5000 && <HeardChip transcript={heard.transcript} intent={heard.intent} language={language} />}
          </section>

          <div className="cook-action-dock glass-region">
            <button className="dock-side" onClick={() => onChangeStep(-1)} disabled={session.stepIndex === 0}>
              <span aria-hidden="true">←</span><small>{msg(language, "back")}</small>
            </button>
            <button
              className={`ptt-button${voiceState === "capturing" ? " is-listening" : ""}`}
              onPointerDown={onPushToTalkStart}
              onPointerUp={onPushToTalkEnd}
              onPointerCancel={onPushToTalkEnd}
              onKeyDown={(event) => event.key === " " && onPushToTalkStart()}
              onKeyUp={(event) => event.key === " " && onPushToTalkEnd()}
              aria-label={msg(language, "pushToTalk")}
            >
              <span className="ptt-mark" aria-hidden="true"><i /></span>
              <small>{msg(language, "pushToTalk")}</small>
            </button>
            <button className="trouble-button" onClick={() => setRecoveryOpen(true)}>
              <span className="trouble-mark" aria-hidden="true">!</span>
              <small>{msg(language, "wrong")}</small>
            </button>
            <button className="dock-next" onClick={isLast ? onComplete : () => onChangeStep(1)}>
              <span aria-hidden="true">→</span><small>{isLast ? msg(language, "finish") : msg(language, "next")}</small>
            </button>
          </div>
        </>
      )}

      {recoveryOpen && (
        <Sheet title={msg(language, "recoveryTitle")} eyebrow={selectedRecovery ? localText(selectedRecovery.failure, language) : msg(language, "recoveryPrompt")} onClose={() => { setRecoveryOpen(false); setSelectedRecovery(undefined); }} className="recovery-sheet">
          {!selectedRecovery ? (
            <div className="recovery-options">
              {recoveryChoices.map((recovery) => (
                <button key={recovery.id} onClick={() => setSelectedRecovery(recovery)}>
                  <span className="recovery-choice-mark" aria-hidden="true" />
                  <span>{localText(recovery.failure, language)}</span>
                  <b aria-hidden="true">→</b>
                </button>
              ))}
              <button onClick={() => setSelectedRecovery(recoveryChoices[0])}>
                <span className="recovery-choice-mark" aria-hidden="true" />
                <span>Something else / कुछ और</span><b>→</b>
              </button>
            </div>
          ) : (
            <div className="recovery-fix">
              {selectedRecovery.question && <div className="clarifying-question"><small>Check this first</small><strong>{localText(selectedRecovery.question, language)}</strong></div>}
              <p>{localText(selectedRecovery.fix, language)}</p>
              {selectedRecovery.patch && <div className="step-patch">{localText(selectedRecovery.patch, language)}</div>}
              <div className="recovery-stage-pair">
                <div><RecipeVisual recipe={recipe} compact photo={step.photo} /><small>Still recoverable</small></div>
                <div><RecipeVisual recipe={recipe} compact /><small>Adjust the recipe</small></div>
              </div>
              <button className="primary-cta" onClick={() => {
                onRecovery(selectedRecovery.id);
                setRecoveryOpen(false);
                setSelectedRecovery(undefined);
              }}>{msg(language, "applyFix")}</button>
            </div>
          )}
        </Sheet>
      )}

      {whistleOpen && step.whistles && (
        <Sheet title={msg(language, "whistleTitle")} eyebrow={`${localText(recipe.title, language)} · ${msg(language, "stepOf", { current: step.n, total: recipe.steps.length })}`} onClose={() => setWhistleOpen(false)} className="whistle-sheet">
          <div className={`whistle-counter${whistleComplete ? " is-complete" : ""}`}>
            <span className="whistle-halo" aria-hidden="true"><i /><i /><i /></span>
            <div className="whistle-numbers">
              <strong>{session.whistleCount}</strong><span>/</span><b>{step.whistles.count}</b>
            </div>
            <p>{whistleComplete ? "Target reached — lower the flame now." : msg(language, "whistleStatus")}</p>
            <span className={`detector-state detector-state--${whistleDetectorStatus}`}><i /> {
              whistleDetectorStatus === "off" ? "Auto-count is off · manual is ready" :
              whistleDetectorStatus === "requesting" ? "Waiting for microphone permission" :
              whistleDetectorStatus === "warming" ? "Learning this kitchen's background sound" :
              whistleDetectorStatus === "listening" ? "Auto-count listening · STT paused" :
              whistleDetectorStatus === "whistle" ? "Whistle heard and counted" :
              "Auto-count unavailable · use the +1 button"
            }</span>
          </div>
          {!calibrated && session.whistleCount > 0 && (
            <div className="calibration-card">
              <p>{msg(language, "calibration")}</p>
              <button onClick={() => { localStorage.setItem("rasoiguide-whistle-calibrated", "true"); setCalibrated(true); }}>{msg(language, "confirm")}</button>
            </div>
          )}
          <button className="manual-whistle" onClick={() => onWhistle(1)} disabled={whistleComplete}>
            <span>+1</span><strong>{msg(language, "manualWhistle")}</strong>
          </button>
          {whistleDetectorStatus === "off" || whistleDetectorStatus === "error" ? (
            <button className="auto-whistle-action" onClick={onWhistleDetectorStart}>Start private auto-count</button>
          ) : (
            <button className="auto-whistle-action" onClick={onWhistleDetectorStop}>Stop auto-count</button>
          )}
          <button className="undo-whistle" onClick={() => onWhistle(-1)} disabled={session.whistleCount === 0}>{msg(language, "undoWhistle")}</button>
          <p className="manual-fallback-note">{localText(step.whistles.manualFallback, language)}</p>
        </Sheet>
      )}

      {checkOpen && (
        <DishCheckSheet
          recipe={recipe}
          stepId={step.id}
          referencePhotoId={referencePhotoId}
          cue={localText(step.cue, language)}
          language={language}
          onClose={() => setCheckOpen(false)}
        />
      )}
    </main>
  );
}

function DishCheckSheet({
  recipe,
  stepId,
  referencePhotoId,
  cue,
  language,
  onClose
}: {
  recipe: RecipeCard;
  stepId: string;
  referencePhotoId?: string;
  cue: string;
  language: Preferences["language"];
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState<string>();
  const [score, setScore] = useState<number>();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceUrl = referencePhotoId ? `${import.meta.env.BASE_URL}photos/${referencePhotoId}.jpg` : undefined;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setScore(undefined);
    try {
      const raw = await readFileAsDataUrl(file);
      const stored = await shrinkForStorage(raw);
      setPhoto(stored);
      let similarity: number | undefined;
      if (referenceUrl) {
        try {
          similarity = await compareDishPhotos(stored, referenceUrl);
          setScore(similarity);
        } catch {
          // Comparison is best-effort; the side-by-side view alone is still useful.
        }
      }
      void saveDishCheck({ recipeId: recipe.id, stepId, takenAt: Date.now(), image: stored, similarity });
    } finally {
      setBusy(false);
    }
  };

  const verdictKey = score === undefined ? undefined : score >= 62 ? "matchGood" : score >= 38 ? "matchOk" : "matchLow";

  return (
    <Sheet title={msg(language, "checkMyDish")} eyebrow={localText(recipe.title, language)} onClose={onClose} className="camera-sheet">
      <p className="check-intro">{msg(language, "checkDishIntro")}</p>
      <div className="dish-compare">
        <figure className="dish-compare__cell">
          {referenceUrl ? <img src={referenceUrl} alt={msg(language, "referenceDish")} /> : <span className="dish-compare__empty" />}
          <figcaption>{msg(language, "referenceDish")}</figcaption>
        </figure>
        <figure className="dish-compare__cell">
          {photo ? <img src={photo} alt={msg(language, "yourDish")} /> : (
            <button className="dish-upload" onClick={() => inputRef.current?.click()}>
              <span className="camera-mark" aria-hidden="true"><i /></span>
              {msg(language, "uploadDish")}
            </button>
          )}
          <figcaption>{msg(language, "yourDish")}</figcaption>
        </figure>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => void handleFile(event.target.files?.[0] ?? undefined)}
      />
      {busy && <p className="check-busy">{msg(language, "analysing")}</p>}
      {score !== undefined && verdictKey && (
        <div className={`stage-verdict stage-verdict--${verdictKey}`}>
          <span className="verdict-meter"><i style={{ width: `${score}%` }} /></span>
          <div>
            <small>{msg(language, "matchScore", { score })}</small>
            <strong>{msg(language, verdictKey)}</strong>
          </div>
        </div>
      )}
      <p className="doneness-cue"><span className="cue-line" />{cue}</p>
      {photo && (
        <button className="secondary-cta" onClick={() => { setPhoto(undefined); setScore(undefined); inputRef.current?.click(); }}>
          {msg(language, "retakePhoto")}
        </button>
      )}
      <p className="safety-note">{msg(language, "stageOnly")}</p>
    </Sheet>
  );
}
