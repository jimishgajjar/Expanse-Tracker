import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getItem, setItem, deleteItem } from "./storage";
import { api, setAuthToken } from "./api";
import { registerForPush } from "./push";
import { makeMoney } from "./format";
import type { Bootstrap } from "./types";

const TOKEN_KEY = "et_session_token";

type AppState = {
  ready: boolean;
  token: string | null;
  data: Bootstrap | null;
  loading: boolean;
  error: string | null;
  money: ReturnType<typeof makeMoney>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api<Bootstrap>("/bootstrap?range=month");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore a saved session on launch.
  useEffect(() => {
    (async () => {
      try {
        const t = await getItem(TOKEN_KEY);
        if (t) {
          setAuthToken(t);
          setToken(t);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Load data + register for push whenever we have a token.
  useEffect(() => {
    if (!token) return;
    reload();
    registerForPush().catch(() => {});
  }, [token, reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string }>("/auth/login", { method: "POST", body: { email, password } });
    await setItem(TOKEN_KEY, res.token);
    setAuthToken(res.token);
    setToken(res.token);
  }, []);

  const signOut = useCallback(async () => {
    await deleteItem(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setData(null);
  }, []);

  const money = useMemo(
    () => makeMoney(data?.settings?.currency ?? "C$", data?.settings?.locale ?? "en-CA"),
    [data?.settings?.currency, data?.settings?.locale],
  );

  const value: AppState = { ready, token, data, loading, error, money, signIn, signOut, reload };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
