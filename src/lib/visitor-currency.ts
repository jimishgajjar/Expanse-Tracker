// Which currency to *show a stranger* on the public pages.
//
// Nothing here touches a workspace's real setting — that stays whatever the
// owner chose in Settings. This only decides what the marketing ledger and the
// auth panel demonstrate, so a visitor in Toronto sees dollars and a visitor in
// Mumbai sees rupees instead of one hardcoded currency for everyone.

import { headers } from "next/headers";
import { CURRENCIES, findCurrencyByCode, type Currency } from "./currencies";

/** Neutral fallback when we can't tell where the request came from. */
const FALLBACK = "USD";

/** ISO-3166 country → currency, limited to what the app actually supports. */
const BY_COUNTRY: Record<string, string> = {
  IN: "INR",
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  JP: "JPY",
  AU: "AUD", NZ: "AUD",
  SG: "SGD",
  CH: "CHF", LI: "CHF",
  CN: "CNY",
  AE: "AED",
  ZA: "ZAR",
  BR: "BRL",
  // Eurozone
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR",
  IE: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", LV: "EUR",
  LT: "EUR", EE: "EUR", LU: "EUR", CY: "EUR", MT: "EUR", HR: "EUR",
};

/** A believable month in each currency. Not a conversion of one base figure —
 *  a salary is a different *number* in Tokyo and Toronto, not the same number
 *  with a different sign in front, and the mock has to read as real money
 *  locally. Order: salary in, rent out, groceries out, electricity out. */
const SAMPLES: Record<string, [number, number, number, number]> = {
  INR: [85000, 28000, 3240, 1890],
  USD: [5200, 1800, 240, 110],
  EUR: [4200, 1350, 210, 95],
  GBP: [3800, 1450, 180, 90],
  JPY: [380000, 95000, 22000, 9500],
  AUD: [6400, 2100, 280, 130],
  CAD: [6800, 2200, 340, 145],
  SGD: [6500, 2600, 300, 120],
  CHF: [7200, 2100, 320, 110],
  CNY: [28000, 6500, 1400, 420],
  AED: [18000, 7000, 900, 400],
  ZAR: [45000, 12000, 2600, 1400],
  BRL: [9000, 2600, 700, 260],
};

/** Currencies conventionally written without minor units. */
const ZERO_DECIMAL = new Set(["JPY"]);

/** The unit as a word, for prose — "Every dollar, clearly accounted for." */
const NOUN: Record<string, string> = {
  INR: "rupee", USD: "dollar", EUR: "euro", GBP: "pound", JPY: "yen",
  AUD: "dollar", CAD: "dollar", SGD: "dollar", CHF: "franc", CNY: "yuan",
  AED: "dirham", ZAR: "rand", BRL: "real",
};

const currencyOf = (code: string): Currency =>
  findCurrencyByCode(code) ?? findCurrencyByCode(FALLBACK) ?? CURRENCIES[0];

/** Region subtag from an Accept-Language value: "en-CA,en;q=0.9" → "CA". */
function regionFromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim();
    // en-CA, pt-BR, de-CH — the 2-letter region is what we want.
    const m = /^[A-Za-z]{2,3}-([A-Za-z]{2})$/.exec(tag);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export type VisitorMoney = {
  currency: Currency;
  /** Formats a number in the visitor's currency, signed on request. */
  format: (n: number, opts?: { signed?: boolean }) => string;
  /** [salary, rent, groceries, electricity] — plausible local magnitudes. */
  sample: [number, number, number, number];
  /** The unit as a word for prose, e.g. "dollar". */
  noun: string;
  /** How the currency was chosen, for logging/debugging. */
  source: "geo" | "language" | "fallback";
};

/**
 * Resolve the visitor's currency from the request.
 *
 * Order matters: IP geo answers "where is this being opened", which is the
 * question; Accept-Language answers "what does this browser prefer", which is a
 * decent proxy when geo is absent (local dev, non-Vercel hosts).
 */
export async function getVisitorMoney(): Promise<VisitorMoney> {
  const h = await headers();

  let code: string | undefined;
  let source: VisitorMoney["source"] = "fallback";

  // Vercel sets this on every request at the edge.
  const country = h.get("x-vercel-ip-country")?.toUpperCase();
  if (country && BY_COUNTRY[country]) {
    code = BY_COUNTRY[country];
    source = "geo";
  }

  if (!code) {
    const region = regionFromAcceptLanguage(h.get("accept-language"));
    if (region && BY_COUNTRY[region]) {
      code = BY_COUNTRY[region];
      source = "language";
    }
  }

  const currency = currencyOf(code ?? FALLBACK);
  const digits = ZERO_DECIMAL.has(currency.code) ? 0 : 2;
  const nf = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  return {
    currency,
    source,
    noun: NOUN[currency.code] ?? "dollar",
    sample: SAMPLES[currency.code] ?? SAMPLES[FALLBACK],
    format: (n, opts) => {
      const body = `${currency.symbol}${nf.format(Math.abs(n))}`;
      if (!opts?.signed) return body;
      return `${n < 0 ? "−" : "+"}${body}`;
    },
  };
}
