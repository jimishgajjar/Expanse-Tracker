import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui";
import { colors } from "@/lib/theme";

type Item = { label: string; icon: keyof typeof Feather.glyphMap; href: string };

const ITEMS: Item[] = [
  { label: "Categories", icon: "tag", href: "/categories" },
  { label: "Savings goals", icon: "target", href: "/goals" },
  { label: "Add account", icon: "credit-card", href: "/account-form" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

export default function More() {
  const { signOut } = useApp();
  const user = useAuth((s) => s.user);
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.title}>More</Text>

        <Card style={{ padding: 0, marginBottom: 18 }}>
          {ITEMS.map((it, i) => (
            <Pressable key={it.href + it.label} onPress={() => router.push(it.href as never)} style={[s.row, i > 0 && s.divider]}>
              <View style={s.iconWrap}>
                <Feather name={it.icon} size={18} color={colors.ink} />
              </View>
              <Text style={s.rowText}>{it.label}</Text>
              <Feather name="chevron-right" size={18} color={colors.inkFaint} />
            </Pressable>
          ))}
        </Card>

        {user ? <Text style={s.email}>Signed in as {user.email}</Text> : null}

        <Pressable onPress={signOut} style={s.signOut}>
          <Feather name="log-out" size={16} color={colors.red} />
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", color: colors.ink, letterSpacing: -0.4, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  iconWrap: { width: 30, alignItems: "center" },
  rowText: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.ink },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  email: { fontSize: 13, color: colors.inkSoft, textAlign: "center", marginBottom: 14 },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  signOutText: { color: colors.red, fontSize: 15, fontWeight: "600" },
});
