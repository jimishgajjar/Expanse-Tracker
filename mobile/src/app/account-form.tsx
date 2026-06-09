import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { Loading } from "@/components/ui";
import { IconColorPicker } from "@/components/icon-color-picker";
import { colors, radius } from "@/lib/theme";

const TYPES = ["bank", "cash", "card", "savings", "investment", "wallet"];

export default function AccountForm() {
  const { data, reload, token, ready } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id ? data?.accounts.find((a) => a.id === id) : undefined;
  const isEdit = !!editing;

  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState(editing?.type ?? "bank");
  const [icon, setIcon] = useState(editing?.icon ?? "wallet");
  const [color, setColor] = useState(editing?.color ?? "#6366f1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/home"));

  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  async function save() {
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), type, icon, color };
      if (isEdit) await api(`/accounts/${editing!.id}`, { method: "PATCH", body });
      else await api("/accounts", { method: "POST", body });
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
      await api(`/accounts/${editing!.id}`, { method: "DELETE" });
      await reload();
      dismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete.");
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable onPress={dismiss} hitSlop={12}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <Text style={s.title}>{isEdit ? "Edit account" : "New account"}</Text>
        {isEdit ? (
          <Pressable onPress={remove} hitSlop={12} disabled={busy}>
            <Feather name="trash-2" size={20} color={colors.red} />
          </Pressable>
        ) : (
          <View style={{ width: 54 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Savings" placeholderTextColor={colors.inkFaint} autoFocus={!isEdit} />
        </View>

        <View>
          <Text style={s.label}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[s.chip, type === t ? { backgroundColor: color + "22", borderColor: color } : { borderColor: colors.border }]}>
                <Text style={[s.chipText, type === t && { color }]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{isEdit ? "Save changes" : "Add account"}</Text>}
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
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft, textTransform: "capitalize" },
  error: { color: colors.red, fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  save: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
