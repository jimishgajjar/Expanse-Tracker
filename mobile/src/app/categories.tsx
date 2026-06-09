import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { Card, IconBubble, Loading } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function Categories() {
  const { data, loading, reload } = useApp();
  const router = useRouter();
  if (!data) return <Loading />;

  const groups = [
    { title: "Expense", items: data.categories.filter((c) => c.kind === "expense") },
    { title: "Income", items: data.categories.filter((c) => c.kind === "income") },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.ink} />
        </Pressable>
        <Text style={s.title}>Categories</Text>
        <Pressable onPress={() => router.push("/category-form")} hitSlop={12}>
          <Feather name="plus" size={24} color={colors.green} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.green} />}
      >
        {groups.map((g) => (
          <View key={g.title} style={{ marginBottom: 18 }}>
            <Text style={s.section}>{g.title}</Text>
            <Card style={{ padding: 0 }}>
              {g.items.length === 0 ? (
                <Text style={s.empty}>None yet.</Text>
              ) : (
                g.items.map((c, i) => (
                  <Pressable key={c.id} onPress={() => router.push(`/category-form?id=${c.id}`)} style={[s.row, i > 0 && s.divider]}>
                    <IconBubble icon={c.icon} color={c.color} size={34} />
                    <Text style={s.rowText} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Feather name="chevron-right" size={18} color={colors.inkFaint} />
                  </Pressable>
                ))
              )}
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  section: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  rowText: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.ink },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.inkSoft, fontSize: 14, padding: 14 },
});
