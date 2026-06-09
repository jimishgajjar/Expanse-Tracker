import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { Loading } from "@/components/ui";
import { tapSuccess } from "@/lib/haptics";
import { colors, radius } from "@/lib/theme";

export default function ChangePassword() {
  const { token, ready } = useApp();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  async function save() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("/auth/change-password", { method: "POST", body: { current, newPassword: next } });
      tapSuccess();
      setMsg({ ok: true, text: "Password updated." });
      setCurrent("");
      setNext("");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't update." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Change password</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={s.label}>Current password</Text>
          <TextInput style={s.input} value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.inkFaint} />
        </View>
        <View>
          <Text style={s.label}>New password</Text>
          <TextInput style={s.input} value={next} onChangeText={setNext} secureTextEntry placeholder="At least 8 characters" placeholderTextColor={colors.inkFaint} />
        </View>
        {msg ? <Text style={{ color: msg.ok ? colors.green : colors.red, fontSize: 14 }}>{msg.text}</Text> : null}
        <Pressable style={[s.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Update password</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  save: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center", marginTop: 8 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
