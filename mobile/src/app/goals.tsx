import { useState } from "react";
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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { Card, Loading } from "@/components/ui";
import { colors, radius } from "@/lib/theme";
import type { Goal } from "@/lib/types";

export default function Goals() {
  const { money } = useApp();
  const router = useRouter();
  const q = useQuery({ queryKey: qk.goals(), queryFn: () => api<{ goals: Goal[] }>("/goals") });
  const goals = q.data?.goals ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);

  async function contribute(id: string) {
    const v = parseFloat(amt.replace(",", "."));
    if (!v) return;
    setBusy(true);
    try {
      await api(`/goals/${id}/contribute`, { method: "POST", body: { amount: v } });
      setOpenId(null);
      setAmt("");
      await q.refetch();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api(`/goals/${id}`, { method: "DELETE" });
    await q.refetch();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Savings goals</Text>
        <Pressable onPress={() => router.push("/goal-form")} hitSlop={12}>
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
        ) : goals.length === 0 ? (
          <Text style={s.empty}>No goals yet. Tap + to add one.</Text>
        ) : (
          goals.map((g) => {
            const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100)) : 0;
            const width: DimensionValue = `${pct}%`;
            return (
              <Card key={g.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={s.name}>{g.name}</Text>
                  <Pressable onPress={() => remove(g.id)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color={colors.inkFaint} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <Text style={[s.saved, { color: g.color }]}>{money.money(g.savedAmount)}</Text>
                  <Text style={s.target}>
                    of {money.money(g.targetAmount)} · {pct}%
                  </Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width, backgroundColor: g.color }]} />
                </View>
                {openId === g.id ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                    <TextInput
                      style={s.input}
                      value={amt}
                      onChangeText={setAmt}
                      keyboardType="decimal-pad"
                      placeholder="Amount"
                      placeholderTextColor={colors.inkFaint}
                      autoFocus
                    />
                    <Pressable style={s.addBtn} onPress={() => contribute(g.id)} disabled={busy}>
                      {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.addText}>Add</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={s.contribute} onPress={() => { setOpenId(g.id); setAmt(""); }}>
                    <Feather name="plus" size={14} color={colors.green} />
                    <Text style={s.contributeText}>Contribute</Text>
                  </Pressable>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  empty: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: 48 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  saved: { fontSize: 18, fontWeight: "800" },
  target: { fontSize: 13, color: colors.inkSoft },
  track: { height: 8, backgroundColor: colors.hover, borderRadius: 4, overflow: "hidden", marginTop: 10 },
  fill: { height: 8, borderRadius: 4 },
  contribute: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12, alignSelf: "flex-start" },
  contributeText: { color: colors.green, fontSize: 14, fontWeight: "600" },
  input: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  addBtn: { backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", minWidth: 64 },
  addText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
