"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, makeFormatters, type Formatters } from "@/lib/format";
import { trackerExportHref } from "@/lib/household-access";

type Settings = { currency: string; locale: string; workspace?:string; actor?:string };
export const MerchantRulesContext = createContext(false);
export const CommentsAvailable = createContext(false);
export function PreviewFeatures({rules,comments,children}:{rules:boolean;comments:boolean;children:ReactNode}) {
  return <MerchantRulesContext value={rules}><CommentsAvailable value={comments}>{children}</CommentsAvailable></MerchantRulesContext>;
}

const Ctx = createContext<Settings>({ currency: DEFAULT_CURRENCY, locale: DEFAULT_LOCALE });

export function SettingsProvider({ currency, locale, workspace, actor, children }: Settings & { children: ReactNode }) {
  const value = useMemo(() => ({ currency, locale, workspace, actor }), [currency, locale, workspace, actor]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useSettings(): Settings {
  return use(Ctx);
}

export function useExportHref() {
  return trackerExportHref(useSettings().workspace);
}

/** Currency-aware formatters bound to the active settings. */
export function useFormat(): Formatters {
  const { currency, locale } = use(Ctx);
  return useMemo(() => makeFormatters(currency, locale), [currency, locale]);
}
