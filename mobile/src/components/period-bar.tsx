import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePeriod } from "@/lib/period";
import { RANGE_LABELS, RANGE_TYPES, canNavigate } from "@/lib/dates";
import { colors, radius } from "@/lib/theme";

export function PeriodBar() {
  const { range, label, setRange, prev, next } = usePeriod();
  const navigable = canNavigate(range);

  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {RANGE_TYPES.map((rt) => (
          <Pressable
            key={rt}
            onPress={() => setRange(rt)}
            style={[s.segment, range === rt ? s.segmentActive : s.segmentInactive]}
          >
            <Text style={[s.segmentText, range === rt && s.segmentTextActive]}>{RANGE_LABELS[rt]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.nav}>
        <Pressable onPress={prev} disabled={!navigable} hitSlop={8} style={s.navBtn}>
          <Feather name="chevron-left" size={20} color={navigable ? colors.ink : colors.inkFaint} />
        </Pressable>
        <Text style={s.navLabel} numberOfLines={1}>
          {label}
        </Text>
        <Pressable onPress={next} disabled={!navigable} hitSlop={8} style={s.navBtn}>
          <Feather name="chevron-right" size={20} color={navigable ? colors.ink : colors.inkFaint} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  segment: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  segmentActive: { backgroundColor: colors.green + "18", borderColor: colors.green },
  segmentInactive: { backgroundColor: colors.card, borderColor: colors.border },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  segmentTextActive: { color: colors.green },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  navBtn: {
    width: 38,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  navLabel: { fontSize: 15, fontWeight: "600", color: colors.ink, minWidth: 160, textAlign: "center" },
});
