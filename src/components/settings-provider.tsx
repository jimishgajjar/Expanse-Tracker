"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, makeFormatters, type Formatters } from "@/lib/format";

type Settings = { currency: string; locale: string };

const Ctx = createContext<Settings>({ currency: DEFAULT_CURRENCY, locale: DEFAULT_LOCALE });

export function SettingsProvider({ currency, locale, children }: Settings & { children: ReactNode }) {
  const value = useMemo(() => ({ currency, locale }), [currency, locale]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useSettings(): Settings {
  return use(Ctx);
}

/** Currency-aware formatters bound to the active settings. */
export function useFormat(): Formatters {
  const { currency, locale } = use(Ctx);
  return useMemo(() => makeFormatters(currency, locale), [currency, locale]);
}
