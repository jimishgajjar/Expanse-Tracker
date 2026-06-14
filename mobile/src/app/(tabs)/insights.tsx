import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { usePeriod } from "@/lib/period";
import { shiftAnchor, canNavigate } from "@/lib/dates";
import { Card, Loading } from "@/components/ui";
import { LineChart } from "@/components/line-chart";
import { colors, radius } from "@/lib/theme";
import type { Budget, NetWorthPoint } from "@/lib/types";

export default function Insights() {
  const { data, loading, reload, money } = useApp();
  const nw = useQuery({ queryKey: qk.netWorth(), queryFn: () => api<{ series: NetWorthPoint[] }>("/analytics/net-worth") });
  const bq = useQuery({ queryKey: qk.budgets(), queryFn: () => api<{ budgets: Budget[] }>("/budgets") });
  const range = usePeriod((st) => st.range);
  const anchor = usePeriod((st) => st.anchor);
  const prevAnchor = shiftAnchor(range, anchor, -1);
  const cmp = useQuery({
    queryKey: ["range-totals", range, prevAnchor],
    queryFn: () => api<{ totals: { income: number; expense: number } }>(`/analytics/range-totals?range=${range}&date=${prevAnchor}`),
    enabled: canNavigate(range),
  });

  const stats = useMemo(() => {
    const txns = data?.transactions ?? [];
    const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const cats = new Map<string, { name: string; color: string; amount: number }>();
    for (const t of txns) {
      if (t.type !== "expense") continue;
      const name = t.category?.name ?? "Uncategorized";
      const color = t.category?.color ?? colors.inkSoft;
      const cur = cats.get(name) ?? { name, color, amount: 0 };
      cur.amount += t.amount;
      cats.set(name, cur);
    }
    return { income, expense, net: income - expense, byCategory: [...cats.values()].sort((a, b) => b.amount - a.amount) };
  }, [data]);

  const [setting, setSetting] = useState(false);
  const [catId, setCatId] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveBudget() {
    const v = parseFloat(amt.replace(",", "."));
    if (!catId || !v) return;
    setBusy(true);
    try {
      await api("/budgets", { method: "POST", body: { categoryId: catId, amount: v } });
      setSetting(false);
      setCatId(null);
      setAmt("");
      await bq.refetch();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  async function delBudget(categoryId: string) {
    await api(`/budgets/${categoryId}`, { method: "DELETE" });
    await bq.refetch();
  }

  if (!data) return <Loading />;
  const prev = cmp.data?.totals;
  const incomeDelta = prev && prev.income > 0 ? ((stats.income - prev.income) / prev.income) * 100 : null;
  const expenseDelta = prev && prev.expense > 0 ? ((stats.expense - prev.expense) / prev.expense) * 100 : null;
  const max = stats.byCategory[0]?.amount ?? 1;
  const series = nw.data?.series ?? [];
  const budgets = bq.data?.budgets ?? [];
  const expenseCats = data.categories.filter((c) => c.kind === "expense");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              reload();
              nw.refetch();
              bq.refetch();
            }}
            tintColor={colors.green}
          />
        }
      >
        <Text style={s.title}>Insights</Text>

        {series.length >= 2 ? (
          <Card style={{ marginBottom: 16 }}>
            <Text style={s.cardLabel}>Net worth</Text>
            <Text style={s.bigValue}>{money.balance(series[series.length - 1].value)}</Text>
            <View style={{ marginTop: 10 }}>
              <LineChart data={series.map((p) => p.value)} color={colors.green} />
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <Stat label="Income" value={money.money(stats.income)} tone={colors.green} delta={incomeDelta != null ? { pct: incomeDelta, good: incomeDelta >= 0 } : undefined} />
          <Stat label="Expenses" value={money.money(stats.expense)} tone={colors.red} delta={expenseDelta != null ? { pct: expenseDelta, good: expenseDelta <= 0 } : undefined} />
        </View>
        <Card style={{ marginBottom: 6 }}>
          <Text style={s.cardLabel}>Net this period</Text>
          <Text style={[s.bigValue, { color: stats.net >= 0 ? colors.green : colors.red }]}>{money.signed(stats.net)}</Text>
        </Card>

        <Text style={s.section}>Spending by category</Text>
        <Card>
          {stats.byCategory.length === 0 ? (
            <Text style={s.empty}>No spending yet this period.</Text>
          ) : (
            stats.byCategory.map((c, i) => {
              const pct: DimensionValue = `${Math.max(4, Math.round((c.amount / max) * 100))}%`;
              return (
                <View key={c.name} style={[{ paddingVertical: 10 }, i > 0 && s.divider]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={s.catName}>{c.name}</Text>
                    <Text style={s.catAmount}>{money.money(c.amount)}</Text>
                  </View>
                  <View style={s.track}>
                    <View style={[s.fill, { width: pct, backgroundColor: c.color }]} />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 }}>
          <Text style={[s.section, { marginBottom: 0 }]}>Budgets</Text>
          <Pressable onPress={() => setSetting((v) => !v)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Feather name={setting ? "x" : "plus"} size={16} color={colors.green} />
            <Text style={{ color: colors.green, fontSize: 13, fontWeight: "600" }}>{setting ? "Close" : "Set"}</Text>
          </Pressable>
        </View>
        <Card style={{ padding: 0 }}>
          {setting ? (
            <View style={{ padding: 12, gap: 12, borderBottomWidth: budgets.length ? 1 : 0, borderBottomColor: colors.border }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {expenseCats.map((c) => (
                  <Pressable key={c.id} onPress={() => setCatId(c.id)} style={[s.chip, catId === c.id ? { backgroundColor: c.color + "22", borderColor: c.color } : { borderColor: colors.border }]}>
                    <Text style={[s.chipText, catId === c.id && { color: c.color }]}>{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput style={s.input} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" placeholder="Monthly limit" placeholderTextColor={colors.inkFaint} />
                <Pressable style={[s.saveBtn, busy && { opacity: 0.6 }]} onPress={saveBudget} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save</Text>}
                </Pressable>
              </View>
            </View>
          ) : null}
          {budgets.length === 0 && !setting ? (
            <Text style={s.empty}>No budgets set. Tap "Set" to add one.</Text>
          ) : (
            budgets.map((b, i) => {
              const ratio = b.budget > 0 ? b.spent / b.budget : 0;
              const over = ratio > 1;
              const pct: DimensionValue = `${Math.min(100, Math.round(ratio * 100))}%`;
              return (
                <View key={b.categoryId} style={[{ padding: 12 }, i > 0 && s.divider]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={s.catName}>{b.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={[s.catAmount, over && { color: colors.red }]}>
                        {money.money(b.spent)} / {money.money(b.budget)}
                      </Text>
                      <Pressable onPress={() => delBudget(b.categoryId)} hitSlop={6}>
                        <Feather name="trash-2" size={14} color={colors.inkFaint} />
                      </Pressable>
                    </View>
                  </View>
                  <View style={s.track}>
                    <View style={[s.fill, { width: pct, backgroundColor: over ? colors.red : b.color }]} />
                  </View>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, tone, delta }: { label: string; value: string; tone: string; delta?: { pct: number; good: boolean } }) {
  return (
    <Card style={{ flex: 1, gap: 3 }}>
      <Text style={s.cardLabel}>{label}</Text>
      <Text style={[s.statValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {delta ? (
        <Text style={{ fontSize: 11, fontWeight: "600", color: delta.good ? colors.green : colors.red }}>
          {delta.pct >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta.pct))}% vs last
        </Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: -0.6, marginBottom: 16 },
  cardLabel: { fontSize: 13, color: colors.inkSoft },
  bigValue: { fontSize: 28, fontWeight: "800", color: colors.ink, letterSpacing: -0.5, marginTop: 4 },
  statValue: { fontSize: 20, fontWeight: "700" },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 10 },
  catName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  catAmount: { fontSize: 14, fontWeight: "700", color: colors.ink },
  track: { height: 8, backgroundColor: colors.hover, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, padding: 14 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  input: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  saveBtn: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", minWidth: 70 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
