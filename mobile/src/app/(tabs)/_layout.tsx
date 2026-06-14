import { Redirect, Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";
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

/** Floating iOS "liquid glass" tab bar: a blurred dark pill that hovers over the
    content, a highlighted active capsule, and a brand "+" in the centre. */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
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
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        style={[styles.item, focused && styles.itemActive]}
      >
        <Feather name={ICONS[route.name] ?? "circle"} size={22} color={focused ? "#ffffff" : "rgba(255,255,255,0.55)"} />
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
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(20,20,22,0.20)",
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  item: { width: 50, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  itemActive: { width: 58, backgroundColor: "rgba(255,255,255,0.18)" },
  add: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    shadowColor: colors.green,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
