export type Currency = { code: string; symbol: string; locale: string; label: string };

// Currencies offered in the settings picker. Each maps to a display symbol and
// a locale (the locale controls digit grouping, e.g. ₹ uses lakh grouping).
export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", locale: "en-IN", label: "Indian Rupee" },
  { code: "USD", symbol: "$", locale: "en-US", label: "US Dollar" },
  { code: "EUR", symbol: "€", locale: "de-DE", label: "Euro" },
  { code: "GBP", symbol: "£", locale: "en-GB", label: "British Pound" },
  { code: "JPY", symbol: "¥", locale: "ja-JP", label: "Japanese Yen" },
  { code: "AUD", symbol: "A$", locale: "en-AU", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", locale: "en-CA", label: "Canadian Dollar" },
  { code: "SGD", symbol: "S$", locale: "en-SG", label: "Singapore Dollar" },
  { code: "CHF", symbol: "CHF", locale: "de-CH", label: "Swiss Franc" },
  { code: "CNY", symbol: "¥", locale: "zh-CN", label: "Chinese Yuan" },
  { code: "AED", symbol: "AED", locale: "en-AE", label: "UAE Dirham" },
  { code: "ZAR", symbol: "R", locale: "en-ZA", label: "South African Rand" },
  { code: "BRL", symbol: "R$", locale: "pt-BR", label: "Brazilian Real" },
];

export const DEFAULT_CURRENCY_CODE = "INR";

export const findCurrencyByCode = (code: string) =>
  CURRENCIES.find((c) => c.code === code);
