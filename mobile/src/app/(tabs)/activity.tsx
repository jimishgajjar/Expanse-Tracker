import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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
  const [search, setSearch] = useState("");

  const groups = useMemo<[string, Transaction[]][]>(() => {
    const q = search.trim().toLowerCase();
    const txns = (data?.transactions ?? []).filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (q) {
        const hay = `${t.note} ${t.category?.name ?? ""} ${t.account?.name ?? ""} ${(t.tags ?? []).map((tg) => tg.name).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const byDay = new Map<string, Transaction[]>();
    for (const t of txns) {
      const arr = byDay.get(t.date) ?? [];
      arr.push(t);
      byDay.set(t.date, arr);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data, filter, search]);

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
        <View style={s.searchWrap}>
          <Feather name="search" size={16} color={colors.inkFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search note, category, tag…"
            placeholderTextColor={colors.inkFaint}
            style={s.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.inkSoft} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
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
  title: { fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: -0.6, marginBottom: 14 },
  filters: { flexDirection: "row", backgroundColor: colors.hover, borderRadius: radius.md, padding: 3, gap: 3, marginBottom: 10 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.hover, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, padding: 0 },
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
