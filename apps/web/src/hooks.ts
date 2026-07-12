import { useEffect, useRef, useState } from "react";
import { requestDurableStorage } from "./db";
import { useAppStore } from "./store";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useConnectivity(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function useInstallPrompt(): {
  canInstall: boolean;
  install: () => Promise<void>;
} {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent>();
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  return {
    canInstall: Boolean(prompt),
    install: async () => {
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(undefined);
    }
  };
}

export function useCookClock(): void {
  const tickTimer = useAppStore((state) => state.tickTimer);
  useEffect(() => {
    const interval = window.setInterval(tickTimer, 1000);
    return () => window.clearInterval(interval);
  }, [tickTimer]);
}

export function useWakeLock(active: boolean): boolean {
  const lock = useRef<WakeLockSentinel | null>(null);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      if (!active || !("wakeLock" in navigator)) return;
      try {
        lock.current = await navigator.wakeLock.request("screen");
        if (!cancelled) setHeld(true);
        lock.current.addEventListener("release", () => !cancelled && setHeld(false));
      } catch {
        if (!cancelled) setHeld(false);
      }
    };
    void acquire();
    const visibility = () => {
      if (document.visibilityState === "visible" && active && !lock.current) void acquire();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", visibility);
      void lock.current?.release();
      lock.current = null;
    };
  }, [active]);
  return held;
}

export function useDurableStorage(): void {
  useEffect(() => {
    void requestDurableStorage();
  }, []);
}
