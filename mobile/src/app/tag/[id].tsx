import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { Card, Loading } from "@/components/ui";
import { TxRow } from "@/components/tx-row";
import { formatDay } from "@/lib/format";
import { tapSuccess } from "@/lib/haptics";
import { colors, radius } from "@/lib/theme";
import type { Transaction } from "@/lib/types";

export default function TagDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, money, reload } = useApp();
  const router = useRouter();
  const tag = data?.tags.find((t) => t.id === id);

  const q = useQuery({
    queryKey: ["tag-tx", id],
    queryFn: () => api<{ transactions: Transaction[] }>(`/tags/${id}/transactions`),
    enabled: !!id,
  });
  const txns = q.data?.transactions ?? [];

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag?.name ?? "");
  const [busy, setBusy] = useState(false);

  async function rename() {
    const next = name.trim();
    if (!next || next === tag?.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await api(`/tags/${id}`, { method: "PATCH", body: { name: next } });
      tapSuccess();
      setEditing(false);
      await reload();
      q.refetch();
    } catch (e) {
      Alert.alert("Couldn't rename", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete tag?", `"${tag?.name}" will be removed from its transactions. The transactions are kept.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/tags/${id}`, { method: "DELETE" });
            await reload();
            router.back();
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  }

  const { total, groups } = useMemo(() => {
    const total = txns.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
    const byDay = new Map<string, Transaction[]>();
    for (const t of txns) {
      const arr = byDay.get(t.date) ?? [];
      arr.push(t);
      byDay.set(t.date, arr);
    }
    return { total, groups: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)) };
  }, [txns]);

  if (!data) return <Loading />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {editing ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <TextInput value={name} onChangeText={setName} autoFocus maxLength={40} style={s.input} onSubmitEditing={rename} returnKeyType="done" placeholder="Tag name" placeholderTextColor={colors.inkFaint} />
            <Pressable onPress={rename} disabled={busy} hitSlop={8} style={s.iconBtn}>
              {busy ? <ActivityIndicator color={colors.green} /> : <Feather name="check" size={20} color={colors.green} />}
            </Pressable>
            <Pressable onPress={() => { setEditing(false); setName(tag?.name ?? ""); }} hitSlop={8} style={s.iconBtn}>
              <Feather name="x" size={20} color={colors.inkSoft} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tag?.color ?? colors.inkSoft }} />
            <Text style={s.title} numberOfLines={1}>
              {tag?.name ?? "Tag"}
            </Text>
            <Pressable onPress={() => { setName(tag?.name ?? ""); setEditing(true); }} hitSlop={8} style={{ marginLeft: "auto" }}>
              <Feather name="edit-2" size={18} color={colors.inkSoft} />
            </Pressable>
            <Pressable onPress={confirmDelete} hitSlop={8}>
              <Feather name="trash-2" size={18} color={colors.red} />
            </Pressable>
          </View>
        )}

        <Card style={{ marginBottom: 16 }}>
          <Text style={s.cardLabel}>Net across {txns.length} transactions</Text>
          <Text style={[s.total, { color: total >= 0 ? colors.green : colors.red }]}>{money.signed(total)}</Text>
        </Card>

        {q.isLoading ? (
          <View style={{ paddingTop: 40 }}>
            <Loading />
          </View>
        ) : groups.length === 0 ? (
          <Text style={s.empty}>No transactions with this tag.</Text>
        ) : (
          groups.map(([day, list]) => (
            <View key={day} style={{ marginBottom: 16 }}>
              <Text style={s.day}>{formatDay(day)}</Text>
              <Card style={{ padding: 0 }}>
                {list.map((t, i) => (
                  <View key={t.id} style={i > 0 ? s.divider : undefined}>
                    <TxRow tx={t} fmt={money} />
                  </View>
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 12, paddingVertical: 4 },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 18, fontWeight: "600", color: colors.ink },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 13, color: colors.inkSoft },
  total: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginTop: 4 },
  day: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 6, paddingHorizontal: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: 48 },
});
