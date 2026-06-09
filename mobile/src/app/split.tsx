import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { Card, Loading } from "@/components/ui";
import { colors, radius } from "@/lib/theme";
import type { SplitData } from "@/lib/types";

export default function Split() {
  const { money } = useApp();
  const router = useRouter();
  const q = useQuery({ queryKey: qk.split(), queryFn: () => api<{ split: SplitData }>("/split") });
  const sd = q.data?.split;
  const people = sd ? [{ id: sd.meId, name: "You" }, ...sd.otherMembers] : [];
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Someone";

  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [creditorId, setCreditorId] = useState("");
  const [debtorId, setDebtorId] = useState("");
  const [busy, setBusy] = useState(false);

  function openAdd() {
    if (!sd) return;
    setCreditorId(sd.meId);
    setDebtorId(sd.otherMembers[0]?.id ?? "");
    setAmount("");
    setNote("");
    setAdding(true);
  }
  async function addSplit() {
    const v = parseFloat(amount.replace(",", "."));
    if (!v || !creditorId || !debtorId || creditorId === debtorId) return;
    setBusy(true);
    try {
      await api("/split", { method: "POST", body: { amount: v, note: note.trim(), creditorId, debtorId } });
      setAdding(false);
      await q.refetch();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  async function settle(otherUserId: string) {
    await api("/split/settle", { method: "POST", body: { otherUserId } });
    await q.refetch();
  }
  async function remove(id: string) {
    await api(`/split/${id}`, { method: "DELETE" });
    await q.refetch();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Split</Text>
        <Pressable onPress={openAdd} hitSlop={12} disabled={!sd || sd.otherMembers.length === 0}>
          <Feather name="plus" size={24} color={!sd || sd.otherMembers.length === 0 ? colors.inkFaint : colors.green} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.green} />}
      >
        {q.isLoading ? (
          <View style={{ paddingTop: 60 }}>
            <Loading />
          </View>
        ) : !sd || sd.otherMembers.length === 0 ? (
          <Text style={s.empty}>Invite someone in Sharing to split expenses together.</Text>
        ) : (
          <>
            {adding ? (
              <Card style={{ marginBottom: 18, gap: 12 }}>
                <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={colors.inkFaint} autoFocus />
                <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="What for? (optional)" placeholderTextColor={colors.inkFaint} />
                <Text style={s.pickLabel}>Paid by</Text>
                <People people={people} value={creditorId} onChange={setCreditorId} />
                <Text style={s.pickLabel}>For</Text>
                <People people={people} value={debtorId} onChange={setDebtorId} />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={s.cancelBtn} onPress={() => setAdding(false)}>
                    <Text style={s.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[s.addBtn, busy && { opacity: 0.6 }]} onPress={addSplit} disabled={busy}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.addText}>Add split</Text>}
                  </Pressable>
                </View>
              </Card>
            ) : null}

            <Text style={s.section}>Balances</Text>
            <Card style={{ padding: 0, marginBottom: 18 }}>
              {sd.balances.length === 0 ? (
                <Text style={s.rowEmpty}>All settled up.</Text>
              ) : (
                sd.balances.map((b, i) => (
                  <View key={b.userId} style={[s.row, i > 0 && s.divider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{b.name}</Text>
                      <Text style={[s.balText, { color: b.net > 0 ? colors.green : b.net < 0 ? colors.red : colors.inkSoft }]}>
                        {b.net > 0 ? `owes you ${money.money(b.net)}` : b.net < 0 ? `you owe ${money.money(-b.net)}` : "settled"}
                      </Text>
                    </View>
                    {b.net !== 0 ? (
                      <Pressable style={s.settleBtn} onPress={() => settle(b.userId)}>
                        <Text style={s.settleText}>Settle</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </Card>

            <Text style={s.section}>Splits</Text>
            <Card style={{ padding: 0 }}>
              {sd.splits.length === 0 ? (
                <Text style={s.rowEmpty}>No splits yet.</Text>
              ) : (
                sd.splits.map((sp, i) => (
                  <View key={sp.id} style={[s.row, i > 0 && s.divider]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.name} numberOfLines={1}>
                        {sp.note || "Split"}
                      </Text>
                      <Text style={s.sub} numberOfLines={1}>
                        {nameOf(sp.debtorId)} → {nameOf(sp.creditorId)}
                      </Text>
                    </View>
                    <Text style={s.amount}>{money.money(sp.amount)}</Text>
                    <Pressable onPress={() => remove(sp.id)} hitSlop={8} style={{ marginLeft: 10 }}>
                      <Feather name="trash-2" size={16} color={colors.inkFaint} />
                    </Pressable>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function People({ people, value, onChange }: { people: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {people.map((p) => (
        <Pressable key={p.id} onPress={() => onChange(p.id)} style={[s.chip, value === p.id ? { backgroundColor: colors.green + "22", borderColor: colors.green } : { borderColor: colors.border }]}>
          <Text style={[s.chipText, value === p.id && { color: colors.green }]}>{p.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  empty: { color: colors.inkSoft, fontSize: 14, textAlign: "center", marginTop: 48, paddingHorizontal: 24 },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  pickLabel: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: colors.inkSoft, fontSize: 15, fontWeight: "600" },
  addBtn: { flex: 2, backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  addText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12 },
  rowEmpty: { color: colors.inkSoft, fontSize: 14, padding: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { fontSize: 15, fontWeight: "600", color: colors.ink },
  balText: { fontSize: 13, marginTop: 1, fontWeight: "500" },
  sub: { fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: "700", color: colors.ink },
  settleBtn: { borderWidth: 1, borderColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  settleText: { color: colors.green, fontSize: 13, fontWeight: "600" },
});
