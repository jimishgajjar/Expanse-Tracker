"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Share } from "lucide-react";
import { cn } from "@/lib/utils";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Chrome and Edge fire this once, often before React mounts, so keep it at module level.
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((fn) => fn()); });
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

type Mode = "hidden" | "prompt" | "ios";
function currentMode(): Mode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  if (deferred) return "prompt";
  // Safari on iPhone/iPad has no prompt API; installation is manual from the Share sheet.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "ios";
  return "hidden";
}

/** "Install app" for phones and desktops that support it; hidden once installed. */
export function InstallAppButton({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, currentMode, () => "hidden" as Mode);
  const [showSteps, setShowSteps] = useState(false);
  if (mode === "hidden") return null;

  return (
    <div className={cn("grid gap-1", className)}>
      <button
        type="button"
        className="nav-item group"
        aria-expanded={mode === "ios" ? showSteps : undefined}
        onClick={async () => {
          if (mode === "ios") { setShowSteps((s) => !s); return; }
          const prompt = deferred;
          if (!prompt) return;
          await prompt.prompt();
          await prompt.userChoice.catch(() => null);
          deferred = null;
          listeners.forEach((fn) => fn());
        }}
      >
        <Download className="size-[18px] text-muted-foreground group-hover:text-foreground" />
        <span>Install app</span>
      </button>
      {mode === "ios" && showSteps && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          In Safari, tap <Share className="inline size-3.5 align-[-2px]" aria-label="Share" /> Share, then <strong className="font-medium text-foreground">Add to Home Screen</strong>.
          The app opens full screen and keeps entries you add offline until you’re connected.
        </p>
      )}
    </div>
  );
}
