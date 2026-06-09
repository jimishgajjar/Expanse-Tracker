import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { Card, IconBubble, Loading } from "@/components/ui";
import { colors } from "@/lib/theme";
import type { Recurring } from "@/lib/types";

export default function Subscriptions() {
  const { data, money } = useApp();
  const router = useRouter();
  const q = useQuery({ queryKey: qk.recurring(), queryFn: () => api<{ recurring: Recurring[] }>("/recurring") });
  const items = q.data?.recurring ?? [];

  async function remove(id: string) {
    await api(`/recurring/${id}`, { method: "DELETE" });
    await q.refetch();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Subscriptions &amp; bills</Text>
        <Pressable onPress={() => router.push("/recurring-form")} hitSlop={12}>
          <Feather name="plus" size={24} color={colors.green} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.green} />}
      >
        {q.isLoading ? (
          <View style={{ paddingTop: 60 }}>
            <Loading />
          </View>
        ) : items.length === 0 ? (
          <Text style={s.empty}>No recurring items yet. Tap + to add a subscription or bill.</Text>
        ) : (
          <Card style={{ padding: 0 }}>
            {items.map((r, i) => {
              const cat = data?.categories.find((c) => c.id === r.categoryId);
              const acc = data?.accounts.find((a) => a.id === r.accountId);
              const color = cat?.color ?? acc?.color ?? colors.inkSoft;
              const title = r.note || cat?.name || (r.type === "income" ? "Income" : "Expense");
              const sub = `${r.frequency} · next ${format(parseISO(r.nextDate), "d MMM")}${acc ? "  ·  " + acc.name : ""}`;
              return (
                <View key={r.id} style={[s.row, i > 0 && s.divider]}>
                  <IconBubble icon={cat?.icon ?? acc?.icon} color={color} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={s.rowSub} numberOfLines={1}>
                      {sub}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: r.type === "income" ? colors.green : colors.red }]}>
                    {money.signed(r.type === "income" ? r.amount : -r.amount)}
                  </Text>
                  <Pressable onPress={() => remove(r.id)} hitSlop={8} style={{ marginLeft: 10 }}>
                    <Feather name="trash-2" size={16} color={colors.inkFaint} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  empty: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: 48, paddingHorizontal: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.ink },
  rowSub: { fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: "700" },
});
