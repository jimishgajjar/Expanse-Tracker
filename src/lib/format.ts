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

// Round to exactly 2 decimals (cents) so summed floats can't drift the value
// that gets displayed — e.g. 1740.9999999998 → 1741.00.
const round2 = (n: number) => Math.round(((n || 0) + Number.EPSILON) * 100) / 100;

export function makeFormatters(currency: string, locale: string): Formatters {
  // Always two decimals, matching the precision amounts are entered with.
  const fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n: number, _opts: { decimals?: boolean } = {}) => `${currency}${fmt.format(Math.abs(round2(n)))}`;
  const signedMoney = (n: number) => `${n < 0 ? "−" : "+"}${money(n)}`;
  const balanceMoney = (n: number) => `${n < 0 ? "−" : ""}${money(n)}`;
  return { money, signedMoney, balanceMoney };
}

// Defaults for server-side / non-React contexts (e.g. the Excel export route).
const def = makeFormatters(DEFAULT_CURRENCY, DEFAULT_LOCALE);
export const money = def.money;
export const signedMoney = def.signedMoney;
export const balanceMoney = def.balanceMoney;
