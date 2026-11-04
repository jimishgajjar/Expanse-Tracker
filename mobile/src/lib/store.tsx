import React, { useEffect, useMemo } from "react";
import { AppState } from "react-native";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, qk } from "./query";
import { useAuth } from "./auth";
import { usePeriod } from "./period";
import { bindApi } from "./api";
import { makeMoney } from "./format";
import type { Bootstrap } from "./types";

/** Providers + session hydration. Wrap the whole app. */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    const state = () => useAuth.getState();
    if (AppState.currentState && AppState.currentState !== "active") state().suspend();
    void hydrate();
    const subscription = AppState.addEventListener("change", next => {
      if (next === "active") void state().verify();
      else state().suspend();
    });
    const poll = setInterval(() => {
      if (AppState.currentState === "active" && state().viewKey && !state().deviceLocked) void state().verify();
    }, 15000);
    return () => { subscription.remove(); clearInterval(poll); };
  }, [hydrate]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Back-compat facade over the auth store + the bootstrap query, so screens can
    keep using a single hook. Server state is cached/shared by TanStack Query. */
export function useApp() {
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const viewKey = useAuth((s) => s.viewKey);
  const workspace = useAuth((s) => s.activeWorkspaceId);
  const api = bindApi();
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const signOut = useAuth((s) => s.signOut);

  const range = usePeriod((s) => s.range);
  const anchor = usePeriod((s) => s.anchor);

  const q = useQuery({
    queryKey: qk.bootstrap(range, anchor),
    queryFn: () => api<Bootstrap>(`/bootstrap?range=${range}&date=${anchor}`),
    enabled: !!viewKey && !!workspace,
  });

  const data = viewKey && workspace ? q.data ?? null : null;
  const money = useMemo(
    () => makeMoney(data?.settings?.currency ?? "C$", data?.settings?.locale ?? "en-CA"),
    [data?.settings?.currency, data?.settings?.locale],
  );

  return {
    ready: hydrated,
    token,
    data,
    loading: q.isFetching,
    error: q.error instanceof Error ? q.error.message : null,
    money,
    reload: async () => {
      await q.refetch();
    },
    signIn,
    signUp,
    signOut,
  };
}
