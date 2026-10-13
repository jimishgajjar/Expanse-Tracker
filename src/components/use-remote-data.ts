"use client";

import { useEffect, useState } from "react";

/** Abort old requests and never display another workspace or filter's results. */
export function useRemoteData<T>(url: string | null, revision?: unknown) {
  const [result, setResult] = useState<{url: string; data?: T; error?: string}>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const changed = () => setAttempt(n => n + 1);
    window.addEventListener("ledger-changed", changed);
    return () => window.removeEventListener("ledger-changed", changed);
  }, []);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Please sign in again." : "Couldn't load this section. Try again.");
      return response.json() as Promise<T>;
    }).then(data => setResult({url, data})).catch(error => {
      if (!controller.signal.aborted) setResult({url, error: error.message});
    });
    return () => controller.abort();
  }, [url, attempt, revision]);
  return { data: result?.url === url ? result.data : undefined, error: result?.url === url ? result.error : undefined, retry: () => setAttempt(n => n + 1) };
}
