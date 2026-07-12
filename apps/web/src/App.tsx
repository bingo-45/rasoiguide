import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AppHeader, BottomNav, Sheet } from "./components";
import { logIntentUnknown } from "./db";
import { recipeById } from "./data/recipes";
import { useConnectivity, useCookClock, useDurableStorage, useInstallPrompt, useWakeLock } from "./hooks";
import { msg } from "./messages";
import { localText, type View } from "./model";
import { LibraryScreen } from "./screens/LibraryScreen";

// The library boots instantly; every other screen loads on first visit.
const CookingScreen = lazy(() => import("./screens/CookingScreen").then((m) => ({ default: m.CookingScreen })));
const DetailScreen = lazy(() => import("./screens/DetailScreen").then((m) => ({ default: m.DetailScreen })));
const NaniScreen = lazy(() => import("./screens/NaniScreen").then((m) => ({ default: m.NaniScreen })));
const PantryScreen = lazy(() => import("./screens/PantryScreen").then((m) => ({ default: m.PantryScreen })));
const PrepScreen = lazy(() => import("./screens/PrepScreen").then((m) => ({ default: m.PrepScreen })));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen })));
const SummaryScreen = lazy(() => import("./screens/SummaryScreen").then((m) => ({ default: m.SummaryScreen })));
const ThaliScreen = lazy(() => import("./screens/ThaliScreen").then((m) => ({ default: m.ThaliScreen })));
import { useAppStore } from "./store";
import { matchIngredient, matchRecovery, quantityAnswer, quantitySummary, soundsLikeProblem, wantsHelp, wantsResume, wantsTimerStart } from "./guide";
import { APP_BASE, flameInstruction, relativePath, routeForView } from "./utils";
import { useVoiceController } from "./voiceController";
import { useWhistleController } from "./whistleController";

function playBell(): void {
  const audio = new Audio(`${APP_BASE}audio/brass-bell.wav`);
  audio.volume = 0.55;
  void audio.play().catch(() => {
    try {
      const context = new AudioContext();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(330, context.currentTime + 0.9);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.2);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 1.2);
    } catch {
      // The visible completion state remains the source of truth when audio is blocked.
    }
  });
}

export function App() {
  const state = useAppStore();
  const online = useConnectivity();
  const installPrompt = useInstallPrompt();
  const [permissionOpen, setPermissionOpen] = useState(false);
  const pendingHandsFree = useRef(false);
  const previousTimerComplete = useRef(false);
  const previousStep = useRef<string>();
  const previousView = useRef<View>();
  const recipe = recipeById(state.selectedRecipeId);
  const activeRecipe = recipeById(state.session?.recipeId ?? state.selectedRecipeId);
  const language = state.preferences.language;
  const cookingActive = state.view === "cook" && Boolean(state.session) && !state.session?.paused;
  const wakeLock = useWakeLock(cookingActive);

  useCookClock();
  useDurableStorage();

  useEffect(() => {
    void state.hydrate();
    // Zustand actions are stable; this should run once for initial IndexedDB hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ref keeps the guide's speech pointing at the freshest controller/language.
  const voiceRef = useRef<{ speak: (text: string) => void }>({ speak: () => undefined });

  const executeIntent = useCallback((transcript: string, intent: string, alternatives: string[]) => {
    const latest = useAppStore.getState();
    const lang = latest.preferences.language;
    const session = latest.session;
    const currentRecipe = recipeById(session?.recipeId ?? latest.selectedRecipeId);
    const currentStep = session ? currentRecipe.steps[session.stepIndex] : undefined;

    // Every utterance gets a spoken AND visible reply — the guide never goes silent.
    const respond = (reply: string) => {
      latest.setHeard(transcript, reply);
      voiceRef.current.speak(reply);
    };

    // Free-form routers first: these beat the classifier for guide-style requests.
    if (wantsHelp(transcript)) {
      respond(msg(lang, "guideHelp"));
      return;
    }
    if (session?.paused && wantsResume(transcript)) {
      latest.togglePause();
      respond(msg(lang, "guideResumed"));
      return;
    }
    if (wantsTimerStart(transcript) && currentStep) {
      if (session?.timer && !session.timer.completed) {
        respond(msg(lang, "guideTimerLeft", { minutes: Math.floor(session.timer.remainingSec / 60), seconds: session.timer.remainingSec % 60 }));
      } else if (currentStep.durationSec) {
        latest.startTimer(currentStep.durationSec, currentStep.id);
        respond(msg(lang, "guideTimerStarted", { count: Math.ceil(currentStep.durationSec / 60) }));
      } else {
        respond(msg(lang, "guideNoDuration"));
      }
      return;
    }

    const troubleshootNow = () => {
      const match = session ? matchRecovery(currentRecipe, session.stepIndex, transcript) : undefined;
      if (match) {
        latest.recordRecovery(match.recovery.id);
        respond(`${msg(lang, "guideFixIntro")} ${localText(match.recovery.fix, lang)}`);
        window.dispatchEvent(new CustomEvent("rasoiguide:open-recovery", { detail: { recoveryId: match.recovery.id, stepId: match.step.id } }));
      } else {
        respond(msg(lang, "guideAskProblem"));
        window.dispatchEvent(new CustomEvent("rasoiguide:open-recovery"));
      }
    };

    switch (intent) {
      case "advance":
        if (session && session.stepIndex >= currentRecipe.steps.length - 1) {
          latest.completeCook();
        } else if (session) {
          latest.changeStep(1);
          latest.setHeard(transcript, msg(lang, "stepOf", { current: session.stepIndex + 2, total: currentRecipe.steps.length }));
          // The step-change effect speaks the new step; no extra reply needed.
        }
        break;
      case "go-back":
        if (session && session.stepIndex === 0) respond(msg(lang, "guideFirstStep"));
        else {
          latest.changeStep(-1);
          latest.setHeard(transcript, msg(lang, "back"));
        }
        break;
      case "repeat":
        if (currentStep) respond(localText(currentStep.spoken, lang));
        break;
      case "quantity-query": {
        const ingredient = matchIngredient(currentRecipe, transcript);
        respond(ingredient
          ? quantityAnswer(ingredient, currentRecipe.servingsBase, currentRecipe.servingsBase, latest.preferences.katoriMl, lang)
          : quantitySummary(currentRecipe, currentRecipe.servingsBase, latest.preferences.katoriMl, lang));
        break;
      }
      case "timer-query":
        if (session?.timer && !session.timer.completed) {
          respond(msg(lang, "guideTimerLeft", { minutes: Math.floor(session.timer.remainingSec / 60), seconds: session.timer.remainingSec % 60 }));
        } else {
          respond(msg(lang, currentStep?.durationSec ? "guideNoTimer" : "guideNoDuration"));
        }
        break;
      case "flame-query":
        if (currentStep) respond(`${msg(lang, "flame", { level: currentStep.flame })}: ${flameInstruction(latest.preferences.stove, currentStep.flame, lang)}`);
        break;
      case "troubleshoot":
        troubleshootNow();
        break;
      case "pause-everything":
        if (!session?.paused) latest.togglePause();
        respond(msg(lang, "guidePausedMsg"));
        break;
      case "whistle-report":
        latest.addWhistle(1);
        respond(msg(lang, "guideWhistleCounted", { count: (session?.whistleCount ?? 0) + 1 }));
        break;
      case "substitute-query": {
        const ingredient = matchIngredient(currentRecipe, transcript);
        const substitution = ingredient?.substitutions?.[0];
        if (substitution) respond(`${localText(substitution.name, lang)} — ${substitution.ratio}. ${localText(substitution.note, lang)}`);
        else latest.navigate("prep");
        break;
      }
      case "switch-dish":
        latest.navigate("thali");
        break;
      default:
        void logIntentUnknown(transcript, alternatives);
        // A described problem beats a canned "didn't catch that".
        if (soundsLikeProblem(transcript)) troubleshootNow();
        else respond(msg(lang, "guideUnknown"));
    }
  // Reads all state through the store + voiceRef, so a stable identity is safe.
  }, []);

  const voice = useVoiceController({
    language,
    disabled: false,
    onState: state.setVoiceState,
    onResolved: executeIntent
  });
  voiceRef.current = voice;

  const whistleDetector = useWhistleController(() => {
    const latest = useAppStore.getState();
    latest.addWhistle(1);
    const count = (latest.session?.whistleCount ?? 0) + 1;
    if (latest.preferences.sounds) playBell();
    voice.speak(language === "hi" ? `${count} सीटी हो गई` : `${count} seeti ho gayi`);
  });

  useEffect(() => {
    const step = state.session ? activeRecipe.steps[state.session.stepIndex] : undefined;
    if (state.view !== "cook" || !step?.whistles || state.session?.paused) whistleDetector.stop();
  }, [activeRecipe.steps, state.session, state.view, whistleDetector]);

  useEffect(() => {
    // The guide keeps listening while paused (so "chalu karo" works) but
    // switches off when the cook leaves the cooking screen entirely.
    if (state.view !== "cook" && voice.handsFree) voice.stopHandsFree();
  }, [state.view, voice]);

  useEffect(() => {
    const currentPath = routeForView(state.view, recipe.slug);
    if (window.location.pathname !== currentPath) window.history.pushState({ view: state.view }, "", currentPath);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    previousView.current = state.view;
  }, [recipe.slug, state.view]);

  useEffect(() => {
    const handlePop = () => {
      const path = relativePath(window.location.pathname);
      let view: View = "library";
      if (path.startsWith("/recipe/")) view = "detail";
      else if (path.startsWith("/prep/")) view = "prep";
      else if (path.startsWith("/cook/")) view = "cook";
      else if (path.startsWith("/thali")) view = "thali";
      else if (path.startsWith("/pantry")) view = "pantry";
      else if (path.startsWith("/settings")) view = "settings";
      else if (path.startsWith("/summary")) view = "summary";
      else if (path.startsWith("/nani")) view = "nani";
      state.navigate(view);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [state]);

  useEffect(() => {
    if (state.view !== "cook" || !state.session || state.session.paused) return;
    const step = activeRecipe.steps[state.session.stepIndex];
    if (!step || previousStep.current === step.id) return;
    previousStep.current = step.id;
    // Every timed step gets its timer automatically — no hunting for a button.
    if (step.durationSec && (!state.session.timer || state.session.timer.stepId !== step.id)) {
      state.startTimer(step.durationSec, step.id);
    }
    if (!state.preferences.sounds) return;
    const delay = window.setTimeout(() => voice.speak(localText(step.spoken, language)), 260);
    return () => window.clearTimeout(delay);
  }, [activeRecipe.steps, language, state, state.preferences.sounds, state.session, state.view, voice]);

  useEffect(() => {
    const complete = Boolean(state.session?.timer?.completed);
    if (complete && !previousTimerComplete.current) {
      if (state.preferences.sounds) playBell();
      voice.speak(msg(language, "timerDone"));
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification("RasoiGuide timer", { body: msg(language, "timerDone"), icon: `${APP_BASE}icons/rasoiguide.svg` });
      }
    }
    previousTimerComplete.current = complete;
  }, [language, state.preferences.sounds, state.session?.timer?.completed, voice]);

  useEffect(() => {
    const onVisibility = () => {
      const latest = useAppStore.getState();
      if (document.hidden && latest.view === "cook" && latest.session && !latest.session.paused) latest.togglePause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const toggleHandsFree = useCallback(() => {
    if (voice.handsFree) {
      voice.stopHandsFree();
      return;
    }
    if (localStorage.getItem("rasoiguide-mic-explained") !== "true") {
      pendingHandsFree.current = true;
      setPermissionOpen(true);
      return;
    }
    voice.startHandsFree();
    voice.speak(msg(language, "guideOn"));
  }, [language, voice]);

  const shellVisible = ["library", "pantry", "settings"].includes(state.view);
  const content = (() => {
    if (!state.hydrated) {
      return (
        <main className="loading-kitchen">
          <span className="loading-pot" aria-hidden="true"><i /><i /></span>
          <p>Rasoi taiyaar ho rahi hai…</p>
        </main>
      );
    }
    switch (state.view) {
      case "detail":
        return <DetailScreen recipe={recipe} preferences={state.preferences} onBack={() => state.navigate("library")} onStart={() => state.startPrep(recipe.id)} onAddThali={() => { if (!state.thaliRecipeIds.includes(recipe.id)) state.setThaliRecipes([...state.thaliRecipeIds, recipe.id]); state.navigate("thali"); }} />;
      case "prep":
        if (!state.session) return null;
        return <PrepScreen recipe={activeRecipe} session={state.session} preferences={state.preferences} onBack={() => state.navigate("detail")} onToggle={state.toggleIngredient} onSubstitute={state.applySubstitution} onBegin={state.beginCooking} />;
      case "cook":
        if (!state.session) return null;
        return <CookingScreen recipe={activeRecipe} session={state.session} preferences={state.preferences} voiceState={state.voiceState} heard={state.heard} wakeLock={wakeLock} onBack={() => state.navigate("library")} onChangeStep={state.changeStep} onTimer={state.startTimer} onPause={state.togglePause} onWhistle={state.addWhistle} onRecovery={state.recordRecovery} onComplete={state.completeCook} guideActive={voice.handsFree} onGuideToggle={toggleHandsFree} whistleDetectorStatus={whistleDetector.status} onWhistleDetectorStart={() => void whistleDetector.start()} onWhistleDetectorStop={whistleDetector.stop} />;
      case "thali":
        return <ThaliScreen language={language} selectedIds={state.thaliRecipeIds} onSelection={state.setThaliRecipes} onBack={() => state.navigate("library")} onOpenRecipe={(id) => state.selectRecipe(id)} />;
      case "pantry":
        return <PantryScreen language={language} onOpen={state.selectRecipe} />;
      case "settings":
        return <SettingsScreen preferences={state.preferences} update={state.updatePreferences} />;
      case "summary":
        if (!state.session) return null;
        return <SummaryScreen recipe={activeRecipe} session={state.session} language={language} onSaveNote={state.saveNote} onCookAgain={() => state.startPrep(activeRecipe.id)} onHome={() => state.navigate("library")} />;
      case "nani":
        return <NaniScreen language={language} onBack={() => state.navigate("library")} />;
      default:
        return <LibraryScreen language={language} session={state.session} onResume={() => void state.resumeCooking()} onOpen={state.selectRecipe} onThali={() => state.navigate("thali")} onNani={() => state.navigate("nani")} />;
    }
  })();

  return (
    <div className={`app app--${state.view}`} data-view={state.view} data-session-step={state.session?.stepIndex}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {shellVisible && <AppHeader language={language} online={online} canInstall={installPrompt.canInstall} onInstall={() => void installPrompt.install()} onHome={() => state.navigate("library")} />}
      <Suspense fallback={
        <main className="loading-kitchen">
          <span className="loading-pot" aria-hidden="true"><i /><i /></span>
          <p>Rasoi taiyaar ho rahi hai…</p>
        </main>
      }>
        {content}
      </Suspense>
      {shellVisible && <BottomNav view={state.view} language={language} navigate={state.navigate} />}

      {permissionOpen && (
        <Sheet title={msg(language, "handsFree")} eyebrow="One clear permission" onClose={() => { setPermissionOpen(false); pendingHandsFree.current = false; }} className="permission-sheet">
          <div className="permission-visual"><span className="ptt-mark" aria-hidden="true"><i /></span><span className="permission-rings" aria-hidden="true"><i /><i /></span></div>
          <p>{msg(language, "permissionIntro")}</p>
          <button className="primary-cta" onClick={() => {
            localStorage.setItem("rasoiguide-mic-explained", "true");
            setPermissionOpen(false);
            pendingHandsFree.current = false;
            voice.startHandsFree();
            voice.speak(msg(language, "guideOn"));
          }}>{msg(language, "allowMic")}</button>
          <button className="sheet-cancel" onClick={() => { setPermissionOpen(false); pendingHandsFree.current = false; }}>{msg(language, "touchOnly")}</button>
        </Sheet>
      )}
    </div>
  );
}
