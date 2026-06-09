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

export default function CategoryForm() {
  const { data, reload, token, ready } = useApp();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = id ? data?.categories.find((c) => c.id === id) : undefined;
  const isEdit = !!editing;

  const [name, setName] = useState(editing?.name ?? "");
  const [kind, setKind] = useState<"income" | "expense">(editing?.kind ?? "expense");
  const [icon, setIcon] = useState(editing?.icon ?? "tag");
  const [color, setColor] = useState(editing?.color ?? "#64748b");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/categories"));

  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  async function save() {
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), kind, icon, color };
      if (isEdit) await api(`/categories/${editing!.id}`, { method: "PATCH", body });
      else await api("/categories", { method: "POST", body });
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
      await api(`/categories/${editing!.id}`, { method: "DELETE" });
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
        <Text style={s.title}>{isEdit ? "Edit category" : "New category"}</Text>
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
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Groceries" placeholderTextColor={colors.inkFaint} autoFocus={!isEdit} />
        </View>

        <View style={s.kindToggle}>
          {(["expense", "income"] as const).map((k) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[s.kindBtn, kind === k && (k === "expense" ? s.kindExpense : s.kindIncome)]}>
              <Text style={[s.kindText, kind === k && { color: "#fff" }]}>{k[0].toUpperCase() + k.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} />

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{isEdit ? "Save changes" : "Add category"}</Text>}
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
  kindToggle: { flexDirection: "row", backgroundColor: colors.hover, borderRadius: radius.md, padding: 3, gap: 3 },
  kindBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: "center" },
  kindExpense: { backgroundColor: colors.red },
  kindIncome: { backgroundColor: colors.green },
  kindText: { fontSize: 14, fontWeight: "600", color: colors.inkSoft },
  error: { color: colors.red, fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  save: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
