import { useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/lib/store";
import { Card, Loading } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function Insights() {
  const { data, loading, reload, money } = useApp();

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
    const byCategory = [...cats.values()].sort((a, b) => b.amount - a.amount);
    return { income, expense, net: income - expense, byCategory };
  }, [data]);

  if (!data) return <Loading />;
  const max = stats.byCategory[0]?.amount ?? 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} />}
      >
        <Text style={s.title}>Insights</Text>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <Stat label="Income" value={money.money(stats.income)} tone={colors.green} />
          <Stat label="Expenses" value={money.money(stats.expense)} tone={colors.red} />
        </View>

        <Card style={{ marginBottom: 6 }}>
          <Text style={s.cardLabel}>Net this month</Text>
          <Text style={[s.bigValue, { color: stats.net >= 0 ? colors.green : colors.red }]}>{money.signed(stats.net)}</Text>
          <Text style={s.hint}>{stats.income > 0 ? Math.round((stats.net / stats.income) * 100) : 0}% of income saved</Text>
        </Card>

        <Text style={s.section}>Spending by category</Text>
        <Card>
          {stats.byCategory.length === 0 ? (
            <Text style={s.empty}>No spending yet this month.</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card style={{ flex: 1, gap: 3 }}>
      <Text style={s.cardLabel}>{label}</Text>
      <Text style={[s.statValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.4, marginBottom: 14 },
  cardLabel: { fontSize: 13, color: colors.inkSoft },
  statValue: { fontSize: 20, fontWeight: "700" },
  bigValue: { fontSize: 30, fontWeight: "800", letterSpacing: -0.6, marginTop: 4 },
  hint: { fontSize: 13, color: colors.inkFaint, marginTop: 4 },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 22, marginBottom: 10 },
  catName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  catAmount: { fontSize: 14, fontWeight: "700", color: colors.ink },
  track: { height: 8, backgroundColor: colors.hover, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, padding: 8 },
});
