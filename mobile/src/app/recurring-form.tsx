import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { Loading } from "@/components/ui";
import { colors, radius } from "@/lib/theme";

const FREQ = ["weekly", "monthly", "yearly"] as const;

export default function RecurringForm() {
  const { data, token, ready } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const accounts = (data?.accounts ?? []).filter((a) => !a.archived);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<(typeof FREQ)[number]>("monthly");
  const [nextDate, setNextDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showDate, setShowDate] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => (data?.categories ?? []).filter((c) => c.kind === type), [data, type]);
  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/subscriptions"));

  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  async function save() {
    const v = parseFloat(amount.replace(",", "."));
    if (!v || v <= 0) return setError("Enter an amount greater than 0.");
    if (!accountId) return setError("Pick an account.");
    setBusy(true);
    setError(null);
    try {
      await api("/recurring", {
        method: "POST",
        body: { type, amount: v, accountId, categoryId: categoryId || null, frequency, nextDate, note: note.trim() },
      });
      await qc.invalidateQueries({ queryKey: qk.recurring() });
      dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable onPress={dismiss} hitSlop={12}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <Text style={s.title}>New recurring</Text>
        <View style={{ width: 54 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={s.toggle}>
          {(["expense", "income"] as const).map((t) => (
            <Pressable key={t} onPress={() => { setType(t); setCategoryId(null); }} style={[s.toggleBtn, type === t && (t === "expense" ? s.toggleExpense : s.toggleIncome)]}>
              <Text style={[s.toggleText, type === t && { color: "#fff" }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Amount</Text>
            <TextInput style={s.amount} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.inkFaint} autoFocus />
          </View>
          <Pressable onPress={() => setShowDate((v) => !v)} style={s.dateBtn}>
            <Feather name="calendar" size={15} color={colors.inkSoft} />
            <Text style={s.dateText}>{format(parseISO(nextDate), "d MMM yyyy")}</Text>
          </Pressable>
        </View>
        {showDate ? (
          <DateTimePicker
            value={parseISO(nextDate)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_e, sel) => {
              if (Platform.OS !== "ios") setShowDate(false);
              if (sel) setNextDate(format(sel, "yyyy-MM-dd"));
            }}
          />
        ) : null}

        <View>
          <Text style={s.label}>Frequency</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FREQ.map((f) => (
              <Pressable key={f} onPress={() => setFrequency(f)} style={[s.chip, frequency === f ? { backgroundColor: colors.green + "22", borderColor: colors.green } : { borderColor: colors.border }]}>
                <Text style={[s.chipText, frequency === f && { color: colors.green }]}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text style={s.label}>Account</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {accounts.map((a) => (
              <Pressable key={a.id} onPress={() => setAccountId(a.id)} style={[s.chip, accountId === a.id ? { backgroundColor: a.color + "22", borderColor: a.color } : { borderColor: colors.border }]}>
                <Text style={[s.chipText, accountId === a.id && { color: a.color }]}>{a.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View>
          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable onPress={() => setCategoryId(null)} style={[s.chip, !categoryId ? { backgroundColor: colors.inkSoft + "22", borderColor: colors.inkSoft } : { borderColor: colors.border }]}>
              <Text style={s.chipText}>None</Text>
            </Pressable>
            {categories.map((c) => (
              <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[s.chip, categoryId === c.id ? { backgroundColor: c.color + "22", borderColor: c.color } : { borderColor: colors.border }]}>
                <Text style={[s.chipText, categoryId === c.id && { color: c.color }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View>
          <Text style={s.label}>Note</Text>
          <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="e.g. Netflix" placeholderTextColor={colors.inkFaint} />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Add recurring</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancel: { fontSize: 16, color: colors.inkSoft },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  toggle: { flexDirection: "row", backgroundColor: colors.hover, borderRadius: radius.md, padding: 3, gap: 3 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  toggleExpense: { backgroundColor: colors.red },
  toggleIncome: { backgroundColor: colors.green },
  toggleText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 8 },
  amount: { fontSize: 34, fontWeight: "800", color: colors.ink, paddingVertical: 2, letterSpacing: -0.5 },
  dateBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  dateText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft, textTransform: "capitalize" },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  error: { color: colors.red, fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  save: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
