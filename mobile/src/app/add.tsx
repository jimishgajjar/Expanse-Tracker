import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { colors, radius } from "@/lib/theme";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Add() {
  const { data, reload, token, ready } = useApp();
  const router = useRouter();
  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const accounts = (data?.accounts ?? []).filter((a) => !a.archived);

  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => c.kind === type),
    [data, type],
  );

  async function save() {
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!accountId) {
      setError("Pick an account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/transactions", {
        method: "POST",
        body: { type, amount: value, date: todayISO(), accountId, categoryId: categoryId || null, note: note.trim() },
      });
      await reload();
      dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setBusy(false);
    }
  }

  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable onPress={dismiss} hitSlop={12}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <Text style={s.title}>New transaction</Text>
        <View style={{ width: 54 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={s.toggle}>
          {(["expense", "income"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setType(t);
                setCategoryId(null);
              }}
              style={[s.toggleBtn, type === t && (t === "expense" ? s.toggleExpense : s.toggleIncome)]}
            >
              <Text style={[s.toggleText, type === t && { color: "#fff" }]}>{t === "expense" ? "Expense" : "Income"}</Text>
            </Pressable>
          ))}
        </View>

        <View>
          <Text style={s.label}>Amount</Text>
          <TextInput
            style={s.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.inkFaint}
            autoFocus
          />
        </View>

        <View>
          <Text style={s.label}>Account</Text>
          {accounts.length === 0 ? (
            <Text style={{ color: colors.inkSoft, fontSize: 14 }}>
              No accounts loaded yet. Go back to Home and pull down to refresh.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {accounts.map((a) => (
                <Chip key={a.id} label={a.name} color={a.color} active={accountId === a.id} onPress={() => setAccountId(a.id)} />
              ))}
            </ScrollView>
          )}
        </View>

        <View>
          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="None" color={colors.inkSoft} active={!categoryId} onPress={() => setCategoryId(null)} />
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} color={c.color} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </ScrollView>
        </View>

        <View>
          <Text style={s.label}>Note</Text>
          <TextInput
            style={s.input}
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={colors.inkFaint}
          />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Add {type}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Chip({ label, color, active, onPress }: { label: string; color: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active ? { backgroundColor: color + "22", borderColor: color } : { borderColor: colors.border }]}
    >
      <Text style={[s.chipText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { fontSize: 16, color: colors.inkSoft },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  toggle: { flexDirection: "row", backgroundColor: colors.hover, borderRadius: radius.md, padding: 3, gap: 3 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  toggleExpense: { backgroundColor: colors.red },
  toggleIncome: { backgroundColor: colors.green },
  toggleText: { fontSize: 15, fontWeight: "600", color: colors.inkSoft },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 8 },
  amount: { fontSize: 34, fontWeight: "800", color: colors.ink, paddingVertical: 4, letterSpacing: -0.5 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  error: { color: colors.red, fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  save: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600", textTransform: "capitalize" },
});
