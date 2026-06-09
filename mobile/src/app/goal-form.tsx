import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { Loading } from "@/components/ui";
import { COLOR_CHOICES } from "@/components/icon-color-picker";
import { colors, radius } from "@/lib/theme";

export default function GoalForm() {
  const { token, ready } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [color, setColor] = useState(COLOR_CHOICES[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace("/goals"));
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  async function save() {
    const t = parseFloat(target.replace(",", "."));
    if (!name.trim()) return setError("Name your goal.");
    if (!t || t <= 0) return setError("Target must be greater than 0.");
    setBusy(true);
    setError(null);
    try {
      await api("/goals", {
        method: "POST",
        body: { name: name.trim(), targetAmount: t, savedAmount: parseFloat(saved.replace(",", ".")) || 0, color },
      });
      await qc.invalidateQueries({ queryKey: qk.goals() });
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
        <Text style={s.title}>New goal</Text>
        <View style={{ width: 54 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>Name</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Emergency fund" placeholderTextColor={colors.inkFaint} autoFocus />
        </View>
        <View>
          <Text style={s.label}>Target amount</Text>
          <TextInput style={s.input} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.inkFaint} />
        </View>
        <View>
          <Text style={s.label}>Already saved (optional)</Text>
          <TextInput style={s.input} value={saved} onChangeText={setSaved} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.inkFaint} />
        </View>
        <View>
          <Text style={s.label}>Color</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {COLOR_CHOICES.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={[s.swatch, { backgroundColor: c }, color === c && s.swatchActive]} />
            ))}
          </View>
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Add goal</Text>}
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
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: "transparent" },
  swatchActive: { borderColor: colors.ink },
  error: { color: colors.red, fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  save: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
