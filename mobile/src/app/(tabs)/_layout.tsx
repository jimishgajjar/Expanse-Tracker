import { Redirect, Tabs, useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
const LABELS: Record<string, string> = { home: "Overview", activity: "Activity", insights: "Insights", more: "More" };

const PANEL_OFFSET = 480; // off-screen start for the slide-up (taller than any panel)

type Tile = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress: () => void;
  routeKey?: string;
  primary?: boolean;
};

/** Mobile nav as a "Control Center" launcher: a frosted grabber pill sits at the
    bottom and raises a dark frosted sheet with a grid of every destination. */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const openLauncher = () => {
    tapLight();
    setOpen(true);
    Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const closeLauncher = () => {
    Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) setOpen(false);
    });
  };

  const currentName = state.routes[state.index]?.name ?? "home";
  const go = (fn: () => void) => () => {
    tapLight();
    fn();
    closeLauncher();
  };

  const tiles: Tile[] = [
    { label: "Overview", icon: "home", color: "#0f7b6c", routeKey: "home", onPress: go(() => navigation.navigate("home")) },
    { label: "Activity", icon: "list", color: "#0b6e99", routeKey: "activity", onPress: go(() => navigation.navigate("activity")) },
    { label: "Insights", icon: "bar-chart-2", color: "#6940a5", routeKey: "insights", onPress: go(() => navigation.navigate("insights")) },
    { label: "Add", icon: "plus", color: "#047857", primary: true, onPress: go(() => router.push("/add")) },
    { label: "Categories", icon: "tag", color: "#0b6e99", onPress: go(() => router.push("/categories")) },
    { label: "Subscriptions", icon: "repeat", color: "#6940a5", onPress: go(() => router.push("/subscriptions")) },
    { label: "Goals", icon: "target", color: "#0f7b6c", onPress: go(() => router.push("/goals")) },
    { label: "Split", icon: "users", color: "#dd6b20", onPress: go(() => router.push("/split")) },
    { label: "Sharing", icon: "user-plus", color: "#d53f8c", onPress: go(() => router.push("/members")) },
    { label: "Settings", icon: "settings", color: "#787774", onPress: go(() => router.push("/settings")) },
    { label: "Account", icon: "user", color: "#3f3f46", routeKey: "more", onPress: go(() => navigation.navigate("more")) },
  ];

  const panelStyle = { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_OFFSET, 0] }) }] };

  return (
    <>
      <View pointerEvents="box-none" style={[styles.grabWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable onPress={openLauncher} accessibilityRole="button" accessibilityLabel="Open navigation">
          <BlurView intensity={60} tint="systemChromeMaterialDark" experimentalBlurMethod="dimezisBlurView" style={styles.grab}>
            <Feather name={ICONS[currentName] ?? "circle"} size={18} color="#ffffff" />
            <Text style={styles.grabLabel}>{LABELS[currentName] ?? "Menu"}</Text>
            <View style={styles.dots}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </BlurView>
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeLauncher} statusBarTranslucent>
        <Animated.View style={[styles.backdrop, { opacity: anim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeLauncher} accessibilityLabel="Close navigation" />
        </Animated.View>
        <Animated.View pointerEvents="box-none" style={[styles.panelWrap, panelStyle]}>
          <BlurView
            intensity={40}
            tint="systemChromeMaterialDark"
            experimentalBlurMethod="dimezisBlurView"
            style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}
          >
            <View style={styles.notch} />
            <View style={styles.grid}>
              {tiles.map((t) => {
                const active = t.routeKey === currentName;
                return (
                  <Pressable key={t.label} onPress={t.onPress} accessibilityRole="button" style={styles.tile}>
                    <View style={[styles.tileIcon, { backgroundColor: t.color }, active && styles.tileIconActive, t.primary && styles.tileIconPrimary]}>
                      <Feather name={t.icon} size={22} color="#ffffff" />
                    </View>
                    <Text style={styles.tileLabel} numberOfLines={1}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </Animated.View>
      </Modal>
    </>
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
  grabWrap: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" },
  grab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(20,20,22,0.30)",
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  grabLabel: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  dots: { width: 14, height: 14, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignContent: "space-between", marginLeft: 2 },
  dot: { width: 5, height: 5, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.75)" },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  panelWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  panel: {
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(18,18,20,0.55)",
  },
  notch: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.30)", marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: { width: "33.333%", alignItems: "center", paddingVertical: 10 },
  tileIcon: { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  tileIconActive: { borderWidth: 2, borderColor: colors.green },
  tileIconPrimary: { shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  tileLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontWeight: "600" },
});
