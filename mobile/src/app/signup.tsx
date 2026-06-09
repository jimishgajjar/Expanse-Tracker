import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, Redirect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/ui";
import { colors, radius } from "@/lib/theme";

export default function Signup() {
  const { ready, token, signUp } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Loading />;
  if (token) return <Redirect href="/home" />;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.logo}>
            <Text style={s.logoText}>E</Text>
          </View>
          <Text style={s.title}>Create your account</Text>
          <Text style={s.sub}>Start tracking in seconds.</Text>

          <View style={{ height: 28 }} />

          <Text style={s.label}>Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="words"
          />

          <View style={{ height: 14 }} />

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
          />

          <View style={{ height: 14 }} />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor={colors.inkFaint}
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable style={[s.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Create account</Text>}
          </Pressable>

          <View style={s.footer}>
            <Text style={s.footerText}>Already have an account? </Text>
            <Link href="/login" replace style={s.footerLink}>
              Sign in
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  logoText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 15, color: colors.inkSoft, marginTop: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  error: { color: colors.red, marginTop: 14, fontSize: 14 },
  button: { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 22 },
  footerText: { color: colors.inkSoft, fontSize: 14 },
  footerLink: { color: colors.green, fontSize: 14, fontWeight: "600" },
});
