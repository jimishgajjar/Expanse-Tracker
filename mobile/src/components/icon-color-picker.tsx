import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
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

function hslHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// A 12-hue × 4-shade spectrum for picking beyond the presets.
const SPECTRUM_HUES = [0, 25, 45, 90, 150, 170, 195, 215, 245, 275, 305, 330];
const SPECTRUM_LIGHTNESS = [0.66, 0.54, 0.44, 0.32];
const SPECTRUM = SPECTRUM_LIGHTNESS.map((l) => SPECTRUM_HUES.map((h) => hslHex(h, 0.62, l)));

function randomColor() {
  return hslHex(Math.floor(Math.random() * 360), 0.55 + Math.random() * 0.2, 0.42 + Math.random() * 0.14);
}

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
  const isPreset = COLOR_CHOICES.some((c) => c.toLowerCase() === color.toLowerCase());
  const [custom, setCustom] = useState(!isPreset);
  const [hex, setHex] = useState(color);

  // Keep the hex field in step when a swatch (preset or spectrum) is tapped.
  useEffect(() => setHex(color), [color]);

  function submitHex(text: string) {
    setHex(text);
    const normalized = text.trim().startsWith("#") ? text.trim() : `#${text.trim()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) onColor(normalized.toLowerCase());
  }

  return (
    <View style={{ gap: 18 }}>
      <View>
        <Text style={s.label}>Color</Text>
        <View style={s.wrap}>
          {COLOR_CHOICES.map((c) => (
            <Pressable
              key={c}
              onPress={() => onColor(c)}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              style={[s.swatch, { backgroundColor: c }, color === c && s.swatchActive]}
            />
          ))}
          {/* Any colour: toggles the spectrum + hex field below. */}
          <Pressable
            onPress={() => setCustom((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Custom colour"
            style={[s.swatch, s.swatchTool, !isPreset && { backgroundColor: color }, !isPreset && s.swatchActive]}
          >
            <Feather name="sliders" size={15} color={isPreset ? colors.inkSoft : "#ffffff"} />
          </Pressable>
          <Pressable
            onPress={() => onColor(randomColor())}
            accessibilityRole="button"
            accessibilityLabel="Random colour"
            style={[s.swatch, s.swatchTool]}
          >
            <Feather name="shuffle" size={15} color={colors.inkSoft} />
          </Pressable>
        </View>

        {custom ? (
          <View style={s.customPanel}>
            {SPECTRUM.map((row, ri) => (
              <View key={ri} style={s.spectrumRow}>
                {row.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => onColor(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Colour ${c}`}
                    style={[s.spectrumCell, { backgroundColor: c }, color.toLowerCase() === c && s.spectrumActive]}
                  />
                ))}
              </View>
            ))}
            <View style={s.hexRow}>
              <View style={[s.hexPreview, { backgroundColor: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : color }]} />
              <TextInput
                style={s.hexInput}
                value={hex}
                onChangeText={submitHex}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="#0f7b6c"
                placeholderTextColor={colors.inkFaint}
                maxLength={7}
              />
            </View>
          </View>
        ) : null}
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
  swatchTool: { backgroundColor: colors.hover, alignItems: "center", justifyContent: "center" },
  customPanel: { marginTop: 12, gap: 6 },
  spectrumRow: { flexDirection: "row", gap: 6 },
  spectrumCell: { flex: 1, aspectRatio: 1, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  spectrumActive: { borderColor: colors.ink },
  hexRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  hexPreview: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  icon: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
});
