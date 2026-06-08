import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/lib/store";
import { Card, Loading } from "@/components/ui";
import { TxRow } from "@/components/tx-row";
import { formatDay } from "@/lib/format";
import { colors, radius } from "@/lib/theme";
import type { Transaction } from "@/lib/types";

type Filter = "all" | "expense" | "income";

export default function Activity() {
  const { data, loading, reload, money } = useApp();
  const [filter, setFilter] = useState<Filter>("all");

  const groups = useMemo<[string, Transaction[]][]>(() => {
    const txns = (data?.transactions ?? []).filter((t) => filter === "all" || t.type === filter);
    const byDay = new Map<string, Transaction[]>();
    for (const t of txns) {
      const arr = byDay.get(t.date) ?? [];
      arr.push(t);
      byDay.set(t.date, arr);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data, filter]);

  if (!data) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Text style={s.title}>Activity</Text>
        <View style={s.filters}>
          {(["all", "expense", "income"] as Filter[]).map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[s.filter, filter === f && s.filterActive]}>
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f[0].toUpperCase() + f.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} />}
      >
        {groups.length === 0 ? (
          <Text style={s.empty}>No transactions.</Text>
        ) : (
          groups.map(([day, txns]) => {
            const net = txns.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
            return (
              <View key={day} style={{ marginBottom: 16 }}>
                <View style={s.dayHead}>
                  <Text style={s.dayLabel}>{formatDay(day)}</Text>
                  <Text style={[s.dayNet, { color: net >= 0 ? colors.green : colors.red }]}>{money.signed(net)}</Text>
                </View>
                <Card style={{ padding: 0 }}>
                  {txns.map((t, i) => (
                    <View key={t.id} style={i > 0 ? s.divider : undefined}>
                      <TxRow tx={t} fmt={money} />
                    </View>
                  ))}
                </Card>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.4, marginBottom: 12 },
  filters: { flexDirection: "row", backgroundColor: colors.hover, borderRadius: radius.md, padding: 3, gap: 3, marginBottom: 4 },
  filter: { flex: 1, paddingVertical: 7, borderRadius: radius.sm, alignItems: "center" },
  filterActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  filterTextActive: { color: colors.ink },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6, paddingHorizontal: 2 },
  dayLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  dayNet: { fontSize: 13, fontWeight: "700" },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: 48 },
});
