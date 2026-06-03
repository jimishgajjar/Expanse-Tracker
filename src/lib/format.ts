// Currency + number formatting. The active currency/locale come from app
// settings (DB) at runtime via the SettingsProvider; these env values are only
// the initial defaults.
export const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "₹";
export const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "en-IN";

export type Formatters = {
  money: (n: number, opts?: { decimals?: boolean }) => string;
  signedMoney: (n: number) => string;
  balanceMoney: (n: number) => string;
};

export function makeFormatters(currency: string, locale: string): Formatters {
  const fmtDecimals = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const fmtWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const money = (n: number, opts: { decimals?: boolean } = {}) =>
    `${currency}${(opts.decimals ? fmtDecimals : fmtWhole).format(Math.abs(n || 0))}`;
  const signedMoney = (n: number) => `${n < 0 ? "−" : "+"}${money(n)}`;
  const balanceMoney = (n: number) => `${n < 0 ? "−" : ""}${money(n)}`;
  return { money, signedMoney, balanceMoney };
}

// Defaults for server-side / non-React contexts (e.g. the Excel export route).
const def = makeFormatters(DEFAULT_CURRENCY, DEFAULT_LOCALE);
export const money = def.money;
export const signedMoney = def.signedMoney;
export const balanceMoney = def.balanceMoney;
