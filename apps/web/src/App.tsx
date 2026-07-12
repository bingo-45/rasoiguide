import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader, BottomNav, Sheet } from "./components";
import { logIntentUnknown } from "./db";
import { recipeById } from "./data/recipes";
import { useConnectivity, useCookClock, useDurableStorage, useInstallPrompt, useWakeLock } from "./hooks";
import { msg } from "./messages";
import { localText, type View } from "./model";
import { CookingScreen } from "./screens/CookingScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { LibraryScreen } from "./screens/LibraryScreen";
import { NaniScreen } from "./screens/NaniScreen";
import { PantryScreen } from "./screens/PantryScreen";
import { PrepScreen } from "./screens/PrepScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { ThaliScreen } from "./screens/ThaliScreen";
import { useAppStore } from "./store";
import { APP_BASE, relativePath, routeForView } from "./utils";
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
  const pendingVoiceStart = useRef(false);
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

  const executeIntent = useCallback((transcript: string, intent: string, alternatives: string[]) => {
    const latest = useAppStore.getState();
    const session = latest.session;
    const currentRecipe = recipeById(session?.recipeId ?? latest.selectedRecipeId);
    const currentStep = session ? currentRecipe.steps[session.stepIndex] : undefined;
    latest.setHeard(transcript, intent === "unknown" ? alternatives.slice(0, 3).join(" / ") : intent);
    switch (intent) {
      case "advance":
        if (session && session.stepIndex >= currentRecipe.steps.length - 1) latest.completeCook();
        else latest.changeStep(1);
        break;
      case "go-back":
        latest.changeStep(-1);
        break;
      case "repeat":
        if (currentStep) voice.speak(localText(currentStep.spoken, latest.preferences.language));
        break;
      case "quantity-query":
        voice.speak(currentRecipe.ingredients.slice(0, 3).map((item) => localText(item.name, latest.preferences.language)).join(", "));
        break;
      case "timer-query":
        voice.speak(session?.timer ? `${Math.ceil(session.timer.remainingSec / 60)} minutes remaining` : "No timer is running right now.");
        break;
      case "flame-query":
        if (currentStep) voice.speak(`Aanch level ${currentStep.flame}. ${localText(currentStep.text, latest.preferences.language)}`);
        break;
      case "troubleshoot":
        window.dispatchEvent(new Event("rasoiguide:open-recovery"));
        break;
      case "pause-everything":
        latest.togglePause();
        break;
      case "whistle-report":
        latest.addWhistle(1);
        break;
      case "substitute-query":
        latest.navigate("prep");
        break;
      case "switch-dish":
        latest.navigate("thali");
        break;
      default:
        void logIntentUnknown(transcript, alternatives);
        voice.speak(`Matlab: ${alternatives.slice(0, 3).join(", ya ")}?`);
    }
  // The voice controller is stable across a render; callback refreshes when its language/disabled inputs change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voice = useVoiceController({
    language,
    disabled: false,
    onState: state.setVoiceState,
    onResolved: executeIntent
  });

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
    if ((state.view !== "cook" || state.session?.paused) && voice.handsFree) voice.stopHandsFree();
  }, [state.session?.paused, state.view, voice]);

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
    if (state.view !== "cook" || !state.session || state.session.paused || !state.preferences.sounds) return;
    const step = activeRecipe.steps[state.session.stepIndex];
    if (!step || previousStep.current === step.id) return;
    previousStep.current = step.id;
    const delay = window.setTimeout(() => voice.speak(localText(step.spoken, language)), 260);
    return () => window.clearTimeout(delay);
  }, [activeRecipe.steps, language, state.preferences.sounds, state.session, state.view, voice]);

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

  const beginVoice = useCallback(() => {
    if (localStorage.getItem("rasoiguide-mic-explained") !== "true") {
      pendingVoiceStart.current = true;
      setPermissionOpen(true);
      return;
    }
    pendingVoiceStart.current = true;
    voice.start();
  }, [voice]);

  const endVoice = useCallback(() => {
    voice.stop();
    pendingVoiceStart.current = false;
  }, [voice]);

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
    voice.speak(msg(language, "handsFreeOn"));
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
        return <CookingScreen recipe={activeRecipe} session={state.session} preferences={state.preferences} voiceState={state.voiceState} heard={state.heard} wakeLock={wakeLock} onBack={() => state.navigate("library")} onChangeStep={state.changeStep} onTimer={state.startTimer} onPause={state.togglePause} onWhistle={state.addWhistle} onRecovery={state.recordRecovery} onComplete={state.completeCook} onPushToTalkStart={beginVoice} onPushToTalkEnd={endVoice} handsFree={voice.handsFree} onHandsFreeToggle={toggleHandsFree} whistleDetectorStatus={whistleDetector.status} onWhistleDetectorStart={() => void whistleDetector.start()} onWhistleDetectorStop={whistleDetector.stop} />;
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
      {content}
      {shellVisible && <BottomNav view={state.view} language={language} navigate={state.navigate} />}

      {permissionOpen && (
        <Sheet title={msg(language, "pushToTalk")} eyebrow="One clear permission" onClose={() => { setPermissionOpen(false); pendingVoiceStart.current = false; }} className="permission-sheet">
          <div className="permission-visual"><span className="ptt-mark" aria-hidden="true"><i /></span><span className="permission-rings" aria-hidden="true"><i /><i /></span></div>
          <p>{msg(language, "permissionIntro")}</p>
          <button className="primary-cta" onClick={() => {
            localStorage.setItem("rasoiguide-mic-explained", "true");
            setPermissionOpen(false);
            if (pendingHandsFree.current) {
              pendingHandsFree.current = false;
              voice.startHandsFree();
              voice.speak(msg(language, "handsFreeOn"));
            } else {
              pendingVoiceStart.current = true;
              voice.start();
            }
          }}>{msg(language, "allowMic")}</button>
          <button className="sheet-cancel" onClick={() => { setPermissionOpen(false); pendingVoiceStart.current = false; pendingHandsFree.current = false; }}>{msg(language, "touchOnly")}</button>
        </Sheet>
      )}
    </div>
  );
}
