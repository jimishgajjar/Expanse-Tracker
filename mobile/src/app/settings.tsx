import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Card, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/lib/theme";

const CURRENCIES = [
  { code: "CAD", symbol: "C$" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "INR", symbol: "₹" },
  { code: "AUD", symbol: "A$" },
  { code: "JPY", symbol: "¥" },
  { code: "AED", symbol: "AED" },
];

export default function Settings() {
  const { data, loading, reload, signOut } = useApp();
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!data) return <Loading />;
  const active = data.settings.currencyCode;

  async function setCurrency(code: string) {
    if (busy || code === active) return;
    setBusy(true);
    try {
      await api("/settings", { method: "PATCH", body: { currencyCode: code } });
      await reload();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} />}
      >
        <Text style={s.section}>Account</Text>
        <Card style={{ marginBottom: 18 }}>
          <Text style={s.cardLabel}>Email</Text>
          <Text style={s.cardValue}>{user?.email ?? "—"}</Text>
        </Card>

        <Text style={s.section}>Currency</Text>
        <Card style={{ padding: 0, marginBottom: 18 }}>
          {CURRENCIES.map((c, i) => (
            <Pressable key={c.code} onPress={() => setCurrency(c.code)} style={[s.row, i > 0 && s.divider]}>
              <Text style={s.symbol}>{c.symbol}</Text>
              <Text style={s.rowText}>{c.code}</Text>
              {active === c.code ? <Feather name="check" size={18} color={colors.green} /> : null}
            </Pressable>
          ))}
        </Card>

        <Pressable onPress={signOut} style={s.signOut}>
          <Feather name="log-out" size={16} color={colors.red} />
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  cardLabel: { fontSize: 13, color: colors.inkSoft },
  cardValue: { fontSize: 16, fontWeight: "600", color: colors.ink, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  symbol: { fontSize: 16, fontWeight: "700", color: colors.ink, width: 36 },
  rowText: { flex: 1, fontSize: 15, color: colors.ink },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  signOutText: { color: colors.red, fontSize: 15, fontWeight: "600" },
});
