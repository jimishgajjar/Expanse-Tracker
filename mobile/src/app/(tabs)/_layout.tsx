import { Redirect, Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
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

/** Full-width liquid-glass dock. A single emerald spotlight glides under the
    active tab (spring), the active icon + label light up white, and a glowing
    brand "+" sits in the centre slot. */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const slotW = width / 5;

  // Route index -> dock slot. Slot 2 holds the centre "+", so insights/more shift right.
  const activeSlot = state.index <= 1 ? state.index : state.index + 1;
  const x = useRef(new Animated.Value(activeSlot * slotW)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: activeSlot * slotW, useNativeDriver: true, speed: 13, bounciness: 8 }).start();
  }, [activeSlot, slotW, x]);

  const tab = (index: number) => {
    const route = state.routes[index];
    if (!route) return null;
    const focused = state.index === index;
    const onPress = () => {
      tapLight();
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        style={styles.item}
      >
        <Feather name={ICONS[route.name] ?? "circle"} size={22} color={focused ? "#ffffff" : "rgba(255,255,255,0.45)"} />
        <Text style={[styles.label, { color: focused ? "#ffffff" : "transparent" }]} numberOfLines={1}>
          {LABELS[route.name] ?? route.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <BlurView
      intensity={64}
      tint="systemChromeMaterialDark"
      experimentalBlurMethod="dimezisBlurView"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) + 6 }]}
    >
      <Animated.View pointerEvents="none" style={[styles.spotlight, { width: slotW, transform: [{ translateX: x }] }]}>
        <View style={styles.spotlightInner} />
      </Animated.View>

      {tab(0)}
      {tab(1)}
      <View style={styles.item}>
        <Pressable
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
      </View>
      {tab(2)}
      {tab(3)}
    </BlurView>
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

const SLOT_H = 52;

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(20,20,22,0.18)",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 14,
  },
  spotlight: { position: "absolute", left: 0, top: 10, height: SLOT_H },
  spotlightInner: {
    flex: 1,
    marginHorizontal: 9,
    borderRadius: 18,
    backgroundColor: "rgba(16,185,129,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    shadowColor: colors.green,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  item: { flex: 1, height: SLOT_H, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 10, fontWeight: "700", marginTop: 3 },
  add: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: colors.green,
    shadowOpacity: 0.55,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 4 },
  },
});
