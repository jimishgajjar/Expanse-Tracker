import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { format, parseISO } from "date-fns";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { Loading } from "@/components/ui";
import { colors, radius } from "@/lib/theme";

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

type TxType = "expense" | "income" | "transfer";

export default function TransactionForm() {
  const { data, reload, token, ready } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id ? data?.transactions.find((t) => t.id === id) : undefined;
  const isEdit = !!editing;

  const accounts = (data?.accounts ?? []).filter((a) => !a.archived);
  const allTags = data?.tags ?? [];

  const [type, setType] = useState<TxType>(editing?.type ?? "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [accountId, setAccountId] = useState(editing?.accountId ?? accounts[0]?.id ?? "");
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts.find((a) => a.id !== accounts[0]?.id)?.id ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [tagIds, setTagIds] = useState<string[]>(editing?.tags.map((t) => t.id) ?? []);
  const [note, setNote] = useState(editing?.note ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => c.kind === (type === "income" ? "income" : "expense")),
    [data, type],
  );

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const types: TxType[] = isEdit ? ["expense", "income"] : ["expense", "income", "transfer"];

  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  async function save() {
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) return setError("Enter an amount greater than 0.");
    setBusy(true);
    setError(null);
    try {
      if (type === "transfer") {
        if (fromAccountId === toAccountId) {
          setError("Choose two different accounts.");
          setBusy(false);
          return;
        }
        await api("/transfers", { method: "POST", body: { amount: value, date, note: note.trim(), fromAccountId, toAccountId } });
      } else {
        const body = { type, amount: value, date, accountId, categoryId: categoryId || null, note: note.trim(), tagIds };
        if (isEdit) await api(`/transactions/${editing!.id}`, { method: "PATCH", body });
        else await api("/transactions", { method: "POST", body });
      }
      await reload();
      dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/transactions/${editing!.id}`, { method: "DELETE" });
      await reload();
      dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setBusy(false);
    }
  }

  const toggleTag = (tid: string) =>
    setTagIds((ids) => (ids.includes(tid) ? ids.filter((x) => x !== tid) : [...ids, tid]));

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable onPress={dismiss} hitSlop={12}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <Text style={s.title}>{isEdit ? "Edit transaction" : "New transaction"}</Text>
        {isEdit ? (
          <Pressable onPress={remove} hitSlop={12} disabled={busy}>
            <Feather name="trash-2" size={20} color={colors.red} />
          </Pressable>
        ) : (
          <View style={{ width: 54 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={s.toggle}>
          {types.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[s.toggleBtn, type === t && (t === "expense" ? s.toggleExpense : t === "income" ? s.toggleIncome : s.toggleTransfer)]}
            >
              <Text style={[s.toggleText, type === t && { color: "#fff" }]}>
                {t[0].toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Amount</Text>
            <TextInput
              style={s.amount}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.inkFaint}
              autoFocus={!isEdit}
            />
          </View>
          <Pressable onPress={() => setShowDate((v) => !v)} style={s.dateBtn}>
            <Feather name="calendar" size={15} color={colors.inkSoft} />
            <Text style={s.dateText}>{format(parseISO(date), "d MMM yyyy")}</Text>
          </Pressable>
        </View>
        {showDate ? (
          <DateTimePicker
            value={parseISO(date)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_e, selected) => {
              if (Platform.OS !== "ios") setShowDate(false);
              if (selected) setDate(format(selected, "yyyy-MM-dd"));
            }}
          />
        ) : null}

        {type === "transfer" ? (
          <>
            <Picker label="From" accounts={accounts} value={fromAccountId} onChange={setFromAccountId} />
            <Picker label="To" accounts={accounts} value={toAccountId} onChange={setToAccountId} />
          </>
        ) : (
          <>
            <View>
              <Text style={s.label}>Account</Text>
              {accounts.length === 0 ? (
                <Text style={s.hint}>No accounts loaded. Pull to refresh on Home.</Text>
              ) : (
                <Row>
                  {accounts.map((a) => (
                    <Chip key={a.id} label={a.name} color={a.color} active={accountId === a.id} onPress={() => setAccountId(a.id)} />
                  ))}
                </Row>
              )}
            </View>

            <View>
              <Text style={s.label}>Category</Text>
              <Row>
                <Chip label="None" color={colors.inkSoft} active={!categoryId} onPress={() => setCategoryId(null)} />
                {categories.map((c) => (
                  <Chip key={c.id} label={c.name} color={c.color} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                ))}
              </Row>
            </View>

            {allTags.length > 0 ? (
              <View>
                <Text style={s.label}>Tags</Text>
                <Row>
                  {allTags.map((t) => (
                    <Chip key={t.id} label={t.name} color={t.color} active={tagIds.includes(t.id)} onPress={() => toggleTag(t.id)} />
                  ))}
                </Row>
              </View>
            ) : null}
          </>
        )}

        <View>
          <Text style={s.label}>Note</Text>
          <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="Optional" placeholderTextColor={colors.inkFaint} />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{isEdit ? "Save changes" : `Add ${type}`}</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {children}
    </ScrollView>
  );
}

function Chip({ label, color, active, onPress }: { label: string; color: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active ? { backgroundColor: color + "22", borderColor: color } : { borderColor: colors.border }]}>
      <Text style={[s.chipText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

function Picker({
  label,
  accounts,
  value,
  onChange,
}: {
  label: string;
  accounts: { id: string; name: string; color: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <Row>
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} color={a.color} active={value === a.id} onPress={() => onChange(a.id)} />
        ))}
      </Row>
    </View>
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
  toggleTransfer: { backgroundColor: colors.ink },
  toggleText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 8 },
  hint: { color: colors.inkSoft, fontSize: 14 },
  amount: { fontSize: 34, fontWeight: "800", color: colors.ink, paddingVertical: 2, letterSpacing: -0.5 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dateText: { fontSize: 14, fontWeight: "600", color: colors.ink },
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
