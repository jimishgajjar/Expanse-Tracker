"use client";

import { useEffect } from "react";

/** Register the service worker on load so the app is installable and can receive push. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
