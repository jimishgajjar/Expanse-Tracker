// Exact 2-decimal money, matching the web app's formatter.
const round2 = (n: number) => Math.round(((n || 0) + Number.EPSILON) * 100) / 100;

export function makeMoney(currency: string, locale: string) {
  let fmt: Intl.NumberFormat;
  try {
    fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const money = (n: number) => `${currency}${fmt.format(Math.abs(round2(n)))}`;
  return {
    money,
    signed: (n: number) => `${n < 0 ? "−" : "+"}${money(n)}`,
    balance: (n: number) => `${n < 0 ? "−" : ""}${money(n)}`,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon, 8 Jun" from an ISO yyyy-mm-dd (parsed as local, no timezone shift). */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${DOW[dt.getDay()]}, ${d} ${MONTHS[(m || 1) - 1]}`;
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}
