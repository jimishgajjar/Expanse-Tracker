import { Pressable, StyleSheet, Text, View } from "react-native";
import { LucideIcon } from "@/lib/icons";
import { colors, radius } from "@/lib/theme";

export const ICON_CHOICES = [
  "wallet", "piggy-bank", "banknote", "credit-card", "landmark", "coins", "dollar-sign", "home",
  "car", "utensils", "shopping-cart", "shopping-bag", "plane", "gift", "heart", "briefcase",
  "graduation-cap", "gamepad-2", "music", "film", "dumbbell", "smartphone", "zap", "droplet",
  "wifi", "bus", "fuel", "coffee", "shirt", "stethoscope", "book", "tag",
];

export const COLOR_CHOICES = [
  "#6366f1", "#0f7b6c", "#e03e3e", "#0b6e99", "#cb912f", "#6940a5",
  "#dd6b20", "#d53f8c", "#38a169", "#3182ce", "#805ad5", "#718096",
];

export function IconColorPicker({
  icon,
  color,
  onIcon,
  onColor,
}: {
  icon: string;
  color: string;
  onIcon: (i: string) => void;
  onColor: (c: string) => void;
}) {
  return (
    <View style={{ gap: 18 }}>
      <View>
        <Text style={s.label}>Color</Text>
        <View style={s.wrap}>
          {COLOR_CHOICES.map((c) => (
            <Pressable
              key={c}
              onPress={() => onColor(c)}
              style={[s.swatch, { backgroundColor: c }, color === c && s.swatchActive]}
            />
          ))}
        </View>
      </View>
      <View>
        <Text style={s.label}>Icon</Text>
        <View style={s.wrap}>
          {ICON_CHOICES.map((i) => (
            <Pressable
              key={i}
              onPress={() => onIcon(i)}
              style={[s.icon, { backgroundColor: icon === i ? color + "22" : colors.hover, borderColor: icon === i ? color : "transparent" }]}
            >
              <LucideIcon name={i} size={20} color={icon === i ? color : colors.inkSoft} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: colors.inkSoft, marginBottom: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: "transparent" },
  swatchActive: { borderColor: colors.ink },
  icon: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
});
