import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { registerForPush } from "@/lib/push";
import { Card, Loading } from "@/components/ui";
import { colors } from "@/lib/theme";

const CURRENCIES = [
  { code: "CAD", symbol: "C$" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "INR", symbol: "₹" },
  { code: "AUD", symbol: "A$" },
  { code: "JPY", symbol: "¥" },
];

export default function Settings() {
  const { data, loading, reload, signOut } = useApp();
  const user = useAuth((st) => st.user);
  const setActiveWorkspace = useAuth((st) => st.setActiveWorkspace);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);

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
  async function switchTo(workspaceId: string) {
    if (busy || workspaceId === data?.activeWorkspaceId) return;
    setBusy(true);
    try {
      await api("/workspace/switch", { method: "POST", body: { workspaceId } });
      setActiveWorkspace(workspaceId);
      await reload();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  async function enableNotifications() {
    setNotif("Requesting…");
    const t = await registerForPush();
    setNotif(t ? "Enabled on this device." : "Needs a development build (not Expo Go).");
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

        {data.workspaces.length > 1 ? (
          <>
            <Text style={s.section}>Trackers</Text>
            <Card style={{ padding: 0, marginBottom: 18 }}>
              {data.workspaces.map((w, i) => (
                <Pressable key={w.id} onPress={() => switchTo(w.id)} style={[s.row, i > 0 && s.divider]}>
                  <Text style={s.rowText} numberOfLines={1}>
                    {w.name}
                  </Text>
                  {w.id === data.activeWorkspaceId ? <Feather name="check" size={18} color={colors.green} /> : null}
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}

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

        <Text style={s.section}>Security</Text>
        <Card style={{ padding: 0, marginBottom: 18 }}>
          <Pressable onPress={() => router.push("/change-password")} style={s.row}>
            <Feather name="lock" size={16} color={colors.ink} style={{ width: 24 }} />
            <Text style={s.rowText}>Change password</Text>
            <Feather name="chevron-right" size={18} color={colors.inkFaint} />
          </Pressable>
        </Card>

        <Text style={s.section}>Notifications</Text>
        <Card style={{ marginBottom: 18 }}>
          <Pressable onPress={enableNotifications} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="bell" size={16} color={colors.ink} />
            <Text style={s.rowText}>Enable notifications</Text>
          </Pressable>
          {notif ? <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: 8 }}>{notif}</Text> : null}
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
