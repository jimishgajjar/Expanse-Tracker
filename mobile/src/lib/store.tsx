import React, { useEffect, useMemo } from "react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient, qk } from "./query";
import { useAuth } from "./auth";
import { api } from "./api";
import { makeMoney } from "./format";
import type { Bootstrap } from "./types";

/** Providers + session hydration. Wrap the whole app. */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Back-compat facade over the auth store + the bootstrap query, so screens can
    keep using a single hook. Server state is cached/shared by TanStack Query. */
export function useApp() {
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const signIn = useAuth((s) => s.signIn);
  const signUp = useAuth((s) => s.signUp);
  const signOut = useAuth((s) => s.signOut);

  const q = useQuery({
    queryKey: qk.bootstrap(),
    queryFn: () => api<Bootstrap>("/bootstrap?range=month"),
    enabled: !!token,
  });

  const data = q.data ?? null;
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
