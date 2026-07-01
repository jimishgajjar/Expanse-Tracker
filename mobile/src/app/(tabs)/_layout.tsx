import { Redirect, Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/ui";
import { tapLight } from "@/lib/haptics";
import { colors } from "@/lib/theme";

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  home: "home",
  activity: "list",
  insights: "bar-chart-2",
  more: "menu",
};
const LABELS: Record<string, string> = { home: "Home", activity: "Activity", insights: "Insights", more: "More" };

/** Clean, always-visible labeled tab bar — an icon over a label on every tab,
    a soft green pill behind the active section, one tap to anything. */
function LabeledTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const focused = state.index === index;
    const onPress = () => {
      tapLight();
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    const tint = focused ? colors.green : colors.inkFaint;
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        style={styles.item}
      >
        <View style={[styles.pill, focused && styles.pillActive]}>
          <Feather name={ICONS[route.name] ?? "circle"} size={22} color={tint} />
          <Text style={[styles.label, { color: tint }]}>{LABELS[route.name] ?? route.name}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tab(0)}
      {tab(1)}
      <Pressable
        onPress={() => {
          tapLight();
          router.push("/add");
        }}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        style={styles.item}
      >
        <View style={styles.pill}>
          <Feather name="plus" size={22} color={colors.inkFaint} />
          <Text style={[styles.label, { color: colors.inkFaint }]}>Add</Text>
        </View>
      </Pressable>
      {tab(2)}
      {tab(3)}
    </View>
  );
}

export default function TabsLayout() {
  const { ready, token } = useApp();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <LabeledTabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: { flex: 1, alignItems: "center" },
  pill: { alignItems: "center", gap: 3, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  pillActive: { backgroundColor: colors.greenSoft },
  label: { fontSize: 10.5, fontWeight: "600" },
});
