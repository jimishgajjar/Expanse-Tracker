import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors, radius } from "@/lib/theme";

export default function Forgot() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      await api("/auth/forgot", { method: "POST", body: { email: email.trim() } });
    } catch {
      /* always show the same result */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.body}>
        <Text style={s.title}>Reset password</Text>
        <Text style={s.sub}>Enter your email and we&apos;ll send a reset link.</Text>
        <View style={{ height: 26 }} />
        {sent ? (
          <View style={s.sentBox}>
            <Feather name="mail" size={30} color={colors.green} />
            <Text style={s.sentText}>
              If an account exists for {email.trim()}, a reset link is on its way. Open it on any device to set a new password.
            </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={s.link}>Back to sign in</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              placeholder="you@example.com"
              placeholderTextColor={colors.inkFaint}
              onSubmitEditing={submit}
              returnKeyType="send"
            />
            <Pressable style={[s.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Send reset link</Text>}
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { paddingHorizontal: 12, paddingVertical: 8 },
  body: { flex: 1, justifyContent: "center", paddingHorizontal: 24, marginTop: -60 },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 15, color: colors.inkSoft, marginTop: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  button: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  sentBox: { alignItems: "center", gap: 14 },
  sentText: { fontSize: 15, color: colors.inkSoft, textAlign: "center", lineHeight: 22 },
  link: { color: colors.green, fontSize: 15, fontWeight: "600", marginTop: 6 },
});
