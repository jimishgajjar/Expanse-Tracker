import { Redirect, Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/lib/store";
import { Loading } from "@/components/ui";
import { tapLight } from "@/lib/haptics";
import { colors } from "@/lib/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  home: "home",
  activity: "list",
  insights: "bar-chart-2",
  more: "menu",
};
const LABELS: Record<string, string> = { home: "Home", activity: "Activity", insights: "Insights", more: "More" };

/** Floating liquid-glass tab bar where the active tab smoothly expands into a
    labelled pill (icon -> icon + label), with a glowing brand "+" in the centre. */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const focused = state.index === index;
    const onPress = () => {
      tapLight();
      LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        style={[styles.item, focused && styles.itemActive]}
      >
        <Feather name={ICONS[route.name] ?? "circle"} size={22} color={focused ? "#ffffff" : "rgba(255,255,255,0.55)"} />
        {focused ? (
          <Text style={styles.label} numberOfLines={1}>
            {LABELS[route.name] ?? route.name}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <BlurView intensity={64} tint="systemChromeMaterialDark" experimentalBlurMethod="dimezisBlurView" style={styles.bar}>
        {tab(0)}
        {tab(1)}
        <Pressable
          key="add"
          onPress={() => {
            tapLight();
            router.push("/add");
          }}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          style={styles.add}
        >
          <Feather name="plus" size={26} color="#ffffff" />
        </Pressable>
        {tab(2)}
        {tab(3)}
      </BlurView>
    </View>
  );
}

export default function TabsLayout() {
  const { ready, token } = useApp();
  if (!ready) return <Loading />;
  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <GlassTabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(20,20,22,0.20)",
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  item: { flexDirection: "row", alignItems: "center", height: 44, paddingHorizontal: 13, borderRadius: 22 },
  itemActive: { backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 15 },
  label: { color: "#ffffff", fontSize: 13, fontWeight: "700", marginLeft: 7 },
  add: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    shadowColor: colors.green,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
});
