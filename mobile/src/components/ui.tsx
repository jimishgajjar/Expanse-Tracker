import React from "react";
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius } from "@/lib/theme";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style as ViewStyle]}>{children}</View>;
}

/** Colored rounded square with the first letter — stands in for the web icon set. */
export function IconBubble({ label, color, size = 38 }: { label: string; color?: string; size?: number }) {
  const c = color || colors.inkSoft;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: c + "22",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: c, fontWeight: "700", fontSize: size * 0.4 }}>{(label || "?").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + "22", borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
