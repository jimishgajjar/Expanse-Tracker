import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui";
import { tapLight } from "@/lib/haptics";
import { colors, radius } from "@/lib/theme";

type Item = { label: string; icon: keyof typeof Feather.glyphMap; href: string; color: string };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Manage",
    items: [
      { label: "Categories", icon: "tag", href: "/categories", color: "#0b6e99" },
      { label: "Subscriptions & bills", icon: "repeat", href: "/subscriptions", color: "#6940a5" },
      { label: "Savings goals", icon: "target", href: "/goals", color: "#0f7b6c" },
    ],
  },
  {
    title: "Shared",
    items: [
      { label: "Split expenses", icon: "users", href: "/split", color: "#dd6b20" },
      { label: "Sharing", icon: "user-plus", href: "/members", color: "#d53f8c" },
    ],
  },
  {
    title: "App",
    items: [
      { label: "Add account", icon: "credit-card", href: "/account-form", color: "#6366f1" },
      { label: "Settings", icon: "settings", href: "/settings", color: "#787774" },
    ],
  },
];

export default function More() {
  const { signOut } = useApp();
  const user = useAuth((st) => st.user);
  const router = useRouter();
  const initial = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.bigTitle}>More</Text>

        <Card style={s.profile}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>
              {user?.name || "Your account"}
            </Text>
            <Text style={s.email} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </Card>

        {GROUPS.map((g) => (
          <View key={g.title}>
            <Text style={s.section}>{g.title}</Text>
            <Card style={{ padding: 0, marginBottom: 18 }}>
              {g.items.map((it, i) => (
                <Pressable
                  key={it.href + it.label}
                  onPress={() => {
                    tapLight();
                    router.push(it.href as never);
                  }}
                  style={({ pressed }) => [s.row, i > 0 && s.divider, pressed && { backgroundColor: colors.hover }]}
                >
                  <View style={[s.tile, { backgroundColor: it.color }]}>
                    <Feather name={it.icon} size={16} color="#fff" />
                  </View>
                  <Text style={s.rowText}>{it.label}</Text>
                  <Feather name="chevron-right" size={18} color={colors.inkFaint} />
                </Pressable>
              ))}
            </Card>
          </View>
        ))}

        <Pressable onPress={signOut} style={s.signOut}>
          <Feather name="log-out" size={16} color={colors.red} />
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  bigTitle: { fontSize: 30, fontWeight: "800", color: colors.ink, letterSpacing: -0.6, marginBottom: 18 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  email: { fontSize: 14, color: colors.inkSoft, marginTop: 1 },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  tile: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.ink },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
  signOutText: { color: colors.red, fontSize: 15, fontWeight: "600" },
});
