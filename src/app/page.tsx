import { Dashboard } from "@/components/dashboard";
import { getRange, RANGE_TYPES, todayISO, type RangeType } from "@/lib/dates";
import { getAccountsWithBalances, getCategories, getSettings, getTransactionsInRange } from "@/lib/queries";

// DB-backed dashboard: always render with fresh data (Cache Components is off).
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const rangeType = (RANGE_TYPES.includes(sp.range as RangeType) ? sp.range : "month") as RangeType;
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayISO();
  const range = getRange(rangeType, anchor);

  const [accounts, categories, transactions, settings] = await Promise.all([
    getAccountsWithBalances(),
    getCategories(),
    getTransactionsInRange(range.start, range.end),
    getSettings(),
  ]);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <Dashboard
      accounts={accounts}
      categories={categories}
      transactions={transactions}
      rangeType={rangeType}
      anchor={anchor}
      rangeLabel={range.label}
      rangeStart={range.start}
      rangeEnd={range.end}
      totalBalance={totalBalance}
      currency={settings.currency}
      locale={settings.locale}
      currencyCode={settings.currencyCode}
    />
  );
}
