import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius } from "@/lib/theme";
import { LucideIcon } from "@/lib/icons";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style as ViewStyle]}>{children}</View>;
}

/** Colored rounded square showing the account/category's lucide icon (same set
    as the web), falling back to the first letter of the label. */
export function IconBubble({
  icon,
  label,
  color,
  size = 38,
}: {
  icon?: string | null;
  label?: string;
  color?: string;
  size?: number;
}) {
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
      {icon ? (
        <LucideIcon name={icon} size={Math.round(size * 0.5)} color={c} />
      ) : (
        <Text style={{ color: c, fontWeight: "700", fontSize: size * 0.4 }}>{(label || "?").slice(0, 1).toUpperCase()}</Text>
      )}
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

export function ErrorView({
  message,
  onRetry,
  onSignOut,
}: {
  message: string;
  onRetry: () => void;
  onSignOut?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700", marginBottom: 6 }}>Couldn&apos;t load your data</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 14, textAlign: "center", paddingHorizontal: 36, marginBottom: 18 }}>{message}</Text>
      <Pressable onPress={onRetry} style={{ backgroundColor: colors.green, paddingHorizontal: 22, paddingVertical: 11, borderRadius: radius.md }}>
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Try again</Text>
      </Pressable>
      {onSignOut ? (
        <Pressable onPress={onSignOut} style={{ marginTop: 16 }} hitSlop={8}>
          <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Sign out</Text>
        </Pressable>
      ) : null}
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
