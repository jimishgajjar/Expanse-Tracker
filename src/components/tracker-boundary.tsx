"use client";

import { useEffect, type ReactNode } from "react";
import { SCOPE_CHECK_PATH } from "@/lib/tracker-view";

export function TrackerBoundary({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  useEffect(() => {
    let latest = 0;
    let controller: AbortController | undefined;
    const root = document.documentElement;
    if (root.dataset.trackerDocument && root.dataset.trackerDocument !== viewKey) {
      root.setAttribute("data-tracker-locked", "");
      window.location.reload();
      return;
    }
    root.dataset.trackerDocument = viewKey;
    function lock() {
      latest++;
      controller?.abort();
      root.setAttribute("data-tracker-locked", "");
    }
    async function check(conceal: boolean) {
      if (document.hidden) return lock();
      if (conceal) lock();
      controller?.abort();
      const probe = new AbortController();
      controller = probe;
      const request = ++latest;
      const timeout = window.setTimeout(() => probe.abort(), 8000);
      try {
        const res = await fetch(SCOPE_CHECK_PATH, { cache: "no-store", signal: probe.signal });
        if (!res.ok) throw Error();
        const current = await res.json();
        if (request !== latest) return;
        if (current.viewKey !== viewKey) {
          lock();
          location.replace("/");
          return;
        }
        root.removeAttribute("data-tracker-locked");
        root.removeAttribute("data-tracker-offline");
      } catch {
        if (request === latest) {
          lock();
          root.setAttribute("data-tracker-offline", "");
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }
    const resume = () => { void check(true); };
    const storage = (event: StorageEvent) => { if (event.key === "tracker-switch") resume(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("pagehide", lock);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("storage", storage);
    void check(true);
    const poll = window.setInterval(() => { if (!document.hidden) void check(false); }, 15000);
    return () => {
      latest++;
      controller?.abort();
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", lock);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("storage", storage);
      root.removeAttribute("data-tracker-locked");
      root.removeAttribute("data-tracker-offline");
    };
  }, [viewKey]);
  return <>
    <span hidden data-tracker-view={viewKey} />
    <div className="tracker-shield" role="status">
      <span>Checking tracker access…</span>
      <button className="tracker-retry underline" onClick={() => location.reload()}>Reconnect and retry</button>
    </div>
    {children}
  </>;
}
