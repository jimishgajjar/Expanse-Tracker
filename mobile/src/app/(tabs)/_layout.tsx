import { Redirect, Tabs, useRouter } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/ui";
import { tapLight } from "@/lib/haptics";
import { colors } from "@/lib/theme";

const ITEMS = [
  { name: "home", label: "Overview", icon: "home" },
  { name: "activity", label: "Activity", icon: "list" },
  { name: "insights", label: "Insights", icon: "bar-chart-2" },
  { name: "more", label: "More", icon: "grid" },
] as const;

function AndroidBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const renderItem = (name: typeof ITEMS[number]["name"]) => {
    const route = state.routes.find((item) => item.name === name);
    if (!route) return null;
    const selected = state.routes[state.index]?.name === name;
    const item = ITEMS.find((entry) => entry.name === name)!;
    return (
      <Pressable
        key={name}
        onPress={() => {
          tapLight();
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigation.navigate(name);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={item.label}
        style={styles.item}
      >
        <View style={[styles.iconFrame, selected && styles.selectedFrame]}>
          <Feather name={item.icon} size={20} color={selected ? colors.green : colors.inkSoft} />
        </View>
        <Text style={[styles.label, selected && styles.selectedLabel]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {renderItem("home")}
      {renderItem("activity")}
      <Pressable
        onPress={() => { tapLight(); router.push("/add"); }}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        style={styles.addItem}
      >
        <View style={styles.addButton}><Feather name="plus" size={24} color={colors.white} /></View>
        <Text style={styles.addLabel}>Add</Text>
      </Pressable>
      {renderItem("insights")}
      {renderItem("more")}
    </View>
  );
}

function IosTabs() {
  return (
    <NativeTabs
      tintColor={colors.green}
      iconColor={{ default: colors.inkSoft, selected: colors.green }}
      labelStyle={{ default: { color: colors.inkSoft, fontSize: 10 }, selected: { color: colors.green, fontSize: 10, fontWeight: "600" } }}
    >
      <NativeTabs.Trigger name="home"><Icon sf={{ default: "house", selected: "house.fill" }} /><Label>Overview</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity"><Icon sf={{ default: "list.bullet", selected: "list.bullet" }} /><Label>Activity</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="capture"><Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} /><Label>Add</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="insights"><Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} /><Label>Insights</Label></NativeTabs.Trigger>
      <NativeTabs.Trigger name="more"><Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} /><Label>More</Label></NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabsLayout() {
  const { ready, token } = useApp();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;
  if (Platform.OS === "ios") return <IosTabs />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AndroidBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="capture" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong,
    paddingTop: 7, paddingHorizontal: 8,
  },
  item: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 },
  iconFrame: { width: 48, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  selectedFrame: { backgroundColor: colors.greenSoft },
  label: { color: colors.inkSoft, fontSize: 10, fontWeight: "500" },
  selectedLabel: { color: colors.green, fontWeight: "700" },
  addItem: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 },
  addButton: { width: 42, height: 30, borderRadius: 15, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  addLabel: { color: colors.green, fontSize: 10, fontWeight: "700" },
});
